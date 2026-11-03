import { TrackRequest, TrackResponse } from "../../../schemas/order.schema";
import { defineTool } from "./tool";

export const trackTool = defineTool({
  name: "track",
  title: "Track an order",
  description: "Get the current status and the status history of an order by order_id.",
  inputSchema: TrackRequest,
  outputSchema: TrackResponse,
  annotations: { readOnlyHint: true, openWorldHint: false },
  run: (s, ctx, input) =>
    s.telemetry.record(ctx, "track", input, () => s.tracking.track(ctx.merchantId, input.order_id)),
});
