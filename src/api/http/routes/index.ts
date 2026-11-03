import { Router } from "express";
import cors from "cors";
import type { Logger } from "pino";
import type { Services } from "../../../services";
import type { Clock } from "../../../shared/clock";
import { adminAuth } from "../middlewares/admin-auth";
import { createAgentContext } from "../middlewares/agent-context";
import { createAgentRateLimit } from "../middlewares/rate-limit";
import { createHealthRouter } from "./health.routes";
import { createAdminRouter } from "./admin.routes";
import { createAgentKeysRouter } from "./agent-keys.routes";
import { createStoreRouter } from "./store.routes";
import { createPayPalRouter } from "./paypal.routes";
import { createMcpHandler } from "../../mcp/mcp.handler";
import { createStoreController } from "../controllers/store.controller";

export interface ApiOptions {
  services: Services;
  clock: Clock;
  adminToken: string;
  dashboardOrigin: string;
  /** package.json version, reported to MCP clients. */
  appVersion: string;
  logger: Logger;
}

/**
 * Route map (one server for every merchant, ADR-0001):
 *   /health                         liveness
 *   /admin/*                        onboarding, dashboard and agent-key API  [CORS, admin token]
 *   /m/:merchantId/api/*            Store API (REST)              [rate limit, X-Agent-Key policy]
 *   /m/:merchantId/mcp              MCP endpoint (same services)  [rate limit, X-Agent-Key policy]
 *   /m/:merchantId/openapi.json     generated spec                [rate limit]
 *   /m/:merchantId/store.md|.json   agent-readable storefront     [rate limit]
 *   /paypal/return | /paypal/cancel PayPal redirects
 */
export function createApiRouter(o: ApiOptions): Router {
  const router = Router();
  router.use("/health", createHealthRouter(o.clock));
  router.use(
    "/admin",
    cors({ origin: o.dashboardOrigin }),
    adminAuth(o.adminToken),
    createAdminRouter(o.services),
    createAgentKeysRouter(o.services),
  );

  // Rate limit first, so guessing agent keys is throttled too.
  const store = Router({ mergeParams: true });
  store.use(createAgentRateLimit());
  const agentCall = createAgentContext(o.services, { enforceKeyPolicy: true });
  const publicDocument = createAgentContext(o.services, { enforceKeyPolicy: false });
  const controller = createStoreController(o.services);

  store.use("/api", agentCall, createStoreRouter(o.services));
  store.all(
    "/mcp",
    agentCall,
    createMcpHandler(o.services, {
      version: o.appVersion,
      onError: (err) => o.logger.error({ err }, "MCP request failed"),
    }),
  );
  store.get("/openapi.json", publicDocument, controller.openapi);
  store.get("/store.md", publicDocument, controller.storeMarkdown);
  store.get("/store.json", publicDocument, controller.storeJson);
  router.use("/m/:merchantId", store);

  router.use("/paypal", createPayPalRouter(o.services));
  return router;
}
