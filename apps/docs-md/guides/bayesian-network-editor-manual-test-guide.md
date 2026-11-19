### BN-01 — Empty state and create a network

1. Open **Event Sequence Quantification → Step 05 Solve and converge → Dependencies**.
2. If no network exists, confirm the tab shows only the **Dependencies** heading and **Add network**.
3. Click **Add network** and inspect the empty canvas.
4. Click the large central **+** above **Add node to begin.**

Expected: the empty canvas shows the central **+** and **Add node to begin.**, with no zoom/fit/arrange control bar. After the first node is created, the regular canvas control bar appears.

### BN-02 — Create another network

1. Click **Add network** again.
2. Open the **Dependency network** dropdown.

Expected: the new network is selected and both networks appear as `code · name` options.

### BN-03 — Switch networks

1. Open the **Dependency network** dropdown.
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

Expected: the selected network and the dependency configurations that use it are removed, then another network is selected. Cancel must leave everything unchanged.

## B. File import and export

### BN-07 — Export OpenPRA JSON

1. Select a network.
2. Click the **File** icon.
3. Click **Export OpenPRA JSON**.

Expected: the browser downloads `<network-code>.json`, including nodes, states, edges, CPTs, positions, layout, XDSL metadata, reusable module templates, and module instances.

### BN-08 — Export XDSL

1. Click **File → Export XDSL**.

Expected: the browser downloads `<network-code>.xdsl`. Discrete CPTs, parent order, probabilities, names, descriptions, positions, preserved XDSL extensions, and materialized module submodels are represented.

### BN-09 — Import valid JSON

Select any network and note its code.

1. Click **File → Import JSON**.
2. Choose `bn-editor-smoke-test.json` from the test kit.

Expected: a new network is added and selected. Its canvas is `HAZARD → SUPPORT → OUTCOME`, all row totals are `1.00`, and no validation errors appear. The network that was open is still in the **Dependency network** list with its nodes, evidence and dependency configuration unchanged.

### BN-10 — Import valid XDSL

1. Click the **File** icon → **Import XDSL**.
2. Choose `bn-editor-smoke-test.xdsl`.

Expected: another new network is added and selected, with the same three-node graph, state codes, parent order, CPT values, names, descriptions, and positions. No confirmation window opens.

### BN-11 — Verify XDSL round trip

1. After BN-10, edit a node name and drag one node.
2. Click **File → Export XDSL**.
3. Import the downloaded XDSL.

Expected: the import adds one more network. The edits and positions survive the round trip, together with supported XDSL metadata.

### BN-12 — Reject unsupported XDSL safely

1. Select a network and note its code.
2. Click the **File** icon → **Import XDSL**.
3. Choose `invalid-bn-unsupported-decision.xdsl`.

Expected: a styled editor error says that only discrete CPT nodes are supported. The current network remains unchanged and no network is added.

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
4. Verify the same conditional probabilities, then use **Undo**.

Expected: parent order changes in both the inspector and CPT columns. Every conditional assignment retains its probability; no uniform reset or destructive confirmation occurs. This also works for template instances. Undo restores the original order. Finish invalid pending edits before reordering.

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

Expected: **Run inference** is disabled. Dependency runs are also blocked while the network has a blocking error.

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

Expected: a posterior distribution appears. `OUTCOME / SEVERE` should show probability `0.02958` (2.958%).

### BN-44 — Run a conditional exact query

1. Set common evidence to `HAZARD = SEVERE`.
2. Keep **Query node** as `OUTCOME`.
3. Click **Run exact inference**.

Expected: `OUTCOME / SEVERE` should show probability `0.274` (27.4%), demonstrating that evidence propagates through `SUPPORT`.

### BN-45 — Inspect posterior results and export

1. Query a node with more than two states, such as `OUTCOME`.
2. Check that each result identifies its node and state.
3. Hover a probability to inspect its full numeric value.
4. Click **Export results CSV**.

