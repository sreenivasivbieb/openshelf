import type { RequestHandler } from "express";
import type { Services } from "../../services";
import { notImplemented } from "../../shared/errors";

/**
 * FR-13, NFR-07. Build step 6.
 * @modelcontextprotocol/sdk McpServer + Streamable HTTP transport, stateless (ADR-0009).
 * Per request: build a server, register AGENT_TOOLS (./tools) with ctx.channel = "mcp" and
 * agentId = clientInfo.name, then let the transport handle req/res.
 */
export function createMcpHandler(_services: Services): RequestHandler {
  return () => notImplemented("step 6");
}
