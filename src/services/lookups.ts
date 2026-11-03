import type { Merchant } from "../domain/entities";
import type { MerchantRepository } from "../repositories/merchant.repository";
import { AppError } from "../shared/errors";

/** Every store route starts here: unknown merchant -> 404 MERCHANT_NOT_FOUND. */
export function requireMerchant(merchants: MerchantRepository, merchantId: string): Merchant {
  const merchant = merchants.findById(merchantId);
  if (!merchant) {
    throw new AppError("MERCHANT_NOT_FOUND", `No store with id "${merchantId.slice(0, 64)}"`, 404);
  }
  return merchant;
}
