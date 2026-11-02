# Data model

SQLite (WAL). Schema: [`database/migrations/001_init.sql`](../../database/migrations/001_init.sql).
Money is integer minor units; times are ISO-8601 UTC text.

```mermaid
erDiagram
  merchants ||--o{ products : sells
  merchants ||--o{ quotes : issues
  quotes ||--o| orders : "becomes (max 1)"
  orders ||--|{ order_events : "status history"
  merchants ||--o{ telemetry : "agent calls"
```

| Table          | Holds                                                                        | Write rule            |
| -------------- | ---------------------------------------------------------------------------- | --------------------- |
| `merchants`    | name, currency, PayPal payee email, spec, spec status                        | updatable             |
| `products`     | catalog, raw + agent description, firewall status; FTS5 index `products_fts` | updatable (re-upload) |
| `quotes`       | passing quotes only: locked terms, guardrails sent, expiry, hash             | insert-only (trigger) |
| `orders`       | quote ↔ PayPal order, copied hash, approve URL; `quote_id` UNIQUE            | insert-only (trigger) |
| `order_events` | status history; current status = latest row                                  | insert-only (trigger) |
| `telemetry`    | one row per agent call                                                       | insert-only (trigger) |

Why insert-only and hashed: [ADR-0006](../adr/0006-quote-hash-and-insert-only-records.md).
