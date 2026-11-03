import { ZodError } from "zod";
import type { AgentContext, TelemetryEvent } from "../domain/entities";
import type { AgentTool, QuoteReasonCode } from "../domain/enums";
import type { TelemetryRepository } from "../repositories/telemetry.repository";
import type { Clock } from "../shared/clock";
import { AppError } from "../shared/errors";

export interface TelemetryService {
  /**
   * The single choke point (FR-14, NFR-06): REST controllers and MCP tools call services ONLY through
   * record(), which times the call and writes exactly one row, also when the call throws.
   * Input validation runs inside `run`, so malformed agent calls are recorded too.
   */
  record<T>(
    ctx: AgentContext,
    tool: AgentTool,
    request: unknown,
    run: () => T | Promise<T>,
  ): Promise<T>;
}

type Outcome = Pick<
  TelemetryEvent,
  "outcome" | "errorCode" | "reasonCodes" | "quoteId" | "orderId"
>;

function errorCodeOf(err: unknown): string {
  if (err instanceof AppError) return err.code;
  if (err instanceof ZodError) return "INVALID_INPUT";
  return "INTERNAL";
}

const text = (value: unknown) => (typeof value === "string" ? value : null);

/** Reads the outcome off the contract shapes (QuoteResponse, OrderResponse, TrackResponse). */
function outcomeOf(tool: AgentTool, result: unknown): Outcome {
  const r = (typeof result === "object" && result !== null ? result : {}) as Record<
    string,
    unknown
  >;
  const ids = { quoteId: text(r.quote_id), orderId: text(r.order_id) };
  if (tool === "quote" && r.status === "pass")
    return { outcome: "pass", errorCode: null, reasonCodes: null, ...ids };
  if (tool === "quote" && r.status === "fail") {
    return {
      outcome: "fail",
      errorCode: null,
      reasonCodes: (r.reason_codes as QuoteReasonCode[]) ?? [],
      ...ids,
    };
  }
  return { outcome: "ok", errorCode: null, reasonCodes: null, ...ids };
}

export function createTelemetryService(deps: {
  telemetry: TelemetryRepository;
  clock: Clock;
}): TelemetryService {
  return {
    async record(ctx, tool, request, run) {
      const started = performance.now();
      const write = (outcome: Outcome) =>
        deps.telemetry.insert({
          merchantId: ctx.merchantId,
          agentId: ctx.agentId,
          channel: ctx.channel,
          tool,
          request,
          isSimulated: ctx.isSimulated,
          agentVerified: ctx.agentVerified,
          latencyMs: Math.round(performance.now() - started),
          createdAt: deps.clock.now().toISOString(),
          ...outcome,
        });

      let result: Awaited<ReturnType<typeof run>>;
      try {
        result = await run();
      } catch (err) {
        write({
          outcome: "error",
          errorCode: errorCodeOf(err),
          reasonCodes: null,
          quoteId: null,
          orderId: null,
        });
        throw err;
      }
      write(outcomeOf(tool, result));
      return result;
    },
  };
}
