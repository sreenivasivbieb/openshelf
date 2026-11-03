import type { z } from "zod";
import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import type { Services } from "../../../services";
import type { AgentContext } from "../../../domain/entities";
import type { AgentTool } from "../../../domain/enums";

/**
 * One MCP tool (FR-13). Schemas come from src/schemas, so MCP, REST and the OpenAPI spec share one
 * contract (ADR-0004). run() must go through telemetry.record, exactly like the REST controllers (NFR-06).
 * MCP output schemas must be JSON objects, so union responses need an object form (see quote.tool.ts).
 */
export interface ToolDefinition {
  name: AgentTool;
  title: string;
  description: string;
  inputSchema: z.ZodObject;
  outputSchema: z.ZodObject;
  annotations: ToolAnnotations;
  /** `input` has already been validated (defaults applied) against inputSchema by the MCP SDK. */
  run(services: Services, ctx: AgentContext, input: unknown): Promise<unknown>;
}

/** Typed at definition time; erased at the boundary so tools of different shapes fit one list. */
export function defineTool<I extends z.ZodObject>(
  tool: Omit<ToolDefinition, "inputSchema" | "run"> & {
    inputSchema: I;
    run(services: Services, ctx: AgentContext, input: z.output<I>): Promise<unknown>;
  },
): ToolDefinition {
  return { ...tool, run: (services, ctx, input) => tool.run(services, ctx, input as z.output<I>) };
}
