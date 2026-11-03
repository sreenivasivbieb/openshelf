import type { Db } from "./db";
import type { Quote } from "../domain/entities";

/** Insert-only (NFR-03): there is deliberately no update or delete; triggers enforce it too. */
export interface QuoteRepository {
  insert(quote: Quote): void;
  findById(merchantId: string, id: string): Quote | null;
}

interface QuoteRecord {
  id: string;
  merchant_id: string;
  sku: string;
  quantity: number;
  unit_price_minor: number;
  total_minor: number;
  currency: string;
  shipping_days: number;
  return_days: number;
  guardrails_json: string;
  agent_id: string | null;
  created_at: string;
  expires_at: string;
  quote_hash: string;
}

function toQuote(r: QuoteRecord): Quote {
  return {
    id: r.id,
    merchantId: r.merchant_id,
    sku: r.sku,
    quantity: r.quantity,
    unitPriceMinor: r.unit_price_minor,
    totalMinor: r.total_minor,
    currency: r.currency,
    shippingDays: r.shipping_days,
    returnDays: r.return_days,
    guardrails: JSON.parse(r.guardrails_json) as Record<string, unknown>,
    agentId: r.agent_id,
    createdAt: r.created_at,
    expiresAt: r.expires_at,
    quoteHash: r.quote_hash,
  };
}

/** Table: quotes. */
export function createQuoteRepository(db: Db): QuoteRepository {
  const insert = db.prepare(
    `INSERT INTO quotes (id, merchant_id, sku, quantity, unit_price_minor, total_minor, currency,
       shipping_days, return_days, guardrails_json, agent_id, created_at, expires_at, quote_hash)
     VALUES (@id, @merchantId, @sku, @quantity, @unitPriceMinor, @totalMinor, @currency,
       @shippingDays, @returnDays, @guardrailsJson, @agentId, @createdAt, @expiresAt, @quoteHash)`,
  );
  const byId = db.prepare(`SELECT * FROM quotes WHERE merchant_id = ? AND id = ?`);

  return {
    insert: (q) => {
      insert.run({
        id: q.id,
        merchantId: q.merchantId,
        sku: q.sku,
        quantity: q.quantity,
        unitPriceMinor: q.unitPriceMinor,
        totalMinor: q.totalMinor,
        currency: q.currency,
        shippingDays: q.shippingDays,
        returnDays: q.returnDays,
        guardrailsJson: JSON.stringify(q.guardrails),
        agentId: q.agentId,
        createdAt: q.createdAt,
        expiresAt: q.expiresAt,
        quoteHash: q.quoteHash,
      });
    },
    findById: (merchantId, id) => {
      const record = byId.get(merchantId, id) as QuoteRecord | undefined;
      return record ? toQuote(record) : null;
    },
  };
}
