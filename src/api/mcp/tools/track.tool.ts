import { TrackRequest } from "../../../schemas/order.schema";
import { defineTool } from "./tool";

export const trackTool = defineTool({
  name: "track",
  description: "Get the status and status history of an order by order_id.",
  inputSchema: TrackRequest,
  run: (s, ctx, input) =>
    s.telemetry.record(ctx, "track", input, () => s.tracking.track(ctx.merchantId, input.order_id)),
});
