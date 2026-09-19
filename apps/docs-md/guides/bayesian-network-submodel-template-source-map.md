# BN submodels and template copying: source map

These features are separate. Submodels change the visible grouping of an existing BN. Templates create new BN nodes, connections and CPTs. The user authorized generalizing HCL_MH's HRA template-copying behavior to arbitrary supported BN branches; this is not a claim that our entire reusable-template system is an identical HRA-builder port.

## Visual submodels

| Behavior | HCL_MH source | Application implementation |
| --- | --- | --- |
| Read nested GeNIe membership independently of CPTs | `resources/HCL_MH/utils/ft_gui_builder_pkg/bn/model.py`, `load_xdsl_model` / `walk_submodel` | `bayesianNetworkInterchange.ts`, `readBayesianNetworkSubmodels` |
| Show immediate child groups and directly owned nodes | `resources/HCL_MH/utils/ft_gui_builder_pkg/bn/panel.py`, `_gv_populate_modular` | `bayesianNetworkSubmodels.ts`, `createSubmodelOverview` |
| Aggregate cross-group edges and hide edges inside a collapsed group or outside the current scope | Same method, `owner_key` and `seen_edges` | Same projection helper; no BN edges are edited |
| Open groups, Scope, Home and Back | `bn/panel.py`, `_on_canvas_double_click`, `_on_scope_changed`, `_go_home_scope`, `_go_parent_scope` | `bayesianNetworkEditor.tsx` (shared canvas and inspector) |
| Generate GeNIe submodels for existing nodes | `resources/HCL_MH/MH-BN/step0/export/xdsl_writer.py`, `_emit_genie_nodes_with_optional_layer_submodels` | `bayesianNetworkInterchange.ts` writes the same nested GeNIe structure for existing nodes and materialized template instances |

Application adaptations: one React BN editor supplies both views, with shared node cards, connections, inspector, zoom, drag and undo/redo. View and scope controls sit above the canvas. Manage groups creates, renames, reparents and dissolves groups; its node checkboxes and the inspector’s Group field assign existing nodes. These authoring controls are application UI additions using the source’s GeNIe metadata format. Grouping never changes node IDs, edges or CPTs. Imported empty groups remain valid. Removing a group lifts its nodes and child groups to its parent.

## Reusable templates

The reference is `resources/HCL_MH/MH-BN/network_builder/builders/hra.py`:

- `HraBuilder.build` creates separately identified copies and reconnects template parents to the corresponding copied nodes.
- `_load_template` reads the source states, ordered parents and CPT values.
- `_make_template_cpd_generator` checks that the parent set remains the same and remaps rows when parent order differs. Each conditional assignment retains its original probability.

Our existing `bayesianNetworkModules.ts` already copies nodes, states, edges and CPT assignments using ID maps. That code is retained. Its `cloneTable` maps explicit parent-state and child-state identifiers, so array order does not determine their meaning.

The corrected `bayesianNetworkOperations.ts/reorderParents` keeps those explicit assignments and changes the parent-axis order. Canonical export and the addon already arrange the values for the requested axis order. Shared module validation now accepts parent permutations while still rejecting missing, added, repeated or wrongly bound parents. The previous uniform reset and its confirmation were removed from parent reordering. Structural deletion still resets affected downstream CPTs and keeps its existing warning.

The frontend now exposes compatible external-input choices. Case-sensitive state-code matching and the prior integrity checks remain. Template defaults respect the existing name length limit.

Application generalizations: saving a selected branch and descendants, virtual input/output ports, explicit external-input bindings, UUIDs, workbook persistence, instance metadata and local probability editing. HCL_MH's HRA template file remains HRA-specific. We do not apply its inactive-CFM forcing, hazard-context overrides, feasibility gates or HFE output conversion to arbitrary nodes. No solver or addon code changed in this task.

## Reproducible checks

`apps/frontends/web-frontend/src/newly-developed-methods/bayesian-network/test/fixtures/hclMhSource.py` imports and executes the unchanged HCL_MH functions. It generates `hclMhSource.json` with source-file hashes and expected results for:

- all 68 CPTs in the original `Generic_HFE.xdsl`, with reversed parent order;
- four general BN CPTs, including mixed state counts and case-distinct state codes;
- four visual scopes, using HCL_MH's actual graph-generation method and a graph recorder.

`bayesianNetworkSourceParity.spec.ts` checks these results, copied branch instances, IDs, persistence, namespaced metadata and collapsed-group cycles. Editor tests check navigation, read-only access, input choice, preserved probabilities and Undo. Backend HTTP tests verify that saved module metadata accepts parent reordering and that native marginals are unchanged when parent/row order and visual metadata change.
