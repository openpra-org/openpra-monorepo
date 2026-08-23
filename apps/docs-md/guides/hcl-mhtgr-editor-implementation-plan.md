# HCL and MHTGR Editor Implementation Plan

This checklist governs the staged implementation of the fault-tree (FT), Bayesian-network (BN), and event-tree (ET) editors, followed by Hybrid Causal Logic (HCL) quantification. Importing the MHTGR model from SAPHIRE is future work and is not part of the active implementation scope.

## Working agreement

- A TODO may be checked only after its implementation has been verified.
- Prefer an automated test that is appropriately scoped to the completed TODO.
- When automation cannot establish that an interactive behavior works, stop and request a focused manual test before continuing to the next feature.
- Record the command and outcome, or the requested manual test and its outcome, in the verification log.
- Do not implement a batch of unrelated features and test them only afterward.
- Incomplete models must remain saveable; strict validation gates analysis, not drafting.

## Canonical editor architecture

- The canonical FT, BN, ET, and HCL frontend implementations live under `apps/frontends/web-frontend/src/newly-developed-methods`.
- `newly-developed-methods` is the shared implementation location, not a separate project-level model library or a second set of editors.
- Move the approved FT presentation and styling from SY Step 02 System Models into `newly-developed-methods/fault-tree`.
- Move the approved workbook ET presentation and styling into `newly-developed-methods/event-tree`.
- Keep those workbook screens visually and behaviorally continuous by having them import the canonical newly-developed-method components after extraction.
- Replace every other FT or ET renderer/editor with an import of the corresponding canonical component, then remove the superseded implementation. Do not preserve alternate FT or ET editors.
- Add the new BN implementation only under `newly-developed-methods/bayesian-network`; workbook screens import and host it in the same way.
- Editor source-code location and model-data ownership are separate concerns: editor code lives in `newly-developed-methods`, while saved analysis data remains owned by the workbook MEF that hosts it.
- Do not create a standalone model-library page, standalone project-level FT/ET/BN records, or project-level basic-event catalogue.
- Cross-workbook relationships use stable, typed workbook/entity references; they do not copy a second model into the consuming workbook.

Canonical source and host map:

| Method | Approved visual source | Canonical implementation | Workbook hosts |
| --- | --- | --- | --- |
| FT | SY Step 02 System Models | `newly-developed-methods/fault-tree` | SY Step 02 authors it; every other FT surface imports the same implementation |
| ET | ES Step 02 Event Sequences | `newly-developed-methods/event-tree` | ES authors event sequences; ESQ and other ET surfaces import the same implementation |
| BN | New OpenPRA editor | `newly-developed-methods/bayesian-network` | ESQ Step 05 Dependencies |
| HCL | Existing verified FT–BN–ET workflow | `newly-developed-methods/hybrid-causal-logic` | ESQ Step 05 configures bindings; ESQ Step 02 Integrate & Quantify executes them |

## Planned repository structure

```text
apps/interfaces/shared-types/newly-developed-methods/
├── shared/
│   ├── method-model.ts
│   ├── analysis-run.ts
│   ├── validation.ts
│   └── index.ts
├── fault-tree/
│   ├── fault-tree-model.ts
│   ├── fault-tree-requests.ts
│   ├── fault-tree-results.ts
│   ├── fault-tree-schemas.ts
│   └── index.ts
├── bayesian-network/
│   ├── bayesian-network-model.ts
│   ├── bayesian-network-requests.ts
│   ├── bayesian-network-results.ts
│   ├── bayesian-network-schemas.ts
│   └── index.ts
├── event-tree/
│   ├── event-tree-model.ts
│   ├── event-tree-requests.ts
│   ├── event-tree-results.ts
│   ├── event-tree-schemas.ts
│   └── index.ts
├── hybrid-causal-logic/
│   ├── hcl-configuration.ts
│   ├── hcl-bindings.ts
│   ├── hcl-requests.ts
│   ├── hcl-results.ts
│   ├── hcl-schemas.ts
│   └── index.ts
└── index.ts
```

```text
apps/frontends/web-frontend/src/newly-developed-methods/
├── shared/
├── fault-tree/
├── bayesian-network/
├── event-tree/
└── hybrid-causal-logic/
```

```text
apps/backends/web-backend/src/newly-developed-methods/
├── shared/
├── fault-tree/
├── bayesian-network/
├── event-tree/
└── hybrid-causal-logic/
```

The solver binding lives at `apps/solvers/praxis-node` as a NAPI-RS Node addon connecting the TypeScript services to PRAXIS and TensorBayes. Reusable editor, transport, validation, and solver contracts remain grouped by method under `newly-developed-methods`; workbook MEF schemas own persisted model data and analysis-run records own immutable execution snapshots.

## Phase 0 — Branch preparation and baseline

- [x] Fetch the latest `origin/main` after the documentation PR is merged.
- [x] Create `hcl_implementation_mhtgr_model_import` from updated `origin/main`.
- [x] Create this implementation checklist and verification policy.
- [x] Verify the existing FT presentation before changing functionality.
- [x] Verify the existing ET presentation before changing functionality.

Editor delivery order:

1. Fault Tree.
2. Bayesian Network.
3. Event Tree.
4. Combined FT–BN–ET quantification.

## Architecture-remediation gate

Do not begin editor feature work until this correction is complete and the workbook-owned API gate below passes.

- [x] Inventory every current FT and ET implementation and record its workbook screen, data source, and callers.
- [x] Designate the SY Step 02 FT presentation as the only FT visual standard.
- [x] Designate the ES Step 02 ET presentation as the only ET visual standard.
- [x] Define one canonical public component contract for each editor under `newly-developed-methods`.
- [x] Separate reusable method schemas from workbook-owned MEF persistence wrappers.
- [x] Replace standalone project/model identity with workbook-scoped durable addresses, snapshot revisions, and workbook-local model/entity IDs.
- [x] Define typed cross-workbook references for FT top events, FT basic events, ET functional events, BN nodes, and HCL bindings.
- [x] Make the SY workbook basic-event collection the canonical catalogue for SY fault trees and remove duplicated event payloads from tree nodes/model-local catalogues.
- [x] Extend the existing ES event-tree MEF instead of persisting a parallel standalone ET model.
- [x] Add BN and HCL data to their hosting workbook MEF rather than to a project-level model collection.
- [x] Remove the frontend model-library concept from the active architecture.
- [x] Add migration tests for existing SY fault trees and ES event trees before changing stored shapes.
- [x] Verify the corrected interface and migration tests before changing backend ownership.

### Verified FT and ET implementation inventory

This inventory records the pre-remediation baseline and its actual render callers; the completed canonical ownership sections below describe the current implementation. Text-only mentions, reference fields, reports, and ordinary tables are not classified as separate editors.

#### Frontend renderers, hosts, data, and styles

| Current implementation or surface | Workbook host and callers | Current data source | Styling | Required disposition |
| --- | --- | --- | --- | --- |
| SY `FaultTree`, `LogicModelTree`, layout, symbols, boxes, and legend in `sy-workbooks/syScreens.tsx` | `ModelsScreen` → `syWorkbench.tsx` → SY Step 02 System Models | `SystemsAnalysis.systemLogicModels[].faultTree`; basic-event display also reads `SystemLogicModel.basicEvents` | FT selectors in `sy-workbooks/css/syScreens.css` | Approved FT visual source. Move/refactor into `newly-developed-methods/fault-tree`, then make SY import it with visual parity |
| ReactFlow `FaultTreeEditor`, node, icon, layout, rules, types, and CSS already in `newly-developed-methods/fault-tree` | Called only by IE Step 02 MLD/HBFT and the IE frequency-quantification component | Receives `FtInputNode[]`, copies it into component-local ReactFlow state, and exposes no persistence callback | `newly-developed-methods/fault-tree/css/faultTree.css` | Keep the folder, replace the alternate implementation and appearance with the extracted SY standard, and retain only reusable behavior that survives the canonical contract |
| IE MLD/HBFT adapter surface in `ie-workbooks/ieScreens.tsx` and `faultTreeAdapters.ts` | IE Step 02 Search Methods | Adapts `masterLogicDiagrams` or `heatBalanceFaultTrees` to `FtInputNode[]` | Full-screen host shell in `ie-workbooks/css/ieScreens.css`; renderer styling comes from the current ReactFlow editor | Replace its renderer call with the canonical FT import; retain an adapter only if the source MEF cannot directly satisfy the canonical contract |
| IE initiating-frequency FT surface in `newly-developed-methods/ie-frequency-quantification/ieFrequencyQuantificationEditor.tsx` | IE Step 08 Frequency & Quantification through `ie-workbooks/ieScreens.tsx` | Adapts `FrequencyDataSource.faultTree` (`FrequencyFaultTreeNode[]`) to `FtInputNode[]`; the surrounding frequency form persists through `onChange`, but current FT edits never flow back to it | Frequency shell in `ie-frequency-quantification/css/ieFrequencyQuantification.css`; renderer styling comes from the current ReactFlow editor | Replace its renderer call with the canonical FT import and connect canonical structural edits to IE workbook persistence |
| ES `EventSeqDiagram`, `EventTreeDiagram`, `DynamicEsdTree`, sequence table, shared layout helpers, drawers, and representation selector in `es-workbooks/esScreens.tsx` | `SequencesScreen` → `esWorkbench.tsx` → ES Step 02 Event Sequences | `eventTreesView(es.eventTrees)`; dynamic ESD representation additionally reads `es.dynamicRuns` | `es-workbooks/css/esScreens.css` (`estree`, `esdg`, and dynamic-ESD selectors) | Approved ET presentation bundle. Move/refactor it into `newly-developed-methods/event-tree`, then make ES import it with visual parity. Its diagram/table modes remain views of one canonical ET implementation, not separate editors |
| ESQ dependency and transfer surfaces in `esq-workbooks/esqScreens2.tsx` | ESQ dependency/integration steps | ESQ dependency treatments and event-tree transfer records | ESQ workbook table/card styling | Not a graphical ET implementation. Preserve the records, and later import the canonical ET component only where ESQ needs a linked-tree view or result overlay |
| HR, SC, external-flood, high-winds, internal-fire, and other-hazards FT/ET matches | Their existing workbook screens | Reference fields, descriptive text, or tabular hazard/event-sequence records | Their workbook styling | Not duplicate renderers. Convert applicable navigation/view actions to the canonical FT or ET import later; do not delete domain records merely because they mention a tree |

#### Data, persistence, validation, and execution implementations

| Layer | Current source | Inventory finding | Required disposition |
| --- | --- | --- | --- |
| SY FT MEF | `interfaces/mef-types/sy/systems-analysis.ts` and its Zod schema | Recursive `SystemFaultTreeNode`; `SystemLogicModel.basicEvents` plus `SystemsAnalysis.systemBasicEvents` duplicate catalogue ownership, and tree leaves also duplicate event display fields | Migrate to the canonical workbook-owned FT representation and one canonical SY basic-event catalogue before removing legacy fields |
| IE FT MEF | `FrequencyFaultTreeNode[]` embedded in `FrequencyDataSource` plus MLD/HBFT method schemas | Flat parent-linked IE frequency trees and adapted method diagrams are workbook-owned but use shapes different from SY | Add migration/adaptation to the one canonical FT contract; do not create another editor |
| ES ET MEF | `interfaces/mef-types/es/event-sequence-analysis.ts` and its Zod schema | `EventTree` already owns normalized functional-event, branch, sequence, initial-state, and transfer records; `FunctionalEvent.faultTreeId` is not workbook-qualified | Extend this workbook-owned model and replace unqualified links with typed workbook/entity references; do not persist a parallel ET model |
| Frontend workbook persistence | SY, IE, and ES workbook APIs and `use*MefPatch` hooks | Each workbook already diffs its MEF and sends path operations to its own workbook PATCH route | Canonical editors receive workbook callbacks and continue through these services, with revision conflict support added separately |
| Newly-developed method contracts | `interfaces/shared-types/newly-developed-methods/{fault-tree,event-tree,shared}` | Validation and solver DTOs are reusable, but create/patch contracts and identity wrappers currently describe standalone project models | Preserve reusable domain, validation, request, and result logic while refactoring persistence identity around workbook MEF |
| Newly-developed method backend | `web-backend/src/newly-developed-methods` | `method_models`, project method-model routes, the project FT catalogue, dependency discovery, and run dispatch implement the superseded ownership | Remove/refactor project persistence and routes; reuse validation, revision, dependency, permission, snapshot, and run-lifecycle mechanics under workbook ownership |
| PRAXIS and native adapters | `apps/solvers/praxis` and `apps/solvers/praxis-node/src/{fault_tree,event_tree,hybrid_causal_logic}.rs` | Numerical FT/ET/HCL algorithms and normalized snapshot adapters are independent of editor appearance | Keep them; add pure workbook-MEF-to-solver snapshot adapters and re-run the numerical API fixtures |

#### Baseline gaps and migration hazards

- The current newly-developed FT component is editable only in local ReactFlow state; it has no `onChange`, save, validation, or run interface.
- The IE Step 02 title override is also local-only and is not a persisted FT rename.
- The IE Step 08 frequency form persists source fields, but its nested FT editor cannot persist node changes.
- The SY basic-event drawer updates `SystemLogicModel.basicEvents` and duplicated recursive tree fields, but not the separate `SystemsAnalysis.systemBasicEvents` collection.
- ES Step 02 reads topology through `eventTreesView`; it can select sequences and switch representations, but it does not edit functional-event or branch topology.
- No `newly-developed-methods/event-tree` frontend folder or graphical ESQ event-tree renderer exists yet.
- The only focused frontend ET test currently verifies `eventTreesView`; no direct FT renderer/editor tests or ET visual-component tests exist.

### Canonical public component contracts

These contracts define the public boundary before files move. Exact persisted types are completed by the schema-separation TODO; the behavioral boundary is fixed here.

#### Rules shared by every canonical editor

- Each method folder exports one canonical editor from its `index.ts`: `FaultTreeEditor`, `EventTreeEditor`, `BayesianNetworkEditor`, or `HclBindingEditor`.
- Workbook code imports only from the method folder's public `index.ts`, never an internal renderer, node, layout, popup, or stylesheet.
- A canonical editor is controlled: the host passes the current model and reference catalogues; committed model changes return through callbacks. The editor does not own a second durable copy.
- Local state is limited to uncommitted text, selection, open panels, hover, viewport, and undo/redo drafts. When a commit succeeds, the workbook-provided model remains authoritative.
- Editors never import a workbook context, workbook route, persistence client, or project-model service. The host translates editor operations into its workbook MEF patch and displays save state.
- One callback emits one domain operation at a time so field, structural, and position changes can become minimal workbook path patches.
- Every editor supports author, read-only, and reference-selection capabilities through one component; quantification and result overlays extend that component instead of creating another renderer.
- Validation issues, save state, stale-result state, and immutable run results are supplied inputs. Execution is requested through a host callback.
- Typed `WorkbookCrossReference` values are used for cross-workbook navigation and selection. Editors never infer targets from display names.
- Method-specific subviews are private implementation details. For example, ET diagram, derived-tree, dynamic, and table representations are modes of `EventTreeEditor`, not separate public editors.
- Canonical styles live with the method under `newly-developed-methods`; source workbook styles are removed only after every importing host passes visual parity.

