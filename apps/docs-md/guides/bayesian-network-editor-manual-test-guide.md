### BN-01 — Empty state and create a network

1. Open **Systems Analysis → Step 05 Dependencies**.
2. If no BN exists, confirm the section shows only **Bayesian dependency network** and **Add network**.
3. Click **Add network** and inspect the empty canvas.
4. Click the large central **+** above **Add node to begin.**

Expected: the empty canvas shows the central **+** and **Add node to begin.**, with no zoom/fit/arrange control bar. After the first node is created, the regular canvas control bar appears.

### BN-02 — Create another network

1. Click **Add network** again.
2. Open the **Bayesian network** dropdown.

Expected: the new network is selected and both networks appear as `code · name` options.

### BN-03 — Switch networks

1. Open the **Bayesian network** dropdown.
2. Select a different network.

Expected: code, name, canvas, node selection, evidence, results, and undo history change to the selected network. Undo and redo history do not leak between networks.

### BN-04 — Rename the network

1. Edit **Network code**.
2. Edit **Network name**.
3. Click elsewhere and wait for **Saved**.

Expected: the network selector and exported file names reflect the new code/name.

### BN-05 — Undo and redo

1. Change the network name or move a node.
2. Click the curved-left **Undo** icon.
3. Click the curved-right **Redo** icon.

Expected: Undo restores the preceding editor state and enables Redo; Redo reapplies it. The buttons are disabled when their history stack is empty.

### BN-06 — Delete a network

Use only a disposable network.

1. Select the disposable network.
2. Click **Delete network**.
3. Review the styled confirmation dialog.
4. Click **Delete network** in the dialog.

Expected: the selected network and any HCL configurations attached to it are removed, then another network is selected. Cancel must leave everything unchanged.

## B. File import and export

### BN-07 — Export OpenPRA JSON

1. Select a network.
2. Click the **File** icon.
3. Click **Export JSON**.

Expected: the browser downloads `<network-code>.json`, including nodes, states, edges, CPTs, positions, layout, XDSL metadata, reusable module templates, and module instances.

### BN-08 — Export XDSL

1. Click **File → Export XDSL**.

Expected: the browser downloads `<network-code>.xdsl`. Discrete CPTs, parent order, probabilities, names, descriptions, positions, preserved XDSL extensions, and materialized module submodels are represented.

### BN-09 — Import valid JSON

Use a new disposable network.

1. Click **File → Import JSON**.
2. Choose `bn-editor-smoke-test.json` from the test kit.
3. In **Replace this Bayesian network?**, click **Replace network**.

Expected: the canvas becomes `HAZARD → SUPPORT → OUTCOME`, all row totals are `1.000000`, and no validation errors appear. Cancel must retain the original network.

### BN-10 — Import valid XDSL

1. Create or select another disposable network.
2. Click **File → Import XDSL**.
3. Choose `bn-editor-smoke-test.xdsl`.
4. Confirm **Replace network**.

Expected: the same three-node graph, state codes, parent order, CPT values, names, descriptions, and positions appear.

### BN-11 — Verify XDSL round trip

1. After BN-10, edit a node name and drag one node.
2. Click **File → Export XDSL**.
3. Import the downloaded XDSL into another disposable network.

Expected: the edits and positions survive the round trip, together with supported XDSL metadata.

### BN-12 — Reject unsupported XDSL safely

1. Select a disposable network and note its code.
2. Click **File → Import XDSL**.
3. Choose `invalid-bn-unsupported-decision.xdsl`.

Expected: a styled editor error says that only discrete CPT nodes are supported. The current network remains unchanged and no replacement confirmation appears.

## C. Canvas, selection, movement, and layout

### BN-13 — Add a node

1. Click the **Add node** icon in the canvas controls.

Expected: a new chance node is added, selected, and shown in the right inspector with two initial states and a uniform CPT.

### BN-14 — Select a node

1. Left-click a node card.

Expected: the node receives selected styling; the inspector and CPT below switch to that node. Clicking a node must not alter zoom or create an empty save operation.

### BN-15 — Move a node

1. Press and hold the left mouse button on the body of a node.
2. Drag it to a new position.
3. Release.

