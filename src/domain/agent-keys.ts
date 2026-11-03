import { createHash } from "node:crypto";

/**
 * Agent API keys (ADR-0012, NFR-01): `osk_` + 43 base64url characters (32 random bytes).
 * The prefix makes leaked keys easy to recognise in logs and secret scanners.
 */
export const AGENT_KEY_PATTERN = /^osk_[A-Za-z0-9_-]{43}$/;

/** Labels become the verified agent id in telemetry and on the dashboard. */
export const AGENT_KEY_LABEL_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 ._-]{0,59}$/;

/** What is stored instead of the key: sha256 hex. Keys are random, so no salt or slow hash is needed. */
export function hashAgentKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}
