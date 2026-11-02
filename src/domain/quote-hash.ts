import { notImplemented } from "../shared/errors";

/** The terms a quote locks. Every field is stored on the quotes row, so the hash is recomputable. */
export interface LockedTerms {
  quoteId: string;
  merchantId: string;
  sku: string;
  quantity: number;
  unitPriceMinor: number;
  totalMinor: number;
  currency: string;
  shippingDays: number;
  returnDays: number;
  expiresAt: string;
}

/**
 * Quote lock (FR-09, NFR-03). Build step 4.
 * sha256 hex over canonical JSON (keys sorted, integers only, ISO times).
 * /order recomputes it from the stored row and refuses on mismatch (QUOTE_HASH_MISMATCH).
 */
export function hashQuote(_terms: LockedTerms): string {
  return notImplemented("step 4");
}
