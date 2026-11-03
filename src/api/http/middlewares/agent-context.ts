import type { RequestHandler, Response } from "express";
import type { Services } from "../../../services";
import type { AgentContext } from "../../../domain/entities";

const MAX_AGENT_ID = 100;

/**
 * Builds the AgentContext for /m/:merchantId/* from the path and headers.
 *
 * X-Agent-Key (ADR-0012, NFR-01): a valid key for this store makes the agent id its label and
 * agentVerified true; a wrong or revoked key is refused with 401. Without a key the agent id is
 * self-declared (X-Agent-Id, ADR-0009). `enforceKeyPolicy` turns on the store's "keys required"
 * setting; it is on for /api and /mcp, off for public documents such as store.md and openapi.json.
 */
export function createAgentContext(
  services: Services,
  options: { enforceKeyPolicy: boolean },
): RequestHandler<{ merchantId: string }> {
  return (req, res, next) => {
    const merchantId = req.params.merchantId;
    const verified = services.agentKeys.authenticate(
      merchantId,
      req.get("x-agent-key"),
      options.enforceKeyPolicy,
    );
    const ctx: AgentContext = {
      merchantId,
      agentId: verified
        ? verified.agentId
        : (req.get("x-agent-id")?.slice(0, MAX_AGENT_ID) ?? null),
      channel: "rest",
      isSimulated: req.get("x-simulated") === "1",
      agentVerified: verified !== null,
    };
    res.locals.agent = ctx;
    next();
  };
}

export function getAgentContext(res: Response): AgentContext {
  return res.locals.agent as AgentContext;
}
