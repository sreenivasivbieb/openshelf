# Errors and reason codes

Error body: `{ "error": { "code": "<CODE>", "message": "<text>" } }`. Codes are stable; messages are for humans.

| HTTP | Code                     | When                                                                         |
| ---- | ------------------------ | ---------------------------------------------------------------------------- |
| 400  | `INVALID_INPUT`          | body or query failed validation                                              |
| 400  | `INVALID_JSON`           | body is not valid JSON                                                       |
| 400  | `CSV_REQUIRED`           | catalog upload without a `text/csv` body                                     |
| 400  | `INVALID_CSV`            | empty file, no header row, or unreadable CSV (e.g. an unclosed quote)        |
| 400  | `INVALID_MAPPING`        | `mapping` query is not JSON                                                  |
| 401  | `UNAUTHORIZED`           | missing or wrong admin token                                                 |
| 404  | `MERCHANT_NOT_FOUND`     | no store with that id                                                        |
| 404  | `QUOTE_NOT_FOUND`        | no such quote in this store                                                  |
| 404  | `ORDER_NOT_FOUND`        | no such order in this store, or an unknown PayPal checkout                   |
| 409  | `MERCHANT_EXISTS`        | store id already taken (seed script only)                                    |
| 409  | `QUOTE_EXPIRED`          | the quote's 15 minutes are over                                              |
| 409  | `QUOTE_HASH_MISMATCH`    | the stored quote no longer matches its hash                                  |
| 409  | `OUT_OF_STOCK`           | not enough stock left to order the quote                                     |
| 409  | `PRODUCT_FLAGGED`        | the product is not available to agents                                       |
| 409  | `INVALID_TRANSITION`     | fulfilment step out of order (only CAPTURED → SHIPPED → DELIVERED)           |
| 413  | `PAYLOAD_TOO_LARGE`      | body over the limit (100 kB JSON, 2 MB CSV)                                  |
| 413  | `TOO_MANY_ROWS`          | more than 5,000 products in one upload                                       |
| 422  | `MISSING_COLUMNS`        | commit without a column for name, price, stock, shipping days or return days |
| 422  | `CATALOG_HAS_ERRORS`     | commit of a file that still has row problems (preview lists them)            |
| 422  | `CATALOG_EMPTY`          | header row but no products                                                   |
| 429  | `RATE_LIMITED`           | too many requests from one IP                                                |
| 501  | `NOT_IMPLEMENTED`        | route exists, feature not built yet                                          |
| 502  | `PAYMENT_PROVIDER_ERROR` | PayPal failed or answered unexpectedly (no secrets in the message)           |
| 503  | `PAYMENT_NOT_CONFIGURED` | PayPal credentials not set on the server                                     |
| 500  | `INTERNAL`               | anything unexpected (logged with the request id)                             |

Telemetry: every call that reaches a store route is logged, failures with `outcome = error` and the code
above. Malformed JSON and rate-limited requests are rejected before that point and are not logged.

## Quote reason codes (`src/domain/enums.ts`) — append-only, never renamed

| Code                      | Meaning                                    |
| ------------------------- | ------------------------------------------ |
| `SKU_NOT_FOUND`           | no such SKU for this merchant              |
| `OUT_OF_STOCK`            | stock < quantity                           |
| `PRODUCT_FLAGGED`         | product text failed the prompt firewall    |
| `OVER_BUDGET`             | total > `max_budget`                       |
| `SHIPPING_TOO_SLOW`       | `shipping_days` > `max_shipping_days`      |
| `RETURN_WINDOW_TOO_SHORT` | `return_days` < `min_return_days`          |
| `RATING_TOO_LOW`          | `rating_avg` < `min_rating`                |
| `RATING_UNKNOWN`          | `min_rating` sent, merchant gave no rating |
| `TOO_FEW_REVIEWS`         | `review_count` < `min_review_count`        |

## Order and tracking error codes

| Code                     | HTTP | Agent should                                       |
| ------------------------ | ---- | -------------------------------------------------- |
| `QUOTE_NOT_FOUND`        | 404  | request a new quote                                |
| `QUOTE_EXPIRED`          | 409  | request a new quote                                |
| `QUOTE_HASH_MISMATCH`    | 409  | stop; the terms changed after locking              |
| `OUT_OF_STOCK`           | 409  | search again                                       |
| `PRODUCT_FLAGGED`        | 409  | pick another product                               |
| `PAYMENT_PROVIDER_ERROR` | 502  | retry with the same `quote_id` (safe, idempotent)  |
| `PAYMENT_NOT_CONFIGURED` | 503  | tell the human this store cannot take payments yet |
| `ORDER_NOT_FOUND`        | 404  | check the `order_id` returned by `/order`          |

A failed capture is not an API error: the order shows `CAPTURE_FAILED` in `/track`, with the reason in its
history (`OUT_OF_STOCK`, a PayPal issue code such as `INSTRUMENT_DECLINED`, or `PAYMENT_PROVIDER_ERROR`).
