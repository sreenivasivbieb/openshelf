# ADR-0003: Layered architecture with a bootstrap composition root

- Status: Accepted
- Date: 2026-11-03

## Context

The repo must be easy for an outsider to navigate, and the money path must be testable without PayPal, the LLM or a real database file.

## Decision

`bootstrap/` creates everything that touches the outside world (env, logger, SQLite connection, PayPal and LLM clients) and wires it in `container.ts`. `src/` is layered: `api → services → domain / repositories / integrations`, with `schemas` and `shared` usable everywhere. Dependencies are passed as parameters (factory functions), not imported as singletons. Boundaries are lint-enforced.

## Consequences

- Tests build the same container with in-memory SQLite, a fixed clock and fake PayPal.
- Business code never reads `process.env`.
- A little more boilerplate (interfaces + factories) than calling SDKs directly.