Expected: only that node moves, its edges track it, layout mode becomes manual, and the position persists after save/reload.

### BN-16 — Zoom out and in

1. Click **Zoom out** repeatedly.
2. Observe the percentage.
3. Click **Zoom in** repeatedly.

Expected: only graph content scales; the editor and inspector remain fixed. Controls disable at the minimum and maximum zoom limits.

### BN-17 — Fit the graph

1. Move nodes far apart or zoom in.
2. Click **Fit**.

Expected: the graph is scaled to fit the fixed viewport and the viewport returns to its top-left origin.

### BN-18 — Auto arrange

1. Move nodes into an untidy layout.
2. Click **Auto arrange**.

Expected: nodes are arranged according to graph direction and parent/child levels. Undo restores the previous manual arrangement.

### BN-19 — Page scrolling versus graph interactions

1. Put the pointer over the editor.
2. Scroll with a mouse wheel or two-finger touchpad gesture.
3. Then drag a node normally.

Expected: ordinary scrolling moves the workbook page, not the graph or zoom. Only direct drag and explicit zoom controls manipulate the graph.

## D. Connections and parent order

### BN-20 — Reveal connection docks

1. Hover a node.
2. Inspect its top, right, bottom, and left edges.

Expected: four connection points are available around the node.

### BN-21 — Create a directed edge

1. Press the left mouse button on any connection point of the intended parent node.
2. Drag toward the intended child node.
3. Move close to the child.
4. Confirm the candidate node highlights and its valid docking points appear.
5. Release on one of the active docking points.

Expected: a directed edge is created from parent to child, the child becomes selected, and the child CPT is rebuilt with one row per parent-state combination.

### BN-22 — Cancel an incomplete connection

1. Start dragging from a connection point.
2. Release on blank canvas or away from an active target dock.

Expected: no edge is created and no error toast is needed.

### BN-23 — Reject invalid connections

Try each case separately:

1. Drag a node to itself.
2. Try to create the same edge twice.
3. In `HAZARD → SUPPORT → OUTCOME`, try to connect `OUTCOME → HAZARD`.

Expected: self-edges, duplicate edges, and directed cycles cannot be docked and are not created.

### BN-24 — Delete an edge from its context menu

1. Right-click an edge.
2. Click **Delete connection**.

Expected: the edge disappears and the former child CPT is rebuilt for its remaining parents. Right-clicking an edge must not select a node or open the node inspector.

### BN-25 — Dismiss the edge context menu

1. Right-click an edge.
2. Press **Escape**, or click outside the menu.

Expected: the menu closes without changing the graph.

### BN-26 — Reorder multiple parents

1. Create a node with at least two parents.
2. Select the child.
3. Under **Relationships**, use the up/down buttons beside a parent.
4. Confirm **Rebuild CPTs**.

Expected: parent order changes in both the inspector and CPT columns. The CPT is rebuilt with uniform rows because its interpretation changed.

## E. Node identity and states

### BN-27 — Edit node identity

1. Select a node.
2. Edit **Code**, **Name**, and **Description** in the inspector.

Expected: code/name changes appear on the node card and in relevant selectors. Validation identifies blank or duplicate codes.

### BN-28 — Rename states

1. Select a node.
2. Edit each state’s code and name.

Expected: node-card state labels, CPT headers, evidence selectors, query results, and bindings use the edited state codes.

### BN-29 — Add a state

1. Click **Add state**.
2. Read the warning explaining that the node and every child CPT will be rebuilt.
3. Click **Rebuild CPTs**.

Expected: a new state appears and affected CPTs become uniform. Cancel leaves states and CPTs unchanged.

### BN-30 — Reorder states

1. Click a state’s up or down arrow.
2. Confirm **Rebuild CPTs**.

Expected: state order changes everywhere and affected CPTs are rebuilt. The first state cannot move up and the last state cannot move down.

### BN-31 — Delete a state

1. On a node with at least three states, click the state’s **×** button.
2. Confirm **Rebuild CPTs**.

Expected: the state is removed and affected CPTs are rebuilt. A node cannot be reduced below two states.

### BN-32 — Delete a normal node

1. Select a disposable normal node.
2. Click **Delete node** at the bottom-left of the inspector.
3. Review the count of connected edges that will be removed.
4. Confirm **Delete node**.

