import type { z } from "zod";
import type { Services } from "../../../services";
import type { AgentContext } from "../../../domain/entities";
import type { AgentTool } from "../../../domain/enums";

/** One MCP tool: schema from src/schemas, handler goes through telemetry like REST does. */
export interface ToolDefinition<S extends z.ZodType> {
  name: AgentTool;
  description: string;
  inputSchema: S;
  run(services: Services, ctx: AgentContext, input: z.output<S>): Promise<unknown>;
}

export function defineTool<S extends z.ZodType>(tool: ToolDefinition<S>): ToolDefinition<S> {
  return tool;
}
