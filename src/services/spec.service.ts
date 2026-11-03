import { z } from "zod";
import type { Merchant, Product } from "../domain/entities";
import { matchFirewallRules, sanitizeForAgents } from "../domain/firewall-rules";
import type { LlmClient } from "../integrations/llm/llm-client";
import { chunk, mapWithConcurrency } from "../shared/concurrency";
import { buildOpenApiTemplate, type OpenApiDocument } from "./openapi-template";
import {
  dataBlock,
  ENRICHMENT_SYSTEM,
  LLM_BATCH_SIZE,
  LLM_CONCURRENCY,
  LLM_MAX_PRODUCTS,
  REWRITE_SYSTEM,
} from "./prompts";

export type { OpenApiDocument };

export interface RewriteInput {
  sku: string;
  name: string;
  category: string | null;
  /** Firewall-cleaned merchant text; the only source the rewrite may use. */
  cleanText: string;
}

export interface SpecService {
  /** FR-03: deterministic OpenAPI 3.1 from src/schemas. Always works; it is the fallback. */
  buildTemplate(merchant: Merchant, categories?: string[]): OpenApiDocument;
  /** Template + LLM enrichment (store description, search examples), each field validated. */
  build(
    merchant: Merchant,
    products: Product[],
  ): Promise<{ spec: OpenApiDocument; status: "ready" | "fallback" }>;
  /** FR-04: agent-friendly descriptions, batched. Only accepted rewrites are returned, by SKU. */
  rewriteDescriptions(inputs: RewriteInput[]): Promise<Map<string, string>>;
}

const REWRITE_MAX_CHARS = 400;
const STORE_DESCRIPTION_MAX_CHARS = 300;
const SEARCH_EXAMPLE_MAX_CHARS = 60;
const MAX_SEARCH_EXAMPLES = 5;
const ENRICHMENT_MAX_PRODUCTS = 100;
const LINK = /https?:\/\/|www\./i;

// Plain shapes on purpose: lengths are checked in code, so one long field is dropped, not the whole reply.
const RewriteOutput = z.object({
  descriptions: z.array(z.object({ sku: z.string(), description: z.string() })),
});
const EnrichmentOutput = z.object({
  store_description: z.string(),
  search_examples: z.array(z.string()),
});

/**
 * LLM text we are willing to show agents: sanitized, non-empty, short, no links, and no firewall rule
 * hits (the LLM read untrusted text, so its output is checked like merchant text). null = rejected.
 */
export function acceptLlmText(text: string, maxChars: number): string | null {
  const clean = sanitizeForAgents(text, maxChars * 2);
  if (!clean || clean.length > maxChars || LINK.test(clean) || matchFirewallRules(clean).length > 0)
    return null;
  return clean;
}

/** Every number in a rewrite must appear in its source: a cheap, deterministic check against invented facts. */
function numbersComeFromSource(rewrite: string, source: string): boolean {
  return (rewrite.match(/\d+(?:[.,]\d+)?/g) ?? []).every((number) => source.includes(number));
}

function categoriesOf(products: Product[]): string[] {
  const categories = new Set(
    products.map((p) => p.category).filter((c): c is string => Boolean(c)),
  );
  return [...categories].sort((a, b) => a.localeCompare(b));
}

interface EditableSpec {
  info: { description?: string };
  paths: Record<
    string,
    Record<string, { requestBody?: { content?: Record<string, { examples?: unknown }> } }>
  >;
  "x-openshelf"?: Record<string, unknown>;
}

/** Merges accepted enrichment at fixed places of a copy of the template; nothing else changes. */
function applyEnrichment(
  template: OpenApiDocument,
  description: string | null,
  examples: string[],
): OpenApiDocument {
  const spec = structuredClone(template) as OpenApiDocument & EditableSpec;
  if (description) {
    spec.info.description = `${spec.info.description ?? ""}\n\nAbout this store: ${description}`;
    spec["x-openshelf"] = { ...spec["x-openshelf"], store_description: description };
  }
  const media = spec.paths["/search"]?.["post"]?.requestBody?.content?.["application/json"];
  if (media && examples.length) {
    media.examples = Object.fromEntries(
      examples.map((query, i) => [`example${i + 1}`, { summary: query, value: { query } }]),
    );
  }
  return spec;
}