Expected: probabilities use significant digits; `1e-7` remains nonzero. Up to 25 states appear per page. Larger results have page controls and a 25/50/100 row selector. CSV contains every returned state and the unrounded probabilities, IDs, evidence and run metadata, regardless of the visible page. Returned validation issues appear below the results.

### BN-46 — Query versus evidence distinction

1. Set `HAZARD = SEVERE` as evidence.
2. Set `OUTCOME` as the query.

Expected: evidence is the known condition and the query is the requested posterior. Changing the query must not change evidence.

## I. Reusable BN templates and visual submodels

Use the smoke-test network. Templates copy BN branches; visual submodels group existing nodes. Template copying follows HCL_MH's preservation of states and conditional assignments, generalized to arbitrary supported branches. HRA-specific probability overrides are not applied. See the [source map](bayesian-network-submodel-template-source-map.md).

### BN-47 — Save a branch as a module

1. Select `SUPPORT`.
2. Open **Reusable templates** and click **Save**.

Expected: a template named from `SUPPORT` contains `SUPPORT` and descendant `OUTCOME`; external parent `HAZARD` becomes an input port. Invalid graphs, incomplete CPTs or unfinished node/state/CPT edits produce an error without creating a template.

### BN-48 — Add a module instance

1. Open the saved template card.
2. Review **Code**, **Name** and the listed input ports.
3. Click **Create instance** twice, using different instance codes.

Expected: two independent copies of `SUPPORT → OUTCOME` appear with unique IDs and codes. Each connects to `HAZARD`; conditional probabilities retain their parent-state meaning. Editing one copy's probabilities does not change the template or the other copy. Saving, exporting and reloading preserves both copies.

### BN-49 — Verify module state compatibility

Inputs initially select a compatible node with the exact same code, or the sole compatible node when no exact match exists. Use the input selector to choose another compatible node. An unresolved input disables **Create instance**. Create an instance using a different input and verify its graph connection and CPT parent labels.

1. In a disposable model, use an input with distinct state codes `On` and `on`.
2. Save a child branch and instantiate it.
3. Repeat with compatible input states listed in the reverse order.

Expected: state matching is case-sensitive and maps by code, not array position. `On` and `on` remain distinct, and their probabilities are not exchanged. A node with a different state-code set is incompatible. Node codes `A` and `a` are also distinct when choosing the default input.

### BN-50 — Inspect module-instance restrictions

1. Select a materialized node.
2. Inspect its states and edit a valid CPT probability row.

Expected: the inspector shows a **Template instance** badge. Adding, deleting or reordering template-controlled states is disabled. Probability edits are allowed. Invalid template data, duplicate bindings, or input bindings that disagree with actual graph edges/CPT parents are rejected before module creation and before backend BN/HCL execution.

### BN-51 — Delete a module instance

1. Connect the disposable instance to an ordinary downstream node and enter nonuniform downstream probabilities.
2. Select an instance node and click **Delete node**.
3. Read the confirmation, then cancel once.
4. Repeat and confirm **Delete instance**.
5. Use **Undo**.

Expected: the confirmation explicitly warns that affected downstream CPTs reset to uniform probabilities and discard their old values. Cancel changes nothing. Confirmation removes the whole instance and its connections, resets only affected downstream CPTs, and removes its known XDSL node records and empty generated submodel. Undo restores the previous model and probabilities. An instance used as another instance's input cannot be deleted until the dependent instance is deleted.

### BN-52 — Delete a module template

1. Delete all instances of the template.
2. Click **Delete** on the template card and confirm **Delete template**.

Expected: the reusable definition disappears. Attempting this while instances remain produces an explanatory error and leaves the network intact.

### BN-53 — Module JSON/XDSL persistence

1. Create two instances and export **OpenPRA JSON** and **XDSL**.
2. Import each file. Each import adds its own network.
3. In the OpenPRA copy, delete one instance, export both formats again, and inspect the remaining graph and XDSL extensions.

