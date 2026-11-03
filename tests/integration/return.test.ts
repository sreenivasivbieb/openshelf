import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { OrderResponse, ReturnResponse } from "../../src/schemas/order.schema";
import { QuotePass } from "../../src/schemas/quote.schema";
import { ADMIN_AUTH, buildTestApp, fakePayments, steppingClock } from "../helpers/test-app";
import { serve } from "../helpers/http";
import { createStore } from "../helpers/catalog";
import { connectMcp, resultText } from "../helpers/mcp";

const ErrorBody = z.object({ error: z.object({ code: z.string(), message: z.string() }) });
const DAY_MINUTES = 24 * 60;

type Http = Awaited<ReturnType<typeof serve>>;
let servers: Http[] = [];
afterEach(async () => {
  await Promise.all(servers.map((s) => s.close()));
  servers = [];
});

async function setup() {
  const payments = fakePayments();
  const clock = steppingClock();
  const { app, container } = buildTestApp({ clock, payments });
  await createStore(container, "m_demo");
  const http = await serve(app);
  servers.push(http);

  const call = async (method: string, path: string, body?: unknown, headers = {}) => {
    const res = await http.fetch(path, {
      method,
      headers: {
        ...(body === undefined ? {} : { "content-type": "application/json" }),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      json = undefined;
    }
    return { status: res.status, json };
  };
  const errorCode = (res: { json: unknown }) => ErrorBody.parse(res.json).error.code;
  const stock = (sku: string) =>
    container.db
      .prepare(`SELECT stock FROM products WHERE merchant_id = 'm_demo' AND sku = ?`)
      .pluck()
      .get(sku) as number;

  /** quote -> order -> (optionally) the human approves in PayPal and the order is captured. */
  const buy = async (sku: string, options: { pay?: boolean } = {}) => {
    const quote = QuotePass.parse((await call("POST", "/m/m_demo/api/quote", { sku })).json);
    const placed = await call("POST", "/m/m_demo/api/order", { quote_id: quote.quote_id });
    const order = OrderResponse.parse(placed.json);
    if (options.pay ?? true) {
      await call("GET", `/paypal/return?token=${encodeURIComponent(`PP-${quote.quote_id}`)}`);
    }
    return order;
  };
  const fulfil = (orderId: string, status: "SHIPPED" | "DELIVERED") =>
    call("POST", `/admin/merchants/m_demo/orders/${orderId}/fulfilment`, { status }, ADMIN_AUTH);
  const requestReturn = (orderId: string, reason?: string) =>
    call("POST", "/m/m_demo/api/return", { order_id: orderId, ...(reason ? { reason } : {}) });

  return { http, container, payments, clock, call, errorCode, stock, buy, fulfil, requestReturn };
}

describe("/return (FR-17)", () => {
  it("refunds the locked total, restores stock and records the history", async () => {
    const t = await setup();
    const before = t.stock("MUG-014");
    const order = await t.buy("MUG-014");
    expect(t.stock("MUG-014")).toBe(before - 1);

    const res = await t.requestReturn(order.order_id, "Wrong colour");
    expect(res.status).toBe(200);
    const body = ReturnResponse.parse(res.json);
    expect(body).toMatchObject({
      order_id: order.order_id,
      status: "REFUNDED",
      refund_id: `REF-CAP-PP-${order.quote_id}`,
      refunded: 36,
      currency: "USD",
    });
    expect(body.history.map((h) => h.status)).toEqual([
      "CREATED",
      "CAPTURED",
      "RETURN_REQUESTED",
      "REFUNDED",
    ]);
    expect(t.payments.refunded).toEqual([
      {
        captureId: `CAP-PP-${order.quote_id}`,
        amountMinor: 3600,
        currency: "USD",
        requestId: `refund-${order.order_id}`,
      },
    ]);
    expect(t.stock("MUG-014")).toBe(before);

    const reason = t.container.db
      .prepare(
        `SELECT detail_json FROM order_events WHERE order_id = ? AND status = 'RETURN_REQUESTED'`,
      )
      .pluck()
      .get(order.order_id);
    expect(JSON.parse(reason as string)).toEqual({ reason: "Wrong colour" });
  });

  it("is idempotent: a repeat answers the refunded state without a second refund", async () => {
    const t = await setup();
    const order = await t.buy("MUG-014");
    const first = await t.requestReturn(order.order_id);
    const again = await t.requestReturn(order.order_id);
    expect(again.status).toBe(200);
    expect(again.json).toEqual(first.json);
    expect(t.payments.refunded).toHaveLength(1);
  });

  it("allows a return within return_days of delivery and refuses it after", async () => {
    const t = await setup();
    const inWindow = await t.buy("MUG-014");
    await t.fulfil(inWindow.order_id, "SHIPPED");
    await t.fulfil(inWindow.order_id, "DELIVERED");
    const late = await t.buy("MUG-014");
    await t.fulfil(late.order_id, "SHIPPED");
    await t.fulfil(late.order_id, "DELIVERED");

    t.clock.advanceMinutes(30 * DAY_MINUTES); // exactly at the end of MUG-014's 30-day window
    expect((await t.requestReturn(inWindow.order_id)).status).toBe(200);

    t.clock.advanceMinutes(1);
    const res = await t.requestReturn(late.order_id);
    expect(res.status).toBe(409);
    expect(t.errorCode(res)).toBe("RETURN_WINDOW_CLOSED");
  });

  it("refuses orders that are not paid, and products sold without returns", async () => {
    const t = await setup();
    const unpaid = await t.buy("MUG-014", { pay: false });
    const res = await t.requestReturn(unpaid.order_id);
    expect(res.status).toBe(409);
    expect(t.errorCode(res)).toBe("NOT_RETURNABLE");

    const noReturns = await t.buy("TEA-020"); // return_days 0 in the seed catalog
    const tea = await t.requestReturn(noReturns.order_id);
    expect([tea.status, t.errorCode(tea)]).toEqual([409, "NOT_RETURNABLE"]);
    expect(t.payments.refunded).toHaveLength(0);
  });

  it("keeps the return open when PayPal fails, and a retry completes it", async () => {
    const t = await setup();
    const order = await t.buy("MUG-014");
    const stockAfterSale = t.stock("MUG-014");

    for (const outcome of ["FAILED", "THROW"] as const) {
      t.payments.refundOutcome = outcome;
      const res = await t.requestReturn(order.order_id);
      expect([res.status, t.errorCode(res)]).toEqual([502, "PAYMENT_PROVIDER_ERROR"]);
    }
    expect(t.stock("MUG-014")).toBe(stockAfterSale);

    t.payments.refundOutcome = "COMPLETED";
    const retried = ReturnResponse.parse((await t.requestReturn(order.order_id)).json);
    expect(retried.status).toBe("REFUNDED");
    expect(retried.history.map((h) => h.status)).toEqual([
      "CREATED",
      "CAPTURED",
      "RETURN_REQUESTED",
      "REFUNDED",
    ]);
    // Every attempt used the same PayPal request id, so PayPal can never refund twice.
    expect(new Set(t.payments.refunded.map((r) => r.requestId))).toEqual(
      new Set([`refund-${order.order_id}`]),
    );
    expect(t.stock("MUG-014")).toBe(stockAfterSale + 1);
  });

  it("answers 404 for an unknown order and logs one telemetry row per call", async () => {
    const t = await setup();
    const res = await t.requestReturn("o_unknown");
    expect([res.status, t.errorCode(res)]).toEqual([404, "ORDER_NOT_FOUND"]);
    const row = t.container.db
      .prepare(`SELECT tool, outcome, error_code FROM telemetry ORDER BY id DESC LIMIT 1`)
      .get();
    expect(row).toEqual({ tool: "return", outcome: "error", error_code: "ORDER_NOT_FOUND" });
  });

  it("works as the MCP return tool", async () => {
    const t = await setup();
    const order = await t.buy("MUG-014");
    const agent = await connectMcp(t.http.url, "m_demo", { "x-agent-id": "mcp-buyer" });
    try {
      const result = await agent.callTool({
        name: "return",
        arguments: { order_id: order.order_id },
      });
      expect(result.isError).toBeFalsy();
      expect(ReturnResponse.parse(result.structuredContent).status).toBe("REFUNDED");
      expect(JSON.parse(resultText(result))).toEqual(result.structuredContent);
    } finally {
      await agent.close();
    }
    const row = t.container.db
      .prepare(`SELECT channel, tool, outcome, order_id FROM telemetry ORDER BY id DESC LIMIT 1`)
      .get();
    expect(row).toEqual({
      channel: "mcp",
      tool: "return",
      outcome: "ok",
      order_id: order.order_id,
    });
  });
});
