import { rateLimit } from "express-rate-limit";

/** Per-IP limit on buyer-facing routes (NFR-01). Tune after the simulator run. */
export const agentRateLimit = rateLimit({
  windowMs: 60_000,
  limit: 120,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: { code: "RATE_LIMITED", message: "Too many requests" } },
});
