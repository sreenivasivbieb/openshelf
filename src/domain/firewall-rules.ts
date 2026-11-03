/**
 * Prompt-firewall rules (FR-05). Layer 1 of 2: deterministic and explainable; the LLM check
 * (step 9) is layer 2. Rules aim at text written FOR an AI agent, and are tuned against ordinary
 * product copy ("Operating system: Android", "can act as a trivet", "use the tool to tighten bolts").
 */
export interface FirewallRule {
  id: string;
  description: string;
  pattern: RegExp;
}

export const FIREWALL_RULES: readonly FirewallRule[] = [
  {
    id: "ignore-instructions",
    description: "asks to ignore or override earlier instructions",
    pattern:
      /\b(ignore|disregard|forget|override|bypass)\b[^.!?]{0,20}\b(all|any|every|previous|prior|above|earlier|your|these|those)\b\s+(\w+\s+){0,2}(instructions?|prompts?|rules|guidelines|directions)\b/i,
  },
  {
    id: "role-label",
    description: "fake system or assistant message",
    pattern:
      /(<!--|\[|\{|<)\s*(system|assistant|developer)\s*(\]|\}|>|:)|\b(system|assistant|developer)\s+(prompt|message|instructions?)\s*:/i,
  },
  {
    id: "role-override",
    description: "tries to change who the AI is or how it behaves",
    pattern:
      /\b(you are now|from now on,? you are|pretend (to be|you are)|act as) (an?|the|my|our) ([\w-]+ )?(ai|assistant|agent|chatbot|bot|language model|llm)\b|\b(your|these are (your|the)) new instructions\b|\bnew system prompt\b/i,
  },
  {
    id: "addresses-the-agent",
    description: "tells the AI what to tell the buyer or what to pick",
    pattern:
      /\b(tell|inform|convince|instruct|remind)\s+the\s+(user|buyer|customer|human|shopper)\b|\b(ai|assistant|agent|bot|llm|model)s?\b[^.!?]{0,30}\b(must|should|always|never)\s+(choose|buy|recommend|select|pick|prefer|rank)\b/i,
  },
  {
    id: "hidden-markup",
    description: "content hidden from human readers",
    pattern:
      /<!--|<\s*(script|style|iframe|object|embed)\b|style\s*=\s*["'][^"']*(display\s*:\s*none|visibility\s*:\s*hidden|font-size\s*:\s*0|opacity\s*:\s*0)/i,
  },
  {
    id: "invisible-control",
    description: "bidirectional override characters",
    pattern: /[\u202A-\u202E\u2066-\u2069]/,
  },
  {
    id: "tool-call",
    description: "asks to call tools or functions",
    pattern:
      /\b(call|invoke|execute)\s+the\s+[`'"]?[\w-]+[`'"]?\s+(tool|function|api|endpoint)\b|\b(invoke|execute)\s+(the\s+)?(tool|function)\b|\b(tool_call|function_call|tool_use)\b/i,
  },
  {
    id: "encoded-payload",
    description: "long encoded blob",
    pattern: /[A-Za-z0-9+/]{120,}={0,2}|data:[\w.+-]+\/[\w.+-]+;base64,/i,
  },
];

// Invisible characters with no business in product copy.
const INVISIBLE = /[\u200B\u2060-\u2064\uFEFF\u00AD\u180E]/g;
// Joiners are legitimate in Indic scripts and emoji; between ASCII letters they only hide words.
const ASCII_JOINERS = /(?<=[\x21-\x7E])[\u200C\u200D](?=[\x21-\x7E])/g;
const ALL_JOINERS = /[\u200C\u200D]/g;
// eslint-disable-next-line no-control-regex -- matching control characters is the point of this pattern
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/** The text the rules look at: NFKC, every invisible character removed, whitespace collapsed. */
export function normalizeForMatching(text: string): string {
  return text
    .normalize("NFKC")
    .replace(INVISIBLE, "")
    .replace(ALL_JOINERS, "")
    .replace(CONTROL, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Ids of the rules that match. Empty = no rule fired. */
export function matchFirewallRules(text: string): string[] {
  const normalized = normalizeForMatching(text);
  return FIREWALL_RULES.filter((rule) => rule.pattern.test(normalized)).map((rule) => rule.id);
}

/**
 * Text safe to show an agent: hidden markup and invisible characters removed, tags stripped (their
 * visible text kept), whitespace collapsed, length capped. Indic joiners and emoji sequences survive.
 */
export function sanitizeForAgents(text: string, maxLength = 2000): string {
  const clean = text
    .normalize("NFKC")
    .replace(/<!--[\s\S]*?(-->|$)/g, " ")
    .replace(/<\s*(script|style|iframe|object|embed)\b[\s\S]*?(<\s*\/\s*\1\s*>|$)/gi, " ")
    .replace(/<\/?[a-z][^>]{0,200}>/gi, " ")
    .replace(/[\u202A-\u202E\u2066-\u2069]/g, "")
    .replace(INVISIBLE, "")
    .replace(ASCII_JOINERS, "")
    .replace(CONTROL, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (clean.length <= maxLength) return clean;
  const cut = clean.slice(0, maxLength);
  return /[\uD800-\uDBFF]$/.test(cut) ? cut.slice(0, -1) : cut;
}