Expected: the node and its edges disappear, child CPTs are rebuilt, and the inspector closes or selects another valid node.

## F. Conditional probability tables

### BN-33 — Inspect a root CPT

1. In the smoke-test network, select `HAZARD`.

Expected: one CPT row appears with `P(NORMAL)`, `P(CHALLENGE)`, and `P(SEVERE)`, totaling `1.000000`.

### BN-34 — Inspect a conditional CPT

1. Select `SUPPORT`.

Expected: three rows appear—one for each `HAZARD` state—with `P(AVAILABLE)` and `P(UNAVAILABLE)`.

### BN-35 — Edit probabilities

1. Select `HAZARD`.
2. Change `P(SEVERE)` from `0.03` to `0.04`.

Expected: the row total becomes `1.010000`, the row is visibly invalid, a validation issue appears, and exact inference is disabled until the error is resolved.

### BN-36 — Normalize a row explicitly

1. On the invalid row from BN-35, click **Normalize row**.

Expected: each value is divided by the row total and the total returns to `1.000000`. The editor never silently normalizes values while typing.

### BN-37 — Check probability bounds

1. Enter a probability below `0` or above `1`.

Expected: the number control and validation indicate the invalid value; quantification cannot run while an error remains.

## G. Validation interactions

### BN-38 — Open a validation issue’s node

1. Create a node-level error, such as a duplicate node code.
2. Scroll to **Validation** below the editor.
3. Click the issue.

Expected: the related node becomes selected so the offending field and CPT can be corrected.

### BN-39 — Verify validation gating

1. Leave a CPT row invalid.
2. Select a query node.

Expected: **Run exact inference** is disabled. HCL runs are also disabled for blocking HCL validation errors.

## H. Common evidence and exact BN inference

Use the valid smoke-test network for the quantitative checks.

### BN-40 — Open, search, and close the evidence editor

1. In **Bayesian-network analysis**, click **Edit evidence**.
2. In **Find a node**, type `haz`.
3. Confirm only matching code/name rows remain.
4. Clear the search.
5. Click **Close**.

Expected: search filters by node code or name; closing preserves selections.

### BN-41 — Add common evidence

1. Click **Edit evidence**.
2. For `HAZARD`, choose `SEVERE`.
3. Close the editor.

Expected: the scenario summary says `HAZARD = SEVERE` and the `HAZARD` node shows an evidence badge.

### BN-42 — Remove common evidence

1. Reopen **Edit evidence**.
2. For `HAZARD`, choose **No evidence**.

Expected: the observation is removed, its node badge disappears, and the scenario summary returns to **No evidence** if nothing else is observed.

### BN-43 — Run an unconditional exact query

1. Open the **BN query** tab.
2. Set **Query node** to `OUTCOME`.
3. Ensure common evidence is empty.
4. Click **Run exact inference**.

Expected: a posterior distribution appears. `OUTCOME = SEVERE` should be `2.9580%`.

### BN-44 — Run a conditional exact query

1. Set common evidence to `HAZARD = SEVERE`.
2. Keep **Query node** as `OUTCOME`.
3. Click **Run exact inference**.

Expected: `OUTCOME = SEVERE` should be `27.4000%`, demonstrating that evidence propagates through `SUPPORT`.

### BN-45 — Expand and collapse posterior details

1. Query a node with more than two states, such as `OUTCOME`.
2. Click **View details (+1)**.
3. Click **Hide details**.

Expected: the compact result initially shows two states; expansion shows all states without changing the result.

### BN-46 — Query versus evidence distinction

1. Set `HAZARD = SEVERE` as evidence.
2. Set `OUTCOME` as the query.

Expected: evidence is the known condition and the query is the requested posterior. Changing the query must not change evidence.

## I. Reusable BN modules

Use the smoke-test network.

### BN-47 — Save a branch as a module

1. Select `SUPPORT`.
2. Click **Reusable modules**.
3. Click **Save selected branch**.

Expected: a template named from `SUPPORT` is created. It contains `SUPPORT` and descendant `OUTCOME`; external parent `HAZARD` becomes an input port.

### BN-48 — Add a module instance

