import { describe, expect, it } from "vitest";
import {
  canonicalTerms,
  hashQuote,
  verifyQuoteHash,
  type LockedTerms,
} from "../../../src/domain/quote-hash";
import type { Quote } from "../../../src/domain/entities";

/** Golden vector, also published in docs/api/rest.md so agents can test their own implementation. */
const TERMS: LockedTerms = {
  currency: "USD",
  expires_at: "2026-11-09T10:15:00.000Z",
  merchant_id: "m_demo",
  quantity: 1,
  quote_id: "q_example",
  return_days: 30,
  shipping_days: 3,
  sku: "MUG-014",
  total_minor: 3600,
  unit_price_minor: 3600,
};
const CANONICAL =
  '{"currency":"USD","expires_at":"2026-11-09T10:15:00.000Z","merchant_id":"m_demo","quantity":1,"quote_id":"q_example",' +
  '"return_days":30,"shipping_days":3,"sku":"MUG-014","total_minor":3600,"unit_price_minor":3600}';
const HASH = "98930253061b434605c070da2189f775ca19248cbc42df481ecb4a9cb971aee8";

describe("quote hash (FR-09, NFR-03)", () => {
  it("serializes the locked terms canonically (RFC 8785)", () => {
    expect(canonicalTerms(TERMS)).toBe(CANONICAL);
  });

  it("matches the published golden vector", () => {
    expect(hashQuote(TERMS)).toBe(HASH);
  });

  it("does not depend on property order", () => {
    const reversed = Object.fromEntries(Object.entries(TERMS).reverse()) as unknown as LockedTerms;
    expect(hashQuote(reversed)).toBe(HASH);
  });

  it.each(Object.keys(TERMS))("changes when %s changes", (key) => {
    const value = TERMS[key as keyof LockedTerms];
    const changed = { ...TERMS, [key]: typeof value === "number" ? value + 1 : `${value}x` };
    expect(hashQuote(changed)).not.toBe(HASH);
  });

  it("refuses non-integer money and missing fields", () => {
    expect(() => hashQuote({ ...TERMS, total_minor: 36.5 })).toThrow(TypeError);
    expect(() => hashQuote({ ...TERMS, sku: undefined as unknown as string })).toThrow(TypeError);
  });

  it("verifies a stored quote and catches tampering", () => {
    const quote: Quote = {
      id: "q_example",
      merchantId: "m_demo",
      sku: "MUG-014",
      quantity: 1,
      unitPriceMinor: 3600,
      totalMinor: 3600,
      currency: "USD",
      shippingDays: 3,
      returnDays: 30,
      guardrails: {},
      agentId: null,
      createdAt: "2026-11-09T10:00:00.000Z",
      expiresAt: "2026-11-09T10:15:00.000Z",
      quoteHash: HASH,
    };
    expect(verifyQuoteHash(quote)).toBe(true);
    expect(verifyQuoteHash({ ...quote, totalMinor: 100 })).toBe(false);
    expect(verifyQuoteHash({ ...quote, shippingDays: 9 })).toBe(false);
  });
});
