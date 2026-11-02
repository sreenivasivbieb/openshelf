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