#### `FaultTreeEditor` public contract

| Input or callback | Responsibility |
| --- | --- |
| `model` | Current workbook-owned FT definition, including stable nodes, gate inputs, top gate, and positions |
| `basicEvents` | Resolved catalogue entries available to leaves without duplicating their values in the tree |
| `capabilities` | Author, read-only, reference selection, quantification, and result-overlay flags |
| `selection`, `validation`, `saveState`, `analysisResult`, `resultIsStale` | Controlled presentation state |
| `onOperation(operation)` | Commit one add, update, connect, reparent, delete, move, layout, transfer, or top-gate operation |
| `onSelectionChange(entityId)` | Synchronize selection with drawers, validation issues, and consuming workbooks |
| `onOpenReference(reference)` | Navigate to a transfer target or linked workbook entity |
| `onRun(request)` | Ask the owning workbook host to validate and start quantification |

The SY-derived box, gate-symbol, connector, legend, spacing, colors, and typography are mandatory. The current alternate ReactFlow node renderer and its styling are not part of this contract and are removed after caller migration.

#### `EventTreeEditor` public contract

| Input or callback | Responsibility |
| --- | --- |
| `model` | Current ES-workbook-owned ET definition with initiating state, functional events, branches, sequences, transfers, and positions |
| `resolvedFaultTrees` | Typed, resolved FT top-event references used by functional events |
| `dynamicRun` | Optional dynamic-ESD information displayed as another representation of the same tree |
| `representation` | Controlled `event-sequence-diagram`, `event-tree`, `table`, or `dynamic` view |
| `capabilities`, `selection`, `validation`, `saveState`, `analysisResult`, `resultIsStale` | Controlled presentation state |
| `onOperation(operation)` | Commit one initiating-event, functional-event, branch, sequence, end-state, transfer, move, or layout operation |
| `onRepresentationChange`, `onSelectionChange` | Synchronize the selected view and entity with the workbook host |
| `onOpenReference(reference)` | Navigate to linked FT top events, initiating events, transfers, or results |
| `onRun(request)` | Ask the owning/integration workbook host to validate and start ET quantification |

The ES Step 02 representation selector, event-sequence diagram, derived event-tree view, dynamic view, sequence table, path highlighting, end-state treatment, drawers, legends, colors, and typography move together as one canonical implementation.

#### `BayesianNetworkEditor` public contract

| Input or callback | Responsibility |
| --- | --- |
| `model` | Current ESQ-workbook-owned BN definition with stable nodes, states, ordered parents, edges, CPTs, and positions |
| `evidence`, `queryNodeId`, `validation`, `saveState`, `analysisResult`, `resultIsStale` | Controlled inference and presentation state |
| `capabilities` | Author, read-only, reference selection, query, and result-overlay flags |
| `onOperation(operation)` | Commit one node, state, edge, CPT, evidence, position, or layout operation |
| `onEvidenceChange`, `onQueryNodeChange`, `onSelectionChange` | Synchronize inference and selection state |
| `onRun(request)` | Ask ESQ to validate and run exact inference |

#### `HclBindingEditor` public contract

| Input or callback | Responsibility |
| --- | --- |
| `configuration` | Current ESQ-workbook-owned HCL bindings and solver settings |
| `availableFaultTrees`, `availableBayesianNetworks`, `availableEventTrees` | Typed reference catalogues resolved by ESQ |
| `validation`, `saveState`, `analysisResult`, `resultIsStale` | Controlled binding and result state |
| `onOperation(operation)` | Commit one model reference, basic-event binding, true-state selection, evidence, or solver-setting operation |
| `onOpenReference(reference)` | Navigate to the canonical FT, BN, or ET host |
| `onRun(request)` | Ask ESQ Step 02 Integrate & Quantify to validate and run HCL |

### Canonical workbook identity contract

- Durable addresses do not contain a revision: `WorkbookAddress` is `{ workbookId }`, `WorkbookModelAddress` is `{ workbookId, modelId }`, and `WorkbookModelEntityAddress` is `{ workbookId, modelId, entityId }`.
- `WorkbookEntityAddress` is the separate `{ workbookId, entityId }` address for entities owned directly by a workbook, including the canonical SY basic-event catalogue. Its missing `modelId` is deliberate.
- Snapshot identities add the positive optimistic-concurrency token `workbookRevision` to the corresponding durable address. The existing workbook `version` field supplies that concept until the dedicated revision-handling TODO updates the persistence and API naming.
- `modelId` and `entityId` are stable UUIDs whose uniqueness is scoped to the owning workbook and, for model entities, the owning model. They are not independent project-level resources and are never resolved without workbook scope.
- Canonical address and snapshot schemas are strict and reject `projectId`, standalone `id`, and model-level `revision` fields. Durable addresses also reject `workbookRevision` so links do not become stale merely because a workbook changes.
- Reusable FT, BN, ET, and HCL MEF definitions now use the explicit `WorkbookEntityId` vocabulary. The older `MethodModelId` and `MethodEntityId` names are deprecated aliases only for verified compatibility consumers.
- `WorkbookModelIdentity` and `WorkbookEntityIdentity` remain deprecated aliases for snapshot compatibility only. The former project-model identity and metadata schemas are exported explicitly as `LegacyProjectMethodModelIdentitySchema` and `LegacyProjectMethodModelMetadataSchema`. Existing project-route tests may use them until backend ownership removal, but new workbook persistence must not.

### Typed cross-workbook reference contract

Every durable reference has a `referenceType` discriminator and the minimum address needed to resolve its target:

| Target | `referenceType` | Durable address |
| --- | --- | --- |
| FT top event | `FAULT_TREE_TOP_EVENT` | `{ workbookId, modelId, entityId }` |
| FT basic event in the workbook catalogue | `FAULT_TREE_BASIC_EVENT` | `{ workbookId, entityId }` |
| ET functional event | `EVENT_TREE_FUNCTIONAL_EVENT` | `{ workbookId, modelId, entityId }` |
| BN node | `BAYESIAN_NETWORK_NODE` | `{ workbookId, modelId, entityId }` |
| HCL binding | `HCL_BINDING` | `{ workbookId, modelId, entityId }` |

- Durable references deliberately exclude `workbookRevision`, `projectId`, display names, codes, and copied target payloads. Callers resolve current target data through the typed address; immutable analysis snapshots record contributing revisions separately.
- `WorkbookCrossReference` is a discriminated union of the five reference types, so a reference for one entity kind cannot silently impersonate another.
- The old unqualified `MethodModelReference` and `MethodEntityReference` shapes remain deprecated compatibility contracts. Their persisted FT, ET, BN, and HCL fields migrate to these typed references in the following workbook-MEF migration TODOs rather than through an unverified bulk shape change.

### Canonical SY basic-event ownership

Implementation and the focused SY workbook interaction below are complete.

- `SystemsAnalysis.systemBasicEvents` is required and is the only persisted catalogue of SY basic-event definitions.
- `SystemLogicModel` no longer contains a model-local `basicEvents` collection. A model's event membership is derived from the basic-event references reachable from its fault tree.
- An SY fault-tree `BE` leaf persists only `{ id, type: "BE", basicEventId }`. Names, failure modes, probabilities, controlled-data references, repair fields, and common-cause presentation are resolved from the workbook catalogue.
- Canonical schemas reject model-local catalogues, descriptive payloads on direct leaf parses, duplicate catalogue IDs, and leaf references that do not resolve in the workbook catalogue.
- Legacy workbook parsing moves model-local events into the workbook catalogue, gives the model-local copy precedence over a stale root copy, carries a legacy leaf's data-analysis source into the catalogue when needed, strips duplicated tree payloads, and supports workbooks whose optional root catalogue was absent.
- SY workbook API and generic MEF reads normalize legacy stored MEF before returning it. The next accepted patch/save persists the canonical shape.
- SY Step 02 cards, the basic-event drawer, integrity summaries, CCF checks, and generated system reports resolve through the canonical catalogue. Editing a basic event now changes one catalogue record and no longer synchronizes copied tree fields.

Manual completion gate:

1. Open an SY example workbook at Step 02 System Models and select a basic-event card in a fault tree.
2. Confirm its name, identifier, failure mode, probability, data-analysis reference, and repair state appear in the drawer and still match the card.
3. As a preparer, change the event name and probability, commit each field, close and reopen the drawer, and refresh the page.
4. Confirm the card and drawer both show the saved values after refresh, and confirm another system fault tree still renders normally.

Manual result (2026-08-21): passed. A blank SY workbook now shows the guarded Step 02 empty state, and the seeded-example basic-event drawer, edits, persistence after refresh, card synchronization, and other-system rendering were confirmed by the user.

### Canonical ES event-tree ownership

- `EventSequenceAnalysis.eventTrees[]` remains the only workbook-persisted event-tree collection. Its existing functional-event, branch, sequence, initial-state, and transfer records remain the canonical topology used by ES Step 02.
- The existing `EventTree` record now also owns optional initiating-event frequency, canvas layout, and typed FT top-event references on its functional events. These additions support the future canonical editor without introducing a nested definition or standalone method-model envelope.
- Typed functional-event links carry the target SY workbook, fault-tree model, and top-event entity identity through `FaultTreeTopEventReference`.
- Direct ES event-tree parsing is strict and rejects standalone `projectId`, `methodType`, revision, or other parallel persistence metadata.
- A functional event cannot store both `faultTreeTopEvent` and the deprecated unqualified `faultTreeId`. Legacy-only links remain parseable until the dedicated ES migration TODO can resolve them with workbook context.
- The shared interface package now declares its MEF dependency and maps that dependency to the active workspace source during tests, preventing contract tests from resolving a stale package through the shared installation cache.

Automated completion gate:

1. Parse an existing ES event-tree topology carrying the new frequency, typed FT link, and layout fields.
2. Reject a standalone method-model persistence envelope on the ES tree.
3. Reject simultaneous typed and legacy FT links while retaining legacy-only compatibility for the migration TODO.
4. Round-trip the extended tree through the complete `EventSequenceAnalysisSchema` used by ES workbook APIs.

### Canonical ESQ Bayesian-network and HCL ownership

- `EventSequenceQuantification.bayesianNetworks[]` is the required workbook-owned BN collection, and `EventSequenceQuantification.hclConfigurations[]` is the required workbook-owned HCL configuration collection.
- Each ESQ-owned model has a stable workbook-local `modelId`, code, name, and description directly beside its reusable definition. It does not carry a project ID, standalone method type, model revision, owner, or timestamp envelope.
- HCL bindings persist typed `FaultTreeBasicEventCatalogueReference` and `BayesianNetworkNodeReference` values. Declared whole-model dependencies use durable workbook/model addresses.
- HCL structural validation rejects duplicate declared FT targets and binding IDs, bindings to undeclared FT workbooks, BN-node targets outside the configured BN address, and duplicate bindings for one FT basic event.
- Blank and seeded ESQ workbooks initialize both collections. Older ESQ payloads that predate these fields parse with empty collections so they remain loadable and become canonical on their next save.
- The existing ESQ save, patch, example-load, and MEF-adapter paths already parse and persist the complete `EventSequenceQuantificationSchema`; therefore the new collections use workbook persistence without separate database collections or project-model routes.
- Unknown root-level `methodModels` payloads are not retained by the ESQ schema, and strict BN/HCL records reject project-model metadata. The legacy project-model backend remains untouched until the later backend-ownership migration gate.

Automated completion gate:

1. Accept strict ESQ-owned BN and typed HCL records and reject standalone project-model metadata.
2. Reject legacy unqualified HCL entity references and typed bindings whose targets disagree with the configured models.
3. Initialize both collections in a blank ESQ workbook and heal older payloads that omit them.
4. Round-trip populated BN and HCL collections through the complete `EventSequenceQuantificationSchema` used by ESQ workbook APIs without retaining a project-level model collection.

### Frontend editor source boundary

- A repository-wide frontend audit found no standalone model-library page, route, navigation action, `ModelLibrary` component, `/method-models` API caller, or project-model persistence client to retain or migrate.
- `apps/frontends/web-frontend/src/newly-developed-methods` is explicitly documented as a reusable source-code boundary. It is not routable and does not own navigation, persistence, permissions, or analysis requests.
- Canonical editor implementations remain independent of project APIs, workbook APIs, and workbook contexts. Workbook hosts supply current MEF data and accept controlled editor operations.
- Existing `NewlyDevelopedMethod` MEF records and workbook review references are methodology documentation, not FT/ET/BN/HCL model storage. They remain intact rather than being incorrectly removed as a model library.
- An architecture test scans production frontend TypeScript and fails if a project method-model endpoint, standalone model-library route/component, or persistence coupling inside the canonical editor directory is introduced.

Automated completion gate:

1. Scan production frontend sources and prove there is no standalone project-model endpoint, model-library route, or `ModelLibrary` component.
2. Scan canonical method-editor sources and prove they do not import project persistence, workbook persistence, or workbook contexts.
3. Run the complete frontend test, typecheck, lint, and production-build gates.

### Legacy SY fault-tree and ES event-tree migration characterization

- Independent frozen fixtures now capture the stored shapes that predate the workbook-ownership corrections; they are not derived from current canonical seeds and therefore cannot silently drift with those seeds.
- The SY fixture includes nested gates, payload-bearing basic-event leaves, a transfer node, a model-local basic-event catalogue, repair data, a data-analysis source, loop resolution, and nomenclature.
- The SY migration assertion proves gate and transfer topology is preserved, model-local and leaf-only basic events move into the workbook catalogue without losing values, leaves become reference-only, the input fixture is not mutated, and reparsing the canonical result is idempotent.
- The ES fixture includes ordered functional events, legacy unqualified FT IDs, branch paths, success and release sequences, functional-event states, an event-tree transfer, mission time, descriptions, and instructions.
- The ES characterization assertion proves the complete normalized topology and legacy FT IDs survive full-workbook parsing unchanged and reparsing is idempotent. It deliberately does not invent typed FT workbook/model/entity addresses before a later migration has the workbook context required to resolve them.
- Existing generated SFR and HTGR seed tests continue to validate all 54 and 96 event trees respectively against the complete ES schema.

