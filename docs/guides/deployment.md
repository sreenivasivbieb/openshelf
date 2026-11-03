# Deployment

| Target | Use                      | How                                                                           |
| ------ | ------------------------ | ----------------------------------------------------------------------------- |
| Laptop | primary demo             | `pnpm build:web && NODE_ENV=production pnpm start` (serves dashboard too)     |
| Tunnel | public URL to the laptop | `cloudflared tunnel --url http://localhost:8787`; set `PUBLIC_BASE_URL` to it |
| Render | backup public deploy     | `render.yaml` (Docker, 1 GB disk at `/app/storage`)                           |

Docker locally:

```bash
docker build -t openshelf .
docker run -p 8787:8787 -e ADMIN_TOKEN=<16+ chars> --env-file .env -v "$PWD/storage:/app/storage" openshelf
```

Production checklist: real `ADMIN_TOKEN` (server refuses `dev-*`), `PUBLIC_BASE_URL` = the public URL
(PayPal return links and MCP URLs use it), PayPal sandbox keys set, `/health` green.

## APIMatic SDK and docs portal (build step 10)

1. Make the store public (tunnel or Render) and set `PUBLIC_BASE_URL` to that URL.
2. Export its spec: `pnpm spec:export` (writes `dist/openapi/m_demo.json`; `-- --merchant <id>` for another store).
3. In APIMatic, import the file, generate the TypeScript SDK and publish the docs portal.
4. Check: one `searchProducts` call through the generated SDK returns the seed products.

The spec has stable operation ids (`searchProducts`, `createQuote`, `createOrder`, `trackOrder`), so
regenerated SDKs keep their method names. APIMatic's MCP generator is in alpha and needs access by email;
our own MCP endpoint stays the baseline (ADR-0009).
