import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Container } from "../../bootstrap/container";
import { CatalogPreview, StoreInfo } from "../../src/schemas/merchant.schema";
import { ADMIN_AUTH, buildTestApp } from "../helpers/test-app";
import { serve } from "../helpers/http";
import { createStore } from "../helpers/catalog";
import { fakeLlm } from "../helpers/fake-llm";

type Http = Awaited<ReturnType<typeof serve>>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- walking a JSON document in assertions
type Json = any;

const getJson = async (http: Http, path: string) => {
  const res = await http.fetch(path);
  return { status: res.status, body: (await res.json()) as Json };
};
const SEED_CATEGORIES = ["Apparel", "Bags", "Food", "Home", "Kitchen"]; // CANDLE-3 (Home) is flagged; lamps keep Home

describe("OpenAPI spec without an LLM (FR-03, NFR-08)", () => {
  let http: Http;
  let container: Container;

  beforeAll(async () => {
    const test = buildTestApp();
    container = test.container;
    await createStore(container, "m_demo");
    container.services.onboarding.createMerchant(
      { name: "Empty Shop", currency: "EUR" },
      { id: "m_empty" },
    );
    http = await serve(test.app);
  });
  afterAll(() => http.close());

  it("stores the template at commit and serves it", async () => {
    expect(container.services.onboarding.getStore("m_demo").spec_status).toBe("fallback");
    const { status, body } = await getJson(http, "/m/m_demo/openapi.json");
    expect(status).toBe(200);
    expect(body.openapi).toMatch(/^3\.1\./);
    expect(body.servers[0].url).toBe("http://localhost:8787/m/m_demo/api");
    expect(body["x-openshelf"].categories).toEqual(SEED_CATEGORIES);
  });

  it("serves the template for a store without a catalog yet", async () => {
    const { status, body } = await getJson(http, "/m/m_empty/openapi.json");
    expect(status).toBe(200);
    expect(body["x-openshelf"]).toMatchObject({ currency: "EUR", categories: [] });
  });

  it("answers 404 for an unknown store", async () => {
    const { status, body } = await getJson(http, "/m/m_nope/openapi.json");
    expect([status, body.error.code]).toEqual([404, "MERCHANT_NOT_FOUND"]);
  });
});

describe("Spec Agent with an LLM (FR-03, FR-04, FR-05, step 9)", () => {
  const MUG_REWRITE = "Hand-glazed 350 ml stoneware mug. Dishwasher safe.";
  const llm = fakeLlm({
    firewall: () => ({
      verdicts: [
        {
          sku: "TOTE-101",
          verdict: "flagged",
          reason: "Pushes shopping assistants towards this tote.",
        },
      ],
    }),
    rewrite: () => ({ descriptions: [{ sku: "MUG-014", description: MUG_REWRITE }] }),
    "spec-enrichment": () => ({
      store_description: "Hand-made kitchenware, brass lamps, totes, tea and silk stoles.",
      search_examples: ["ceramic mug", "brass lamp"],
    }),
    mapping: () => ({
      suggestions: [
        { header: "Ships", column: "shipping_days" },
        { header: "Blurb", column: "description" },
      ],
    }),
  });
  let http: Http;
  let container: Container;
  let store: StoreInfo;

  beforeAll(async () => {
    const test = buildTestApp({ llm });
    container = test.container;
    store = await createStore(container, "m_demo");
    http = await serve(test.app);
  });
  afterAll(() => http.close());

  const agentText = (sku: string) =>
    (
      container.db
        .prepare(`SELECT description_agent FROM products WHERE merchant_id = 'm_demo' AND sku = ?`)
        .get(sku) as { description_agent: string }
    ).description_agent;

  it("adds LLM flags on top of the rules", () => {
    expect(store.products).toEqual({ total: 10, clean: 8, flagged: 2 });
    expect(store.flagged_products).toEqual([
      { sku: "CANDLE-3", name: "Soy wax candle", reason: expect.stringContaining("hidden-markup") },
      {
        sku: "TOTE-101",
        name: "Block-print cotton tote",
        reason: "llm: Pushes shopping assistants towards this tote.",
      },
    ]);
  });

  it("uses verified rewrites and keeps the cleaned text elsewhere", () => {
    expect(agentText("MUG-014")).toBe(MUG_REWRITE);
    expect(agentText("MUG-015")).toBe("Two 300 ml mugs in matching blue glaze.");
  });

  it("stores and serves the enriched spec", async () => {
    expect(store.spec_status).toBe("ready");
    const { body } = await getJson(http, "/m/m_demo/openapi.json");
    expect(body.info.description).toContain("About this store: Hand-made kitchenware");
    expect(
      Object.keys(body.paths["/search"].post.requestBody.content["application/json"].examples),
    ).toEqual(["example1", "example2"]);
  });

  it("suggests column mappings on preview and never asks on commit", async () => {
    const mappingCalls = () => llm.calls.filter((call) => call.task === "mapping").length;
    expect(mappingCalls()).toBe(0); // the seed commit above did not ask
    const res = await http.fetch("/admin/merchants/m_demo/catalog/preview", {
      method: "POST",
      headers: { ...ADMIN_AUTH, "content-type": "text/csv" },
      body: "Item,Blurb,Price,Stock,Ships,Returns\nClay pot,Small pot,9,3,2,7\n",
    });
    const preview = CatalogPreview.parse(await res.json());
    expect(preview.suggestions).toEqual({ Ships: "shipping_days", Blurb: "description" });
    expect(preview.missing_required).toEqual(["shipping_days"]);
    expect(mappingCalls()).toBe(1);
  });
});
