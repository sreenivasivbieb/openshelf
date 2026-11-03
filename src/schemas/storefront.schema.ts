import { z } from "zod";

/** Agent-readable storefront (/m/:id/store.json and /m/:id/store.md): clean, in-stock products only. */
export const StorefrontProduct = z.object({
  sku: z.string(),
  name: z.string(),
  category: z.string().nullable(),
  price: z.number(), // unit price, major units
  stock: z.number().int(),
  shipping_days: z.number().int(),
  return_days: z.number().int(),
  rating_avg: z.number().nullable(), // merchant-reported
  review_count: z.number().int().nullable(), // merchant-reported
});
export type StorefrontProduct = z.infer<typeof StorefrontProduct>;

export const Storefront = z.object({
  merchant_id: z.string(),
  name: z.string(),
  currency: z.string(),
  links: z.object({
    mcp: z.string(),
    rest: z.string(), // base for POST /search, /quote, /order, /return and GET /track/{order_id}
    openapi: z.string(),
    store_md: z.string(),
    store_json: z.string(),
  }),
  ratings_source: z.literal("merchant_reported"),
  products: z.array(StorefrontProduct),
  truncated: z.boolean(), // more clean, in-stock products exist than are listed
});
export type Storefront = z.infer<typeof Storefront>;
