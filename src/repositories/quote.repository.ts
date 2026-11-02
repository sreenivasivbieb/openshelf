import type { Db } from "./db";
import type { Quote } from "../domain/entities";
import { notImplemented } from "../shared/errors";

/** Insert-only (NFR-03): there is deliberately no update or delete. */
export interface QuoteRepository {
  insert(quote: Quote): void;
  findById(merchantId: string, id: string): Quote | null;
}

/** Table: quotes. Build step 4. */
export function createQuoteRepository(_db: Db): QuoteRepository {
  return {
    insert: () => notImplemented("step 4"),
    findById: () => notImplemented("step 4"),
  };
}
