import { pino, type Logger } from "pino";
import type { Env } from "./env";

/** Structured JSON logs (pino). Pipe through `pino-pretty` locally if you want colours. */
export function createLogger(env: Pick<Env, "LOG_LEVEL" | "NODE_ENV">): Logger {
  return pino({
    level: env.NODE_ENV === "test" ? "silent" : env.LOG_LEVEL,
    base: { service: "openshelf" },
    redact: ["req.headers.authorization", "*.PAYPAL_CLIENT_SECRET", "*.ANTHROPIC_API_KEY"],
  });
}
