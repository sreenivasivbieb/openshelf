import type { Db } from "./db";
import type { TelemetryEvent } from "../domain/entities";
import type { QuoteReasonCode } from "../domain/enums";
import { notImplemented } from "../shared/errors";

export interface TelemetryRow extends TelemetryEvent {
  id: number;
}

/** Insert-only (NFR-03, NFR-06). */
export interface TelemetryRepository {
  insert(event: TelemetryEvent): number;
  listAfter(merchantId: string, afterId: number, limit: number): TelemetryRow[];
  failuresByReason(merchantId: string): { reason: QuoteReasonCode; count: number }[];
  countQuotes(merchantId: string): { pass: number; fail: number };
}

const MAX_REQUEST_JSON = 4000;

/** Always valid JSON, bounded in size: oversized requests keep a truncated preview. */
function requestJson(request: unknown): string {
  let json: string;
  try {
    json = JSON.stringify(request) ?? "null";
  } catch {
    json = JSON.stringify("<unserializable request>");
  }
  return json.length <= MAX_REQUEST_JSON
    ? json
    : JSON.stringify({ truncated: true, preview: json.slice(0, MAX_REQUEST_JSON) });
}

/** Table: telemetry. */
export function createTelemetryRepository(db: Db): TelemetryRepository {
  const insert = db.prepare(
    `INSERT INTO telemetry (merchant_id, agent_id, channel, tool, request_json, outcome, error_code,
       reason_codes, quote_id, order_id, latency_ms, is_simulated, agent_verified, created_at)
     VALUES (@merchantId, @agentId, @channel, @tool, @requestJson, @outcome, @errorCode,
       @reasonCodes, @quoteId, @orderId, @latencyMs, @isSimulated, @agentVerified, @createdAt)`,
  );

  return {
    insert: (e) =>
      Number(
        insert.run({
          merchantId: e.merchantId,
          agentId: e.agentId,
          channel: e.channel,
          tool: e.tool,
          requestJson: requestJson(e.request),
          outcome: e.outcome,
          errorCode: e.errorCode,
          reasonCodes: e.reasonCodes ? JSON.stringify(e.reasonCodes) : null,
          quoteId: e.quoteId,
          orderId: e.orderId,
          latencyMs: e.latencyMs,
          isSimulated: e.isSimulated ? 1 : 0,
          agentVerified: e.agentVerified ? 1 : 0,
          createdAt: e.createdAt,
        }).lastInsertRowid,
      ),
    listAfter: () => notImplemented("step 8"),
    failuresByReason: () => notImplemented("step 8"),
    countQuotes: () => notImplemented("step 8"),
  };
}
