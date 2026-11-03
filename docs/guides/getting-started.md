# Getting started

Requires Node 24+ (`.nvmrc`) and pnpm 12. With Node 24, `corepack enable` provides pnpm. Node 25+ no
longer ships corepack, so use `npm install -g pnpm@12` there.

```bash
pnpm install
cp .env.example .env          # PayPal sandbox keys; Anthropic key optional
pnpm db:migrate               # creates storage/openshelf.db
pnpm db:seed                  # demo store m_demo from database/seeds/demo-merchant.csv
pnpm dev                      # API + MCP on :8787 (restarts on change)
pnpm dev:web                  # dashboard on :5173 (second terminal)
```

`pnpm db:seed` prints the store and its URLs, and can be re-run any time (it refreshes the same store):

```
Seeded m_demo (Demo Crafts Co.)
  products  10 (9 clean, 1 flagged)
  flagged   CANDLE-3: matched firewall rules: ignore-instructions, role-label, addresses-the-agent, hidden-markup
  MCP URL   http://localhost:8787/m/m_demo/mcp
  search    POST http://localhost:8787/m/m_demo/api/search
```

Try a search:

```bash
curl -s -X POST localhost:8787/m/m_demo/api/search -H 'content-type: application/json' \
  -d '{"query":"mugs","max_price":40,"max_shipping_days":4}'
```

Upload your own catalog (admin token from `.env`):

```bash
curl -s -X POST localhost:8787/admin/merchants -H "authorization: Bearer $ADMIN_TOKEN" \
  -H 'content-type: application/json' -d '{"name":"My Shop","currency":"USD"}'      # -> merchant_id
curl -s -X POST localhost:8787/admin/merchants/<merchant_id>/catalog/preview \
  -H "authorization: Bearer $ADMIN_TOKEN" -H 'content-type: text/csv' --data-binary @my-catalog.csv
# fix problems or pass ?mapping=..., then the same call on /catalog/commit
```

Unbuilt routes answer `501 NOT_IMPLEMENTED`.

## Scripts

| Command                                        | What it does                                            |
| ---------------------------------------------- | ------------------------------------------------------- |
| `pnpm dev` / `pnpm start`                      | server with / without watch                             |
| `pnpm dev:web` / `pnpm build:web`              | dashboard dev server / production build into `dist/web` |
| `pnpm db:migrate` / `pnpm db:seed`             | schema / demo store                                     |
| `pnpm test`, `test:unit`, `test:integration`   | Vitest                                                  |
| `pnpm typecheck` / `pnpm lint` / `pnpm format` | static checks (lint also enforces layer boundaries)     |
| `pnpm simulate`                                | buyer simulator against a running server (step 8)       |

## PayPal sandbox

1. developer.paypal.com → Apps & Credentials → Sandbox → create app → copy client id + secret into `.env`.
2. Sandbox → Accounts: note one **business** account (merchant payee email, `pnpm db:seed -- --payee <email>`)
   and one **personal** account (the human buyer who approves).
