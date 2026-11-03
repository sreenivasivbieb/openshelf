/** Words that carry no product meaning in a shopper's query ("find me a mug under 40"). */
const STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "of",
  "for",
  "to",
  "in",
  "on",
  "at",
  "by",
  "with",
  "from",
  "under",
  "over",
  "below",
  "above",
  "less",
  "more",
  "than",
  "me",
  "my",
  "i",
  "we",
  "you",
  "your",
  "it",
  "is",
  "are",
  "be",
  "some",
  "any",
  "please",
  "want",
  "need",
  "find",
  "show",
  "get",
  "buy",
  "looking",
  "search",
  "item",
  "items",
  "product",
  "products",
  "something",
  "that",
  "this",
  "which",
  "what",
]);

const MAX_TERMS = 12;

/**
 * Turns free text into a safe FTS5 query: words only (letters, marks, digits), each quoted so no FTS
 * syntax survives, joined with OR so bm25 ranks the best matches first.
 * Returns null when nothing searchable is left; the caller then browses instead of matching.
 */
export function toFtsQuery(text: string): string | null {
  const words =
    text
      .normalize("NFKC")
      .toLowerCase()
      .match(/[\p{L}\p{M}\p{N}]+/gu) ?? [];
  const terms = [...new Set(words.filter((w) => w.length > 1 && !STOPWORDS.has(w)))].slice(
    0,
    MAX_TERMS,
  );
  return terms.length ? terms.map((t) => `"${t}"`).join(" OR ") : null;
}
