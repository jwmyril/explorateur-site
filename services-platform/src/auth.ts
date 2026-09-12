export interface AuthenticatedSession {
  userId: string;
  organizationId: string;
}

export async function requestMagicLink(emailValue: unknown, env: Env): Promise<void> {
  const email = normalizeEmail(emailValue);
  const recent = await env.DB.prepare(
    "SELECT created_at FROM magic_links WHERE email = ? AND created_at > datetime('now', '-60 seconds') LIMIT 1"
  ).bind(email).first();
  if (recent) return;

  const token = secureToken();
  const tokenHash = await sha256(token);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  await env.DB.prepare("INSERT INTO magic_links (id, email, token_hash, expires_at) VALUES (?, ?, ?, ?)")
    .bind(crypto.randomUUID(), email, tokenHash, expiresAt).run();

  const link = `${env.APP_URL}/connexion?token=${encodeURIComponent(token)}`;
  await env.EMAIL.send({
    to: email,
    from: { email: env.AUTH_FROM_EMAIL, name: "Explorateur Haïti" },
    subject: "Votre lien de connexion Atmart",
    text: `Ouvrez ce lien dans les 15 minutes : ${link}\n\nSi vous n'avez pas demandé ce lien, ignorez ce message.`,
    html: `<p>Ouvrez ce lien dans les 15 minutes :</p><p><a href="${escapeHtml(link)}">Se connecter à Atmart</a></p><p>Si vous n'avez pas demandé ce lien, ignorez ce message.</p>`,
  });
}

export async function verifyMagicLink(tokenValue: unknown, env: Env): Promise<{ token: string; expiresAt: string }> {
  if (typeof tokenValue !== "string" || tokenValue.length < 32 || tokenValue.length > 200) throw new AuthError("Lien invalide.");
  const tokenHash = await sha256(tokenValue);
  const link = await env.DB.prepare(
    "SELECT id, email FROM magic_links WHERE token_hash = ? AND used_at IS NULL AND expires_at > CURRENT_TIMESTAMP LIMIT 1"
  ).bind(tokenHash).first<{ id: string; email: string }>();
  if (!link) throw new AuthError("Lien invalide ou expiré.");

  let user = await env.DB.prepare("SELECT id FROM users WHERE email = ? LIMIT 1").bind(link.email).first<{ id: string }>();
  if (!user) {
    const userId = crypto.randomUUID();
    const orgId = crypto.randomUUID();
    const displayName = link.email.split("@")[0] || "Utilisateur Atmart";
    const slug = `org-${userId.slice(0, 12)}`;
    await env.DB.batch([
      env.DB.prepare("INSERT INTO users (id, email, display_name) VALUES (?, ?, ?)").bind(userId, link.email, displayName),
      env.DB.prepare("INSERT INTO organizations (id, name, slug) VALUES (?, ?, ?)").bind(orgId, `Espace de ${displayName}`, slug),
      env.DB.prepare("INSERT INTO memberships (organization_id, user_id, role) VALUES (?, ?, 'owner')").bind(orgId, userId),
    ]);
    user = { id: userId };
  }

  const sessionToken = secureToken();
  const sessionHash = await sha256(sessionToken);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  await env.DB.batch([
    env.DB.prepare("UPDATE magic_links SET used_at = CURRENT_TIMESTAMP WHERE id = ? AND used_at IS NULL").bind(link.id),
    env.DB.prepare("INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)")
      .bind(crypto.randomUUID(), user.id, sessionHash, expiresAt),
  ]);
  return { token: sessionToken, expiresAt };
}

export async function authenticate(request: Request, db: D1Database): Promise<AuthenticatedSession> {
  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) throw new AuthError("Authentification requise.");
  const token = authorization.slice(7).trim();
  if (token.length < 32) throw new AuthError("Jeton invalide.");
  const hash = await sha256(token);
  const row = await db.prepare(
    "SELECT s.user_id AS userId, m.organization_id AS organizationId FROM sessions s JOIN memberships m ON m.user_id = s.user_id WHERE s.token_hash = ? AND s.revoked_at IS NULL AND s.expires_at > CURRENT_TIMESTAMP LIMIT 1"
  ).bind(hash).first<AuthenticatedSession>();
  if (!row) throw new AuthError("Session invalide ou expirée.");
  return row;
}

export class AuthError extends Error {}

export async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function secureToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function normalizeEmail(value: unknown): string {
  if (typeof value !== "string") throw new AuthError("Adresse courriel invalide.");
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AuthError("Adresse courriel invalide.");
  return email;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
}
