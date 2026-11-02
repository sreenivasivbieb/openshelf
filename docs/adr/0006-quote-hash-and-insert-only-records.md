# ADR-0006: Quote hash and insert-only records

- Status: Accepted
- Date: 2026-11-03

## Context

We claim quotes are locked and auditable. That must be provable after the fact, not just promised.

## Decision

A passing quote stores its locked terms and a SHA-256 over canonical JSON of them (quote id, merchant, SKU, quantity, unit and total price in minor units, currency, shipping days, return days, expiry). `/order` recomputes and compares before creating a payment. `quotes`, `orders`, `order_events` and `telemetry` reject UPDATE and DELETE through triggers. Money is integer minor units everywhere.

## Consequences

- Any stored quote can be re-verified; the dashboard shows "hash verified".
- Order status changes are appended as events, never edited.
- Fixing bad data means a new row, not an edit.
