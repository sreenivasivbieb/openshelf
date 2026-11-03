import type { QuoteRequest } from "../schemas/quote.schema";
import type { Product } from "./entities";
import type { QuoteReasonCode } from "./enums";
import { toMinor } from "./money";

export type GuardrailResult = { pass: true } | { pass: false; reasons: QuoteReasonCode[] };

/**
 * Guardrail engine (FR-08, NFR-02). PURE: no DB, clock, network or LLM; same input, same output.
 *
 * - A product that is not firewall-clean fails with PRODUCT_FLAGGED alone: nothing else is negotiable.
 * - Otherwise every rule the buyer sent is checked and ALL failures are returned, in QuoteReasonCode
 *   order, so an agent sees everything it would have to relax.
 * - Boundaries pass: total == max_budget, shipping == max_shipping_days, rating == min_rating.
 * - Ratings and review counts are merchant-reported; a missing rating fails min_rating as RATING_UNKNOWN,
 *   a missing review count counts as 0.
 */
export function evaluateGuardrails(product: Product, request: QuoteRequest): GuardrailResult {
  if (product.firewallStatus !== "clean") return { pass: false, reasons: ["PRODUCT_FLAGGED"] };

  const reasons: QuoteReasonCode[] = [];
  if (product.stock < request.quantity) reasons.push("OUT_OF_STOCK");
  if (
    request.max_budget !== undefined &&
    product.priceMinor * request.quantity > toMinor(request.max_budget)
  ) {
    reasons.push("OVER_BUDGET");
  }
  if (request.max_shipping_days !== undefined && product.shippingDays > request.max_shipping_days) {
    reasons.push("SHIPPING_TOO_SLOW");
  }
  if (request.min_return_days !== undefined && product.returnDays < request.min_return_days) {
    reasons.push("RETURN_WINDOW_TOO_SHORT");
  }
  if (request.min_rating !== undefined) {
    if (product.ratingAvg === null) reasons.push("RATING_UNKNOWN");
    else if (product.ratingAvg < request.min_rating) reasons.push("RATING_TOO_LOW");
  }
  if (
    request.min_review_count !== undefined &&
    (product.reviewCount ?? 0) < request.min_review_count
  ) {
    reasons.push("TOO_FEW_REVIEWS");
  }
  return reasons.length ? { pass: false, reasons } : { pass: true };
}
