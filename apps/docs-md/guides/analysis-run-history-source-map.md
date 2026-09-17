# Analysis run history and source ownership

Task 41 changes application infrastructure. It does not change probability, uncertainty, hazard, ordering or cut-set algorithms in PRAXIS, TensorBayes or HCL_MH.

## Execution and reference rules

1. An execution gets a private workbook-read scope. Each SY, ES, ESQ, DA or HRA workbook is loaded and authorized once, and every adapter uses that version. Overlapping executions have separate scopes. This is consistency per workbook, not a database-wide transaction across workbooks.
2. The run stores original workbook snapshots and their revisions/project IDs, the public request, typed contributions and the exact adapted native envelope sent to Praetor.
3. DA parameters and HRA quantifications resolve only through their explicit workbook references. A missing source or entity is an error requiring relinking; matching entity IDs elsewhere are not substitutes.
4. Praetor hashes the actual loaded `.node` binary before computation. Its response carries `engine.name = PRAXIS` and `engine.version = sha256:<digest>`. Numerical responses are unchanged. A timeout or transport failure can have no build identity if the worker never returned it.
5. A saved request can be replayed against the same native build without reading current workbook data. This records the build identity, not a backup of the binary itself. Preserve that build separately when long-term replay is required. Wall-clock diagnostics can differ on replay.

## Saved history

SY, ES and ESQ use one shared history component, available beside their analysis views. It includes ordinary FT/ET, standalone BN and HCL executions. History pages scan 25 records, newest first, using a timestamp/run-ID cursor. Records with inaccessible sources are omitted; an empty page can still have older accessible runs.

HCL evidence batches create one parent and scenario children. The parent stores the full native request, batch compilation counts and complete returned hazard summary. Children retain their individual results, uncertainty and diagnostics. History lists the parent once; its detail view and JSON download include every member. Opening a child through the API also supplies the parent's native request.

The backend validates all native batch rows before saving successful results. If a child write fails, it waits for outstanding writes, then marks the batch and children failed and clears partial results. This is failure cleanup, not a MongoDB transaction; a database outage can also prevent failure recording.

The UI displays the returned values without recalculation. Event-tree and BN labels come from original workbook snapshots. Raw IDs remain available when historical labels cannot be read. JSON download includes input snapshots, exact request when recorded, metadata, returned results and batch members.

## Authorization and freshness

Every history, metadata, result and detail read checks the owner and every contributing source project. New records retain the original source project as well as checking the current project, preventing source movement from silently granting access to old snapshots.

- `CURRENT`: all source revisions match the saved revisions.
- `STALE`: at least one source changed or is missing. The saved result stays unchanged and is labelled historical.
- `UNKNOWN`: source freshness cannot be established from available metadata.

A deleted source is readable historically only when its saved project is recorded and the caller still has access. Old records lacking that project identity are denied when the source no longer exists. The owner workbook must still exist to address its history.

Active views check tracked runs after execution, on browser focus/visibility changes and every 30 seconds while visible. Source changes invalidate current results; history retains the original calculation. Permission checks occur on retrieval and refresh, not through a push-based revocation service.

## API

For `host = sy | es | esq`:

- `GET /api/{host}-workbooks/{workbookId}/analysis-runs?cursor=...`: authorized paginated history.
- `GET /api/{host}-workbooks/{workbookId}/analysis-runs/{runId}`: metadata and current source status.
- `GET /api/{host}-workbooks/{workbookId}/analysis-runs/{runId}/details`: original inputs, result and batch members.

Existing model-specific metadata and result routes remain and use the same permission checks. Execution routes remain unchanged; HCL batch responses additionally return the saved `batchId`.

## Historical records

There is no retrospective invention of provenance. Existing records without typed targets/contributions remain listable when authorized. Records without native requests or binary fingerprints are explicitly labelled not recorded. Older batch children remain individual historical records; missing original combined hazard summaries cannot be reconstructed reliably. New executions supply complete batch parents.

No migration of numerical results or automatic rewriting of DA/HRA references occurs. Repair unavailable links through the existing explicit source selectors and save before running again.

## Code map

| Responsibility | Source |
| --- | --- |
| One workbook read per execution | `apps/backends/web-backend/src/newly-developed-methods/shared/analysis-workbook-scope.ts` |
| Execution, exact requests, explicit references, history and source authorization | `apps/backends/web-backend/src/newly-developed-methods/shared/workbook-analysis-runs.service.ts` |
| Persisted immutable inputs and batch identity | `apps/backends/web-backend/src/newly-developed-methods/shared/analysis-run-record.schema.ts` |
| History/snapshot contracts | `apps/interfaces/shared-types/newly-developed-methods/shared/analysis-run.ts` |
| Actual binary fingerprint | `apps/microservices/praetor/src/execution/workers/praxis.worker.js` |
| Envelope validation without native loading | `apps/solvers/praxis-node/protocol.js` |
| Shared history and snapshot labels | `apps/frontends/web-frontend/src/newly-developed-methods/shared/analysisRunHistory.tsx` |
| Active source checks | `apps/frontends/web-frontend/src/newly-developed-methods/shared/useAnalysisSourceGuard.ts` |
| Run notifications | `apps/frontends/web-frontend/src/newly-developed-methods/shared/analysisRunEvents.ts` |

The former ESQ-only provenance component and silent DA/HRA fallback searches were removed. Original solver source ownership is unchanged; these are the frontend/backend/addon transport adaptations permitted by the agreed source boundary.

## Verification

510 targeted tests passed across backend/database/native execution (65), frontend (66), shared contracts (197), Praetor (43) and Node addon/protocol (139). A live browser fixture saved FT, ET, hazard batch, uncertainty batch and BN runs through real backend controllers, temporary MongoDB, compiled Praetor and the native addon. It verified historical values, stale DA detection and source-access revocation. Fixture authentication was mocked; this was not a production authorization test.

Frontend/backend production builds and typechecks passed. Compiled-worker checks rebuilt Praetor and verified its canonical worker asset. No Linux or deployment check was performed. See the task 41 report under `outputs/hcl-task41/REPORT.md` for logs and protected-source hashes.