Expected: OpenPRA JSON preserves templates, instances and their wiring. XDSL preserves the materialized solver-ready nodes and GeNIe submodels; it does not carry reusable template definitions. Deleted instance node records do not reappear after either export. The other instance and unrelated vendor extensions remain, including foreign-namespace records whose IDs match deleted records.

### BN-53A — Navigate visual submodels

1. Import an XDSL containing nested GeNIe submodels, or create a template instance.
2. Set **View** to **Submodels**.
3. Open a group by clicking it, double-clicking it, or focusing it and pressing Enter.
4. Navigate a nested group, then use **Back**, **Home** and **Scope**.
5. Select a visible ordinary node and inspect its CPT. Return to **All nodes**.

Expected: ROOT shows top-level groups and ungrouped nodes. Each scope shows its immediate child groups and directly owned nodes. Arrows combine existing connections between visible items; internal edges and connections outside the current scope are hidden. Selecting a scope never changes nodes, CPTs, evidence or calculation inputs. Zoom and Fit affect this view only. Read-only workbooks allow the same navigation. Groups with no directly owned nodes can still contain child groups.

Group membership comes from existing XDSL submodels and materialized template instances. This feature adds their visualization, not an arbitrary group-authoring workflow. A deleted instance disappears from the view; imported empty groups can remain. Malformed grouping metadata produces an error while **All nodes** stays available.

## J. Dependency configuration and fault tree bindings

Use the case study example. Stay in **Event Sequence Quantification → Step 05 Solve and converge → Dependencies**. The fault trees come from the linked Systems Analysis workbook.

### BN-54: Create a dependency configuration

Use a disposable network to test the first step.

1. Pick or add a network that has no configuration.
2. Click **Create dependency configuration** under the network.

Expected: the configuration gets the next `DEP-n` code. **Configuration** and **Advanced** appear, and the run controls appear under the network. An unsaved workbook shows "Save this workbook before creating a dependency configuration."

### BN-55: Open and close the configuration panel

1. Click **Configuration**.
2. Click **Close**.

Expected: the panel shows **Fault trees**, **Bindings** and **Uncertainty**. Closing it changes no data.

### BN-56: Include a fault tree without a binding

1. Open **Configuration**.
2. Under **Fault trees**, choose a **Fault tree**.
3. Click **Include**.

Expected: its code appears under **Included**. Including it again shows "That fault tree is already included."

### BN-57: Create a basic event binding

1. Under **Bindings**, choose a **Fault tree**.
2. Choose one of its **Basic event** codes.
3. Choose a **Network node**.
4. Under **True states**, check the states in which the basic event is true.
5. Click **Add binding**.

Expected: the list shows the fault tree and basic event next to the network condition, and the mapping count goes up. The fault tree is included if it was not.

### BN-58: Check the binding guards

Try each case:

1. Check no true state.
2. Check every state.
3. Bind a basic event that already has a binding.

Expected: the messages are "Select at least one true state.", "The true-state selection cannot contain every state of the node." and "That basic event already has a binding." Nothing is saved.

### BN-59: Delete a binding

1. Find a disposable binding in the list.
2. Click its delete button.

Expected: only that binding is removed. The network node and the basic event stay.

### BN-60: Read a binding

For a row such as `ACP-4160-A-FT / ACP-4160-A-DEP` with the condition `ACP-4160-A-DEP = TRUE`, check this meaning:

1. The first part names the fault tree and its basic event.
2. The condition names the network node and the states in which that basic event is true.

Expected: a dependency run replaces that basic event with the network condition. It does not copy a fixed probability into the fault tree.

## K. Evidence scenarios

Set **Evidence** to **Evidence scenarios** in the run controls. The **Evidence scenarios** section opens under them. Its **Evidence scenarios** button closes and opens the section, and a closed section shows only the scenario count.

### BN-61: Add an evidence scenario

