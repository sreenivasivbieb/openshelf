import { describe, expect, it } from "vitest";
import { parseNumberCell, parseTextCell, skuFromName } from "../../../src/domain/csv-cells";

describe("parseNumberCell", () => {
  it.each([
    ["36", 36],
    ["$36.50", 36.5],
    ["Rs. 499", 499],
    ["499 INR", 499],
    ["1,299.00", 1299],
    ["3 days", 3],
    ["1 day", 1],
    ["4.5/5", 4.5],
    ["4.5 stars", 4.5],
    ["-4", -4],
    [".5", 0.5],
  ])("%j -> %d", (raw, expected) => {
    expect(parseNumberCell(raw)).toBe(expected);
  });

  it.each(["two", "7-10", "12,34", "0x10", "1e3", "USD"])("%j is not a number", (raw) => {
    expect(parseNumberCell(raw)).toBeNaN();
  });

  it.each([undefined, "", "   "])("%j is empty", (raw) => {
    expect(parseNumberCell(raw)).toBeUndefined();
  });
});

describe("parseTextCell", () => {
  it("trims, and treats blank as missing", () => {
    expect(parseTextCell("  Clay pot ")).toBe("Clay pot");
    expect(parseTextCell("   ")).toBeUndefined();
  });
});

describe("skuFromName", () => {
  it("slugs Latin names, folding accents", () => {
    expect(skuFromName("Hand-glazed ceramic mug")).toBe("HAND-GLAZED-CERAMIC-MUG");
    expect(skuFromName("Café crème")).toBe("CAFE-CREME");
  });

  it("caps length without a trailing dash", () => {
    const sku = skuFromName("An extremely long product name that keeps going and going");
    expect(sku.length).toBeLessThanOrEqual(40);
    expect(sku.endsWith("-")).toBe(false);
  });

  it("gives non-Latin names a stable hash SKU", () => {
    expect(skuFromName("चाय पत्ती")).toMatch(/^ITEM-[0-9A-F]{8}$/);
    expect(skuFromName("चाय पत्ती")).toBe(skuFromName("चाय पत्ती"));
  });
});
