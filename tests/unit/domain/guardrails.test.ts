import { describe, expect, it } from "vitest";
import { evaluateGuardrails } from "../../../src/domain/guardrails";
import type { Product } from "../../../src/domain/entities";
import type { QuoteRequest } from "../../../src/schemas/quote.schema";

const product = (overrides: Partial<Product> = {}): Product => ({
  merchantId: "m_1",
  sku: "MUG-014",
  name: "Ceramic mug",
  descriptionRaw: "",
  descriptionAgent: "",
  category: "Kitchen",
  priceMinor: 3600,
  stock: 40,
  shippingDays: 3,
  returnDays: 30,
  ratingAvg: 4.6,
  reviewCount: 128,
  firewallStatus: "clean",
  firewallReason: null,
  updatedAt: "2026-11-09T10:00:00.000Z",
  ...overrides,
});
const request = (overrides: Partial<QuoteRequest> = {}): QuoteRequest => ({
  sku: "MUG-014",
  quantity: 1,
  ...overrides,
});

describe("evaluateGuardrails (FR-08, NFR-02)", () => {
  it("passes when the buyer sends no rules", () => {
    expect(evaluateGuardrails(product(), request())).toEqual({ pass: true });
  });

  it("passes on exact boundaries", () => {
    const rules = {
      max_budget: 36,
      max_shipping_days: 3,
      min_return_days: 30,
      min_rating: 4.6,
      min_review_count: 128,
    };
    expect(evaluateGuardrails(product(), request(rules))).toEqual({ pass: true });
  });

  it.each([
    ["OUT_OF_STOCK", product({ stock: 0 }), request()],
    ["OVER_BUDGET", product(), request({ max_budget: 35.99 })],
    ["SHIPPING_TOO_SLOW", product(), request({ max_shipping_days: 2 })],
    ["RETURN_WINDOW_TOO_SHORT", product(), request({ min_return_days: 31 })],
    ["RATING_TOO_LOW", product(), request({ min_rating: 4.7 })],
    ["RATING_UNKNOWN", product({ ratingAvg: null }), request({ min_rating: 1 })],
    ["TOO_FEW_REVIEWS", product(), request({ min_review_count: 129 })],
    ["TOO_FEW_REVIEWS", product({ reviewCount: null }), request({ min_review_count: 1 })],
  ])("fails with %s", (reason, p, r) => {
    expect(evaluateGuardrails(p, r)).toEqual({ pass: false, reasons: [reason] });
  });

  it("accepts a missing review count when the buyer asks for none", () => {
    expect(
      evaluateGuardrails(product({ reviewCount: null }), request({ min_review_count: 0 })),
    ).toEqual({ pass: true });
  });

  it("counts the quantity against stock and budget", () => {
    expect(
      evaluateGuardrails(product({ stock: 1 }), request({ quantity: 2, max_budget: 40 })),
    ).toEqual({
      pass: false,
      reasons: ["OUT_OF_STOCK", "OVER_BUDGET"],
    });
  });

  it("returns every failure, in reason-code order", () => {
    const rules = {
      max_budget: 10,
      max_shipping_days: 1,
      min_return_days: 60,
      min_rating: 4,
      min_review_count: 10,
    };
    expect(
      evaluateGuardrails(product({ ratingAvg: null, reviewCount: 2 }), request(rules)),
    ).toEqual({
      pass: false,
      reasons: [
        "OVER_BUDGET",
        "SHIPPING_TOO_SLOW",
        "RETURN_WINDOW_TOO_SHORT",
        "RATING_UNKNOWN",
        "TOO_FEW_REVIEWS",
      ],
    });
  });

  it.each(["flagged", "pending"] as const)(
    "stops at PRODUCT_FLAGGED for a %s product",
    (status) => {
      expect(
        evaluateGuardrails(
          product({ firewallStatus: status, stock: 0 }),
          request({ max_budget: 1 }),
        ),
      ).toEqual({
        pass: false,
        reasons: ["PRODUCT_FLAGGED"],
      });
    },
  );

  it("gives the same answer for the same input", () => {
    const p = product();
    const r = request({ max_budget: 10, min_rating: 5 });
    expect(evaluateGuardrails(p, r)).toEqual(evaluateGuardrails(p, r));
  });
});
