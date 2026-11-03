# Build plan

Feature freeze **Nov 9**. Nov 10–12: APIMatic, demo video, submission. No spare day: cut scope before
Nov 9, not after. Order = risk order (external services early, deterministic core before the LLM).

| Day         | Step                                                               | Done when                                                                        | Status                        |
| ----------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------- | ----------------------------- |
| Nov 3 (Mon) | 1 DB repositories + seed · 2 CSV ingestion · 3 `/search`           | seed loads; fixture rows 3 and 4 reported; search returns seed products          | **done**                      |
| Nov 4 (Tue) | 4 guardrails + quote hash + quote service                          | all reason codes tested; same input → same hash; expiry with fixed clock         | **done** (Nov 3, a day early) |
| Nov 5 (Wed) | 5 PayPal create → approve → capture; `/order` idempotent; `/track` | sandbox order captured; replay returns same order                                | next                          |
| Nov 6 (Thu) | 6 MCP handler · 7 telemetry checks over MCP                        | Inspector lists tools; Claude Desktop places an order; one row per call          |                               |
| Nov 7 (Fri) | 8 dashboard + simulator; web onboarding pages                      | live feed and drop-off grid show simulator traffic; CSV upload works from the UI |                               |
| Nov 8 (Sat) | 9 Spec Agent (OpenAPI) + LLM firewall layer + LLM rewrite          | valid spec from seed CSV; LLM verdict on top of the rules                        |                               |
| Nov 9 (Sun) | hardening, NFR tests, rehearsal 1, **freeze**                      | every NFR row in requirements.md checked                                         |                               |
| Nov 10      | 10 APIMatic SDK + portal; Render deploy                            | a call through the generated SDK succeeds                                        |                               |
| Nov 11      | full rehearsal; record backup video                                | runbook passes end to end                                                        |                               |
| Nov 12      | submit                                                             | before the confirmed deadline                                                    |                               |

## Scope changes

- **Nov 3, pulled forward:**
  - The deterministic firewall rules and the agent-text sanitizing moved here from step 9. Without them,
    search would show unscreened text, including the planted `CANDLE-3` injection. Step 9 keeps the LLM
    verdict, the LLM rewrite and the spec.
  - `telemetry.record()` moved here from step 7, so every agent call is logged from the first route.
    Step 7 keeps the MCP-channel check; the dashboard queries stay in step 8.
- **Nov 3, moved later:** the web onboarding pages (upload, mapping review, store ready) move to Nov 7 with
  the dashboard. Their API is ready.
- **Nov 3, added:** migration 002 re-keys the search index by `(merchant_id, sku)`. The rowid link was
  fragile; see data-model.md.

**Cut order if late:**

1. Should items: `/return`, UCP profile, counter-offers, scoped keys, AG Studio chat.
2. LLM description rewrite.
3. LLM firewall layer (the rules stay).

**Never cut:** quote hash, idempotent order, telemetry, simulator.
