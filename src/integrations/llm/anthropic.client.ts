import type { LlmClient } from "./llm-client";
import { notImplemented } from "../../shared/errors";

export interface AnthropicConfig {
  apiKey: string;
  model: string; // SPEC_AGENT_MODEL, default claude-opus-5-5
}

/**
 * Adapter: LlmClient -> @anthropic-ai/sdk with structured outputs, output validated by the Zod schema.
 * Build step 9.
 */
export function createAnthropicLlmClient(_config: AnthropicConfig): LlmClient {
  return {
    generateObject: async () => notImplemented("step 9"),
  };
}
