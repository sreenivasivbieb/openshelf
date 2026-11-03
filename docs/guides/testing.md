# Testing

| Kind        | Folder                                  | Covers                                                                                                        | Rules                                                            |
| ----------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Unit        | `tests/unit/` (mirrors `src/`)          | `src/domain`, pure helpers (`repositories/fts.ts`), I/O-free services (ingestion; telemetry with a fake repo) | no DB, no network, no real clock                                 |
| Integration | `tests/integration/`                    | HTTP routes + SQLite through the real container                                                               | `buildTestApp()`: in-memory DB, fixed clock, fake PayPal, no LLM |
| End to end  | `tools/simulator`                       | a running server over MCP                                                                                     | each scenario declares its expected outcome                      |
| Manual      | [runbooks/demo.md](../runbooks/demo.md) | MCP Inspector, Claude Desktop, PayPal sandbox                                                                 | before every demo                                                |

Helpers: `tests/helpers/test-app.ts` (container, `ADMIN_AUTH`), `tests/helpers/http.ts` (random-port server),
`tests/helpers/catalog.ts` (`createStore()`, seed and messy CSVs).
Fixtures: `tests/fixtures/` (e.g. `catalog-messy-headers.csv` has a missing name on row 3 and a negative
price + non-numeric shipping on row 4).

Must-have tests before the freeze: every quote reason code; same input → same hash; expiry with a fixed
clock; `/order` replay returns the same order and calls PayPal once; one telemetry row per call; insert-only
triggers; `/search` under 500 ms on the seed catalog.
