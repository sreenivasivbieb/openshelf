import type { RequestHandler, Response } from "express";
import type { AgentContext } from "../../../domain/entities";

/** Builds the AgentContext for /m/:merchantId/* from the path and headers. */
export const agentContext: RequestHandler<{ merchantId: string }> = (req, res, next) => {
  const ctx: AgentContext = {
    merchantId: req.params.merchantId,
    agentId: req.get("x-agent-id")?.slice(0, 100) ?? null,
    channel: "rest",
    isSimulated: req.get("x-simulated") === "1",
  };
  res.locals.agent = ctx;
  next();
};

export function getAgentContext(res: Response): AgentContext {
  return res.locals.agent as AgentContext;
}
