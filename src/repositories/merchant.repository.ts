import type { Db } from "./db";
import type { Merchant } from "../domain/entities";
import type { SpecStatus } from "../domain/enums";
import { notImplemented } from "../shared/errors";

export interface MerchantRepository {
  insert(merchant: Merchant): void;
  findById(id: string): Merchant | null;
  saveSpec(id: string, specJson: string, status: SpecStatus): void;
}

/** Table: merchants. Build steps 1 and 9. */
export function createMerchantRepository(_db: Db): MerchantRepository {
  return {
    insert: () => notImplemented("step 1"),
    findById: () => notImplemented("step 1"),
    saveSpec: () => notImplemented("step 9"),
  };
}
