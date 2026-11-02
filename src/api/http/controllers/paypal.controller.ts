import type { Request, Response } from "express";
import { z } from "zod";
import type { Services } from "../../../services";

const ReturnQuery = z.object({ token: z.string().min(1) }); // PayPal sends its order id as ?token=

/** PayPal redirects the human here after approve/cancel (FR-11). */
export function createPayPalController(s: Services) {
  return {
    async onReturn(req: Request, res: Response) {
      const { token } = ReturnQuery.parse(req.query);
      const result = await s.orders.captureApproved(token);
      res
        .type("html")
        .send(
          result.captured
            ? `<p>Payment complete. Order ${result.orderId}. You can close this tab.</p>`
            : `<p>Payment could not be completed (order ${result.orderId}). No money was taken.</p>`,
        );
    },

    onCancel(_req: Request, res: Response) {
      res.type("html").send("<p>Payment cancelled. No money was taken.</p>");
    },
  };
}
