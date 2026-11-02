# Getting started

Requires Node 24 (`.nvmrc`) and pnpm 12 (`corepack enable`).

```bash
pnpm install
cp .env.example .env          # fill PayPal sandbox keys; Anthropic key optional
pnpm db:migrate               # creates storage/openshelf.db
pnpm db:seed                  # demo merchant from database/seeds/demo-merchant.csv (step 1)
pnpm dev                      # API + MCP on :8787 (restarts on change)
pnpm dev:web                  # dashboard on :5173 (second terminal)
pnpm simulate                 # scripted buyer agents (step 8)
```

Check: `curl localhost:8787/health`. Unbuilt routes answer `501 NOT_IMPLEMENTED`.

## Scripts

| Command                                        | What it does                                            |
| ---------------------------------------------- | ------------------------------------------------------- |
| `pnpm dev` / `pnpm start`                      | server with / without watch                             |
| `pnpm dev:web` / `pnpm build:web`              | dashboard dev server / production build into `dist/web` |
| `pnpm db:migrate` / `pnpm db:seed`             | schema / demo data                                      |
| `pnpm test`, `test:unit`, `test:integration`   | Vitest                                                  |
| `pnpm typecheck` / `pnpm lint` / `pnpm format` | static checks (lint also enforces layer boundaries)     |
| `pnpm simulate`                                | buyer simulator against a running server                |

## PayPal sandbox

1. developer.paypal.com → Apps & Credentials → Sandbox → create app → copy client id + secret into `.env`.
2. Sandbox → Accounts: note one **business** account (merchant payee email) and one **personal**
   account (human buyer who approves).
