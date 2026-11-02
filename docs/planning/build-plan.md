# Build plan

Feature freeze **Nov 9**. Nov 10–12: APIMatic, demo video, submission. No spare day: cut scope before
Nov 9, not after. Order = risk order (external services early, deterministic core before the LLM).

| Day         | Step                                                               | Done when                                                                |
| ----------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| Nov 3 (Mon) | 1 DB repositories + seed · 2 CSV ingestion · 3 `/search`           | seed loads; fixture rows 3 and 4 reported; search returns seed products  |
| Nov 4 (Tue) | 4 guardrails + quote hash + quote service                          | all reason codes tested; same input → same hash; expiry with fixed clock |
| Nov 5 (Wed) | 5 PayPal create → approve → capture; `/order` idempotent; `/track` | sandbox order captured; replay returns same order                        |
| Nov 6 (Thu) | 6 MCP handler · 7 telemetry                                        | Inspector lists tools; Claude Desktop places an order; one row per call  |
| Nov 7 (Fri) | 8 dashboard + simulator                                            | live feed and drop-off grid show simulator traffic                       |
| Nov 8 (Sat) | 9 Spec Agent + firewall                                            | valid spec from seed CSV; `CANDLE-3` flagged                             |
| Nov 9 (Sun) | hardening, NFR tests, rehearsal 1, **freeze**                      | every NFR row in requirements.md checked                                 |
| Nov 10      | 10 APIMatic SDK + portal; Render deploy                            | a call through the generated SDK succeeds                                |
| Nov 11      | full rehearsal; record backup video                                | runbook passes end to end                                                |
| Nov 12      | submit                                                             | before the confirmed deadline                                            |

**Cut order if late:** Should items (`/return`, UCP profile, counter-offers, scoped keys, AG Studio chat) →
LLM description rewrite → LLM firewall check (rules stay). **Never cut:** quote hash, idempotent order,
telemetry, simulator.
