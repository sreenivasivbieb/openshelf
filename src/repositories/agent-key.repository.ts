import type { Db } from "./db";
import type { AgentKey } from "../domain/entities";

/** Tables: agent_keys and merchants.require_agent_key (migration 003, ADR-0012). */
export interface AgentKeyRepository {
  insert(key: AgentKey): void;
  findByHash(keyHash: string): AgentKey | null;
  /** Newest first, revoked keys included. */
  listByMerchant(merchantId: string): AgentKey[];
  /** Sets revoked_at once; returns the key as stored afterwards, or null if it does not exist. */
  revoke(merchantId: string, id: string, at: string): AgentKey | null;
  /** null when the merchant does not exist. */
  isRequired(merchantId: string): boolean | null;
  setRequired(merchantId: string, required: boolean): void;
}

interface AgentKeyRecord {
  id: string;
  merchant_id: string;
  label: string;
  key_hash: string;
  created_at: string;
  revoked_at: string | null;
}

function toAgentKey(r: AgentKeyRecord): AgentKey {
  return {
    id: r.id,
    merchantId: r.merchant_id,
    label: r.label,
    keyHash: r.key_hash,
    createdAt: r.created_at,
    revokedAt: r.revoked_at,
  };
}

export function createAgentKeyRepository(db: Db): AgentKeyRepository {
  const insert = db.prepare(
    `INSERT INTO agent_keys (id, merchant_id, label, key_hash, created_at, revoked_at)
     VALUES (@id, @merchantId, @label, @keyHash, @createdAt, @revokedAt)`,
  );
  const byHash = db.prepare(`SELECT * FROM agent_keys WHERE key_hash = ?`);
  const byId = db.prepare(`SELECT * FROM agent_keys WHERE merchant_id = ? AND id = ?`);
  const byMerchant = db.prepare(
    `SELECT * FROM agent_keys WHERE merchant_id = ? ORDER BY created_at DESC, rowid DESC`,
  );
  const revoke = db.prepare(
    `UPDATE agent_keys SET revoked_at = @at
     WHERE merchant_id = @merchantId AND id = @id AND revoked_at IS NULL`,
  );
  const required = db.prepare(`SELECT require_agent_key FROM merchants WHERE id = ?`).pluck();
  const setRequired = db.prepare(`UPDATE merchants SET require_agent_key = ? WHERE id = ?`);

  const one = (record: unknown) => (record ? toAgentKey(record as AgentKeyRecord) : null);

  return {
    insert: (key) => {
      insert.run(key);
    },
    findByHash: (keyHash) => one(byHash.get(keyHash)),
    listByMerchant: (merchantId) =>
      (byMerchant.all(merchantId) as AgentKeyRecord[]).map(toAgentKey),
    revoke: (merchantId, id, at) => {
      revoke.run({ merchantId, id, at });
      return one(byId.get(merchantId, id));
    },
    isRequired: (merchantId) => {
      const value = required.get(merchantId) as number | undefined;
      return value === undefined ? null : value === 1;
    },
    setRequired: (merchantId, value) => {
      setRequired.run(value ? 1 : 0, merchantId);
    },
  };
}
