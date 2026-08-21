# HCL and MHTGR Editor Implementation Plan

This checklist governs the staged implementation of the fault-tree (FT), Bayesian-network (BN), and event-tree (ET) editors, followed by Hybrid Causal Logic (HCL) quantification. Importing the MHTGR model from SAPHIRE is future work and is not part of the active implementation scope.

## Working agreement

- A TODO may be checked only after its implementation has been verified.
- Prefer an automated test that is appropriately scoped to the completed TODO.
- When automation cannot establish that an interactive behavior works, stop and request a focused manual test before continuing to the next feature.
- Record the command and outcome, or the requested manual test and its outcome, in the verification log.
- Do not implement a batch of unrelated features and test them only afterward.
- Incomplete models must remain saveable; strict validation gates analysis, not drafting.

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
├── model-library/
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

The solver binding will live at `apps/solvers/praxis-node` as a NAPI-RS Node addon connecting the TypeScript services to PRAXIS and TensorBayes. Existing cross-cutting newly developed method metadata remains separate from the editor, transport, validation, and solver contracts above.

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

## Phase 1 — Shared method schemas

Complete schemas before frontend or backend implementation.

### Shared contracts

- [x] Create the `newly-developed-methods/shared` interface module and barrel exports.
- [x] Define stable model UUID, project ID, method type, analyst-facing code and name, and description.
- [x] Define schema version, model revision, ownership, and timestamps.
- [x] Define canvas layout metadata.
- [x] Define validation result contracts.
- [x] Define analysis-run metadata.
- [x] Enforce stable UUID references so renaming models or events does not break connections.
- [x] Add interface and Zod tests for shared contracts.

### Fault-tree contracts

- [x] Create the `newly-developed-methods/fault-tree` interface module and barrel exports.
- [x] Define the top gate and AND, OR, NOT, and K-of-N gates.
- [x] Define basic-event references, house events, undeveloped events, and transfer references.
- [x] Define gate-to-child relationships and display positions.
- [x] Define basic-event probability and optional controlled data-source references.
- [x] Define a project-level basic-event catalogue that preserves shared event identity across FTs.
- [x] Define versioned FT create, patch, validate, execute, and result contracts.
- [x] Add interface and Zod tests for FT contracts.

### Bayesian-network contracts

- [x] Create the `newly-developed-methods/bayesian-network` interface module and barrel exports.
- [x] Define discrete chance nodes with two or more states.
- [x] Define ordered parent references, directed edges, CPT values, and canvas positions.
- [x] Define evidence configurations, query requests, and marginal results.
- [x] Exclude decision, utility, deterministic, continuous, and dynamic nodes from the initial schema.
- [x] Define versioned BN create, patch, validate, execute, and result contracts.
- [x] Add interface and Zod tests for BN contracts.

### Event-tree contracts

- [x] Create the `newly-developed-methods/event-tree` interface module and barrel exports.
- [x] Define the initiating event and initiating-event frequency.
- [x] Define ordered functional events and FT top-event references.
- [x] Define success/failure paths, end states, and sequence identifiers.
- [x] Define event-tree transfers, HCL configuration references, and canvas layout.
- [x] Define versioned ET create, patch, validate, execute, and result contracts.
- [x] Add interface and Zod tests for ET contracts.

### HCL contracts

- [x] Create the `newly-developed-methods/hybrid-causal-logic` interface module and barrel exports.
- [x] Define BN and FT references.
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

## Phase 3 — Backend services

- [x] Mirror the method-by-method structure under the backend `newly-developed-methods` directory.
- [x] List project models by method type.
- [x] Create, load, and delete models; gate deletion with dependency checks.
- [x] Patch only a changed field or structure.
- [x] Validate drafts and analysis readiness.
- [x] Create an analysis run and retrieve its status and results.
- [x] Find models and workbooks that reference another model.
- [x] Add backend permission tests.

### Save behavior

- [ ] Keep typing local and save text on blur.
- [ ] Send only the changed path and value for field edits.
- [ ] Send only the structural operation for structural edits.
- [ ] Send only the new position when a node moves.
- [ ] Include the current revision in every patch.
- [ ] Return HTTP `409` for revision conflicts.
- [ ] Show `Saving`, `Saved`, or `Save failed` in the editor.
- [ ] Ensure no request is sent for every keystroke.
- [ ] Keep save logic method-local; do not introduce a shared save coordinator.
- [ ] Add save-on-blur, partial-patch, revision-conflict, and failure-state tests.

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

Do not begin editor frontend implementation until every method can complete a real analysis through API calls and return numerically verified results.

