# Request flows

## Buyer agent: search → quote → order → approve → capture → track

```mermaid
sequenceDiagram
  participant Ag as Buyer agent
  participant S as OpenShelf
  participant DB as SQLite
  participant PP as PayPal sandbox
  participant Hu as Human

  Ag->>S: search(query, filters)
  S->>DB: FTS5 + filters (clean products only)
  S-->>Ag: products
  Ag->>S: quote(sku, guardrails)
  S->>S: evaluateGuardrails (pure)
  alt pass
    S->>DB: insert quote (expires +15 min, sha256 hash)
    S-->>Ag: quote_id, price, expires_at, quote_hash
  else fail
    S-->>Ag: reason_codes, retry_hint, nearest_passing_sku
  end
  Ag->>S: order(quote_id)
  S->>DB: existing order? expired? recomputed hash == stored?
  S->>PP: create order (PayPal-Request-Id = quote_id)
  S->>DB: insert order + CREATED event
  S-->>Ag: approve_url
  Ag-->>Hu: "approve in PayPal"
  Hu->>PP: approve
  PP->>S: GET /paypal/return?token=...
  S->>DB: tx: re-check + decrement stock
  S->>PP: capture
  S->>DB: CAPTURED event
  Ag->>S: track(order_id)
  S-->>Ag: status + history
```

Each agent call above writes exactly one `telemetry` row. A failed quote is not stored in `quotes`; its
reasons live in telemetry and feed the drop-off view.

## Merchant onboarding

```mermaid
sequenceDiagram
  participant M as Merchant (web/)
  participant S as OpenShelf /admin
  participant L as Claude API

  M->>S: POST /merchants (name, currency, PayPal payee email)
  M->>S: POST /catalog/preview (CSV)
  S->>S: csv-parse → mapColumns (synonyms)
  opt unmapped headers and LLM configured
    S->>L: suggest mapping
  end
  S-->>M: mapping, suggestions, bad rows with row numbers
  M->>S: POST /catalog/commit (CSV + confirmed mapping)
  S->>S: save products
  loop each product
    S->>S: firewall rules
    opt rules pass and LLM configured
      S->>L: injection verdict, then description rewrite
    end
  end
  S->>S: template spec from src/schemas
  opt LLM configured
    S->>L: enrich spec → validate (fallback to template on any failure)
  end
  S-->>M: store ready: /m/{id}/mcp, /m/{id}/openapi.json, clean/flagged counts
```
