import type { ProductRow } from "../schemas/product.schema";
import { notImplemented } from "../shared/errors";

export type CanonicalColumn = keyof ProductRow;

/** Deterministic header matching (FR-02). Unresolved headers go to the LLM for a suggestion. */
export const COLUMN_SYNONYMS: Record<CanonicalColumn, string[]> = {
  sku: ["sku", "item code", "product id", "code"],
  name: ["name", "product name", "title", "item"],
  description: ["description", "details", "desc", "about"],
  category: ["category", "type", "collection"],
  price: ["price", "mrp", "cost", "selling price"],
  stock: ["stock", "qty", "quantity", "inventory"],
  shipping_days: ["shipping_days", "ships in", "delivery days", "dispatch days"],
  return_days: ["return_days", "return window", "returns", "return policy days"],
  rating_avg: ["rating", "rating_avg", "avg rating", "stars"],
  review_count: ["reviews", "review_count", "no. of reviews", "ratings count"],
};

export interface ColumnMappingResult {
  mapping: Record<string, CanonicalColumn>; // merchant header -> our column
  unmapped: string[];
}

/** Build step 2: normalize headers (lowercase, trim, strip units like "(USD)") and match synonyms. */
export function mapColumns(_headers: string[]): ColumnMappingResult {
  return notImplemented("step 2");
}
