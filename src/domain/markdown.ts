/**
 * Inline Markdown escaping for merchant-written text placed in agent-readable documents (store.md).
 * Escapes what could start formatting, links, HTML or break a table cell, and collapses line breaks so
 * a value can never start a new heading, list item or table row.
 */
export function escapeMarkdownInline(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[\\`*_[\]<>|#~]/g, (char) => `\\${char}`);
}
