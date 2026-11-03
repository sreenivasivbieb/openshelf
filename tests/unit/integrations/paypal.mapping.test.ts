import { describe, expect, it } from "vitest";
import {
  approveLinkOf,
  captureOf,
  formatAmount,
  paypalIssue,
} from "../../../src/integrations/payments/paypal.mapping";
import { createPayPalProvider } from "../../../src/integrations/payments/paypal.provider";

describe("formatAmount", () => {
  it.each([
    [0, "0.00"],
    [5, "0.05"],
    [99, "0.99"],
    [3600, "36.00"],
    [123456, "1234.56"],
  ])("%d minor units -> %s", (minor, expected) => {
    expect(formatAmount(minor)).toBe(expected);
  });

  it.each([-1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1])("refuses %d", (minor) => {
    expect(() => formatAmount(minor)).toThrow(TypeError);
  });
});

describe("approveLinkOf", () => {
  const self = { rel: "self", href: "https://api.paypal.test/v2/checkout/orders/1" };
  const approve = { rel: "approve", href: "https://paypal.test/approve" };
  const payerAction = { rel: "payer-action", href: "https://paypal.test/payer-action" };

  it("prefers payer-action, falls back to approve", () => {
    expect(approveLinkOf([self, approve, payerAction])).toBe(payerAction.href);
    expect(approveLinkOf([self, approve])).toBe(approve.href);
  });

  it("returns null when there is no approval link", () => {
    expect(approveLinkOf([self])).toBeNull();
    expect(approveLinkOf(undefined)).toBeNull();
  });
});

describe("captureOf", () => {
  const order = (status?: string, id = "CAP-1") => ({
    purchaseUnits: [{ payments: { captures: [{ id, status }] } }],
  });

  it("reads a completed capture", () => {
    expect(captureOf(order("COMPLETED"))).toEqual({
      status: "COMPLETED",
      captureId: "CAP-1",
      detail: "COMPLETED",
    });
  });

  it("treats a pending capture as charged and keeps PayPal's status", () => {
    expect(captureOf(order("PENDING"))).toEqual({
      status: "COMPLETED",
      captureId: "CAP-1",
      detail: "PENDING",
    });
  });

  it("treats anything else, or no capture at all, as failed", () => {
    expect(captureOf(order("DECLINED"))).toEqual({
      status: "FAILED",
      captureId: "CAP-1",
      detail: "DECLINED",
    });
    expect(captureOf({})).toEqual({ status: "FAILED", captureId: null, detail: null });
  });
});

describe("paypalIssue", () => {
  it("prefers the issue code, then the error name, then the HTTP status", () => {
    const declined = {
      statusCode: 422,
      result: { name: "UNPROCESSABLE_ENTITY", details: [{ issue: "ORDER_NOT_APPROVED" }] },
    };
    expect(paypalIssue(declined)).toBe("ORDER_NOT_APPROVED");
    expect(paypalIssue({ statusCode: 401, result: { name: "AUTHENTICATION_FAILURE" } })).toBe(
      "AUTHENTICATION_FAILURE",
    );
    expect(paypalIssue({ statusCode: 500 })).toBe("HTTP 500");
  });

  it("never echoes raw error messages (they can carry request data)", () => {
    expect(paypalIssue(new Error("client_secret=abc123 rejected"))).toBe("network error");
  });
});

describe("createPayPalProvider", () => {
  it("builds the adapter without touching the network", () => {
    const provider = createPayPalProvider({ clientId: "id", clientSecret: "secret" });
    expect(Object.keys(provider).sort()).toEqual(["captureOrder", "createOrder", "refundCapture"]);
  });
});
