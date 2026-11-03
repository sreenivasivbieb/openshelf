/**
 * Writes a store's OpenAPI 3.1 spec to a file for APIMatic (SDK + docs portal, build step 10).
 *
 *   pnpm spec:export                                   -> dist/openapi/m_demo.json
 *   pnpm spec:export -- --merchant m_xyz --out my.json
 *
 * The spec's server URL comes from PUBLIC_BASE_URL. Set it to the public URL (tunnel or Render)
 * before exporting, or the generated SDK will call localhost.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { loadEnv } from "../bootstrap/env";
import { createLogger } from "../bootstrap/logger";
import { connectDatabase, runMigrations } from "../bootstrap/database";
import { createPaymentProvider } from "../bootstrap/payments";
import { createLlm } from "../bootstrap/llm";
import { buildContainer } from "../bootstrap/container";
import { systemClock } from "../src/shared/clock";
import { AppError } from "../src/shared/errors";

const { values } = parseArgs({
  options: {
    merchant: { type: "string", default: "m_demo" },
    out: { type: "string" },
  },
});
const merchantId = values.merchant;
const out = resolve(
  values.out ?? join(import.meta.dirname, "..", "dist", "openapi", `${merchantId}.json`),
);

const env = loadEnv();
const logger = createLogger({ NODE_ENV: env.NODE_ENV, LOG_LEVEL: "error" });
const db = connectDatabase(env.DATABASE_PATH);
runMigrations(db);
const { services } = buildContainer({
  env,
  logger,
  db,
  clock: systemClock,
  payments: createPaymentProvider(env, logger),
  llm: createLlm(env, logger),
});

let spec: unknown;
let status: string;
try {
  spec = services.onboarding.getSpec(merchantId);
  status = services.onboarding.getStore(merchantId).spec_status;
} catch (err) {
  if (!(err instanceof AppError)) throw err;
  console.error(`${err.code}: ${err.message}`);
  process.exit(1);
}
db.close();

mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, `${JSON.stringify(spec, null, 2)}\n`);
console.log(`Wrote ${out} (spec_status: ${status})`);
if (/localhost|127\.0\.0\.1/.test(env.PUBLIC_BASE_URL)) {
  console.warn(
    `Note: the server URL is ${env.PUBLIC_BASE_URL}. Set PUBLIC_BASE_URL to the public URL before importing into APIMatic.`,
  );
}
