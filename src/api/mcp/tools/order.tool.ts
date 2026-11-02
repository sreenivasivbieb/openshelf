import { OrderRequest } from "../../../schemas/order.schema";
import { defineTool } from "./tool";

export const orderTool = defineTool({
  name: "order",
  description:
    "Create a PayPal order for a passing quote_id. Returns approve_url: the human must approve the payment " +
    "in PayPal. Calling again with the same quote_id returns the same order.",
  inputSchema: OrderRequest,
  run: (s, ctx, input) => s.telemetry.record(ctx, "order", input, () => s.orders.place(ctx, input)),
});
