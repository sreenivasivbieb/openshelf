import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import type { PaymentProvider } from "../../src/integrations/payments/payment-provider";
import { OrderResponse, TrackResponse } from "../../src/schemas/order.schema";
import { QuotePass } from "../../src/schemas/quote.schema";
import { hashQuote } from "../../src/domain/quote-hash";
import { createPaymentProvider } from "../../bootstrap/payments";
import { createLogger } from "../../bootstrap/logger";
import { loadEnv } from "../../bootstrap/env";
import {
  ADMIN_AUTH,
  TEST_NOW,
  buildTestApp,
  fakePayments,
  steppingClock,
} from "../helpers/test-app";
import { serve } from "../helpers/http";
import { SEED_CSV, createStore } from "../helpers/catalog";

const ErrorBody = z.object({ error: z.object({ code: z.string(), message: z.string() }) });

type Http = Awaited<ReturnType<typeof serve>>;
let servers: Http[] = [];
afterEach(async () => {
  await Promise.all(servers.map((s) => s.close()));
  servers = [];
});

async function setup(options: { payments?: PaymentProvider } = {}) {
  const payments = fakePayments();
  const clock = steppingClock();
  const { app, container } = buildTestApp({ clock, payments: options.payments ?? payments });
  await createStore(container, "m_demo");
  const http = await serve(app);
  servers.push(http);

  const call = async (
    method: string,
    path: string,
    body?: unknown,
    headers: Record<string, string> = {},
  ) => {
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
      json = undefined; // HTML page
    }
    return { status: res.status, json, text };
  };
  const errorCode = (res: { json: unknown }) => ErrorBody.parse(res.json).error.code;

  const quote = async (body: Record<string, unknown>, merchant = "m_demo") =>
    QuotePass.parse((await call("POST", `/m/${merchant}/api/quote`, body)).json);
  const order = (quoteId: string) => call("POST", "/m/m_demo/api/order", { quote_id: quoteId });
  const placed = async (quoteId: string) => {
    const res = await order(quoteId);
    expect(res.status).toBe(201);
    return OrderResponse.parse(res.json);
  };
  const track = async (orderId: string) => {
    const res = await call("GET", `/m/m_demo/api/track/${orderId}`);
    expect(res.status).toBe(200);
    return TrackResponse.parse(res.json);
  };
  const paypalReturn = (token: string) =>
    call("GET", `/paypal/return?token=${encodeURIComponent(token)}`);
  const fulfil = (orderId: string, status: string, headers: Record<string, string> = ADMIN_AUTH) =>
    call("POST", `/admin/merchants/m_demo/orders/${orderId}/fulfilment`, { status }, headers);
  const stock = (sku: string) =>
    container.db
      .prepare(`SELECT stock FROM products WHERE merchant_id = 'm_demo' AND sku = ?`)
      .pluck()
      .get(sku);
  const setStock = (sku: string, value: number) =>
    container.db
      .prepare(`UPDATE products SET stock = ? WHERE merchant_id = 'm_demo' AND sku = ?`)
      .run(value, sku);
  const eventDetails = (orderId: string) =>
    container.db
      .prepare(`SELECT status, detail_json FROM order_events WHERE order_id = ? ORDER BY id`)
      .all(orderId) as { status: string; detail_json: string | null }[];
  const statuses = async (orderId: string) => (await track(orderId)).history.map((h) => h.status);

  return {
    container,
    payments,
    clock,
    call,
    errorCode,
    quote,
    order,
    placed,
    track,
    paypalReturn,
    fulfil,
    stock,
    setStock,
    eventDetails,
    statuses,
  };
}