Automated completion gate:

1. Migrate the frozen legacy SY fixture through `SystemsAnalysisSchema` and compare the complete canonical model and catalogue output.
2. Parse the frozen legacy ES fixture through `EventSequenceAnalysisSchema` and compare its complete topology and legacy-reference output.
3. Reparse both outputs to prove migration/compatibility behavior is idempotent.
4. Run the complete shared-interface and backend suites plus all relevant typecheck and lint gates.

### Corrected interface and migration verification baseline

- The architecture-remediation contracts and workbook migrations have passed one consolidated gate before any backend-ownership code is changed.
- Focused verification covers strict workbook-owned model definitions, workbook-scoped identities, typed cross-workbook references, SY basic-event catalogue migration, ES event-tree compatibility, and ESQ BN/HCL ownership together rather than only as isolated implementation steps.
- Complete shared-interface, backend, and frontend suites establish the consumer baseline that the backend-ownership refactor must preserve.
- Typecheck and lint gates cover `interfaces-mef-types`, `interfaces-shared-types`, `backends-web-backend`, and `frontends-web-frontend`.
- The legacy project-model backend remains present at this boundary by design; this verification TODO changes no stored shape, route, or ownership behavior.

Automated completion gate:

1. Run the corrected shared-contract tests and workbook ownership/migration tests as one focused gate.
2. Run the complete shared-interface, backend, and frontend test suites.
3. Run typecheck and lint for both interface packages and both web applications.
4. Record a fully passing baseline before starting removal of project-model persistence and routes.

## Phase 1 — Shared method schemas

Complete schemas before frontend or backend implementation.

### Shared contracts

- [x] Create the `newly-developed-methods/shared` interface module and barrel exports.
- [x] Refactor stable identities so persisted models use workbook ID plus workbook-local model/entity IDs instead of standalone project-model identity.
- [x] Refactor schema version, revision, ownership, and timestamps around workbook MEF ownership and immutable analysis runs.
- [x] Define canvas layout metadata.
- [x] Define validation result contracts.
- [x] Refactor analysis-run metadata to capture the owner workbook and every contributing workbook revision.
- [x] Enforce stable UUID references so renaming models or events does not break connections.
- [x] Add interface and Zod tests for shared contracts.

### Fault-tree contracts

- [x] Create the `newly-developed-methods/fault-tree` interface module and barrel exports.
- [x] Define the top gate and AND, OR, NOT, and K-of-N gates.
- [x] Define basic-event references, house events, undeveloped events, and transfer references.
- [x] Define gate-to-child relationships and display positions.
- [x] Define basic-event probability and optional controlled data-source references.
- [x] Replace the project-level basic-event catalogue contract with workbook-owned catalogues and typed cross-workbook parameter references.
- [x] Refactor FT create, patch, validate, execute, and result contracts around workbook routes and workbook-local identities.
- [x] Add interface and Zod tests for FT contracts.

### Bayesian-network contracts

- [x] Create the `newly-developed-methods/bayesian-network` interface module and barrel exports.
- [x] Define discrete chance nodes with two or more states.
- [x] Define ordered parent references, directed edges, CPT values, and canvas positions.
- [x] Define evidence configurations, query requests, and marginal results.
- [x] Exclude decision, utility, deterministic, continuous, and dynamic nodes from the initial schema.
- [x] Refactor BN create, patch, validate, execute, and result contracts around its hosting workbook and workbook-local identities.
- [x] Add interface and Zod tests for BN contracts.

### Event-tree contracts

- [x] Create the `newly-developed-methods/event-tree` interface module and barrel exports.
- [x] Define the initiating event and initiating-event frequency.
- [x] Define ordered functional events and FT top-event references.
- [x] Define success/failure paths, end states, and sequence identifiers.
- [x] Define event-tree transfers, HCL configuration references, and canvas layout.
- [x] Refactor ET create, patch, validate, execute, and result contracts around ES workbook ownership and workbook-local identities.
- [x] Add interface and Zod tests for ET contracts.

### HCL contracts

- [x] Create the `newly-developed-methods/hybrid-causal-logic` interface module and barrel exports.
- [x] Refactor BN and FT references into typed workbook/entity references.
- [x] Define FT basic-event to BN-node bindings.
- [x] Define non-empty BN true-state selections and base evidence.
- [x] Define solver settings supported by the current PRAXIS HCL API.
- [x] Define HCL validation and quantification results.
- [x] Keep HCL mapping independent so one BN can be reused by multiple FT and ET analyses.
- [x] Add interface and Zod tests for HCL contracts.

## Phase 2 — Validation and persistence rules

### Validation framework

- [x] Implement draft validation that reports issues without preventing saves.
- [x] Implement strict analysis-ready validation that gates quantification.
- [x] Give every validation issue an entity ID and field path.
- [x] Make selecting an issue focus its affected node or field.

### Fault-tree validation

- [x] Require exactly one valid top gate.
- [x] Require unique codes and identifiers.
- [x] Validate gate inputs and require exactly one child for a NOT gate.
- [x] Validate K for K-of-N gates.
- [x] Reject Boolean cycles and dangling references.
- [x] Validate probabilities and transfer targets.
- [x] Reject transfer cycles.
- [x] Require analysis nodes to be reachable.
- [x] Add focused tests for every FT validation rule.

### Bayesian-network validation

- [x] Require unique nodes and unique states per node.
- [x] Require at least two states per node.
- [x] Reject directed cycles and invalid parent references.
- [x] Validate CPT dimensions and require every CPT row to sum to one.
- [x] Validate evidence states.
- [x] Validate HCL true-state selections.
- [x] Add focused tests for every BN validation rule.

### Event-tree validation

- [x] Validate the starting node and complete success/failure paths.
- [x] Require reachable end states.
- [x] Validate FT references and initiating-event frequency.
- [x] Validate transfer targets and reject uncontrolled transfer loops.
- [x] Require unique, traceable sequences.
- [x] Add focused tests for every ET validation rule.

## Phase 3 — Backend services and ownership correction

The first backend pass proved the service, validation, revision, permission, dependency, and run-lifecycle mechanics, but its standalone project-model ownership is superseded. Preserve the verified mechanics while replacing their ownership and routes.

### Existing verified mechanics

- [x] Mirror the method-by-method structure under the backend `newly-developed-methods` directory.
- [x] Patch only a changed field or structure with atomic revision protection.
- [x] Validate drafts and analysis readiness.
- [x] Create an analysis run and retrieve its status and results.
- [x] Find model and workbook references.
- [x] Add backend permission tests.

### Required workbook-ownership remediation

- [x] Remove the `method_models` project-model persistence path and its project CRUD routes.
- [x] Remove the project-level FT basic-event catalogue persistence path and routes.
- [x] Load and patch FT, ET, BN, and HCL data through their owning workbook services and MEF documents.
- [x] Reuse workbook authorization and workflow checks for model edits and executions.
- [x] Add workbook revision and expected-revision handling to method-related patches.
- [x] Preserve HTTP `409` behavior for stale workbook edits and racing updates.
- [x] Refactor dependency discovery to resolve typed workbook/entity references rather than project models.
- [x] Refactor analysis runs to record the owner workbook, workbook-local model ID, source workbook revisions, and immutable snapshots.
- [x] Build pure workbook-MEF-to-PRAXIS snapshot adapters for FT, BN, ET, and HCL execution.
- [x] Delete a workbook-owned model only after checking typed references from other workbooks.
- [x] Add corrected permission, persistence, revision, dependency, and analysis-run tests.

### Removed project-level method-model path

- The `method_models` Mongo record, project-model service, and project-scoped controller have been removed from production code and from the shared method backend module.
- The complete `/projects/:projectId/method-models` endpoint family is retired, including list, create, load, patch, delete, dependency, validation, run creation, run status, and run-result routes.
- Tests that existed solely to exercise the retired project-model persistence and endpoint family have been removed with that implementation. The recorded numerical fixtures remain evidence for the solver core and will be restored through corrected workbook-owned APIs at the workbook API gate.
- The PRAXIS client, method analysis-run record, and separately scheduled project-level FT basic-event catalogue remain unchanged in this TODO.
- A production-source architecture guard rejects the old route, `method_models` collection, controller, or service if any is reintroduced.

Automated completion gate:

1. Prove the backend module still composes every method area but registers no project-model controller or service.
2. Scan production method-backend sources for the retired route, collection, controller, and service.
3. Verify every retired endpoint variant returns HTTP `404` from the running backend while an unrelated protected API remains registered.
4. Run the complete backend test, typecheck, lint, production-build, Prettier, and diff-integrity gates.

### Removed project-level FT basic-event catalogue path

- The project-keyed `fault_tree_basic_event_catalogues` Mongo record, its project-authorized service, and its project controller have been removed from production code and module registration.
- Create, load, and patch operations under `/projects/:projectId/fault-tree-basic-event-catalogue` are retired; their implementation-specific tests were removed with the obsolete path.
- `FaultTreeModule` remains as the backend composition boundary for later workbook-owned FT services but no longer imports project authorization or registers project catalogue providers.
- The canonical `SystemsAnalysis.systemBasicEvents` catalogue and its SY workbook persistence, normalization, and migration behavior are unchanged.
- The backend architecture guard rejects the old route, collection, record, controller, or service if any is reintroduced.

Automated completion gate:

1. Prove the backend method module contains no project FT catalogue persistence, route, or provider registration.
2. Run the canonical SY basic-event catalogue and frozen workbook migration tests with the removal guard.
3. Verify the retired project catalogue GET, POST, and PATCH routes return HTTP `404` while the SY workbook API remains registered.
4. Run the complete backend test, typecheck, lint, production-build, Prettier, and diff-integrity gates.

### Workbook-owned method-model load and patch path

- The authenticated `GET /sy-workbooks/:id`, `GET /es-workbooks/:id`, and `GET /esq-workbooks/:id` routes return schema-parsed, typed MEF documents from their existing workbook services. No replacement method-model read route was added.
- The corresponding workbook `PATCH /:id` routes remain the only editor persistence transport. Path operations update `systemLogicModels` and the canonical `systemBasicEvents` catalogue in SY, `eventTrees` in ES, and `bayesianNetworks` or `hclConfigurations` in ESQ before the complete owner MEF is validated and saved.
- Workbook services and the generic workbook adapters preserve the ESQ HCL contract's required `variableOrder: null` value for automatic ordering while continuing to normalize unrelated legacy nulls before complete MEF validation.
- SY, ES, and ESQ workbook responses expose their concrete MEF types, and invalid stored ES/ESQ payloads fail at the API boundary instead of being returned as untyped data.
- A focused authenticated HTTP integration suite loads and patches all four model kinds through their owning workbook controllers, verifies independent BN and HCL patches, preserves unrelated collections, and proves the saved document remains the workbook MEF.

Automated completion gate:

1. Load FT, ET, BN, and HCL data through the existing authenticated owner-workbook GET routes.
2. Patch only model-owned paths through the corresponding workbook PATCH routes and verify unrelated MEF collections remain unchanged.
3. Preserve HCL automatic variable ordering through controller services and generic workbook adapters while retaining legacy null normalization.
4. Run the focused HTTP persistence suite plus complete shared-interface and backend suites, typechecks, lints, production build, Prettier, and diff-integrity gates.

### Workbook model authorization and workflow gate

- `WorkbookModelAccessService` is the single authorization boundary for workbook-owned method edits and analysis execution. It resolves project access first, then the actor's effective workbook roles, then the owner MEF's workflow state.
- Edits and executions require project `owner` or `editor` access, a workbook `preparer` or `co_preparer` role, and workflow state `DRAFT` or `REVISION_REQUIRED`. Legacy MEFs without a workflow state continue to behave as `DRAFT`.
- Project viewers are rejected before workbook-role lookup, preserving the existing concealed project-access boundary. Reviewers, approvers, unassigned users, and preparers in review, approval, or final states cannot mutate or execute method analyses.
- SY, ES, and ESQ PATCH services call the shared edit gate before parsing, mutating, or saving their workbook MEFs and reuse its resolved effective roles in the response.
- `WorkbooksModule` exports the shared gate and the newly-developed-method shared backend imports it for the forthcoming workbook-owned run service. No premature execution route or replacement run persistence was added; the separate analysis-run refactor TODO will invoke `requireExecution` before snapshot creation.

Automated completion gate:

1. Exercise every allowed project-role, workbook-author-role, editable-state, and edit/execute combination.
2. Reject project viewers, non-author workbook roles, absent roles, and locked workflow states before persistence or execution.
3. Prove authenticated SY, ES, and ESQ owner routes use the edit gate and that the method backend imports the execution boundary.
4. Run the complete backend test, typecheck, lint, production-build, Prettier, and diff-integrity gates.

### Workbook revision and expected-revision contract

- SY, ES, and ESQ owner documents persist a positive workbook-level `revision`, defaulting to `1`. Existing documents that predate the field are read as revision `1` and persist their first accepted method patch as revision `2`.
- Authenticated GET responses expose the current revision beside the workbook-owned MEF. Method-related PATCH payloads use the strict `{ expectedRevision, operations }` contract, while unrelated workbook APIs retain their existing operations-only payload.
- Each accepted FT, ET, BN, or HCL patch compares the supplied positive integer with the loaded owner-workbook revision, applies and validates the requested MEF path operations, advances the workbook revision exactly once, persists it with the MEF, and returns the new revision.
- Missing, zero, fractional, or unexpected revision-contract fields are rejected before service mutation. Authorized stale requests are rejected without changing the MEF or revision and without calling save.
- The initial revision-contract pass established persistence and request/response behavior. The atomic revision gate below replaces its load-check-save window while preserving the same client-visible stale-edit behavior.

Automated completion gate:

1. Validate the strict revisioned-patch schema and prove unrelated workbook PATCH contracts remain unchanged.
2. Prove all three owner schemas default to revision `1` and that a legacy revision-less document migrates on its first accepted patch.
3. Load and patch SY FT, ES ET, ESQ BN, and ESQ HCL data through authenticated APIs, verifying revision `1` to `2` and sequential `2` to `3` persistence and responses.
4. Reject missing and stale expected revisions without persistence while preserving workbook authorization denials.
5. Run complete shared-interface and backend suites, typechecks, lints, production build, Prettier, and diff-integrity gates.

### Atomic workbook revision-conflict gate

