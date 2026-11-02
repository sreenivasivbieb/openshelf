import type { z } from "zod";

/**
 * Port for the LLM (ADR-0002, ADR-0011). Used ONLY at onboarding: firewall check, description rewrite,
 * column-mapping suggestions, spec enrichment. Never imported by quote or order code (lint-enforced).
 * Services own their prompts; this interface only does one structured-output call.
 */
export interface LlmClient {
  generateObject<T>(args: { system: string; prompt: string; schema: z.ZodType<T> }): Promise<T>;
}
