import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { LlmError, type LlmClient } from "./llm-client";

export interface AnthropicConfig {
  apiKey: string;
  model: string; // SPEC_AGENT_MODEL, default claude-opus-5-5
}

/** Onboarding prompts are small; this caps how long one call can hold an upload request. */
const REQUEST_TIMEOUT_MS = 120_000;
const MAX_OUTPUT_TOKENS = 16_000;

/**
 * Adapter: LlmClient -> @anthropic-ai/sdk structured outputs (ADR-0011).
 * - `client.beta.messages.parse` + `betaZodOutputFormat`: the API constrains the output to the schema's
 *   JSON Schema and the SDK validates it with the Zod schema into `parsed_output`.
 * - `fallbacks: "default"` (beta `server-side-fallback-2026-07-01`): if a safety classifier declines,
 *   the API retries on Anthropic's recommended fallback model inside the same call, with the same
 *   output format. On a model without fallback support the request simply runs alone.
 * - Thinking stays at the model default (adaptive); `effort` comes from the caller.
 * - Refusals, truncation, schema mismatches and API errors all become LlmError, so callers fall back
 *   to the rule-based result.
 */
export function createAnthropicLlmClient(config: AnthropicConfig): LlmClient {
  const client = new Anthropic({
    apiKey: config.apiKey,
    timeout: REQUEST_TIMEOUT_MS,
    maxRetries: 2,
  });

  return {
    async generateObject({ system, prompt, schema, effort = "medium" }) {
      let response;
      try {
        response = await client.beta.messages.parse({
          model: config.model,
          max_tokens: MAX_OUTPUT_TOKENS,
          system,
          messages: [{ role: "user", content: prompt }],
          output_config: { format: betaZodOutputFormat(schema), effort },
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
        });
      } catch (error) {
        if (error instanceof Anthropic.APIError) {
          throw new LlmError(
            "api_error",
            `Anthropic API error ${error.status ?? "(no status)"}: ${error.message}`,
          );
        }
        throw new LlmError(
          "invalid_output",
          error instanceof Error ? error.message : String(error),
        );
      }

      if (response.stop_reason === "refusal") {
        throw new LlmError(
          "refusal",
          `Declined (${response.stop_details?.category ?? "no category"})`,
        );
      }
      if (response.stop_reason === "max_tokens")
        throw new LlmError("max_tokens", "Output was cut off");
      if (response.parsed_output == null)
        throw new LlmError("invalid_output", "Output did not match the schema");
      return response.parsed_output;
    },
  };
}
