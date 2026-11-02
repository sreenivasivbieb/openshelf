import { describe, expect, it } from "vitest";
import { toMajor, toMinor } from "../../../src/domain/money";

describe("money", () => {
  it("converts without float drift", () => {
    expect(toMinor(36.5)).toBe(3650);
    expect(toMinor(0.1 + 0.2)).toBe(30);
    expect(toMajor(3650)).toBe(36.5);
  });
});
