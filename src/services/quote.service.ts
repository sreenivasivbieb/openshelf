import type { QuoteRequest, QuoteResponse } from "../schemas/quote.schema";
import type { AgentContext, Merchant, Product } from "../domain/entities";
import type { QuoteReasonCode } from "../domain/enums";
import { evaluateGuardrails } from "../domain/guardrails";
import { hashQuote, type LockedTerms } from "../domain/quote-hash";
import { toMajor, toMinor } from "../domain/money";
import type { MerchantRepository } from "../repositories/merchant.repository";
import type { ProductRepository } from "../repositories/product.repository";
import type { QuoteRepository } from "../repositories/quote.repository";
import type { Clock } from "../shared/clock";
import { newId } from "../shared/ids";
import { requireMerchant } from "./lookups";

export interface QuoteService {
  create(ctx: AgentContext, request: QuoteRequest): QuoteResponse;
}

export interface QuoteDeps {
  merchants: MerchantRepository;
  products: ProductRepository;
  quotes: QuoteRepository;
  clock: Clock;
  ttlMinutes: number;
}

type QuoteFailResponse = Extract<QuoteResponse, { status: "fail" }>;

const NOT_FOUND_HINT = "No product with that SKU in this store; use search to find SKUs.";
const FLAGGED_HINT = "This product is not available to agents.";

const money = (minor: number) => {
  const major = toMajor(minor);
  return Number.isInteger(major) ? String(major) : major.toFixed(2);
};

/** One plain sentence per failed rule, from the product's real terms. Deterministic. */
function explain(
  reason: QuoteReasonCode,
  p: Product,
  request: QuoteRequest,
  currency: string,
): string {
  switch (reason) {
    case "OUT_OF_STOCK":
      return p.stock === 0
        ? "Out of stock."
        : `Only ${p.stock} in stock (you asked for ${request.quantity}).`;
    case "OVER_BUDGET":
      return `Total is ${money(p.priceMinor * request.quantity)} ${currency} (your budget is ${request.max_budget} ${currency}).`;
    case "SHIPPING_TOO_SLOW":
      return `Ships in ${p.shippingDays} days (you asked for at most ${request.max_shipping_days}).`;
    case "RETURN_WINDOW_TOO_SHORT":
      return p.returnDays === 0
        ? "No returns accepted."
        : `Returns accepted for ${p.returnDays} days (you asked for at least ${request.min_return_days}).`;
    case "RATING_TOO_LOW":
      return `Rated ${p.ratingAvg} by the merchant (you asked for at least ${request.min_rating}).`;
    case "RATING_UNKNOWN":
      return "The merchant has not reported a rating.";
    case "TOO_FEW_REVIEWS":
      return `${p.reviewCount ?? 0} reviews reported (you asked for at least ${request.min_review_count}).`;
    case "PRODUCT_FLAGGED":
      return FLAGGED_HINT;
    case "SKU_NOT_FOUND":
      return NOT_FOUND_HINT;
  }
}

/**
 * FR-08, FR-09, FR-10. Deterministic: no LLM import is allowed here (lint rule, ADR-0002).
 * pass: lock the terms (expiry = now + ttl, sha256 over canonical terms), store the quote insert-only.
 * fail: every reason + the product's real terms + a plain-language hint + the nearest passing SKU.
 */
export function createQuoteService(deps: QuoteDeps): QuoteService {
  /**
   * Another product that passes every rule the buyer sent: FTS-ranked by similarity to the asked-for
   * product (name + category), SQL-filtered by the rules it can express, then re-checked by the engine.
   */
  const nearestPassing = (product: Product, request: QuoteRequest): Product | null => {
    const candidates = deps.products.search(product.merchantId, {
      query: `${product.name} ${product.category ?? ""}`,
      maxPriceMinor:
        request.max_budget === undefined
          ? undefined
          : Math.floor(toMinor(request.max_budget) / request.quantity),
      maxShippingDays: request.max_shipping_days,
      minRating: request.min_rating,
      inStockOnly: true,
      limit: 25,
    });
    return (
      candidates.find(
        (c) => c.sku !== product.sku && evaluateGuardrails(c, { ...request, sku: c.sku }).pass,
      ) ?? null
    );
  };

  const fail = (
    merchant: Merchant,
    product: Product,
    request: QuoteRequest,
    reasons: QuoteReasonCode[],
  ): QuoteFailResponse => {
    if (reasons.includes("PRODUCT_FLAGGED")) {
      return { status: "fail", reason_codes: ["PRODUCT_FLAGGED"], retry_hint: FLAGGED_HINT };
    }
    const nearest = nearestPassing(product, request);
    const hints = reasons.map((reason) => explain(reason, product, request, merchant.currency));
    if (nearest) {
      hints.push(
        `${nearest.sku} (${nearest.name}) meets all your rules: ${money(nearest.priceMinor * request.quantity)} ` +
          `${merchant.currency} total, ships in ${nearest.shippingDays} days, ` +
          `${nearest.returnDays === 0 ? "no returns" : `${nearest.returnDays}-day returns`}.`,
      );
    }
    return {
      status: "fail",
      reason_codes: reasons,
      retry_hint: hints.join(" "),
      ...(nearest ? { nearest_passing_sku: nearest.sku } : {}),
      actual: {
        price: toMajor(product.priceMinor * request.quantity),
        currency: merchant.currency,
        stock: product.stock,
        shipping_days: product.shippingDays,
        return_days: product.returnDays,
        rating_avg: product.ratingAvg,
        review_count: product.reviewCount,
      },
    };
  };

  return {
    create(ctx, request) {
      const merchant = requireMerchant(deps.merchants, ctx.merchantId);
      const product = deps.products.findBySku(merchant.id, request.sku);
      if (!product) {
        return { status: "fail", reason_codes: ["SKU_NOT_FOUND"], retry_hint: NOT_FOUND_HINT };
      }

      const verdict = evaluateGuardrails(product, request);
      if (!verdict.pass) return fail(merchant, product, request, verdict.reasons);

      const now = deps.clock.now();
      const terms: LockedTerms = {
        currency: merchant.currency,
        expires_at: new Date(now.getTime() + deps.ttlMinutes * 60_000).toISOString(),
        merchant_id: merchant.id,
        quantity: request.quantity,
        quote_id: newId("q"),
        return_days: product.returnDays,
        shipping_days: product.shippingDays,
        sku: product.sku,
        total_minor: product.priceMinor * request.quantity,
        unit_price_minor: product.priceMinor,
      };
      const quoteHash = hashQuote(terms);
      deps.quotes.insert({
        id: terms.quote_id,
        merchantId: merchant.id,
        sku: product.sku,
        quantity: terms.quantity,
        unitPriceMinor: terms.unit_price_minor,
        totalMinor: terms.total_minor,
        currency: terms.currency,
        shippingDays: terms.shipping_days,
        returnDays: terms.return_days,
        guardrails: { ...request },
        agentId: ctx.agentId,
        createdAt: now.toISOString(),
        expiresAt: terms.expires_at,
        quoteHash,
      });

      return {
        status: "pass",
        quote_id: terms.quote_id,
        sku: product.sku,
        quantity: terms.quantity,
        unit_price: toMajor(terms.unit_price_minor),
        price: toMajor(terms.total_minor),
        currency: terms.currency,
        shipping_days: terms.shipping_days,
        return_days: terms.return_days,
        expires_at: terms.expires_at,
        quote_hash: quoteHash,
        locked_terms: terms,
      };
    },
  };
}
