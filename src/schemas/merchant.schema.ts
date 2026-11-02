import { z } from "zod";

export const CreateMerchantRequest = z.object({
  name: z.string().trim().min(1).max(120),
  currency: z.string().length(3).default("USD"),
  paypal_payee_email: z.email().optional(), // sandbox seller account
});
export type CreateMerchantRequest = z.infer<typeof CreateMerchantRequest>;

/** What onboarding returns once a store is live (FR-06). */
export const StoreInfo = z.object({
  merchant_id: z.string(),
  name: z.string(),
  spec_status: z.enum(["pending", "ready", "fallback"]),
  mcp_url: z.string(),
  openapi_url: z.string(),
  products: z.object({
    total: z.number().int(),
    clean: z.number().int(),
    flagged: z.number().int(),
  }),
});
export type StoreInfo = z.infer<typeof StoreInfo>;
