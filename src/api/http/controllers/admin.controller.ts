import type { Request, Response } from "express";
import { z } from "zod";
import type { Services } from "../../../services";
import { CreateMerchantRequest } from "../../../schemas/merchant.schema";
import { ColumnOverrides } from "../../../schemas/product.schema";
import { AppError } from "../../../shared/errors";

type MerchantParams = { merchantId: string };

const MappingQuery = z.object({ mapping: z.string().max(10_000).optional() });

/** The CSV travels as the raw request body (Content-Type: text/csv). */
function csvBody(req: Request): string {
  if (typeof req.body !== "string" || !req.body.trim()) {
    throw new AppError(
      "CSV_REQUIRED",
      "Send the CSV file as the request body with Content-Type: text/csv.",
      400,
    );
  }
  return req.body;
}

/** ?mapping={"Merchant header":"price",...}: the merchant's corrections from the review step. */
function mappingOverrides(req: Request): ColumnOverrides {
  const { mapping } = MappingQuery.parse(req.query);
  if (!mapping) return {};
  let json: unknown;
  try {
    json = JSON.parse(mapping);
  } catch {
    throw new AppError(
      "INVALID_MAPPING",
      'mapping must be JSON like {"Selling Price":"price"}.',
      400,
    );
  }
  return ColumnOverrides.parse(json);
}

/** Merchant onboarding + dashboard API (FR-01..06, FR-15). */
export function createAdminController(s: Services) {
  return {
    createMerchant(req: Request, res: Response) {
      res.status(201).json(s.onboarding.createMerchant(CreateMerchantRequest.parse(req.body)));
    },

    async previewCatalog(req: Request<MerchantParams>, res: Response) {
      res.json(
        await s.onboarding.previewCatalog(
          req.params.merchantId,
          csvBody(req),
          mappingOverrides(req),
        ),
      );
    },

    async commitCatalog(req: Request<MerchantParams>, res: Response) {
      res.json(
        await s.onboarding.commitCatalog(
          req.params.merchantId,
          csvBody(req),
          mappingOverrides(req),
        ),
      );
    },

    getStore(req: Request<MerchantParams>, res: Response) {
      res.json(s.onboarding.getStore(req.params.merchantId));
    },

    feed(req: Request<MerchantParams>, res: Response) {
      const afterId = z.coerce.number().int().min(0).default(0).parse(req.query.after_id);
      res.json(s.dashboard.feed(req.params.merchantId, afterId));
    },

    quoteSummary(req: Request<MerchantParams>, res: Response) {
      res.json(s.dashboard.quoteSummary(req.params.merchantId));
    },

    orders(req: Request<MerchantParams>, res: Response) {
      res.json(s.dashboard.orders(req.params.merchantId));
    },
  };
}
