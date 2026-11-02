import type { OrderRequest, OrderResponse } from "../schemas/order.schema";
import type { AgentContext } from "../domain/entities";
import type { MerchantRepository } from "../repositories/merchant.repository";
import type { ProductRepository } from "../repositories/product.repository";
import type { QuoteRepository } from "../repositories/quote.repository";
import type { OrderRepository } from "../repositories/order.repository";
import type { RunInTransaction } from "../repositories/db";
import type { PaymentProvider } from "../integrations/payments/payment-provider";
import type { Clock } from "../shared/clock";
import { notImplemented } from "../shared/errors";

export interface OrderService {
  place(ctx: AgentContext, request: OrderRequest): Promise<OrderResponse>;
  /** Called from the PayPal return URL after the human approved. */
  captureApproved(paypalOrderId: string): Promise<{ orderId: string; captured: boolean }>;
}

export interface OrderDeps {
  merchants: MerchantRepository;
  products: ProductRepository;
  quotes: QuoteRepository;
  orders: OrderRepository;
  payments: PaymentProvider;
  tx: RunInTransaction;
  clock: Clock;
  publicBaseUrl: string;
}

/**
 * FR-11, NFR-05. Build step 5.
 * place:   existing order for quote? return it (idempotent) -> quote found, not expired, recomputed hash
 *          matches -> stock > 0 -> payments.createOrder -> insert order + CREATED event (one transaction)
 * capture: tx { decrementStock or CAPTURE_FAILED } -> payments.captureOrder -> CAPTURED event
 */
export function createOrderService(_deps: OrderDeps): OrderService {
  return {
    place: async () => notImplemented("step 5"),
    captureApproved: async () => notImplemented("step 5"),
  };
}
