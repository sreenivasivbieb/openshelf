import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Container } from "../../bootstrap/container";
import { CatalogPreview, StoreInfo } from "../../src/schemas/merchant.schema";
import { ADMIN_AUTH, buildTestApp } from "../helpers/test-app";
import { serve } from "../helpers/http";
import { MESSY_CSV, SEED_CSV } from "../helpers/catalog";

let http: Awaited<ReturnType<typeof serve>>;
let container: Container;
let merchantId: string;

beforeAll(async () => {
  const test = buildTestApp();
  container = test.container;
  http = await serve(test.app);
});
afterAll(() => http.close());

const admin = async (
  path: string,
  init: { method?: string; type?: string; body?: string } = {},
) => {
  const headers: Record<string, string> = { ...ADMIN_AUTH };
  if (init.type) headers["content-type"] = init.type;
  const res = await http.fetch(path, { method: init.method ?? "GET", headers, body: init.body });
  return {
    status: res.status,
    body: (await res.json()) as Record<string, unknown> & { error?: { code: string } },
  };
};
const postCsv = (path: string, csv: string) =>
  admin(path, { method: "POST", type: "text/csv", body: csv });
const postJson = (path: string, body: unknown) =>
  admin(path, { method: "POST", type: "application/json", body: JSON.stringify(body) });
const catalog = (step: "preview" | "commit", query = "") =>
  `/admin/merchants/${merchantId}/catalog/${step}${query}`;

describe("merchant onboarding over HTTP (FR-01, FR-02, FR-05, FR-06)", () => {
  it("creates a merchant and returns its store URLs", async () => {
    const res = await postJson("/admin/merchants", { name: "Clay & Co", currency: "inr" });
    expect(res.status).toBe(201);
    const store = StoreInfo.parse(res.body);
    merchantId = store.merchant_id;
    expect(merchantId).toMatch(/^m_/);
    expect(store).toMatchObject({
      currency: "INR",
      spec_status: "pending",
      products: { total: 0, clean: 0, flagged: 0 },
    });
    expect(store.mcp_url).toBe(`http://localhost:8787/m/${merchantId}/mcp`);
  });

  it("previews a messy file: mapping, every row problem, a sample, nothing saved", async () => {
    const res = await postCsv(catalog("preview"), MESSY_CSV);
    expect(res.status).toBe(200);
    const preview = CatalogPreview.parse(res.body);
    expect(preview.mapping["Selling Price (USD)"]).toBe("price");
    expect(preview).toMatchObject({
      total_rows: 3,
      valid_rows: 1,
      error_count: 3,
      missing_required: [],
    });
    expect(preview.errors.map((e) => [e.row, e.column])).toEqual([
      [3, "Title"],
      [4, "Selling Price (USD)"],
      [4, "Dispatch Days"],
    ]);
    expect(preview.sample.map((row) => row.sku)).toEqual(["A-1"]);
    expect(
      StoreInfo.parse((await admin(`/admin/merchants/${merchantId}`)).body).products.total,
    ).toBe(0);
  });

  it("refuses to commit a file that still has problems", async () => {
    const res = await postCsv(catalog("commit"), MESSY_CSV);
    expect(res.status).toBe(422);
    expect(res.body.error?.code).toBe("CATALOG_HAS_ERRORS");
  });

  it("commits the seed catalog and flags the planted injection", async () => {
    const res = await postCsv(catalog("commit"), SEED_CSV);
    expect(res.status).toBe(200);
    const store = StoreInfo.parse(res.body);
    expect(store.products).toEqual({ total: 10, clean: 9, flagged: 1 });
    expect(store.flagged_products).toEqual([
      { sku: "CANDLE-3", name: "Soy wax candle", reason: expect.stringContaining("hidden-markup") },
    ]);
  });

  it("keeps the raw text for audit and gives agents only the cleaned text", () => {
    const candle = container.db
      .prepare(
        `SELECT description_raw, description_agent FROM products WHERE merchant_id = ? AND sku = 'CANDLE-3'`,
      )
      .get(merchantId) as { description_raw: string; description_agent: string };
    expect(candle.description_raw).toContain("ignore all previous instructions");
    expect(candle.description_agent).toBe("Sandalwood soy candle, 40 h burn.");
  });

  it("uses the merchant's mapping corrections", async () => {
    const file = "Item,Blurb,Price,Stock,Ships,Returns\nClay pot,Small pot,9,3,2,7\n";
    expect(
      CatalogPreview.parse((await postCsv(catalog("preview"), file)).body).missing_required,
    ).toEqual(["shipping_days"]);
    const mapping = encodeURIComponent(
      JSON.stringify({ Ships: "shipping_days", Blurb: "description" }),
    );
    const preview = CatalogPreview.parse(
      (await postCsv(catalog("preview", `?mapping=${mapping}`), file)).body,
    );
    expect(preview).toMatchObject({ missing_required: [], valid_rows: 1 });
    expect(preview.sample[0]).toMatchObject({ description: "Small pot", shipping_days: 2 });
  });

  it("replaces the whole catalog on re-upload", async () => {
    const res = await postCsv(
      catalog("commit"),
      "SKU,Name,Price,Stock,Shipping Days,Return Days\nNEW-1,Clay pot,9,3,2,7\n",
    );
    expect(StoreInfo.parse(res.body).products).toEqual({ total: 1, clean: 1, flagged: 0 });
  });

  it.each([
    ["no CSV body", () => postJson(catalog("preview"), { csv: "x" }), 400, "CSV_REQUIRED"],
    [
      "mapping that is not JSON",
      () => postCsv(catalog("preview", "?mapping=nope"), SEED_CSV),
      400,
      "INVALID_MAPPING",
    ],
    [
      "mapping to an unknown column",
      () =>
        postCsv(catalog("preview", `?mapping=${encodeURIComponent('{"MRP":"colour"}')}`), SEED_CSV),
      400,
      "INVALID_INPUT",
    ],
    [
      "required columns missing",
      () => postCsv(catalog("commit"), "Name,Price\nClay pot,9\n"),
      422,
      "MISSING_COLUMNS",
    ],
    [
      "header but no products",
      () => postCsv(catalog("commit"), "Name,Price,Stock,Shipping Days,Return Days\n"),
      422,
      "CATALOG_EMPTY",
    ],
    [
      "unknown store",
      () => postCsv("/admin/merchants/m_nope/catalog/preview", SEED_CSV),
      404,
      "MERCHANT_NOT_FOUND",
    ],
    [
      "bad currency",
      () => postJson("/admin/merchants", { name: "X", currency: "rupees" }),
      400,
      "INVALID_INPUT",
    ],
  ])("refuses %s", async (_case, call, status, code) => {
    const res = await call();
    expect(res.status).toBe(status);
    expect(res.body.error?.code).toBe(code);
  });
});
