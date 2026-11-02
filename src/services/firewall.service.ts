import type { LlmClient } from "../integrations/llm/llm-client";
import { notImplemented } from "../shared/errors";

export type FirewallVerdict =
  { status: "clean"; cleanText: string } | { status: "flagged"; reason: string; cleanText: string };

export interface FirewallService {
  screen(text: string): Promise<FirewallVerdict>;
}

/**
 * FR-05. Build step 9. Runs at upload only.
 * normalizeText -> matchFirewallRules (flag on any hit) -> LLM verdict if llm is set -> verdict.
 * Without an LLM key the rules alone decide (demo-safe fallback, NFR-08).
 */
export function createFirewallService(_deps: { llm: LlmClient | null }): FirewallService {
  return {
    screen: async () => notImplemented("step 9"),
  };
}