1. Keep **Reusable modules** open.
2. Review or edit **Instance code** and **Instance name**.
3. For the `HAZARD` input, choose the compatible `HAZARD` node if it is not selected automatically.
4. Click **Add instance**.

Expected: an independent materialized copy of `SUPPORT → OUTCOME` appears, connected to the chosen hazard node. New node codes are unique and the output node becomes selected.

### BN-49 — Verify module state compatibility

1. Create or select an input candidate whose state-code set differs from `HAZARD`.
2. Reopen **Reusable modules**.

Expected: incompatible nodes do not appear as valid input choices. Every module input must be bound before **Add instance** is enabled.

### BN-50 — Inspect module-instance restrictions

1. Select a node belonging to the new module instance.

Expected: the inspector shows a **Module instance** badge. Adding, deleting, or reordering template-controlled states is disabled; local identity and probability behavior should remain consistent with the module rules.

### BN-51 — Delete a module instance

1. In **Reusable modules**, find **Instances in this network**.
2. Click **Delete instance** for the disposable instance.
3. Confirm.

Expected: all materialized nodes and their connections are removed and downstream CPTs are rebuilt. An instance used as another instance’s input cannot be deleted until the dependent instance is deleted.

### BN-52 — Delete a module template

1. Delete all instances of the template.
2. Click **Delete** on the template card.
3. Confirm **Delete template**.

Expected: the reusable definition disappears. Attempting this while instances remain produces an explanatory error and does not damage the network.

### BN-53 — Module JSON/XDSL persistence

1. Create a template and one instance again.
2. Export JSON and XDSL.
3. Import each into separate disposable networks.

Expected: JSON preserves templates and instances. XDSL preserves the materialized solver-ready nodes and represents an instance as a GeNIe submodel in its extensions.

## J. HCL configuration and fault-tree bindings in Systems Analysis

Use the dissertation example’s Systems Analysis workbook and its original dependency network for these tests.

### BN-54 — Create an HCL configuration

Use a disposable network if testing the empty state.

1. Click the **HCL quantification** tab.
2. If the panel says **No HCL configuration**, click **Create HCL configuration**.

Expected: a configuration is created for the selected BN, its manager opens, and its status summarizes fault-tree count, binding count, and scenario count. An unsaved workbook must ask you to save before configuration creation.

### BN-55 — Open and close the configuration manager

1. Click **Manage**.
2. Click **Close**.

Expected: the manager expands/collapses without losing configuration data or changing the selected quantification target.

### BN-56 — Include a fault tree without a binding

1. Open **Manage → Fault trees**.
2. Choose a **Fault tree**.
3. Click **Include selected fault tree**.

Expected: its code appears under **Included fault trees**. Adding the same tree again produces a clear error.

### BN-57 — Create a basic-event binding

1. Open **Manage → Bindings**.
2. Choose a **Fault tree**.
3. Choose one of that tree’s **Basic event** codes.
4. Choose a **BN node**.
5. Under **True states**, check one or more states that mean the basic event is true.
6. Click **Add binding**.

Expected: the list shows `FT / basic event → BN node = true state(s)`, and the fault tree is included automatically if necessary.

### BN-58 — Verify binding guards

Try each case:

1. Select no true state.
2. Select every state as true.
3. Bind a basic event that already has a binding.

Expected: each attempt is rejected with a concise explanation. A valid binding must select at least one—but not every—BN state, and each FT basic event can have only one binding in the configuration.

### BN-59 — Delete a binding

1. Find a disposable binding in the binding list.
2. Click its **Delete** button.

Expected: only that binding is removed. The BN node and fault-tree basic event remain.

### BN-60 — Interpret a binding

For a row such as `ACP-4160-A-FT / ACP-4160-A-DEP → ACP-4160-A-DEP = TRUE`, verify this meaning:

1. The item before the arrow identifies the FT and its basic event.
2. The item after the arrow identifies the BN node and the state set that makes that basic event logically true.

Expected: HCL substitutes the BN-derived Boolean event for that FT basic event; it does not copy a standalone probability into the FT.

## K. Evidence scenarios and file interchange

Remain in **Systems Analysis → Step 05 → HCL quantification → Manage → Evidence scenarios**.

