# REST API

Contract source: `src/schemas/`. Shapes may change until the Nov 9 freeze.

## Buyer-facing (per merchant) — rate limited

| Method | Path                           | Body / params   | Returns                                           |
| ------ | ------------------------------ | --------------- | ------------------------------------------------- |
| POST   | `/m/{id}/api/search`           | `SearchRequest` | `{ results: ProductView[] }`                      |
| POST   | `/m/{id}/api/quote`            | `QuoteRequest`  | `QuotePass` or `QuoteFail`                        |
| POST   | `/m/{id}/api/order`            | `{ quote_id }`  | `201 { order_id, quote_id, status, approve_url }` |
| GET    | `/m/{id}/api/track/{order_id}` | —               | `{ order_id, status, history[] }`                 |
| GET    | `/m/{id}/openapi.json`         | —               | OpenAPI 3.1 document                              |

Optional headers: `X-Agent-Id` (agent name, self-declared), `X-Simulated: 1` (simulator), `X-Request-Id`.

Quote request:

```json
{
  "sku": "MUG-014",
  "quantity": 1,
  "max_budget": 40,
  "max_shipping_days": 4,
  "min_return_days": 14,
  "min_rating": 4.0,
  "min_review_count": 10
}
```

Pass:

```json
{
  "status": "pass",
  "quote_id": "q_123",
  "sku": "MUG-014",
  "quantity": 1,
  "price": 36,
  "currency": "USD",
  "shipping_days": 3,
  "return_days": 30,
  "expires_at": "2026-11-09T10:15:00.000Z",
  "quote_hash": "<sha256>"
}
```

Fail:

```json
{
  "status": "fail",
  "reason_codes": ["SHIPPING_TOO_SLOW"],
  "retry_hint": "LAMP-003 ships in 2 days at 99 USD",
  "nearest_passing_sku": "LAMP-003"
}
```

## Merchant / admin — `Authorization: Bearer <ADMIN_TOKEN>`

| Method | Path                                                  | Purpose                                                    |
| ------ | ----------------------------------------------------- | ---------------------------------------------------------- |
| POST   | `/admin/merchants`                                    | create merchant (`name`, `currency`, `paypal_payee_email`) |
| GET    | `/admin/merchants/{id}`                               | store info: MCP URL, OpenAPI URL, product counts           |
| POST   | `/admin/merchants/{id}/catalog/preview`               | CSV body (`text/csv`) → mapping + bad-row report           |
| POST   | `/admin/merchants/{id}/catalog/commit?mapping=<json>` | CSV body → firewall → spec → store ready                   |
| GET    | `/admin/merchants/{id}/telemetry?after_id=`           | live feed                                                  |
| GET    | `/admin/merchants/{id}/quotes/summary`                | pass/fail + drop-off by reason                             |
| GET    | `/admin/merchants/{id}/orders`                        | orders + hash verification                                 |

## Other

| Method | Path                    | Purpose                                  |
| ------ | ----------------------- | ---------------------------------------- |
| GET    | `/health`               | liveness                                 |
| GET    | `/paypal/return?token=` | PayPal redirect after approval → capture |
| GET    | `/paypal/cancel`        | PayPal redirect on cancel                |

Errors: [errors.md](errors.md).
