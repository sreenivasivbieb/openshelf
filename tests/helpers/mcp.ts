import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

/** An MCP client connected to a served app, the way a buyer agent connects. Close it when done. */
export async function connectMcp(
  baseUrl: string,
  merchantId: string,
  headers: Record<string, string> = {},
): Promise<Client> {
  const client = new Client({ name: "openshelf-test-agent", version: "1.0.0" });
  const transport = new StreamableHTTPClientTransport(new URL(`/m/${merchantId}/mcp`, baseUrl), {
    requestInit: { headers },
  });
  await client.connect(transport);
  return client;
}

/** The JSON text block every OpenShelf tool result carries. */
export function resultText(result: unknown): string {
  const [first] = (result as CallToolResult).content;
  if (first?.type !== "text") throw new Error("expected a text content block");
  return first.text;
}
