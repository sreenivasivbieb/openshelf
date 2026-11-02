# ADR-0001: One generic multi-merchant server

- Status: Accepted
- Date: 2026-11-03

## Context

The blueprint says merchants get a "generated store". Generating code or a deployment per merchant would multiply failure points before a 10-day deadline.

## Decision

One server hosts every store. Generating a store means saving catalog rows, config and spec, and returning `/m/{merchant_id}/mcp`. Every route and query is scoped by `merchant_id`.

## Consequences

- A new merchant is a new set of rows, not a deploy; fixes land once.
- The demo can show several stores side by side.
- Tenant isolation depends on every repository query filtering by `merchant_id`; integration tests use two merchants.
