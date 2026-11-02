# ADR-0009: MCP over Streamable HTTP, stateless; self-declared agent identity

- Status: Accepted
- Date: 2026-11-03

## Context

Buyer agents (MCP Inspector, Claude Desktop) need one URL per merchant. Session state on the server would add failure modes during a live demo.

## Decision

Use the official `@modelcontextprotocol/sdk` with Streamable HTTP in stateless mode at `/m/{id}/mcp`. Tools call the same services as REST. Agent identity in the MVP is self-declared (`clientInfo.name` or `X-Agent-Id`).

## Consequences

- Works with standard MCP clients; nothing to lose on restart.
- Agent ids in telemetry are labels, not proof; scoped hashed API keys are a Should, machine identity is roadmap.
