# ADR-0002: No LLM on the money path

- Status: Accepted
- Date: 2026-11-03

## Context

Quotes and orders move money. An LLM in that path makes results non-repeatable and hard to prove to a buyer, a merchant or a judge.

## Decision

`/quote` and `/order` use deterministic rules only. The LLM runs once, at onboarding (firewall check, description rewrite, mapping suggestions, spec enrichment). `eslint.config.js` forbids importing `integrations/llm` or `@anthropic-ai/*` from `quote.service.ts` and `order.service.ts`.

## Consequences

- Same input gives the same output (NFR-02); unit tests can cover every reason code.
- Agents get exact reason codes, not prose.
- Anything "smart" at quote time (counter-offers) must also be rule-based.
