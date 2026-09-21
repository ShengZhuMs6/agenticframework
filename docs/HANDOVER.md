# Data Cortex - developer handover

Read [DEPLOY.md](DEPLOY.md) before any Azure operation. This revision was prepared from the approved cached `MainFeature` baseline, commit `1998fc9`. The user subsequently approved live repairs, both independent themed apps and removal of unreferenced legacy demo Search indexes. The original web image and shared infrastructure were preserved; no full reset was executed.

## Repository map

| Path | Responsibility |
|---|---|
| `src\bff\server.js` | HTTP routes, auth context and form dispatch |
| `src\bff\index\store.js` | Live merged catalogue and persisted agent overlays |
| `src\bff\adapters\` | Purview, APIM, Foundry, red team, storage/search and token boundaries |
| `src\bff\services\` | Visibility, assurance, build/publish, chat/requests, workflows and assessments |
| `src\bff\state\store.js` | Blob/file/memory persistence; one writer |
| `src\web\` | Server-rendered views, themes and styles |
| `bootstrap\` | The single neutral demo pack |
| `scripts\sample-data.js` | Deterministic synthetic CSVs and dictionaries derived from the pack |
| `scripts\reset-content.js` | Reviewable/resumable scoped content reset |
| `scripts\Deploy-CortexVariants.ps1` | Additional themed apps without changing original app deployment tags |
| `infra\` and `azure.yaml` | Base infrastructure and azd services |
| `test\` | Node tests, Azure HTTP stubs and local HTTP smoke tests |

## Integration facts to preserve

- Foundry agent CRUD uses project `/agents?api-version=v1`; responses use `/openai/v1/responses`. Agents have names and versions.
- Native agent red teaming follows the separate Evals/taxonomy preview routes documented in DEPLOY.md. Do not substitute model-only `redTeams` scans and call them agent assurance.
- APIM MCP management uses `2025-09-01-preview`, with `type: mcp` and a non-empty inline `mcpTools` array in the same PUT. Operation IDs are full ARM IDs. Wait for imported operations.
- The MCP endpoint is gateway/path/mcp, not an MCP API's often-null `serviceUrl`.
- Foundry MCP tools need per-target project connections carrying the APIM subscription key. A raw model tool header is not the replacement.
- Purview Unified Catalog uses the configured global endpoint and preview version; Data Map uses the account endpoint. Their role models are distinct from Azure RBAC.
- Purview product PUT is a full replacement. Preserve fields and owners. Managed attributes are arrays. Query published, draft and expired products and paginate.
- Product listing failure must stop bootstrap creation: treating every product as new risks duplicates.
- Windows Azure CLI is `az.cmd`. The token helper's validated shell invocation handles Node's Windows spawn restriction. Preserve its allowlist.
- No outbound call should be unbounded. Preserve timeouts, errors, provenance and partial-service notices.

## Behavior added in this revision

Live domains no longer need obsolete seed coordinates to render. Ordered workflows contain two to five steps and stop on failed/empty/oversized handoffs, keeping step evidence. New agent records store `builtById` for assessment authorization; legacy assessment access uses `cortex-redteam`.

Native assessment records preserve evaluation/taxonomy/run IDs and the pinned agent target. **Test and publish** automatically enables generated scenarios, submits the native scan, monitors its durable queue and publishes only after complete passing evidence. Published invocation pins the tested version. Standalone assessments still offer reviewer confirmation. Ambiguous submission does not silently retry; inspect Foundry with the recorded evaluation ID. Native result counts may omit `errored`; total/sample/grader completeness still fails closed.

The legacy unused `seed\` pack was removed. Demo data is synthetic, not a runtime service fallback. Bootstrap skills now have a real bounded storage-read shim rather than a published URL with no handler.

## Conventions and limits

Use Node built-ins at runtime, existing tests and `esc()` for untrusted HTML. Preserve server-side attachment validation, identity checks, and the distinction between visibility and underlying access. All state goes through `collection()`; use one replica per container.

Themes change presentation only. Variant deployment reuses source configuration and identity, isolates state and appends Entra redirects. It deliberately avoids azd service tags so the base deployment cannot accidentally target a variant. Its source must use direct configuration.

Reset is never part of normal deployment. Inspect every inventory item; use exact reviewed IDs for orphans whose ownership cannot be established. Do not delete shared platform resources, users, roles or customer content as a cleanup shortcut.

Known production gaps: live permission revalidation for scheduled runs, durable multi-writer state, stronger legacy machine-route authentication, external-tool authorization, assessment retention, and fuller operational controls. The user-facing About page states these boundaries.

## Release procedure

Run relevant Node tests and the offline bootstrap dry-run. Review PowerShell syntax and a mocked deployment run before requesting Azure approval. In Azure, verify latest-revision health, authentication, blob persistence, both themes, sample skill invocation and the complete Foundry taxonomy/run/results sequence. Stubbed tests cannot prove service availability or RBAC propagation.

### Live release status and remaining blocker

Both requested apps are deployed with unique state containers and Entra sign-in. The protected-secret connection recovered without purging; fourteen neutral Search indexes hold rows. Purview scanning completed and all fourteen sample files were registered and attached to their products. The approved twelve-index legacy migration preserved products/files/agents and unknown resources; some retained old datasets can still contain historical rows.

The deployed variants and bootstrap job use `prdcoreamlacr001.azurecr.io/cortex/web-cortex:release-20260921-r3`, digest `sha256:6fc1829b0017b9435b65b0629472357ea177475f04ce33737347261259cea51b`. Preserve a unique tag for each future release. The temporary no-tools acceptance agent, taxonomy and failed evaluation were removed after diagnosis; unrelated Foundry agents were untouched.

Native evaluation and taxonomy creation work, including activation of the 28 generated prohibited-action scenarios. Two native run submissions failed inside Foundry with an ACA-session `429 Too Many Requests` before generating results. This is the remaining end-to-end publication blocker, not evidence of a passed assessment. Do not bypass the gate. Check hosted evaluation capacity/service availability with Azure support. No customer-managed session pool was found in the Foundry resource group.

Reset still requires a fresh target-environment plan and approval. The original web app needs a separately chosen image deployment to pick up the new application code; the two variants and bootstrap job carry the repaired release.
