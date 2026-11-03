import type { Storefront } from "../schemas/storefront.schema";
import { toMajor } from "../domain/money";
import { renderStorefrontMarkdown } from "../domain/storefront-markdown";
import { agentFacingStoreName } from "../domain/store-name";
import type { MerchantRepository } from "../repositories/merchant.repository";
import type { ProductRepository } from "../repositories/product.repository";
import { requireMerchant } from "./lookups";

/** The storefront lists at most this many products; `truncated` says when there are more. */
export const STOREFRONT_LIMIT = 500;

export interface StorefrontService {
  describe(merchantId: string): Storefront;
  markdown(merchantId: string): string;
}

/**
 * Agent-readable storefront (/m/:id/store.json and store.md): the store, how to buy, and its
 * firewall-clean, in-stock products. Deterministic: the same catalog gives the same document.
 */
export function createStorefrontService(deps: {
  merchants: MerchantRepository;
  products: ProductRepository;
  publicBaseUrl: string;
}): StorefrontService {
  const baseUrl = deps.publicBaseUrl.replace(/\/+$/, "");

  const describe = (merchantId: string): Storefront => {
    const merchant = requireMerchant(deps.merchants, merchantId);
    const store = `${baseUrl}/m/${merchant.id}`;
    // A query with no searchable words browses: clean products only, ordered by name then SKU.
    const products = deps.products.search(merchant.id, {
      query: "*",
      inStockOnly: true,
      limit: STOREFRONT_LIMIT + 1,
    });
    return {
      merchant_id: merchant.id,
      name: agentFacingStoreName(merchant),
      currency: merchant.currency,
      links: {
        mcp: `${store}/mcp`,
        rest: `${store}/api`,
        openapi: `${store}/openapi.json`,
        store_md: `${store}/store.md`,
        store_json: `${store}/store.json`,
      },
      ratings_source: "merchant_reported",
      products: products.slice(0, STOREFRONT_LIMIT).map((p) => ({
        sku: p.sku,
        name: p.name,
        category: p.category,
        price: toMajor(p.priceMinor),
        stock: p.stock,
        shipping_days: p.shippingDays,
        return_days: p.returnDays,
        rating_avg: p.ratingAvg,
        review_count: p.reviewCount,
      })),
      truncated: products.length > STOREFRONT_LIMIT,
    };
  };

  return {
    describe,
    markdown: (merchantId) => renderStorefrontMarkdown(describe(merchantId)),
  };
}