1. Click **Add scenario**.

Expected: a scenario such as `SCN-1` is saved and its window opens with **Code**, **Name** and one state dropdown for each network node. While a hazard grid is set, the new scenario starts turned off.

### BN-62: Edit the scenario code and name

1. Change **Code** and **Name** in the scenario window.

Expected: a field is saved when the cursor leaves it or on Enter. The list shows the new values, and they stay after a reload. An empty code, an empty name or a code that another scenario has is refused with one sentence in the window, and the field goes back to its saved value.

### BN-63: Set evidence in one scenario

1. Choose a state for one node.
2. Leave another node on **Base evidence**.

Expected: the **Evidence** column lists only the nodes the scenario sets. Every other node keeps the base evidence.

### BN-64: Turn a scenario on and off

1. Use the **On** checkbox of a scenario row.

Expected: a scenario that is off stays saved and is left out of scenario runs and hazard convolution. The closed section shows how many are turned on.

### BN-65: Open another scenario

1. Click the code of another scenario.

Expected: its window opens. Nothing runs and nothing is turned on or off.

### BN-66: Remove a scenario

1. Click **Remove** on a disposable scenario row.

Expected: only that scenario is removed.

### BN-67: Upload evidence rows from CSV

1. Click **Upload**.
2. Choose `dissertation-evidence-smoke-test.csv`.

Expected: six `HZ-SMOKE-*` rows appear as temporary rows. The saved scenarios are not changed until **Save scenarios** is clicked. **Use saved scenarios** drops the temporary rows.

### BN-68: Upload evidence rows from JSON

1. Click **Upload**.
2. Choose `dissertation-evidence-smoke-test.json`.

Expected: the same six rows appear. Node and state codes are used, not internal ids.

### BN-69: Reject invalid evidence

1. Click **Upload**.
2. Choose `invalid-evidence-unknown-state.json`.

Expected: the section reports the unknown state `NOT_A_REAL_STATE` on `SEISMIC-LEVEL`. No row is added and the saved scenarios stay as they were.

### BN-70: Sample and export files

1. Open **Sample** and pick JSON, then CSV.
2. Open **Export** and pick JSON, then CSV.

Expected: the files are named after the network code and hold node and state codes, not internal ids. **Export** shows only when there are rows.

### BN-70A: Generate scenarios

1. Click **Generate**.
2. Check the grid nodes and their states.
3. Add an excluded combination and a scenario limit if wanted.
4. Click **Generate**.

Expected: the count of combinations shows before the run. The generated rows appear as temporary rows with a hazard grid over the chosen nodes.

### BN-70B: Repair a scenario after the network changed

1. Delete a state or a node that a saved scenario sets.
2. Set **Evidence** to **Evidence scenarios**.

Expected: the run is blocked with "Evidence scenario … sets a node or a state that is not in the network." The scenario window shows **Missing state** or **Missing node**, and choosing **Base evidence** there clears it.

## L. Hazard grid and hazard convolution

Set **Evidence** to **Hazard convolution**. Use the six `HZ-SMOKE-*` scenarios and keep all six turned on.

### BN-71: Pick the grid nodes

1. In the **Evidence** table, check the **Grid nodes** that tell the scenarios apart.

Expected: only nodes that every scenario sets are offered. With `SEISMIC-LEVEL` and `FLOOD-LEVEL` checked the run is no longer blocked.

### BN-72: Set the annual scale

1. Type the **Annual scale** and pick its unit.
2. Type **Hours per year**.

Expected: a typed value is saved when the cursor leaves the field or on Enter, and the page does not move while it saves. A negative scale or an empty field is not accepted and the field goes back to its saved value.

### BN-73: Choose the weights

1. Set **Weights** to **Raw**, then to **Normalized**.

Expected: the choice is saved and shown in the result of the next hazard run.

### BN-74: Check the grid guards

Try each case:

