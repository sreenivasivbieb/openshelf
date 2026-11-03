import {
  CheckoutPaymentIntent,
  Client,
  Environment,
  OrdersController,
  PaymentsController,
  PaypalExperienceUserAction,
} from "@paypal/paypal-server-sdk";
import type { PaymentProvider } from "./payment-provider";
import {
  approveLinkOf,
  captureOf,
  formatAmount,
  isHttpErrorLike,
  paypalIssue,
} from "./paypal.mapping";
import { AppError } from "../../shared/errors";

export interface PayPalConfig {
  clientId: string;
  clientSecret: string;
}

/** Any SDK or network failure becomes a 502 with a short, secret-free reason. */
function providerError(err: unknown, action: string): AppError {
  if (err instanceof AppError) return err;
  return new AppError(
    "PAYMENT_PROVIDER_ERROR",
    `PayPal could not ${action} (${paypalIssue(err)}).`,
    502,
  );
}

/**
 * Adapter: PaymentProvider -> @paypal/paypal-server-sdk Orders v2 + Payments, SANDBOX ONLY (NFR-01).
 * Every call sends a PayPal-Request-Id, so retries are safe (ADR-0007).
 */
export function createPayPalProvider(config: PayPalConfig): PaymentProvider {
  const client = new Client({
    clientCredentialsAuthCredentials: {
      oAuthClientId: config.clientId,
      oAuthClientSecret: config.clientSecret,
    },
    environment: Environment.Sandbox,
    timeout: 15_000,
  });
  const orders = new OrdersController(client);
  const payments = new PaymentsController(client);

  return {
    async createOrder(input) {
      try {
        const { result } = await orders.createOrder({
          paypalRequestId: input.requestId,
          prefer: "return=representation",
          body: {
            intent: CheckoutPaymentIntent.Capture,
            purchaseUnits: [
              {
                referenceId: input.quoteId,
                invoiceId: input.quoteId,
                description: input.description.slice(0, 127),
                amount: { currencyCode: input.currency, value: formatAmount(input.amountMinor) },
                ...(input.payeeEmail ? { payee: { emailAddress: input.payeeEmail } } : {}),
              },
            ],
            paymentSource: {
              paypal: {
                experienceContext: {
                  brandName: input.brandName.slice(0, 127),
                  returnUrl: input.returnUrl,
                  cancelUrl: input.cancelUrl,
                  userAction: PaypalExperienceUserAction.PayNow,
                },
              },
            },
          },
        });
        const approveUrl = approveLinkOf(result.links);
        if (!result.id || !approveUrl) {
          throw new AppError(
            "PAYMENT_PROVIDER_ERROR",
            "PayPal returned an order without an approval link.",
            502,
          );
        }
        return { paypalOrderId: result.id, approveUrl };
      } catch (err) {
        throw providerError(err, "create the order");
      }
    },

    async captureOrder(input) {
      try {
        const { result } = await orders.captureOrder({
          id: input.paypalOrderId,
          paypalRequestId: input.requestId,
          prefer: "return=representation",
        });
        return { ...captureOf(result), raw: result };
      } catch (err) {
        // 422 = PayPal refused this capture (ORDER_NOT_APPROVED, INSTRUMENT_DECLINED, ...):
        // a failed capture the buyer can retry, not an outage.
        if (isHttpErrorLike(err) && err.statusCode === 422) {
          return {
            status: "FAILED",
            captureId: null,
            detail: paypalIssue(err),
            raw: err.result ?? null,
          };
        }
        throw providerError(err, "capture the payment");
      }
    },

    async refundCapture(input) {
      try {
        const { result } = await payments.refundCapturedPayment({
          captureId: input.captureId,
          paypalRequestId: input.requestId,
          prefer: "return=representation",
          body: {
            amount: { currencyCode: input.currency, value: formatAmount(input.amountMinor) },
          },
        });
        const status =
          result.status === "COMPLETED" || result.status === "PENDING" ? result.status : "FAILED";
        return { status, refundId: result.id ?? null, detail: result.status ?? null, raw: result };
      } catch (err) {
        if (isHttpErrorLike(err) && err.statusCode === 422) {
          return {
            status: "FAILED",
            refundId: null,
            detail: paypalIssue(err),
            raw: err.result ?? null,
          };
        }
        throw providerError(err, "refund the payment");
      }
    },
  };
}
