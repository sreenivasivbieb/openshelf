import type { Request, Response } from "express";
import { z } from "zod";
import type { Services } from "../../../services";
import { AppError } from "../../../shared/errors";

const ReturnQuery = z.object({ token: z.string().min(1).max(64) }); // PayPal's order id

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c] ?? c);
}

/** A tiny standalone page for the human who just left PayPal. Every value is escaped. */
function page(title: string, message: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>body{font-family:system-ui,sans-serif;max-width:34rem;margin:4rem auto;padding:0 16px;line-height:1.5}</style>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
<p>${escapeHtml(message)}</p>
</body>
</html>`;
}

/** What the buyer should know when the capture did not happen. */
function failureMessage(orderId: string, reason: string | undefined): string {
  if (reason === "OUT_OF_STOCK") {
    return `The item in order ${orderId} sold out before payment. No money was taken.`;
  }
  if (reason === "PAYMENT_PROVIDER_ERROR" || reason === "PAYMENT_NOT_CONFIGURED") {
    return `PayPal did not confirm the payment for order ${orderId}. Reload this page to try again.`;
  }
  return `PayPal did not take the payment for order ${orderId} (${reason ?? "unknown reason"}). No money was taken.`;
}

/** PayPal redirects the human here after approving or cancelling (FR-11). */
export function createPayPalController(s: Services) {
  return {
    async onReturn(req: Request, res: Response) {
      const query = ReturnQuery.safeParse(req.query);
      if (!query.success) {
        res
          .status(400)
          .type("html")
          .send(page("Checkout link incomplete", "This link is missing its PayPal checkout id."));
        return;
      }
      try {
        const result = await s.orders.captureApproved(query.data.token);
        if (result.captured) {
          res
            .type("html")
            .send(
              page(
                "Payment complete",
                `Order ${result.orderId} is paid. You can close this tab; your agent can track the order.`,
              ),
            );
        } else {
          res
            .status(409)
            .type("html")
            .send(page("Payment not completed", failureMessage(result.orderId, result.reason)));
        }
      } catch (err) {
        if (err instanceof AppError && err.code === "ORDER_NOT_FOUND") {
          res
            .status(404)
            .type("html")
            .send(
              page("Checkout not found", "We could not find this checkout. No money was taken."),
            );
          return;
        }
        throw err;
      }
    },

    onCancel(_req: Request, res: Response) {
      res
        .type("html")
        .send(page("Payment cancelled", "No money was taken. You can close this tab."));
    },
  };
}
