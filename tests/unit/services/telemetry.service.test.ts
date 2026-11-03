import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import { createTelemetryService } from "../../../src/services/telemetry.service";
import type { TelemetryRepository } from "../../../src/repositories/telemetry.repository";
import type { AgentContext, TelemetryEvent } from "../../../src/domain/entities";
import { fixedClock } from "../../../src/shared/clock";
import { AppError } from "../../../src/shared/errors";

function setup() {
  const rows: TelemetryEvent[] = [];
  const repo = { insert: (e: TelemetryEvent) => rows.push(e) } as unknown as TelemetryRepository;
  const telemetry = createTelemetryService({
    telemetry: repo,
    clock: fixedClock("2026-11-09T10:00:00Z"),
  });
  const ctx: AgentContext = {
    merchantId: "m_1",
    agentId: "agent-a",
    channel: "mcp",
    isSimulated: true,
    agentVerified: false,
  };
  return { rows, telemetry, ctx };
}

describe("telemetry.record (FR-14, NFR-06)", () => {
  it("records a passing quote with its id", async () => {
    const { rows, telemetry, ctx } = setup();
    const result = await telemetry.record(ctx, "quote", { sku: "A" }, () => ({
      status: "pass",
      quote_id: "q_1",
    }));
    expect(result).toEqual({ status: "pass", quote_id: "q_1" });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      merchantId: "m_1",
      agentId: "agent-a",
      channel: "mcp",
      tool: "quote",
      request: { sku: "A" },
      outcome: "pass",
      quoteId: "q_1",
      reasonCodes: null,
      errorCode: null,
      isSimulated: true,
      createdAt: "2026-11-09T10:00:00.000Z",
    });
  });

  it("records a failing quote with its reason codes", async () => {
    const { rows, telemetry, ctx } = setup();
    await telemetry.record(ctx, "quote", {}, () => ({
      status: "fail",
      reason_codes: ["OVER_BUDGET", "SHIPPING_TOO_SLOW"],
    }));
    expect(rows[0]).toMatchObject({
      outcome: "fail",
      reasonCodes: ["OVER_BUDGET", "SHIPPING_TOO_SLOW"],
    });
  });

  it("records the order id of an order", async () => {
    const { rows, telemetry, ctx } = setup();
    await telemetry.record(ctx, "order", {}, async () => ({
      order_id: "o_1",
      quote_id: "q_1",
      status: "CREATED",
    }));
    expect(rows[0]).toMatchObject({ outcome: "ok", orderId: "o_1", quoteId: "q_1" });
  });

  it.each([
    [new AppError("MERCHANT_NOT_FOUND", "no store", 404), "MERCHANT_NOT_FOUND"],
    [new ZodError([]), "INVALID_INPUT"],
    [new Error("boom"), "INTERNAL"],
  ])("records one error row and rethrows (%s)", async (error, code) => {
    const { rows, telemetry, ctx } = setup();
    await expect(
      telemetry.record(ctx, "search", {}, () => {
        throw error;
      }),
    ).rejects.toBe(error);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ outcome: "error", errorCode: code });
  });
});
