import { ReturnRequest, ReturnResponse } from "../../../schemas/order.schema";
import { defineTool } from "./tool";

export const returnTool = defineTool({
  name: "return",
  title: "Return an order",
  description:
    "Return a paid order (CAPTURED, SHIPPED, or DELIVERED within the quote's return_days) and refund " +
    "its full locked total to the buyer through PayPal. Calling again with the same order_id is safe.",
  inputSchema: ReturnRequest,
  outputSchema: ReturnResponse,
  annotations: { destructiveHint: true, idempotentHint: true, openWorldHint: true },
  run: (s, ctx, input) =>
    s.telemetry.record(ctx, "return", input, () => s.orders.requestReturn(ctx, input)),
});
