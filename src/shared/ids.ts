import { randomBytes } from "node:crypto";

/** Prefixed, URL-safe ids: m_ merchant, q_ quote, o_ order, k_ agent key. */
export function newId(prefix: "m" | "q" | "o" | "k"): string {
  return `${prefix}_${randomBytes(12).toString("base64url")}`;
}

/** A new agent API key (ADR-0012): `osk_` + 32 random bytes as base64url. Shown once, stored hashed. */
export function newAgentKey(): string {
  return `osk_${randomBytes(32).toString("base64url")}`;
}
