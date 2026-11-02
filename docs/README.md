# OpenShelf documentation

Start with **product/overview.md**, then **architecture/overview.md**. Everything else is reference.

| Folder                         | What lives there                                                      | Read when                                   |
| ------------------------------ | --------------------------------------------------------------------- | ------------------------------------------- |
| [product/](product/)           | what we build and why; requirements with IDs (FR-xx, NFR-xx)          | you need to know _what_                     |
| [architecture/](architecture/) | layers, components, request flows, data model, requirement → code map | you need to know _how_                      |
| [api/](api/)                   | REST routes, MCP tools, error and reason codes                        | you integrate or change a contract          |
| [adr/](adr/)                   | one file per architecture decision, never rewritten                   | you wonder _why_ something is the way it is |
| [guides/](guides/)             | setup, coding conventions, testing, deployment                        | you are about to write or ship code         |
| [runbooks/](runbooks/)         | step-by-step operational procedures (demo, fallbacks)                 | something must work live                    |
| [planning/](planning/)         | build plan, risks, open items                                         | you plan the next day                       |

Rules for docs: requirement IDs are stable and referenced from code comments; a changed decision gets a
new ADR that supersedes the old one; API docs change in the same PR as the schema in `src/schemas`.
