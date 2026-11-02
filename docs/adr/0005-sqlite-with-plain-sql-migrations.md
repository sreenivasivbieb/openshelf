# ADR-0005: SQLite with plain SQL migrations, no ORM

- Status: Accepted
- Date: 2026-11-03

## Context

We need full-text search, insert-only enforcement and simple transactions on a laptop demo with a backup deploy.

## Decision

SQLite through better-sqlite3 (WAL mode). Schema changes are numbered `.sql` files in `database/migrations`, applied by `bootstrap/database.ts`. SQL lives only in `src/repositories`.

## Consequences

- FTS5 search and insert-only triggers are native SQL; no ORM workarounds.
- Synchronous transactions make stock re-check at capture simple.
- One writer process; fine for the hackathon, not for horizontal scale.
