import type { QuoteRequest } from "../schemas/quote.schema";
import type { Product } from "./entities";
import type { QuoteReasonCode } from "./enums";
import { notImplemented } from "../shared/errors";

export type GuardrailResult = { pass: true } | { pass: false; reasons: QuoteReasonCode[] };

/**
 * Guardrail engine (FR-08, NFR-02). Build step 4.
 * PURE: no DB, clock, network or LLM. Same input => same output.
 * Checks every rule the buyer sent and returns ALL failing reasons, in QuoteReasonCode order.
 */
export function evaluateGuardrails(_product: Product, _request: QuoteRequest): GuardrailResult {
  return notImplemented("step 4");
}
