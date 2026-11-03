import type { LlmClient } from "../integrations/llm/llm-client";
import { matchFirewallRules } from "../domain/firewall-rules";

export type FirewallVerdict =
  { status: "clean" } | { status: "flagged"; reason: string; rules: string[] };

export interface FirewallService {
  /** Screens all text an agent will read for one product (name, description, category). */
  screen(text: string): Promise<FirewallVerdict>;
}

/**
 * FR-05. Runs at upload only, never at request time.
 * Layer 1 (here): deterministic rules from src/domain/firewall-rules.ts; any hit flags the product.
 * Layer 2 (step 9): when an LLM is configured and the rules pass, ask it for a structured verdict.
 * Until then, and whenever the LLM fails, the rules verdict stands (NFR-08).
 */
export function createFirewallService(_deps: { llm: LlmClient | null }): FirewallService {
  return {
    async screen(text) {
      const rules = matchFirewallRules(text);
      if (rules.length)
        return { status: "flagged", rules, reason: `matched firewall rules: ${rules.join(", ")}` };
      // TODO(step 9): LLM verdict when _deps.llm is set.
      return { status: "clean" };
    },
  };
}
