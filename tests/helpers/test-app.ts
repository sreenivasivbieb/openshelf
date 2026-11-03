import type { Express } from "express";
import { loadEnv } from "../../bootstrap/env";
import { createLogger } from "../../bootstrap/logger";
import { connectDatabase, runMigrations } from "../../bootstrap/database";
import { buildContainer, type Container } from "../../bootstrap/container";
import { createHttpApp } from "../../bootstrap/server";
import { fixedClock, type Clock } from "../../src/shared/clock";
import { AppError } from "../../src/shared/errors";
import type {
  CapturePaymentInput,
  CreatePaymentInput,
  PaymentProvider,
  RefundInput,
} from "../../src/integrations/payments/payment-provider";
import type { LlmClient } from "../../src/integrations/llm/llm-client";

export const TEST_NOW = "2026-11-09T10:00:00.000Z";
export const TEST_ADMIN_TOKEN = "test-admin-token-0123456789";
export const ADMIN_AUTH = { authorization: `Bearer ${TEST_ADMIN_TOKEN}` };

/** In-memory PayPal stand-in: no network, records every call, scriptable outcomes. */
export interface FakePayments extends PaymentProvider {
  created: CreatePaymentInput[];
  captured: CapturePaymentInput[];
  refunded: RefundInput[];
  /** What the next captures do: succeed, get refused by PayPal (FAILED), or throw like an outage. */
  captureOutcome: "COMPLETED" | "FAILED" | "THROW";
  /** Delay before a capture answers, to let tests overlap two captures. */
  captureDelayMs: number;
  /** What the next refunds do: succeed, get refused by PayPal (FAILED), or throw like an outage. */
  refundOutcome: "COMPLETED" | "FAILED" | "THROW";
}

export function fakePayments(): FakePayments {
  const fake: FakePayments = {
    created: [],
    captured: [],
    refunded: [],
    captureOutcome: "COMPLETED",
    captureDelayMs: 0,
    refundOutcome: "COMPLETED",
    async createOrder(input) {
      fake.created.push(input);
      return {
        paypalOrderId: `PP-${input.requestId}`,
        approveUrl: `https://sandbox.paypal.test/checkoutnow?token=PP-${input.requestId}`,
      };
    },
    async captureOrder(input) {
      fake.captured.push(input);
      if (fake.captureDelayMs) await new Promise((r) => setTimeout(r, fake.captureDelayMs));
      if (fake.captureOutcome === "THROW") {
        throw new AppError("PAYMENT_PROVIDER_ERROR", "PayPal could not capture the payment.", 502);
      }
      return fake.captureOutcome === "COMPLETED"
        ? {
            status: "COMPLETED",
            captureId: `CAP-${input.paypalOrderId}`,
            detail: "COMPLETED",
            raw: {},
          }
        : { status: "FAILED", captureId: null, detail: "INSTRUMENT_DECLINED", raw: {} };
    },
    async refundCapture(input) {
      fake.refunded.push(input);
      if (fake.refundOutcome === "THROW") {
        throw new AppError("PAYMENT_PROVIDER_ERROR", "PayPal could not refund the payment.", 502);
      }
      return fake.refundOutcome === "COMPLETED"
        ? { status: "COMPLETED", refundId: `REF-${input.captureId}`, detail: "COMPLETED", raw: {} }
        : { status: "FAILED", refundId: null, detail: "TRANSACTION_REFUSED", raw: {} };
    },
  };
  return fake;
}

/** A clock tests can move forward, e.g. past a quote's expiry. */
export function steppingClock(iso = TEST_NOW): Clock & { advanceMinutes(minutes: number): void } {
  let now = new Date(iso).getTime();
  return {
    now: () => new Date(now),
    advanceMinutes(minutes) {
      now += minutes * 60_000;
    },
  };
}

export interface TestAppOptions {
  clock?: Clock;
  payments?: PaymentProvider;
  llm?: LlmClient | null;
  /** Extra env vars, e.g. { QUOTE_TTL_MINUTES: "1" }. */
  env?: Record<string, string>;
}

/** Same wiring as bootstrap/main.ts, with in-memory SQLite, a fixed clock, fake PayPal and no LLM by default. */
export function buildTestApp(options: TestAppOptions = {}): { app: Express; container: Container } {
  const env = loadEnv({ NODE_ENV: "test", ADMIN_TOKEN: TEST_ADMIN_TOKEN, ...options.env });
  const db = connectDatabase(":memory:");
  runMigrations(db);
  const container = buildContainer({
    env,
    logger: createLogger(env),
    db,
    clock: options.clock ?? fixedClock(TEST_NOW),
    payments: options.payments ?? fakePayments(),
    llm: options.llm ?? null,
  });
  return { app: createHttpApp(container), container };
}