### BN-61 — Add an evidence scenario

1. Click **Add scenario**.

Expected: a selected enabled row such as `SCN-1` appears, with editable code/name and one dropdown per BN node.

### BN-62 — Edit scenario identity

1. Edit the selected scenario’s **Code** and **Name**.

Expected: the scenario list updates immediately and preserves the edits after save/reload. Codes must be unique and no more than 64 characters; names are required and no more than 200 characters.

### BN-63 — Override common evidence in one scenario

1. In the selected scenario, choose a state for one BN node.
2. Leave another node on **Use common evidence**.

Expected: the scenario’s override count increases. Listed scenario evidence overrides common evidence only for the selected nodes; all other nodes inherit common evidence.

### BN-64 — Enable and disable a scenario

1. Use the checkbox at the left of a scenario row.

Expected: disabled rows remain stored and editable but are excluded from scenario batches and hazard convolution. The **Enabled scenarios (n)** count updates.

### BN-65 — Switch scenarios

1. Click another scenario’s code/name row.

Expected: the detail pane switches to that scenario without enabling, disabling, or running it.

### BN-66 — Delete a scenario

1. Click **Delete** on a disposable scenario row.

Expected: only that scenario is removed and another valid scenario becomes selected.

### BN-67 — Import dissertation evidence CSV

1. Click **Import JSON/CSV**.
2. Choose `dissertation-evidence-smoke-test.csv`.

Expected: six enabled `HZ-SMOKE-*` scenarios appear. Existing scenarios with matching codes are replaced in place; unrelated codes are preserved.

### BN-68 — Import dissertation evidence JSON

1. Delete or change one imported `HZ-SMOKE-*` row.
2. Click **Import JSON/CSV**.
3. Choose `dissertation-evidence-smoke-test.json`.

Expected: the same six scenarios are restored using node/state codes rather than internal UUIDs.

### BN-69 — Reject invalid evidence safely

1. Click **Import JSON/CSV**.
2. Choose `invalid-evidence-unknown-state.json`.

Expected: the editor reports the unknown state `NOT_A_REAL_STATE` on `SEISMIC-LEVEL`; no scenario is imported and existing scenarios remain unchanged.

### BN-70 — Export evidence JSON and CSV

1. Click **Export JSON**.
2. Click **Export CSV**.

Expected: both downloads use the HCL configuration code in their filename and contain portable node/state codes, not UUIDs. Export buttons are disabled when no scenarios exist.

## L. Hazard-grid configuration and convolution

Use the six imported `HZ-SMOKE-*` scenarios and keep all six enabled.

### BN-71 — Inspect hazard readiness

1. In **Evidence scenarios**, locate **Hazard convolution**.

Expected: the status says **Ready to enable** and identifies `SEISMIC-LEVEL + FLOOD-LEVEL` as sufficient to distinguish all six enabled grid cells.

### BN-72 — Enable the hazard grid

1. Click **Enable**.

Expected: the hazard-grid fields become visible. The algorithm chooses the smallest complete set of BN dimensions that uniquely identifies enabled cells; values are not hardcoded to particular node names.

### BN-73 — Edit hazard-grid identity and annual frequency

1. Edit **Name**.
2. Set **Annual scale**, for example `0.01`.
3. Set **Unit**, for example `per year`.
4. Set **Year basis**.
5. Review or edit **Hours/year**.

Expected: the typed frequency and annualization convention persist. Conversion uses the selected unit and year definition rather than assuming every number is already per year.

### BN-74 — Normalize selected grid mass

1. Toggle **Normalize selected grid mass**.

Expected: when enabled, selected cell weights are divided by their covered BN probability mass before annual scaling. When disabled, uncovered probability mass remains visibly excluded.

### BN-75 — Change hazard dimensions

1. Review **Hazard dimensions**.
2. Try removing or adding a complete node.

Expected: a change is enabled only if every enabled scenario assigns the proposed dimensions and the resulting cell keys remain unique. A change that would create duplicates is disabled with an explanatory tooltip.

### BN-76 — Verify blocked enablement

1. Disable or edit rows until two enabled scenarios have identical hazard evidence, or remove a shared hazard-node override from one enabled row.
2. Disable the grid if it is already enabled.
3. Click **Enable**.

