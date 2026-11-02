# MCP tools

Endpoint: `{PUBLIC_BASE_URL}/m/{merchant_id}/mcp` — Streamable HTTP, stateless.
Definitions: `src/api/mcp/tools/`. Input schemas are the same Zod schemas as REST.

| Tool     | Input                                                                                      | Output                                               |
| -------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| `search` | `query`, optional `max_price`, `max_shipping_days`, `min_rating`, `in_stock_only`, `limit` | products                                             |
| `quote`  | `sku`, `quantity`, guardrails                                                              | locked quote or reason codes                         |
| `order`  | `quote_id`                                                                                 | `approve_url` for the human; same quote → same order |
| `track`  | `order_id`                                                                                 | status + history                                     |

Agent identity in telemetry = MCP `clientInfo.name`. Product text is returned as JSON data, never inside
tool descriptions (FR-05).

Try it: `npx @modelcontextprotocol/inspector`, or add the URL to Claude Desktop as a remote MCP server.