- SY, ES, and ESQ method patches perform their final write with one `findOneAndUpdate` operation whose filter contains both the owner workbook ID and the caller's expected revision. The validated MEF and next revision are written together and the updated owner document is returned.
- Expected revision `1` atomically matches either a stored revision `1` or a legacy document with no revision field. Its accepted update writes revision `2`, preventing MongoDB's missing-field increment behavior from assigning the wrong logical revision.
- A request that is already stale after authorization receives HTTP `409` before persistence. If two authorized requests load the same revision, their conditional writes compete at the database boundary: exactly one matches and advances the revision, while the losing update matches no document and receives HTTP `409`.
- Method patches no longer use document `save()` after the initial read, so no unqualified write can overwrite the winning MEF between the revision check and persistence. Authorization, workflow checks, full-MEF validation, and the revision-bearing response contract remain unchanged.

Automated completion gate:

1. Verify successful SY FT, ES ET, ESQ BN, and ESQ HCL patches use revision-qualified atomic updates and return the atomically updated document.
2. Verify legacy revision-less owners atomically match logical revision `1` and persist revision `2`.
3. Reject an already stale request with HTTP `409` without issuing an update.
4. Synchronize two authenticated API requests so both load revision `1`, then prove statuses `200` and `409`, one stored MEF, one revision advance, and no document `save()` call.
5. Run the complete backend suite, typecheck, lint, production build, Prettier, and diff-integrity gates.

### Save behavior

- [x] Keep typing local and save text on blur.
- [x] Send only the changed path and value for field edits.
- [x] Send only the structural operation for structural edits.
- [x] Send only the new position when a node moves.
- [x] Include the current revision in every patch.
- [x] Return HTTP `409` for revision conflicts.
- [x] Show `Saving`, `Saved`, or `Save failed` in the editor.
- [x] Ensure no request is sent for every keystroke.
- [x] Reuse the established workbook save-on-deactivation behavior while keeping each method's structural operations local.
- [x] Add save-on-blur, partial-patch, revision-conflict, and failure-state tests.

Save-behavior reconciliation:

- `WorkbookInput` and `WorkbookTextarea` retain text drafts locally and notify their workbook mutator only when focus leaves a changed field. Immediate controls such as checkboxes remain immediate, and unchanged blur events emit nothing.
- `createWorkbookPatch` emits leaf replacements for field and canvas-coordinate changes, omits unchanged model data, and emits one `add` or `remove` operation for a single array insertion or removal. Method editors continue to express structural changes through their owning workbook's local optimistic mutator.
- SY, ES, and ESQ queue those mutations through the shared revisioned patch hook. Every request carries the latest accepted workbook revision, later edits remain serialized, a failed save invalidates stale queued optimistic edits and reloads the owner workbook, and the header reports the queue as `Saving`, `Saved`, or `Save failed`. If both the save and immediate reload fail, the next attempted edit reloads authoritative state without patching it, remains failed, and asks the user to reapply the edit; this prevents stale optimistic data from overwriting unrelated concurrent server changes.
- The owner-workbook services enforce the revision comparison at the atomic MongoDB write and return HTTP `409` for stale or racing requests.
- Focused tests cover local typing and blur commits, exact leaf/structural/position operations, revision advancement and conflict recovery, queue-aware save-state transitions, and the rendered failure state. This section records the persistence transport contract; Phase 5 still owns enabling manual FT positioning and connecting the extracted canonical FT editor to these callbacks.

## Phase 4 — PRAXIS Node addon

- [x] Create `apps/solvers/praxis-node` as a NAPI-RS addon.
- [x] Use Node-API and depend directly on the PRAXIS Rust crate.
- [x] Use TensorBayes through PRAXIS.
- [x] Accept versioned JSON requests and return versioned JSON results.
- [x] Return structured validation and solver errors.
- [x] Expose only `validate(requestJson)` and `execute(requestJson)` publicly.
- [x] Load the addon in a Praetor worker so solver work never runs on the main backend event loop.
- [x] Build and load the addon on Windows.
- [x] Build and load the addon on Linux.
- [x] Verify Docker addon packaging.

## Backend-first quantification gate

Do not begin editor frontend implementation until every method can complete a real analysis through workbook-owned API calls and return numerically verified results. The solver results below remain valid evidence for the numerical core, but the API and persistence gate is reopened because the verified first pass used superseded project-model routes.

### Numerically verified solver capability

- [x] Connect the PRAXIS native addon worker to a versioned Praetor API endpoint.
- [x] Persist `QUEUED`, `RUNNING`, `SUCCEEDED`, and `FAILED` run states and structured failures.
- [x] Execute an FT through the API and return its exact top-event probability and leading minimal cut sets.
- [x] Verify FT API results against hand-calculated AND, OR, shared-event, K-of-N, and complemented-event fixtures.
- [x] Execute a BN query through the API and return exact marginals.
- [x] Execute an HCL-linked FT through the API and return exact quantified results.
- [x] Execute independent and HCL ET analyses through the API and return sequence and end-state results.
- [x] Cover validation, malformed solver responses, permissions, revision conflicts, and result retrieval at API boundaries.
- [x] Record Windows, Linux, and Docker verification for the complete API-to-worker path.

### Workbook-owned API gate

- [x] Execute an SY-owned FT through an SY workbook API using the workbook's basic-event catalogue.
- [x] Execute a workbook-owned BN query through its hosting workbook API.
- [x] Execute an ES-owned ET through an ES workbook API using typed references to SY FT top events.
- [x] Execute an HCL-linked FT and ET through the integration workbook API.
- [x] Persist and retrieve workbook-owned immutable run records with every contributing workbook revision.
- [x] Re-run the hand-calculated FT, BN, independent ET, HCL FT, and HCL ET numerical fixtures through the corrected APIs.
- [x] Cover workbook permissions, stale revisions, missing cross-workbook references, malformed solver responses, and result retrieval.
- [x] Record the corrected Windows, Linux, and Docker API-to-worker verification.

## Phase 5 — Fault-tree vertical slice

The one canonical FT implementation lives under `newly-developed-methods/fault-tree`. Its visual foundation is the existing SY Step 02 System Models fault-tree presentation. After extraction, SY and every other workbook FT surface import this component, so their in-workbook appearance remains continuous while the implementation is shared. Use one flat inspector for the selected node; do not introduce a nested sidebar.

### Canonical extraction and consolidation

- [x] Identify the exact SY Step 02 FT components, styles, interaction state, and MEF selectors that establish the approved presentation.
- [x] Move or refactor the approved presentation into `newly-developed-methods/fault-tree` without changing its appearance.
- [x] Define the canonical FT component inputs, workbook persistence callbacks, read-only mode, validation state, result overlay, and link-selection mode.
- [x] Change SY Step 02 to import the canonical FT component and verify visual and interaction parity.
- [x] Replace every other FT renderer/editor with an import of the canonical FT component.
- [x] Remove each superseded FT implementation only after its importing workbook has passed automated and manual parity checks.
- [x] Prove by repository search that only one FT renderer/editor implementation remains.

### Editing and viewing

- [x] Create and rename an FT.
- [x] Add gates and events.
- [x] Connect and reparent nodes.
- [x] Edit gate type safely.
- [x] Edit K for K-of-N gates.
- [x] Edit basic-event probabilities.
- [x] Select an existing basic event.
- [x] Configure house events.
- [x] Add transfer references.
- [x] Delete nodes or subtrees safely.
- [x] Implement undo and redo.
- [x] Implement manual positioning and automatic layout.
- [x] Implement pan, zoom, and fit.
- [x] Implement read-only viewer mode.

### Functional limitations to remove

- [x] Connect canonical editor state to workbook persistence.
- [x] Connect the editor to the solver.
- [x] Add strict validation.
- [x] Remove invalid single-parent assumptions.
- [x] Prevent unsafe destructive type changes.
- [x] Indicate when displayed results are stale.

### Quantification and results

- [x] Add the primary **Run analysis** action.
- [x] Return exact top-event probability.
- [x] Return minimal-cut-set count and leading cut sets.
- [x] Return cut-set order and probability or contribution where valid.
- [x] Return validation warnings and run details.
- [x] Present results using normal text and tables rather than stat boxes.
- [x] Add FT truth-table, cut-set, and shared-event tests.

### Interchange

- [x] Import OpenPSA XML.
- [x] Export OpenPSA XML.
- [x] Keep advanced formats and extensive solver controls deferred.

### Phase 5 remediation — UX and API reconciliation

- [x] Place top-level identity, save, validation, and Run actions in a compact editor header.
- [x] Replace the undifferentiated action toolbar with contextual creation controls attached to the selected gate and a dedicated empty-tree top-gate action.
- [x] Place zoom, fit, and automatic-layout controls as compact canvas controls and keep undo/redo and interchange actions in appropriate secondary groups.
- [x] Render clearly visible connecting edges at every supported zoom level, in automatic and manual layouts, and in every supported theme and selection state.
- [x] Use one editor-local inspector consistently for gates, basic events, house events, undeveloped events, and transfers.
- [x] Stop automatically opening a second workbook-level drawer when an FT node is selected; expose deliberate navigation to a full shared record or transfer target instead.
- [x] Collapse or omit the inspector when no node is selected; do not reserve a large panel for an instructional empty state.
- [x] Reset selection and contextual controls predictably when switching systems or following a transfer.
- [x] Remove the contradictory SFR DC ↔ HVAC transfer cycle and keep non-detailed system representations outside strict FT validation.
- [x] Preserve structured solver failures in the frontend, align Run visibility with backend permissions, validate identity fields inline, and use correct client-error status codes.
- [x] Mark displayed results stale as soon as an edit begins, including while the revisioned save is in flight.
- [x] Add authoritative backend analysis-ready validation for workbook-owned fault trees.
- [x] Add visual-regression and interaction coverage for default SFR and HTGR models, every node type, read-only mode, failed runs, and wide and narrow editor layouts.

### Phase 5 interaction follow-up - fixed canvas and node-local authoring

- [x] Make ordinary two-finger and wheel gestures pan vertically and horizontally without changing zoom; reserve touchpad pinch and modified-wheel gestures for cursor-centered zoom.
- [x] Keep the editor workspace at one fixed height when selection changes and render the inspector as an editor-local overlay for every node type.
- [x] Refit the tree contents, rather than resizing the editor, on initial load, actual canvas resize, topology-size changes, and inspector open or close.
- [x] Open the inspector on left-click, expose the same child-creation actions from every logic-gate context menu, and keep basic-event and other leaf-node menus free of authoring actions.
- [x] Present one **Add basic event** action that opens a second-level chooser for either creating a new event or searching and selecting an existing event, without “shared” labels or duplicate creation commands.
- [x] Move node deletion into the node context menu and preserve existing-parent reparent/disconnect controls without an add-or-choose-another-parent action.
- [x] Remove the persistent authoring palette, idle selection prompt, and bottom legend while retaining compact zoom, fit, and automatic-layout canvas controls.
- [x] Prove fixed viewport dimensions, unobscured transfer selection, full-tree fitting, visible connectors, node-menu containment, wheel panning, and wide/narrow layouts in canonical unit and Docker-backed Chromium coverage.

### FT completion gate

- [x] A user can create an FT.
- [x] A user can save and reload it.
- [x] A user can validate it.
- [x] A user can quantify it.
- [x] A user can review cut sets.
- [x] A consuming workbook can reference its workbook-owned FT entities without copying the tree.
- [x] SY and every other FT host import the same canonical newly-developed-method component.
- [x] No alternate FT renderer/editor implementation remains.
- [x] The Playwright FT create/edit/reload/validate/run/link workflow passes.

### Prior narrow verification evidence (superseded on 2026-08-22)

The earlier completion claim covered one clean authored path but did not exercise the shipped SFR transfer cycle, the non-detailed Guard Vessel representation, consistent inspector ownership, contextual control placement, or visible connector parity. At that point, Phase 5 remained open until the remediation checklist and completion gate passed again.

- Repository searches found one production `FaultTreeEditor` implementation, under `newly-developed-methods/fault-tree`, imported by every FT host; the superseded renderer files and production React Flow dependency were removed. A retained Playwright trace was manually reviewed for visual and interaction parity with the approved SY presentation.
- Automated verification passed: frontend Jest (91 suites, 533 tests), shared Jest (20 suites, 651 tests), backend Jest (42 suites, 389 tests), Rust fault-tree tests (6 tests, including exhaustive Boolean truth-table coverage), and native solver-boundary tests (7 tests).
- Relevant frontend, backend, shared, MEF, and E2E typechecks and linters passed; frontend and backend production builds passed; Prettier and `git diff --check` were clean.
- The persistent Docker-backed Playwright flow passed in Chromium. It creates, edits, saves, reloads, validates, transfers, and quantifies an FT; verifies exact top-event probability `0.006363209690436578`, eight order-one minimal cut sets, and stale-result behavior; then links and reloads the selected top event from an ES workbook and proves the persisted reference contains only the typed workbook, model, entity, and reference-type address.

### Phase 5 remediation verification evidence

- The persistent Docker-backed Chromium flow passed both SFR and HTGR scenarios. It authors an SFR tree, saves and reloads it, invokes authoritative server validation, follows a transfer, quantifies through the native solver, reviews exact cut sets, marks the result stale after an edit, and persists a typed ES top-event reference. The HTGR scenario renders a connected seeded tree through the same canonical editor.
- Browser assertions prove the editor SVG occupies the canvas rather than inheriting the workbook card's icon dimensions, real connections have visible theme-token strokes of at least two CSS pixels, the viewport dimensions remain identical when the transfer inspector opens, fitted content remains outside the overlay inspector, and node menus remain inside the canvas. Wide and narrow layouts retain the same editor-local inspector, while the initial HTGR tree refits completely inside the fixed workspace. The generated wide, narrow, isolated-SVG, and HTGR images were manually reviewed.
- Canonical editor tests cover every gate family and leaf-node symbol, non-scaling selected and invalid connectors, wheel-pan versus pinch-zoom behavior, child authoring from every logic gate, leaf menus without authoring commands, the two-level searchable existing-or-new basic-event chooser, atomic new-event attachment, node deletion, the removed legend/palette/additional-parent control, fixed canvas identity, the absent idle inspector, explicit external navigation, read-only behavior, inline identity validation, stale results, immutable cut sets, shared DAG nodes, and contextual controls. SY host tests cover permission-aligned execution, server validation, structured failures, save-in-flight staleness, explicit drawers, and non-detailed representations.
- Complete verification passed: frontend Jest 91 suites/549 tests, backend Jest 43 suites/391 tests, shared-interface Jest 20 suites/651 tests, Playwright 2 scenarios, Rust library 15 tests, and native Node-API 7 tests. Frontend, backend, shared, MEF, and E2E typechecks; frontend, backend, shared, and MEF lints; frontend and backend production builds; Rust formatting and strict Clippy; scoped Prettier; and `git diff --check` all passed.
- The backend regression validates every detailed default SFR tree as analysis-ready with no error finding; the intentionally non-detailed Guard Vessel representation stays outside strict FT validation. The documented dependency-loop resolution is enforced by retaining HVAC-to-DC while removing the contradictory DC-to-HVAC transfer.

