import type { Db } from "./db";
import type { Product } from "../domain/entities";
import type { FirewallStatus } from "../domain/enums";
import { notImplemented } from "../shared/errors";

export interface ProductSearchFilters {
  query: string;
  maxPriceMinor?: number;
  maxShippingDays?: number;
  minRating?: number;
  inStockOnly: boolean;
  limit: number;
}

export interface ProductRepository {
  upsertMany(products: Product[]): void;
  findBySku(merchantId: string, sku: string): Product | null;
  /** FTS5 bm25 over name + agent description + category; clean products only (FR-07, NFR-04). */
  search(merchantId: string, filters: ProductSearchFilters): Product[];
  /** Clean, in-stock products, for the deterministic "nearest passing option" (FR-10). */
  listQuotable(merchantId: string): Product[];
  setFirewallResult(
    merchantId: string,
    sku: string,
    status: FirewallStatus,
    reason: string | null,
  ): void;
  setAgentDescription(merchantId: string, sku: string, text: string): void;
  /** Returns false when stock < qty. Call inside a transaction at capture (NFR-05). */
  decrementStock(merchantId: string, sku: string, qty: number): boolean;
  countByFirewallStatus(merchantId: string): { total: number; clean: number; flagged: number };
}

/** Tables: products, products_fts. Build steps 1-3, 9. */
export function createProductRepository(_db: Db): ProductRepository {
  return {
    upsertMany: () => notImplemented("step 1"),
    findBySku: () => notImplemented("step 3"),
    search: () => notImplemented("step 3"),
    listQuotable: () => notImplemented("step 4"),
    setFirewallResult: () => notImplemented("step 9"),
    setAgentDescription: () => notImplemented("step 9"),
    decrementStock: () => notImplemented("step 5"),
    countByFirewallStatus: () => notImplemented("step 9"),
  };
}
