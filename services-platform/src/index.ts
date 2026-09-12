import { auditRows, evaluateScenario, type ServiceId } from "./domain";
import { authenticate, AuthError, requestMagicLink, verifyMagicLink } from "./auth";
import { PRICE_OFFERS } from "./catalog";
import { BillingError, createCheckout, processStripeWebhook } from "./stripe";
import { PayhipError, payhipCheckout, processPayhipWebhook } from "./payhip";

const SERVICE_CATALOG = [
  { id: "reports", name: "Atmart Rapports", free: "Fiche Atmart standard", paid: "Rapports personnalisés, marque blanche et lots" },
  { id: "scenarios", name: "Atmart Scénarios", free: "Calcul de démonstration non enregistré", paid: "Projets privés, sensibilité, collaboration et exports" },
  { id: "data_quality", name: "Atmart Data Quality", free: "Règles et démonstration locale", paid: "Audit des données privées, rapport et validation" },
  { id: "instances", name: "Atmart Instances", free: "Explorateur public", paid: "Espace privé, rôles, données client et marque blanche" },
] as const;

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(request) });

    try {
      if (request.method === "GET" && url.pathname === "/api/v1/health") {
        return json({ ok: true, service: "atmart-explorateur-services", environment: env.ENVIRONMENT }, 200, request);
      }
      if (request.method === "GET" && url.pathname === "/api/v1/services") {
        return json({ dataAccess: "free", services: SERVICE_CATALOG }, 200, request);
      }
      if (request.method === "GET" && url.pathname === "/api/v1/pricing") {
        return json({ currency: "USD", taxesIncluded: false, dataAccess: "free", offers: PRICE_OFFERS.map(publicOffer) }, 200, request);
      }
      if (request.method === "POST" && url.pathname === "/api/v1/auth/request-link") {
        const body = asRecord(await readJson(request, 10_000));
        await requestMagicLink(body.email, env);
        return json({ accepted: true, message: "Si cette adresse est valide, un lien de connexion a été envoyé." }, 202, request);
      }
      if (request.method === "POST" && url.pathname === "/api/v1/auth/verify") {
        const body = asRecord(await readJson(request, 10_000));
        const session = await verifyMagicLink(body.token, env);
        return json({ session }, 200, request);
      }
      if (request.method === "POST" && url.pathname === "/api/v1/stripe/webhook") {
        await processStripeWebhook(request, env);
        return json({ received: true }, 200, request);
      }
      if (request.method === "POST" && url.pathname === "/api/v1/payhip/webhook") {
        await processPayhipWebhook(request, env);
        return json({ received: true }, 200, request);
      }
      if (request.method === "POST" && url.pathname === "/api/v1/scenarios/evaluate") {
        const body = await readJson(request, 250_000);
        return json({ result: evaluateScenario(asScenario(body)) }, 200, request);
      }
      if (request.method === "POST" && url.pathname === "/api/v1/audits/preview") {
        const body = await readJson(request, 500_000);
        const record = asRecord(body);
        const rows = Array.isArray(record.rows) ? record.rows.map(asRecord) : [];
        const required = Array.isArray(record.requiredColumns) ? record.requiredColumns.map(String) : [];
        return json({ result: auditRows(rows.slice(0, 1000), required), preview: true, retained: false }, 200, request);
      }

      const auth = await authenticate(request, env.DB);
      if (request.method === "POST" && url.pathname === "/api/v1/billing/checkout") {
        const body = asRecord(await readJson(request, 10_000));
        const offerId = requiredString(body.offerId, "offerId", 80);
        const user = await env.DB.prepare("SELECT email FROM users WHERE id = ? LIMIT 1").bind(auth.userId).first<{ email: string }>();
        if (!user) throw new HttpError(401, "user_missing", "Utilisateur introuvable.");
        const checkout = payhipCheckout(offerId, env);
        return json({ checkout, instruction: `Utilisez ${user.email} sur Payhip afin d'activer automatiquement le service.` }, 200, request);
      }
      if (request.method === "POST" && url.pathname === "/api/v1/billing/stripe-checkout") {
        const body = asRecord(await readJson(request, 10_000));
        const offerId = requiredString(body.offerId, "offerId", 80);
        const user = await env.DB.prepare("SELECT email FROM users WHERE id = ? LIMIT 1").bind(auth.userId).first<{ email: string }>();
        if (!user) throw new HttpError(401, "user_missing", "Utilisateur introuvable.");
        const checkout = await createCheckout({ offerId, organizationId: auth.organizationId, userId: auth.userId, email: user.email }, env);
        return json({ checkout, provider: "stripe-fallback" }, 201, request);
      }
      if (request.method === "POST" && url.pathname === "/api/v1/reports") {
        await requireEntitlement(env.DB, auth.organizationId, "reports");
        const body = asRecord(await readJson(request, 100_000));
        const territoryIds = stringArray(body.territoryIds, 1, 20);
        const templateId = requiredString(body.templateId, "templateId", 80);
        const id = crypto.randomUUID();
        await env.DB.prepare(
          "INSERT INTO report_jobs (id, organization_id, created_by, status, territory_ids, template_id, configuration) VALUES (?, ?, ?, 'draft', ?, ?, ?)"
        ).bind(id, auth.organizationId, auth.userId, JSON.stringify(territoryIds), templateId, JSON.stringify(body.configuration ?? {})).run();
        return json({ id, status: "draft" }, 201, request);
      }
      if (request.method === "POST" && url.pathname === "/api/v1/scenarios") {
        await requireEntitlement(env.DB, auth.organizationId, "scenarios");
        const body = asRecord(await readJson(request, 250_000));
        const name = requiredString(body.name, "name", 120);
        const definition = asScenario(body.definition);
        const result = evaluateScenario(definition);
        const id = crypto.randomUUID();
        await env.DB.prepare(
          "INSERT INTO scenarios (id, organization_id, created_by, name, definition, result) VALUES (?, ?, ?, ?, ?, ?)"
        ).bind(id, auth.organizationId, auth.userId, name, JSON.stringify(definition), JSON.stringify(result)).run();
        return json({ id, name, result }, 201, request);
      }
      if (request.method === "POST" && url.pathname === "/api/v1/audits") {
        await requireEntitlement(env.DB, auth.organizationId, "data_quality");
        const body = asRecord(await readJson(request, 2_000_000));
        const rows = Array.isArray(body.rows) ? body.rows.map(asRecord) : [];
        const required = Array.isArray(body.requiredColumns) ? body.requiredColumns.map(String) : [];
        const summary = auditRows(rows, required);
        const id = crypto.randomUUID();
        const deleteAfter = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
        await env.DB.prepare(
          "INSERT INTO audit_jobs (id, organization_id, created_by, status, summary, delete_after) VALUES (?, ?, ?, 'ready', ?, ?)"
        ).bind(id, auth.organizationId, auth.userId, JSON.stringify(summary), deleteAfter).run();
        return json({ id, status: "ready", deleteAfter, summary }, 201, request);
      }
      if (request.method === "POST" && url.pathname === "/api/v1/instances") {
        await requireEntitlement(env.DB, auth.organizationId, "instances");
        const body = asRecord(await readJson(request, 100_000));
        const name = requiredString(body.name, "name", 120);
        const slug = requiredString(body.slug, "slug", 80).toLowerCase();
        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new HttpError(400, "slug_invalid", "Le slug est invalide.");
        const id = crypto.randomUUID();
        await env.DB.prepare(
          "INSERT INTO instances (id, organization_id, created_by, name, slug, configuration, status) VALUES (?, ?, ?, ?, ?, ?, 'draft')"
        ).bind(id, auth.organizationId, auth.userId, name, slug, JSON.stringify(body.configuration ?? {})).run();
        return json({ id, name, slug, status: "draft" }, 201, request);
      }
      return json({ error: { code: "not_found", message: "Route introuvable." } }, 404, request);
    } catch (error) {
      const known = error instanceof HttpError ? error
        : error instanceof PayhipError ? new HttpError(error.status, error.code, error.message)
        : error instanceof BillingError ? new HttpError(error.status, error.code, error.message)
        : error instanceof AuthError ? new HttpError(401, "authentication_failed", error.message)
        : new HttpError(500, "internal_error", "Une erreur interne est survenue.");
      console.error(JSON.stringify({ level: "error", code: known.code, path: url.pathname, status: known.status }));
      return json({ error: { code: known.code, message: known.message } }, known.status, request);
    }
  },
} satisfies ExportedHandler<Env>;