The FT completion gate is satisfied. Phase 6 may begin.

## Phase 6 — Bayesian-network vertical slice

Create the only BN implementation under `newly-developed-methods/bayesian-network`. ESQ Step 05 Dependencies imports and hosts it; do not add a project model library or a second workbook-local BN editor. Use OpenPRA styling while adopting only the essential MAAT functionality.

### Canonical component and workbook host

- [ ] Define the canonical BN editor component contract under `newly-developed-methods/bayesian-network`.
- [ ] Add BN data to the ESQ workbook MEF and persist it through the ESQ workbook patch service.
- [ ] Import the canonical BN editor into ESQ Step 05 Dependencies.
- [ ] Prove by repository search that only one BN renderer/editor implementation exists.

### Editing

- [ ] Add and rename a discrete node.
- [ ] Add, remove, and reorder node states.
- [ ] Connect parent and child nodes and prevent cycles.
- [ ] Edit CPT rows.
- [ ] Normalize a selected CPT row.
- [ ] Identify invalid CPT rows.
- [ ] Move and automatically arrange nodes.
- [ ] Delete nodes with impact confirmation.
- [ ] Implement undo and redo.
- [ ] Warn that the CPT must be rebuilt after parent or state changes.
- [ ] Never silently reinterpret existing CPT values.
- [ ] Add BN CPT and graph-editing tests.

### Evidence and querying

- [ ] Apply and clear evidence.
- [ ] Select a query node.
- [ ] Run exact inference through TensorBayes.
- [ ] Display the posterior distribution.
- [ ] Keep backend and approximation selectors out of the initial UI.
- [ ] Add BN evidence and exact-inference tests.

### HCL binding workflow

- [ ] Select an FT and an FT basic event.
- [ ] Select a BN node and one or more BN true states.
- [ ] Reject an empty true-state selection.
- [ ] Reject a selection containing every BN state.
- [ ] Display missing or invalid bindings.
- [ ] Display the models that use the BN.
- [ ] Add HCL binding validation tests.

### HCL FT quantification

- [x] Run a linked FT in independent Boolean mode.
- [x] Run a linked FT in exact HCL mode.
- [x] Use TensorBayes conditional probabilities for bound events under the complete BDD path context.
- [x] Retain FT probabilities for unbound events.
- [ ] Keep the marginal-only approximation out of the UI.
- [x] Add existing HCL equivalence tests to the integrated workflow.

### Interchange and BN completion gate

- [ ] Import XDSL.
- [ ] Export XDSL.
- [ ] Use canonical OpenPRA JSON internally.
- [ ] The Playwright BN create/edit/reload/validate/query/link workflow passes.

## Phase 7 — Event-tree vertical slice

The one canonical ET implementation lives under `newly-developed-methods/event-tree`. Move or refactor the approved workbook ET presentation into that folder, then have ES, ESQ, and every other ET surface import it so the workbook experience remains visually continuous.

### Canonical extraction and consolidation

- [ ] Identify the exact approved workbook ET components, styles, interaction state, selectors, and ESQ result integrations that establish the standard presentation.
- [ ] Move or refactor that presentation into `newly-developed-methods/event-tree` without changing its appearance.
- [ ] Define the canonical ET component inputs, workbook persistence callbacks, read-only mode, validation state, result overlay, and link-selection mode.
- [ ] Change the source workbook screen to import the canonical ET component and verify visual and interaction parity.
- [ ] Replace every other ET renderer/editor with an import of the canonical ET component.
- [ ] Remove each superseded ET implementation only after its importing workbook has passed automated and manual parity checks.
- [ ] Prove by repository search that only one ET renderer/editor implementation remains.

### Editing

- [ ] Create an ET.
- [ ] Select or enter an initiating-event frequency.
- [ ] Add ordered functional events.
- [ ] Link functional events to FT top events.
- [ ] Build success and failure paths.
- [ ] Add end states and event-tree transfers.
- [ ] Generate sequence paths.
- [ ] Validate branch completeness.
- [ ] Select and highlight a sequence.
- [ ] Implement undo and redo.
- [x] Represent the failure branch with the FT formula and the success branch with its Boolean complement.

### Independent ET quantification

- [x] Build the Boolean formula for every sequence.
- [x] Preserve shared basic-event identity across FTs.
- [x] Build a BDD for each sequence.
- [x] Calculate conditional sequence probability.
- [x] Apply initiating-event frequency.
- [x] Aggregate sequences into end states.
- [x] Do not multiply separately calculated branch marginals.
- [x] Add ET complement, transfer, shared-event, and dependency tests.

### HCL ET quantification

- [x] Build each sequence formula and BDD.
- [x] Apply FT-to-BN HCL bindings.
- [x] Reuse the compiled BN across sequences.
- [x] Preserve path-context evidence.
- [x] Calculate sequence probabilities and frequencies.
- [x] Aggregate mutually exclusive sequences by end state.
- [x] Return sequence path, conditional probability, annual frequency, and end state.
- [x] Return end-state aggregates and leading contributors or cut sets where available.
- [x] Add combined FT–BN–ET tests.
- [ ] ES, ESQ, and every other ET host import the same canonical newly-developed-method component.
- [ ] No alternate ET renderer/editor implementation remains.
- [ ] The Playwright ET create/edit/reload/validate/run/link workflow passes.

## Phase 8 — Workbook connections

Keep editor implementations reusable under `newly-developed-methods`, but keep model instances embedded in and persisted by their owning workbooks. Workbook screens import the canonical editors; cross-workbook consumers store controlled typed references.

- [ ] Host system FTs in SY Step 02 by importing `newly-developed-methods/fault-tree`.
- [ ] Replace IE FT presentations with the same canonical FT import and connect them to their controlled workbook data or typed SY references.
- [ ] Link DA workbooks to basic-event parameters and probabilities.
- [ ] Link HRA workbooks to human-failure events and HEPs.
- [ ] Host ETs and sequence definitions in ES by importing `newly-developed-methods/event-tree`.
- [ ] Use the same canonical ET import for ESQ ET views and result overlays.
- [ ] Host BNs and HCL binding UI from their workbook screen by importing the canonical newly-developed-method components.
- [ ] Link ESQ workbooks to the exact contributing workbooks, model entities, revisions, and immutable analysis runs.
- [ ] Link RC/RI workbooks to end-state and risk results.
- [ ] Link hazard PRA workbooks to hazard-conditioned models.
- [ ] Add **Open linked fault tree** and equivalent actions that navigate to the owning workbook host rather than a standalone model page.
- [ ] Add explicit **Use this run** actions for controlled workbook results.
- [ ] Ensure rerunning a model never silently overwrites controlled workbook results.
- [ ] Add workbook reference and run-selection tests.
- [ ] Remove obsolete FT/ET routes, components, styles, adapters, and model-library code after every host has migrated.

## Phase 9 — Seeded example and hardening

- [ ] Create a generic HTGR example with multiple linked system FTs.
- [ ] Include shared support events and human-failure events.
- [ ] Include a discrete dependency BN and complete HCL bindings.
- [ ] Include a ULOF-style ET with safe and release end states.
- [ ] Include verified independent and HCL results.
- [x] Run shared interface and Zod tests.
- [ ] Run save-on-blur, partial-patch, revision-conflict, and backend permission tests.
- [x] Run NAPI loading tests on Windows and Linux and verify Docker packaging.
- [x] Run FT truth-table, cut-set, and shared-event tests.
- [x] Run BN CPT and evidence tests.
- [x] Run HCL equivalence tests.
- [x] Run ET complement and transfer tests.
- [x] Run combined FT–BN–ET tests.
- [ ] Run all Playwright create, edit, reload, validate, run, and link workflows.

## Future work — MHTGR SAPHIRE import

The MHTGR import is intentionally outside the current active scope.

- [ ] Define the SAPHIRE-to-OpenPRA import acceptance criteria.
- [ ] Import the MHTGR model from SAPHIRE.
- [ ] Validate imported identity, logic, probabilities, and quantification results against the source model.

## Deferred initial functionality

The following items are explicitly excluded from the initial implementation:

- Continuous or dynamic BNs.
- Decision and utility nodes.
- UQ configuration interfaces.
- Dynamic event trees.
- Repair modeling.
- Advanced sensitivity studios.
- User-facing solver backend selection.
- GPU controls.
- Collaborative live cursors.
- Extensive diagram exports.
- Every available PRAXIS algorithm option.
- MAAT advanced performance settings.

## Verification log

