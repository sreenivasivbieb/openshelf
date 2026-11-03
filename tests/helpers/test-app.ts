import type { Express } from "express";
import { loadEnv } from "../../bootstrap/env";
import { createLogger } from "../../bootstrap/logger";
import { connectDatabase, runMigrations } from "../../bootstrap/database";
import { buildContainer, type Container } from "../../bootstrap/container";
import { createHttpApp } from "../../bootstrap/server";
import { fixedClock, type Clock } from "../../src/shared/clock";
import type { PaymentProvider } from "../../src/integrations/payments/payment-provider";
import type { LlmClient } from "../../src/integrations/llm/llm-client";

export const TEST_NOW = "2026-11-09T10:00:00.000Z";
export const TEST_ADMIN_TOKEN = "test-admin-token-0123456789";
export const ADMIN_AUTH = { authorization: `Bearer ${TEST_ADMIN_TOKEN}` };

/** In-memory fake: no network. Records calls so tests can assert idempotency. */
export function fakePayments(): PaymentProvider & { created: string[] } {
  const created: string[] = [];
  return {
    created,
    async createOrder(input) {
      created.push(input.quoteId);
      return {
        paypalOrderId: `PP-${input.quoteId}`,
        approveUrl: `https://sandbox.paypal.test/approve/${input.quoteId}`,
      };
    },
    async captureOrder() {
      return { status: "COMPLETED", raw: {} };
    },
  };
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
