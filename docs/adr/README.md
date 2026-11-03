# Architecture decision records

One file per decision. Never edit an accepted ADR's decision; write a new one that says
"Supersedes ADR-xxxx" and mark the old one "Superseded by ADR-yyyy".

| ADR                                                 | Decision                                                  |
| --------------------------------------------------- | --------------------------------------------------------- |
| [0001](0001-one-generic-multi-merchant-server.md)   | One generic multi-merchant server                         |
| [0002](0002-deterministic-money-path.md)            | No LLM on the money path                                  |
| [0003](0003-layered-architecture-with-bootstrap.md) | Layered architecture with a bootstrap composition root    |
| [0004](0004-zod-schemas-single-source-of-truth.md)  | Zod schemas are the single source of the agent contract   |
| [0005](0005-sqlite-with-plain-sql-migrations.md)    | SQLite with plain SQL migrations, no ORM                  |
| [0006](0006-quote-hash-and-insert-only-records.md)  | Quote hash and insert-only records                        |
| [0007](0007-idempotent-orders.md)                   | Idempotent orders                                         |
| [0008](0008-platform-paypal-app-and-payee.md)       | One platform PayPal app; merchants paid as payee          |
| [0009](0009-mcp-streamable-http-stateless.md)       | MCP over Streamable HTTP, stateless                       |
| [0010](0010-runtime-node24-typescript6-tsx.md)      | Node 24 LTS, TypeScript 6, tsx runtime                    |
| [0011](0011-spec-agent-template-plus-llm.md)        | Spec Agent = template + LLM enrichment + validation       |
| [0012](0012-agent-keys.md)                          | Scoped agent keys, hashed, optional or required per store |

## Template

```markdown
# ADR-NNNN: <decision in a few words>

- Status: Proposed | Accepted | Superseded by ADR-NNNN
- Date: YYYY-MM-DD

## Context

What forces this decision; what breaks without it.

## Decision

What we do, concretely.

## Consequences

What becomes easier, what becomes harder, what we accept.
```
