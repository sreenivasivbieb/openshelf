import type { Logger } from "pino";
import type { Env } from "./env";
import type { Db } from "../src/repositories/db";
import type { Clock } from "../src/shared/clock";
import type { PaymentProvider } from "../src/integrations/payments/payment-provider";
import type { LlmClient } from "../src/integrations/llm/llm-client";
import type { Services } from "../src/services";
import { createTransactionRunner } from "../src/repositories/db";
import { createMerchantRepository } from "../src/repositories/merchant.repository";
import { createProductRepository } from "../src/repositories/product.repository";
import { createQuoteRepository } from "../src/repositories/quote.repository";
import { createOrderRepository } from "../src/repositories/order.repository";
import { createTelemetryRepository } from "../src/repositories/telemetry.repository";
import { createIngestionService } from "../src/services/ingestion.service";
import { createFirewallService } from "../src/services/firewall.service";
import { createSpecService } from "../src/services/spec.service";
import { createOnboardingService } from "../src/services/onboarding.service";
import { createCatalogService } from "../src/services/catalog.service";
import { createQuoteService } from "../src/services/quote.service";
import { createOrderService } from "../src/services/order.service";
import { createTrackingService } from "../src/services/tracking.service";
import { createTelemetryService } from "../src/services/telemetry.service";
import { createDashboardService } from "../src/services/dashboard.service";

export interface ContainerInput {
  env: Env;
  logger: Logger;
  db: Db;
  clock: Clock;
  payments: PaymentProvider;
  llm: LlmClient | null;
}

export interface Container extends ContainerInput {
  services: Services;
}

/**
 * Composition root: the one place that knows every concrete implementation.
 * repositories (db) -> services (repos + integrations + config) -> Services for the api layer.
 * Tests call this with an in-memory db, a fixed clock and fake integrations.
 */
export function buildContainer(input: ContainerInput): Container {
  const { env, db, clock, payments, llm } = input;
  const publicBaseUrl = env.PUBLIC_BASE_URL;

  const repos = {
    merchants: createMerchantRepository(db),
    products: createProductRepository(db),
    quotes: createQuoteRepository(db),
    orders: createOrderRepository(db),
    telemetry: createTelemetryRepository(db),
  };
  const tx = createTransactionRunner(db);

  const ingestion = createIngestionService({ llm });
  const firewall = createFirewallService({ llm });
  const spec = createSpecService({ llm, publicBaseUrl });

  const services: Services = {
    onboarding: createOnboardingService({
      ...repos,
      ingestion,
      firewall,
      spec,
      clock,
      publicBaseUrl,
    }),
    catalog: createCatalogService(repos),
    quotes: createQuoteService({ ...repos, clock, ttlMinutes: env.QUOTE_TTL_MINUTES }),
    orders: createOrderService({ ...repos, payments, tx, clock, publicBaseUrl }),
    tracking: createTrackingService(repos),
    telemetry: createTelemetryService({ telemetry: repos.telemetry, clock }),
    dashboard: createDashboardService(repos),
  };

  return { ...input, services };
}
