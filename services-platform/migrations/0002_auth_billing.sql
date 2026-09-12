PRAGMA foreign_keys = ON;

CREATE TABLE magic_links (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE billing_customers (
  organization_id TEXT PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  stripe_customer_id TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE billing_subscriptions (
  stripe_subscription_id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  service TEXT NOT NULL CHECK (service IN ('reports', 'scenarios', 'data_quality', 'instances')),
  stripe_price_id TEXT NOT NULL,
  status TEXT NOT NULL,
  current_period_end TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE stripe_events (
  stripe_event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  processed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_magic_links_email ON magic_links(email, created_at DESC);
CREATE INDEX idx_sessions_hash ON sessions(token_hash);
CREATE INDEX idx_subscriptions_org ON billing_subscriptions(organization_id, service);
