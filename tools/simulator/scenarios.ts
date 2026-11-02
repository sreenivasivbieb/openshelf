import type { QuoteRequest } from "../../src/schemas/quote.schema";
import type { QuoteReasonCode } from "../../src/domain/enums";

/** One simulated agent run. `expect` makes the simulator double as an end-to-end test (FR-16). */
export interface Scenario {
  name: string;
  agentId: string;
  query: string;
  guardrails: Omit<QuoteRequest, "sku" | "quantity">;
  expect: "pass" | QuoteReasonCode | "QUOTE_EXPIRED";
  waitForExpiry?: boolean;
}

export const SCENARIOS: Scenario[] = [
  {
    name: "happy path",
    agentId: "sim-frugal-shopper",
    query: "ceramic mug",
    guardrails: { max_budget: 40, max_shipping_days: 4, min_return_days: 14 },
    expect: "pass",
  },
  {
    name: "over budget",
    agentId: "sim-tight-budget",
    query: "ceramic mug",
    guardrails: { max_budget: 10 },
    expect: "OVER_BUDGET",
  },
  {
    name: "shipping too slow",
    agentId: "sim-in-a-hurry",
    query: "brass lamp",
    guardrails: { max_shipping_days: 2 },
    expect: "SHIPPING_TOO_SLOW",
  },
  {
    name: "rating too low",
    agentId: "sim-picky",
    query: "tote bag",
    guardrails: { min_rating: 4.5, min_review_count: 50 },
    expect: "RATING_TOO_LOW",
  },
  {
    name: "expired quote",
    agentId: "sim-slow-human",
    query: "ceramic mug",
    guardrails: { max_budget: 40 },
    expect: "QUOTE_EXPIRED",
    waitForExpiry: true,
  },
  {
    name: "planted injection text",
    agentId: "sim-curious",
    query: "soy candle",
    guardrails: {},
    expect: "PRODUCT_FLAGGED",
  },
];