1. Uncheck a grid node that leaves two scenarios with the same states.
2. Clear a grid node in one scenario that is on.
3. Turn off or remove the last scenario that is on.
4. With one grid node checked, uncheck it.

Expected: the first three changes are refused and nothing is saved. The section says "Scenarios … and … would share one grid cell.", "Scenario … would not set every grid node." and "The hazard grid needs one scenario that is on." No save error shows and the workbook does not reload. With no grid node left the grid is removed and the run is blocked with "The evidence scenarios have no hazard grid." A grid node that a scenario no longer sets stays in the list so it can be unchecked.

## M. Advanced settings

### BN-79: Rename the dependency configuration

1. Click **Advanced**.
2. Edit **Code** and **Name**.

Expected: the jobs list and the run of record name the configuration by its new code.

### BN-80: Fold constants

1. Toggle **Fold constants**.

Expected: when on, constant logic is simplified before solving. The choice is saved and used by later dependency runs.

### BN-81: Splice null gates

1. Toggle **Splice null gates**.

Expected: when on, pass-through gates are removed from the solver model without changing the logic.

### BN-83: Delete a dependency configuration

Use only a configuration of a disposable network.

1. Click **Delete configuration**.
2. Read how many bindings will also be removed.
3. Confirm.

Expected: the configuration, its bindings and its scenarios are removed. The network stays. Cancel leaves everything unchanged.

## N. Fault tree dependency runs

Set **Quantify** to **Fault trees** in the run controls.

### BN-84: Run with base evidence

1. Set **Workflow** to **Manual**, **Result** to **Probability** and **Evidence** to **Base evidence**.
2. Choose a **Fault tree**.
3. Click **Run dependencies**.

Expected: the button shows **Running…**, then **Top event probability** appears. Only included fault trees that have a top event are offered.

### BN-85: Run the evidence scenarios

1. Set **Evidence** to **Evidence scenarios**.
2. Click **Run dependencies**.

Expected: every scenario that is turned on shows its status and probability. One scenario, or two scenarios with the same evidence, are valid. The **Evidence scenarios** section closes when the results arrive and stays closed, also after a reload, until its button is clicked.

### BN-86: Run hazard convolution

1. Set **Evidence** to **Hazard convolution** with a valid grid.
2. Click **Run dependencies**.

Expected: the result shows the covered probability and the convolved probability, with one row for each scenario. The integrated frequency shows only when the annual scale is not 1 per year, since it then equals the probability. The grid name, the annual scale and the weights are not repeated in the result.

### BN-87: Run several fault trees

1. Set **Workflow** to **Batch**.
2. Check the fault trees to run.
3. Click **Run dependencies batch**.

Expected: the count of selected fault trees shows above the list. A **Fault tree** picker above the results switches between them.

### BN-87A: Rank cut sets and read importance

1. Set **Ranked cut sets** to **Failed events** and **Importance** to **On**.
2. Set **Cut sets kept**, **Maximum cut set order**, **Cut set cutoff** and **Causes per cut set** as wanted.
3. Run, then click **Ranked cut sets** and **Importance** in the result.

Expected: both open in a window over the tab. Cut sets name basic events by code, also for events in transferred fault trees. **Causes** lists the network nodes a cut set shifts most.

### BN-87B: Run under uncertainty

1. Set **Result** to **Uncertainty**.
2. Set the sampling fields, for example **Samples** and **Seed value**.
3. Click **Run dependencies**.

Expected: the result shows the mean, the median and the 5th and 95th percentiles. An empty **Seed value** blocks the run. **Samples**, **CPT floor**, **Cut sets kept** and **Events sampled for importance** can be emptied before a new value is typed, and an emptied field shows its last value again when the cursor leaves it.

## O. Event tree dependency runs

Set **Quantify** to **Event trees** in the run controls.

### BN-88: Link a functional event to a network node

