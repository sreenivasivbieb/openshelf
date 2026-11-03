import type { z } from "zod";

/** Which onboarding job a call belongs to (routes fakes in tests; attributes cost). */
export type LlmTask = "firewall" | "rewrite" | "mapping" | "spec-enrichment";

export type LlmEffort = "low" | "medium" | "high";

export interface GenerateObjectArgs<T> {
  task: LlmTask;
  /** Instructions only. Never contains merchant text. */
  system: string;
  /** The data to work on, inside clearly delimited blocks. Untrusted. */
  prompt: string;
  /** The output must match this schema; anything else is an error. */
  schema: z.ZodType<T>;
  effort?: LlmEffort;
}

/**
 * Port for the LLM (ADR-0002, ADR-0011). Used ONLY at onboarding: firewall check, description rewrite,
 * column-mapping suggestions, spec enrichment. Never imported by quote or order code (lint-enforced).
 * Services own their prompts (src/services/prompts.ts); this interface does one structured-output call.
 */
export interface LlmClient {
  generateObject<T>(args: GenerateObjectArgs<T>): Promise<T>;
}

/** Every LLM failure surfaces as this error; callers catch it and keep the rule-based result (NFR-08). */
export class LlmError extends Error {
  constructor(
    readonly reason: "refusal" | "max_tokens" | "invalid_output" | "api_error",
    message: string,
  ) {
    super(message);
    this.name = "LlmError";
  }
}
