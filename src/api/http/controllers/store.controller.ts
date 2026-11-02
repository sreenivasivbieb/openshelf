import type { Request, Response } from "express";
import type { Services } from "../../../services";
import { SearchRequest } from "../../../schemas/search.schema";
import { QuoteRequest } from "../../../schemas/quote.schema";
import { OrderRequest } from "../../../schemas/order.schema";
import { getAgentContext } from "../middlewares/agent-context";

/** Buyer-facing REST (FR-07, FR-08, FR-11, FR-12). Validate -> telemetry.record(service call) -> JSON. */
export function createStoreController(s: Services) {
  return {
    async search(req: Request, res: Response) {
      const ctx = getAgentContext(res);
      const input = SearchRequest.parse(req.body);
      res.json(
        await s.telemetry.record(ctx, "search", input, () =>
          s.catalog.search(ctx.merchantId, input),
        ),
      );
    },

    async quote(req: Request, res: Response) {
      const ctx = getAgentContext(res);
      const input = QuoteRequest.parse(req.body);
      res.json(await s.telemetry.record(ctx, "quote", input, () => s.quotes.create(ctx, input)));
    },

    async order(req: Request, res: Response) {
      const ctx = getAgentContext(res);
      const input = OrderRequest.parse(req.body);
      res
        .status(201)
        .json(await s.telemetry.record(ctx, "order", input, () => s.orders.place(ctx, input)));
    },

    async track(req: Request<{ orderId: string }>, res: Response) {
      const ctx = getAgentContext(res);
      const input = { order_id: req.params.orderId };
      res.json(
        await s.telemetry.record(ctx, "track", input, () =>
          s.tracking.track(ctx.merchantId, input.order_id),
        ),
      );
    },

    openapi(_req: Request, res: Response) {
      res.json(s.onboarding.getSpec(getAgentContext(res).merchantId));
    },
  };
}