describe("/order (FR-11, NFR-05)", () => {
  it("creates a PayPal order for a passing quote, at the locked price", async () => {
    const s = await setup();
    const q = await s.quote({ sku: "MUG-014", quantity: 2 });
    const o = await s.placed(q.quote_id);
    expect(o).toEqual({
      order_id: expect.stringMatching(/^o_/),
      quote_id: q.quote_id,
      status: "CREATED",
      approve_url: `https://sandbox.paypal.test/checkoutnow?token=PP-${q.quote_id}`,
    });
    expect(s.payments.created).toEqual([
      {
        requestId: q.quote_id,
        quoteId: q.quote_id,
        amountMinor: 7200,
        currency: "USD",
        description: "2 x Hand-glazed ceramic mug",
        payeeEmail: null,
        brandName: "Store m_demo",
        returnUrl: "http://localhost:8787/paypal/return",
        cancelUrl: "http://localhost:8787/paypal/cancel",
      },
    ]);
  });

  it("charges the quoted price even when the catalog price changed since", async () => {
    const s = await setup();
    const q = await s.quote({ sku: "MUG-014" });
    const repriced = SEED_CSV.replace(",Kitchen,36,40,", ",Kitchen,50,40,");
    expect(repriced).not.toBe(SEED_CSV);
    await s.container.services.onboarding.commitCatalog("m_demo", repriced);
    await s.placed(q.quote_id);
    expect(s.payments.created[0]?.amountMinor).toBe(3600);
  });

  it("is idempotent: a replay returns the same order, PayPal is called once", async () => {
    const s = await setup();
    const q = await s.quote({ sku: "MUG-014" });
    const first = await s.placed(q.quote_id);
    const again = await s.placed(q.quote_id);
    expect(again).toEqual(first);
    expect(s.payments.created).toHaveLength(1);

    await s.paypalReturn(`PP-${q.quote_id}`);
    expect((await s.placed(q.quote_id)).status).toBe("CAPTURED");
    expect(s.payments.created).toHaveLength(1);
  });

  it("refuses an expired quote, accepts one about to expire", async () => {
    const s = await setup();
    const stale = await s.quote({ sku: "MUG-014" });
    const fresh = await s.quote({ sku: "MUG-015" });
    s.clock.advanceMinutes(14);
    await s.placed(fresh.quote_id);
    s.clock.advanceMinutes(1); // exactly 15 minutes: expired
    const res = await s.order(stale.quote_id);
    expect([res.status, s.errorCode(res)]).toEqual([409, "QUOTE_EXPIRED"]);
    expect(s.payments.created).toHaveLength(1);
  });

  it("refuses a quote whose stored terms no longer match its hash", async () => {
    const s = await setup();
    const locked = {
      currency: "USD",
      expires_at: "2026-11-09T10:15:00.000Z",
      merchant_id: "m_demo",
      quantity: 1,
      quote_id: "q_tampered",
      return_days: 30,
      shipping_days: 3,
      sku: "MUG-014",
      total_minor: 3600,
      unit_price_minor: 3600,
    };
    // Quotes are insert-only, so a tampered row can only be inserted: the hash covers 36.00, the row says 1.00.
    s.container.db
      .prepare(
        `INSERT INTO quotes (id, merchant_id, sku, quantity, unit_price_minor, total_minor, currency,
          shipping_days, return_days, guardrails_json, created_at, expires_at, quote_hash)
         VALUES ('q_tampered', 'm_demo', 'MUG-014', 1, 100, 100, 'USD', 3, 30, '{}', ?, ?, ?)`,
      )
      .run(TEST_NOW, locked.expires_at, hashQuote(locked));
    const res = await s.order("q_tampered");
    expect([res.status, s.errorCode(res)]).toEqual([409, "QUOTE_HASH_MISMATCH"]);
    expect(s.payments.created).toHaveLength(0);
  });

  it("refuses unknown quotes and quotes from another store", async () => {
    const s = await setup();
    const unknown = await s.order("q_nope");
    expect([unknown.status, s.errorCode(unknown)]).toEqual([404, "QUOTE_NOT_FOUND"]);

    await createStore(s.container, "m_other");
    const foreign = await s.quote({ sku: "MUG-014" }, "m_other");
    const res = await s.order(foreign.quote_id);
    expect([res.status, s.errorCode(res)]).toEqual([404, "QUOTE_NOT_FOUND"]);
  });

  it("refuses when the stock ran out after the quote", async () => {
    const s = await setup();
    const q = await s.quote({ sku: "MUG-015", quantity: 2 });
    s.setStock("MUG-015", 1);
    const res = await s.order(q.quote_id);
    expect([res.status, s.errorCode(res)]).toEqual([409, "OUT_OF_STOCK"]);
    expect(s.payments.created).toHaveLength(0);
  });

  it("answers 503 and stores nothing when PayPal is not configured", async () => {
    const env = loadEnv({ NODE_ENV: "test" });
    const unconfigured = createPaymentProvider(
      env,
      createLogger({ NODE_ENV: "test", LOG_LEVEL: "silent" }),
    );
    const s = await setup({ payments: unconfigured });
    const q = await s.quote({ sku: "MUG-014" });
    const res = await s.order(q.quote_id);
    expect([res.status, s.errorCode(res)]).toEqual([503, "PAYMENT_NOT_CONFIGURED"]);
    expect(s.container.db.prepare(`SELECT COUNT(*) FROM orders`).pluck().get()).toBe(0);
  });
});

