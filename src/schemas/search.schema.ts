import { z } from "zod";
import { ProductView } from "./product.schema";

export const SearchRequest = z.object({
  query: z.string().trim().min(1).max(200),
  max_price: z.number().positive().optional(),
  max_shipping_days: z.number().int().min(0).optional(),
  min_rating: z.number().min(0).max(5).optional(),
  in_stock_only: z.boolean().default(true),
  limit: z.number().int().min(1).max(50).default(10),
});
export type SearchRequest = z.infer<typeof SearchRequest>;

export const SearchResponse = z.object({ results: z.array(ProductView) });
export type SearchResponse = z.infer<typeof SearchResponse>;
