import type { ProductRow } from "../schemas/product.schema";

export type CanonicalColumn = keyof ProductRow;

/** Columns a catalog cannot work without (FR-01). SKU is generated from the name when absent. */
export const REQUIRED_COLUMNS: readonly CanonicalColumn[] = [
  "name",
  "price",
  "stock",
  "shipping_days",
  "return_days",
];

/**
 * Header synonyms, most preferred first. When several headers match the same column, the most
 * preferred wins: with both "Selling Price" and "MRP", the selling price is what the buyer pays;
 * "Cost" (often the merchant's own cost) only wins when nothing better exists.
 */
export const COLUMN_SYNONYMS: Record<CanonicalColumn, readonly string[]> = {
  sku: ["sku", "item sku", "item code", "product code", "product id", "item id", "code", "id"],
  name: ["name", "product name", "item name", "title", "product title", "product", "item"],
  description: [
    "description",
    "product description",
    "long description",
    "details",
    "desc",
    "about",
  ],
  category: ["category", "product type", "type", "collection", "department"],
  price: ["price", "selling price", "sale price", "unit price", "mrp", "cost"],
  stock: ["stock", "qty", "quantity", "inventory", "in stock", "available", "units"],
  shipping_days: [
    "shipping days",
    "ships in",
    "shipping time",
    "delivery days",
    "delivery time",
    "dispatch days",
    "dispatch time",
    "lead time",
    "handling time",
  ],
  return_days: [
    "return days",
    "return window",
    "return period",
    "returns",
    "return policy days",
    "return policy",
  ],
  rating_avg: ["rating avg", "rating", "average rating", "avg rating", "stars", "review score"],
  review_count: [
    "review count",
    "reviews",
    "number of reviews",
    "no of reviews",
    "num reviews",
    "reviews count",
    "total reviews",
    "ratings count",
  ],
};

/** "Selling Price (USD)" -> "selling price"; "shipping_days" -> "shipping days"; "No. of Reviews" -> "no of reviews". */
export function normalizeHeader(header: string): string {
  return header
    .toLowerCase()
    .replace(/\([^)]*\)|\[[^\]]*\]/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

const SYNONYM_INDEX = new Map<string, { column: CanonicalColumn; rank: number }>();
for (const [column, synonyms] of Object.entries(COLUMN_SYNONYMS) as [
  CanonicalColumn,
  readonly string[],
][]) {
  synonyms.forEach((synonym, rank) =>
    SYNONYM_INDEX.set(normalizeHeader(synonym), { column, rank }),
  );
}

export interface ColumnMapping {
  /** Aligned with the header row: which of our columns each CSV column feeds, or null. */
  columns: (CanonicalColumn | null)[];
  /** Merchant header -> our column, for the mapping review screen. */
  mapping: Record<string, CanonicalColumn>;
  unmapped: string[];
  missingRequired: CanonicalColumn[];
}

/**
 * FR-02. Merchant-confirmed overrides first, then synonyms (best-ranked header per column).
 * Deterministic: same headers + overrides always give the same mapping.
 */
export function mapColumns(
  headers: string[],
  overrides: Record<string, CanonicalColumn> = {},
): ColumnMapping {
  const columns: (CanonicalColumn | null)[] = headers.map(() => null);
  const taken = new Set<CanonicalColumn>();
  const overridden = (header: string) => Object.hasOwn(overrides, header);

  headers.forEach((header, i) => {
    const target = overridden(header) ? overrides[header] : undefined;
    if (target && !taken.has(target)) {
      columns[i] = target;
      taken.add(target);
    }
  });

  const best = new Map<CanonicalColumn, { index: number; rank: number }>();
  headers.forEach((header, i) => {
    if (columns[i] || overridden(header)) return;
    const hit = SYNONYM_INDEX.get(normalizeHeader(header));
    if (!hit || taken.has(hit.column)) return;
    const current = best.get(hit.column);
    if (!current || hit.rank < current.rank) best.set(hit.column, { index: i, rank: hit.rank });
  });
  for (const [column, { index }] of best) columns[index] = column;

  const mapping: Record<string, CanonicalColumn> = {};
  const unmapped: string[] = [];
  headers.forEach((header, i) => {
    const column = columns[i];
    if (column) mapping[header] = column;
    else if (header.trim()) unmapped.push(header);
  });
  const mapped = new Set(columns);
  return {
    columns,
    mapping,
    unmapped,
    missingRequired: REQUIRED_COLUMNS.filter((c) => !mapped.has(c)),
  };
}
