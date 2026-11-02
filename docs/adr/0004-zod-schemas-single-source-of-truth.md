# ADR-0004: Zod schemas are the single source of the agent contract

- Status: Accepted
- Date: 2026-11-03

## Context

The same contract appears in REST validation, MCP tool input schemas, the OpenAPI spec, the dashboard and the simulator. Hand-maintained copies drift.

## Decision

Request/response shapes live once in `src/schemas/` (Zod). REST controllers and MCP tools parse with them; the OpenAPI spec is generated from them (zod-to-openapi); the simulator and dashboard import their types.

## Consequences

- Changing a field changes every surface together.
- The spec cannot claim something the code does not validate.
- Zod 4 is a hard dependency of the contract.
