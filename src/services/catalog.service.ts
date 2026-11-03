import type { SearchRequest, SearchResponse } from "../schemas/search.schema";
import type { ProductView } from "../schemas/product.schema";
import type { Product } from "../domain/entities";
import { toMajor, toMinor } from "../domain/money";
import type { MerchantRepository } from "../repositories/merchant.repository";
import type { ProductRepository } from "../repositories/product.repository";
import { requireMerchant } from "./lookups";

export interface CatalogService {
  search(merchantId: string, request: SearchRequest): SearchResponse;
}

export interface CatalogDeps {
  merchants: MerchantRepository;
  products: ProductRepository;
}

export function toProductView(p: Product, currency: string): ProductView {
  return {
    sku: p.sku,
    name: p.name,
    description: p.descriptionAgent ?? "",
    category: p.category,
    price: toMajor(p.priceMinor),
    currency,
    stock: p.stock,
    in_stock: p.stock > 0,
    shipping_days: p.shippingDays,
    return_days: p.returnDays,
    rating_avg: p.ratingAvg,
    review_count: p.reviewCount,
    ratings_source: "merchant_reported",
  };
}

/** FR-07 /search: only firewall-clean products ever reach an agent. */
export function createCatalogService(deps: CatalogDeps): CatalogService {
  return {
    search(merchantId, request) {
      const merchant = requireMerchant(deps.merchants, merchantId);
      const products = deps.products.search(merchant.id, {
        query: request.query,
        maxPriceMinor: request.max_price === undefined ? undefined : toMinor(request.max_price),
        maxShippingDays: request.max_shipping_days,
        minRating: request.min_rating,
        inStockOnly: request.in_stock_only,
        limit: request.limit,
      });
      return { results: products.map((p) => toProductView(p, merchant.currency)) };
    },
  };
}
