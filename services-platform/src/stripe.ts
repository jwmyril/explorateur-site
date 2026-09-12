import { offerById } from "./catalog";

interface CheckoutRequest {
  offerId: string;
  organizationId: string;
  userId: string;
  email: string;
}

export async function createCheckout(input: CheckoutRequest, env: Env): Promise<{ id: string; url: string }> {
  const offer = offerById(input.offerId);
  if (!offer) throw new BillingError(400, "offer_invalid", "Offre inconnue.");
  const priceId = env[offer.stripePriceEnv];
  if (!priceId || priceId.startsWith("price_configure")) throw new BillingError(503, "price_not_configured", "Le tarif Stripe n'est pas encore configuré.");

  const form = new URLSearchParams();
  form.set("mode", offer.cadence === "month" ? "subscription" : "payment");
  form.set("line_items[0][price]", priceId);
  form.set("line_items[0][quantity]", "1");
  form.set("customer_email", input.email);
  form.set("success_url", `${env.APP_URL}/paiement/confirme?session_id={CHECKOUT_SESSION_ID}`);
  form.set("cancel_url", `${env.APP_URL}/tarifs?paiement=annule`);
  form.set("client_reference_id", input.organizationId);
  form.set("metadata[organization_id]", input.organizationId);
  form.set("metadata[user_id]", input.userId);
  form.set("metadata[service]", offer.service);
  form.set("metadata[offer_id]", offer.id);
  if (offer.cadence === "month") {
    form.set("subscription_data[metadata][organization_id]", input.organizationId);
    form.set("subscription_data[metadata][service]", offer.service);
  }

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, "content-type": "application/x-www-form-urlencoded" },
    body: form,
  });
  const result = await response.json<unknown>();
  if (!response.ok) throw new BillingError(502, "stripe_error", stripeMessage(result));
  const record = objectRecord(result);
  if (typeof record.id !== "string" || typeof record.url !== "string") throw new BillingError(502, "stripe_response_invalid", "Réponse Stripe invalide.");
  return { id: record.id, url: record.url };
}

export async function processStripeWebhook(request: Request, env: Env): Promise<void> {
  const signature = request.headers.get("stripe-signature");
  if (!signature) throw new BillingError(400, "signature_missing", "Signature Stripe absente.");
  const rawBody = await request.text();
  await verifyStripeSignature(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
  const event = objectRecord(JSON.parse(rawBody));
  const eventId = stringField(event, "id");
  const eventType = stringField(event, "type");
  const alreadyProcessed = await env.DB.prepare("SELECT stripe_event_id FROM stripe_events WHERE stripe_event_id = ?").bind(eventId).first();
  if (alreadyProcessed) return;

  const data = objectRecord(event.data);
  const object = objectRecord(data.object);
  if (eventType === "checkout.session.completed" && object.payment_status === "paid") {
    const metadata = objectRecord(object.metadata);
    const organizationId = stringField(metadata, "organization_id");
    const service = stringField(metadata, "service");
    if (!isService(service)) throw new BillingError(400, "service_invalid", "Service Stripe invalide.");
    await env.DB.prepare(
      "INSERT INTO entitlements (organization_id, service, status) VALUES (?, ?, 'active') ON CONFLICT(organization_id, service) DO UPDATE SET status = 'active', expires_at = NULL"
    ).bind(organizationId, service).run();
  }
  if (eventType === "customer.subscription.deleted" || eventType === "customer.subscription.updated") {
    const metadata = objectRecord(object.metadata);
    const organizationId = stringField(metadata, "organization_id");
    const service = stringField(metadata, "service");
    const status = stringField(object, "status");
    if (isService(service)) {
      const active = status === "active" || status === "trialing";
      await env.DB.prepare(
        "INSERT INTO entitlements (organization_id, service, status) VALUES (?, ?, ?) ON CONFLICT(organization_id, service) DO UPDATE SET status = excluded.status"
      ).bind(organizationId, service, active ? "active" : "cancelled").run();
    }
  }
  await env.DB.prepare("INSERT INTO stripe_events (stripe_event_id, event_type) VALUES (?, ?)").bind(eventId, eventType).run();
}

async function verifyStripeSignature(payload: string, header: string, secret: string): Promise<void> {
  const parts = header.split(",");
  const timestamp = parts.find((part) => part.startsWith("t="))?.slice(2);
  const signatures = parts.filter((part) => part.startsWith("v1=")).map((part) => part.slice(3));
  if (!timestamp || signatures.length === 0 || !/^\d+$/.test(timestamp)) throw new BillingError(400, "signature_invalid", "Signature Stripe invalide.");
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) throw new BillingError(400, "signature_expired", "Signature Stripe expirée.");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const expected = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${payload}`)));
  const valid = signatures.some((signature) => constantTimeEqual(expected, hexBytes(signature)));
  if (!valid) throw new BillingError(400, "signature_invalid", "Signature Stripe invalide.");
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  return difference === 0;
}

function hexBytes(value: string): Uint8Array {
  if (!/^[0-9a-f]+$/i.test(value) || value.length % 2) return new Uint8Array();
  return Uint8Array.from(value.match(/.{2}/g) ?? [], (pair) => Number.parseInt(pair, 16));
}

function objectRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new BillingError(400, "object_invalid", "Objet invalide.");
  return value as Record<string, unknown>;
}

function stringField(record: Record<string, unknown>, field: string): string {
  const value = record[field];
  if (typeof value !== "string" || !value) throw new BillingError(400, "field_invalid", `Champ Stripe invalide : ${field}.`);
  return value;
}

function isService(value: string): value is "reports" | "scenarios" | "data_quality" | "instances" {
  return ["reports", "scenarios", "data_quality", "instances"].includes(value);
}

function stripeMessage(value: unknown): string {
  try {
    const record = objectRecord(value);
    const error = objectRecord(record.error);
    return typeof error.message === "string" ? error.message : "Stripe a refusé la requête.";
  } catch { return "Stripe a refusé la requête."; }
}

export class BillingError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) { super(message); }
}
