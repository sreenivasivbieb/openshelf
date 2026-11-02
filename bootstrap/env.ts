import { existsSync } from "node:fs";
import { z } from "zod";

/** The only place that reads process.env (NFR-01). Everything else receives config as parameters. */
const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().default(8787),
  PUBLIC_BASE_URL: z.url().default("http://localhost:8787"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
  DATABASE_PATH: z.string().default("./storage/openshelf.db"),
  QUOTE_TTL_MINUTES: z.coerce.number().int().positive().default(15),
  ADMIN_TOKEN: z.string().min(16).default("dev-admin-token-change-me"),
  DASHBOARD_ORIGIN: z.url().default("http://localhost:5173"),
  // Optional at boot so the API runs before PayPal is set up; payments refuse until they are set.
  PAYPAL_CLIENT_ID: z.string().optional(),
  PAYPAL_CLIENT_SECRET: z.string().optional(),
  // Optional: without a key, onboarding uses rules-only firewall + template spec (NFR-08).
  ANTHROPIC_API_KEY: z.string().optional(),
  SPEC_AGENT_MODEL: z.string().default("claude-opus-5-5"),
});

export type Env = z.infer<typeof EnvSchema>;

/** Loads .env from the working directory if present, then validates. Exits on bad config. */
export function loadEnv(source?: NodeJS.ProcessEnv): Env {
  if (!source && existsSync(".env")) process.loadEnvFile(".env");
  const parsed = EnvSchema.safeParse(source ?? process.env);
  if (!parsed.success) {
    console.error("Invalid environment:\n" + z.prettifyError(parsed.error));
    process.exit(1);
  }
  if (parsed.data.NODE_ENV === "production" && parsed.data.ADMIN_TOKEN.startsWith("dev-")) {
    console.error("Set a real ADMIN_TOKEN in production.");
    process.exit(1);
  }
  return parsed.data;
}
