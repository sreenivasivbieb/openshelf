# REST API

Contract source: `src/schemas/`. Shapes may change until the Nov 9 freeze. Errors: [errors.md](errors.md).

## Buyer-facing (per merchant) — rate limited, 120 requests/min per IP

| Method | Path                           | Body / params   | Returns                                           | Built  |
| ------ | ------------------------------ | --------------- | ------------------------------------------------- | ------ |
| POST   | `/m/{id}/api/search`           | `SearchRequest` | `{ results: ProductView[] }`                      | yes    |
| POST   | `/m/{id}/api/quote`            | `QuoteRequest`  | `QuotePass` or `QuoteFail`                        | yes    |
| POST   | `/m/{id}/api/order`            | `{ quote_id }`  | `201 { order_id, quote_id, status, approve_url }` | step 5 |
| GET    | `/m/{id}/api/track/{order_id}` | —               | `{ order_id, status, history[] }`                 | step 5 |
| GET    | `/m/{id}/openapi.json`         | —               | OpenAPI 3.1 document                              | step 9 |

Optional headers: `X-Agent-Id` (agent name, self-declared), `X-Simulated: 1` (simulator traffic), `X-Request-Id`.
Every call writes one telemetry row, including calls that fail validation.

### Search

```json
{
  "query": "ceramic mug",
  "max_price": 40,
  "max_shipping_days": 4,
  "min_rating": 4.0,
  "in_stock_only": true,
  "limit": 10
}
```

- `query` is required; filters are optional (`in_stock_only` defaults to true, `limit` to 10, max 50).
- Words match name, description and category with stemming ("mugs" finds "mug"); best matches come first,
  then cheaper. A query with no searchable words (for example `"*"`) browses the catalog instead.
- Only products that passed the prompt firewall are ever returned. Products without a rating never pass `min_rating`.

Result item:

```json
{
  "sku": "MUG-014",
  "name": "Hand-glazed ceramic mug",
  "description": "350 ml stoneware mug glazed by hand. Dishwasher safe.",
  "category": "Kitchen",
  "price": 36,
  "currency": "USD",
  "stock": 40,
  "in_stock": true,
  "shipping_days": 3,
  "return_days": 30,
  "rating_avg": 4.6,
  "review_count": 128,
  "ratings_source": "merchant_reported"
}
```

### Quote

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

Every rule is optional; only the rules sent are checked. `max_budget` is the total for the quantity, in the
store's currency. Boundaries pass (a total equal to the budget is fine). Ratings and review counts are
merchant-reported: a product without a rating fails `min_rating` as `RATING_UNKNOWN`. The same rules
always give the same decision.

**Pass**: the terms are locked for 15 minutes and stored insert-only:

```json
{
  "status": "pass",
  "quote_id": "q_SGeJ9TZBgMKnPJMV",
  "sku": "MUG-014",
  "quantity": 1,
  "unit_price": 36,
  "price": 36,
  "currency": "USD",
  "shipping_days": 3,
  "return_days": 30,
  "expires_at": "2026-11-09T10:15:00.000Z",
  "quote_hash": "84b18ec3…",
  "locked_terms": {
    "currency": "USD",
    "expires_at": "2026-11-09T10:15:00.000Z",
    "merchant_id": "m_demo",
    "quantity": 1,
    "quote_id": "q_SGeJ9TZBgMKnPJMV",
    "return_days": 30,
    "shipping_days": 3,
    "sku": "MUG-014",
    "total_minor": 3600,
    "unit_price_minor": 3600
  }
}
```

**Verify a quote hash.** `locked_terms` holds exactly what the hash covers. An agent can check it without
trusting the server:

```
quote_hash = sha256_hex("openshelf-quote-v1:" + canonical_json(locked_terms))
canonical_json = RFC 8785 (JCS): keys sorted, no whitespace (strings and integers only)
```

Golden vector to test an implementation:

```
locked_terms   {"currency":"USD","expires_at":"2026-11-09T10:15:00.000Z","merchant_id":"m_demo","quantity":1,"quote_id":"q_example","return_days":30,"shipping_days":3,"sku":"MUG-014","total_minor":3600,"unit_price_minor":3600}
quote_hash     98930253061b434605c070da2189f775ca19248cbc42df481ecb4a9cb971aee8
```

**Fail**: every failed rule, the product's real terms, a plain-language hint, and another product that
passes every rule sent, when one exists. The alternative is chosen deterministically: most similar by
name and category first, then cheaper.

