# Requirements

IDs are stable: code comments, tests and PRs reference them. Targets are goals, not measured results.

## Functional

| ID    | Requirement                                                                                                      | Acceptance                                        | Tier   |
| ----- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ------ |
| FR-01 | Upload a CSV with name, description, price, stock, shipping_days, return_days, optional rating_avg, review_count | seed CSV accepted                                 | Must   |
| FR-02 | Validate rows, report bad rows with row number, map messy column names                                           | fixture CSV reports row 3 and row 4               | Must   |
| FR-03 | Generate an OpenAPI 3.1 spec per merchant                                                                        | spec passes an OpenAPI validator                  | Must   |
| FR-04 | Rewrite product descriptions for agent search                                                                    | rewritten text stored separately from raw         | Must   |
| FR-05 | Detect and strip hidden instructions; store clean/flagged per product                                            | `CANDLE-3` in seed is flagged                     | Must   |
| FR-06 | Merchant registry; serve each store at `/m/{merchant_id}/...`                                                    | two merchants served side by side                 | Must   |
| FR-07 | `/search`: matching products with price, stock, shipping, returns, rating, review count                          | seed query returns seed products                  | Must   |
| FR-08 | `/quote`: accept buyer guardrails, return pass or fail                                                           | every reason code covered by a test               | Must   |
| FR-09 | On pass: save quote with expiry and SHA-256 of price, SKU and SLA                                                | same input → same hash                            | Must   |
| FR-10 | On fail: structured reason codes + retry hint or nearest passing option                                          | `SHIPPING_TOO_SLOW` suggests `LAMP-003`           | Must   |
| FR-11 | `/order`: PayPal Orders v2, approve link, capture after approval, idempotent                                     | sandbox order captured; replay returns same order | Must   |
| FR-12 | `/track`: order and shipment status                                                                              | history lists every event                         | Must   |
| FR-13 | MCP tools search, quote, order, track on one URL per merchant                                                    | MCP Inspector lists 4 tools                       | Must   |
| FR-14 | Log every call: agent id, query, guardrails, result, reason, time                                                | one row per call                                  | Must   |
| FR-15 | AG Grid views: live feed, quote pass/fail, drop-off by reason, orders + hashes                                   | simulator traffic visible                         | Must   |
| FR-16 | Buyer simulator with several agents, rules and deliberate failures                                               | 6 scenarios meet their expected outcome           | Must   |
| FR-17 | `/return` with PayPal refund                                                                                     | refund visible in sandbox                         | Should |

## Non-functional

| ID     | Area          | Requirement                                                                                                 | How we check                      |
| ------ | ------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------- |
| NFR-01 | Security      | secrets only in env; PayPal sandbox only; input validation on every route; rate limiting; agent keys hashed | review; invalid-input tests       |
| NFR-02 | Determinism   | no LLM call inside `/quote` or `/order`; same input → same output                                           | unit tests; lint rule             |
| NFR-03 | Auditability  | quotes and orders insert-only with SHA-256 hash                                                             | recompute and compare             |
| NFR-04 | Performance   | `/search` < 500 ms on the seed catalog                                                                      | timed test                        |
| NFR-05 | Reliability   | `/order` idempotent; quotes expire (15 min); stock re-checked at capture                                    | replay and expiry tests           |
| NFR-06 | Observability | exactly one telemetry row per agent call                                                                    | row count == simulator call count |
| NFR-07 | Compatibility | works with MCP Inspector and Claude Desktop                                                                 | manual check before each demo     |
| NFR-08 | Demo safety   | fixed seed CSV, fallback spec, recorded backup video                                                        | full rehearsal before Nov 11      |

Where each one is implemented: [../architecture/traceability.md](../architecture/traceability.md).
