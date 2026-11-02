# Requirement → code → test

Status as of 2026-11-03: skeleton. "Test" lists the test that will prove it.

| ID           | Code                                                                                                 | Test                                                                            |
| ------------ | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| FR-01, FR-02 | `src/services/ingestion.service.ts`, `src/domain/column-mapping.ts`, `src/schemas/product.schema.ts` | `tests/unit/domain/column-mapping.test.ts`, fixture `catalog-messy-headers.csv` |
| FR-03        | `src/services/spec.service.ts`                                                                       | `tests/integration/spec.test.ts` (validator)                                    |
| FR-04        | `src/services/spec.service.ts` (`rewriteDescription`)                                                | onboarding integration test                                                     |
| FR-05        | `src/domain/firewall-rules.ts`, `src/services/firewall.service.ts`                                   | `tests/unit/domain/firewall-rules.test.ts` (`CANDLE-3`)                         |
| FR-06        | `src/services/onboarding.service.ts`, `src/api/http/routes/index.ts`                                 | two-merchant integration test                                                   |
| FR-07        | `src/services/catalog.service.ts`, `src/repositories/product.repository.ts`                          | `tests/integration/search.test.ts`                                              |
| FR-08, FR-10 | `src/domain/guardrails.ts`, `src/services/quote.service.ts`                                          | `tests/unit/domain/guardrails.test.ts`                                          |
| FR-09        | `src/domain/quote-hash.ts`                                                                           | `tests/unit/domain/quote-hash.test.ts`                                          |
| FR-11        | `src/services/order.service.ts`, `src/integrations/payments/`                                        | `tests/integration/order.test.ts` (fake PayPal)                                 |
| FR-12        | `src/services/tracking.service.ts`                                                                   | order integration test                                                          |
| FR-13        | `src/api/mcp/`                                                                                       | MCP client integration test                                                     |
| FR-14        | `src/services/telemetry.service.ts`                                                                  | row-per-call test                                                               |
| FR-15        | `src/services/dashboard.service.ts`, `web/src/pages/DashboardPage.tsx`                               | manual, simulator run                                                           |
| FR-16        | `tools/simulator/`                                                                                   | the simulator's own expected outcomes                                           |
| NFR-01       | `bootstrap/env.ts`, `src/api/http/middlewares/*`                                                     | `tests/integration/health.test.ts` (401, 400)                                   |
| NFR-02       | `src/domain/guardrails.ts`, `src/shared/clock.ts`, lint rule in `eslint.config.js`                   | guardrail unit tests; `pnpm lint`                                               |
| NFR-03       | `database/migrations/001_init.sql` triggers, `src/domain/quote-hash.ts`                              | `tests/integration/database.test.ts`                                            |
| NFR-04       | FTS5 index, `src/repositories/product.repository.ts`                                                 | timed search test                                                               |
| NFR-05       | `orders.quote_id` UNIQUE, `src/services/order.service.ts`                                            | replay + expiry tests                                                           |
| NFR-06       | `telemetry.record()` used by every controller and tool                                               | row count == simulator calls                                                    |
| NFR-07       | `src/api/mcp/mcp.handler.ts`                                                                         | manual: MCP Inspector, Claude Desktop                                           |
| NFR-08       | `bootstrap/llm.ts`, `bootstrap/payments.ts` fallbacks, `Dockerfile`, `render.yaml`                   | rehearsal ([runbook](../runbooks/demo.md))                                      |
