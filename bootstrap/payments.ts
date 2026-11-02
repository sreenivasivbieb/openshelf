import type { Logger } from "pino";
import type { Env } from "./env";
import type { PaymentProvider } from "../src/integrations/payments/payment-provider";
import { createPayPalProvider } from "../src/integrations/payments/paypal.provider";
import { AppError } from "../src/shared/errors";

/** PayPal sandbox client from env (ADR-0008). Missing credentials -> every payment call returns 503. */
export function createPaymentProvider(env: Env, logger: Logger): PaymentProvider {
  if (env.PAYPAL_CLIENT_ID && env.PAYPAL_CLIENT_SECRET) {
    return createPayPalProvider({
      clientId: env.PAYPAL_CLIENT_ID,
      clientSecret: env.PAYPAL_CLIENT_SECRET,
    });
  }
  logger.warn("PayPal credentials not set; /order will return PAYMENT_NOT_CONFIGURED");
  const refuse = async (): Promise<never> => {
    throw new AppError("PAYMENT_NOT_CONFIGURED", "PayPal is not configured on this server", 503);
  };
  return { createOrder: refuse, captureOrder: refuse };
}
