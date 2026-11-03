import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Container } from "../../bootstrap/container";

const ROOT = join(import.meta.dirname, "..", "..");

export const SEED_CSV = readFileSync(join(ROOT, "database", "seeds", "demo-merchant.csv"), "utf8");
export const MESSY_CSV = readFileSync(
  join(ROOT, "tests", "fixtures", "catalog-messy-headers.csv"),
  "utf8",
);

/** Creates a store from a CSV through the onboarding service, the same path a real upload takes. */
export async function createStore(
  container: Container,
  id: string,
  csv = SEED_CSV,
  currency = "USD",
) {
  container.services.onboarding.createMerchant({ name: `Store ${id}`, currency }, { id });
  return container.services.onboarding.commitCatalog(id, csv);
}
