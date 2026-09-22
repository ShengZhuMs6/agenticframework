# Data Cortex

A customer-neutral Microsoft technology accelerator connecting **Microsoft Purview Data Map and Unified Catalog**, **Azure API Management**, **Azure AI Search / Foundry IQ**, and **Microsoft Foundry** through Cortex.

Ask or search from one starting input; discover artefacts, build and assess agents, publish reusable endpoints, and coordinate sequential or parallel workflows. This is a proof of concept, not an official customer service or a production landing zone.

## Start here

Read [the deployment guide](docs/DEPLOY.md) before running scripts. It covers prerequisites, existing-resource preservation, independent redeployment, neutral bootstrap, content reset and additional themes.

```powershell
npm test
node .\scripts\bootstrap.js --dry-run
node .\scripts\sample-data.js --list
```

These commands do not write to Azure. Running the application normally does use real Azure services; there is no runtime offline/demo mode.

## Capabilities

| Area | Implementation |
|---|---|
| Cortex | Unified Ask/Search landing input, merged live catalogue, filters and entry pages; legacy Marketplace URLs remain compatible |
| Map | Deterministic SVG layout from live governance domains, recorded dependencies, text alternative and degraded-service notice |
| Agent creation and publishing | Foundry agents, grounding connections, APIM REST-to-MCP publishing |
| Assurance | Automatic Microsoft Responsible AI/NIST configuration review; native red-team sample results in gates; browser axe checks plus manual WCAG 2.2 AA review. Advisory publication requires explicit acknowledgement when bypassing failed/missing scan evidence |
| Task automation | AI-assisted editable proposals; one to five total steps, up to three parallel; all-success joins, bounded handoff and explicit approval |
| Demo content | Fourteen synthetic products, 15,050 verified rows, five analyst/reviewer blueprints and a manual operations briefing in `bootstrap/demo-journey.json` |
| Presentation | Existing `defra` theme plus original `microsoft` and `novo` inspired themes |
| State | One writer per blob container; each additional web app gets a distinct state container |
| Reset | Read-only inventory, reviewed confirmation hash, stale-plan refusal, resumable progress; no resource-group deletion |

The backend uses Node built-ins, `graphql`, the official MCP SDK and `fflate` for app packages. Vendored GOV.UK styling and axe-core support the browser UI. Server-rendered pages work without JavaScript; an accessible bottom-right dialog enhances chat links. Microsoft, Novo and Defra themes include original brand-aligned illustrations. The original full Novo About content is preserved unchanged.

**Share your artefact** offers slim metadata, configured-source Foundry IQ onboarding, existing REST/GraphQL query-to-MCP publication, external-agent onboarding and Teams/Microsoft 365 app packages. Legacy indexed-data GraphQL artefacts remain supported. Native tenant submission is a separate consented path. See deployment limitations before claiming end-to-end delivery.

## Documentation

- [Deploy, verify and iterate](docs/DEPLOY.md)
- [Current end-to-end demo plan](docs/DEMO.md)
- [Architecture and boundaries](docs/ARCHITECTURE.md)
- [Developer handover](docs/HANDOVER.md)
- [Change report](CHANGES.md)
- [Earlier integration lessons](FIXES.md)

All demo rows are synthetic; Azure usage is real. The September demo refresh aligns all three apps. A reviewed reset removed 313 demo objects; 18 provider-side evaluation/taxonomy objects were retained by explicit approval. Data assets, indexes and per-product Foundry IQ connections were rebuilt and exercised live. Existing Fabric/Studio prerequisites, native red-team capacity and tenant channel installation remain distinct from the rehearsed demo paths. No paid capacity or administrative permission increase was made during this refresh.
