import { searchTool } from "./search.tool";
import { quoteTool } from "./quote.tool";
import { orderTool } from "./order.tool";
import { trackTool } from "./track.tool";

/** Every tool a buyer agent can call (FR-13). */
export const AGENT_TOOLS = [searchTool, quoteTool, orderTool, trackTool] as const;