- [x] Connect the PRAXIS native addon worker to a versioned Praetor API endpoint.
- [x] Persist and expose the project-level FT basic-event catalogue so referenced probabilities are available to validation and execution.
- [x] Dispatch persisted method-model runs from the web backend to Praetor.
- [x] Persist `QUEUED`, `RUNNING`, `SUCCEEDED`, and `FAILED` run states and structured failures.
- [x] Execute an FT through the API and return its exact top-event probability and leading minimal cut sets.
- [x] Verify FT API results against hand-calculated AND, OR, shared-event, K-of-N, and complemented-event fixtures.
- [x] Execute a BN query through the API and return exact marginals.
- [x] Execute an HCL-linked FT through the API and return exact quantified results.
- [x] Execute independent and HCL ET analyses through the API and return sequence and end-state results.
- [x] Cover validation, malformed solver responses, permissions, revision conflicts, and result retrieval at API boundaries.
- [x] Record Windows, Linux, and Docker verification for the complete API-to-worker path.

## Phase 5 — Fault-tree vertical slice

Preserve the existing FT design and visual language. Use one flat inspector for the selected node; do not introduce a nested sidebar.

### Editing and viewing

- [ ] Create and rename an FT.
- [ ] Add gates and events.
- [ ] Connect and reparent nodes.
- [ ] Edit gate type safely.
- [ ] Edit K for K-of-N gates.
- [ ] Edit basic-event probabilities.
- [ ] Select an existing shared basic event.
- [ ] Configure house events.
- [ ] Add transfer references.
- [ ] Delete nodes or subtrees safely.
- [ ] Implement undo and redo.
- [ ] Implement manual positioning and automatic layout.
- [ ] Implement pan, zoom, and fit.
- [ ] Implement read-only viewer mode.

### Prototype limitations

- [ ] Replace local-only state with persistence.
- [ ] Connect the editor to the solver.
- [ ] Add strict validation.
- [ ] Remove invalid single-parent assumptions.
- [ ] Prevent unsafe destructive type changes.
- [ ] Indicate when displayed results are stale.

### Quantification and results

- [ ] Add the primary **Run analysis** action.
- [ ] Return exact top-event probability.
- [ ] Return minimal-cut-set count and leading cut sets.
- [ ] Return cut-set order and probability or contribution where valid.
- [ ] Return validation warnings and run details.
- [ ] Present results using normal text and tables rather than stat boxes.
- [ ] Add FT truth-table, cut-set, and shared-event tests.

### Interchange

- [ ] Import OpenPSA XML.
- [ ] Export OpenPSA XML.
- [ ] Keep advanced formats and extensive solver controls deferred.

### FT completion gate

- [ ] A user can create an FT.
- [ ] A user can save and reload it.
- [ ] A user can validate it.
- [ ] A user can quantify it.
- [ ] A user can review cut sets.
- [ ] A workbook can link to it without copying the model.
- [ ] The Playwright FT create/edit/reload/validate/run/link workflow passes.

Do not begin the BN vertical slice until every FT completion-gate item has passed verification.

## Phase 6 — Bayesian-network vertical slice

Use OpenPRA styling while adopting only the essential MAAT functionality.

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

Reuse the existing OpenPRA event-tree presentation under `newly-developed-methods/event-tree`.

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
- [ ] The Playwright ET create/edit/reload/validate/run/link workflow passes.

## Phase 8 — Workbook connections

Keep editors independent from workbook data structures and store only controlled references.

- [ ] Link SY workbooks to system FTs and top events.
- [ ] Link IE workbooks to initiating-event FTs.
- [ ] Link DA workbooks to basic-event parameters and probabilities.
- [ ] Link HRA workbooks to human-failure events and HEPs.
- [ ] Link ES workbooks to ETs and sequence definitions.
- [ ] Link ESQ workbooks to specific analysis runs.
- [ ] Link RC/RI workbooks to end-state and risk results.
- [ ] Link hazard PRA workbooks to hazard-conditioned models.
- [ ] Add **Open linked fault tree** and equivalent dedicated-editor actions.
- [ ] Add explicit **Use this run** actions for controlled workbook results.
- [ ] Ensure rerunning a model never silently overwrites controlled workbook results.
- [ ] Add workbook reference and run-selection tests.

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
| 2026-08-20 | Fetch latest `origin/main` | `git fetch origin main`; branch base resolved to `f6afbce0` (`docs: refine branding and disclosures (#166)`) | Passed |
| 2026-08-20 | Create feature branch | `git worktree add -b hcl_implementation_mhtgr_model_import ... origin/main`; branch tracks `origin/main` | Passed |
| 2026-08-20 | Create implementation checklist | `prettier --check apps/docs-md/guides/hcl-mhtgr-editor-implementation-plan.md` | Passed |
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
