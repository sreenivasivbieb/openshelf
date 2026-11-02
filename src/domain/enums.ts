import { z } from "zod";

/** Why a quote failed (FR-10). Agents branch on these: never rename one, only add. */
export const QuoteReasonCode = z.enum([
  "SKU_NOT_FOUND",
  "OUT_OF_STOCK",
  "PRODUCT_FLAGGED", // failed the prompt firewall at upload (FR-05)
  "OVER_BUDGET",
  "SHIPPING_TOO_SLOW",
  "RETURN_WINDOW_TOO_SHORT",
  "RATING_TOO_LOW",
  "RATING_UNKNOWN", // buyer set min_rating but the merchant gave none
  "TOO_FEW_REVIEWS",
]);
export type QuoteReasonCode = z.infer<typeof QuoteReasonCode>;

/** Why /order refused a quote (FR-11). */
export const OrderErrorCode = z.enum([
  "QUOTE_NOT_FOUND",
  "QUOTE_EXPIRED",
  "QUOTE_HASH_MISMATCH",
  "OUT_OF_STOCK",
  "PAYMENT_PROVIDER_ERROR",
]);
export type OrderErrorCode = z.infer<typeof OrderErrorCode>;

export const OrderStatus = z.enum([
  "CREATED", // PayPal order exists, waiting for the human
  "APPROVED",
  "CAPTURED",
  "CAPTURE_FAILED",
  "SHIPPED",
  "DELIVERED",
  "RETURN_REQUESTED",
  "REFUNDED",
]);
export type OrderStatus = z.infer<typeof OrderStatus>;

export type FirewallStatus = "pending" | "clean" | "flagged";
export type SpecStatus = "pending" | "ready" | "fallback";
export type AgentTool = "search" | "quote" | "order" | "track" | "return";
export type Channel = "rest" | "mcp";
