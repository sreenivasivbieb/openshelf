import type { Db } from "./db";
import type { Order, OrderEvent } from "../domain/entities";
import type { OrderStatus } from "../domain/enums";

/** Insert-only (NFR-03): orders never change; status is the latest order_events row. */
export interface OrderRepository {
  insert(order: Order): void;
  appendEvent(event: OrderEvent): void;
  findById(merchantId: string, id: string): Order | null;
  findByQuoteId(quoteId: string): Order | null;
  findByPaypalOrderId(paypalOrderId: string): Order | null;
  /** Oldest first. */
  events(orderId: string): OrderEvent[];
  latestStatus(orderId: string): OrderStatus | null;
  /** Newest first. */
  listByMerchant(merchantId: string, limit: number): Order[];
}

interface OrderRecord {
  id: string;
  merchant_id: string;
  quote_id: string;
  quote_hash: string;
  paypal_order_id: string;
  approve_url: string;
  created_at: string;
}

interface EventRecord {
  id: number;
  order_id: string;
  status: OrderStatus;
  detail_json: string | null;
  created_at: string;
}

function toOrder(r: OrderRecord): Order {
  return {
    id: r.id,
    merchantId: r.merchant_id,
    quoteId: r.quote_id,
    quoteHash: r.quote_hash,
    paypalOrderId: r.paypal_order_id,
    approveUrl: r.approve_url,
    createdAt: r.created_at,
  };
}

function toEvent(r: EventRecord): OrderEvent {
  return {
    orderId: r.order_id,
    status: r.status,
    detail: r.detail_json ? (JSON.parse(r.detail_json) as Record<string, unknown>) : null,
    createdAt: r.created_at,
  };
}

/** Tables: orders, order_events. Event order is the AUTOINCREMENT id, not the timestamp. */
export function createOrderRepository(db: Db): OrderRepository {
  const insert = db.prepare(
    `INSERT INTO orders (id, merchant_id, quote_id, quote_hash, paypal_order_id, approve_url, created_at)
     VALUES (@id, @merchantId, @quoteId, @quoteHash, @paypalOrderId, @approveUrl, @createdAt)`,
  );
  const insertEvent = db.prepare(
    `INSERT INTO order_events (order_id, status, detail_json, created_at)
     VALUES (@orderId, @status, @detailJson, @createdAt)`,
  );
  const byId = db.prepare(`SELECT * FROM orders WHERE merchant_id = ? AND id = ?`);
  const byQuote = db.prepare(`SELECT * FROM orders WHERE quote_id = ?`);
  const byPaypal = db.prepare(`SELECT * FROM orders WHERE paypal_order_id = ?`);
  const eventsOf = db.prepare(`SELECT * FROM order_events WHERE order_id = ? ORDER BY id`);
  const latest = db
    .prepare(`SELECT status FROM order_events WHERE order_id = ? ORDER BY id DESC LIMIT 1`)
    .pluck();
  const byMerchant = db.prepare(
    `SELECT * FROM orders WHERE merchant_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ?`,
  );

  const one = (record: unknown) => (record ? toOrder(record as OrderRecord) : null);

  return {
    insert: (order) => {
      insert.run({
        id: order.id,
        merchantId: order.merchantId,
        quoteId: order.quoteId,
        quoteHash: order.quoteHash,
        paypalOrderId: order.paypalOrderId,
        approveUrl: order.approveUrl,
        createdAt: order.createdAt,
      });
    },
    appendEvent: (event) => {
      insertEvent.run({
        orderId: event.orderId,
        status: event.status,
        detailJson: event.detail ? JSON.stringify(event.detail) : null,
        createdAt: event.createdAt,
      });
    },
    findById: (merchantId, id) => one(byId.get(merchantId, id)),
    findByQuoteId: (quoteId) => one(byQuote.get(quoteId)),
    findByPaypalOrderId: (paypalOrderId) => one(byPaypal.get(paypalOrderId)),
    events: (orderId) => (eventsOf.all(orderId) as EventRecord[]).map(toEvent),
    latestStatus: (orderId) => (latest.get(orderId) as OrderStatus | undefined) ?? null,
    listByMerchant: (merchantId, limit) =>
      (byMerchant.all(merchantId, limit) as OrderRecord[]).map(toOrder),
  };
}
