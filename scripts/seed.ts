/**
 * Creates (or refreshes) the demo store `m_demo` from database/seeds/demo-merchant.csv, through the
 * same onboarding service a real upload uses. The fixed id keeps the MCP URL stable for Claude Desktop.
 *
 *   pnpm db:seed
 *   pnpm db:seed -- --payee sb-xyz@business.example.com --name "Demo Crafts Co."
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { loadEnv } from "../bootstrap/env";
import { createLogger } from "../bootstrap/logger";
import { connectDatabase, runMigrations } from "../bootstrap/database";
import { createPaymentProvider } from "../bootstrap/payments";
import { createLlm } from "../bootstrap/llm";
import { buildContainer } from "../bootstrap/container";
import { CreateMerchantRequest } from "../src/schemas/merchant.schema";
import { systemClock } from "../src/shared/clock";
import { AppError } from "../src/shared/errors";

const DEMO_MERCHANT_ID = "m_demo";
const SEED_CSV = join(import.meta.dirname, "..", "database", "seeds", "demo-merchant.csv");

const { values } = parseArgs({
  options: {
    payee: { type: "string" },
    name: { type: "string", default: "Demo Crafts Co." },
  },
});

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

try {
  services.onboarding.getStore(DEMO_MERCHANT_ID);
} catch (err) {
  if (!(err instanceof AppError && err.code === "MERCHANT_NOT_FOUND")) throw err;
  const request = CreateMerchantRequest.parse({
    name: values.name,
    currency: "USD",
    paypal_payee_email: values.payee,
  });
  services.onboarding.createMerchant(request, { id: DEMO_MERCHANT_ID });
}

const store = await services.onboarding.commitCatalog(
  DEMO_MERCHANT_ID,
  readFileSync(SEED_CSV, "utf8"),
);
db.close();

const { total, clean, flagged } = store.products;
console.log(`Seeded ${store.merchant_id} (${store.name})`);
console.log(`  products  ${total} (${clean} clean, ${flagged} flagged)`);
for (const p of store.flagged_products) console.log(`  flagged   ${p.sku}: ${p.reason}`);
console.log(`  MCP URL   ${store.mcp_url}`);
console.log(`  search    POST ${store.mcp_url.replace(/\/mcp$/, "/api/search")}`);
