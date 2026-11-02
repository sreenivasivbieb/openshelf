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

/** Table: telemetry. Build steps 7-8. */
export function createTelemetryRepository(_db: Db): TelemetryRepository {
  return {
    insert: () => notImplemented("step 7"),
    listAfter: () => notImplemented("step 8"),
    failuresByReason: () => notImplemented("step 8"),
    countQuotes: () => notImplemented("step 8"),
  };
}
