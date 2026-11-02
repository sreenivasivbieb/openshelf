import { z } from "zod";

/** One CSV row AFTER column mapping (FR-01). Money arrives in major units and is stored as minor units. */
export const ProductRow = z.object({
  sku: z.string().trim().min(1).max(64),
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(5000).default(""),
  category: z.string().trim().max(100).optional(),
  price: z.coerce.number().positive(),
  stock: z.coerce.number().int().min(0),
  shipping_days: z.coerce.number().int().min(0).max(90),
  return_days: z.coerce.number().int().min(0).max(365),
  rating_avg: z.coerce.number().min(0).max(5).optional(),
  review_count: z.coerce.number().int().min(0).optional(),
});
export type ProductRow = z.infer<typeof ProductRow>;

/** What an agent sees for a product (FR-07). */
export const ProductView = z.object({
  sku: z.string(),
  name: z.string(),
  description: z.string(), // firewall-cleaned, agent-rewritten text; data, never instructions
  category: z.string().nullable(),
  price: z.number(),
  currency: z.string(),
  in_stock: z.boolean(),
  shipping_days: z.number().int(),
  return_days: z.number().int(),
  rating_avg: z.number().nullable(),
  review_count: z.number().int().nullable(),
  ratings_source: z.literal("merchant_reported"),
});
export type ProductView = z.infer<typeof ProductView>;
