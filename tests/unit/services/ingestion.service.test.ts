import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createIngestionService, detectDelimiter } from "../../../src/services/ingestion.service";

const ROOT = join(import.meta.dirname, "..", "..", "..");
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");
const ingestion = createIngestionService({ llm: null });
const HEADER = "Name,Price,Stock,Shipping Days,Return Days";

describe("ingestion (FR-01, FR-02)", () => {
  it("reads the seed catalog without problems", async () => {
    const report = await ingestion.parse(read("database/seeds/demo-merchant.csv"));
    expect(report.errors).toEqual([]);
    expect(report.rows).toHaveLength(10);
    expect(report.rows.find((r) => r.sku === "MUG-014")).toEqual({
      sku: "MUG-014",
      name: "Hand-glazed ceramic mug",
      description: "350 ml stoneware mug glazed by hand. Dishwasher safe.",
      category: "Kitchen",
      price: 36,
      stock: 40,
      shipping_days: 3,
      return_days: 30,
      rating_avg: 4.6,
      review_count: 128,
    });
    const scarf = report.rows.find((r) => r.sku === "SCARF-07");
    expect(scarf?.rating_avg).toBeUndefined();
    expect(scarf?.review_count).toBeUndefined();
  });

  it("reports every problem with its spreadsheet row and the merchant's header", async () => {
    const report = await ingestion.parse(read("tests/fixtures/catalog-messy-headers.csv"));
    expect(report.rows.map((r) => r.sku)).toEqual(["A-1"]);
    expect(report.errors).toEqual([
      { row: 3, column: "Title", message: "is required" },
      { row: 4, column: "Selling Price (USD)", message: "must be greater than 0" },
      { row: 4, column: "Dispatch Days", message: "must be a number" },
    ]);
  });

  it("skips blank rows but keeps spreadsheet row numbers", async () => {
    const report = await ingestion.parse(`${HEADER}\nClay pot,9,3,2,7\n,,,,\nMug,,3,2,7\n`);
    expect(report.totalRows).toBe(2);
    expect(report.errors).toEqual([{ row: 4, column: "Price", message: "is required" }]);
  });

  it("generates SKUs from names and catches name clashes", async () => {
    const report = await ingestion.parse(`${HEADER}\nClay pot,9,3,2,7\nClay Pot,10,1,2,7\n`);
    expect(report.rows.map((r) => r.sku)).toEqual(["CLAY-POT"]);
    expect(report.errors).toEqual([
      {
        row: 3,
        column: "sku",
        message: "same name as row 2; add a SKU column or make product names unique",
      },
    ]);
  });

  it("rejects duplicate SKUs", async () => {
    const report = await ingestion.parse(`SKU,${HEADER}\nP-1,Clay pot,9,3,2,7\nP-1,Mug,10,1,2,7\n`);
    expect(report.errors).toEqual([
      { row: 3, column: "SKU", message: 'duplicate SKU "P-1" (first used on row 2)' },
    ]);
  });

  it("flags rows wider than the header, pads shorter ones", async () => {
    const wide = await ingestion.parse(`${HEADER}\nClay pot, small,9,3,2,7\n`);
    expect(wide.errors[0]).toMatchObject({ row: 2, column: "(row)" });
    const short = await ingestion.parse(`${HEADER},Rating\nClay pot,9,3,2,7\n`);
    expect(short.errors).toEqual([]);
    expect(short.rows[0]?.rating_avg).toBeUndefined();
  });

  it("returns missing required columns without validating rows", async () => {
    const report = await ingestion.parse("Name,Price\nClay pot,9\n");
    expect(report).toMatchObject({
      missingRequired: ["stock", "shipping_days", "return_days"],
      rows: [],
      errors: [],
      totalRows: 1,
    });
  });

  it("applies the merchant's mapping corrections", async () => {
    const csv = "Item,Blurb,Price,Stock,Ships,Returns\nClay pot,Small pot,9,3,2,7\n";
    expect((await ingestion.parse(csv)).missingRequired).toEqual(["shipping_days"]);
    const fixed = await ingestion.parse(csv, { Ships: "shipping_days", Blurb: "description" });
    expect(fixed.rows[0]).toMatchObject({
      name: "Clay pot",
      description: "Small pot",
      shipping_days: 2,
    });
  });

  it("handles semicolons, tabs and a byte-order mark", async () => {
    expect(detectDelimiter("Name;Price;Stock\n")).toBe(";");
    expect(detectDelimiter("Name\tPrice\tStock\n")).toBe("\t");
    const semicolon = await ingestion.parse(
      "\uFEFFName;Price;Stock;Shipping Days;Return Days\nClay pot;9.50;3;2;7\n",
    );
    expect(semicolon.rows[0]).toMatchObject({ sku: "CLAY-POT", price: 9.5 });
  });

  it("refuses empty and unreadable files", async () => {
    await expect(ingestion.parse("")).rejects.toMatchObject({ code: "INVALID_CSV", status: 400 });
    await expect(ingestion.parse('Name,Price\n"unclosed,9\n')).rejects.toMatchObject({
      code: "INVALID_CSV",
    });
  });
});
