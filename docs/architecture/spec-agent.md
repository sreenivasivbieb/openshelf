# Spec Agent

**The Spec Agent turns an uploaded catalog into a store agents can trust.** It builds a deterministic
OpenAPI 3.1 spec, and when an Anthropic key is configured, an LLM adds four optional layers on top of the
rule-based results. The LLM proposes, code validates, and every layer falls back to the rule-based result
([ADR-0011](../adr/0011-spec-agent-template-plus-llm.md), NFR-08). It runs at onboarding only; `/quote` and
`/order` never touch it (ADR-0002, lint-enforced).

## What the LLM does

| Task              | When                                                | Input                                                      | Accepted only if                                                                           | On failure            |
| ----------------- | --------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------ | --------------------- |
| `firewall`        | commit, products that passed the rules, 20 per call | raw name, category, description                            | verdict for a SKU it was sent; can only **add** flags (reason prefixed `llm:`)             | rules verdict stands  |
| `rewrite`         | commit, clean products with text, 20 per call       | cleaned name, category, description                        | sanitized, ≤ 400 chars, no links, no firewall rule hit, every number appears in the source | cleaned merchant text |
| `mapping`         | preview only, when headers are unmapped             | unmapped headers + 3 sanitized sample values, open columns | header is unmapped, column is open, each used once; shown as suggestions, never applied    | no suggestions        |
| `spec-enrichment` | commit, once                                        | clean products (first 100)                                 | store description ≤ 300 chars, search examples ≤ 60 chars, both sanitized and rule-checked | template spec         |

`spec_status` is `ready` when enrichment added something, `fallback` when the template alone is stored.

## How it is built

- **Prompts** live in `src/services/prompts.ts`, one file to review. System prompts hold instructions only.
  Merchant text travels in a JSON data block (`dataBlock()`) with `<` escaped, so it cannot close the
  block or fake a tag. Every system prompt says the block is untrusted data, never instructions.
- **Client**: `src/integrations/llm/anthropic.client.ts`, behind the `LlmClient` port.
  - `client.beta.messages.parse` with `betaZodOutputFormat(schema)`: the API constrains the output to the
    schema, and the SDK validates it with Zod.
  - `fallbacks: "default"` with beta `server-side-fallback-2026-07-01`: a classifier decline is retried on
    Anthropic's recommended model in the same call, keeping the output format.
  - `refusal`, `max_tokens`, schema mismatch and API errors become `LlmError`, so the caller falls back.
- **Model and effort**: model from `SPEC_AGENT_MODEL` (default `claude-opus-5-5`). Thinking stays at the
  model default (adaptive). Effort is `medium` for the firewall and `low` for the rest.
- **Limits**: 20 products per call, 4 calls in parallel, a 120 s timeout and 2 SDK retries per call.
  Catalogs over 500 products skip the LLM layers and use the rules only, so an upload request stays bounded.
- **Fail closed**: a product the firewall returned no verdict for is stored as flagged (`not screened`).

## The OpenAPI template

`src/services/openapi-template.ts` builds the spec from `src/schemas` with zod-to-openapi. No LLM is
involved, and the same input always gives the same document.

| Part          | Content                                                                                                                                                                                                       |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `servers`     | `{PUBLIC_BASE_URL}/m/{merchant_id}/api`                                                                                                                                                                       |
| operations    | `searchProducts` (POST /search), `createQuote` (POST /quote), `createOrder` (POST /order), `trackOrder` (GET /track/{order_id}), each with typed responses and the `Error` body; optional `x-agent-id` header |
| components    | 14 named schemas; nested contracts are `$ref`s (for example `SearchResponse.results` → `ProductView`)                                                                                                         |
| `x-openshelf` | merchant id, currency, MCP URL, categories of clean products, and the LLM store description when present                                                                                                      |

- **Merchant name**: sanitized, and replaced by `Store <id>` if a firewall rule fires on it.
- **When it is built**: at commit, the spec is saved in `merchants.spec_json`.
- **Serving**: `GET /m/{id}/openapi.json` serves the stored spec, or the template if no catalog was committed yet.

## Cost (rough estimate, not measured)

A commit makes about `2 × ceil(products / 20) + 1` calls: 3 for the 10-product seed catalog, 11 for 100
products. A preview with unmapped headers makes one more. At Claude Opus 5.5 prices ($4 input / $20 output
per million tokens), a 100-product catalog is roughly a few tens of cents. Thinking tokens count as
output. Without `ANTHROPIC_API_KEY` there are no calls and no cost.

## Tests

`tests/helpers/fake-llm.ts` scripts replies per task, validates them like the SDK, and records what was
sent. No test calls the real API.

- Unit: `tests/unit/services/{openapi-template,spec.service,firewall.service,mapping-suggestions,prompts}.test.ts`.
- Integration, with and without an LLM: `tests/integration/spec.test.ts`.
