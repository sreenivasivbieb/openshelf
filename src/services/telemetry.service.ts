import type { AgentContext } from "../domain/entities";
import type { AgentTool } from "../domain/enums";
import type { TelemetryRepository } from "../repositories/telemetry.repository";
import type { Clock } from "../shared/clock";
import { notImplemented } from "../shared/errors";

export interface TelemetryService {
  /**
   * The single choke point (FR-14, NFR-06): REST controllers and MCP tools call services ONLY through
   * record(), which times the call and writes exactly one row (outcome, reason codes, ids), even on error.
   */
  record<T>(
    ctx: AgentContext,
    tool: AgentTool,
    request: unknown,
    run: () => T | Promise<T>,
  ): Promise<T>;
}

/** Build step 7. */
export function createTelemetryService(_deps: {
  telemetry: TelemetryRepository;
  clock: Clock;
}): TelemetryService {
  return {
    record: async () => notImplemented("step 7"),
  };
}
