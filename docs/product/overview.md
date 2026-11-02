# Product overview

**OpenShelf turns a merchant's product spreadsheet and PayPal account into a store that AI shopping
agents can search, quote and buy from, in about 10 minutes, without moving to a store platform.**
Entry for the PayPal AI Hackathon 2026.

## Problem

Shopping agents (Claude, ChatGPT, Perplexity) work well with stores that expose clean APIs. A small
seller with only an Excel sheet or a WhatsApp catalog has no API, no agent-safe checkout, and no way to
see what agents are looking for.

## Solution

The merchant uploads a CSV and connects PayPal. OpenShelf returns:

- an MCP server URL (`/m/{merchant_id}/mcp`) and an OpenAPI 3.1 spec
- a guardrailed `/quote`: the agent sends the buyer's rules, gets a locked, hashed quote or exact reasons
- PayPal checkout where the human approves payment inside PayPal (sandbox)
- an AG Grid dashboard of agent activity: searches, quote pass/fail, drop-off by reason, orders

## Users

| User                    | Needs                                                                |
| ----------------------- | -------------------------------------------------------------------- |
| Merchant (small seller) | get listed for agents without a platform; see why agents did not buy |
| Buyer agent             | a predictable contract: search, quote with rules, order, track       |
| Human buyer             | final say on payment, inside PayPal                                  |
| Judges                  | a live demo and a link to try                                        |

## Scope

| Tier                 | In it                                                                                                                                                                                                                     |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Must (MVP)           | CSV upload + mapping; Spec Agent; prompt-injection check; `/search` `/quote` `/order` `/track`; guardrails; quote hash; PayPal sandbox order/approve/capture; MCP endpoint; telemetry; AG Grid dashboard; buyer simulator |
| Should (if time)     | `/.well-known/ucp` profile and `/store.md`; `/return` with PayPal refund; scoped agent API keys; counter-offers; AG Studio chat over telemetry                                                                            |
| Roadmap (pitch only) | proof-of-machine identity; ephemeral spend tokens and escrow; dispute arbitration on carrier tracking; verified reviews                                                                                                   |

Source: the team's build blueprint (Claude Docs, 2026-11-02). Requirements: [requirements.md](requirements.md).
