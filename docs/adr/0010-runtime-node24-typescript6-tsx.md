# ADR-0010: Node 24 LTS, TypeScript 6, tsx runtime

- Status: Accepted
- Date: 2026-11-03

## Context

The blueprint said Node 20.9+. Node 20 reached end of life in April 2026. TypeScript 7 (native) is out, but typescript-eslint supports only < 6.1.

## Decision

Target Node 24 LTS (`.nvmrc`, Docker `node:24-slim`). Pin TypeScript ~6.0. Run the server with tsx in dev and production (no compile step); `tsc --noEmit` only type-checks.

## Consequences

- Dev and production run the same code path.
- Revisit TypeScript 7 when typescript-eslint supports it.
