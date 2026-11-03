import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Container } from "../../bootstrap/container";
import { QuoteFail, QuotePass } from "../../src/schemas/quote.schema";
import { hashQuote, verifyQuoteHash } from "../../src/domain/quote-hash";
import { createQuoteRepository } from "../../src/repositories/quote.repository";
import { buildTestApp } from "../helpers/test-app";
import { serve } from "../helpers/http";
import { createStore } from "../helpers/catalog";

let http: Awaited<ReturnType<typeof serve>>;
let container: Container;

beforeAll(async () => {
  const test = buildTestApp();
  container = test.container;
  await createStore(container, "m_demo");
  http = await serve(test.app);
});
afterAll(() => http.close());

async function quote(body: unknown, headers: Record<string, string> = {}) {
  const res = await http.fetch("/m/m_demo/api/quote", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json()) as unknown };
}
const pass = async (body: unknown, headers?: Record<string, string>) =>
  QuotePass.parse((await quote(body, headers)).body);
const fail = async (body: unknown) => QuoteFail.parse((await quote(body)).body);

describe("/quote passes (FR-08, FR-09)", () => {
  it("locks the terms with an expiry and a hash the agent can verify itself", async () => {
    const rules = {
      max_budget: 40,
      max_shipping_days: 4,
      min_return_days: 14,
      min_rating: 4,
      min_review_count: 10,
    };
    const q = await pass({ sku: "MUG-014", ...rules }, { "x-agent-id": "agent-a" });
    expect(q).toMatchObject({
      sku: "MUG-014",
      quantity: 1,
      unit_price: 36,
      price: 36,
      currency: "USD",
      shipping_days: 3,
      return_days: 30,
      expires_at: "2026-11-09T10:15:00.000Z", // fixed clock + 15 min
    });
    expect(q.quote_id).toMatch(/^q_/);
    expect(q.locked_terms).toMatchObject({
      merchant_id: "m_demo",
      quote_id: q.quote_id,
      total_minor: 3600,
    });
    expect(q.quote_hash).toBe(hashQuote(q.locked_terms));

    const stored = createQuoteRepository(container.db).findById("m_demo", q.quote_id);
    expect(stored).toMatchObject({
      quoteHash: q.quote_hash,
      agentId: "agent-a",
      guardrails: { sku: "MUG-014", ...rules },
    });
    expect(stored && verifyQuoteHash(stored)).toBe(true); // NFR-03: recomputed from stored fields
  });

  it("prices the requested quantity", async () => {
    const q = await pass({ sku: "MUG-014", quantity: 2, max_budget: 80 });
    expect(q).toMatchObject({ unit_price: 36, price: 72, quantity: 2 });
    expect(q.locked_terms).toMatchObject({ unit_price_minor: 3600, total_minor: 7200 });
  });
});

describe("/quote failures are easy to act on (FR-10)", () => {
  it("explains a slow product and suggests the express one", async () => {
    expect(await fail({ sku: "LAMP-002", max_shipping_days: 2 })).toEqual({
      status: "fail",
      reason_codes: ["SHIPPING_TOO_SLOW"],
      retry_hint:
        "Ships in 7 days (you asked for at most 2). LAMP-003 (Brass table lamp (express)) meets all your rules: " +
        "99 USD total, ships in 2 days, 14-day returns.",
      nearest_passing_sku: "LAMP-003",
      actual: {
        price: 89,
        currency: "USD",
        stock: 6,
        shipping_days: 7,
        return_days: 14,
        rating_avg: 4.8,
        review_count: 22,
      },
    });
  });

  it("suggests a better-rated alternative", async () => {
    const f = await fail({ sku: "TOTE-101", min_rating: 4.5 });
    expect(f.reason_codes).toEqual(["RATING_TOO_LOW"]);
    expect(f.nearest_passing_sku).toBe("TOTE-102");
  });

  it("returns every failed rule at once, and no suggestion when nothing passes", async () => {
    const f = await fail({
      sku: "TOTE-101",
      quantity: 2,
      max_budget: 30,
      min_return_days: 10,
      min_rating: 4.5,
      min_review_count: 50,
    });
    expect(f.reason_codes).toEqual([
      "OVER_BUDGET",
      "RETURN_WINDOW_TOO_SHORT",
      "RATING_TOO_LOW",
      "TOO_FEW_REVIEWS",
    ]);
    expect(f.nearest_passing_sku).toBeUndefined();
    expect(f.actual?.price).toBe(36);
  });

  it("suggests an in-stock alternative for a sold-out product", async () => {
    const f = await fail({ sku: "TEA-021" });
    expect(f.reason_codes).toEqual(["OUT_OF_STOCK"]);
    expect(f.nearest_passing_sku).toBe("TEA-020");
    expect(f.retry_hint).toBe(
      "Out of stock. TEA-020 (Assam breakfast tea 250 g) meets all your rules: 12 USD total, ships in 2 days, no returns.",
    );
  });

  it("reports a missing rating as RATING_UNKNOWN", async () => {
    const f = await fail({ sku: "SCARF-07", min_rating: 4 });
    expect(f.reason_codes).toEqual(["RATING_UNKNOWN"]);
    expect(f.retry_hint).toBe("The merchant has not reported a rating.");
  });

  it("refuses a flagged product without revealing its terms", async () => {
    expect(await fail({ sku: "CANDLE-3" })).toEqual({
      status: "fail",
      reason_codes: ["PRODUCT_FLAGGED"],
      retry_hint: "This product is not available to agents.",
    });
  });

  it("points to search for an unknown SKU", async () => {
    expect(await fail({ sku: "NOPE-1" })).toEqual({
      status: "fail",
      reason_codes: ["SKU_NOT_FOUND"],
      retry_hint: "No product with that SKU in this store; use search to find SKUs.",
    });
  });
});

describe("/quote determinism and telemetry (NFR-02, NFR-06)", () => {
  it("gives the same decision for the same rules", async () => {
    const rules = { sku: "LAMP-002", max_budget: 50, max_shipping_days: 2 };
    expect((await quote(rules)).body).toEqual((await quote(rules)).body);
    const [a, b] = [await pass({ sku: "MUG-014" }), await pass({ sku: "MUG-014" })];
    const strip = (q: typeof a) => ({
      ...q,
      quote_id: "",
      quote_hash: "",
      locked_terms: { ...q.locked_terms, quote_id: "" },
    });
    expect(strip(a)).toEqual(strip(b));
    expect(a.quote_id).not.toBe(b.quote_id);
  });

  it("records pass and fail with the quote id and reason codes", async () => {
    const q = await pass({ sku: "MUG-014" });
    await fail({ sku: "LAMP-002", max_shipping_days: 2 });
    const rows = container.db
      .prepare(
        `SELECT tool, outcome, quote_id, reason_codes FROM telemetry ORDER BY id DESC LIMIT 2`,
      )
      .all()
      .reverse();
    expect(rows).toEqual([
      { tool: "quote", outcome: "pass", quote_id: q.quote_id, reason_codes: null },
      { tool: "quote", outcome: "fail", quote_id: null, reason_codes: '["SHIPPING_TOO_SLOW"]' },
    ]);
  });
});
