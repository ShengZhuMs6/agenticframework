# Data Cortex

A customer-neutral Microsoft technology accelerator connecting **Microsoft Purview Data Map and Unified Catalog**, **Azure API Management**, and **Microsoft Foundry** in one marketplace.

Discover data products, APIs, MCP tools and agents; build and assess agents; publish reusable endpoints; coordinate ordered multi-agent workflows. This is a proof of concept, not an official customer service or a production landing zone.

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
| Marketplace | Merged live catalogue, visibility rules, search and entry pages |
| Map | Deterministic SVG layout from live governance domains, recorded dependencies, text alternative and degraded-service notice |
| Agent creation and publishing | Foundry agents, grounding connections, APIM REST-to-MCP publishing |
| Red teaming | Automatic native Foundry assessment before publishing; enabled generated scenarios, complete passing-evidence gate and pinned runtime version |
| Task automation | Two to five ordered agents, per-step results, bounded handoff and final draft; older schedules remain compatible |
| Demo content | One neutral pack: nine domains, fourteen synthetic data products, six API/MCP skills |
| Presentation | Existing `defra` theme plus original `microsoft` and `novo` inspired themes |
| State | One writer per blob container; each additional web app gets a distinct state container |
| Reset | Read-only inventory, reviewed confirmation hash, stale-plan refusal, resumable progress; no resource-group deletion |

The backend uses Node built-ins. `govuk-frontend` is a build-time dependency. Pages are server-rendered and work without client JavaScript.

## Documentation

- [Deploy, verify and iterate](docs/DEPLOY.md)
- [Architecture and boundaries](docs/ARCHITECTURE.md)
- [Developer handover](docs/HANDOVER.md)
- [Change report](CHANGES.md)
- [Earlier integration lessons](FIXES.md)

All demo rows are synthetic. Foundry calls, gateway traffic, storage and search incur real Azure usage. The two themed apps are deployed; the original web image is unchanged. Native scan execution is currently blocked by Foundry's hosted ACA-session 429, and publication fails closed. See DEPLOY.md for live status and URLs. No full content reset was performed.
