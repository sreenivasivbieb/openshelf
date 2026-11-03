import type { CatalogPreview, CreateMerchantRequest, StoreInfo } from "../schemas/merchant.schema";
import type { ColumnOverrides, ProductRow } from "../schemas/product.schema";
import type { Merchant, Product } from "../domain/entities";
import { sanitizeForAgents } from "../domain/firewall-rules";
import { toMinor } from "../domain/money";
import type { MerchantRepository } from "../repositories/merchant.repository";
import type { ProductRepository } from "../repositories/product.repository";
import type { Clock } from "../shared/clock";
import { AppError } from "../shared/errors";
import { newId } from "../shared/ids";
import type { IngestionReport, IngestionService } from "./ingestion.service";
import type { FirewallService, FirewallVerdict } from "./firewall.service";
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
  /** FR-03: the spec stored at the last commit, or the template when no catalog was committed yet. */
  getSpec(merchantId: string): OpenApiDocument;
}

/** A product the firewall did not return a verdict for is never shown to agents (fail closed). */
const NOT_SCREENED: FirewallVerdict = { status: "flagged", rules: [], reason: "not screened" };

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
 * Commit pipeline: firewall the whole catalog (rules, then the LLM layer) -> sanitize agent-facing text
 * -> rewrite descriptions of clean products -> replace the catalog -> build and save the OpenAPI spec
 * (template, then LLM enrichment). Every LLM step falls back to the rule-based result (NFR-08).
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

  /** Firewall, sanitize and rewrite a validated catalog into products ready to save. */
  const toProducts = async (
    merchantId: string,
    rows: ProductRow[],
    now: string,
  ): Promise<Product[]> => {
    const verdicts = await deps.firewall.screenCatalog(
      rows.map((row) => ({
        sku: row.sku,
        name: row.name,
        description: row.description,
        category: row.category ?? null,
      })),
    );
    const drafts = rows.map((row) => ({
      row,
      name: sanitizeForAgents(row.name, 200) || row.sku,
      category: row.category ? sanitizeForAgents(row.category, 100) || null : null,
      cleanText: sanitizeForAgents(row.description),
      verdict: verdicts.get(row.sku) ?? NOT_SCREENED,
    }));
    const rewrites = await deps.spec.rewriteDescriptions(
      drafts
        .filter((d) => d.verdict.status === "clean")
        .map((d) => ({
          sku: d.row.sku,
          name: d.name,
          category: d.category,
          cleanText: d.cleanText,
        })),
    );
    return drafts.map(({ row, name, category, cleanText, verdict }) => ({
      merchantId,
      sku: row.sku,
      name,
      descriptionRaw: row.description,
      descriptionAgent:
        (verdict.status === "clean" ? rewrites.get(row.sku) : undefined) ?? cleanText,
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
    }));
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
      const report = await deps.ingestion.parse(csv, overrides, { suggestMappings: true });
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

      const products = await toProducts(merchant.id, report.rows, deps.clock.now().toISOString());
      deps.products.replaceCatalog(merchant.id, products);

      const { spec, status } = await deps.spec.build(merchant, products);
      const specJson = JSON.stringify(spec);
      deps.merchants.saveSpec(merchant.id, specJson, status);
      return storeInfo({ ...merchant, specJson, specStatus: status });
    },

    getStore: (merchantId) => storeInfo(requireMerchant(deps.merchants, merchantId)),

    getSpec(merchantId) {
      const merchant = requireMerchant(deps.merchants, merchantId);
      return merchant.specJson
        ? (JSON.parse(merchant.specJson) as OpenApiDocument)
        : deps.spec.buildTemplate(merchant);
    },
  };
}
