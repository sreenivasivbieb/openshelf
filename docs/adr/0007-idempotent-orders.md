# ADR-0007: Idempotent orders

- Status: Accepted
- Date: 2026-11-03

## Context

Agents retry on timeouts. A retry must never create a second payment.

## Decision

`orders.quote_id` is UNIQUE: a second `/order` for the same quote returns the existing order. The PayPal create call sends `PayPal-Request-Id = quote_id`, so PayPal also deduplicates.

## Consequences

- `PAYMENT_PROVIDER_ERROR` is safe to retry with the same quote.
- One quote can only ever become one order.