describe("PayPal return: capture after the human approves (FR-11, NFR-05)", () => {
  it("captures, reserves the stock and records the capture id", async () => {
    const s = await setup();
    const q = await s.quote({ sku: "MUG-014", quantity: 2 });
    const o = await s.placed(q.quote_id);
    const res = await s.paypalReturn(`PP-${q.quote_id}`);
    expect(res.status).toBe(200);
    expect(res.text).toContain("Payment complete");
    expect(s.stock("MUG-014")).toBe(38);
    expect(s.payments.captured).toEqual([
      { paypalOrderId: `PP-${q.quote_id}`, requestId: o.order_id },
    ]);

    const t = await s.track(o.order_id);
    expect(t).toEqual({
      order_id: o.order_id,
      status: "CAPTURED",
      history: [
        { status: "CREATED", at: TEST_NOW },
        { status: "CAPTURED", at: TEST_NOW },
      ],
    });
    expect(s.eventDetails(o.order_id)[1]?.detail_json).toBe(
      JSON.stringify({ capture_id: `CAP-PP-${q.quote_id}`, capture_status: "COMPLETED" }),
    );
  });

  it("captures once when the return page is hit twice at the same time", async () => {
    const s = await setup();
    const q = await s.quote({ sku: "MUG-014" });
    const o = await s.placed(q.quote_id);
    s.payments.captureDelayMs = 25;
    const [a, b] = await Promise.all([
      s.paypalReturn(`PP-${q.quote_id}`),
      s.paypalReturn(`PP-${q.quote_id}`),
    ]);
    expect([a.status, b.status]).toEqual([200, 200]);
    expect(s.payments.captured).toHaveLength(1);
    expect(s.stock("MUG-014")).toBe(39);
    expect(await s.statuses(o.order_id)).toEqual(["CREATED", "CAPTURED"]);
  });

  it("does not charge again when the buyer reloads the page", async () => {
    const s = await setup();
    const q = await s.quote({ sku: "MUG-014" });
    await s.placed(q.quote_id);
    await s.paypalReturn(`PP-${q.quote_id}`);
    const reload = await s.paypalReturn(`PP-${q.quote_id}`);
    expect(reload.status).toBe(200);
    expect(s.payments.captured).toHaveLength(1);
    expect(s.stock("MUG-014")).toBe(39);
  });

  it("does not capture when the item sold out before payment", async () => {
    const s = await setup();
    const q = await s.quote({ sku: "MUG-014" });
    const o = await s.placed(q.quote_id);
    s.setStock("MUG-014", 0);
    const res = await s.paypalReturn(`PP-${q.quote_id}`);
    expect(res.status).toBe(409);
    expect(res.text).toContain("sold out before payment");
    expect(s.payments.captured).toHaveLength(0);
    expect(s.stock("MUG-014")).toBe(0);
    expect((await s.track(o.order_id)).status).toBe("CAPTURE_FAILED");
    expect(s.eventDetails(o.order_id)[1]?.detail_json).toBe(
      JSON.stringify({ reason: "OUT_OF_STOCK" }),
    );
  });

  it("gives the stock back when PayPal refuses, and lets the buyer retry", async () => {
    const s = await setup();
    const q = await s.quote({ sku: "MUG-014" });
    const o = await s.placed(q.quote_id);

    s.payments.captureOutcome = "FAILED";
    const refused = await s.paypalReturn(`PP-${q.quote_id}`);
    expect(refused.status).toBe(409);
    expect(refused.text).toContain("INSTRUMENT_DECLINED");
    expect(s.stock("MUG-014")).toBe(40);

    s.payments.captureOutcome = "COMPLETED";
    expect((await s.paypalReturn(`PP-${q.quote_id}`)).status).toBe(200);
    expect(s.stock("MUG-014")).toBe(39);
    expect(await s.statuses(o.order_id)).toEqual(["CREATED", "CAPTURE_FAILED", "CAPTURED"]);
    // Both attempts used the order id as PayPal-Request-Id, so PayPal can never charge twice.
    expect(s.payments.captured.map((c) => c.requestId)).toEqual([o.order_id, o.order_id]);
  });

  it("gives the stock back when PayPal is down", async () => {
    const s = await setup();
    const q = await s.quote({ sku: "MUG-014" });
    const o = await s.placed(q.quote_id);
    s.payments.captureOutcome = "THROW";
    const res = await s.paypalReturn(`PP-${q.quote_id}`);
    expect(res.status).toBe(409);
    expect(res.text).toContain("Reload this page");
    expect(s.stock("MUG-014")).toBe(40);
    expect(s.eventDetails(o.order_id)[1]?.detail_json).toBe(
      JSON.stringify({ reason: "PAYMENT_PROVIDER_ERROR" }),
    );
  });

  it("shows a plain page for unknown or broken checkout links, and for cancel", async () => {
    const s = await setup();
    const unknown = await s.paypalReturn("PP-nope");
    expect([unknown.status, unknown.text.includes("Checkout not found")]).toEqual([404, true]);
    const broken = await s.call("GET", "/paypal/return");
    expect([broken.status, broken.text.includes("missing its PayPal checkout id")]).toEqual([
      400,
      true,
    ]);
    const cancel = await s.call("GET", "/paypal/cancel?token=PP-anything");
    expect([cancel.status, cancel.text.includes("Payment cancelled")]).toEqual([200, true]);
  });
});

