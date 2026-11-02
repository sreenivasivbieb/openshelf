import type { Logger } from "pino";
import type { Env } from "./env";
import type { LlmClient } from "../src/integrations/llm/llm-client";
import { createAnthropicLlmClient } from "../src/integrations/llm/anthropic.client";

/** LLM client for onboarding only. null = no key -> rule-based fallbacks everywhere (NFR-08). */
export function createLlm(env: Env, logger: Logger): LlmClient | null {
  if (!env.ANTHROPIC_API_KEY) {
    logger.warn("ANTHROPIC_API_KEY not set; Spec Agent runs in rules-only fallback mode");
    return null;
  }
  return createAnthropicLlmClient({ apiKey: env.ANTHROPIC_API_KEY, model: env.SPEC_AGENT_MODEL });
}
