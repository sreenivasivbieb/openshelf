# Single image: API + MCP endpoint + built dashboard.
FROM node:24-slim
WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build:web

ENV NODE_ENV=production \
    PORT=8787 \
    DATABASE_PATH=/app/storage/openshelf.db
EXPOSE 8787
CMD ["pnpm", "start"]
