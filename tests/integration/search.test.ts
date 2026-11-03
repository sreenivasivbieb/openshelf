import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Container } from "../../bootstrap/container";
import { SearchResponse } from "../../src/schemas/search.schema";
import { buildTestApp } from "../helpers/test-app";
import { serve } from "../helpers/http";
import { createStore } from "../helpers/catalog";

let http: Awaited<ReturnType<typeof serve>>;
let container: Container;

beforeAll(async () => {
  const test = buildTestApp();
  container = test.container;
  await createStore(container, "m_demo");
  await createStore(
    container,
    "m_other",
    "SKU,Name,Price,Stock,Shipping Days,Return Days\nOTHER-MUG,Enamel camping mug,12,9,3,14\n",
    "EUR",
  );
  http = await serve(test.app);
});
afterAll(() => http.close());

async function search(body: unknown, merchant = "m_demo", headers: Record<string, string> = {}) {
  const res = await http.fetch(`/m/${merchant}/api/search`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  return {
    status: res.status,
    body: (await res.json()) as Record<string, unknown> & { error?: { code: string } },
  };
}
const skus = async (body: unknown, merchant?: string) =>
  SearchResponse.parse((await search(body, merchant)).body).results.map((p) => p.sku);

describe("/search (FR-07)", () => {
  it("returns the agent contract for a match", async () => {
    const { status, body } = await search({ query: "ceramic mug" });
    expect(status).toBe(200);
    const { results } = SearchResponse.parse(body);
    expect(
      results
        .slice(0, 2)
        .map((p) => p.sku)
        .sort(),
    ).toEqual(["MUG-014", "MUG-015"]);
    expect(results.find((p) => p.sku === "MUG-014")).toEqual({
      sku: "MUG-014",
      name: "Hand-glazed ceramic mug",
      description: "350 ml stoneware mug glazed by hand. Dishwasher safe.",
      category: "Kitchen",
      price: 36,
      currency: "USD",
      stock: 40,
      in_stock: true,
      shipping_days: 3,
      return_days: 30,
      rating_avg: 4.6,
      review_count: 128,
      ratings_source: "merchant_reported",
    });
  });

  it("matches plural and singular forms", async () => {
    expect(await skus({ query: "mugs" })).toContain("MUG-014");
  });

  it("applies price, shipping and rating filters", async () => {
    expect(await skus({ query: "ceramic mug", max_price: 40 })).toEqual(["MUG-014"]);
    expect(await skus({ query: "brass lamp", max_shipping_days: 2 })).toEqual(["LAMP-003"]);
    expect(await skus({ query: "tote", min_rating: 4.5 })).toEqual(["TOTE-102"]);
  });

  it("hides out-of-stock products unless asked", async () => {
    expect(await skus({ query: "darjeeling tea" })).not.toContain("TEA-021");
    expect(await skus({ query: "darjeeling tea", in_stock_only: false })).toContain("TEA-021");
  });

  it("never shows a flagged product (FR-05)", async () => {
    expect(await skus({ query: "soy wax candle sandalwood" })).toEqual([]);
    expect(await skus({ query: "*", limit: 50, in_stock_only: false })).not.toContain("CANDLE-3");
  });

  it("browses the clean, in-stock catalog when the query has no searchable words", async () => {
    expect(await skus({ query: "*", limit: 50 })).toHaveLength(8); // 10 - flagged candle - sold-out tea
  });

  it("keeps stores apart (FR-06)", async () => {
    expect(await skus({ query: "mug" })).not.toContain("OTHER-MUG");
    const other = SearchResponse.parse((await search({ query: "mug" }, "m_other")).body).results;
    expect(other.map((p) => [p.sku, p.currency])).toEqual([["OTHER-MUG", "EUR"]]);
  });

  it("answers 404 for an unknown store and 400 for bad input", async () => {
    const unknown = await search({ query: "mug" }, "m_nope");
    expect([unknown.status, unknown.body.error?.code]).toEqual([404, "MERCHANT_NOT_FOUND"]);
    const bad = await search({ query: "" });
    expect([bad.status, bad.body.error?.code]).toEqual([400, "INVALID_INPUT"]);
  });

  it("answers in well under 500 ms on the seed catalog (NFR-04)", async () => {
    const runs = 20;
    const started = performance.now();
    for (let i = 0; i < runs; i++) await search({ query: "ceramic mug", max_price: 100 });
    expect((performance.now() - started) / runs).toBeLessThan(500);
  });
});

describe("telemetry for agent calls (FR-14, NFR-06)", () => {
  it("writes exactly one row per call, failed calls included", async () => {
    const count = () =>
      container.db.prepare(`SELECT COUNT(*) FROM telemetry`).pluck().get() as number;
    const before = count();
    await search({ query: "ceramic mug" }, "m_demo", {
      "x-agent-id": "test-agent",
      "x-simulated": "1",
    });
    await search({ query: "" });
    await search({ query: "mug" }, "m_nope");
    expect(count() - before).toBe(3);

    const rows = container.db
      .prepare(
        `SELECT merchant_id, agent_id, channel, tool, outcome, error_code, is_simulated, request_json
         FROM telemetry ORDER BY id DESC LIMIT 3`,
      )
      .all()
      .reverse();
    expect(rows).toEqual([
      {
        merchant_id: "m_demo",
        agent_id: "test-agent",
        channel: "rest",
        tool: "search",
        outcome: "ok",
        error_code: null,
        is_simulated: 1,
        request_json: '{"query":"ceramic mug"}',
      },
      {
        merchant_id: "m_demo",
        agent_id: null,
        channel: "rest",
        tool: "search",
        outcome: "error",
        error_code: "INVALID_INPUT",
        is_simulated: 0,
        request_json: '{"query":""}',
      },
      {
        merchant_id: "m_nope",
        agent_id: null,
        channel: "rest",
        tool: "search",
        outcome: "error",
        error_code: "MERCHANT_NOT_FOUND",
        is_simulated: 0,
        request_json: '{"query":"mug"}',
      },
    ]);
  });
});
