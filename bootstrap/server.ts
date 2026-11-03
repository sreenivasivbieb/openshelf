import express, { type Express } from "express";
import helmet from "helmet";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Container } from "./container";
import { requestId } from "../src/api/http/middlewares/request-id";
import { errorHandler } from "../src/api/http/middlewares/error-handler";
import { createApiRouter } from "../src/api/http/routes";

const WEB_DIST = join(import.meta.dirname, "..", "dist", "web");
const APP_VERSION = (
  JSON.parse(readFileSync(join(import.meta.dirname, "..", "package.json"), "utf8")) as {
    version: string;
  }
).version;

/** Express app: global middleware -> api routes -> built dashboard (production) -> error handler. */
export function createHttpApp(c: Container): Express {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1); // Render / tunnel in front; needed for per-IP rate limits
  app.use(helmet());
  app.use(requestId);
  app.use(express.json({ limit: "100kb" }));

  app.use(
    createApiRouter({
      services: c.services,
      clock: c.clock,
      adminToken: c.env.ADMIN_TOKEN,
      dashboardOrigin: c.env.DASHBOARD_ORIGIN,
      appVersion: APP_VERSION,
      logger: c.logger,
    }),
  );

  if (c.env.NODE_ENV === "production" && existsSync(WEB_DIST)) {
    app.use(express.static(WEB_DIST));
    app.get("/{*path}", (_req, res) => res.sendFile(join(WEB_DIST, "index.html")));
  }

  app.use(errorHandler(c.logger));
  return app;
}
