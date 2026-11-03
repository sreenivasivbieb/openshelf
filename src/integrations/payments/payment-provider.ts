/**
 * Port for the payment system (FR-11). Services depend on this interface, never on the PayPal SDK,
 * so tests use a fake and the money path stays testable without network.
 */
export interface CreatePaymentInput {
  /** PayPal-Request-Id: the quote id, so a retried create returns the same PayPal order (ADR-0007). */
  requestId: string;
  /** Purchase-unit reference and invoice id: the quote id. */
  quoteId: string;
  amountMinor: number;
  currency: string;
  description: string;
  payeeEmail: string | null; // merchant's sandbox business account (ADR-0008); null = platform account
  brandName: string; // shown on the PayPal approval page
  returnUrl: string;
  cancelUrl: string;
}

export interface CreatedPayment {
  paypalOrderId: string;
  approveUrl: string; // where the human approves the payment
}

export interface CapturePaymentInput {
  paypalOrderId: string;
  /** PayPal-Request-Id: our order id, so a retried capture never charges twice. */
  requestId: string;
}

export interface CaptureResult {
  /** COMPLETED also covers a PENDING capture: the buyer is charged and PayPal settles it later. */
  status: "COMPLETED" | "FAILED";
  captureId: string | null;
  /** PayPal's own capture status or issue code, kept in the order history. */
  detail: string | null;
  raw: unknown;
}

export interface RefundInput {
  captureId: string;
  amountMinor: number;
  currency: string;
  /** PayPal-Request-Id, so a retried refund never refunds twice. */
  requestId: string;
}

export interface RefundResult {
  status: "COMPLETED" | "PENDING" | "FAILED";
  refundId: string | null;
  detail: string | null;
  raw: unknown;
}

export interface PaymentProvider {
  createOrder(input: CreatePaymentInput): Promise<CreatedPayment>;
  captureOrder(input: CapturePaymentInput): Promise<CaptureResult>;
  refundCapture(input: RefundInput): Promise<RefundResult>;
}
