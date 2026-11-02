import type { Request, Response } from "express";
import { z } from "zod";
import type { Services } from "../../../services";
import { CreateMerchantRequest } from "../../../schemas/merchant.schema";
import type { CanonicalColumn } from "../../../domain/column-mapping";

type MerchantParams = { merchantId: string };

const CommitQuery = z.object({ mapping: z.string().optional() }); // JSON: { "<header>": "<column>" }

/** Merchant onboarding + dashboard API (FR-01..06, FR-15). */
export function createAdminController(s: Services) {
  return {
    createMerchant(req: Request, res: Response) {
      res.status(201).json(s.onboarding.createMerchant(CreateMerchantRequest.parse(req.body)));
    },

    async previewCatalog(req: Request<MerchantParams>, res: Response) {
      res.json(
        await s.onboarding.previewCatalog(req.params.merchantId, z.string().parse(req.body)),
      );
    },

    async commitCatalog(req: Request<MerchantParams>, res: Response) {
      const { mapping } = CommitQuery.parse(req.query);
      const parsed = (mapping ? JSON.parse(mapping) : {}) as Record<string, CanonicalColumn>;
      res.json(
        await s.onboarding.commitCatalog(req.params.merchantId, z.string().parse(req.body), parsed),
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
