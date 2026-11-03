import type {
  FulfilmentRequest,
  OrderRequest,
  OrderResponse,
  ReturnRequest,
  ReturnResponse,
} from "../schemas/order.schema";
import type { AgentContext, Order } from "../domain/entities";
import type { OrderStatus } from "../domain/enums";
import { toMajor } from "../domain/money";
import { verifyQuoteHash } from "../domain/quote-hash";
import type { MerchantRepository } from "../repositories/merchant.repository";
import type { ProductRepository } from "../repositories/product.repository";
import type { QuoteRepository } from "../repositories/quote.repository";
import type { OrderRepository } from "../repositories/order.repository";
import type { RunInTransaction } from "../repositories/db";
import type { PaymentProvider } from "../integrations/payments/payment-provider";
import type { Clock } from "../shared/clock";
import { AppError } from "../shared/errors";
import { newId } from "../shared/ids";
import { requireMerchant } from "./lookups";

export interface CaptureOutcome {
  orderId: string;
  captured: boolean;
  /** Why the capture did not happen: OUT_OF_STOCK, a PayPal issue code, or an error code. */
  reason?: string;
}

export interface OrderService {
  place(ctx: AgentContext, request: OrderRequest): Promise<OrderResponse>;
  /** Called from the PayPal return URL after the human approved. Safe to call again. */
  captureApproved(paypalOrderId: string): Promise<CaptureOutcome>;
  /** Simulated shipping for the demo: CAPTURED -> SHIPPED -> DELIVERED. */
  fulfil(merchantId: string, orderId: string, status: FulfilmentRequest["status"]): void;
  /** FR-17: return a paid order and refund its locked total. Safe to call again. */
  requestReturn(ctx: AgentContext, request: ReturnRequest): Promise<ReturnResponse>;
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

/** Statuses that mean the buyer has already paid; capturing again would be wrong. */
const PAID: ReadonlySet<OrderStatus> = new Set([
  "CAPTURED",
  "SHIPPED",
  "DELIVERED",
  "RETURN_REQUESTED",
  "REFUNDED",
]);

/** Simulated fulfilment: the only status each step may follow. */
const FULFILMENT_FROM: Record<FulfilmentRequest["status"], OrderStatus> = {
  SHIPPED: "CAPTURED",
  DELIVERED: "SHIPPED",
};

/** Paid and not yet in a return: these may start a return (FR-17). */
const RETURNABLE: ReadonlySet<OrderStatus> = new Set(["CAPTURED", "SHIPPED", "DELIVERED"]);

const DAY_MS = 24 * 60 * 60 * 1000;

const ORDER_NOT_FOUND = () => new AppError("ORDER_NOT_FOUND", "No such order in this store.", 404);

const text = (value: unknown) => (typeof value === "string" ? value : null);

/**
 * FR-11, NFR-05. Deterministic: no LLM import is allowed here (lint rule, ADR-0002).
 *
 * place: one order per quote (ADR-0007). A replay returns the existing order with its current
 * status and never calls PayPal again. The locked quote price is what PayPal charges, even if the
 * catalog price changed since the quote.
 *
 * captureApproved: stock is reserved with a conditional UPDATE before PayPal captures, and given
 * back if the capture fails. Concurrent calls for one order share a single attempt, and a paid
 * order is never captured twice. Orders are insert-only; every change is a new order event.
 */
export function createOrderService(deps: OrderDeps): OrderService {
  const baseUrl = deps.publicBaseUrl.replace(/\/+$/, "");
  const inflight = new Map<string, Promise<CaptureOutcome>>();

  const now = () => deps.clock.now().toISOString();

  const view = (order: Order): OrderResponse => ({
    order_id: order.id,
    quote_id: order.quoteId,
    status: deps.orders.latestStatus(order.id) ?? "CREATED",
    approve_url: order.approveUrl,
  });

  const appendEvent = (
    orderId: string,
    status: OrderStatus,
    detail: Record<string, unknown> | null,
  ) => deps.orders.appendEvent({ orderId, status, detail, createdAt: now() });

  const capture = async (order: Order): Promise<CaptureOutcome> => {
    const status = deps.orders.latestStatus(order.id);
    if (status && PAID.has(status)) return { orderId: order.id, captured: true };

    const quote = deps.quotes.findById(order.merchantId, order.quoteId);
    if (!quote) throw new Error(`order ${order.id} points to a missing quote`);

    const reserved = deps.tx(() =>
      deps.products.decrementStock(order.merchantId, quote.sku, quote.quantity),
    );
    if (!reserved) {
      appendEvent(order.id, "CAPTURE_FAILED", { reason: "OUT_OF_STOCK" });
      return { orderId: order.id, captured: false, reason: "OUT_OF_STOCK" };
    }

    const giveBack = (reason: string): CaptureOutcome => {
      deps.tx(() => {
        deps.products.restoreStock(order.merchantId, quote.sku, quote.quantity);
        appendEvent(order.id, "CAPTURE_FAILED", { reason });
      });
      return { orderId: order.id, captured: false, reason };
    };

    let result;
    try {
      result = await deps.payments.captureOrder({
        paypalOrderId: order.paypalOrderId,
        requestId: order.id,
      });
    } catch (err) {
      return giveBack(err instanceof AppError ? err.code : "PAYMENT_PROVIDER_ERROR");
    }
    if (result.status !== "COMPLETED") return giveBack(result.detail ?? "CAPTURE_NOT_COMPLETED");

    appendEvent(order.id, "CAPTURED", {
      capture_id: result.captureId,
      capture_status: result.detail,
    });
    return { orderId: order.id, captured: true };
  };

  const returns = new Map<string, Promise<ReturnResponse>>();

  const returnView = (order: Order, currency: string): ReturnResponse => {
    const events = deps.orders.events(order.id);
    const refunded = events.findLast((e) => e.status === "REFUNDED");
    const quote = deps.quotes.findById(order.merchantId, order.quoteId);
    return {
      order_id: order.id,
      status: events.at(-1)?.status ?? "CREATED",
      refund_id: refunded ? text(refunded.detail?.refund_id) : null,
      refunded: refunded && quote ? toMajor(quote.totalMinor) : null,
      currency,
      history: events.map((e) => ({ status: e.status, at: e.createdAt })),
    };
  };

  /**
   * FR-17. Returnable once paid (CAPTURED, SHIPPED, or DELIVERED within the quote's return_days of
   * delivery). RETURN_REQUESTED is recorded first, so a failed refund leaves a retryable return;
   * the PayPal request id makes the retried refund idempotent.
   */
  const processReturn = async (order: Order, request: ReturnRequest): Promise<ReturnResponse> => {
    const quote = deps.quotes.findById(order.merchantId, order.quoteId);
    if (!quote) throw new Error(`order ${order.id} points to a missing quote`);
    const events = deps.orders.events(order.id);
    const current = events.at(-1)?.status;

    if (current === "REFUNDED") return returnView(order, quote.currency);
    if (current !== "RETURN_REQUESTED") {
      if (!current || !RETURNABLE.has(current)) {
        throw new AppError(
          "NOT_RETURNABLE",
          `The order is ${current ?? "unknown"}; only paid orders can be returned.`,
          409,
        );
      }
      if (quote.returnDays === 0) {
        throw new AppError("NOT_RETURNABLE", "This product was sold without returns.", 409);
      }
      const delivered = events.findLast((e) => e.status === "DELIVERED");
      if (delivered) {
        const closesAt = Date.parse(delivered.createdAt) + quote.returnDays * DAY_MS;
        if (deps.clock.now().getTime() > closesAt) {
          throw new AppError(
            "RETURN_WINDOW_CLOSED",
            `The ${quote.returnDays}-day return window closed at ${new Date(closesAt).toISOString()}.`,
            409,
          );
        }
      }
      appendEvent(order.id, "RETURN_REQUESTED", request.reason ? { reason: request.reason } : null);
    }

    const captureId = text(events.findLast((e) => e.status === "CAPTURED")?.detail?.capture_id);
    if (!captureId) throw new Error(`order ${order.id} has no capture to refund`);

    let refund;
    try {
      refund = await deps.payments.refundCapture({
        captureId,
        amountMinor: quote.totalMinor,
        currency: quote.currency,
        requestId: `refund-${order.id}`,
      });
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw new AppError("PAYMENT_PROVIDER_ERROR", "PayPal could not refund; try again.", 502);
    }
    if (refund.status === "FAILED") {
      throw new AppError(
        "PAYMENT_PROVIDER_ERROR",
        `PayPal refused the refund (${refund.detail ?? "unknown reason"}); try again.`,
        502,
      );
    }

    deps.tx(() => {
      appendEvent(order.id, "REFUNDED", {
        refund_id: refund.refundId,
        refund_status: refund.detail,
      });
      deps.products.restoreStock(order.merchantId, quote.sku, quote.quantity);
    });
    return returnView(order, quote.currency);
  };

  return {
    async place(ctx, request) {
      const merchant = requireMerchant(deps.merchants, ctx.merchantId);

      const existing = deps.orders.findByQuoteId(request.quote_id);
      if (existing && existing.merchantId === merchant.id) return view(existing);

      const quote = deps.quotes.findById(merchant.id, request.quote_id);
      if (!quote) {
        throw new AppError(
          "QUOTE_NOT_FOUND",
          "No such quote in this store; request a new quote.",
          404,
        );
      }
      if (deps.clock.now().getTime() >= Date.parse(quote.expiresAt)) {
        throw new AppError(
          "QUOTE_EXPIRED",
          `Quote ${quote.id} expired at ${quote.expiresAt}; request a new quote.`,
          409,
        );
      }
      if (!verifyQuoteHash(quote)) {
        throw new AppError(
          "QUOTE_HASH_MISMATCH",
          "The stored quote no longer matches its hash, so it cannot be ordered.",
          409,
        );
      }

      const product = deps.products.findBySku(merchant.id, quote.sku);
      if (product && product.firewallStatus !== "clean") {
        throw new AppError("PRODUCT_FLAGGED", "This product is not available to agents.", 409);
      }
      if (!product || product.stock < quote.quantity) {
        throw new AppError(
          "OUT_OF_STOCK",
          `${quote.sku} no longer has ${quote.quantity} in stock; search again.`,
          409,
        );
      }

      const payment = await deps.payments.createOrder({
        requestId: quote.id,
        quoteId: quote.id,
        amountMinor: quote.totalMinor,
        currency: quote.currency,
        description: `${quote.quantity} x ${product.name}`,
        payeeEmail: merchant.paypalPayeeEmail,
        brandName: merchant.name,
        returnUrl: `${baseUrl}/paypal/return`,
        cancelUrl: `${baseUrl}/paypal/cancel`,
      });

      const order: Order = {
        id: newId("o"),
        merchantId: merchant.id,
        quoteId: quote.id,
        quoteHash: quote.quoteHash,
        paypalOrderId: payment.paypalOrderId,
        approveUrl: payment.approveUrl,
        createdAt: now(),
      };
      try {
        deps.tx(() => {
          deps.orders.insert(order);
          appendEvent(order.id, "CREATED", { paypal_order_id: payment.paypalOrderId });
        });
      } catch (err) {
        // A concurrent /order for the same quote won the UNIQUE(quote_id) race; PayPal deduplicated
        // the create by request id, so both callers get the same order.
        const winner = deps.orders.findByQuoteId(quote.id);
        if (winner) return view(winner);
        throw err;
      }
      return view(order);
    },

    captureApproved(paypalOrderId) {
      const order = deps.orders.findByPaypalOrderId(paypalOrderId);
      if (!order) return Promise.reject(ORDER_NOT_FOUND());

      const running = inflight.get(order.id);
      if (running) return running;
      const attempt = capture(order).finally(() => inflight.delete(order.id));
      inflight.set(order.id, attempt);
      return attempt;
    },

    fulfil(merchantId, orderId, next) {
      requireMerchant(deps.merchants, merchantId);
      const order = deps.orders.findById(merchantId, orderId);
      if (!order) throw ORDER_NOT_FOUND();
      const current = deps.orders.latestStatus(order.id);
      const required = FULFILMENT_FROM[next];
      if (current !== required) {
        throw new AppError(
          "INVALID_TRANSITION",
          `The order is ${current ?? "unknown"}; ${next} only follows ${required}.`,
          409,
        );
      }
      appendEvent(order.id, next, null);
    },

    requestReturn(ctx, request) {
      let order: Order | null;
      try {
        requireMerchant(deps.merchants, ctx.merchantId);
        order = deps.orders.findById(ctx.merchantId, request.order_id);
      } catch (err) {
        return Promise.reject(err);
      }
      if (!order) return Promise.reject(ORDER_NOT_FOUND());

      const running = returns.get(order.id);
      if (running) return running;
      const attempt = processReturn(order, request).finally(() => returns.delete(order.id));
      returns.set(order.id, attempt);
      return attempt;
    },
  };
}
