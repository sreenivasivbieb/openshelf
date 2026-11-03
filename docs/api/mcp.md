# MCP tools

Endpoint: `{PUBLIC_BASE_URL}/m/{merchant_id}/mcp`. It speaks Streamable HTTP, is stateless and answers in
plain JSON. Tool definitions live in `src/api/mcp/tools/`; their input and output schemas are the same Zod
schemas the REST API uses (ADR-0004).

| Tool     | Input                                                                                      | Output (`structuredContent`)                                                                                            | Hints                           |
| -------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| `search` | `query`, optional `max_price`, `max_shipping_days`, `min_rating`, `in_stock_only`, `limit` | `{ results: Product[] }`                                                                                                | read-only                       |
| `quote`  | `sku`, `quantity` (default 1), optional guardrails                                         | pass: locked quote + `quote_hash` + `locked_terms`; fail: `reason_codes`, `actual`, `retry_hint`, `nearest_passing_sku` | not read-only, not idempotent   |
| `order`  | `quote_id`                                                                                 | `{ order_id, quote_id, status, approve_url }`; the same quote always gives the same order                               | idempotent, open world (PayPal) |
| `track`  | `order_id`                                                                                 | `{ order_id, status, history[] }`                                                                                       | read-only                       |

Shapes and codes are the same as the REST API: [rest.md](rest.md), [errors.md](errors.md). On
`initialize` the server returns its name (`openshelf-<merchant_id>`), its version, and instructions
describing the buying flow. The instructions contain no merchant-written text.

## Results and errors

- **Success.** The result carries `structuredContent`, validated against the tool's output schema, and
  the same JSON as a text block for clients that only read text.
- **Service error.** Examples: `QUOTE_NOT_FOUND`, `QUOTE_EXPIRED`, `NOT_IMPLEMENTED`. The result has
  `isError: true` and one text block `{"error":{"code","message"}}`. It has no `structuredContent`,
  because clients validate that against the output schema even on errors. Unexpected failures appear as
  `INTERNAL` and are logged on the server.
- **Bad arguments.** The MCP SDK checks arguments against the input schema before any OpenShelf code
  runs, and returns an `isError` result that begins `Input validation error`.
- `quote` returns a union (pass or fail). MCP output schemas must be objects, so the published output
  schema is the object form `QuoteToolOutput`: `status` plus every field of both shapes, optional.

## Telemetry and agent identity

- Every tool call that reaches OpenShelf code writes exactly one telemetry row with `channel = "mcp"`
  (NFR-06). Calls rejected by the SDK's argument check are not logged, and neither are protocol messages
  (`initialize`, `tools/list`).
- **Agent identity is self-declared** (ADR-0009). It comes from the `X-Agent-Id` header, else from
  `User-Agent` (first 100 characters). Because the server is stateless, the `clientInfo` a client sends
  with `initialize` is not available to its later requests.
- `X-Simulated: 1` marks simulator traffic.

## HTTP behaviour

| Request               | Answer                                                                |
| --------------------- | --------------------------------------------------------------------- |
| `POST` (JSON-RPC)     | MCP response as JSON                                                  |
| `GET`, `DELETE`       | `405`, `Allow: POST`; no SSE stream and no sessions in stateless mode |
| unknown `merchant_id` | `404 {"error":{"code":"MERCHANT_NOT_FOUND"}}`, before any MCP work    |
| over the rate limit   | `429 RATE_LIMITED` (shared 120/min per IP with the REST API)          |

## Connect a client

**MCP Inspector**

```bash
npx @modelcontextprotocol/inspector
# Transport: Streamable HTTP, URL: http://localhost:8787/m/m_demo/mcp
```

**Claude Desktop**

`claude_desktop_config.json` starts local (stdio) servers. Bridge to the HTTP endpoint with `mcp-remote`,
then restart Claude Desktop:

```json
{
  "mcpServers": {
    "openshelf-demo": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "http://localhost:8787/m/m_demo/mcp",
        "--header",
        "X-Agent-Id:claude-desktop"
      ]
    }
  }
}
```

**claude.ai custom connectors and other hosted agents**

These connect from the internet, so they need a public HTTPS URL, for example a tunnel
(`cloudflared tunnel --url http://localhost:8787`) or the Render deploy. Set `PUBLIC_BASE_URL` to that
URL so links in responses (`approve_url`, the OpenAPI URL) point to it.

**Code**

```ts
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const client = new Client({ name: "my-agent", version: "1.0.0" });
await client.connect(
  new StreamableHTTPClientTransport(new URL("http://localhost:8787/m/m_demo/mcp"), {
    requestInit: { headers: { "X-Agent-Id": "my-agent" } },
  }),
);
const quote = await client.callTool({
  name: "quote",
  arguments: { sku: "MUG-014", max_budget: 40 },
});
```
