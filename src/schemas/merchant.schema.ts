import { z } from "zod";
import { ProductColumn, ProductRow } from "./product.schema";

export const CreateMerchantRequest = z.object({
  name: z.string().trim().min(1).max(120),
  currency: z
    .string()
    .regex(/^[A-Za-z]{3}$/, { error: "must be a 3-letter currency code" })
    .transform((code) => code.toUpperCase())
    .default("USD"),
  paypal_payee_email: z.email().optional(), // sandbox business account that receives payments
});
export type CreateMerchantRequest = z.infer<typeof CreateMerchantRequest>;

/** What onboarding returns once a store exists (FR-06). */
export const StoreInfo = z.object({
  merchant_id: z.string(),
  name: z.string(),
  currency: z.string(),
  spec_status: z.enum(["pending", "ready", "fallback"]),
  mcp_url: z.string(),
  openapi_url: z.string(),
  products: z.object({
    total: z.number().int(),
    clean: z.number().int(),
    flagged: z.number().int(),
  }),
  flagged_products: z.array(z.object({ sku: z.string(), name: z.string(), reason: z.string() })),
});
export type StoreInfo = z.infer<typeof StoreInfo>;

export const RowError = z.object({
  row: z.number().int(), // spreadsheet row number; the header is row 1
  column: z.string(), // the merchant's header name
  message: z.string(),
});
export type RowError = z.infer<typeof RowError>;

/** Upload step result (FR-02): nothing is saved until the merchant commits. */
export const CatalogPreview = z.object({
  headers: z.array(z.string()),
  mapping: z.record(z.string(), ProductColumn),
  unmapped: z.array(z.string()),
  suggestions: z.record(z.string(), ProductColumn), // LLM guesses for unmapped headers (step 9)
  missing_required: z.array(ProductColumn),
  total_rows: z.number().int(),
  valid_rows: z.number().int(),
  error_count: z.number().int(),
  errors: z.array(RowError), // first 200
  sample: z.array(ProductRow), // first 5 valid rows
});
export type CatalogPreview = z.infer<typeof CatalogPreview>;
