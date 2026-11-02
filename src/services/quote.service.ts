import type { QuoteRequest, QuoteResponse } from "../schemas/quote.schema";
import type { AgentContext } from "../domain/entities";
import type { MerchantRepository } from "../repositories/merchant.repository";
import type { ProductRepository } from "../repositories/product.repository";
import type { QuoteRepository } from "../repositories/quote.repository";
import type { Clock } from "../shared/clock";
import { notImplemented } from "../shared/errors";

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

/**
 * FR-08, FR-09, FR-10. Build step 4. Deterministic: no LLM import allowed here (lint rule, ADR-0002).
 * product -> evaluateGuardrails ->
 *   pass: quote with expiresAt = now + ttl, hashQuote(locked terms), insert, return QuotePass
 *   fail: reason codes + nearest passing SKU (listQuotable, same rules, ranked by price then sku)
 */
export function createQuoteService(_deps: QuoteDeps): QuoteService {
  return {
    create: () => notImplemented("step 4"),
  };
}