async function requireEntitlement(db: D1Database, organizationId: string, service: ServiceId): Promise<void> {
  const row = await db.prepare(
    "SELECT status FROM entitlements WHERE organization_id = ? AND service = ? AND status IN ('trial', 'active') AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)"
  ).bind(organizationId, service).first<{ status: string }>();
  if (!row) throw new HttpError(403, "service_not_available", "Ce service payant n'est pas actif pour cette organisation.");
}

async function readJson(request: Request, maxBytes: number): Promise<unknown> {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > maxBytes) throw new HttpError(413, "payload_too_large", "Requête trop volumineuse.");
  if (!request.headers.get("content-type")?.toLowerCase().includes("application/json")) {
    throw new HttpError(415, "content_type_invalid", "Le contenu doit être en JSON.");
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) throw new HttpError(413, "payload_too_large", "Requête trop volumineuse.");
  try { return JSON.parse(text); } catch { throw new HttpError(400, "json_invalid", "JSON invalide."); }
}

function asScenario(value: unknown): Parameters<typeof evaluateScenario>[0] {
  const record = asRecord(value);
  if (!Array.isArray(record.criteria) || !Array.isArray(record.territories)) throw new HttpError(400, "scenario_invalid", "Critères et territoires sont requis.");
  const criteria = record.criteria.map((item) => {
    const criterion = asRecord(item);
    const direction: "higher" | "lower" = criterion.direction === "higher" ? "higher" : criterion.direction === "lower" ? "lower" : (() => { throw new HttpError(400, "direction_invalid", "Direction de critère invalide."); })();
    if (typeof criterion.weight !== "number") throw new HttpError(400, "weight_invalid", "Poids de critère invalide.");
    return {
      id: requiredString(criterion.id, "criterion.id", 80),
      label: requiredString(criterion.label, "criterion.label", 120),
      weight: criterion.weight,
      direction,
    };
  });
  const territories = record.territories.map((item) => {
    const territory = asRecord(item);
    const values = asRecord(territory.values);
    const cleanValues: Record<string, number | null> = {};
    for (const [key, itemValue] of Object.entries(values)) {
      if (itemValue !== null && typeof itemValue !== "number") throw new HttpError(400, "value_invalid", `Valeur invalide : ${key}.`);
      cleanValues[key] = itemValue;
    }
    return {
      id: requiredString(territory.id, "territory.id", 80),
      name: requiredString(territory.name, "territory.name", 160),
      values: cleanValues,
    };
  });
  return { criteria, territories };
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new HttpError(400, "object_required", "Un objet JSON est requis.");
  return value as Record<string, unknown>;
}

