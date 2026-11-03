import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { z } from "zod";
import type { Container } from "../../bootstrap/container";
import { AgentKeyList, CreatedAgentKey } from "../../src/schemas/agent-key.schema";
import { hashAgentKey } from "../../src/domain/agent-keys";
import { ADMIN_AUTH, buildTestApp } from "../helpers/test-app";
import { serve } from "../helpers/http";
import { createStore } from "../helpers/catalog";
import { connectMcp } from "../helpers/mcp";

const ErrorBody = z.object({ error: z.object({ code: z.string(), message: z.string() }) });

let http: Awaited<ReturnType<typeof serve>>;
let container: Container;

beforeAll(async () => {
  const test = buildTestApp();
  container = test.container;
  await createStore(container, "m_demo");
  await createStore(container, "m_other");
  http = await serve(test.app);
});
afterAll(() => http.close());

async function call(method: string, path: string, body?: unknown, headers = {}) {
  const res = await http.fetch(path, {
    method,
    headers: { ...(body === undefined ? {} : { "content-type": "application/json" }), ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, json: (await res.json()) as unknown };
}
const errorCode = (res: { json: unknown }) => ErrorBody.parse(res.json).error.code;
const admin = (method: string, path: string, body?: unknown) =>
  call(method, `/admin/merchants/m_demo${path}`, body, ADMIN_AUTH);
const createKey = async (label: string, merchant = "m_demo") =>
  CreatedAgentKey.parse(
    (await call("POST", `/admin/merchants/${merchant}/agent-keys`, { label }, ADMIN_AUTH)).json,
  );
const search = (headers: Record<string, string> = {}) =>
  call("POST", "/m/m_demo/api/search", { query: "mug" }, headers);
const lastTelemetry = () =>
  container.db
    .prepare(`SELECT channel, agent_id, agent_verified FROM telemetry ORDER BY id DESC LIMIT 1`)
    .get();

describe("agent API keys (NFR-01, ADR-0012)", () => {
  it("shows a new key once and stores only its sha256 hash", async () => {
    const created = await createKey("Shopping Agent A");
    expect(created.key).toMatch(/^osk_[A-Za-z0-9_-]{43}$/);
    expect(created).toMatchObject({ label: "Shopping Agent A", revoked_at: null });

    const stored = container.db
      .prepare(`SELECT key_hash FROM agent_keys WHERE id = ?`)
      .pluck()
      .get(created.id);
    expect(stored).toBe(hashAgentKey(created.key));
    const everything = JSON.stringify(container.db.prepare(`SELECT * FROM agent_keys`).all());
    expect(everything).not.toContain(created.key);

    const list = AgentKeyList.parse((await admin("GET", "/agent-keys")).json);
    expect(list.required).toBe(false);
    expect(JSON.stringify(list)).not.toContain(created.key);
    expect(list.keys.map((k) => k.id)).toContain(created.id);
  });

  it("turns a valid key into a verified agent id on REST", async () => {
    const { key } = await createKey("verified-rest");
    const res = await search({ "x-agent-key": key, "x-agent-id": "spoofed-name" });
    expect(res.status).toBe(200);
    expect(lastTelemetry()).toEqual({
      channel: "rest",
      agent_id: "verified-rest",
      agent_verified: 1,
    });

    await search({ "x-agent-id": "self-declared" });
    expect(lastTelemetry()).toEqual({
      channel: "rest",
      agent_id: "self-declared",
      agent_verified: 0,
    });
  });

  it("turns a valid key into a verified agent id on MCP", async () => {
    const { key } = await createKey("verified-mcp");
    const agent = await connectMcp(http.url, "m_demo", { "x-agent-key": key });
    try {
      await agent.callTool({ name: "search", arguments: { query: "mug" } });
    } finally {
      await agent.close();
    }
    expect(lastTelemetry()).toEqual({
      channel: "mcp",
      agent_id: "verified-mcp",
      agent_verified: 1,
    });
  });

  it("refuses unknown, malformed, other-store and revoked keys with 401", async () => {
    const other = await createKey("other-store-agent", "m_other");
    const revoked = await createKey("soon-revoked");
    expect((await search({ "x-agent-key": revoked.key })).status).toBe(200);
    const revoke = await admin("DELETE", `/agent-keys/${revoked.id}`);
    expect(revoke.status).toBe(200);
    expect((revoke.json as { revoked_at: string | null }).revoked_at).not.toBeNull();

    for (const key of [`osk_${"A".repeat(43)}`, "not-a-key", other.key, revoked.key]) {
      const res = await search({ "x-agent-key": key });
      expect([res.status, errorCode(res)]).toEqual([401, "INVALID_AGENT_KEY"]);
    }
    const missing = await admin("DELETE", "/agent-keys/k_missing");
    expect([missing.status, errorCode(missing)]).toEqual([404, "AGENT_KEY_NOT_FOUND"]);
  });

  it("can require keys for agent calls, but not for public documents", async () => {
    const { key } = await createKey("required-agent");
    expect((await admin("PUT", "/agent-key-policy", { required: true })).json).toEqual({
      required: true,
    });
    try {
      const keyless = await search();
      expect([keyless.status, errorCode(keyless)]).toEqual([401, "AGENT_KEY_REQUIRED"]);
      const mcp = await http.fetch("/m/m_demo/mcp", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
        },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
      });
      expect(mcp.status).toBe(401);
      expect((await search({ "x-agent-key": key })).status).toBe(200);
      expect((await http.fetch("/m/m_demo/store.md")).status).toBe(200);
      expect((await http.fetch("/m/m_demo/openapi.json")).status).toBe(200);
      expect(AgentKeyList.parse((await admin("GET", "/agent-keys")).json).required).toBe(true);
    } finally {
      await admin("PUT", "/agent-key-policy", { required: false });
    }
    expect((await search()).status).toBe(200);
  });

  it("validates labels and needs the admin token", async () => {
    const bad = await admin("POST", "/agent-keys", { label: "<script>" });
    expect([bad.status, errorCode(bad)]).toEqual([400, "INVALID_INPUT"]);
    const anonymous = await call("POST", "/admin/merchants/m_demo/agent-keys", { label: "x" });
    expect(anonymous.status).toBe(401);
    const unknown = await call(
      "POST",
      "/admin/merchants/m_nope/agent-keys",
      { label: "x" },
      ADMIN_AUTH,
    );
    expect([unknown.status, errorCode(unknown)]).toEqual([404, "MERCHANT_NOT_FOUND"]);
  });
});
