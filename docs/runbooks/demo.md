# Runbook: live demo

## Day-of checklist

- [ ] `pnpm typecheck && pnpm lint && pnpm test` green
- [ ] Fresh DB: `rm -f storage/openshelf.db* && pnpm db:migrate && pnpm db:seed`
- [ ] PayPal sandbox: one order end to end; write its order id here: `________`
- [ ] MCP Inspector (`npx @modelcontextprotocol/inspector`, Streamable HTTP,
      `http://localhost:8787/m/m_demo/mcp`) lists 4 tools
- [ ] Claude Desktop: `claude_desktop_config.json` bridges to the endpoint with
      `npx -y mcp-remote http://localhost:8787/m/m_demo/mcp --header X-Agent-Id:claude-desktop` (snippet in
      [docs/api/mcp.md](../api/mcp.md)); restart Desktop and check the 4 tools appear
- [ ] claude.ai connector only through a public HTTPS URL (tunnel or Render), with `PUBLIC_BASE_URL` set to it
- [ ] Render backup `/health` green; tunnel command ready
- [ ] Backup video on the desktop

## Flow (≈5 min)

1. Upload `database/seeds/demo-merchant.csv` → mapping review → store ready (MCP URL); `CANDLE-3` flagged.
2. `pnpm simulate` → dashboard fills: passes, `OVER_BUDGET`, `SHIPPING_TOO_SLOW`, drop-off by reason (labelled simulated).
3. Claude Desktop: "buy a ceramic mug under $40 that ships within 4 days" → quote → approve in PayPal → captured.
4. Orders grid: quote hash + "hash verified".

## If something breaks

| Symptom             | Do                                                             |
| ------------------- | -------------------------------------------------------------- |
| PayPal sandbox slow | show the pre-created order; play the capture part of the video |
| LLM down / no key   | continue: template spec + rules-only firewall are automatic    |
| Laptop or network   | switch to the Render URL or the tunnel                         |
| Anything else       | backup video                                                   |