1. Open **Step 02 Model → Functions** and open a function.
2. In a **Linked to** dropdown, choose **Network node**.
3. Pick the **Network** and the **Node**, check the failing states and click **Save**.

Expected: the row reads **Network node** with the node and network codes, and an **Edit** button sits next to it. **Save** needs at least one failing state and not all of them.

### BN-91: Run with base evidence

1. Back in **Step 05 → Dependencies**, choose an **Event tree**.
2. Click **Run dependencies**.

Expected: the run joins the run list at the top of Step 05 and its sequences show under the run controls. It can be made the run of record with **Use as values of record**, which sits at the right of the result's **Event tree**, **Order** and **Group by** pickers.

### BN-92: Read the sequence results

1. Change **Order** and open **Details**.
2. With more than 10 rows, use the pager.
3. Click **Export results CSV**.

Expected: each sequence shows its end state and frequency. The CSV holds every sequence.

### BN-93: Run the evidence scenarios

1. Set **Evidence** to **Evidence scenarios**.
2. Click **Run dependencies**.

Expected: a **Scenario** picker switches between the scenarios. **All scenarios** lists each scenario with its totals.

### BN-94: Run hazard convolution

1. Set **Evidence** to **Hazard convolution** with a valid grid.
2. Click **Run dependencies**.

Expected: a **Cell** picker switches between the grid cells, and the integrated tables show sequences and end states.

### BN-94A: Rank cut sets and read importance

1. Set **Ranked cut sets** to **Failed events** or **Failed events and success branches**, and **Importance** to **On**.
2. Run, then click a sequence or an **Importance** button.

Expected: the cut sets and the importance measures open in a window over the tab.

### BN-95: Read a saved run

1. After a network query or a dependency run, open **Analysis history** below the card.
2. Open the newest run.

Expected: the record shows the run status and type, the workbook revisions and the models used for that calculation.

## P. Loading, errors, confirmations and persistence

### BN-96: Confirm that destructive windows can be cancelled

Open each action without confirming: delete node, delete network, delete module instance or template, delete dependency configuration, and add, delete or reorder a state.

Expected: each uses the application's confirmation window, says what will be removed and changes nothing when cancelled. Deleting a network also says how many dependency configurations go with it and how many function links in Step 02 lose their node.

### BN-97: Check that errors are local and readable

Upload the invalid XDSL and the invalid evidence file from the kit.

Expected: the errors show inside the editor or the evidence section, not in a browser alert. Long details do not force the page to scroll sideways.

### BN-98: Check save and reload

1. Make a small edit.
2. Wait for **Saved**.
3. Reload the browser page.
4. Return to **Step 05 → Dependencies**.

Expected: the network, the configuration, the picked network and the run control choices are still there.

### BN-99: Check a failed run

Only do this when testing an infrastructure failure on purpose.

1. Stop the job service or make it unreachable.
2. Run a network query or a dependency run.

Expected: the tab reports that the job service cannot be reached and no model data is lost. A new run works once the service is back.

### BN-100: Check that results survive a tab switch

1. Run a fault tree dependency run.
2. Open the **Runs** tab, then return to **Dependencies**.
3. Change the network, for example rename a node.

Expected: the results are still there after the tab switch. They are dropped after the network changed.

### BN-101: Check that other workbooks hold no network

1. Open **Systems Analysis → Step 05 Dependencies**.
2. Open **Event Sequence Analysis**, select a functional event and click **Link**.

Expected: Systems Analysis shows no network editor, and the Event Sequence Analysis link window offers fault trees only. Networks, bindings and node links live in Event Sequence Quantification.

## Suggested test order

1. BN-01 through BN-12: network lifecycle and files.
2. BN-13 through BN-39: graph editing, states, CPTs and validation.
3. BN-40 through BN-46: evidence and network queries.
4. BN-47 through BN-53: reusable modules.
5. BN-54 through BN-60: dependency configuration and bindings.
6. BN-61 through BN-74: evidence scenarios and the hazard grid.
7. BN-79 through BN-83: advanced settings.
8. BN-84 through BN-87B: fault tree dependency runs.
9. BN-88 through BN-95: event tree dependency runs and saved runs.
10. BN-96 through BN-101: errors, confirmations, persistence and ownership.

