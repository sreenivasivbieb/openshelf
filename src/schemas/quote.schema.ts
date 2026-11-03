import { z } from "zod";
import { QuoteReasonCode } from "../domain/enums";

/** Buyer guardrails (FR-08). Every rule is optional; only the ones sent are checked. */
export const QuoteRequest = z.object({
  sku: z.string().trim().min(1).max(64),
  quantity: z.number().int().min(1).max(10).default(1),
  max_budget: z.number().positive().optional(), // total, merchant currency, major units
  max_shipping_days: z.number().int().min(0).optional(),
  min_return_days: z.number().int().min(0).optional(),
  min_rating: z.number().min(0).max(5).optional(),
  min_review_count: z.number().int().min(0).optional(),
});
export type QuoteRequest = z.infer<typeof QuoteRequest>;

/**
 * Exactly what a quote hash covers (FR-09). Keys are the quotes-table columns, in sorted order:
 * quote_hash = sha256_hex("openshelf-quote-v1:" + RFC 8785 canonical JSON of this object).
 * An agent can recompute it from this object alone; see docs/api/rest.md.
 */
export const QuoteLockedTerms = z.object({
  currency: z.string(),
  expires_at: z.string(),
  merchant_id: z.string(),
  quantity: z.number().int(),
  quote_id: z.string(),
  return_days: z.number().int(),
  shipping_days: z.number().int(),
  sku: z.string(),
  total_minor: z.number().int(),
  unit_price_minor: z.number().int(),
});

export const QuotePass = z.object({
  status: z.literal("pass"),
  quote_id: z.string(),
  sku: z.string(),
  quantity: z.number().int(),
  unit_price: z.number(), // major units
  price: z.number(), // total for the quantity, major units
  currency: z.string(),
  shipping_days: z.number().int(),
  return_days: z.number().int(),
  expires_at: z.string(), // ISO 8601; order before this
  quote_hash: z.string(),
  locked_terms: QuoteLockedTerms,
});

/** The product's real terms, so an agent can see how far off its rules are. */
export const QuoteActualTerms = z.object({
  price: z.number(), // total for the requested quantity
  currency: z.string(),
  stock: z.number().int(),
  shipping_days: z.number().int(),
  return_days: z.number().int(),
  rating_avg: z.number().nullable(),
  review_count: z.number().int().nullable(),
});

export const QuoteFail = z.object({
  status: z.literal("fail"),
  reason_codes: z.array(QuoteReasonCode).min(1),
  retry_hint: z.string().optional(),
  nearest_passing_sku: z.string().optional(), // another product that passes every rule sent
  actual: QuoteActualTerms.optional(), // absent for SKU_NOT_FOUND and PRODUCT_FLAGGED
});

export const QuoteResponse = z.discriminatedUnion("status", [QuotePass, QuoteFail]);
export type QuoteResponse = z.infer<typeof QuoteResponse>;
