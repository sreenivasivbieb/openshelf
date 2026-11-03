import type { ToolDefinition } from "./tool";
import { searchTool } from "./search.tool";
import { quoteTool } from "./quote.tool";
import { orderTool } from "./order.tool";
import { trackTool } from "./track.tool";
import { returnTool } from "./return.tool";

/** Every tool a buyer agent can call (FR-13, FR-17), in the order of the buying flow. */
export const AGENT_TOOLS: readonly ToolDefinition[] = [
  searchTool,
  quoteTool,
  orderTool,
  trackTool,
  returnTool,
];
