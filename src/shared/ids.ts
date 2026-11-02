import { randomBytes } from "node:crypto";

/** Prefixed, URL-safe ids: m_ merchant, q_ quote, o_ order, k_ agent key. */
export function newId(prefix: "m" | "q" | "o" | "k"): string {
  return `${prefix}_${randomBytes(12).toString("base64url")}`;
}
