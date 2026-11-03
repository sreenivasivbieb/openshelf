import { describe, expect, it } from "vitest";
import { escapeMarkdownInline } from "../../../src/domain/markdown";

describe("escapeMarkdownInline", () => {
  it("keeps merchant text on one line so it cannot start a heading, list or table row", () => {
    expect(escapeMarkdownInline("Mug\n# Heading\n| x |")).toBe("Mug \\# Heading \\| x \\|");
  });

  it("neutralises links, HTML, emphasis and code", () => {
    expect(escapeMarkdownInline("[click](http://x) <b>*hi*</b> `rm`")).toBe(
      "\\[click\\](http://x) \\<b\\>\\*hi\\*\\</b\\> \\`rm\\`",
    );
  });

  it("escapes backslashes first, so escapes cannot be undone", () => {
    expect(escapeMarkdownInline("a\\|b")).toBe("a\\\\\\|b");
  });
});
