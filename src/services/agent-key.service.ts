import type { AgentKeyList, AgentKeyView, CreatedAgentKey } from "../schemas/agent-key.schema";
import type { AgentKey } from "../domain/entities";
import { AGENT_KEY_PATTERN, hashAgentKey } from "../domain/agent-keys";
import type { AgentKeyRepository } from "../repositories/agent-key.repository";
import type { MerchantRepository } from "../repositories/merchant.repository";
import type { Clock } from "../shared/clock";
import { AppError } from "../shared/errors";
import { newAgentKey, newId } from "../shared/ids";
import { requireMerchant } from "./lookups";

/** A store call's verified identity: the key's label. */
export interface VerifiedAgent {
  agentId: string;
}

export interface AgentKeyService {
  /** The plain key is in the result once; only its sha256 hash is stored. */
  create(merchantId: string, label: string): CreatedAgentKey;
  list(merchantId: string): AgentKeyList;
  revoke(merchantId: string, keyId: string): AgentKeyView;
  setPolicy(merchantId: string, required: boolean): { required: boolean };
  /**
   * Checks the X-Agent-Key of a store call (NFR-01). A valid key for this store -> its label;
   * a wrong, revoked or other store's key -> 401 INVALID_AGENT_KEY; no key -> null, or
   * 401 AGENT_KEY_REQUIRED when `enforcePolicy` is set and the store requires keys.
   */
  authenticate(
    merchantId: string,
    key: string | undefined,
    enforcePolicy: boolean,
  ): VerifiedAgent | null;
}

const view = (k: AgentKey): AgentKeyView => ({
  id: k.id,
  label: k.label,
  created_at: k.createdAt,
  revoked_at: k.revokedAt,
});

const invalidKey = () =>
  new AppError("INVALID_AGENT_KEY", "The X-Agent-Key is not valid for this store.", 401);

/** ADR-0012: scoped agent API keys, hashed at rest, optional or required per store. */
export function createAgentKeyService(deps: {
  agentKeys: AgentKeyRepository;
  merchants: MerchantRepository;
  clock: Clock;
}): AgentKeyService {
  return {
    create(merchantId, label) {
      requireMerchant(deps.merchants, merchantId);
      const key = newAgentKey();
      const record: AgentKey = {
        id: newId("k"),
        merchantId,
        label,
        keyHash: hashAgentKey(key),
        createdAt: deps.clock.now().toISOString(),
        revokedAt: null,
      };
      deps.agentKeys.insert(record);
      return { ...view(record), key };
    },

    list(merchantId) {
      requireMerchant(deps.merchants, merchantId);
      return {
        keys: deps.agentKeys.listByMerchant(merchantId).map(view),
        required: deps.agentKeys.isRequired(merchantId) ?? false,
      };
    },

    revoke(merchantId, keyId) {
      requireMerchant(deps.merchants, merchantId);
      const key = deps.agentKeys.revoke(merchantId, keyId, deps.clock.now().toISOString());
      if (!key) throw new AppError("AGENT_KEY_NOT_FOUND", "No such agent key in this store.", 404);
      return view(key);
    },

    setPolicy(merchantId, required) {
      requireMerchant(deps.merchants, merchantId);
      deps.agentKeys.setRequired(merchantId, required);
      return { required };
    },

    authenticate(merchantId, key, enforcePolicy) {
      if (key === undefined || key === "") {
        if (enforcePolicy && deps.agentKeys.isRequired(merchantId) === true) {
          throw new AppError(
            "AGENT_KEY_REQUIRED",
            "This store only serves agents with an X-Agent-Key; ask the merchant for one.",
            401,
          );
        }
        return null;
      }
      if (!AGENT_KEY_PATTERN.test(key)) throw invalidKey();
      const found = deps.agentKeys.findByHash(hashAgentKey(key));
      if (!found || found.revokedAt !== null || found.merchantId !== merchantId) throw invalidKey();
      return { agentId: found.label };
    },
  };
}
