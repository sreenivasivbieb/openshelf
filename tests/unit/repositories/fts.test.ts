import { describe, expect, it } from "vitest";
import { toFtsQuery } from "../../../src/repositories/fts";

describe("toFtsQuery", () => {
  it("quotes each word and ORs them", () => {
    expect(toFtsQuery("ceramic mug")).toBe('"ceramic" OR "mug"');
  });

  it("drops stopwords, punctuation and any FTS syntax", () => {
    expect(toFtsQuery('find me a "mug" under $40 OR NOT* NEAR(x')).toBe(
      '"mug" OR "40" OR "not" OR "near"',
    );
  });

  it("returns null when nothing searchable is left", () => {
    expect(toFtsQuery("*")).toBeNull();
    expect(toFtsQuery("find me a")).toBeNull();
  });

  it("keeps words with combining marks whole", () => {
    expect(toFtsQuery("चाय पत्ती")).toBe('"चाय" OR "पत्ती"');
  });

  it("caps the number of terms", () => {
    const words = Array.from({ length: 20 }, (_, i) => `word${i}`).join(" ");
    expect(toFtsQuery(words)?.split(" OR ")).toHaveLength(12);
  });
});
