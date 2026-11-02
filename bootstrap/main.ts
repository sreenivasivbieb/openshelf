import { loadEnv } from "./env";
import { createLogger } from "./logger";
import { connectDatabase, runMigrations } from "./database";
import { createPaymentProvider } from "./payments";
import { createLlm } from "./llm";
import { buildContainer } from "./container";
import { createHttpApp } from "./server";
import { systemClock } from "../src/shared/clock";

/** Entry point: config -> logger -> database -> external clients -> container -> HTTP server. */
function main() {
  const env = loadEnv();
  const logger = createLogger(env);

  const db = connectDatabase(env.DATABASE_PATH);
  const applied = runMigrations(db);
  if (applied.length) logger.info({ applied }, "migrations applied");

  const container = buildContainer({
    env,
    logger,
    db,
    clock: systemClock,
    payments: createPaymentProvider(env, logger),
    llm: createLlm(env, logger),
  });

  const server = createHttpApp(container).listen(env.PORT, () => {
    logger.info({ port: env.PORT, url: env.PUBLIC_BASE_URL }, "OpenShelf server started");
  });

  const shutdown = (signal: string) => {
    logger.info({ signal }, "shutting down");
    server.close(() => {
      db.close();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main();
