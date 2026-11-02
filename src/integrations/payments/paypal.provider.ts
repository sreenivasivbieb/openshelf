import type { PaymentProvider } from "./payment-provider";
import { notImplemented } from "../../shared/errors";

export interface PayPalConfig {
  clientId: string;
  clientSecret: string;
}

/**
 * Adapter: PaymentProvider -> @paypal/paypal-server-sdk, Orders v2, sandbox only (NFR-01). Build step 5.
 *   createOrder: intent CAPTURE, purchase unit amount = quote total, payee = merchant email,
 *                PayPal-Request-Id = quoteId, experience context return/cancel URLs; returns approve link
 *   captureOrder: capture after the buyer approved in PayPal
 */
export function createPayPalProvider(_config: PayPalConfig): PaymentProvider {
  return {
    createOrder: async () => notImplemented("step 5"),
    captureOrder: async () => notImplemented("step 5"),
  };
}
