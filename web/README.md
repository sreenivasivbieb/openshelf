# web/

Merchant-facing UI (React + Vite + AG Grid): upload, mapping review, store ready, dashboard.
It only talks to the server's `/admin/*` API. `pnpm dev:web` (port 5173, proxies to the server);
`pnpm build:web` writes `dist/web`, which the server serves in production.
