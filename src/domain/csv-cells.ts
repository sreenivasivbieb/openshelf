import { createHash } from "node:crypto";

const CURRENCY_PREFIX = /^(?:[$₹€£¥]|usd|inr|eur|gbp|rs\.?)\s*/i;
const UNIT_SUFFIX = /\s*(?:usd|inr|eur|gbp|days?|d|pcs|units?|stars?|\/\s*5)$/i;
const THOUSANDS = /^\d{1,3}(?:,\d{3})+(?:\.\d+)?$/;
const PLAIN_NUMBER = /^[-+]?(?:\d+(?:\.\d+)?|\.\d+)$/;

/**
 * A spreadsheet number cell: "36", "$36.50", "Rs. 499", "1,299", "3 days", "4.5/5".
 * undefined when the cell is empty (so required columns report "is required"),
 * NaN when it is not a number (so validation reports "must be a number"). Ranges like "7-10" are NaN.
 */
export function parseNumberCell(raw: string | undefined): number | undefined {
  const trimmed = raw?.trim();
  if (!trimmed) return undefined;
  let s = trimmed.replace(CURRENCY_PREFIX, "").replace(UNIT_SUFFIX, "").trim();
  if (THOUSANDS.test(s)) s = s.replaceAll(",", "");
  return PLAIN_NUMBER.test(s) ? Number(s) : Number.NaN;
}

/** A text cell, trimmed; undefined when empty. */
export function parseTextCell(raw: string | undefined): string | undefined {
  const trimmed = raw?.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * Stable SKU for catalogs without a SKU column: "Hand-glazed ceramic mug" -> "HAND-GLAZED-CERAMIC-MUG".
 * Names with no Latin letters or digits get a short hash instead, so the same name keeps the same SKU.
 */
export function skuFromName(name: string): string {
  const slug = name
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "");
  return (
    slug || `ITEM-${createHash("sha256").update(name).digest("hex").slice(0, 8).toUpperCase()}`
  );
}
