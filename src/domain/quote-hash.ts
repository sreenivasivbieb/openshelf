import { createHash } from "node:crypto";
import type { Quote } from "./entities";

/** Version tag: if the locked fields ever change, the prefix changes, so old and new hashes never collide. */
export const QUOTE_HASH_PREFIX = "openshelf-quote-v1:";

/** What a quote locks. snake_case = the quotes-table columns, so anyone can recompute from a row. */
export interface LockedTerms {
  currency: string;
  expires_at: string;
  merchant_id: string;
  quantity: number;
  quote_id: string;
  return_days: number;
  shipping_days: number;
  sku: string;
  total_minor: number;
  unit_price_minor: number;
}

const KEYS = [
  "currency",
  "expires_at",
  "merchant_id",
  "quantity",
  "quote_id",
  "return_days",
  "shipping_days",
  "sku",
  "total_minor",
  "unit_price_minor",
] as const satisfies readonly (keyof LockedTerms)[];
const INTEGER_KEYS: ReadonlySet<string> = new Set([
  "quantity",
  "return_days",
  "shipping_days",
  "total_minor",
  "unit_price_minor",
]);

/**
 * RFC 8785 (JCS) canonical JSON of the locked terms: keys sorted, no whitespace, integers only.
 * With only strings and safe integers, JCS equals JSON.stringify over sorted keys.
 */
export function canonicalTerms(terms: LockedTerms): string {
  const ordered: Record<string, string | number> = {};
  for (const key of KEYS) {
    const value = terms[key];
    const valid = INTEGER_KEYS.has(key) ? Number.isSafeInteger(value) : typeof value === "string";
    if (!valid)
      throw new TypeError(
        `Locked term "${key}" must be ${INTEGER_KEYS.has(key) ? "an integer" : "a string"}`,
      );
    ordered[key] = value;
  }
  return JSON.stringify(ordered);
}

/** Quote lock (FR-09, NFR-03): sha256 hex over the version prefix + canonical terms. */
export function hashQuote(terms: LockedTerms): string {
  return createHash("sha256")
    .update(QUOTE_HASH_PREFIX + canonicalTerms(terms))
    .digest("hex");
}

export function lockedTermsOf(quote: Quote): LockedTerms {
  return {
    currency: quote.currency,
    expires_at: quote.expiresAt,
    merchant_id: quote.merchantId,
    quantity: quote.quantity,
    quote_id: quote.id,
    return_days: quote.returnDays,
    shipping_days: quote.shippingDays,
    sku: quote.sku,
    total_minor: quote.totalMinor,
    unit_price_minor: quote.unitPriceMinor,
  };
}

/** Recomputes the hash from the stored fields (NFR-03 audit; /order refuses on mismatch in step 5). */
export function verifyQuoteHash(quote: Quote): boolean {
  return hashQuote(lockedTermsOf(quote)) === quote.quoteHash;
}
