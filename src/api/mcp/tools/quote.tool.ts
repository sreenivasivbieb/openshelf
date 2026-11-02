import { QuoteRequest } from "../../../schemas/quote.schema";
import { defineTool } from "./tool";

export const quoteTool = defineTool({
  name: "quote",
  description:
    "Check one SKU against the buyer's rules (max_budget, max_shipping_days, min_return_days, min_rating, " +
    "min_review_count). Returns a locked quote (price, expiry, sha256 quote_hash) or reason_codes with a retry hint.",
  inputSchema: QuoteRequest,
  run: (s, ctx, input) =>
    s.telemetry.record(ctx, "quote", input, () => s.quotes.create(ctx, input)),
});
