import { z } from "zod";
import { AGENT_KEY_LABEL_PATTERN } from "../domain/agent-keys";

/** Admin API for scoped agent keys (NFR-01, ADR-0012). */
export const CreateAgentKeyRequest = z.object({
  label: z.string().trim().regex(AGENT_KEY_LABEL_PATTERN, {
    error: "must be 1-60 characters: letters, digits, space, dot, dash or underscore",
  }),
});
export type CreateAgentKeyRequest = z.infer<typeof CreateAgentKeyRequest>;

export const AgentKeyView = z.object({
  id: z.string(),
  label: z.string(), // becomes the verified agent id in telemetry
  created_at: z.string(),
  revoked_at: z.string().nullable(),
});
export type AgentKeyView = z.infer<typeof AgentKeyView>;

/** Returned once, at creation. Only a sha256 hash of `key` is stored. */
export const CreatedAgentKey = AgentKeyView.extend({ key: z.string() });
export type CreatedAgentKey = z.infer<typeof CreatedAgentKey>;

export const AgentKeyPolicy = z.object({ required: z.boolean() });
export type AgentKeyPolicy = z.infer<typeof AgentKeyPolicy>;

export const AgentKeyList = z.object({ keys: z.array(AgentKeyView), required: z.boolean() });
export type AgentKeyList = z.infer<typeof AgentKeyList>;
