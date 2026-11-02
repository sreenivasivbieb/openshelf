# Errors and reason codes

Error body: `{ "error": { "code": "<CODE>", "message": "<text>" } }`.

| HTTP | Code                     | When                                         |
| ---- | ------------------------ | -------------------------------------------- |
| 400  | `INVALID_INPUT`          | body/query failed Zod validation             |
| 401  | `UNAUTHORIZED`           | missing or wrong admin token                 |
| 429  | `RATE_LIMITED`           | too many requests from one IP                |
| 501  | `NOT_IMPLEMENTED`        | route exists, feature not built yet          |
| 503  | `PAYMENT_NOT_CONFIGURED` | PayPal credentials not set on the server     |
| 500  | `INTERNAL`               | anything unexpected (logged with request id) |

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

## Order error codes

| Code                               | Agent should                                      |
| ---------------------------------- | ------------------------------------------------- |
| `QUOTE_NOT_FOUND`, `QUOTE_EXPIRED` | request a new quote                               |
| `QUOTE_HASH_MISMATCH`              | stop; terms changed after locking                 |
| `OUT_OF_STOCK`                     | search again                                      |
| `PAYMENT_PROVIDER_ERROR`           | retry with the same `quote_id` (safe, idempotent) |
