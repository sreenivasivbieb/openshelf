import { Router, type Request, type Response } from "express";
import type { Services } from "../../../services";
import { AgentKeyPolicy, CreateAgentKeyRequest } from "../../../schemas/agent-key.schema";

type MerchantParams = { merchantId: string };
type KeyParams = { merchantId: string; keyId: string };

/**
 * Scoped agent keys (NFR-01, ADR-0012). Mounted under /admin, behind the admin token.
 *   POST   /merchants/:merchantId/agent-keys          create; the key is in this response only
 *   GET    /merchants/:merchantId/agent-keys          list (no secrets) + whether keys are required
 *   DELETE /merchants/:merchantId/agent-keys/:keyId   revoke
 *   PUT    /merchants/:merchantId/agent-key-policy    { required: boolean }
 */
export function createAgentKeysRouter(s: Services): Router {
  const router = Router();

  router.post(
    "/merchants/:merchantId/agent-keys",
    (req: Request<MerchantParams>, res: Response) => {
      const { label } = CreateAgentKeyRequest.parse(req.body);
      res.status(201).json(s.agentKeys.create(req.params.merchantId, label));
    },
  );

  router.get("/merchants/:merchantId/agent-keys", (req: Request<MerchantParams>, res: Response) => {
    res.json(s.agentKeys.list(req.params.merchantId));
  });

  router.delete(
    "/merchants/:merchantId/agent-keys/:keyId",
    (req: Request<KeyParams>, res: Response) => {
      res.json(s.agentKeys.revoke(req.params.merchantId, req.params.keyId));
    },
  );

  router.put(
    "/merchants/:merchantId/agent-key-policy",
    (req: Request<MerchantParams>, res: Response) => {
      const { required } = AgentKeyPolicy.parse(req.body);
      res.json(s.agentKeys.setPolicy(req.params.merchantId, required));
    },
  );

  return router;
}
