# Development guide

## Where code goes

| You are adding…             | Put it in                                                                        | Notes                                                   |
| --------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------- |
| a request/response shape    | `src/schemas/<area>.schema.ts`                                                   | Zod; REST, MCP and OpenAPI pick it up                   |
| a business rule (no I/O)    | `src/domain/`                                                                    | pure functions; unit-test in `tests/unit/domain/`       |
| a use case                  | `src/services/<area>.service.ts`                                                 | interface + `create<Area>Service(deps)` factory         |
| SQL                         | `src/repositories/<table>.repository.ts`                                         | interface + factory taking `Db`                         |
| a call to an outside system | port in `src/integrations/<area>/`, adapter next to it, instance in `bootstrap/` | services see only the interface                         |
| an HTTP route               | `src/api/http/routes/` + handler in `controllers/`                               | validate with a schema, call one service                |
| an MCP tool                 | `src/api/mcp/tools/<name>.tool.ts` + add to `tools/index.ts`                     | go through `telemetry.record`                           |
| a table change              | new `database/migrations/NNN_<what>.sql`                                         | never edit an applied migration                         |
| config                      | `bootstrap/env.ts` + `.env.example`                                              | pass the value down; never read `process.env` in `src/` |

## Adding a feature, end to end (example: `/return`, FR-17)

1. Schema: `ReturnRequest` / `ReturnResponse` in `src/schemas/order.schema.ts`.
2. Domain: return-window check in `src/domain/` + unit test.
3. Repository: needed queries in `order.repository.ts`; migration if a table changes.
4. Integration: `refund()` on `PaymentProvider` + PayPal adapter.
5. Service: `orders.requestReturn()`; wire any new dependency in `bootstrap/container.ts`.
6. API: controller method + route; MCP `return.tool.ts`; both through `telemetry.record`.
7. Docs: `docs/api/*`, `docs/architecture/traceability.md`; an ADR if a decision changed.

## Conventions

- Files: `kebab-case`, suffixed by role: `*.service.ts`, `*.repository.ts`, `*.controller.ts`, `*.routes.ts`,
  `*.schema.ts`, `*.tool.ts`, `*.provider.ts`.
- Factories, not classes or singletons: `createXService(deps): XService`.
- Money in minor units (`src/domain/money.ts`); time from the injected `Clock`; ids from `newId()`.
- Errors the caller should see: `throw new AppError(code, message, status)`. Unbuilt code: `notImplemented("step N")`.
- Comments say _why_ and reference requirement IDs (`FR-08`, `NFR-02`) and ADRs.
- Branches: `feat/<area>`, `fix/<area>`; PRs use `.github/pull_request_template.md`; CI must be green.
