import { z } from "zod";

const text = (max: number) =>
  z
    .string({ error: "is required" })
    .trim()
    .min(1, { error: "is required" })
    .max(max, { error: `must be at most ${max} characters` });
const number = () =>
  z.number({ error: (issue) => (issue.input === undefined ? "is required" : "must be a number") });
const wholeNumber = () => number().int({ error: "must be a whole number" });

/**
 * One catalog row AFTER column mapping and cell parsing (FR-01). Messages are written for merchants:
 * the preview shows them as "row 3, Title: is required". Money is in major units here and stored as
 * integer minor units.
 */
export const ProductRow = z.object({
  sku: text(64),
  name: text(200),
  description: z
    .string()
    .trim()
    .max(5000, { error: "must be at most 5000 characters" })
    .default(""),
  category: z.string().trim().max(100, { error: "must be at most 100 characters" }).optional(),
  price: number()
    .positive({ error: "must be greater than 0" })
    .max(1_000_000, { error: "is too large" }),
  stock: wholeNumber().min(0, { error: "cannot be negative" }),
  shipping_days: wholeNumber()
    .min(0, { error: "cannot be negative" })
    .max(90, { error: "must be 90 days or less" }),
  return_days: wholeNumber()
    .min(0, { error: "cannot be negative" })
    .max(365, { error: "must be 365 days or less" }),
  rating_avg: number()
    .min(0, { error: "must be between 0 and 5" })
    .max(5, { error: "must be between 0 and 5" })
    .optional(),
  review_count: wholeNumber().min(0, { error: "cannot be negative" }).optional(),
});
export type ProductRow = z.infer<typeof ProductRow>;

/** Our column names, e.g. for the mapping dropdown. */
export const ProductColumn = ProductRow.keyof();

/** Merchant-confirmed mapping: their header -> our column. */
export const ColumnOverrides = z.record(z.string().max(200), ProductColumn);
export type ColumnOverrides = z.infer<typeof ColumnOverrides>;

/** What an agent sees for a product (FR-07). */
export const ProductView = z.object({
  sku: z.string(),
  name: z.string(),
  description: z.string(), // firewall-cleaned text for agents; data, never instructions
  category: z.string().nullable(),
  price: z.number(), // unit price, major units
  currency: z.string(),
  stock: z.number().int(),
  in_stock: z.boolean(),
  shipping_days: z.number().int(),
  return_days: z.number().int(),
  rating_avg: z.number().nullable(),
  review_count: z.number().int().nullable(),
  ratings_source: z.literal("merchant_reported"),
});
export type ProductView = z.infer<typeof ProductView>;