For each interaction, record: interaction ID, what you clicked, what happened, what you expected, desired change, and a screenshot if the problem is visual.


## Task 34 regression checks

- Save common evidence and scenario overrides for a BN node. Delete the node or
  a referenced state. The evidence must remain, with a missing-reference notice;
  invalid calculations must be blocked. Undo restores the original references.
  Remove an observation explicitly to repair it without undoing the edit.
- Every network is owned by the ESQ workbook. Repair it in ESQ Step 05, Dependencies.
- Delay a workbook save, then simulate a save failure. BN inference and HCL
  probability/uncertainty runs must remain disabled until a successful save.
- Complete a manual or batch run, then edit its CPTs, evidence, bindings or
  settings. The previous displayed result must disappear. Repeat while the
  request is still pending; its late response must not restore that result.
- Switch target, workflow or calculation type after a run. Previous results
  must not appear under the new selection. Existing immutable run records remain
  available in run history.


### BN-35 — Source-compatible file interchange

1. Export **canonical JSON**, then use **Import JSON** to reload it. This is main PRAXIS's name-based `{id, variables}` format; it carries the BN calculation data. OpenPRA JSON also carries layout, descriptions and reusable modules.
2. Reorder CPT rows in OpenPRA JSON while keeping each row's parent-state assignments. Import it, export XDSL and reload. Each conditional probability must stay with the same parent states.
3. Import a one-state CPT (`Only` with probability `1`), including namespace-prefixed XDSL. Save, then run inference. The marginal must be `1`.
4. Import a cycle, repeated state code or a CPT row totaling `0.8`. Import must show an error and add no network. Invalid exports must show an error rather than download a file.
5. Change network/node names, descriptions and positions. XDSL reload must retain them and preserve unrelated vendor extensions.
6. With a network containing module instances open, import XDSL or canonical JSON. The import must add a new network that has no templates or instances. The open network must keep its instances, templates, saved evidence and dependency bindings. Only **Delete network** removes a network.

Node/state codes are case-sensitive, as in main. CPT row totals use main TensorBayes's `1e-6` tolerance; values are never silently normalized. New editor nodes still start with two states; at least one state is required.

## Task 37 regression checks

- Check BN manual and batch results with probabilities `1e-7`, `1e-15`, zero and one. Small positive values must remain visible; hover and CSV preserve the raw values.
- Check node/state IDs and names, scenario code/name, and returned validation issues. Missing labels fall back to IDs.
- Check 63 scenarios or sequences: pages contain 25, 25 and 13 rows. Export from page 3 and verify that all 63 are included. A new run returns to page 1.
- Check failed and zero-weight skipped scenarios. Export keeps their status/reason and leaves absent probabilities blank.
- Compare every exported UQ statistic and unit with the API result. End-state and hazard quantities are displayed and exported as returned; see task 38 checks below.
- Check ordinary FT/ET result CSV controls in read-only views, including the stale flag for a previous result.
- Source correspondence and CSV conventions are documented in [Result presentation source map](result-presentation-source-map.md).

## Task 38 regression checks

