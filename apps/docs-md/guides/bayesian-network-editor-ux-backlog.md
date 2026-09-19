# Bayesian-network editor UX backlog and interaction inventory

## Purpose

This document tracks the work that remains for the Bayesian-network (BN) and dependency sections in Systems Analysis (SY) and Event Sequence Quantification (ESQ). Completed ownership, layout, linked-model discovery, analysis, and result-presentation work has been removed from the backlog.

## Working rules

- Keep one canonical `BayesianNetworkEditor` implementation under `newly-developed-methods/bayesian-network`.
- Treat model ownership, editing permission, and where a model is displayed as separate decisions.
- Do not hide a saved BN merely because an FT, ET, or HCL connection is incomplete.
- Incomplete models must remain editable and saveable; validation should block analysis, not drafting.
- Place controls according to their scope: network actions, canvas actions, node actions, evidence, analysis, and results must not be mixed together.
- Prefer progressive disclosure. Common actions should be immediately understandable, while CPT details, batch evidence, HCL settings, and provenance may open only when needed.
- Keep old workbooks usable while ownership and storage are migrated.

## Remaining tasks

### BN usability verification

- [ ] Finish reviewing the remaining interactions in the BN manual-test guide.
- [ ] Verify the empty, editing, validation, running, result, failure, and read-only states in both SY and ESQ.
- [ ] Verify complete workflows with small and genuinely large networks at wide and narrow viewport sizes.
- [ ] Add focused browser regressions for the accepted interactions and layouts.

### Dependency ownership migration

- [ ] Automatically migrate existing ESQ-owned BN/HCL data to the SY-owned dependency model without requiring users to reload examples or rebuild configurations.

### Reusable BN module hardening

- [ ] Define how module-template changes propagate to existing instances and how incompatible changes are reported.
- [ ] Decide whether users may detach an instance into ordinary nodes and how detachment affects traceability.
- [ ] Validate module import/export and submodel preservation with representative XDSL files.
- [ ] Add a large-model interaction test using multiple module instances.

### Remaining dependency and HCL functionality

- [ ] Detect independent dependency components automatically so unrelated BN regions can be compiled and solved separately.
- [ ] Add scale, numerical-parity, typed-frequency, and dissertation-source regression suites.
- [ ] Add the remaining HCL sensitivity results if they remain in product scope.

### Workbook connection and hardening backlog

- [ ] Add **Open linked model** actions that navigate to the owning workbook and exact FT, ET, BN, or HCL entity.
- [ ] Add explicit **Use this run** actions for downstream controlled results.
- [ ] Ensure rerunning an analysis never silently replaces a controlled workbook result.
- [ ] Add workbook-reference, run-selection, save-on-blur, partial-patch, revision-conflict, and permission tests.
- [ ] Remove obsolete routes, components, styles, adapters, and legacy storage only after every saved workbook has a safe migration path.
- [ ] Complete the remaining connected example and verified-result hardening work.

### Deferred work

- [ ] Define acceptance criteria for importing the larger MHTGR SAPHIRE model.
- [ ] Import the MHTGR model only after the BN, FT, ET, and HCL workflows are accepted.
- [ ] Validate the imported model's identities, logic, probabilities, dependencies, and results against its source.

## People and usage modes

The design must support three common modes without creating three different editors:

1. **Author** — builds and changes nodes, states, relationships, CPTs, evidence, modules, and applicable HCL settings.
2. **Analyst** — selects evidence and targets, runs exact BN or HCL calculations, and interprets results.
3. **Reviewer** — inspects the model, validation findings, inputs, results, and provenance without changing the saved model.

A person may move between these modes during one workflow, subject to workbook permissions.

## End-to-end user journeys

### 1. Build a small BN from scratch

