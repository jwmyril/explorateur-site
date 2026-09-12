import { offerById, type PriceOffer } from "./catalog.ts";

type PayhipSecretEnv = Env & { PAYHIP_API_KEY?: string };

export function payhipCheckout(offerId: string, env: Env): { provider: "payhip"; url: string } {
  const offer = offerById(offerId);
  if (!offer) throw new PayhipError(400, "offer_invalid", "Offre inconnue.");
  const url = env[offer.payhipUrlEnv];
  if (!url || url.includes("configure")) {
    throw new PayhipError(503, "payhip_product_not_configured", "Le produit Payhip n'est pas encore configuré.");
  }
  return { provider: "payhip", url };
}

export async function processPayhipWebhook(request: Request, env: Env): Promise<void> {
  const rawBody = await readBoundedBody(request, 100_000);
  let decoded: unknown;
  try { decoded = JSON.parse(rawBody); } catch { throw new PayhipError(400, "json_invalid", "Webhook Payhip invalide."); }
  const payload = objectRecord(decoded);
  const signature = stringField(payload, "signature");
  const apiKey = (env as PayhipSecretEnv).PAYHIP_API_KEY;
  if (!apiKey || apiKey === "dev_not_configured") {
    throw new PayhipError(503, "payhip_secret_not_configured", "Le secret Payhip n'est pas configuré.");
  }
  const expected = await sha256(apiKey);
  if (!constantTimeEqual(expected, signature.toLowerCase())) {
    throw new PayhipError(400, "signature_invalid", "Signature Payhip invalide.");
  }

  const event = parseEvent(payload, env);
  const duplicate = await env.DB.prepare("SELECT event_key FROM payhip_events WHERE event_key = ? LIMIT 1")
    .bind(event.key).first();
  if (duplicate) return;

  const user = await env.DB.prepare(
    "SELECT u.id AS userId, m.organization_id AS organizationId FROM users u JOIN memberships m ON m.user_id = u.id WHERE lower(u.email) = ? ORDER BY CASE m.role WHEN 'owner' THEN 0 ELSE 1 END LIMIT 1"
  ).bind(event.email).first<{ userId: string; organizationId: string }>();

  const status = user ? "processed" : "pending_user";
  const statements = [env.DB.prepare(
    "INSERT INTO payhip_events (event_key, event_type, transaction_id, subscription_id, customer_email, product_id, service, organization_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).bind(event.key, event.type, event.transactionId, event.subscriptionId, event.email, event.productId, event.offer.service, user?.organizationId ?? null, status)];

  if (user && event.action !== "none") {
    statements.push(env.DB.prepare(
      "INSERT INTO entitlements (organization_id, service, status) VALUES (?, ?, ?) ON CONFLICT(organization_id, service) DO UPDATE SET status = excluded.status, expires_at = NULL"
    ).bind(user.organizationId, event.offer.service, event.action === "activate" ? "active" : "cancelled"));
  }
  await env.DB.batch(statements);
}

interface ParsedEvent {
  key: string;
  type: string;
  transactionId: string | null;
  subscriptionId: string | null;
  email: string;
  productId: string;
  offer: PriceOffer;
  action: "activate" | "cancel" | "none";
}

function parseEvent(payload: Record<string, unknown>, env: Env): ParsedEvent {
  const type = stringField(payload, "type");
  if (!["paid", "refunded", "subscription.created", "subscription.deleted"].includes(type)) {
    throw new PayhipError(400, "event_unsupported", "Événement Payhip non pris en charge.");
  }

  if (type === "paid" || type === "refunded") {
    const items = payload.items;
    if (!Array.isArray(items) || items.length !== 1) throw new PayhipError(400, "items_invalid", "Une commande Payhip doit contenir un seul service.");
    const item = objectRecord(items[0]);
    const transactionId = stringField(payload, "id");
    const productId = String(item.product_id ?? "");
    const productPermalink = String(item.product_permalink ?? "");
    const email = normalizedEmail(payload.email);
    const offer = offerForProduct([productId, productPermalink], env);
    const date = String(payload.date_refunded ?? payload.date ?? "");
    if (type === "refunded" && payload.amount_refunded !== payload.price) {
      return { key: `${type}:${transactionId}:${date}`, type, transactionId, subscriptionId: null, email, productId, offer, action: "none" };
    }
    return { key: `${type}:${transactionId}:${date}`, type, transactionId, subscriptionId: null, email, productId, offer, action: type === "paid" ? "activate" : "cancel" };
  }

  const subscriptionId = stringField(payload, "subscription_id");
  const productId = String(payload.product_link ?? "");
  const email = normalizedEmail(payload.customer_email);
  const offer = offerForProduct([productId], env);
  const date = String(payload.date_subscription_deleted ?? payload.date_subscription_started ?? "");
  return {
    key: `${type}:${subscriptionId}:${date}`,
    type,
    transactionId: null,
    subscriptionId,
    email,
    productId,
    offer,
    action: type === "subscription.created" ? "activate" : "cancel",
  };
}

function offerForProduct(productValues: string[], env: Env): PriceOffer {
  const offer = (["reports-custom", "scenarios-team", "data-quality-complete", "instances-organization"] as const)
    .map((id) => offerById(id))
    .find((candidate) => candidate && productValues.some((value) => {
      const configured = env[candidate.payhipProductEnv];
      return value === configured || value.endsWith(`/b/${configured}`);
    }));
  if (!offer) throw new PayhipError(400, "product_unknown", "Produit Payhip inconnu.");
  return offer;
}

async function readBoundedBody(request: Request, maxBytes: number): Promise<string> {
  const length = Number(request.headers.get("content-length") ?? "0");
  if (length > maxBytes) throw new PayhipError(413, "payload_too_large", "Webhook trop volumineux.");
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) throw new PayhipError(413, "payload_too_large", "Webhook trop volumineux.");
  return text;
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(left: string, right: string): boolean {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  if (leftBytes.length !== rightBytes.length) return false;
  let difference = 0;
  for (let index = 0; index < leftBytes.length; index += 1) difference |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  return difference === 0;
}

function normalizedEmail(value: unknown): string {
  if (typeof value !== "string") throw new PayhipError(400, "email_invalid", "Courriel Payhip invalide.");
  const email = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new PayhipError(400, "email_invalid", "Courriel Payhip invalide.");
  return email;
}

function objectRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new PayhipError(400, "object_invalid", "Objet Payhip invalide.");
  return value as Record<string, unknown>;
}

function stringField(record: Record<string, unknown>, field: string): string {
  const value = record[field];
  if (typeof value !== "string" || !value) throw new PayhipError(400, "field_invalid", `Champ Payhip invalide : ${field}.`);
  return value;
}

export class PayhipError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
