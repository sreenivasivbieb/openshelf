import { Router } from "express";
import cors from "cors";
import type { Services } from "../../../services";
import type { Clock } from "../../../shared/clock";
import { adminAuth } from "../middlewares/admin-auth";
import { agentContext } from "../middlewares/agent-context";
import { createAgentRateLimit } from "../middlewares/rate-limit";
import { createHealthRouter } from "./health.routes";
import { createAdminRouter } from "./admin.routes";
import { createStoreRouter } from "./store.routes";
import { createPayPalRouter } from "./paypal.routes";
import { createMcpHandler } from "../../mcp/mcp.handler";
import { createStoreController } from "../controllers/store.controller";

export interface ApiOptions {
  services: Services;
  clock: Clock;
  adminToken: string;
  dashboardOrigin: string;
}

/**
 * Route map (one server for every merchant, ADR-0001):
 *   /health                         liveness
 *   /admin/*                        onboarding + dashboard API        [CORS, admin token]
 *   /m/:merchantId/api/*            Store API (REST)                  [rate limit]
 *   /m/:merchantId/mcp              MCP endpoint (same services)      [rate limit]
 *   /m/:merchantId/openapi.json     generated spec
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
  );

  const store = Router({ mergeParams: true });
  store.use(agentContext, createAgentRateLimit());
  store.use("/api", createStoreRouter(o.services));
  store.all("/mcp", createMcpHandler(o.services));
  store.get("/openapi.json", createStoreController(o.services).openapi);
  router.use("/m/:merchantId", store);

  router.use("/paypal", createPayPalRouter(o.services));
  return router;
}
