PRAGMA foreign_keys = ON;

CREATE TABLE payhip_events (
  event_key TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  transaction_id TEXT,
  subscription_id TEXT,
  customer_email TEXT NOT NULL,
  product_id TEXT NOT NULL,
  service TEXT NOT NULL CHECK (service IN ('reports', 'scenarios', 'data_quality', 'instances')),
  organization_id TEXT REFERENCES organizations(id) ON DELETE SET NULL,
  status TEXT NOT NULL CHECK (status IN ('processed', 'pending_user')),
  received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_payhip_events_email ON payhip_events(customer_email, received_at DESC);
CREATE INDEX idx_payhip_events_subscription ON payhip_events(subscription_id);

