import { describe, expect, it } from "vitest";
import { escapeHtml } from "../../../src/api/http/controllers/paypal.controller";

describe("escapeHtml", () => {
  it("escapes everything that could break out of text or an attribute", () => {
    expect(escapeHtml(`<script>alert("x")</script> & 'y'`)).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;y&#39;",
    );
  });

  it("leaves ordinary text alone", () => {
    expect(escapeHtml("Order o_abc123 is paid.")).toBe("Order o_abc123 is paid.");
  });
});
