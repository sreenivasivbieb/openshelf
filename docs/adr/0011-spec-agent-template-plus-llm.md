# ADR-0011: Spec Agent = deterministic template + LLM enrichment + validation

- Status: Accepted
- Date: 2026-11-03

## Context

The Spec Agent must produce a valid OpenAPI 3.1 spec per merchant. A spec written entirely by an LLM can be invalid or disagree with the code, and onboarding must not block on an LLM outage.

## Decision

Generate the base spec from `src/schemas` without any LLM. The LLM (`@anthropic-ai/sdk`, model from `SPEC_AGENT_MODEL`, default `claude-opus-5-5`) only fills per-merchant parts: descriptions, category enum, examples. Validate the result; on any failure use the template (`spec_status = fallback`). Without an API key, the firewall runs rules-only and descriptions stay as cleaned raw text.

## Consequences

- Onboarding always finishes (NFR-08).
- The LLM proposes, code validates.
