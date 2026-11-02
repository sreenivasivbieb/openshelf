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

export const QuotePass = z.object({
  status: z.literal("pass"),
  quote_id: z.string(),
  sku: z.string(),
  quantity: z.number().int(),
  price: z.number(), // total, major units
  currency: z.string(),
  shipping_days: z.number().int(),
  return_days: z.number().int(),
  expires_at: z.string(),
  quote_hash: z.string(),
});

export const QuoteFail = z.object({
  status: z.literal("fail"),
  reason_codes: z.array(QuoteReasonCode).min(1),
  retry_hint: z.string().optional(),
  nearest_passing_sku: z.string().optional(),
});

export const QuoteResponse = z.discriminatedUnion("status", [QuotePass, QuoteFail]);
export type QuoteResponse = z.infer<typeof QuoteResponse>;