1. Open the dependency section and see either the selected network or a concise empty state.
2. Create a network and enter its code and name.
3. Add nodes from the canvas.
4. Give each node a code, name, and discrete states.
5. Connect parent nodes to child nodes by dragging between visible connection points.
6. Review or change parent order where CPT row ordering depends on it.
7. Enter CPT probabilities and correct invalid rows.
8. Arrange the graph manually or run automatic layout.
9. Save, reload, and confirm that graph structure, positions, states, and CPTs are unchanged.
10. Resolve validation errors and run an exact query.

### 2. Import and inspect a large BN

1. Choose **File → Import XDSL** or **File → Import JSON**.
2. Review an import summary before replacing or adding a network.
3. See unsupported constructs, renamed identifiers, submodels, metadata, and validation issues clearly.
4. Navigate the large graph using pan, zoom, fit, search, and submodel/module focus.
5. Inspect nodes and CPTs without the inspector resizing or hiding the graph.
6. Save the imported network and export it without losing supported metadata or submodel structure.

### 3. Reuse a BN module

1. Select a validated branch or submodel and save it as a reusable module.
2. Define which nodes are module inputs and which internal nodes remain encapsulated.
3. Add an instance of the module to a network.
4. Map each required module input to a compatible node in the host network.
5. See validation feedback for missing, incompatible, or cyclic mappings.
6. Reuse the module multiple times without duplicating manual CPT work.
7. Understand whether an instance follows template updates or has been detached.

### 4. Run an exact BN query

1. Choose a query node.
2. Add zero or more evidence observations by selecting one state for each observed node.
3. Review a compact summary of the active evidence.
4. Run exact inference.
5. See the posterior distribution for the query node, with state labels and probabilities.
6. Change or clear evidence and immediately see that the old result is stale.
7. Inspect validation or solver failures without losing the model or entered evidence.

### 5. Quantify an FT dependency in SY

1. Select the BN used to model dependencies among FT basic events.
2. Select the relevant fault trees or discover them from existing bindings.
3. Map each FT basic event to one BN node and the BN state or states that mean the event occurred.
4. Review missing, contradictory, or unusable bindings.
5. Define common evidence, optional evidence scenarios, and applicable solver settings.
6. Select a top event and run HCL quantification.
7. See the top-event probability and structural minimal cut sets quantified under the selected BN evidence.
8. Expand a cut set to inspect its BN conditions, ancestors, and root causes without changing its structural FT identity.

### 6. Quantify an ET dependency in ESQ

1. Select an event tree.
2. See every fault tree reached through functional-event links and transfer chains.
3. See which SY dependency configuration and BN affect those linked fault trees.
4. Inspect the BN without losing the ET target or linked-FT context.
5. Choose common evidence, scenarios, or a hazard grid.
6. Run HCL ET quantification without manually reselecting fault trees already linked by the ET.
7. See every sequence's conditional probability and annual frequency.
8. Inspect sequence-level HCL cut sets, including complemented success literals and omitted bypassed events.
9. See end-state aggregates and leading contributors where available.
10. Confirm that success, failure, and bypassed functional events are represented correctly.

### 7. Run many evidence cases

1. Add scenarios manually or import JSON/CSV evidence in bulk.
2. Validate node codes, state codes, duplicate scenarios, and incomplete hazard-grid cells before running.
3. Enable or disable scenarios without deleting them.
4. Let the application identify the FT and ET targets that can actually change under the varying evidence.
5. Run the selected scenario set while reusing compiled solver structures where possible.
6. Compare scenario results and identify cases with no numerical change.
7. If a hazard grid is enabled, see grid weights, covered probability, annualization, and integrated frequencies.
8. Export or retain the batch results with their evidence and provenance.

### 8. Review and reuse an analysis result

1. Open a completed run from the owning workbook.
2. See the exact BN, FT, ET, HCL configuration, evidence, workbook revisions, and solver settings used.
3. Distinguish the current model from the immutable model snapshot used by the run.
4. See whether the result is current or stale relative to the workbook.
5. Explicitly select a run for downstream use rather than having a rerun replace it silently.
6. Navigate from a result to its linked source model and back.

