import type { OnboardingService } from "./onboarding.service";
import type { CatalogService } from "./catalog.service";
import type { QuoteService } from "./quote.service";
import type { OrderService } from "./order.service";
import type { TrackingService } from "./tracking.service";
import type { TelemetryService } from "./telemetry.service";
import type { DashboardService } from "./dashboard.service";

/** What the api layer can call. Built in bootstrap/container.ts. */
export interface Services {
  onboarding: OnboardingService;
  catalog: CatalogService;
  quotes: QuoteService;
  orders: OrderService;
  tracking: TrackingService;
  telemetry: TelemetryService;
  dashboard: DashboardService;
}