```json
{
  "status": "fail",
  "reason_codes": ["SHIPPING_TOO_SLOW"],
  "retry_hint": "Ships in 7 days (you asked for at most 2). LAMP-003 (Brass table lamp (express)) meets all your rules: 99 USD total, ships in 2 days, 14-day returns.",
  "nearest_passing_sku": "LAMP-003",
  "actual": {
    "price": 89,
    "currency": "USD",
    "stock": 6,
    "shipping_days": 7,
    "return_days": 14,
    "rating_avg": 4.8,
    "review_count": 22
  }
}
```

`PRODUCT_FLAGGED` and `SKU_NOT_FOUND` return only `reason_codes` and `retry_hint`. Codes: [errors.md](errors.md).

## Merchant / admin — `Authorization: Bearer <ADMIN_TOKEN>`

| Method | Path                                             | Purpose                                                                      | Built  |
| ------ | ------------------------------------------------ | ---------------------------------------------------------------------------- | ------ |
| POST   | `/admin/merchants`                               | create a store: `{ name, currency?, paypal_payee_email? }` → `201 StoreInfo` | yes    |
| GET    | `/admin/merchants/{id}`                          | `StoreInfo`: MCP URL, OpenAPI URL, product counts, flagged products          | yes    |
| POST   | `/admin/merchants/{id}/catalog/preview?mapping=` | CSV body → `CatalogPreview`; nothing is saved                                | yes    |
| POST   | `/admin/merchants/{id}/catalog/commit?mapping=`  | CSV body → `StoreInfo`; replaces the catalog                                 | yes    |
| GET    | `/admin/merchants/{id}/telemetry?after_id=`      | live feed                                                                    | step 8 |
| GET    | `/admin/merchants/{id}/quotes/summary`           | pass/fail + drop-off by reason                                               | step 8 |
| GET    | `/admin/merchants/{id}/orders`                   | orders + hash verification                                                   | step 8 |

### Catalog upload

- Send the file as the raw body with `Content-Type: text/csv`: up to 2 MB and 5,000 products, comma,
  semicolon or tab separated, UTF-8 (in Excel: "CSV UTF-8").
- Required columns: name, price, stock, shipping days, return days. Optional: SKU (generated from the name
  when absent), description, category, rating, review count.
- Headers are matched by synonyms (`MRP`, `Ships In`, `No. of Reviews`, …; list in
  `src/domain/column-mapping.ts`). With both a selling price and an MRP, the selling price wins.
- Cells may carry currency symbols and units: `$36.50`, `Rs. 499`, `1,299`, `3 days`, `4.5/5`. Ranges
  such as `7-10` are rejected; use one number.
- `mapping` = the merchant's corrections, URL-encoded JSON of header → column, for example
  `{"Ships":"shipping_days","Blurb":"description"}`. Columns: `sku`, `name`, `description`, `category`,
  `price`, `stock`, `shipping_days`, `return_days`, `rating_avg`, `review_count`.
- **Preview** lists every problem as `{ row, column, message }`: spreadsheet row (header = row 1) and the
  merchant's own header name. It also returns the mapping, unmapped headers, missing required columns and
  5 sample rows.
- **Commit** is strict: any problem returns `422` and nothing changes. On success the catalog is replaced
  as a whole. Each product is screened by the prompt firewall. Flagged products appear in
  `StoreInfo.flagged_products` and are never shown to agents. The raw text is kept for audit.

Preview response (abridged):

```json
{
  "mapping": { "Item Code": "sku", "Title": "name", "Selling Price (USD)": "price" },
  "unmapped": [],
  "missing_required": [],
  "total_rows": 3,
  "valid_rows": 1,
  "error_count": 3,
  "errors": [
    { "row": 3, "column": "Title", "message": "is required" },
    { "row": 4, "column": "Selling Price (USD)", "message": "must be greater than 0" },
    { "row": 4, "column": "Dispatch Days", "message": "must be a number" }
  ],
  "sample": [{ "sku": "A-1", "name": "Clay pot", "price": 9.5 }]
}
```

## Other

| Method | Path                    | Purpose                                           |
| ------ | ----------------------- | ------------------------------------------------- |
| GET    | `/health`               | liveness                                          |
| GET    | `/paypal/return?token=` | PayPal redirect after approval → capture (step 5) |
| GET    | `/paypal/cancel`        | PayPal redirect on cancel                         |