## Detailed interaction inventory

| Area | User interaction | Required response | Main input or output |
| --- | --- | --- | --- |
| Entry | Open the dependency section | Show the last selected BN, or a concise empty state with one clear next action | Network list or empty state |
| Network selection | Choose another BN | Replace the graph, inspector, evidence, validation, and results together | Selected network |
| Network creation | Create a BN | Create one empty saved model and focus its identity fields | Code and name |
| Network identity | Rename or recode a BN | Validate uniqueness and preserve its stable ID | Network metadata |
| Network deletion | Delete a BN | Explain affected HCL configurations, bindings, modules, and runs before confirmation | Impact summary |
| Canvas navigation | Pan, zoom, or fit | Move or scale graph content without resizing the editor | Viewport only |
| Canvas search | Search for a node | Focus and visibly select the matching node | Node code or name |
| Layout | Run auto-layout | Arrange nodes without changing BN semantics or CPT parent order | Node positions |
| History | Undo or redo | Revert or restore one meaningful editor operation | Draft model history |
| Node creation | Add a node | Place a new node visibly and open its inspector | Node identity and default states |
| Node selection | Left-click a node | Select it and show one inspector; do not open a context menu | Node details |
| Node movement | Drag a node | Move only that node and preserve connections | Node position |
| Node context | Right-click a node | Show applicable contextual actions without also changing panels unexpectedly | Context menu |
| Node deletion | Delete a node | Explain edge, child-CPT, binding, module, evidence, and query impacts | Impact summary |
| States | Add, rename, reorder, or delete a state | Warn before rebuilding affected CPTs; never reinterpret old probabilities silently | State list |
| Relationships | Drag from one node to another | Reveal legal docking points, reject cycles/self-links, and confirm the candidate visually | Directed edge |
| Relationship removal | Right-click an edge and delete it | Remove the parent and rebuild the child CPT only after confirmation | Parent list and child CPT |
| Parent order | Reorder parents | Update CPT row ordering predictably without changing probability meaning | Ordered parent IDs |
| CPT editing | Enter probabilities | Accept numeric input and show row total and validity immediately | CPT values |
| CPT normalization | Normalize one row | Change only that row and show the resulting values | Normalized CPT row |
| CPT repair | Rebuild after structural change | Explain which CPTs will be reset and why | Rebuilt CPTs |
| File import | Import XDSL or JSON | Validate first, summarize changes, and preserve supported metadata/submodels | Imported BN |
| File export | Export XDSL or JSON | Export the selected network with stable IDs and supported metadata | Downloaded file |
| Modules | Save a branch as a module | Validate its boundary and expose required inputs | Module template |
| Module instances | Add or remove an instance | Require compatible input mappings and preserve instance identity | Module instance |
| Evidence | Search for a node and select a state | Allow at most one observed state per node and summarize active evidence | Evidence observations |
| Evidence reset | Clear one or all observations | Remove evidence and mark old inference/HCL results stale | Updated evidence |
| Batch import | Import CSV or JSON scenarios | Match node/state codes, report row errors, and preview the import | Scenario set |
| Scenario management | Enable, disable, edit, or delete a scenario | Validate without forcing immediate execution | Enabled scenarios |
| Hazard grid | Define dimensions and weights | Require unique cells and explain missing dimensions before enablement | Weighted evidence grid |
| Exact query | Select a query node and run | Validate the BN and return its posterior distribution | State probabilities |
| FT inclusion | Select an FT in SY | Show its code, top event, and relevant basic events | FT reference |
| HCL binding | Map an FT basic event to BN occurrence states | Reject zero or all states and show the mapping in plain language | Typed HCL binding |
| HCL uncertainty | Assign a distribution to an unbound FT basic event or a Dirichlet effective sample size to a BN CPT row | Validate the source, sample count, and seed before execution | PRAXIS uncertainty settings |
| ET selection | Select an ET in ESQ | Derive and display linked FTs and transfer targets automatically | ET and FT references |
| HCL FT run | Quantify a top event | Return dependency-aware top-event probability and run metadata | FT HCL result |
| HCL ET run | Quantify an event tree | Return sequence probabilities, annual frequencies, and end-state aggregates | ET HCL result |
| HCL cut sets | Expand a completed HCL result | Show structural literals, exact PRAXIS joint probability, coverage, BN conditions, ancestors, and root causes | HCL cut-set analysis |
| HCL uncertainty results | Run HCL with uncertainty enabled | Show mean, standard deviation, and 5th, 50th, and 95th percentiles for FT probabilities or ET annual frequencies | Sampled PRAXIS result summary |
| Results | Expand result details | Keep a compact summary first and reveal tables or provenance on demand | Analysis result |
| Validation | Select a finding | Focus the affected node, edge, CPT, binding, scenario, or target | Validation issue |
| Save | Pause after an edit or leave a field | Persist a minimal revisioned patch and expose saving, saved, or conflict status | Workbook revision |
| Conflict | Encounter a stale revision | Preserve local work and offer a clear reload/reconcile path | Conflict details |
| Solver failure | Praetor or PRAXIS is unavailable | Show a styled actionable failure without clearing inputs or the previous successful run | Structured failure |
| Read-only mode | Review without edit permission | Preserve navigation, inspection, validation, results, and provenance while hiding mutation actions | Read-only model |
| Accessibility | Use keyboard or assistive technology | Provide focus order, labels, keyboard alternatives, and non-color-only status cues | Accessible interaction |
| Large models | Open hundreds or thousands of nodes | Remain responsive through search, modules/submodels, focused rendering, and component-aware solving | Scalable model view |

