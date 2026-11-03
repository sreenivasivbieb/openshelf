import type { Request, Response } from "express";
import type { Services } from "../../../services";
import { SearchRequest } from "../../../schemas/search.schema";
import { QuoteRequest } from "../../../schemas/quote.schema";
import { OrderRequest } from "../../../schemas/order.schema";
import { getAgentContext } from "../middlewares/agent-context";

/**
 * Buyer-facing REST (FR-07, FR-08, FR-11, FR-12). Every handler is one telemetry.record() call;
 * validation happens inside it, so malformed agent calls are logged too (NFR-06).
 */
export function createStoreController(s: Services) {
  return {
    async search(req: Request, res: Response) {
      const ctx = getAgentContext(res);
      res.json(
        await s.telemetry.record(ctx, "search", req.body, () =>
          s.catalog.search(ctx.merchantId, SearchRequest.parse(req.body)),
        ),
      );
    },

    async quote(req: Request, res: Response) {
      const ctx = getAgentContext(res);
      res.json(
        await s.telemetry.record(ctx, "quote", req.body, () =>
          s.quotes.create(ctx, QuoteRequest.parse(req.body)),
        ),
      );
    },

    async order(req: Request, res: Response) {
      const ctx = getAgentContext(res);
      res
        .status(201)
        .json(
          await s.telemetry.record(ctx, "order", req.body, () =>
            s.orders.place(ctx, OrderRequest.parse(req.body)),
          ),
        );
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
