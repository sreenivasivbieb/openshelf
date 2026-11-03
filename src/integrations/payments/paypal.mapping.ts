/** Pure helpers between our payment port and PayPal Orders v2 payloads. No SDK, no network. */

/** 3600 -> "36.00". Amounts are integer minor units of a 2-decimal currency. */
export function formatAmount(minor: number): string {
  if (!Number.isSafeInteger(minor) || minor < 0) {
    throw new TypeError("Amount must be a non-negative integer number of minor units");
  }
  return `${Math.floor(minor / 100)}.${String(minor % 100).padStart(2, "0")}`;
}

interface Link {
  rel: string;
  href: string;
}

/** Where the buyer approves: "payer-action" for payment_source flows, "approve" for older ones. */
export function approveLinkOf(links: readonly Link[] | undefined): string | null {
  return (
    links?.find((l) => l.rel === "payer-action")?.href ??
    links?.find((l) => l.rel === "approve")?.href ??
    null
  );
}

interface CapturedOrder {
  purchaseUnits?: { payments?: { captures?: { id?: string; status?: string }[] } }[];
}

/**
 * Reads the capture out of a captured order. COMPLETED and PENDING both mean the buyer was charged
 * (PENDING settles later), so both count as COMPLETED; anything else failed.
 */
export function captureOf(order: CapturedOrder): {
  status: "COMPLETED" | "FAILED";
  captureId: string | null;
  detail: string | null;
} {
  const capture = order.purchaseUnits?.[0]?.payments?.captures?.[0];
  const charged = capture?.status === "COMPLETED" || capture?.status === "PENDING";
  return {
    status: charged ? "COMPLETED" : "FAILED",
    captureId: capture?.id ?? null,
    detail: capture?.status ?? null,
  };
}

interface HttpErrorLike {
  statusCode: number;
  result?: unknown;
}

/** Duck-typed so it also matches the SDK's ApiError subclasses (and is testable without them). */
export function isHttpErrorLike(err: unknown): err is HttpErrorLike {
  return (
    typeof err === "object" &&
    err !== null &&
    typeof (err as { statusCode?: unknown }).statusCode === "number"
  );
}

/**
 * A short, safe description of a PayPal failure: the first issue code ("ORDER_NOT_APPROVED"), else the
 * error name, else the HTTP status. Never includes request data or credentials.
 */
export function paypalIssue(err: unknown): string {
  if (!isHttpErrorLike(err)) return "network error";
  const result = (err.result ?? {}) as { name?: unknown; details?: { issue?: unknown }[] };
  const issue = result.details?.[0]?.issue;
  if (typeof issue === "string" && issue) return issue;
  if (typeof result.name === "string" && result.name) return result.name;
  return `HTTP ${err.statusCode}`;
}
