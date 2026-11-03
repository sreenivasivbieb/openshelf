import type { Merchant, Product } from "../domain/entities";
import type { LlmClient } from "../integrations/llm/llm-client";
import { notImplemented } from "../shared/errors";

export type OpenApiDocument = Record<string, unknown>;

export interface SpecService {
  /** Deterministic OpenAPI 3.1 from src/schemas (zod-to-openapi). Always works; it is the fallback. */
  buildTemplate(merchant: Merchant): OpenApiDocument;
  /** Template + LLM enrichment (descriptions, category enum, examples), then validated (FR-03). */
  build(
    merchant: Merchant,
    products: Product[],
  ): Promise<{ spec: OpenApiDocument; status: "ready" | "fallback" }>;
  /** Agent-friendly description from firewall-cleaned text (FR-04). */
  rewriteDescription(input: {
    name: string;
    category: string | null;
    cleanText: string;
  }): Promise<string>;
}

/** ADR-0011. */
export function createSpecService(_deps: {
  llm: LlmClient | null;
  publicBaseUrl: string;
}): SpecService {
  return {
    buildTemplate: () => notImplemented("step 9"),
    build: async () => notImplemented("step 9"),
    // TODO(step 9): LLM rewrite when _deps.llm is set. Without an LLM, or when it fails, agents get
    // the cleaned merchant text unchanged (NFR-08).
    rewriteDescription: async ({ cleanText }) => cleanText,
  };
}
