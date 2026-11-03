import type { CatalogPreview, CreateMerchantRequest, StoreInfo } from "../schemas/merchant.schema";
import type { ColumnOverrides, ProductRow } from "../schemas/product.schema";
import type { Merchant, Product } from "../domain/entities";
import { sanitizeForAgents } from "../domain/firewall-rules";
import { toMinor } from "../domain/money";
import type { MerchantRepository } from "../repositories/merchant.repository";
import type { ProductRepository } from "../repositories/product.repository";
import type { Clock } from "../shared/clock";
import { AppError, notImplemented } from "../shared/errors";
import { newId } from "../shared/ids";
import type { IngestionReport, IngestionService } from "./ingestion.service";
import type { FirewallService } from "./firewall.service";
import type { OpenApiDocument, SpecService } from "./spec.service";
import { requireMerchant } from "./lookups";

const PREVIEW_MAX_ERRORS = 200;
const PREVIEW_SAMPLE_ROWS = 5;

export interface OnboardingService {
  /** `options.id` is for the seed script's fixed demo store; the API always generates ids. */
  createMerchant(request: CreateMerchantRequest, options?: { id?: string }): StoreInfo;
  /** Upload step: mapping + every row problem; nothing is saved. */
  previewCatalog(
    merchantId: string,
    csv: string,
    overrides?: ColumnOverrides,
  ): Promise<CatalogPreview>;
  /** Confirm step: strict (any row problem refuses), then the catalog is replaced as a whole. */
  commitCatalog(merchantId: string, csv: string, overrides?: ColumnOverrides): Promise<StoreInfo>;
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

function assertCommittable(report: IngestionReport): void {
  if (report.missingRequired.length) {
    throw new AppError(
      "MISSING_COLUMNS",
      `No column found for: ${report.missingRequired.join(", ")}. Map them on the review step.`,
      422,
    );
  }
  const [first] = report.errors;
  if (first) {
    throw new AppError(
      "CATALOG_HAS_ERRORS",
      `${report.errors.length} problem(s) in the file, first: row ${first.row}, ${first.column}: ${first.message}. ` +
        "Fix the file and upload again; the preview lists every problem.",
      422,
    );
  }
  if (!report.rows.length)
    throw new AppError("CATALOG_EMPTY", "The file has a header row but no products.", 422);
}

/**
 * FR-06 merchant registry and catalog onboarding (ADR-0001: a store is rows + a URL).
 * Commit pipeline per product: firewall screen -> sanitize agent-facing text -> description rewrite.
 * TODO(step 9): build and save the OpenAPI spec at the end of commit (template, then LLM enrichment).
 */
export function createOnboardingService(deps: OnboardingDeps): OnboardingService {
  const baseUrl = deps.publicBaseUrl.replace(/\/+$/, "");

  const storeInfo = (merchant: Merchant): StoreInfo => ({
    merchant_id: merchant.id,
    name: merchant.name,
    currency: merchant.currency,
    spec_status: merchant.specStatus,
    mcp_url: `${baseUrl}/m/${merchant.id}/mcp`,
    openapi_url: `${baseUrl}/m/${merchant.id}/openapi.json`,
    products: deps.products.countByFirewallStatus(merchant.id),
    flagged_products: deps.products.listFlagged(merchant.id).map((p) => ({
      sku: p.sku,
      name: p.name,
      reason: p.firewallReason ?? "flagged by the prompt firewall",
    })),
  });

  const toProduct = async (merchantId: string, row: ProductRow, now: string): Promise<Product> => {
    const verdict = await deps.firewall.screen(
      [row.name, row.description, row.category ?? ""].join("\n"),
    );
    const name = sanitizeForAgents(row.name, 200) || row.sku;
    const category = row.category ? sanitizeForAgents(row.category, 100) || null : null;
    const cleanText = sanitizeForAgents(row.description);
    return {
      merchantId,
      sku: row.sku,
      name,
      descriptionRaw: row.description,
      descriptionAgent:
        verdict.status === "clean"
          ? await deps.spec.rewriteDescription({ name, category, cleanText })
          : cleanText,
      category,
      priceMinor: toMinor(row.price),
      stock: row.stock,
      shippingDays: row.shipping_days,
      returnDays: row.return_days,
      ratingAvg: row.rating_avg ?? null,
      reviewCount: row.review_count ?? null,
      firewallStatus: verdict.status,
      firewallReason: verdict.status === "flagged" ? verdict.reason : null,
      updatedAt: now,
    };
  };

  return {
    createMerchant(request, options = {}) {
      const id = options.id ?? newId("m");
      if (deps.merchants.findById(id))
        throw new AppError("MERCHANT_EXISTS", `A store with id "${id}" already exists`, 409);
      const merchant: Merchant = {
        id,
        name: request.name,
        currency: request.currency,
        paypalPayeeEmail: request.paypal_payee_email ?? null,
        specJson: null,
        specStatus: "pending",
        createdAt: deps.clock.now().toISOString(),
      };
      deps.merchants.insert(merchant);
      return storeInfo(merchant);
    },

    async previewCatalog(merchantId, csv, overrides = {}) {
      requireMerchant(deps.merchants, merchantId);
      const report = await deps.ingestion.parse(csv, overrides);
      return {
        headers: report.headers,
        mapping: report.mapping,
        unmapped: report.unmapped,
        suggestions: report.suggestions,
        missing_required: report.missingRequired,
        total_rows: report.totalRows,
        valid_rows: report.rows.length,
        error_count: report.errors.length,
        errors: report.errors.slice(0, PREVIEW_MAX_ERRORS),
        sample: report.rows.slice(0, PREVIEW_SAMPLE_ROWS),
      };
    },

    async commitCatalog(merchantId, csv, overrides = {}) {
      const merchant = requireMerchant(deps.merchants, merchantId);
      const report = await deps.ingestion.parse(csv, overrides);
      assertCommittable(report);

      const now = deps.clock.now().toISOString();
      const products: Product[] = [];
      for (const row of report.rows) products.push(await toProduct(merchant.id, row, now));
      deps.products.replaceCatalog(merchant.id, products);
      return storeInfo(merchant);
    },

    getStore: (merchantId) => storeInfo(requireMerchant(deps.merchants, merchantId)),

    getSpec: () => notImplemented("step 9"),
  };
}
