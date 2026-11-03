import type { Merchant } from "./entities";
import { matchFirewallRules, sanitizeForAgents } from "./firewall-rules";

/** The merchant name is merchant data too: sanitized, and replaced when a firewall rule fires. */
export function agentFacingStoreName(merchant: Pick<Merchant, "id" | "name">): string {
  const name = sanitizeForAgents(merchant.name, 120);
  return name && matchFirewallRules(name).length === 0 ? name : `Store ${merchant.id}`;
}