describe("tracking and simulated fulfilment (FR-12)", () => {
  it("tracks a waiting order with its approve link", async () => {
    const s = await setup();
    const q = await s.quote({ sku: "MUG-014" });
    const o = await s.placed(q.quote_id);
    expect(await s.track(o.order_id)).toEqual({
      order_id: o.order_id,
      status: "CREATED",
      history: [{ status: "CREATED", at: TEST_NOW }],
      approve_url: o.approve_url,
    });
  });

  it("ships and delivers a paid order", async () => {
    const s = await setup();
    const q = await s.quote({ sku: "MUG-014" });
    const o = await s.placed(q.quote_id);
    await s.paypalReturn(`PP-${q.quote_id}`);
    s.clock.advanceMinutes(60);

    const shipped = await s.fulfil(o.order_id, "SHIPPED");
    expect(shipped.status).toBe(200);
    expect(TrackResponse.parse(shipped.json).status).toBe("SHIPPED");
    await s.fulfil(o.order_id, "DELIVERED");
    expect((await s.track(o.order_id)).history).toEqual([
      { status: "CREATED", at: TEST_NOW },
      { status: "CAPTURED", at: TEST_NOW },
      { status: "SHIPPED", at: "2026-11-09T11:00:00.000Z" },
      { status: "DELIVERED", at: "2026-11-09T11:00:00.000Z" },
    ]);
  });

  it("refuses fulfilment out of order, bad input, no token and unknown orders", async () => {
    const s = await setup();
    const q = await s.quote({ sku: "MUG-014" });
    const o = await s.placed(q.quote_id);

    const early = await s.fulfil(o.order_id, "SHIPPED");
    expect([early.status, s.errorCode(early)]).toEqual([409, "INVALID_TRANSITION"]);
    await s.paypalReturn(`PP-${q.quote_id}`);
    const skipped = await s.fulfil(o.order_id, "DELIVERED");
    expect([skipped.status, s.errorCode(skipped)]).toEqual([409, "INVALID_TRANSITION"]);

    const bad = await s.fulfil(o.order_id, "LOST");
    expect([bad.status, s.errorCode(bad)]).toEqual([400, "INVALID_INPUT"]);
    const anonymous = await s.fulfil(o.order_id, "SHIPPED", {});
    expect(anonymous.status).toBe(401);
    const unknown = await s.fulfil("o_nope", "SHIPPED");
    expect([unknown.status, s.errorCode(unknown)]).toEqual([404, "ORDER_NOT_FOUND"]);
  });

  it("answers 404 for unknown orders and stores", async () => {
    const s = await setup();
    const order = await s.call("GET", "/m/m_demo/api/track/o_nope");
    expect([order.status, s.errorCode(order)]).toEqual([404, "ORDER_NOT_FOUND"]);
    const store = await s.call("GET", "/m/m_nope/api/track/o_nope");
    expect([store.status, s.errorCode(store)]).toEqual([404, "MERCHANT_NOT_FOUND"]);
  });
});

describe("telemetry for /order and /track (FR-14, NFR-06)", () => {
  it("writes one row per call, with the order id or the error code", async () => {
    const s = await setup();
    const q = await s.quote({ sku: "MUG-014" });
    const before = s.container.db.prepare(`SELECT MAX(id) FROM telemetry`).pluck().get() as number;

    const o = await s.placed(q.quote_id);
    await s.placed(q.quote_id); // replay
    await s.order("q_nope");
    await s.track(o.order_id);

    const rows = s.container.db
      .prepare(
        `SELECT tool, outcome, order_id, quote_id, error_code FROM telemetry WHERE id > ? ORDER BY id`,
      )
      .all(before);
    expect(rows).toEqual([
      {
        tool: "order",
        outcome: "ok",
        order_id: o.order_id,
        quote_id: q.quote_id,
        error_code: null,
      },
      {
        tool: "order",
        outcome: "ok",
        order_id: o.order_id,
        quote_id: q.quote_id,
        error_code: null,
      },
      {
        tool: "order",
        outcome: "error",
        order_id: null,
        quote_id: null,
        error_code: "QUOTE_NOT_FOUND",
      },
      { tool: "track", outcome: "ok", order_id: o.order_id, quote_id: null, error_code: null },
    ]);
  });
});
