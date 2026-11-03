# ADR-0012: Scoped agent keys, hashed, optional or required per store

- Status: Accepted
- Date: 2026-11-03

## Context

Agent identity was self-declared (ADR-0009): `X-Agent-Id` or `User-Agent`. Anyone can send any name, so
the dashboard cannot tell a real partner agent from an imitation. A merchant may also want to serve only
agents it knows. NFR-01 asks for agent keys stored hashed.

## Decision

- **Issuing keys.** The merchant (admin API) issues keys per store, each with a label. A key is `osk_` +
  32 random bytes as base64url. It is shown once at creation; only its sha256 hash is stored. Keys are
  random, so no salt or slow hash is needed. Revoking sets `revoked_at`; a revoked key never works again.
- **Using a key.** Agents send it as `X-Agent-Key` on REST and MCP. Not `Authorization`, which MCP
  clients may use for OAuth. A valid key for this store makes the label the agent id, with
  `agent_verified = 1` in telemetry.
- **Bad keys.** An unknown, malformed, revoked or other-store key is refused with 401
  `INVALID_AGENT_KEY`, before any service runs.
- **Store policy.** Keys are optional by default. A store can require them for `/api` and `/mcp`; keyless
  calls then get 401 `AGENT_KEY_REQUIRED`. Public documents (`openapi.json`, `store.md`, `store.json`)
  stay open.
- **Order of checks.** The rate limit runs before the key check, so key guessing is throttled.

## Consequences

- **Dashboard:** verified agents are distinguishable from self-declared names.
- **Keys:** a lost key cannot be recovered, only replaced. The server cannot show it again.
- **Telemetry gap:** calls refused for a key reason never reach telemetry, like rate-limited calls.
- **Not covered:** proof of machine identity (signed requests, attestation) stays on the roadmap.
