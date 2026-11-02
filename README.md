# OpenShelf

OpenShelf turns a merchant's product spreadsheet and PayPal account into a store that AI shopping agents
(Claude, ChatGPT, Perplexity) can **search, quote and buy from**, in about 10 minutes, without moving to a
store platform. Entry for the PayPal AI Hackathon 2026.

The merchant uploads a CSV and connects PayPal. OpenShelf returns an **MCP URL** and **OpenAPI 3.1 spec**,
a guardrailed **`/quote`** (deterministic rules, SHA-256 locked quotes, exact failure reasons),
**PayPal checkout** approved by the human, and an **AG Grid dashboard** of agent activity.

## Repository layout

```
openshelf/
├── bootstrap/              composition root: env, logger, DB connection, PayPal + LLM clients,
│                           dependency wiring (container.ts), HTTP server, main.ts
├── src/
│   ├── api/
│   │   ├── http/           routes/ → controllers/ → middlewares/
│   │   └── mcp/            MCP handler + tools/
│   ├── services/           use cases (onboarding, catalog, quote, order, tracking, telemetry, dashboard)
│   ├── domain/             pure business rules + entities (guardrails, quote hash, money, firewall rules)
│   ├── repositories/       data access; the only place SQL lives
│   ├── integrations/       external systems behind interfaces (payments/, llm/)
│   ├── schemas/            Zod contracts: REST, MCP and OpenAPI all come from here
│   └── shared/             errors, clock, ids
├── database/               migrations/*.sql, seeds/demo-merchant.csv
├── web/                    merchant dashboard (React + Vite + AG Grid)
├── scripts/                migrate, seed
├── tools/simulator/        scripted buyer agents (dev tool)
├── tests/                  unit/, integration/, helpers/, fixtures/
├── docs/                   product/, architecture/, api/, adr/, guides/, runbooks/, planning/
├── storage/                runtime SQLite file (git-ignored)
├── Dockerfile, render.yaml deploy
└── .github/                CI + PR template
```

Layer rule: `bootstrap → api → services → domain / repositories / integrations`; `src/` never imports
`bootstrap/`; quote and order code can never import the LLM. `pnpm lint` enforces it.
Details: [docs/architecture/overview.md](docs/architecture/overview.md).

## Quick start

```bash
pnpm install
cp .env.example .env     # PayPal sandbox keys; Anthropic key optional
pnpm db:migrate
pnpm dev                 # API + MCP on :8787
pnpm dev:web             # dashboard on :5173
```

`pnpm test` · `pnpm typecheck` · `pnpm lint` · `pnpm build:web` · `docker build -t openshelf .`
Full setup: [docs/guides/getting-started.md](docs/guides/getting-started.md).

## Documentation

|                                                                                                                                                                                                 |                           |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| [Product overview](docs/product/overview.md) · [Requirements](docs/product/requirements.md)                                                                                                     | what and why (FR/NFR IDs) |
| [Architecture](docs/architecture/overview.md) · [Flows](docs/architecture/request-flows.md) · [Data model](docs/architecture/data-model.md) · [Traceability](docs/architecture/traceability.md) | how                       |
| [REST](docs/api/rest.md) · [MCP](docs/api/mcp.md) · [Errors](docs/api/errors.md)                                                                                                                | contracts                 |
| [Decisions (ADRs)](docs/adr/README.md)                                                                                                                                                          | why it is built this way  |
| [Development](docs/guides/development.md) · [Testing](docs/guides/testing.md) · [Deployment](docs/guides/deployment.md)                                                                         | how we work               |
| [Demo runbook](docs/runbooks/demo.md) · [Build plan](docs/planning/build-plan.md) · [Risks](docs/planning/risks.md)                                                                             | operations and planning   |

## Status

Skeleton (2026-11-03). Real: boot sequence, config, logging, migrations + schema, middlewares, route table,
contracts, MCP tool definitions, Docker. Stubs return `501 NOT_IMPLEMENTED` and are marked `TODO(step N)`;
see the [build plan](docs/planning/build-plan.md).
