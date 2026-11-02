import express, { Router } from "express";
import type { Services } from "../../../services";
import { createAdminController } from "../controllers/admin.controller";

/** Mounted at /admin (behind CORS + admin token). See docs/api/rest.md. */
export function createAdminRouter(services: Services): Router {
  const c = createAdminController(services);
  const csv = express.text({ type: ["text/csv", "text/plain"], limit: "2mb" });
  const router = Router();
  router.post("/merchants", c.createMerchant);
  router.get("/merchants/:merchantId", c.getStore);
  router.post("/merchants/:merchantId/catalog/preview", csv, c.previewCatalog);
  router.post("/merchants/:merchantId/catalog/commit", csv, c.commitCatalog);
  router.get("/merchants/:merchantId/telemetry", c.feed);
  router.get("/merchants/:merchantId/quotes/summary", c.quoteSummary);
  router.get("/merchants/:merchantId/orders", c.orders);
  return router;
}
