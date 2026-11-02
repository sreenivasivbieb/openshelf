import { Router } from "express";
import type { Services } from "../../../services";
import { createPayPalController } from "../controllers/paypal.controller";

/** Mounted at /paypal. These URLs are sent to PayPal as return_url / cancel_url. */
export function createPayPalRouter(services: Services): Router {
  const c = createPayPalController(services);
  const router = Router();
  router.get("/return", c.onReturn);
  router.get("/cancel", c.onCancel);
  return router;
}
