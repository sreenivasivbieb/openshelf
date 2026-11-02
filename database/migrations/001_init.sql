-- OpenShelf schema v1 (docs/architecture/data-model.md).
-- Rules: money = INTEGER minor units; time = ISO-8601 UTC text;
-- quotes / orders / order_events / telemetry are INSERT-ONLY (enforced by triggers below).

CREATE TABLE merchants (
  id                 TEXT PRIMARY KEY,                 -- m_xxx
  name               TEXT NOT NULL,
  currency           TEXT NOT NULL DEFAULT 'USD',
  paypal_payee_email TEXT,                             -- sandbox seller account to pay; no secrets stored
  spec_json          TEXT,                             -- generated OpenAPI 3.1 document
  spec_status        TEXT NOT NULL DEFAULT 'pending'
                       CHECK (spec_status IN ('pending', 'ready', 'fallback')),
  created_at         TEXT NOT NULL
);

CREATE TABLE products (
  merchant_id       TEXT NOT NULL REFERENCES merchants(id),
  sku               TEXT NOT NULL,
  name              TEXT NOT NULL,
  description_raw   TEXT NOT NULL,                     -- exactly what the merchant uploaded (audit)
  description_agent TEXT,                              -- firewall-cleaned + rewritten for agents
  category          TEXT,
  price_minor       INTEGER NOT NULL CHECK (price_minor >= 0),
  stock             INTEGER NOT NULL CHECK (stock >= 0),
  shipping_days     INTEGER NOT NULL CHECK (shipping_days >= 0),
  return_days       INTEGER NOT NULL CHECK (return_days >= 0),
  rating_avg        REAL CHECK (rating_avg BETWEEN 0 AND 5),   -- merchant-reported
  review_count      INTEGER CHECK (review_count >= 0),         -- merchant-reported
  firewall_status   TEXT NOT NULL DEFAULT 'pending'
                      CHECK (firewall_status IN ('pending', 'clean', 'flagged')),
  firewall_reason   TEXT,
  updated_at        TEXT NOT NULL,
  PRIMARY KEY (merchant_id, sku)
);

-- Full-text search for /search (FTS5, bm25 ranking). Kept in sync by triggers.
CREATE VIRTUAL TABLE products_fts USING fts5(
  name, description_agent, category,
  content = 'products', content_rowid = 'rowid'
);
CREATE TRIGGER products_fts_ai AFTER INSERT ON products BEGIN
  INSERT INTO products_fts (rowid, name, description_agent, category)
  VALUES (new.rowid, new.name, new.description_agent, new.category);
END;
CREATE TRIGGER products_fts_ad AFTER DELETE ON products BEGIN
  INSERT INTO products_fts (products_fts, rowid, name, description_agent, category)
  VALUES ('delete', old.rowid, old.name, old.description_agent, old.category);
END;
CREATE TRIGGER products_fts_au AFTER UPDATE ON products BEGIN
  INSERT INTO products_fts (products_fts, rowid, name, description_agent, category)
  VALUES ('delete', old.rowid, old.name, old.description_agent, old.category);
  INSERT INTO products_fts (rowid, name, description_agent, category)
  VALUES (new.rowid, new.name, new.description_agent, new.category);
END;

-- Only PASSING quotes are stored. Failed quotes live in telemetry.
CREATE TABLE quotes (
  id               TEXT PRIMARY KEY,                   -- q_xxx
  merchant_id      TEXT NOT NULL REFERENCES merchants(id),
  sku              TEXT NOT NULL,
  quantity         INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_minor INTEGER NOT NULL,
  total_minor      INTEGER NOT NULL,
  currency         TEXT NOT NULL,
  shipping_days    INTEGER NOT NULL,
  return_days      INTEGER NOT NULL,
  guardrails_json  TEXT NOT NULL,                      -- the rules the agent sent
  agent_id         TEXT,
  created_at       TEXT NOT NULL,
  expires_at       TEXT NOT NULL,
  quote_hash       TEXT NOT NULL                       -- sha256 of canonical locked terms
);

CREATE TABLE orders (
  id              TEXT PRIMARY KEY,                    -- o_xxx
  merchant_id     TEXT NOT NULL REFERENCES merchants(id),
  quote_id        TEXT NOT NULL UNIQUE REFERENCES quotes(id),  -- one order per quote = idempotent /order
  quote_hash      TEXT NOT NULL,                       -- re-verified against quotes row before insert
  paypal_order_id TEXT NOT NULL UNIQUE,
  approve_url     TEXT NOT NULL,
  created_at      TEXT NOT NULL
);

-- Order status is the latest event; history is never rewritten.
CREATE TABLE order_events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id    TEXT NOT NULL REFERENCES orders(id),
  status      TEXT NOT NULL CHECK (status IN (
                'CREATED', 'APPROVED', 'CAPTURED', 'CAPTURE_FAILED',
                'SHIPPED', 'DELIVERED', 'RETURN_REQUESTED', 'REFUNDED')),
  detail_json TEXT,
  created_at  TEXT NOT NULL
);
CREATE INDEX order_events_by_order ON order_events (order_id, id);

-- Exactly one row per agent call (REST or MCP).
CREATE TABLE telemetry (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  merchant_id  TEXT NOT NULL,
  agent_id     TEXT,
  channel      TEXT NOT NULL CHECK (channel IN ('rest', 'mcp')),
  tool         TEXT NOT NULL CHECK (tool IN ('search', 'quote', 'order', 'track', 'return')),
  request_json TEXT NOT NULL,
  outcome      TEXT NOT NULL CHECK (outcome IN ('ok', 'pass', 'fail', 'error')),
  reason_codes TEXT,                                   -- JSON array when outcome = 'fail'
  quote_id     TEXT,
  order_id     TEXT,
  latency_ms   INTEGER NOT NULL,
  is_simulated INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL
);
CREATE INDEX telemetry_by_merchant ON telemetry (merchant_id, id);

-- Insert-only enforcement (NFR-03).
CREATE TRIGGER quotes_insert_only_u BEFORE UPDATE ON quotes BEGIN SELECT RAISE(ABORT, 'quotes are insert-only'); END;
CREATE TRIGGER quotes_insert_only_d BEFORE DELETE ON quotes BEGIN SELECT RAISE(ABORT, 'quotes are insert-only'); END;
CREATE TRIGGER orders_insert_only_u BEFORE UPDATE ON orders BEGIN SELECT RAISE(ABORT, 'orders are insert-only'); END;
CREATE TRIGGER orders_insert_only_d BEFORE DELETE ON orders BEGIN SELECT RAISE(ABORT, 'orders are insert-only'); END;
CREATE TRIGGER order_events_insert_only_u BEFORE UPDATE ON order_events BEGIN SELECT RAISE(ABORT, 'order_events are insert-only'); END;
CREATE TRIGGER order_events_insert_only_d BEFORE DELETE ON order_events BEGIN SELECT RAISE(ABORT, 'order_events are insert-only'); END;
CREATE TRIGGER telemetry_insert_only_u BEFORE UPDATE ON telemetry BEGIN SELECT RAISE(ABORT, 'telemetry is insert-only'); END;
CREATE TRIGGER telemetry_insert_only_d BEFORE DELETE ON telemetry BEGIN SELECT RAISE(ABORT, 'telemetry is insert-only'); END;
