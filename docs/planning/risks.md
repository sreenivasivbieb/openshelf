# Risks and open items

| Risk                                                                     | Impact                  | Fallback                                                                                   |
| ------------------------------------------------------------------------ | ----------------------- | ------------------------------------------------------------------------------------------ |
| APIMatic MCP generator is alpha, access by email                         | no generated MCP server | our MCP server is the baseline; APIMatic for SDK + portal only                             |
| PayPal sandbox slow or failing in the demo                               | demo stalls             | backup video; pre-created sandbox order                                                    |
| Payee routing misbehaves in sandbox (ADR-0008)                           | payment lands wrong     | one demo seller account                                                                    |
| Agent leaves after a failed quote                                        | lost sale               | structured reasons + nearest passing SKU; dashboard shows drop-off; no claim agents return |
| Merchants enter fake ratings                                             | trust                   | labelled merchant-reported; verified reviews on roadmap                                    |
| Prompt injection in product text                                         | agent hijacked          | firewall at upload; no review text in MVP                                                  |
| Similar projects (PayPal Agent Ready / Store Sync; Leafline agent store) | weak differentiation    | lead with CSV → store, firewall, quote hash, dashboard                                     |
| Deadline unclear (Nov 12 blog vs Nov 13 listing)                         | late submission         | confirm on Devpost; freeze Nov 9                                                           |
| Judges want a link                                                       | no public URL           | Render backup or tunnel                                                                    |

## Open items

- [ ] Email support@apimatic.io for MCP generator access
- [ ] Create PayPal sandbox app with business (payee) and personal (buyer) accounts
- [ ] Get the AG Studio license key and clone the official boilerplate
- [ ] Confirm deadline and submission rules on Devpost
- [ ] Pick the final project name (shortlist: Haat, Thela, Shelfy)
