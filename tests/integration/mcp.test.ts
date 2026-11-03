import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type { Container } from "../../bootstrap/container";
import { hashQuote } from "../../src/domain/quote-hash";
import { QuoteFail, QuotePass } from "../../src/schemas/quote.schema";
import { SearchResponse } from "../../src/schemas/search.schema";
import { buildTestApp } from "../helpers/test-app";
import { serve } from "../helpers/http";
import { createStore } from "../helpers/catalog";
import { connectMcp, resultText } from "../helpers/mcp";

let http: Awaited<ReturnType<typeof serve>>;
let container: Container;
let agent: Client;

beforeAll(async () => {
  const test = buildTestApp();
  container = test.container;
  await createStore(container, "m_demo");
  http = await serve(test.app);
  agent = await connectMcp(http.url, "m_demo", { "x-agent-id": "test-agent", "x-simulated": "1" });
});
afterAll(async () => {
  await agent.close();
  await http.close();
});

const call = (name: string, args: Record<string, unknown>) =>
  agent.callTool({ name, arguments: args });
const telemetryCount = () =>
  container.db.prepare(`SELECT COUNT(*) FROM telemetry`).pluck().get() as number;
const lastRows = (n: number) =>
  container.db
    .prepare(
      `SELECT channel, tool, outcome, agent_id, is_simulated, reason_codes
       FROM telemetry ORDER BY id DESC LIMIT ?`,
    )
    .all(n)
    .reverse();

describe("MCP endpoint (FR-13, NFR-07)", () => {
  it("introduces itself with the buying flow and no merchant text", () => {
    expect(agent.getServerVersion()).toMatchObject({ name: "openshelf-m_demo", version: "0.1.0" });
    const instructions = agent.getInstructions() ?? "";
    expect(instructions).toContain("approve_url");
    expect(instructions).not.toContain("Store m_demo"); // the store name is merchant data
  });

  it("lists the four buyer tools with schemas and hints", async () => {
    const { tools } = await agent.listTools();
    expect(tools.map((t) => t.name)).toEqual(["search", "quote", "order", "track"]);

    const quote = tools.find((t) => t.name === "quote");
    expect(quote?.inputSchema.required).toEqual(["sku"]);
    expect(Object.keys(quote?.inputSchema.properties ?? {})).toEqual(
      expect.arrayContaining(["sku", "quantity", "max_budget", "max_shipping_days", "min_rating"]),
    );
    expect(quote?.outputSchema?.properties).toHaveProperty("quote_hash");
    expect(quote?.outputSchema?.properties).toHaveProperty("reason_codes");

    expect(tools.find((t) => t.name === "search")?.annotations).toMatchObject({
      readOnlyHint: true,
    });
    expect(tools.find((t) => t.name === "order")?.annotations).toMatchObject({
      idempotentHint: true,
    });
  });

  it("searches like the REST API, as text and as structured content", async () => {
    const result = await call("search", { query: "ceramic mug", max_price: 40 });
    expect(result.isError).toBeFalsy();
    const { results } = SearchResponse.parse(result.structuredContent);
    expect(results.map((p) => p.sku)).toEqual(["MUG-014"]);
    expect(JSON.parse(resultText(result))).toEqual(result.structuredContent);
  });

  it("returns a locked quote the agent can verify itself", async () => {
    const q = QuotePass.parse(
      (await call("quote", { sku: "MUG-014", max_budget: 40 })).structuredContent,
    );
    expect(q.quantity).toBe(1); // schema default applied
    expect(q.quote_hash).toBe(hashQuote(q.locked_terms));
  });

  it("returns every failed rule and the nearest passing product", async () => {
    const f = QuoteFail.parse(
      (await call("quote", { sku: "LAMP-002", max_shipping_days: 2 })).structuredContent,
    );
    expect(f.reason_codes).toEqual(["SHIPPING_TOO_SLOW"]);
    expect(f.nearest_passing_sku).toBe("LAMP-003");
  });

  it("turns service errors into a readable error result", async () => {
    const result = await call("order", { quote_id: "q_unknown" });
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toBeUndefined();
    const body = JSON.parse(resultText(result)) as { error: { code: string; message: string } };
    expect(body.error).toEqual({ code: expect.any(String), message: expect.any(String) });
  });

  it("rejects arguments that break the input schema, without a telemetry row", async () => {
    const before = telemetryCount();
    const result = await call("quote", { sku: "" });
    expect(result.isError).toBe(true);
    expect(resultText(result)).toContain("Input validation error");
    expect(telemetryCount()).toBe(before);
  });
});

describe("telemetry over MCP (FR-14, NFR-06)", () => {
  it("writes exactly one row per tool call, with channel mcp and the declared agent", async () => {
    const before = telemetryCount();
    await call("search", { query: "tote" });
    await call("quote", { sku: "TOTE-101", min_rating: 4.5 });
    await call("order", { quote_id: "q_unknown" });
    await call("track", { order_id: "o_unknown" });
    expect(telemetryCount() - before).toBe(4);

    const agent = { channel: "mcp", agent_id: "test-agent", is_simulated: 1 };
    expect(lastRows(4)).toEqual([
      { ...agent, tool: "search", outcome: "ok", reason_codes: null },
      { ...agent, tool: "quote", outcome: "fail", reason_codes: '["RATING_TOO_LOW"]' },
      { ...agent, tool: "order", outcome: "error", reason_codes: null },
      { ...agent, tool: "track", outcome: "error", reason_codes: null },
    ]);
  });

  it("falls back to the User-Agent when no X-Agent-Id is sent", async () => {
    const other = await connectMcp(http.url, "m_demo", { "user-agent": "desktop-bridge/1.0" });
    await other.callTool({ name: "search", arguments: { query: "mug" } });
    await other.close();
    expect(lastRows(1)).toEqual([
      {
        channel: "mcp",
        tool: "search",
        outcome: "ok",
        agent_id: "desktop-bridge/1.0",
        is_simulated: 0,
        reason_codes: null,
      },
    ]);
  });
});

describe("MCP over HTTP", () => {
  it("answers 404 for an unknown store before any MCP work", async () => {
    const res = await http.fetch("/m/m_nope/mcp", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
    });
    expect(res.status).toBe(404);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe(
      "MERCHANT_NOT_FOUND",
    );
  });

  it.each(["GET", "DELETE"])("answers 405 to %s: the server is stateless", async (method) => {
    const res = await http.fetch("/m/m_demo/mcp", { method });
    expect(res.status).toBe(405);
    expect(res.headers.get("allow")).toBe("POST");
    expect(await res.json()).toMatchObject({ jsonrpc: "2.0", error: { code: -32000 }, id: null });
  });
});
