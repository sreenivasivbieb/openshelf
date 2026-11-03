import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ADMIN_AUTH, buildTestApp, TEST_NOW } from "../helpers/test-app";
import { serve } from "../helpers/http";

let http: Awaited<ReturnType<typeof serve>>;

beforeAll(async () => {
  http = await serve(buildTestApp().app);
});
afterAll(() => http.close());

const postJson = (path: string, body: string) =>
  http.fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body });

describe("http skeleton", () => {
  it("serves /health with the injected clock", async () => {
    const res = await http.fetch("/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, time: TEST_NOW });
    expect(res.headers.get("x-request-id")).toBeTruthy();
  });

  it("protects /admin with the admin token", async () => {
    const res = await http.fetch("/admin/merchants/m_1");
    expect(res.status).toBe(401);
  });

  it("validates agent input before any service runs", async () => {
    const res = await postJson("/m/m_1/api/quote", JSON.stringify({ sku: "", max_budget: -5 }));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("INVALID_INPUT");
  });

  it("answers 400, not 500, for malformed JSON", async () => {
    const res = await postJson("/m/m_1/api/quote", "{not json");
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string } };
    expect(body.error.code).toBe("INVALID_JSON");
  });

  it("answers 501 for routes that are not built yet", async () => {
    const res = await http.fetch("/admin/merchants/m_1/telemetry", { headers: ADMIN_AUTH }); // step 8
    expect(res.status).toBe(501);
  });
});
