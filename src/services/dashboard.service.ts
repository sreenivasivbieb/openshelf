import type { TelemetryRepository, TelemetryRow } from "../repositories/telemetry.repository";
import type { OrderRepository } from "../repositories/order.repository";
import type { QuoteRepository } from "../repositories/quote.repository";
import type { QuoteReasonCode, OrderStatus } from "../domain/enums";
import { notImplemented } from "../shared/errors";

export interface QuoteSummary {
  pass: number;
  fail: number;
  failuresByReason: { reason: QuoteReasonCode; count: number }[]; // drop-off view
}

export interface OrderRow {
  orderId: string;
  quoteId: string;
  status: OrderStatus;
  total: number;
  currency: string;
  quoteHash: string;
  hashVerified: boolean; // recomputed from the stored quote (NFR-03)
  createdAt: string;
}

export interface DashboardService {
  feed(merchantId: string, afterId: number): TelemetryRow[];
  quoteSummary(merchantId: string): QuoteSummary;
  orders(merchantId: string): OrderRow[];
}

/** FR-15 data for the AG Grid views. Build step 8. */
export function createDashboardService(_deps: {
  telemetry: TelemetryRepository;
  orders: OrderRepository;
  quotes: QuoteRepository;
}): DashboardService {
  return {
    feed: () => notImplemented("step 8"),
    quoteSummary: () => notImplemented("step 8"),
    orders: () => notImplemented("step 8"),
  };
}