- Run an ET with Safe `0.009/yr` and Release `0.001/yr`. The combined `0.010/yr` is labelled **All outcomes**. Selecting Release shows only its aggregate and terminating sequences.
- Run manual and scenario UQ. Compare all seven returned end-state statistics with the API, including `/yr`, sample count and seed. End-state percentiles must not be calculated by adding sequence percentiles. Missing UQ is labelled absent.
- Expand an ordinary probability scenario. Verify sequence conditional probabilities, annual frequencies and end-state totals. If the selected state is absent from a scenario, show no result rather than zero.
- Repeat with a transferred sequence. Its complete path uses both tree names; its end-state label belongs to the terminal tree. Check legacy trees without saved `endStateIds`, and raw-ID fallback when names are unavailable.
- Run raw-weight and normalized-weight hazard grids. Compare integrated sequence/end-state numbers and each bin's weights/contributions with the API. No second weighting or annual scaling should occur. Scenario frequencies and hazard contributions remain labelled separately.
- Check zero-weight skips, failures, and unknown sequence destinations. Unknown destinations remain inspectable under All outcomes. Hazard-grid UQ cannot be enabled.
- Check more than 25 end states, sequences and scenarios. Changing the selected state resets pagination; a new run resets the selector. CSV always exports all outcomes and all pages, including safe states while Release is selected.


## Task 39 regression checks

- Open an FT result, a scenario row of a batch and an ET sequence. None shows a **Solver diagnostics** block. The BDD, bridge and junction-tree numbers stay in the API result and are not displayed.
- Run a two-row evidence batch for FT and for ET, in probability and in UQ. No result shows a **Batch compilation diagnostics** block. The compilation counts stay in the batch response and in the saved record.
- No GUI order override, cut-set display, importance calculation or new solver algorithm is introduced. See [source definitions](result-presentation-source-map.md#task-39-bdd-junction-tree-and-cache-diagnostics).

## Task 40 regression checks

- Execute FT, BN, HCL FT/ET and uncertainty batches. Compare returned values with saved/retrieved results, including scenario and compilation diagnostics.
- In a test environment, lower `PRAETOR_NATIVE_TIMEOUT_MS` in backend and Praetor. A long run must fail with `PRAXIS_TIMEOUT`, stop its native process and retain no result. Restore the default `300000` afterward.
- Abort a pending HTTP request. Its native process must stop, its saved run must record `PRAXIS_CANCELLED`, and a separate request must remain unaffected. This does not add a GUI Cancel button.
- Set `PRAETOR_NATIVE_MAX_CONCURRENT=1` and hold one run open. A second native request must return `PRAXIS_BUSY`; retry after the first process exits must work.
- Send missing/unknown `methodType` values to native validate and execute. Both must return `UNSUPPORTED_METHOD_TYPE`, never a successful validation.
- Build Praetor and execute through its compiled HTTP service. Confirm the copied JavaScript worker matches its source; no TypeScript worker duplicate remains. Malformed native envelopes must fail before result storage.
- See [execution sources and limits](praxis-execution-source-map.md). The quantification algorithms are unchanged.


## Task 41 regression checks

- Run ordinary FT/ET, BN, HCL FT/ET, hazard and uncertainty batches. Open **Saved analysis runs** in SY/ES/ESQ. Check saved values, complete scenario members, hazard totals, UQ and diagnostics. Reload the workbook and inspect the same run.
- Download a saved run. Check original workbook snapshots, evidence/settings, native request, source revisions and the native build fingerprint. Replaying the request with that build must reproduce numerical results; timings may differ.
- Change a linked DA or HRA workbook without editing the owner. On focus or the next visible 30-second check, active results must become stale. Saved history retains its original result and reports both revisions. Deleted sources are marked missing.
- Revoke access to a contributing source project. Metadata, result and detail endpoints must refuse access; history must omit that run, and an open detail/download view must clear on refresh. Other accessible runs remain available.
- Remove the exact DA/HRA workbook referenced by a controlled event, while leaving another workbook containing the same entity ID. Execution must request explicit relinking. It must never select the other workbook automatically.
- Inspect more than 25 saved runs and use **Older runs**. Ordinary and legacy records remain visible when their source permissions can be verified. Missing historical native requests/build identities are labelled **not recorded**, never invented.
- In an isolated backend test, reject the second native batch row or fail a child result write. The batch and children must all fail without retained partial results.
- Source rules and old-record limits: [saved-run source map](analysis-run-history-source-map.md).
