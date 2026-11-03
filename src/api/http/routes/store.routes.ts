import { Router } from "express";
import type { Services } from "../../../services";
import { createStoreController } from "../controllers/store.controller";

/** Mounted at /m/:merchantId/api (behind agentContext + rate limit). */
export function createStoreRouter(services: Services): Router {
  const c = createStoreController(services);
  const router = Router({ mergeParams: true });
  router.post("/search", c.search);
  router.post("/quote", c.quote);
  router.post("/order", c.order);
  router.get("/track/:orderId", c.track);
  router.post("/return", c.requestReturn);
  return router;
}