| Date | TODO | Verification | Result |
| --- | --- | --- | --- |
| 2026-08-22 | Complete the Phase 5 fixed-canvas and node-local interaction follow-up | Replaced palette authoring with child creation on every logic-gate menu while keeping leaf menus free of authoring commands; unified event attachment behind one **Add basic event** action with a searchable existing-event chooser and a create-new path; moved deletion into node menus; removed the legend and additional-parent action; made ordinary touchpad/wheel input pan while pinch zooms; overlaid one inspector without resizing the 480 px workspace; and automatically refit content on load/resize/topology/inspector changes. Frontend Jest passed 91 suites/549 tests, both frontend and E2E typechecks passed, both persistent Chromium scenarios passed, generated wide/narrow/HTGR images were reviewed, and `git diff --check` passed | Passed |
| 2026-08-22 | Complete Phase 5 fault-tree UX and API remediation | Consolidated editor controls and inspection, restored full-size visible connectors, reconciled SFR topology and non-detailed models, added workbook-owned server validation and correct failure/staleness/permission handling, and expanded canonical unit and persistent SFR/HTGR browser coverage. Complete frontend, backend, shared, Playwright, Rust, native-addon, typecheck, lint, build, format, and diff gates passed | Passed |
| 2026-08-20 | Fetch latest `origin/main` | `git fetch origin main`; branch base resolved to `f6afbce0` (`docs: refine branding and disclosures (#166)`) | Passed |
| 2026-08-20 | Create feature branch | `git worktree add -b hcl_implementation_mhtgr_model_import ... origin/main`; branch tracks `origin/main` | Passed |
| 2026-08-20 | Create implementation checklist | `prettier --check apps/docs-md/guides/hcl-mhtgr-editor-implementation-plan.md` | Passed |
| 2026-08-21 | Revise canonical editor architecture | Recorded `newly-developed-methods` as the sole FT/ET/BN/HCL implementation location, workbook screens as importing hosts, SY FT and approved workbook ET visuals as the standards, duplicate-editor removal after parity testing, workbook-owned persistence, and the reopened workbook API gate; `pnpm exec prettier --check apps/docs-md/guides/hcl-mhtgr-editor-implementation-plan.md` and `git diff --check` passed | Passed |
| 2026-08-21 | Inventory current FT and ET implementations | Repository-wide TSX, import, call-site, CSS, MEF, backend, and solver searches identified two FT renderer implementations (SY standard and the alternate newly-developed ReactFlow internals), their IE Step 02 and Step 08 callers, and one ES Step 02 ET presentation bundle with three coordinated representations; searches also confirmed ESQ has transfer/dependency records but no graphical ET renderer, other workbook matches are references rather than editors, and direct frontend renderer coverage is absent except for the ES selector test. The canonical definition/call-site search, `pnpm exec prettier --check apps/docs-md/guides/hcl-mhtgr-editor-implementation-plan.md`, and `git diff --check` passed | Passed |
| 2026-08-21 | Designate the sole FT and ET visual standards | User direction and the verified inventory designate SY Step 02 System Models as the sole FT visual source and ES Step 02 Event Sequences as the sole ET visual source. The alternate ReactFlow FT implementation is explicitly scheduled for removal after every current caller imports the SY-based canonical implementation and passes parity testing | Passed |
| 2026-08-21 | Define canonical public editor contracts | Defined one controlled public component per method folder, one-operation-at-a-time workbook callbacks, author/read/reference/quantification capabilities, typed cross-workbook navigation, host-owned persistence and execution, private ET representations, mandatory SY/ES visual parity, and explicit removal of the alternate ReactFlow renderer after migration. Contract assertions, Prettier, and `git diff --check` passed | Passed |
| 2026-08-21 | Separate reusable method schemas from workbook-owned MEF persistence wrappers | Moved strict FT, BN, ET, and HCL definition bodies and their Zod schemas into `interfaces-mef-types/modeling`, where they reject project, audit, revision, and method-type persistence metadata; retained the existing `shared-types` standalone shapes only as compatibility wrappers for later migration TODOs. Focused definition/wrapper tests passed 8/8; the complete shared-interface suite passed 588/588; the backend suite passed 339/339; the frontend suite passed 475/475; MEF/shared-interface and backend/frontend typechecks passed; both interface lint targets passed | Passed |
| 2026-08-21 | Replace standalone identity with workbook-scoped identity | Added strict durable workbook/model/entity addresses, separate workbook-catalogue and model-entity addresses, and revision-bearing snapshot identities; migrated reusable MEF definitions to explicit workbook-local entity IDs; rejected project ID, standalone ID, model revision, analyst code, and invalid local-ID forms; and marked old method IDs and project-model identity/metadata as deprecated compatibility contracts. Focused identity/definition tests passed 13/13; the full interface suite passed 593/593; backend passed 339/339; frontend passed 475/475; all four interface/application typechecks and both interface lint targets passed; Prettier and `git diff --check` passed | Passed |
| 2026-08-21 | Define typed cross-workbook references | Added strict discriminated references for FT top events, workbook-catalogue FT basic events, ET functional events, BN nodes, and HCL bindings; required workbook/model/entity scope appropriate to each target; excluded revision, project, display, and copied-target metadata from durable links; and retained old generic references only as deprecated compatibility contracts for the following MEF migrations. Focused identity/reference tests passed 32/32; the full shared-interface suite passed 612/612; backend passed 339/339; frontend passed 475/475; all four interface/application typechecks and both interface lint targets passed | Passed |
| 2026-08-21 | Make the SY workbook basic-event collection canonical | Implemented required workbook-level catalogue ownership, reference-only FT leaves, derived per-model membership, legacy migration with model-local edit precedence, canonical API reads, and catalogue-backed SY screens/reports. Initial manual verification found that blank SY Step 02 assumed a system definition; Step 02 now renders a guarded empty state, with a focused regression test. Focused migration/schema tests passed 7/7; shared interfaces passed 612/612; backend passed 346/346; frontend passed 476/476; all four interface/application typechecks and MEF/backend/frontend lint targets passed. Frontend and backend services respond locally on ports 4201 and 8000. The user confirmed the blank state, seeded-event drawer values, name/probability edits, persistence after refresh, card synchronization, and other-system rendering | Passed |
| 2026-08-21 | Extend the existing ES event-tree MEF | Kept `EventSequenceAnalysis.eventTrees[]` as the only persisted topology and extended each existing tree with initiating-event frequency, typed cross-workbook FT top-event links, and canvas layout. Direct tree parsing rejects standalone method-model metadata and ambiguous dual legacy/typed FT links while retaining legacy-only links for the dedicated migration TODO. Focused contract tests passed 4/4 and the ES workbook-schema round-trip passed 1/1; shared interfaces passed 616/616; backend passed 347/347; frontend passed 476/476; all four interface/application typechecks and lint targets passed; Prettier and `git diff --check` passed | Passed |
| 2026-08-21 | Add BN and HCL data to the hosting ESQ workbook MEF | Added required ESQ-owned BN and HCL collections, strict workbook-local model wrappers, typed HCL FT-basic-event and BN-node bindings, declared-target integrity checks, blank/seed initialization, and default healing for older ESQ payloads. The complete ESQ schema round-trips both collections and drops an unknown project-level `methodModels` collection, while the later legacy backend-migration gate remains undisturbed. Focused contract tests passed 4/4 and focused backend round-trip tests passed 3/3; the full shared-interface suite passed 620/620 and backend suite passed 350/350; MEF/shared/backend typechecks and all three lint targets passed; Prettier and `git diff --check` passed | Passed |
| 2026-08-21 | Remove the frontend model-library concept | Verified that the rejected standalone frontend had never been exposed: no model-library route, navigation entry, component, or project method-model API caller exists. Documented `newly-developed-methods` as a reusable source boundary, preserved the distinct methodology-documentation MEFs, and added a production-source architecture guard against model-library endpoints/routes/components and editor persistence coupling. Focused architecture tests passed 2/2; the complete frontend suite passed 478/478; frontend typecheck, lint, and production build passed; Prettier and `git diff --check` passed | Passed |
| 2026-08-21 | Add SY fault-tree and ES event-tree migration tests | Added independent frozen legacy fixtures and full-workbook characterization tests. SY migration preserves nested gate/transfer topology and event metadata while consolidating model-local and leaf-only events into reference-only leaves plus the workbook catalogue; ES compatibility preserves branches, paths, sequences, transfers, mission data, and unqualified FT IDs until a context-aware resolver is implemented. Both results reparse idempotently and neither test mutates its fixture. Focused migration tests passed 2/2; shared interfaces passed 620/620 and backend passed 352/352; MEF/shared/backend typechecks and all three lint targets passed; Prettier and `git diff --check` passed | Passed |
| 2026-08-21 | Verify corrected interfaces and migrations before backend ownership changes | Ran the accumulated workbook-owned contracts and migrations as a consolidated pre-refactor gate without changing production schemas, stored shapes, routes, or ownership. Focused corrected interface tests passed 40/40 and focused workbook ownership/migration tests passed 13/13. Complete suites passed 620/620 shared-interface, 352/352 backend, and 478/478 frontend tests. Typecheck and lint passed for MEF types, shared types, backend, and frontend; Prettier and `git diff --check` passed | Passed |
| 2026-08-21 | Remove project-level method-model persistence and routes | Deleted the `method_models` schema, project-model service/controller, their module registration, and tests coupled exclusively to the retired API. Added a production-source and module-metadata regression guard while preserving the PRAXIS client, analysis-run record, and separately scheduled FT catalogue. The focused guard passed 2/2; the complete remaining backend suite passed 299/299; backend typecheck, lint, and production build passed. Runtime checks confirmed all ten former CRUD/dependency/validation/run endpoint variants return HTTP `404`, while the protected projects API remains registered; Prettier and `git diff --check` passed | Passed |
| 2026-08-21 | Remove project-level FT basic-event catalogue persistence and routes | Deleted the `fault_tree_basic_event_catalogues` schema, project catalogue service/controller, module registration, and obsolete focused tests. Left `FaultTreeModule` as an empty composition boundary and preserved the canonical SY workbook catalogue. The combined removal/SY/migration gate passed 12/12 and the complete remaining backend suite passed 291/291; backend typecheck, lint, and production build passed. Runtime checks confirmed the retired GET/POST/PATCH routes return HTTP `404` while the protected SY workbook API remains registered; Prettier and `git diff --check` passed | Passed |
| 2026-08-21 | Load and patch FT, ET, BN, and HCL through owning workbooks | Kept the existing authenticated SY, ES, and ESQ workbook GET/PATCH APIs as the sole persistence transport; made all three responses return schema-parsed concrete MEF types; validated path-operation patches against the complete owner MEF; and preserved HCL automatic `variableOrder: null` through ESQ service and adapter normalization. A focused HTTP integration suite passed 3/3 across SY FT, ES ET, ESQ BN, and ESQ HCL loads and independent patches; the complete shared-interface suite passed 620/620 and backend suite passed 294/294; MEF/shared/backend typechecks and lints plus the production backend build passed | Passed |
| 2026-08-21 | Reuse workbook authorization and workflow checks for edits and executions | Added one exported workbook model-access boundary that checks project access, effective workbook author roles, and editable workflow state in order for both edits and execution. SY, ES, and ESQ PATCH services now use the edit gate before mutation; the method shared backend imports the execution gate for its separately scheduled workbook-run refactor. A focused 44/44 matrix, HTTP, and architecture suite covered owner/editor, preparer/co-preparer, draft/revision, viewer, reviewer, approver, no-role, review/approval/final, concealed access, and all three owner routes; the complete backend suite passed 332/332; backend typecheck, lint, and production build passed | Passed |
| 2026-08-21 | Add workbook revision and expected-revision handling to method patches | Added persisted positive revisions to SY, ES, and ESQ owner documents; strict expected-revision PATCH payloads; revision-bearing GET/PATCH responses; legacy revision-less reads as revision 1; and exactly-once successful increments across FT, ET, BN, and HCL path patches. Contract/API tests cover required positive revisions, schema defaults, legacy migration, sequential increments, authorization preservation, and no-save stale rejection. Complete suites passed 622/622 shared-interface and 336/336 backend tests; shared/backend typechecks and lints plus the production backend build passed | Passed |
| 2026-08-21 | Preserve HTTP 409 for stale and racing workbook edits | Replaced SY, ES, and ESQ method-patch document saves with revision-qualified atomic `findOneAndUpdate` operations that write the validated MEF and next revision together, including the legacy revision-less-to-2 transition. A synchronized two-request API regression proves both requests load revision 1, exactly one returns 200/revision 2, the loser returns 409, and only the winning MEF is stored. Focused revision tests passed 13/13 and the complete backend suite passed 337/337; backend typecheck, lint, and production build passed | Passed |
| 2026-08-21 | Resolve typed workbook dependencies | Added strict cross-reference and workbook-model-address discovery across SY, ES, and ESQ MEFs with escaped JSON-pointer paths, deterministic sorting, and rejection of legacy lookalikes. Focused interface/backend tests passed 10/10 | Passed |
| 2026-08-21 | Store immutable workbook-owned analysis contexts | Replaced project/model run snapshots with owner identity, unique contributing workbook revisions, and exact immutable MEF snapshots. Focused interface/backend schema tests passed 10/10 and both production typechecks passed | Passed |
| 2026-08-21 | Adapt workbook MEFs to PRAXIS | Added pure SY FT, ESQ BN, ES ET, and ESQ HCL snapshot adapters, including canonical SY catalogue resolution, deterministic ES end-state IDs, and typed-reference normalization without source mutation. Focused adapter tests passed 5/5 and backend typecheck passed | Passed |
| 2026-08-21 | Gate workbook-model deletion by typed references | Added revisioned owner routes for SY FTs, ES ETs, ESQ BNs, and ESQ HCL configurations; typed dependencies block deletion with `409`, while references inside the removed model are ignored. Focused dependency tests passed 5/5 and owner-route tests passed | Passed |
| 2026-08-21 | Correct the backend ownership test matrix | Updated module and HTTP matrices for new dependency/run providers and all four deletion routes. The complete backend suite passed 354/354 across 40 suites; backend typecheck and lint passed | Passed |
| 2026-08-21 | Execute an SY-owned FT through its workbook API | A real HTTP request traversed the SY route, immutable run storage, Praetor worker, and native PRAXIS addon. The OR fixture returned exact probability `0.28` and leading cut-set probabilities `[0.2, 0.1]` | Passed |
| 2026-08-21 | Execute a workbook-owned BN query | A real ESQ workbook API call reached TensorBayes through PRAXIS and returned the exact posterior `[0.36, 0.64]` | Passed |
| 2026-08-21 | Execute an ES-owned ET through typed SY references | The ES API resolved its typed SY FT top-event reference, recorded ES revision 5 plus SY revision 3, and returned sequence probabilities `0.72/0.28` with annual frequencies `0.0072/0.0028` | Passed |
| 2026-08-21 | Execute integration-workbook HCL FT and ET runs | ESQ HCL routes assembled immutable ESQ/ES/SY snapshots and executed exact HCL. FT returned `0.16` rather than independent `0.02`; ET returned `0.84/0/0/0.16`, preserving complete path context | Passed |
| 2026-08-21 | Persist and retrieve every contributing revision | A real Mongo run recorded owner identity, request, ES and SY source revisions, both complete immutable MEF snapshots, result, and lifecycle fields; status and result routes returned the same identities | Passed |
| 2026-08-21 | Re-run corrected numerical fixtures | One combined real API-to-worker run passed FT `0.28`, BN `0.64`, independent ET `0.72/0.28`, HCL FT `0.16`, and HCL ET `0.84/0/0/0.16` | Passed |
| 2026-08-21 | Cover corrected API boundaries | Focused HTTP tests returned `403` for execution permission denial, `409` for stale revision, `404` for missing model references, `502` for malformed native results with durable structured failure, and `409` for unavailable failed-run results | Passed |
| 2026-08-21 | Verify corrected Windows, Linux, and Docker paths | Windows direct-addon and all 6 corrected API tests passed. A clean Debian builder loaded the Linux GNU addon and passed the same 6 tests. The final runtime image contains only the four intended addon files, and its packaged Praetor worker returned FT `0.28` from worker thread 1 | Passed |
| 2026-08-20 | Verify existing FT presentation | Frontend type check passed; browser check opened the MLD FT, confirmed node detail interaction, and confirmed zoom changed the React Flow viewport transform | Passed |
| 2026-08-20 | Verify existing ET presentation | `esSelectors.spec.ts` passed 7/7; browser check opened the ET view and selected EHP-3, which displayed the RT-success/SCS-failure/RCCS-failure/CONF-success path and RC-2 outcome | Passed |
| 2026-08-20 | Create shared interface module and barrels | Prettier check, `interfaces-shared-types:typecheck`, and `interfaces-shared-types:lint` | Passed |
| 2026-08-20 | Define core method-model identity | Runtime Zod acceptance/rejection checks, Prettier, interface type check, and interface lint | Passed |
| 2026-08-20 | Define version, revision, ownership, and timestamps | Runtime Zod checks rejected unknown versions, non-positive revisions, invalid timestamps, and blank owners; static checks passed | Passed |
| 2026-08-20 | Define canvas layout metadata | Runtime Zod checks covered positions, zoom bounds, modes, and directions; Prettier, type check, and lint passed | Passed |
| 2026-08-20 | Define validation result contracts | Runtime Zod checks covered validity/error consistency, issue codes, entity UUIDs, and field paths; static checks passed | Passed |
| 2026-08-20 | Define analysis-run metadata | Runtime lifecycle and timestamp-order checks plus interface type check and lint | Passed |
| 2026-08-20 | Enforce stable UUID references | Runtime checks accepted UUID-only references and rejected code/name-based or extra-key references; static checks passed | Passed |
| 2026-08-20 | Add shared interface and Zod tests | `interfaces-shared-types:test` passed 26/26; package type check, lint, and Prettier passed | Passed |
| 2026-08-20 | Create FT interface module and barrels | Prettier, interface type check, interface lint, and 26 existing contract tests passed | Passed |
| 2026-08-20 | Define FT top gate and gate variants | 14/14 focused FT gate tests plus Prettier, interface type check, and lint | Passed |
| 2026-08-20 | Define FT leaf and transfer contracts | 22/22 focused FT tests plus Prettier, interface type check, and lint | Passed |
| 2026-08-20 | Define FT gate inputs and positions | 29/29 focused FT tests, including multi-parent references and invalid ordering/position cases; static checks passed | Passed |
| 2026-08-20 | Define FT probability and controlled data-source references | 40/40 focused FT tests, including probability bounds, non-finite values, stable source identifiers, and strict-object rejection; Prettier, interface type check, and lint passed | Passed |
| 2026-08-20 | Define project basic-event catalogue | 48/48 focused FT tests demonstrated one catalogue identity shared by multiple FT references and rejected invalid catalogue metadata, event identity, probability, and FT-scoped fields; static checks passed | Passed |
| 2026-08-20 | Define versioned FT model, request, and result contracts | 38/38 focused API-contract tests covered draft models, create/patch/validate/execute flows, optimistic revisions, analysis-run method type, exact probability, and cut-set results; Prettier, interface type check, and lint passed | Passed |
| 2026-08-20 | Complete FT interface and Zod contract tests | Full `interfaces-shared-types:test` passed 112/112 across three suites; FT statement coverage was 89.02% with 100% branch/function coverage; package Prettier, type check, and lint passed | Passed |
| 2026-08-20 | Create BN interface module and barrels | New module files and public barrel export passed Prettier, interface type check, interface lint, and all 112 existing contract tests | Passed |
| 2026-08-20 | Define discrete BN chance nodes | After correcting an empty-table-row Jest ambiguity caught by the first run, 10/10 focused tests passed for binary/multistate nodes, the two-state minimum, stable UUIDs, strict fields, and unsupported node kinds; static checks passed | Passed |
| 2026-08-20 | Define BN graph, CPT, and position contracts | 34/34 focused BN tests passed for stable directed edges, explicit parent order, root/conditional CPT shapes, probability bounds, UUID-keyed parent states, and finite canvas positions; static checks passed | Passed |
| 2026-08-20 | Define BN evidence, query, and marginal contracts | 51/51 focused BN tests passed for empty/observed evidence, single-state-per-node evidence, unique non-empty query targets, binary/multistate marginals, probability bounds, and normalized sums | Passed |
| 2026-08-20 | Exclude advanced BN node types | 60/60 focused BN tests passed with a public chance-node-only schema that explicitly rejects decision, utility, deterministic, continuous, and dynamic representations; static checks passed | Passed |
| 2026-08-20 | Define versioned BN model, request, and result contracts | 38/38 focused API-contract tests passed for draft/full models, create/optimistic-patch/validate/execute flows, nested queries, method-type isolation, and completed marginal results; static checks passed | Passed |
| 2026-08-20 | Complete BN interface and Zod contract tests | Full `interfaces-shared-types:test` passed 210/210 across five suites; BN statement coverage was 87.35% with 100% branch/function coverage; package Prettier, type check, and lint passed | Passed |
| 2026-08-20 | Create ET interface module and barrels | New ET module files and public barrel export passed Prettier, interface type check, interface lint, and all 210 existing contract tests | Passed |
| 2026-08-20 | Define ET initiating event and frequency | 20/20 focused ET tests passed for UUID-only initiating-event targets, non-negative finite frequency, optional controlled source identifiers, and strict input fields; static checks passed | Passed |
| 2026-08-20 | Define ordered ET functional events and FT links | 25/25 focused ET tests passed for explicit event order and UUID-only functional-event-to-FT-top-gate links, including strict rejection of name/code-coupled references | Passed |
| 2026-08-20 | Define ET sequence paths, end states, and identifiers | 37/37 focused ET tests passed for success/failure path steps, stable end-state and sequence UUIDs, strict metadata, and draft empty-path representation; static checks passed | Passed |
| 2026-08-20 | Define ET transfers, HCL references, and layout | 56/56 focused ET tests passed for discriminated end-state/transfer results, UUID-only transfer and HCL targets, shared layout metadata, and finite UUID-keyed positions; static checks passed | Passed |
| 2026-08-20 | Define versioned ET model, request, and result contracts | 42/42 focused API-contract tests passed for draft/full models, create/optimistic-patch/validate flows, independent/HCL execution modes, method isolation, sequence probability/frequency results, and end-state aggregates | Passed |
| 2026-08-20 | Complete ET interface and Zod contract tests | Full `interfaces-shared-types:test` passed 308/308 across seven suites; ET statement coverage was 89.61% with 100% branch/function coverage; package Prettier, type check, and lint passed | Passed |
| 2026-08-20 | Create HCL interface module and barrels | New HCL configuration/bindings/request/result/schema files and public barrel export passed Prettier, interface type check, interface lint, and all 308 existing tests | Passed |
| 2026-08-20 | Define HCL BN and FT references | 8/8 focused HCL tests passed for UUID-only BN and reusable FT model references with strict rejection of embedded names/codes and malformed targets; static checks passed | Passed |
| 2026-08-20 | Define HCL FT-basic-event to BN-node bindings | 16/16 focused HCL tests passed for stable binding UUIDs and UUID-only cross-model entity targets, while rejecting code/name coupling and fields reserved for later contracts; static checks passed | Passed |
| 2026-08-20 | Define HCL true states and base evidence | 24/24 focused HCL tests passed for non-empty unique true-state UUIDs and reusable empty/observed BN evidence with single-state-per-node conflict rejection; static checks passed | Passed |
| 2026-08-20 | Define current PRAXIS HCL solver settings | Local PRAXIS API inspection confirmed variable order, constant folding, and null-gate splicing as the only supported settings; 34/34 focused HCL tests passed while rejecting unsupported backend/approximation/performance fields; static checks passed | Passed |
| 2026-08-20 | Define HCL validation and quantification results | Local PRAXIS API inspection confirmed the result metrics; 45/45 focused HCL tests covered the shared validation envelope, probability bounds, BDD counts/order, bridge-cache counters, junction-tree statistics, UUID targets, timestamps, and strict output fields; all 353 contract tests plus Prettier, type check, and lint passed | Passed |
| 2026-08-20 | Keep HCL mapping independent | 55/55 focused HCL tests covered a versioned standalone HCL model, one BN shared across independent configurations, multiple declared FTs, draft mappings, binding-scope integrity, uniqueness, and rejection of ET back-references; all 363 contract tests plus Prettier, type check, and lint passed | Passed |
| 2026-08-20 | Complete HCL interface and Zod contract tests | Direct focused Jest execution passed 55/55 HCL tests; full `interfaces-shared-types:test` passed 363/363 across eight suites; HCL statement coverage was 96.55% with 100% branch/function coverage; package Prettier, type check, lint, and `git diff --check` passed | Passed |
| 2026-08-20 | Implement non-blocking draft validation | 31/31 focused shared tests proved draft errors remain reported with `valid: false` while `saveAllowed` remains `true`; warning-only and clean drafts remain valid/saveable, and blocking or mislabeled outcomes are rejected; all 368 contract tests plus Prettier, type check, lint, and `git diff --check` passed | Passed |
| 2026-08-20 | Implement strict analysis-ready validation gate | 36/36 focused shared tests proved error findings block quantification, warning-only and clean results allow it, and schema invariants reject inconsistent or draft-mode decisions; all 373 contract tests plus Prettier, type check, lint, and `git diff --check` passed | Passed |
| 2026-08-20 | Require entity and field targets on validation issues | 41/41 focused shared tests proved every issue carries a UUID entity target and typed field path, permits an empty path for entity-level focus, and rejects missing, ambiguous, extra, empty-segment, fractional-index, or malformed targets; all 378 contract tests plus Prettier, type check, lint, and `git diff --check` passed | Passed |
| 2026-08-20 | Focus an issue's affected node or field on selection | A focused 3/3 jsdom interaction suite proved issue clicks select the entity, focus/scroll the addressed field, fall back to the node, and handle entity-level paths; the full frontend suite passed 475/475 across 80 suites, with frontend type check, lint, Prettier, and `git diff --check` passing | Passed |
| 2026-08-20 | Require exactly one valid FT top gate | 9/9 focused FT validation tests covered one valid gate, missing references, dangling targets, leaf targets, duplicate/ambiguous gate ids, aggregate validation, and addressable issue contracts; all 387 contract tests plus Prettier, type check, lint, and `git diff --check` passed | Passed |
| 2026-08-20 | Require unique FT codes and identifiers | 16/16 focused FT validation tests covered node ids across gate/leaf collections, case-insensitive entity codes, gate-input ids, one position per node, intentional shared catalogue-event references, aggregate findings, and addressable issue contracts; all 394 contract tests, Prettier, lint, and `git diff --check` passed; a parallel Nx database-lock failure was transparently retried and the isolated type check passed | Passed |
| 2026-08-20 | Validate FT gate inputs and NOT arity | 25/25 focused FT validation tests covered resolved and ambiguous parent/child targets, dangling references, per-gate child/order uniqueness, contiguous zero-based order, and exactly one NOT child; all 403 contract tests plus Prettier, type check, lint, and `git diff --check` passed | Passed |
| 2026-08-20 | Validate FT K-of-N thresholds | 32/32 focused FT validation tests covered K=1 and K=N boundaries, K>N, empty voting gates, distinct-child counting, non-voting gates, aggregate findings, and addressable issue contracts; all 410 contract tests plus Prettier, type check, lint, and `git diff --check` passed | Passed |
| 2026-08-20 | Reject FT Boolean cycles and dangling references | 37/37 focused FT validation tests covered acyclic chains, self-cycles, multi-gate cycles, shared-child DAGs, dangling references, aggregate findings, and addressable issue contracts; all 415 contract tests plus Prettier, type check, lint, and `git diff --check` passed | Passed |
| 2026-08-20 | Validate FT probabilities and transfer targets | 49/49 focused FT validation tests covered catalogue resolution/ambiguity/project scope, finite `[0,1]` probability boundaries, exact cross-model gate resolution, aggregate context, and addressable issue contracts; all 427 contract tests plus Prettier, type check, lint, and `git diff --check` passed | Passed |
| 2026-08-20 | Reject FT transfer cycles | 55/55 focused FT validation tests covered acyclic chains, self-cycles, complete two-model cycle reporting, shared targets, dependency-closure isolation, aggregate findings, and addressable issue contracts; all 433 contract tests plus Prettier, type check, lint, and `git diff --check` passed | Passed |
| 2026-08-20 | Require reachable FT analysis nodes | 62/62 focused FT validation tests covered fully connected trees, disconnected gates/leaves, safe traversal of cyclic input, invalid-top deferral, aggregate findings, and addressable issue contracts; all 440 contract tests plus Prettier, type check, lint, and `git diff --check` passed | Passed |
| 2026-08-20 | Complete focused FT validation tests | 66/66 focused FT validation tests covered every planned FT rule and policy integration, proving the same incomplete FT remains draft-saveable but analysis-blocked while a clean/context-resolved FT is quantifiable; all 444 contract tests passed with 98.8% statement and 100% line/function coverage for the FT validator, plus Prettier, type check, lint, and `git diff --check` | Passed |
| 2026-08-20 | Require unique BN nodes and per-node states | 7/7 focused BN validation tests covered duplicate UUIDs, trimmed case-insensitive analyst codes, per-node state-identity scope, aggregate findings, and addressable issue contracts; all 451 interface tests passed with 100% statement/branch/function/line coverage for the BN validator, plus Prettier, type check, lint, and `git diff --check` | Passed |
| 2026-08-20 | Require at least two states per BN node | After correcting an empty-array Jest table ambiguity caught by the first focused run, 12/12 focused BN validation tests covered zero, one, two, and multistate nodes plus aggregate/addressable findings; all 456 interface tests passed with 100% validator coverage, plus Prettier, type check, lint, and `git diff --check` | Passed |
| 2026-08-20 | Reject BN directed cycles and invalid parent references | 23/23 focused BN validation tests covered dangling/ambiguous edge endpoints and CPT parents, required parent-edge correspondence, self/multi-node/overlapping cycles, converging DAGs, aggregate findings, and addressable issue contracts; all 467 interface tests passed with 100% validator coverage, plus Prettier, type check, lint, and `git diff --check` | Passed |
| 2026-08-20 | Validate BN CPT dimensions and normalized rows | After narrowing two older aggregate assertions when the first focused run correctly surfaced cascading CPT findings, 37/37 focused BN validation tests covered one table per node, target/parent alignment, parent order, complete row combinations, row state/value dimensions, finite bounded probabilities, and sums within `1e-9`; all 481 interface tests passed with 100% validator coverage, plus Prettier, type check, lint, and `git diff --check` | Passed |
| 2026-08-20 | Validate BN evidence states | 43/43 focused BN validation tests covered empty/valid evidence, dangling and ambiguous nodes/states, state ownership, one observation per node, optional aggregate context, and addressable issue contracts; all 487 interface tests passed with 100% validator coverage, plus Prettier, type check, lint, and `git diff --check` | Passed |
| 2026-08-20 | Validate HCL true-state selections against the BN | 51/51 focused BN validation tests covered BN model/node resolution, non-empty and duplicate-free selections, state ownership/ambiguity, proper-subset enforcement (never all node states), aggregate context, and addressable issue contracts; all 495 interface tests passed with 100% validator coverage, plus Prettier, type check, lint, and `git diff --check` | Passed |
| 2026-08-20 | Complete focused BN validation tests | 55/55 focused BN validation tests covered every planned BN rule and policy integration, proving the same incomplete BN remains draft-saveable but analysis-blocked, a clean BN is quantifiable, and evidence/HCL context participates in the decision; all 499 interface tests passed with 100% statement/branch/function/line coverage for the BN validator, plus Prettier, type check, lint, and `git diff --check` | Passed |
| 2026-08-20 | Validate ET starting node and complete paths | 9/9 focused ET validation tests covered required/catalogue-resolved initiating events, required and contiguously ordered functional events, full ordered sequence paths, duplicate paths, complete binary branch coverage, aggregate validation, and addressable issues; all 508 interface tests passed with 100% statement/branch/function/line coverage for the ET validator, plus Prettier, type check, lint, and `git diff --check` | Passed |
| 2026-08-20 | Require reachable ET end states | 16/16 focused ET validation tests covered resolved/dangling/ambiguous end-state references, every declared end state's reachability, transfer-result exclusion, aggregate findings, and addressable issue contracts; all 515 interface tests passed with 100% ET-validator coverage, plus Prettier, type check, lint, and `git diff --check` | Passed |
| 2026-08-20 | Validate ET FT references and initiating-event frequency | 26/26 focused ET validation tests covered required/finite/non-negative frequencies, exactly one FT link per functional event, dangling/ambiguous functional-event and top-gate resolution, catalogue context, aggregate findings, and addressable issues; all 525 interface tests passed with 100% ET-validator coverage, plus Prettier, type check, lint, and `git diff --check` | Passed |
| 2026-08-20 | Validate ET transfer targets and loops | A TypeScript narrowing loss caught after the first 34/34 runtime pass was corrected before completion; 35/35 focused ET validation tests then covered target model/sequence resolution, internal and cross-model transfers, self/two-model loops, shared terminal targets, aggregate findings, and addressable issues; all 534 interface tests passed with 100% ET-validator coverage, plus Prettier, type check, lint, and `git diff --check` | Passed |
| 2026-08-20 | Require unique, traceable ET sequences | 40/40 focused ET validation tests covered stable UUID sequence identities, trimmed case-insensitive analyst-code uniqueness, aggregate findings, and addressable issue contracts; all 539 interface tests passed with 100% ET-validator coverage, plus Prettier, type check, lint, and `git diff --check` | Passed |
| 2026-08-20 | Complete focused ET validation tests | 44/44 focused ET validation tests covered every planned ET rule and policy integration, proving the same incomplete ET remains draft-saveable but analysis-blocked, a clean ET is quantifiable, and supplied reference catalogues participate in the decision; all 543 interface tests passed with 100% statement/branch/function/line coverage for the ET validator, plus Prettier, type check, lint, and `git diff --check` | Passed |
| 2026-08-20 | Mirror the method-by-method backend structure | A focused Nest test proved the registered parent module composes separate shared, FT, BN, ET, and HCL modules; all 270 backend unit tests passed and the new module tree had 100% coverage, with backend type check, official Nx lint, and Prettier checks passing. An initial directory-form ESLint command was rejected before linting, so it was replaced by the repository lint target | Passed |
| 2026-08-20 | List project models by method type | Added the authenticated `GET /projects/:projectId/method-models?methodType=…` metadata endpoint, project-access gate, compound project/type query, stable recency ordering, storage schema/index, and strict list-response contract. The first HTTP test exposed duplicate Nest resolution that converted invalid queries to 500; aligning the unit Jest mapper with the existing e2e mapper restored the required 400 behavior. All 5 focused backend tests, 42 shared-contract tests, 544 interface tests, and 274 backend tests passed; both projects passed type check/lint/Prettier and the backend development build plus `git diff --check` passed | Passed |
| 2026-08-20 | Create, load, and dependency-gate deletion of method models | Added discriminated FT/BN/ET/HCL create and persisted-model contracts, schema-valid empty draft factories, server UUID/revision/audit initialization, duplicate-code conflicts, project/actor consistency, viewer restrictions, project-scoped load, typed storage, and deletion checks across all current cross-model reference paths. The first backend run rejected `SchemaTypes.Mixed`, so storage was changed to the repository-supported `type: Object`; a real Mongo test then proved create/list/load/delete round trips and HCL→BN deletion blocking. Verification passed with 62 focused interface cases, 18 focused backend unit cases, 2 Mongo persistence cases, all 551 interface tests, all 290 backend tests, production type checks, lint/Prettier, backend development build, and `git diff --check`. The broader backend test-source type check still has 11 unrelated pre-existing errors after the new test's sole error was fixed. Verification also found and fixed a Windows backslash glob that had made interface lint a no-op from the repository root | Passed |
| 2026-08-20 | Patch only a changed field or structure | Added discriminated FT/BN/ET/HCL patch contracts and authenticated `PATCH /projects/:projectId/method-models/:modelId`. The service atomically `$set`s only supplied domain paths plus audit fields, updates duplicated query metadata only when relevant, increments both stored revisions, preserves omitted fields, and rejects viewer access, identity/method mismatches, duplicate codes, and stale or racing revisions. A real Mongo round trip proved a name-only patch persisted revision 2 while preserving code and gates. All 67 focused interface cases, 25 focused backend cases, 556 interface tests, and 295 backend tests passed; production type checks, uncached lint, Prettier, backend development build, and `git diff --check` passed, while the broader test-source type check retained only its same 11 unrelated baseline errors | Passed |
| 2026-08-20 | Validate drafts and analysis readiness | Added typed FT/BN/ET/HCL validation requests and the authenticated validation endpoint, dispatching stored models through their method validators with project reference context, request identity/revision checks, and identical draft-versus-analysis findings. Added HCL semantic validation for BN/FT resolution, FT requirement/readiness, bound basic events, and BN true-state rules. Focused tests proved invalid drafts stay saveable while the same errors block analysis, and real Mongo tests exercised all four method dispatch paths. All 564 interface tests and 299 backend tests passed, with production type checks, uncached lint, Prettier, backend development build, and `git diff --check`; broader test-source type checking retained only its same 11 unrelated baseline errors | Passed |
| 2026-08-20 | Create an analysis run and retrieve its status and results | Added aggregate FT/BN/ET/HCL execute and result contracts, including HCL top-gate selection, plus durable `method_analysis_runs` storage and authenticated create, status, and result routes. Run creation rejects invalid or stale revisions and invalid method-specific selections, preserves the validated project-model snapshots for reproducible worker execution, and returns queued metadata. Result retrieval remains unavailable until success and cross-validates method, run, model, revision, and completion identity. Focused controller/service tests and a real Mongo lifecycle covered queued persistence, status, result gating, successful typed retrieval, BN query selection, and HCL FT/top-gate resolution. All 570 interface tests and 309 backend tests passed, with production type checks, uncached lint, Prettier, backend development build, and `git diff --check`; broader test-source type checking retained only its same 11 unrelated baseline errors | Passed |
| 2026-08-21 | Find models and workbooks that reference another model | Added the authenticated `GET /projects/:projectId/method-models/:modelId/dependencies` endpoint and a strict response contract listing every live project model and workbook that contains a controlled `{ modelId }` reference, with escaped JSON-pointer paths for UI navigation. Dependency discovery scans current model payloads and workbook MEFs through the shared element-adapter registry, ignores immutable analysis-run snapshots, enforces project scope, returns deterministic ordering, and now powers deletion conflicts for both resource kinds. Focused contract, controller, service, and real Mongo tests covered multiple paths, unrelated references, missing/foreign adapters, persisted model links, persisted workbook links, and deletion blocking. All 571 interface tests and 313 backend tests passed, with production type checks, lint, backend development build, and `git diff --check`; the broader test-source type check retained only its same 11 unrelated baseline errors | Passed |
| 2026-08-21 | Add backend permission tests | Added an explicit permission matrix across all ten method-model backend operations. Focused service tests prove viewers can list, load, validate, discover dependencies, and retrieve run status/results; viewers are blocked before storage access from create, patch, run, and delete; owners and editors can use every write operation; and users without project access receive concealed not-found responses without model, workbook, or run queries. Focused HTTP tests also prove unauthenticated requests return `401` before delegation and project-role write failures return `403`. The first focused run correctly caught a requester/authenticated-user mismatch in the viewer fixture; after correction, 45/45 focused tests and all 320 backend tests passed, with production type check, lint, Prettier, backend development build, and `git diff --check`; the broader test-source type check retained only its same 11 unrelated baseline errors | Passed |
| 2026-08-21 | Create `apps/solvers/praxis-node` as a NAPI-RS addon | Added a private Nx workspace package with a NAPI-RS `cdylib`, Node-API 9 configuration, locked Rust and JavaScript dependencies, explicit Windows x64 MSVC and Linux x64 GNU package targets, a platform loader, and an intentionally empty native export surface so later solver-boundary TODOs remain separate. Debug and optimized Windows native builds both loaded successfully; the Node smoke test passed through direct and package-script execution; Cargo format, strict Clippy, and test-profile checks passed; Nx discovered the project; Prettier and `git diff --check` passed. The first Rust check caught only formatter-required trailing blank-line removal, and the first `pnpm dlx` attempt required selecting the package's `napi` executable explicitly before the successful build | Passed |
| 2026-08-21 | Use Node-API and depend directly on the PRAXIS Rust crate | Added the local PRAXIS crate as a direct Cargo path dependency beside the Node-API 9 bindings, without introducing request parsing or public solver functions ahead of their separate TODOs. A committed Cargo-metadata test proves the addon directly resolves `../praxis` at the NAPI boundary; strict Clippy compiled the complete graph successfully, including PRAXIS and its TensorBayes dependency; and a fresh optimized Windows addon build loaded with both smoke tests passing 2/2 | Passed |
| 2026-08-21 | Use TensorBayes through PRAXIS | Kept TensorBayes out of the addon's direct dependencies and documented the solver boundary. A resolved Cargo-graph test proves `praxis-node` has no TensorBayes edge while the local PRAXIS package resolves the local `../tensorbayes` crate. After the first combined check caught and corrected only Prettier wrapping in the new test, strict Clippy, an optimized Windows native rebuild, Prettier, and all three addon/architecture tests passed | Passed |
| 2026-08-21 | Accept versioned JSON requests and return versioned JSON results | Added a private, documented `1.0.0` solver transport that strictly parses a camel-case envelope containing the backend's typed request and immutable model snapshots without rewriting their inner JSON, and serializes successful values inside a versioned result envelope. Focused Rust tests cover current-version payload preservation, unknown-version rejection, missing-field rejection, unknown-envelope-field rejection, and exact result shape. The first verification run corrected only Rust formatter output; all 3 transport tests, all 3 native package/architecture tests, Cargo format, strict Clippy, an optimized Windows rebuild/load, Prettier, and `git diff --check` then passed. A documented, module-scoped dead-code allowance keeps this private staged boundary warning-clean until the later NAPI-export TODO wires it in | Passed |
| 2026-08-21 | Return structured validation and solver errors | Added documented, versioned error JSON with distinct `VALIDATION_ERROR` and `SOLVER_ERROR` kinds, stable upper-snake-case machine codes, human-readable messages, parse line/column details, expected/received schema-version details, and an exhaustive mapping for every current PRAXIS error family. The first verification run corrected only canonical Rust formatting; all 5 Rust transport/error tests, all 3 native package/architecture tests, Cargo format, strict Clippy, an optimized Windows rebuild/load, Prettier, and `git diff --check` then passed | Passed |
| 2026-08-21 | Expose only `validate(requestJson)` and `execute(requestJson)` publicly | Added the two synchronous JSON NAPI entry points and regenerated declarations that contain only those functions. `validate` currently verifies and acknowledges the transport envelope; `execute` validates the envelope and explicitly returns structured `PRAXIS_ILLEGAL_OPERATION` until a method-specific adapter is connected by its later vertical-slice task, avoiding a false solver-success response. The first Rust compile caught NAPI-RS's requirement that `module_exports` spell `Result` directly rather than through an alias; after correction, all 5 Rust boundary/error tests, strict Clippy, an optimized Windows rebuild, all 5 native addon/export/dependency tests both directly and through the workspace package script, Prettier, and `git diff --check` passed. Generated TypeScript declarations show exactly `validate(requestJson: string): string` and `execute(requestJson: string): string` | Passed |
| 2026-08-21 | Load the addon in a Praetor worker | Added `praxis-node` as a Praetor workspace dependency, a dedicated worker script that is the only place the native package is loaded, and a lifecycle-safe runner for `validate` and `execute`. The runner resolves paths on the caller thread but executes native calls only in `worker_threads`, validates result messages and positive worker IDs, terminates cleanly, and propagates worker-reported/system/early-exit failures. Praetor's test target now builds the addon first. After correcting the first unit run's non-constructible Vitest arrow mock, all 11 focused tests passed, including two real native calls whose worker IDs differed from the calling thread. Praetor production typecheck/build, Nx project resolution, Prettier, and `git diff --check` passed; an additional call through the compiled Nest output returned from worker thread 1. The full legacy Praetor suite still has 26 unrelated pre-existing failures in untouched tests for missing manager, sequence, storage, queue, and controller APIs, while both new worker suites remained green | Passed |
| 2026-08-21 | Build and load the addon on Windows | Added repeatable `build:windows` and `test:windows` scripts. The test requires Windows x64, verifies the exact `praxis-node.win32-x64-msvc.node` artifact exists, loads that binary directly rather than through the platform loader, enforces the two-function export surface, and exercises both validation success and structured execution-error paths. The first run corrected only Prettier output; the explicit optimized `x86_64-pc-windows-msvc` build, direct-binary test, dedicated workspace script, all 5 cross-platform addon tests, Prettier, and `git diff --check` then passed | Passed |
| 2026-08-21 | Build and load the addon on Linux | Added repeatable `build:linux` and `test:linux` scripts plus a Linux-x64-only test that requires the exact `praxis-node.linux-x64-gnu.node` artifact, loads it directly, enforces the two-function surface, and exercises validation success and structured execution-error paths. A clean Node 22 Debian container with Rust 1.93 compiled PRAXIS, TensorBayes, and the addon in release mode and passed the direct GNU-binary test. The first container compilation completed but NAPI-RS's final atomic transaction failed on the Windows bind mount; its remnants were removed and the full build/test was rerun successfully on native ephemeral Linux storage. The regenerated official cross-platform loader and Windows binary then passed all 6 Windows addon/direct-load regressions, with Prettier and `git diff --check` passing | Passed |
| 2026-08-21 | Verify Docker addon packaging | Updated the existing Praetor multi-stage Dockerfile to install pinned Rust 1.93, pin repository pnpm 10.13.1, build the Linux addon, and copy only its package metadata, generated loader/declarations, and GNU release binary into the runtime image. Tightened `.dockerignore` so local Cargo targets and nested build/module directories are excluded, reducing the context from roughly 405 MB to 242 KB. The first image build exposed and fixed the existing unpinned-Corepack failure where pnpm 11 could not run on Node 20. The complete image then built successfully. Runtime inspection proved the package contains exactly four intended files and directly loads with only `validate`/`execute`; a second clean container invoked the packaged addon through Praetor's compiled worker with default package resolution and returned from worker thread 1 | Passed |
| 2026-08-21 | Persist the FT catalogue and dispatch durable analysis runs | Added authenticated catalogue create/load/update persistence, immutable catalogue snapshots on runs, web-backend-to-Praetor dispatch, and durable `QUEUED`/`RUNNING`/`SUCCEEDED`/`FAILED` transitions with structured failures. Focused service and persistence tests cover catalogue identity, project permissions, lifecycle transitions, malformed solver responses, stale revisions, result gating, and successful retrieval; the final backend suite passed 339/339 | Passed |
| 2026-08-21 | Execute exact FT and BN analyses through API calls | Added production FT and BN native adapters. FT versioned API fixtures prove exact AND `0.02`, OR `0.28`, shared-event `0.25`, 2-of-3 `0.5`, NOT/complement `0.8`, cut-set ordering, and complemented literals. The authenticated backend API persists and retrieves OR `0.28` with leading cut sets `[0.2, 0.1]`; BN evidence returns the exact posterior `[0.36, 0.64]` through PRAXIS/TensorBayes | Passed |
| 2026-08-21 | Execute exact HCL-linked FT analyses through API calls | Added HCL snapshot parsing, FT-to-BN bindings, base evidence, solver settings, and exact PRAXIS HCL dispatch. The authenticated API and the production Docker endpoint both return the correlated AND probability `0.16`, explicitly distinct from independent multiplication `0.048`; the full PRAXIS HCL bridge/equivalence suites also cover complete BDD path context, unbound-event probabilities, evidence changes, multistate bindings, and cache invariance | Passed |
| 2026-08-21 | Execute independent and HCL event-tree analyses through API calls | Added sequence-formula construction, one BDD per sequence, Boolean success complements, shared basic-event identity, initiating-frequency scaling, end-state aggregation, transfer-chain resolution/loop rejection, and a reusable compiled BN context for HCL sequences. Authenticated API tests return independent `[0.72, 0.28]` with annual frequencies `[0.0072, 0.0028]` and correlated HCL `[0.84, 0, 0, 0.16]` with end-state totals `[0.0084, 0.0016]`; native dependency fixtures prove shared-event sequences `[0.8, 0, 0, 0.2]` rather than multiplied branch marginals | Passed |
| 2026-08-21 | Complete the backend-first quantification gate | The final authenticated HTTP suite passed 4/4 across FT, BN, independent ET, HCL FT, and HCL ET; the native suite passed 14/14, addon suite 7/7, interface suite 580/580, backend suite 339/339, and the full PRAXIS Cargo suite passed, including 635 library tests and all integration binaries. Interface/backend typechecks and lints, backend build, strict production PRAXIS Clippy, strict all-target native Clippy, scoped Rust formatting, and source-format checks passed | Passed |
| 2026-08-21 | Verify the complete current path on Windows, Linux, and Docker | Windows authenticated e2e starts the real Praetor native service and worker before executing all methods. A clean production Docker build compiled the current Linux GNU addon and Praetor service; the running packaged `/q/praxis/native/execute` endpoint, backed by the packaged worker, returned FT `0.28`, BN `[0.36, 0.64]`, independent ET `[0.8, 0.2]`, HCL FT `0.16`, and HCL ET `[0.84, 0, 0, 0.16]`. The reproducible HTTP smoke also asserts the AND, shared-event, K-of-N, and complemented FT fixtures. Temporary verification containers and their network were removed afterward | Passed |
