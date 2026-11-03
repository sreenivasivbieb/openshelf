import { z } from "zod";
import type { LlmClient } from "../integrations/llm/llm-client";
import { matchFirewallRules } from "../domain/firewall-rules";
import { chunk, mapWithConcurrency } from "../shared/concurrency";
import { acceptLlmText } from "./spec.service";
import {
  dataBlock,
  FIREWALL_SYSTEM,
  LLM_BATCH_SIZE,
  LLM_CONCURRENCY,
  LLM_MAX_PRODUCTS,
} from "./prompts";

export type FirewallVerdict =
  { status: "clean" } | { status: "flagged"; reason: string; rules: string[] };

/** All text an agent will read for one product, as uploaded (raw, so hidden content is visible). */
export interface ProductText {
  sku: string;
  name: string;
  description: string;
  category: string | null;
}

export interface FirewallService {
  /** One verdict per SKU for the whole upload. */
  screenCatalog(products: ProductText[]): Promise<Map<string, FirewallVerdict>>;
}

const FirewallOutput = z.object({
  verdicts: z.array(
    z.object({ sku: z.string(), verdict: z.enum(["clean", "flagged"]), reason: z.string() }),
  ),
});
const REASON_MAX_CHARS = 200;

/**
 * FR-05. Runs at upload only, never at request time.
 * Layer 1: deterministic rules (src/domain/firewall-rules.ts); any hit flags the product, no LLM needed.
 * Layer 2 (when an LLM is configured, catalogs up to LLM_MAX_PRODUCTS): listings the rules passed go to the
 * LLM in batches; it can only ADD flags (reason prefixed "llm:"), never clear one. When a batch fails,
 * the rules verdict stands for it (NFR-08).
 */
export function createFirewallService(deps: { llm: LlmClient | null }): FirewallService {
  return {
    async screenCatalog(products) {
      const verdicts = new Map<string, FirewallVerdict>();
      const passedRules: ProductText[] = [];
      for (const product of products) {
        const rules = matchFirewallRules(
          [product.name, product.description, product.category ?? ""].join("\n"),
        );
        if (rules.length) {
          verdicts.set(product.sku, {
            status: "flagged",
            rules,
            reason: `matched firewall rules: ${rules.join(", ")}`,
          });
        } else {
          verdicts.set(product.sku, { status: "clean" });
          passedRules.push(product);
        }
      }

      const { llm } = deps;
      if (!llm || passedRules.length === 0 || products.length > LLM_MAX_PRODUCTS) return verdicts;

      await mapWithConcurrency(
        chunk(passedRules, LLM_BATCH_SIZE),
        LLM_CONCURRENCY,
        async (batch) => {
          const sent = new Set(batch.map((p) => p.sku));
          let output: z.infer<typeof FirewallOutput>;
          try {
            output = await llm.generateObject({
              task: "firewall",
              system: FIREWALL_SYSTEM,
              prompt: dataBlock(
                "listings",
                batch.map((p) => ({
                  sku: p.sku,
                  name: p.name,
                  category: p.category,
                  description: p.description,
                })),
              ),
              schema: FirewallOutput,
              effort: "medium",
            });
          } catch {
            return; // the rules verdict stands for this batch
          }
          for (const { sku, verdict, reason } of output.verdicts) {
            if (verdict !== "flagged" || !sent.has(sku)) continue;
            const shown = acceptLlmText(reason, REASON_MAX_CHARS) ?? "flagged by the LLM check";
            verdicts.set(sku, { status: "flagged", rules: [], reason: `llm: ${shown}` });
          }
        },
      );
      return verdicts;
    },
  };
}
