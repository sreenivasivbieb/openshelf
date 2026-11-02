import type { ProductRow } from "../schemas/product.schema";
import type { CanonicalColumn } from "../domain/column-mapping";
import type { LlmClient } from "../integrations/llm/llm-client";
import { notImplemented } from "../shared/errors";

export interface IngestionReport {
  mapping: Record<string, CanonicalColumn>;
  unmapped: string[];
  suggestions: Record<string, CanonicalColumn>; // LLM guesses for unmapped headers; merchant confirms
  rows: ProductRow[];
  errors: { row: number; column: string; message: string }[];
}

export interface IngestionService {
  parse(csv: string, mappingOverrides?: Record<string, CanonicalColumn>): Promise<IngestionReport>;
}

/**
 * FR-01, FR-02. Build step 2. csv-parse -> mapColumns (synonyms) -> optional LLM suggestions
 * (only when llm is set) -> ProductRow.safeParse per row -> errors carry the CSV row number.
 */
export function createIngestionService(_deps: { llm: LlmClient | null }): IngestionService {
  return {
    parse: async () => notImplemented("step 2"),
  };
}
