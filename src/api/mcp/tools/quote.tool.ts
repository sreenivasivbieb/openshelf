import { z } from "zod";
import { QuoteFail, QuotePass, QuoteRequest } from "../../../schemas/quote.schema";
import { defineTool } from "./tool";

/**
 * MCP output schemas must be JSON objects, and QuoteResponse is a union (pass | fail).
 * This object form lists every field of both shapes; all optional except `status`.
 */
export const QuoteToolOutput = z.object({
  status: z.enum(["pass", "fail"]),
  ...QuotePass.omit({ status: true }).partial().shape,
  ...QuoteFail.omit({ status: true }).partial().shape,
});

export const quoteTool = defineTool({
  name: "quote",
  title: "Quote a product against the buyer's rules",
  description:
    "Check one SKU against the buyer's rules (max_budget, max_shipping_days, min_return_days, min_rating, " +
    "min_review_count). A pass locks price and terms until expires_at and returns quote_hash plus the " +
    "locked_terms it covers. A fail returns every failed rule (reason_codes), the product's real terms, a " +
    "retry_hint and, when one exists, nearest_passing_sku.",
  inputSchema: QuoteRequest,
  outputSchema: QuoteToolOutput,
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
  },
  run: (s, ctx, input) =>
    s.telemetry.record(ctx, "quote", input, () => s.quotes.create(ctx, input)),
});
