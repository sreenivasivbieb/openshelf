-- 003: scoped agent API keys (ADR-0012, NFR-01).
-- A key is shown once at creation; only its sha256 hash is stored. A valid key turns the agent's
-- self-declared id into a verified one (its label) and can be made mandatory per store.

CREATE TABLE agent_keys (
  id          TEXT PRIMARY KEY,                 -- k_xxx
  merchant_id TEXT NOT NULL REFERENCES merchants(id),
  label       TEXT NOT NULL,                    -- becomes the verified agent id in telemetry
  key_hash    TEXT NOT NULL UNIQUE,             -- sha256 hex of the full key; the key itself is never stored
  created_at  TEXT NOT NULL,
  revoked_at  TEXT                              -- set once; a revoked key never works again
);
CREATE INDEX agent_keys_by_merchant ON agent_keys (merchant_id, created_at);

-- 1 = keyless agent calls to /api and /mcp are refused with AGENT_KEY_REQUIRED.
ALTER TABLE merchants ADD COLUMN require_agent_key INTEGER NOT NULL DEFAULT 0;

-- 1 = the call carried a valid X-Agent-Key, so agent_id is the key's label, not a self-declared name.
ALTER TABLE telemetry ADD COLUMN agent_verified INTEGER NOT NULL DEFAULT 0;
