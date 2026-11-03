/**
 * Proves the PayPal sandbox credentials work: creates one 1.00 USD sandbox order through the real
 * adapter and prints its approve URL. Approving it is optional; nothing is stored in OpenShelf.
 *
 *   pnpm paypal:smoke        (needs PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in .env)
 */
import { loadEnv } from "../bootstrap/env";
import { createPayPalProvider } from "../src/integrations/payments/paypal.provider";
import { AppError } from "../src/shared/errors";

const env = loadEnv();
if (!env.PAYPAL_CLIENT_ID || !env.PAYPAL_CLIENT_SECRET) {
  console.error(
    "PayPal sandbox credentials missing. Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in .env\n" +
      "(developer.paypal.com -> Apps & Credentials -> Sandbox -> your app).",
  );
  process.exit(1);
}

const paypal = createPayPalProvider({
  clientId: env.PAYPAL_CLIENT_ID,
  clientSecret: env.PAYPAL_CLIENT_SECRET,
});
const id = `smoke-${Date.now()}`;
const base = env.PUBLIC_BASE_URL.replace(/\/+$/, "");

try {
  const order = await paypal.createOrder({
    requestId: id,
    quoteId: id,
    amountMinor: 100,
    currency: "USD",
    description: "OpenShelf sandbox smoke test",
    payeeEmail: null,
    brandName: "OpenShelf",
    returnUrl: `${base}/paypal/return`,
    cancelUrl: `${base}/paypal/cancel`,
  });
  console.log("PayPal sandbox works.");
  console.log(`  order        ${order.paypalOrderId}`);
  console.log(`  approve URL  ${order.approveUrl}`);
} catch (err) {
  console.error(err instanceof AppError ? `${err.code}: ${err.message}` : err);
  process.exit(1);
}