## Inputs the user must be able to provide

- Network code, name, and optional description.
- Discrete node codes, names, descriptions, and states.
- Directed parent-child relationships and parent order.
- Conditional probability tables.
- XDSL or OpenPRA JSON model files.
- Reusable module definitions and instance input mappings.
- A query node.
- Common evidence or many evidence scenarios through UI, JSON, or CSV.
- Hazard-grid dimensions, weights, and annual-frequency semantics where applicable.
- FT basic-event-to-BN-state bindings.
- Optional basic-event probability distributions and BN CPT-row effective sample sizes, plus sample count and seed.
- The FT top event or ET target when it is not already implied by the host workflow.
- Solver settings that are genuinely necessary for the supported calculation.

## Outputs the user should receive

- Immediate structural, CPT, evidence, binding, and target validation.
- Exact BN posterior probabilities by state.
- HCL FT top-event probability.
- HCL probability and annual-frequency uncertainty summaries with reproducible sampling metadata.
- HCL-aware structural minimal cut sets with exact conditional probabilities and causal BN trace metadata.
- HCL ET sequence conditional probabilities and annual frequencies.
- End-state aggregate frequencies and leading contributors where supported.
- Scenario comparison and hazard-convolution summaries.
- Clear stale-result status after an input changes.
- Structured calculation failures with an actionable explanation.
- Immutable run provenance identifying all input models, entities, revisions, evidence, and settings.
- Exportable BN models and, where approved, exportable evidence or result tables.

## Remaining execution sequence

1. Finish the manual interaction review and address any remaining usability findings.
2. Verify all editor states with small and large networks at wide and narrow viewport sizes.
3. Add the missing browser-level regressions.
4. Complete automatic migration of legacy ESQ-owned dependency data.
5. Define and verify the remaining reusable-module lifecycle behavior.
6. Implement independent-component detection and the remaining regression suites.
7. Implement the approved remaining HCL sensitivity capabilities.
8. Complete workbook-result controls, legacy cleanup, connected-example hardening, and the deferred MHTGR import when those items enter scope.