Expected: no invalid grid is saved. The status explains duplicate cells or names the scenarios missing the best-covered node.

### BN-77 — Repair stale dimensions

1. With a grid enabled, alter enabled scenarios so the stored dimensions no longer identify unique cells but another valid dimension set exists.
2. Click **Repair dimensions**.

Expected: dimensions are recalculated algorithmically from the enabled scenario evidence.

### BN-78 — Disable the hazard grid

1. Click **Disable**.

Expected: hazard-grid settings are removed, while the evidence scenarios remain.

## M. Advanced HCL settings

### BN-79 — Rename the HCL configuration

1. Open **Manage → Advanced**.
2. Edit configuration **Code** and **Name**.

Expected: the summary and exported evidence filenames use the revised identity.

### BN-80 — Fold constants

1. Toggle **Fold constants**.

Expected: when enabled, PRAXIS simplifies constant logic before solving. The choice persists and is applied to subsequent HCL runs.

### BN-81 — Splice null gates

1. Toggle **Splice null gates**.

Expected: when enabled, pass-through/null gates are removed from the solver representation without changing logical meaning.

### BN-82 — Inspect variable order

1. Read **Variable order**.

Expected: it says **Automatic** when no explicit order is stored, or reports the number of configured variables. There is currently no interactive custom-order editor on this screen.

### BN-83 — Delete an HCL configuration

Use only a configuration attached to a disposable network.

1. Click **Delete configuration**.
2. Review the number of bindings that will also be removed.
3. Confirm.

Expected: the configuration, its bindings, scenarios, and hazard-grid settings disappear; the BN itself remains. Cancel leaves it unchanged.

## N. Fault-tree HCL quantification in Systems Analysis

### BN-84 — Run with common evidence

1. In the HCL run bar, confirm **Quantify** is fixed to **Fault tree**.
2. Choose a linked **Top event**.
3. Set **Evidence** to **Common evidence**.
4. Click **Run HCL quantification**.

Expected: the button shows **Running…**, then a styled **Top event probability** result appears. This number is the linked FT top-event probability after the BN evidence and bindings are applied.

### BN-85 — Run an evidence-scenario batch

1. Import and enable at least two scenarios whose evidence varies on bound BN nodes.
2. Set **Evidence** to **Enabled scenarios (n)**.
3. Review **Varying evidence**, affected FT count, affected ET count, and fault trees excluded by constant logic.
4. Choose one of the affected top events shown in the filtered dropdown.
5. Click **Run scenario batch**.

Expected: only targets that can be affected by varying evidence are offered. Each scenario shows success/failure and its top-event probability; a no-variation notice appears if all successful numeric results are equal.

### BN-86 — Run hazard convolution for a fault tree

1. Enable a valid hazard grid.
2. Set **Evidence** to **Hazard-grid convolution**.
3. Choose an affected top event.
4. Click **Run hazard convolution**.

Expected: the result shows grid name, covered probability, annual scale, integrated annual frequency, and one row per scenario with its convolution weight and annual contribution.

### BN-87 — Verify target relevance behavior

1. Switch between **Common evidence** and **Enabled scenarios**.

Expected: common-evidence mode offers every included executable FT. Batch modes offer only FTs reached by bindings from evidence nodes that actually vary, and exclude targets masked by constant FT logic.

## O. Event-tree HCL quantification in ESQ

First complete the BN, FT inclusion, and bindings in Systems Analysis.

### BN-88 — Select the dependency configuration

1. Open the related **Event Sequence Quantification** workbook.
2. Go to **Step 05 Dependencies**.
3. Under **Event-tree Bayesian dependency network**, open **Dependency configuration**.
4. Select the desired Systems Analysis configuration.

Expected: only configurations connected to available event trees are listed. The selected BN appears below in read-only form.

### BN-89 — Verify intentional read-only ownership

1. Try the network identity, Add node, node inspector, CPT, and common-evidence controls.

Expected: a Systems Analysis-owned network is inspectable but not editable in ESQ. Export, zoom, fit, selection, and result interactions remain available. Make source changes in Systems Analysis.

### BN-90 — Inspect automatically linked fault trees

