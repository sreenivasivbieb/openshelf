/**
 * Port for the payment system (FR-11). Services depend on this interface, never on the PayPal SDK,
 * so tests use a fake and the money path stays testable without network.
 */
export interface CreatePaymentInput {
  quoteId: string; // also sent as the idempotency key (ADR-0007)
  amountMinor: number;
  currency: string;
  payeeEmail: string | null; // merchant's sandbox seller account (ADR-0008)
  returnUrl: string;
  cancelUrl: string;
}

export interface PaymentProvider {
  createOrder(input: CreatePaymentInput): Promise<{ paypalOrderId: string; approveUrl: string }>;
  captureOrder(paypalOrderId: string): Promise<{ status: "COMPLETED" | "FAILED"; raw: unknown }>;
}
