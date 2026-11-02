import type { Db } from "./db";
import type { Order, OrderEvent } from "../domain/entities";
import { notImplemented } from "../shared/errors";

/** Insert-only (NFR-03). Current status = latest event. */
export interface OrderRepository {
  insert(order: Order): void;
  appendEvent(event: OrderEvent): void;
  findById(merchantId: string, id: string): Order | null;
  findByQuoteId(quoteId: string): Order | null;
  findByPaypalOrderId(paypalOrderId: string): Order | null;
  events(orderId: string): OrderEvent[];
  listByMerchant(merchantId: string, limit: number): Order[];
}

/** Tables: orders, order_events. Build step 5. */
export function createOrderRepository(_db: Db): OrderRepository {
  return {
    insert: () => notImplemented("step 5"),
    appendEvent: () => notImplemented("step 5"),
    findById: () => notImplemented("step 5"),
    findByQuoteId: () => notImplemented("step 5"),
    findByPaypalOrderId: () => notImplemented("step 5"),
    events: () => notImplemented("step 5"),
    listByMerchant: () => notImplemented("step 8"),
  };
}
