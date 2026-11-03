import type { Db } from "./db";
import type { Merchant } from "../domain/entities";
import type { SpecStatus } from "../domain/enums";

export interface MerchantRepository {
  insert(merchant: Merchant): void;
  findById(id: string): Merchant | null;
  /** Stores the OpenAPI document built at catalog commit and how it was built (ready | fallback). */
  saveSpec(id: string, specJson: string, status: SpecStatus): void;
}

interface MerchantRecord {
  id: string;
  name: string;
  currency: string;
  paypal_payee_email: string | null;
  spec_json: string | null;
  spec_status: SpecStatus;
  created_at: string;
}

function toMerchant(r: MerchantRecord): Merchant {
  return {
    id: r.id,
    name: r.name,
    currency: r.currency,
    paypalPayeeEmail: r.paypal_payee_email,
    specJson: r.spec_json,
    specStatus: r.spec_status,
    createdAt: r.created_at,
  };
}

/** Table: merchants. */
export function createMerchantRepository(db: Db): MerchantRepository {
  const insert = db.prepare(
    `INSERT INTO merchants (id, name, currency, paypal_payee_email, spec_json, spec_status, created_at)
     VALUES (@id, @name, @currency, @paypalPayeeEmail, @specJson, @specStatus, @createdAt)`,
  );
  const byId = db.prepare(`SELECT * FROM merchants WHERE id = ?`);
  const updateSpec = db.prepare(`UPDATE merchants SET spec_json = ?, spec_status = ? WHERE id = ?`);

  return {
    insert: (merchant) => {
      insert.run(merchant);
    },
    findById: (id) => {
      const record = byId.get(id) as MerchantRecord | undefined;
      return record ? toMerchant(record) : null;
    },
    saveSpec: (id, specJson, status) => {
      updateSpec.run(specJson, status, id);
    },
  };
}
