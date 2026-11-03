import { rateLimit } from "express-rate-limit";

/**
 * Per-IP limit on buyer-facing routes (NFR-01). A factory, so every app instance (and every test)
 * gets its own counter instead of sharing one module-level store.
 */
export function createAgentRateLimit(options: { perMinute: number } = { perMinute: 120 }) {
  return rateLimit({
    windowMs: 60_000,
    limit: options.perMinute,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: { code: "RATE_LIMITED", message: "Too many requests" } },
  });
}