1. In the HCL run bar, choose an **Event tree**.
2. Inspect **Linked fault trees**.

Expected: every fault tree referenced by functional events in that event tree—and recursively connected transfer trees—is listed with its model code and functional-event code(s). This list is derived from event-tree links, not manually selected in ESQ.

### BN-91 — Run event-tree HCL with common evidence

1. Set **Evidence** to **Common evidence**.
2. Choose an event tree.
3. Click **Run HCL quantification**.

Expected: the result reports the number of sequences calculated.

### BN-92 — Expand event-sequence results

1. After BN-91, click **View sequence results**.

Expected: every returned sequence shows its name, conditional probability, and annual frequency `/yr`. Click **Hide results** to collapse it.

### BN-93 — Run an event-tree scenario batch

1. Import/enable scenarios in the Systems Analysis-owned configuration.
2. Return to ESQ Step 05 and set **Evidence** to **Enabled scenarios (n)**.
3. Choose an affected event tree.
4. Click **Run scenario batch**.

Expected: each row reports sequence count and summed annual frequency. The event-tree list is filtered from varying BN evidence through bindings, linked FTs, functional-event links, and transfer targets.

### BN-94 — Run event-tree hazard convolution

1. Enable the grid in Systems Analysis.
2. Return to ESQ and set **Evidence** to **Hazard-grid convolution**.
3. Choose an affected event tree.
4. Click **Run hazard convolution**.

Expected: the summary shows grid name, covered probability, annual scale, and aggregated end-state count. Scenario rows show weights and annual contributions.

### BN-95 — Inspect immutable run provenance

1. After exact inference or HCL quantification, scroll below the editor to **Immutable analysis runs**.
2. Open the newest run.

Expected: the record shows run status/type, exact workbook revisions, source models, entity references, and owner snapshots used for that calculation.

## P. Loading, errors, confirmations, and persistence

### BN-96 — Confirm destructive dialogs are styled and cancellable

Open each applicable action without confirming: import replacement, delete node, delete network, delete module instance/template, delete HCL configuration, add/delete/reorder state, and reorder parents.

Expected: each uses the application’s confirmation dialog, explains impact, has a clear action label, and leaves data unchanged when canceled.

### BN-97 — Verify operation errors are local and readable

Trigger the invalid XDSL and invalid evidence imports from the kit.

Expected: errors appear inside the editor/HCL section rather than in a browser-native alert. Long technical details should not overflow or force horizontal page scrolling.

### BN-98 — Verify save and reload

1. Make a small edit.
2. Wait for **Saved**.
3. Reload the browser page.
4. Return to Step 05.

Expected: persisted model/configuration changes remain; temporary UI state such as an open menu or selected tab may reset safely.

### BN-99 — Verify backend-unavailable handling

Only do this if intentionally testing infrastructure failure.

1. Stop Praetor or make it unreachable.
2. Run exact inference or HCL quantification.

Expected: the editor reports that Praetor cannot be reached without losing model data. Restarting Praetor and rerunning succeeds without rebuilding the BN.

### BN-100 — Verify no unintended cross-workbook editing

1. Edit a dependency model in Systems Analysis and wait for save.
2. Open ESQ Step 05 and verify the updated model is visible.
3. Confirm ESQ does not create a second editable copy of the Systems Analysis network.

Expected: Systems Analysis remains the source of truth for FT-related dependency modeling; ESQ consumes the connected configuration for event-tree quantification.

## Suggested test order

1. BN-01 through BN-12: network lifecycle and files.
2. BN-13 through BN-39: graph editing, states, CPTs, and validation.
3. BN-40 through BN-46: evidence and exact inference.
4. BN-47 through BN-53: reusable modules.
5. BN-54 through BN-60: HCL configuration and FT bindings.
6. BN-61 through BN-70: scenario editing and import/export.
7. BN-71 through BN-83: hazard grid and advanced settings.
8. BN-84 through BN-87: FT HCL results in Systems Analysis.
9. BN-88 through BN-95: ET HCL results and provenance in ESQ.
10. BN-96 through BN-100: error, confirmation, persistence, and ownership checks.

For each interaction, record: interaction ID, what you clicked, what happened, what you expected, desired change, and a screenshot if the problem is visual.
