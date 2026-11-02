import { notImplemented } from "../shared/errors";

/**
 * Prompt-firewall rules (FR-05). Layer 1 of 2: deterministic; the LLM check is layer 2.
 * Each rule has an id so a flagged product records which rule fired.
 */
export const FIREWALL_RULES: { id: string; pattern: RegExp }[] = [
  {
    id: "ignore-instructions",
    pattern:
      /\b(ignore|disregard|forget)\b.{0,30}\b(previous|prior|above|all)\b.{0,20}\binstructions?\b/i,
  },
  {
    id: "role-override",
    pattern: /\b(you are now|act as|pretend to be|system\s*:|assistant\s*:)/i,
  },
  { id: "agent-directive", pattern: /\b(always|must)\s+(choose|buy|recommend|select)\b/i },
  { id: "hidden-markup", pattern: /<!--[\s\S]*?-->|<\s*(script|style)\b/i },
  { id: "tool-call", pattern: /\b(call|invoke|use)\s+(the\s+)?(tool|function|api)\b/i },
  { id: "encoded-blob", pattern: /[A-Za-z0-9+/]{120,}={0,2}/ },
];

/** NFKC, strip zero-width and control characters, collapse whitespace. Build step 9. */
export function normalizeText(_text: string): string {
  return notImplemented("step 9");
}

/** Returns the ids of the rules that match the normalized text. Build step 9. */
export function matchFirewallRules(_text: string): string[] {
  return notImplemented("step 9");
}