function requiredString(value: unknown, field: string, max: number): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new HttpError(400, "field_invalid", `Champ invalide : ${field}.`);
  return value.trim();
}

function stringArray(value: unknown, min: number, max: number): string[] {
  if (!Array.isArray(value) || value.length < min || value.length > max || value.some((item) => typeof item !== "string" || !item)) {
    throw new HttpError(400, "array_invalid", "Liste de territoires invalide.");
  }
  return value;
}

function corsHeaders(request: Request): Headers {
  const headers = new Headers({
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "authorization, content-type",
    "access-control-max-age": "86400",
    "vary": "Origin",
  });
  const origin = request.headers.get("origin");
  if (origin === "https://explorateur.atmart.ltd" || origin?.startsWith("http://localhost:")) {
    headers.set("access-control-allow-origin", origin);
  }
  return headers;
}

function json(value: unknown, status: number, request: Request): Response {
  const headers = corsHeaders(request);
  headers.set("content-type", "application/json; charset=utf-8");
  headers.set("cache-control", "no-store");
  headers.set("x-content-type-options", "nosniff");
  return new Response(JSON.stringify(value), { status, headers });
}

function publicOffer(offer: (typeof PRICE_OFFERS)[number]): Omit<typeof offer, "stripePriceEnv" | "payhipProductEnv" | "payhipUrlEnv"> {
  const { stripePriceEnv: _stripePriceEnv, payhipProductEnv: _payhipProductEnv, payhipUrlEnv: _payhipUrlEnv, ...visible } = offer;
  return visible;
}

class HttpError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
  }
}
