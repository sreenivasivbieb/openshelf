import type { SearchRequest, SearchResponse } from "../schemas/search.schema";
import type { MerchantRepository } from "../repositories/merchant.repository";
import type { ProductRepository } from "../repositories/product.repository";
import { notImplemented } from "../shared/errors";

export interface CatalogService {
  search(merchantId: string, request: SearchRequest): SearchResponse;
}

export interface CatalogDeps {
  merchants: MerchantRepository;
  products: ProductRepository;
}

/** FR-07 /search. Build step 3. Maps Product -> ProductView (minor -> major units, ratings_source). */
export function createCatalogService(_deps: CatalogDeps): CatalogService {
  return {
    search: () => notImplemented("step 3"),
  };
}
