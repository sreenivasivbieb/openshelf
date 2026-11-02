import type { Express } from "express";
import { loadEnv } from "../../bootstrap/env";
import { createLogger } from "../../bootstrap/logger";
import { connectDatabase, runMigrations } from "../../bootstrap/database";
import { buildContainer, type Container } from "../../bootstrap/container";
import { createHttpApp } from "../../bootstrap/server";
import { fixedClock } from "../../src/shared/clock";
import type { PaymentProvider } from "../../src/integrations/payments/payment-provider";

export const TEST_NOW = "2026-11-09T10:00:00.000Z";

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

/** Same wiring as bootstrap/main.ts, with in-memory SQLite, a fixed clock, fake PayPal and no LLM. */
export function buildTestApp(): { app: Express; container: Container } {
  const env = loadEnv({ NODE_ENV: "test" });
  const db = connectDatabase(":memory:");
  runMigrations(db);
  const container = buildContainer({
    env,
    logger: createLogger(env),
    db,
    clock: fixedClock(TEST_NOW),
    payments: fakePayments(),
    llm: null,
  });
  return { app: createHttpApp(container), container };
}
