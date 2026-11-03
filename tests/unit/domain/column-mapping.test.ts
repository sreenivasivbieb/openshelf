import { describe, expect, it } from "vitest";
import { mapColumns, normalizeHeader } from "../../../src/domain/column-mapping";

const SEED_HEADERS = [
  "SKU",
  "Product Name",
  "Details",
  "Category",
  "MRP",
  "Qty",
  "Ships In",
  "Return Window",
  "Rating",
  "Reviews",
];
const MESSY_HEADERS = [
  "Item Code",
  "Title",
  "Desc",
  "Selling Price (USD)",
  "Inventory",
  "Dispatch Days",
  "Returns",
  "Stars",
  "No. of Reviews",
];

describe("normalizeHeader", () => {
  it.each([
    [" Selling Price (USD) ", "selling price"],
    ["shipping_days", "shipping days"],
    ["No. of Reviews", "no of reviews"],
    ["Ships In [days]", "ships in"],
  ])("%j -> %j", (input, expected) => {
    expect(normalizeHeader(input)).toBe(expected);
  });
});

describe("mapColumns (FR-02)", () => {
  it("maps every seed catalog header", () => {
    const result = mapColumns(SEED_HEADERS);
    expect(result.mapping).toEqual({
      SKU: "sku",
      "Product Name": "name",
      Details: "description",
      Category: "category",
      MRP: "price",
      Qty: "stock",
      "Ships In": "shipping_days",
      "Return Window": "return_days",
      Rating: "rating_avg",
      Reviews: "review_count",
    });
    expect(result.unmapped).toEqual([]);
    expect(result.missingRequired).toEqual([]);
  });

  it("maps messy headers with units and punctuation", () => {
    expect(mapColumns(MESSY_HEADERS).mapping).toEqual({
      "Item Code": "sku",
      Title: "name",
      Desc: "description",
      "Selling Price (USD)": "price",
      Inventory: "stock",
      "Dispatch Days": "shipping_days",
      Returns: "return_days",
      Stars: "rating_avg",
      "No. of Reviews": "review_count",
    });
  });

  it("prefers the selling price over MRP and cost", () => {
    const result = mapColumns(["Cost", "MRP", "Selling Price", "Name"]);
    expect(result.mapping).toEqual({ "Selling Price": "price", Name: "name" });
    expect(result.unmapped).toEqual(["Cost", "MRP"]);
  });

  it("lets the merchant's corrections win over synonyms", () => {
    const result = mapColumns(["Blurb", "Description", "Price"], { Blurb: "description" });
    expect(result.mapping).toEqual({ Blurb: "description", Price: "price" });
    expect(result.unmapped).toEqual(["Description"]);
  });

  it("reports required columns it could not find", () => {
    expect(mapColumns(["Name", "Price"]).missingRequired).toEqual([
      "stock",
      "shipping_days",
      "return_days",
    ]);
  });

  it("ignores empty header cells and is deterministic", () => {
    expect(mapColumns(["Name", ""]).unmapped).toEqual([]);
    expect(mapColumns(MESSY_HEADERS)).toEqual(mapColumns(MESSY_HEADERS));
  });
});
