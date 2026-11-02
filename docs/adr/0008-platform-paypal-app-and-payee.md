# ADR-0008: One platform PayPal app; merchants paid as payee

- Status: Accepted
- Date: 2026-11-03

## Context

The blueprint says to store each merchant's PayPal sandbox credentials. NFR-01 says secrets live only in environment variables. Both cannot hold.

## Decision

The server uses one platform PayPal sandbox app (credentials in env). Each merchant stores only a payee email; orders name that merchant as `payee`. Sandbox only.

## Consequences

- No merchant secret in the database.
- If payee routing misbehaves in sandbox, fall back to one demo seller account for the demo.
- Real multi-merchant payouts (partner onboarding) are roadmap.
