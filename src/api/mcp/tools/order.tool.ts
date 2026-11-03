import { OrderRequest, OrderResponse } from "../../../schemas/order.schema";
import { defineTool } from "./tool";

export const orderTool = defineTool({
  name: "order",
  title: "Order a quoted product",
  description:
    "Create a PayPal order for a passing quote_id before it expires. Returns approve_url: the human buyer " +
    "must open it and approve the payment in PayPal; you cannot pay for them. Calling again with the same " +
    "quote_id returns the same order.",
  inputSchema: OrderRequest,
  outputSchema: OrderResponse,
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  },
  run: (s, ctx, input) => s.telemetry.record(ctx, "order", input, () => s.orders.place(ctx, input)),
});
