import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createIngestionService } from "../../../src/services/ingestion.service";
import { fakeLlm } from "../../helpers/fake-llm";

const CSV =
  "Item,Blurb,Price,Stock,Ships,Returns,Colour\nClay pot,Small pot,9,3,2,7,red\nMug,Big mug,12,1,3,7,blue\n";
const SEED = readFileSync(
  join(import.meta.dirname, "..", "..", "..", "database", "seeds", "demo-merchant.csv"),
  "utf8",
);
const suggesting = (suggestions: { header: string; column: string }[]) =>
  fakeLlm({ mapping: () => ({ suggestions }) });

describe("mapping suggestions (FR-02, step 9)", () => {
  it("keeps only unmapped headers, open columns, each once; never applies them", async () => {
    const llm = suggesting([
      { header: "Ships", column: "shipping_days" },
      { header: "Blurb", column: "description" },
      { header: "Colour", column: "price" }, // already mapped
      { header: "Nope", column: "category" }, // not a header in the file
      { header: "Colour", column: "weight" }, // not one of our columns
      { header: "Blurb", column: "category" }, // header already suggested
      { header: "Colour", column: "description" }, // column already suggested
    ]);
    const report = await createIngestionService({ llm }).parse(CSV, {}, { suggestMappings: true });
    expect(report.suggestions).toEqual({ Ships: "shipping_days", Blurb: "description" });
    expect(report.mapping).not.toHaveProperty("Ships");
    expect(report.missingRequired).toEqual(["shipping_days"]);
  });

  it("sends the open columns and a few sample values of each unmapped header", async () => {
    const llm = suggesting([]);
    await createIngestionService({ llm }).parse(CSV, {}, { suggestMappings: true });
    const data = llm.calls[0]?.data as {
      allowed_columns: { name: string; meaning: string }[];
      headers: { header: string; samples: string[] }[];
    };
    expect(data.allowed_columns.map((c) => c.name)).toEqual([
      "sku",
      "description",
      "category",
      "shipping_days",
      "rating_avg",
      "review_count",
    ]);
    expect(data.headers).toEqual([
      { header: "Blurb", samples: ["Small pot", "Big mug"] },
      { header: "Ships", samples: ["2", "3"] },
      { header: "Colour", samples: ["red", "blue"] },
    ]);
  });

  it("is not asked on commit-style parses or when every header is mapped", async () => {
    const llm = suggesting([{ header: "Ships", column: "shipping_days" }]);
    const ingestion = createIngestionService({ llm });
    expect((await ingestion.parse(CSV)).suggestions).toEqual({});
    expect((await ingestion.parse(SEED, {}, { suggestMappings: true })).suggestions).toEqual({});
    expect(llm.calls).toHaveLength(0);
  });

  it("falls back to no suggestions when the LLM fails", async () => {
    const report = await createIngestionService({ llm: fakeLlm() }).parse(
      CSV,
      {},
      { suggestMappings: true },
    );
    expect(report.suggestions).toEqual({});
    expect(report.unmapped).toEqual(["Blurb", "Ships", "Colour"]);
  });
});
