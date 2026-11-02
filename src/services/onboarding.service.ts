import type { CreateMerchantRequest, StoreInfo } from "../schemas/merchant.schema";
import type { CanonicalColumn } from "../domain/column-mapping";
import type { MerchantRepository } from "../repositories/merchant.repository";
import type { ProductRepository } from "../repositories/product.repository";
import type { Clock } from "../shared/clock";
import type { IngestionReport, IngestionService } from "./ingestion.service";
import type { FirewallService } from "./firewall.service";
import type { OpenApiDocument, SpecService } from "./spec.service";
import { notImplemented } from "../shared/errors";

export interface OnboardingService {
  createMerchant(request: CreateMerchantRequest): StoreInfo;
  /** Upload step: mapping + bad-row report, nothing saved yet. */
  previewCatalog(merchantId: string, csv: string): Promise<IngestionReport>;
  /** Confirm step: save rows -> firewall -> rewrite -> spec -> store ready. */
  commitCatalog(
    merchantId: string,
    csv: string,
    mapping: Record<string, CanonicalColumn>,
  ): Promise<StoreInfo>;
  getStore(merchantId: string): StoreInfo;
  getSpec(merchantId: string): OpenApiDocument;
}

export interface OnboardingDeps {
  merchants: MerchantRepository;
  products: ProductRepository;
  ingestion: IngestionService;
  firewall: FirewallService;
  spec: SpecService;
  clock: Clock;
  publicBaseUrl: string;
}

/**
 * FR-06 merchant registry. "Generating a store" = rows + spec + URL /m/{id}/mcp (ADR-0001).
 * Build steps 1, 2, 9.
 */
export function createOnboardingService(_deps: OnboardingDeps): OnboardingService {
  return {
    createMerchant: () => notImplemented("step 1"),
    previewCatalog: async () => notImplemented("step 2"),
    commitCatalog: async () => notImplemented("step 2"),
    getStore: () => notImplemented("step 1"),
    getSpec: () => notImplemented("step 9"),
  };
}
