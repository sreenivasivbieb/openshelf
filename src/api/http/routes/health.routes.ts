import { Router } from "express";
import type { Clock } from "../../../shared/clock";

export function createHealthRouter(clock: Clock): Router {
  const router = Router();
  router.get("/", (_req, res) => {
    res.json({ ok: true, time: clock.now().toISOString() });
  });
  return router;
}