/**
 * The Spec Agent (ADR-0011): the LLM proposes, code validates, and every step has a deterministic
 * fallback (NFR-08). Runs at onboarding only.
 */
export function createSpecService(deps: {
  llm: LlmClient | null;
  publicBaseUrl: string;
}): SpecService {
  const buildTemplate = (merchant: Merchant, categories: string[] = []) =>
    buildOpenApiTemplate({ merchant, publicBaseUrl: deps.publicBaseUrl, categories });

  return {
    buildTemplate,

    async build(merchant, products) {
      const clean = products.filter((p) => p.firewallStatus === "clean");
      const template = buildTemplate(merchant, categoriesOf(clean));
      const { llm } = deps;
      if (!llm || clean.length === 0 || products.length > LLM_MAX_PRODUCTS)
        return { spec: template, status: "fallback" };

      let output: z.infer<typeof EnrichmentOutput>;
      try {
        output = await llm.generateObject({
          task: "spec-enrichment",
          system: ENRICHMENT_SYSTEM,
          prompt: dataBlock("store", {
            currency: merchant.currency,
            products: clean.slice(0, ENRICHMENT_MAX_PRODUCTS).map((p) => ({
              sku: p.sku,
              name: p.name,
              category: p.category,
              description: (p.descriptionAgent ?? "").slice(0, 200),
            })),
          }),
          schema: EnrichmentOutput,
          effort: "low",
        });
      } catch {
        return { spec: template, status: "fallback" };
      }

      const description = acceptLlmText(output.store_description, STORE_DESCRIPTION_MAX_CHARS);
      const examples = [
        ...new Set(
          output.search_examples
            .map((example) => acceptLlmText(example, SEARCH_EXAMPLE_MAX_CHARS))
            .filter((example): example is string => example !== null),
        ),
      ].slice(0, MAX_SEARCH_EXAMPLES);
      if (!description && examples.length === 0) return { spec: template, status: "fallback" };
      return { spec: applyEnrichment(template, description, examples), status: "ready" };
    },

    async rewriteDescriptions(inputs) {
      const rewrites = new Map<string, string>();
      const { llm } = deps;
      const candidates = inputs.filter((input) => input.cleanText.trim());
      if (!llm || candidates.length === 0 || inputs.length > LLM_MAX_PRODUCTS) return rewrites;

      await mapWithConcurrency(
        chunk(candidates, LLM_BATCH_SIZE),
        LLM_CONCURRENCY,
        async (batch) => {
          const bySku = new Map(batch.map((input) => [input.sku, input]));
          let output: z.infer<typeof RewriteOutput>;
          try {
            output = await llm.generateObject({
              task: "rewrite",
              system: REWRITE_SYSTEM,
              prompt: dataBlock(
                "listings",
                batch.map((input) => ({
                  sku: input.sku,
                  name: input.name,
                  category: input.category,
                  description: input.cleanText,
                })),
              ),
              schema: RewriteOutput,
              effort: "low",
            });
          } catch {
            return; // this batch keeps the cleaned merchant text
          }
          for (const { sku, description } of output.descriptions) {
            const input = bySku.get(sku);
            if (!input || rewrites.has(sku)) continue;
            const accepted = acceptLlmText(description, REWRITE_MAX_CHARS);
            const source = `${input.name} ${input.category ?? ""} ${input.cleanText}`;
            if (accepted && numbersComeFromSource(accepted, source)) rewrites.set(sku, accepted);
          }
        },
      );
      return rewrites;
    },
  };
}
