# Event Tree Quantification — Implementation Plan

## Overview

This document lists every concrete implementation task needed to fully wire up event tree quantification, fix the UI issues, and complete the missing PRAXIS algorithms for event trees. Tasks are ordered so that each group can be done independently within the group, and groups build on each other.

---

## Group 1 — Frontend UI Fixes (no backend or engine changes needed)

- [x] Task 1.1 — Fix Fault Tree Selection Dropdown Position in `columnNode.tsx`

**File:** `packages/frontend/web-editor/src/app/components/treeNodes/eventTreeEditorNode/columnNode.tsx`

**Problem:** The `EuiSelect` for fault tree linking (lines 199–214) is rendered inside the column node's textarea area, cramped into a tiny 100px-wide box at the bottom of the cell. It is visually broken because the column node has no room for it and it overflows the cell.

**Fix:**

- Remove the inline `EuiSelect` from inside `ColumnNode` (lines 199–214).
- The fault tree assignment UI belongs in a properties/side panel, not inside the node itself. Move the fault tree link control into a dedicated properties panel that opens when the column node is selected (see Task 1.4 for the panel itself).
- `ColumnNodeData` interface (line 22): keep `faultTreeId?: string` field, it is still needed for data — only the render location changes.
- The `handleFaultTreeChange` function (line 56) and `GetFaultTrees` useEffect (lines 44–49) should be removed from `ColumnNode` and relocated to the properties panel component (Task 1.4).

- [x] Task 1.2 — Add Zoom In / Zoom Out / Fit-to-View Buttons to Event Tree Toolbar

**File:** `packages/frontend/web-editor/src/app/pages/fullScopePages/eventTrees.tsx`

**Problem:** The event tree toolbar (the `Panel position="bottom-left"` block, lines 182–198) only has a single "Quantify" button. The fault tree editor has Zoom In, Zoom Out, and Fit-to-View buttons (lines 388–414 of `faultTrees.tsx`) but the event tree editor has none of these.

**Fix:**

- Import `useReactFlow` hook inside `ReactFlowPro` (already imported from reactflow at line 11).
- Destructure `zoomIn`, `zoomOut`, `fitView` from `useReactFlow()`.
- Add three `EuiButtonIcon` entries to the `EuiFlexGroup` in the `Panel position="bottom-left"` block, inserted between the existing Quantify button and the end of the group:
  - `iconType="plusInCircle"` / `aria-label="zoom in"` / `onClick={() => void zoomIn({ duration: 200 })` / `title="Zoom in"`
  - `iconType="minusInCircle"` / `aria-label="zoom out"` / `onClick={() => void zoomOut({ duration: 200 })` / `title="Zoom out"`
  - `iconType="expand"` / `aria-label="fit view"` / `onClick={() => void fitView({ duration: 300, padding: 0.15 })` / `title="Fit to screen"` — this is the **fit-to-view button**
- These three buttons must be placed **between** the Quantify button and the (future) Quantify panel toggle, exactly as in `faultTrees.tsx` lines 388–414.

- [ ] Task 1.3 — Rewrite `EventTreeQuantificationPanel` Settings to Match Fault Tree Panel

**File:** `packages/frontend/web-editor/src/app/components/treeNodes/eventTreeEditorNode/eventTreeQuantificationPanel.tsx`

**Problem:** The panel only shows an Algorithm selector. The fault tree panel additionally shows Approximation (Rare-Event / MCUB) and Max Cut-Set Order controls. The event tree panel needs all of these, plus a Monte Carlo–specific section for number of samples.

**Fix — Settings section:**

- Keep algorithm options `zbdd`, `mocus`, `bdd`, `monte_carlo` (already present at line 40).
- Add state: `const [approximation, setApproximation] = useState<EventTreeApproximation>("rare_event")` — only shown when algorithm is `zbdd` or `mocus`.
- Add state: `const [maxOrder, setMaxOrder] = useState<number | undefined>(undefined)` — only shown when algorithm is `zbdd` or `mocus`.
- Add state: `const [numSamples, setNumSamples] = useState<number>(10000)` — only shown when algorithm is `monte_carlo`.
- Add `EuiFormRow label="Approximation"` with `EuiSelect` containing `rare_event` / `mcub` — rendered conditionally when `algorithm !== "bdd" && algorithm !== "monte_carlo"`.
- Add `EuiFormRow label="Max Cut-Set Order"` with `EuiFieldNumber` (min=1, max=20, placeholder="Unlimited") — rendered conditionally when `algorithm !== "bdd" && algorithm !== "monte_carlo"`.
- Add `EuiFormRow label="Number of Samples"` with `EuiFieldNumber` (min=1000, max=1000000, step=1000, default=10000) — rendered only when `algorithm === "monte_carlo"`.
- Pass all new fields into the `GraphApiManager.quantifyEventTree` call.

**Fix — `handleRun` signature:**

```typescript
const res = await GraphApiManager.quantifyEventTree(eventTreeId, {
  algorithm,
  ...(needsApproximation ? { approximation } : {}),
  ...(needsMaxOrder && maxOrder !== undefined && maxOrder > 0 ? { maxOrder } : {}),
  ...(algorithm === "monte_carlo" ? { numSamples } : {}),
});
```

- [ ] Task 1.4 — Add Event Tree Properties Panel for Column Node Fault Tree Linking

**File (new):** `packages/frontend/web-editor/src/app/components/treeNodes/eventTreeEditorNode/eventTreePropertiesPanel.tsx`

**File:** `packages/frontend/web-editor/src/app/pages/fullScopePages/eventTrees.tsx`

**Problem:** The fault tree assignment for functional events (column nodes) is embedded inside the tiny column node cell. It needs to be in a proper side panel that appears when a column node is selected, mirroring how `faultTreePropertiesPanel.tsx` works for fault trees.

**Fix — Create `eventTreePropertiesPanel.tsx`:**

- Props: `selectedNodeId: string | null`, `nodes: Node<ColumnNodeData>[]`, `eventTreeId: string`
- Shows a panel with `EuiTitle` "Functional Event Properties".
- When `selectedNodeId` is a column node (type `"columnNode"`), shows:
  - A read-only label field showing the functional event's current label.
  - A `EuiSelect` labeled "Linked Fault Tree" populated by calling `GetFaultTrees(modelId)`. The selected value is `data.faultTreeId ?? ""`. On change it calls `setNodes` to update `data.faultTreeId` for that node.
- When nothing is selected or the selected node is not a `columnNode`, shows a placeholder ("Select a functional event to edit its properties").

**Fix — Wire panel into `eventTrees.tsx`:**

- Add state: `const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)`.
- Add `onNodeClick` handler: `(_, node) => setSelectedNodeId(node.id)`.
- Add `onPaneClick` to also call `setSelectedNodeId(null)`.
- Mount `<EventTreePropertiesPanel>` as a side panel (same pattern as `isQuantifyOpen` panel), always visible or toggled by a separate icon.

- [ ] Task 1.5 — Rewrite Event Tree Results Modal to Match Fault Tree Results

**File:** `packages/frontend/web-editor/src/app/components/treeNodes/eventTreeEditorNode/eventTreeQuantificationPanel.tsx`

**Problem:** The current `ResultsModal` (lines 159–203) is a flat table with three columns: Sequence ID, Frequency, Cut Sets. It does not show per-cut-set order, contribution, or probability. It does not have pagination. It does not have a summary stat row.

**Fix — Rewrite `ResultsModal`:**

Replace the existing `ResultsModal` with a richer layout mirroring `CutSetAnalysisModal` from `faultTreeQuantificationPanel.tsx`:

1. **Summary row** (using `EuiStat` components):
   - Total Sequence Count
   - Total CDF (sum of all sequence frequencies)
   - Algorithm badge
   - Approximation badge (if applicable)

2. **Per-sequence cut set table** — expand pattern: each row is one sequence, with:
   - Sequence ID (with a badge)
   - Sequence Frequency (formatted as exponential, color-coded by magnitude: ≥1e-4 danger, ≥1e-6 warning, else success)
   - Path (the functional event states leading to this sequence, displayed as a compact tag list, e.g. `FE-1:S | FE-2:F`)
   - Cut Sets count badge
   - A row expand / details button that shows the per-cut-set subtable

3. **Per-sequence cut set subtable** (same columns as fault tree): Rank, Cut Sets, Order, Probability, Contribution (with `EuiProgress` bar).

4. **Pagination** using `EuiBasicTable` pagination props; page sizes `[10, 20, 50]`.

5. **"No cut sets"** fallback for Monte Carlo results where only frequency estimates exist (no cut sets).

**Also in the side-panel summary** (when `result && !isRunning`):

- Show `EuiStat` for total CDF (sum of sequence frequencies).
- Show algorithm and approximation badges.
- Show total sequence count badge.
- Show "View Results" button.

---

## Group 2 — Shared Types: Extend `EventTreeQuantificationRequest`

- [ ] Task 2.1 — Add Missing Fields to `EventTreeQuantificationRequest`

**File:** `packages/shared-types/src/lib/types/eventTreeQuantification.ts`

**Current state:** `EventTreeQuantificationRequest` only has `graph?` and `algorithm`.

**Fix:**

- Add `approximation?: "rare_event" | "mcub"` — used by BDD/ZBDD/MOCUS paths.
- Add `maxOrder?: number` — used by ZBDD/MOCUS.
- Add `numSamples?: number` — used by Monte Carlo. Default 10000.
- Export `EventTreeApproximation = "rare_event" | "mcub"` type alias (mirrors `FaultTreeApproximation`).
- Extend `EventTreeQuantificationResult`:
  - Add `approximation?: EventTreeApproximation`
  - Add `totalCdf?: number` — sum of all sequence frequencies
  - Add `numSamples?: number` — for Monte Carlo results
- Extend `EventTreeSequenceResult`:
  - Add `path?: Array<{ functionalEventId: string; state: string }>` — the branch path
  - The existing `cutSets: EventTreeCutSet[]` is fine; add `probability?: number` for the conditional probability of the sequence.

**Final shape:**

```typescript
export type EventTreeApproximation = "rare_event" | "mcub";

export interface EventTreeQuantificationRequest {
  graph?: EventTreeGraph;
  algorithm: EventTreeAlgorithm;
  approximation?: EventTreeApproximation;
  maxOrder?: number;
  numSamples?: number;
}

export interface EventTreeCutSet {
  events: string[];
  probability: number;
  contribution: number;
}

export interface EventTreeSequenceResult {
  sequenceId: string;
  frequency: number;
  probability?: number;
  path?: Array<{ functionalEventId: string; state: string }>;
  cutSets: EventTreeCutSet[];
}

export interface EventTreeQuantificationResult {
  algorithm: EventTreeAlgorithm;
  approximation?: EventTreeApproximation;
  totalCdf?: number;
  numSamples?: number;
  sequences: EventTreeSequenceResult[];
}
```

- [ ] Task 2.2 — Update `GraphApiManager.quantifyEventTree` Signature

**File:** `packages/shared-sdk/src/lib/api/GraphApiManager.ts`

**Current state (lines 107–118):** The method accepts `Omit<EventTreeQuantificationRequest, "graph">` which will automatically include the new fields once Task 2.1 is done. No additional changes needed to the method signature itself.

**Verify:** Confirm the `Omit<EventTreeQuantificationRequest, "graph">` type correctly picks up `approximation`, `maxOrder`, and `numSamples` after Task 2.1. No code change needed if types extend correctly.

---

## Group 3 — Backend: Event Tree Quantification Endpoint

- [ ] Task 3.1 — Add `quantifyEventTree` Method to `GraphModelService`

**File:** `packages/web-backend/src/graphModels/graphModel.service.ts`

**Current state:** Method `quantifyFaultTree` exists at line 292. No equivalent for event trees.

**Fix — Add method after `quantifyFaultTree`:**

```typescript
async quantifyEventTree(
  eventTreeId: string,
  options: Omit<EventTreeQuantificationRequest, "graph">,
): Promise<EventTreeQuantificationResult> {
  const graph = await this.getEventTreeGraph(eventTreeId);

  const request: EventTreeQuantificationRequest = {
    graph: graph as unknown as EventTreeQuantificationRequest["graph"],
    ...options,
  };

  let praxis: { quantifyEventTree: (json: string) => string };
  try {
    praxis = require("praxis-node") as typeof praxis;
  } catch {
    const hint =
      "The praxis-node native addon is not built. " +
      "Run: cd packages/engine/praxis && cargo build --features napi-rs --release";
    throw new Error(`praxis-node not available: ${hint}`);
  }

  const resultJson = praxis.quantifyEventTree(JSON.stringify(request));
  return JSON.parse(resultJson) as EventTreeQuantificationResult;
}
```

**Imports to add:**

- `EventTreeQuantificationRequest` and `EventTreeQuantificationResult` from `shared-types/src/lib/types/eventTreeQuantification`.

- [ ] Task 3.2 — Add `POST /event-tree-graph/quantify` Endpoint to `GraphModelController`

**File:** `packages/web-backend/src/graphModels/graphModel.controller.ts`

**Current state:** `POST /fault-tree-graph/quantify` exists at line 140. No equivalent for event trees.

**Fix — Add after the fault tree quantify endpoint (after line 151):**

```typescript
@Post("/event-tree-graph/quantify")
async quantifyEventTree(
  @Query("eventTreeId") eventTreeId: string,
  @Body() body: Omit<EventTreeQuantificationRequest, "graph">,
): Promise<EventTreeQuantificationResult> {
  try {
    return await this.graphModelService.quantifyEventTree(eventTreeId, body);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Quantification failed";
    throw new HttpException(message, HttpStatus.INTERNAL_SERVER_ERROR);
  }
}
```

**Imports to add:**

- `EventTreeQuantificationRequest`, `EventTreeQuantificationResult` from `shared-types/src/lib/types/eventTreeQuantification`.

---

## Group 4 — PRAXIS Engine: New Event Tree Quantification Contract

- [ ] Task 4.1 — Create `event_tree_quantification.rs` in PRAXIS

**File (new):** `packages/engine/praxis/src/openpra_mef/event_tree_quantification.rs`

This is the main new Rust module. It is the event-tree equivalent of `fault_tree_quantification.rs`.

**Structs to define (with `serde` `camelCase` rename):**

```rust
pub struct EtQuantificationRequest {
  pub graph: MefEventTreeGraph,          // the ReactFlow event tree graph from DB
  pub algorithm: EtAlgorithmKind,        // bdd | zbdd | mocus | monte_carlo
  pub approximation: Option<ApproximationKind>, // rare_event | mcub
  pub max_order: Option<usize>,
  pub num_samples: Option<usize>,        // for monte_carlo
  pub fault_trees: HashMap<String, MefFaultTreeGraph>, // keyed by faultTreeId
}

pub struct MefEventTreeGraph {
  pub event_tree_id: String,
  pub nodes: Vec<MefEtNode>,   // ReactFlow nodes array
  pub edges: Vec<MefEtEdge>,   // ReactFlow edges array
  pub functional_events: Option<HashMap<String, MefFunctionalEvent>>,
  pub sequences: Option<HashMap<String, MefEtSequence>>,
}

pub struct MefFunctionalEvent {
  pub id: String,
  pub name: Option<String>,
  pub fault_tree_id: Option<String>,
  pub success_probability: Option<f64>,
  pub order: Option<i32>,
}

pub struct MefEtSequence {
  pub id: String,
  pub name: Option<String>,
}

pub struct EtQuantificationResult {
  pub algorithm: String,
  pub approximation: Option<String>,
  pub total_cdf: f64,
  pub num_samples: Option<usize>,
  pub sequences: Vec<EtSequenceResult>,
}

pub struct EtSequenceResult {
  pub sequence_id: String,
  pub frequency: f64,
  pub probability: Option<f64>,
  pub path: Vec<EtPathStep>,
  pub cut_sets: Vec<CutSetResult>,   // reuse from fault_tree_quantification
}

pub struct EtPathStep {
  pub functional_event_id: String,
  pub state: String,
}
```

**`EtAlgorithmKind` enum:**

```rust
pub enum EtAlgorithmKind {
  Bdd,
  Zbdd,
  Mocus,
  MonteCarlo,
}
```

**Entry point function:**

```rust
pub fn quantify_event_tree_contract(request_json: &str) -> Result<String>
```

This function must:

1. Parse `EtQuantificationRequest` from JSON.
2. Convert the MEF ReactFlow graph into a `praxis_event_tree_graph` internal representation by calling the existing `deserialize_event_tree_library` or a new graph-to-EventTree converter (see Task 4.2).
3. For `bdd`, `zbdd`, `mocus`: call `quantify_event_tree_deterministic()`.
4. For `monte_carlo`: call `quantify_event_tree_monte_carlo()`.
5. Serialize and return `EtQuantificationResult`.

- [ ] Task 4.2 — Build MEF ReactFlow Graph → PRAXIS `EventTree` Converter

**File:** `packages/engine/praxis/src/openpra_mef/event_tree_quantification.rs`

The ReactFlow event tree graph stores data as a list of `nodes` and `edges` in ReactFlow format. PRAXIS needs an `EventTree` struct (from `crate::core::event_tree`). This converter is the critical bridge.

**Function to implement:**

```rust
fn mef_graph_to_event_tree(graph: &MefEventTreeGraph) -> Result<(InitiatingEvent, EventTree)>
```

**Conversion logic:**

1. Identify the initiating event node (ReactFlow node with `data.depth === 1` OR the leftmost column node by position). Extract its label as the IE ID, and `data.faultTreeId` as `ie.fault_tree_id`. If no fault tree, use default frequency 1.0.
2. Identify all column nodes (ReactFlow type `"columnNode"` with `allowAdd=true` or by column position). Each column node becomes a `FunctionalEvent`. Build `FunctionalEvent { id: node.id, name: data.label, fault_tree_id: data.faultTreeId, success_probability: None, order: data.depth }`.
3. Identify all output nodes (ReactFlow type `"outputNode"` with `data.isSequenceId=true`). Each becomes a `Sequence { id: data.label }`.
4. Reconstruct the branch tree from the edges. The ReactFlow edges define parent→child relationships. Traverse from the IE node through column nodes to output nodes, building `Fork` → `Path` → nested `Fork` → `Path` → `Sequence` structures. Each column node becomes a fork point; the "yes" and "no" edges from each column node become two paths.
5. For the path state: edges with `data.label === "Yes"` (or `data.order === 1`) become `"success"` path; edges with `data.label === "No"` (or `data.order === 2`) become `"failure"` path. Set `collect_formula_negated = Some(true)` for failure paths.
6. Validate that the resulting `EventTree` is well-formed.

**If `functionalEvents` map is present** in the graph (when saved with MEF data): use that directly instead of inferring from nodes. Each entry in `functionalEvents` maps to a `FunctionalEvent`, with `fault_tree_id` taken from the map entry's `faultTreeId` field.

- [ ] Task 4.3 — Implement Deterministic Event Tree Quantification (BDD/ZBDD/MOCUS per sequence)

**File:** `packages/engine/praxis/src/openpra_mef/event_tree_quantification.rs`

**Function to implement:**

```rust
fn quantify_event_tree_deterministic(
    ie: &InitiatingEvent,
    event_tree: &EventTree,
    fault_trees: &HashMap<String, MefFaultTreeGraph>,
    algorithm: EtAlgorithmKind,
    approximation: ApproximationKind,
    max_order: Option<usize>,
) -> Result<EtQuantificationResult>
```

**Logic:**

1. Build a `Model` instance. For each entry in `fault_trees`, convert using `mef_graph_to_fault_tree()` (from `fault_tree_quantification.rs`, make it `pub`) and call `model.add_fault_tree(ft)`.

2. Set the IE probability and frequency: if `ie.fault_tree_id` is set, quantify that fault tree using BDD to get the probability. If not, use `ie.probability.unwrap_or(1.0)`. Frequency = `ie.frequency.unwrap_or(1.0)`.

3. Run `EventTreeAnalysis::new(ie.clone(), event_tree.clone(), &model).analyze()` using the existing analysis from `crate::analysis::event_tree`. This gives `Vec<SequenceResult>` where each has `probability` and `frequency`.

4. For each `SequenceResult`:
   a. Compute the conditional fault tree probability for each functional event in the sequence's path using the relevant fault tree (already done inside `EventTreeAnalysis` via `compute_functional_event_probability`).
   b. For cut sets: build a per-sequence fault tree by folding all failed functional events (those on the failure path) into an AND-gate. Each failed FE that has a linked fault tree contributes its fault tree as an AND-input. Use the same BDD/ZBDD/MOCUS algorithm to get the MCS for this compound fault tree.
   c. Collect the cut sets for that sequence and fill `EtSequenceResult.cut_sets`.
   d. Build `EtPathStep` list from `SequenceResult.path`.

5. Return `EtQuantificationResult` with all sequences and `total_cdf = sequences.iter().map(|s| s.frequency).sum()`.

**Note on cut sets for sequences:** The cut sets of a sequence are the MCS of the conjunction of all fault trees whose functional events are in the FAILURE state along that sequence's path. For sequences where all functional events succeed, the cut sets are empty (success path).

- [ ] Task 4.4 — Implement Monte Carlo Event Tree Quantification

**File:** `packages/engine/praxis/src/openpra_mef/event_tree_quantification.rs`

**Function to implement:**

```rust
fn quantify_event_tree_monte_carlo(
    ie: &InitiatingEvent,
    event_tree: &EventTree,
    fault_trees: &HashMap<String, MefFaultTreeGraph>,
    num_samples: usize,
) -> Result<EtQuantificationResult>
```

**Logic:**

1. Build a `Model` instance the same way as Task 4.3.
2. Use the existing `DpEventTreeMonteCarloAnalysis` from `crate::mc::event_tree`. This already supports event trees with model-linked fault trees.
3. Call:
   ```rust
   let mut mc = DpEventTreeMonteCarloAnalysis::new(
       ie.clone(), event_tree.clone(), &model, None, num_samples
   )?;
   let mc_result = mc.analyze()?;
   ```
4. Map `mc_result.sequences` (each `SequenceMonteCarloResult`) to `EtSequenceResult`:
   - `sequence_id = seq.sequence.id`
   - `frequency = seq.frequency_estimate`
   - `probability = Some(seq.probability_estimate)`
   - `path = []` (path reconstruction from MC is not trivially available; leave empty for now)
   - `cut_sets = []` (MC doesn't enumerate cut sets)
5. Return `EtQuantificationResult` with `num_samples = Some(num_samples)` and `total_cdf = sum of frequencies`.

- [ ] Task 4.5 — Register `event_tree_quantification` Module in `openpra_mef/mod.rs`

**File:** `packages/engine/praxis/src/openpra_mef/mod.rs`

**Fix:** Add `pub mod event_tree_quantification;` to the module declarations.

- [ ] Task 4.6 — Add `quantify_event_tree` NAPI Binding

**File:** `packages/engine/praxis/src/openpra_mef/napi.rs`

**Current state:** Only `quantify_fault_tree` NAPI binding exists at line 2350.

**Fix — Add inside the `#[cfg(feature = "napi-rs")] mod node_bindings` block, after the `quantify_fault_tree` binding:**

```rust
#[napi]
pub fn quantify_event_tree(request_json: String) -> napi::Result<String> {
    crate::openpra_mef::event_tree_quantification::quantify_event_tree_contract(&request_json)
        .map_err(|e| Error::from_reason(e.to_string()))
}
```

**Document the expected JSON shape** in the inline doc comment (same pattern as `quantify_fault_tree` comment at lines 2338–2349).

---

## Group 5 — PRAXIS Engine: Extend BDD/ZBDD/MOCUS for Event Tree Per-Sequence Cut Sets

- [ ] Task 5.1 — Make `mef_graph_to_fault_tree` Public and Reusable

**File:** `packages/engine/praxis/src/openpra_mef/fault_tree_quantification.rs`

**Current state:** `mef_graph_to_fault_tree()` (line 414) is a private `fn`.

**Fix:** Change it to `pub fn mef_graph_to_fault_tree(...)` so it can be called from `event_tree_quantification.rs`.

Also make `inline_transfer_trees()` (line 316), `is_basic_event_type()` (line 512), `extract_probability()` (line 519), `finish_with_cut_sets()` (line 254), and `CutSetResult` (line 159) `pub` so they can be reused.

- [ ] Task 5.2 — Build Per-Sequence Compound Fault Tree for Cut Set Extraction

**File:** `packages/engine/praxis/src/openpra_mef/event_tree_quantification.rs`

For each sequence, the cut sets are the MCS of the AND-combination of all fault trees linked to functional events that are in the FAILURE state along the sequence's path.

**Function to implement:**

```rust
fn build_sequence_fault_tree(
    sequence_path: &[(String, String)],       // (fe_id, state) pairs
    functional_events: &HashMap<String, FunctionalEvent>,
    fault_trees: &HashMap<String, MefFaultTreeGraph>,
    model: &Model,
) -> Option<FaultTree>
```

**Logic:**

1. Collect all FE IDs where `state == "failure"` (or is not `"success"`) along the path.
2. For each such FE, if it has a `fault_tree_id`, look up the corresponding `FaultTree` in the model.
3. If there is only one failure FE with a fault tree, return that fault tree directly.
4. If there are multiple failure FEs each with fault trees, build a synthetic AND-gate fault tree whose inputs are the top-event gates of each constituent fault tree's nodes.
5. If no failure FEs have fault trees, return `None` (no cut sets computable, or use direct probability).

- [ ] Task 5.3 — Add Unit Tests for Event Tree Quantification in PRAXIS

**File (new):** `packages/engine/praxis/src/openpra_mef/event_tree_quantification.rs` (in `#[cfg(test)] mod tests`)

**Tests to implement:**

- `test_simple_two_branch_bdd`: Two branches (success/failure), one FE with a simple fault tree. Verify sequence frequencies sum correctly.
- `test_simple_two_branch_zbdd`: Same but with ZBDD; verify cut sets are returned for the failure sequence.
- `test_simple_two_branch_mocus`: Same but with MOCUS.
- `test_simple_two_branch_monte_carlo`: Same but with Monte Carlo (10000 samples). Verify frequency estimates are within ±10% of expected.
- `test_no_fault_tree_uses_direct_probability`: FE has `success_probability=0.9` (no fault tree). Verify sequence probabilities = 0.9 and 0.1 × IE freq.
- `test_multiple_failure_fes_cut_sets`: Two FEs both in failure state, each with a fault tree. Verify cut sets are the Cartesian product.

---

## Group 6 — Backend: Wire Fault Trees into the Event Tree Quantification Request

- [ ] Task 6.1 — Fetch and Attach Linked Fault Trees in `GraphModelService.quantifyEventTree`

**File:** `packages/web-backend/src/graphModels/graphModel.service.ts`

**Problem:** The event tree quantification needs the fault tree graphs for each functional event's linked fault tree. The backend must fetch these before passing the request to PRAXIS.

**Fix — Update `quantifyEventTree` method (from Task 3.1):**

After fetching the event tree graph, extract all `faultTreeId` values from the ReactFlow column nodes. For each unique `faultTreeId`, fetch the `FaultTreeGraph` from the database using `this.getFaultTreeGraph(faultTreeId)`. Collect them into a `Record<string, FaultTreeGraph>`. Include this map as `fault_trees` in the request JSON passed to PRAXIS.

```typescript
const faultTreeIds = new Set<string>();
for (const node of graph.nodes) {
  if (node.data?.faultTreeId) {
    faultTreeIds.add(node.data.faultTreeId as string);
  }
}
if (graph.functionalEvents) {
  for (const fe of Object.values(graph.functionalEvents)) {
    if (fe.faultTreeId) faultTreeIds.add(fe.faultTreeId);
  }
}
const faultTrees: Record<string, object> = {};
for (const ftId of faultTreeIds) {
  faultTrees[ftId] = await this.getFaultTreeGraph(ftId);
}

const request: EventTreeQuantificationRequest & { faultTrees?: Record<string, object> } = {
  graph: graph as unknown as EventTreeQuantificationRequest["graph"],
  faultTrees,
  ...options,
};
```

---

## Group 7 — Frontend: Save `faultTreeId` Data to Backend on Graph Save

- [ ] Task 7.1 — Ensure `faultTreeId` from Column Nodes is Persisted in the Event Tree Graph Save

**File:** `packages/frontend/web-editor/src/app/pages/fullScopePages/eventTrees.tsx`

**Problem:** When the event tree is saved (via the graph save API), the `faultTreeId` field on each column node's `data` object must be included in the saved payload. Check the existing save flow to confirm the full `node.data` is persisted (it should be, since nodes are saved wholesale), but verify that the `faultTreeId` field on `ColumnNodeData` survives the serialization round-trip.

**Fix:** Audit `GraphApiManager.saveEventTree` (or equivalent) to confirm `node.data.faultTreeId` is included in the persisted JSON. If the save uses a whitelist of fields, add `faultTreeId` to the whitelist.

**File to check:** wherever `GraphApiManager.saveEventTree` or `GraphApiManager.post(EventTreeGraphEndpoint, ...)` is called — confirm the full `nodes` array including `node.data` is sent.

---

## Group 8 — Frontend: Update Type Imports After Type Changes

- [ ] Task 8.1 — Update Import of `EventTreeQuantificationRequest` in `eventTreeQuantificationPanel.tsx`

**File:** `packages/frontend/web-editor/src/app/components/treeNodes/eventTreeEditorNode/eventTreeQuantificationPanel.tsx`

After Task 2.1 adds `EventTreeApproximation` to `shared-types`, import and use it:

- Add `EventTreeApproximation` to the import line (line 24).
- Replace the inline string literal for approximation state type with `EventTreeApproximation`.

- [ ] Task 8.2 — Update Import in `GraphApiManager.ts` if Needed

**File:** `packages/shared-sdk/src/lib/api/GraphApiManager.ts`

- Confirm `EventTreeQuantificationRequest` import (around line 107) picks up the new fields. No change needed if the import is from the same file — TypeScript will pick up the extended type automatically.

---

## Dependency Order Summary

```
Group 2 (types)
  → Group 1.3, 1.5 (frontend panel uses new types)
  → Group 3 (backend uses new types)
  → Group 4 (PRAXIS uses struct definitions)

Group 4.1–4.5 (PRAXIS module)
  → Group 4.6 (NAPI binding exposes it to Node.js)
  → Group 3 (backend calls NAPI binding)
  → Group 3 (backend endpoint calls backend service)
  → Group 1 (frontend calls backend endpoint)

Group 5 (cut set extraction per sequence)
  → Group 4.3 (deterministic path calls cut set builder)

Group 6 (backend fetches fault trees)
  → Group 3 (backend service enriches request)
  → Group 4 (PRAXIS receives fault trees in request)

Group 7 (frontend persists faultTreeId)
  → Group 6 (backend can read it from saved nodes)
```

---

## File Summary

| File                                                                                                             | Action                                                                | Task              |
| ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ----------------- |
| `packages/frontend/web-editor/src/app/components/treeNodes/eventTreeEditorNode/columnNode.tsx`                   | Remove inline `EuiSelect`, keep `faultTreeId` in data                 | 1.1               |
| `packages/frontend/web-editor/src/app/pages/fullScopePages/eventTrees.tsx`                                       | Add zoom in/out/fit buttons, wire properties panel                    | 1.2, 1.4          |
| `packages/frontend/web-editor/src/app/components/treeNodes/eventTreeEditorNode/eventTreeQuantificationPanel.tsx` | Add approximation/maxOrder/numSamples controls, rewrite results modal | 1.3, 1.5          |
| `packages/frontend/web-editor/src/app/components/treeNodes/eventTreeEditorNode/eventTreePropertiesPanel.tsx`     | **New file** — properties panel for column node FT linking            | 1.4               |
| `packages/shared-types/src/lib/types/eventTreeQuantification.ts`                                                 | Add approximation, maxOrder, numSamples, path, totalCdf fields        | 2.1               |
| `packages/shared-sdk/src/lib/api/GraphApiManager.ts`                                                             | Verify types, no change expected                                      | 2.2               |
| `packages/web-backend/src/graphModels/graphModel.service.ts`                                                     | Add `quantifyEventTree()` method with fault tree fetching             | 3.1, 6.1          |
| `packages/web-backend/src/graphModels/graphModel.controller.ts`                                                  | Add `POST /event-tree-graph/quantify` endpoint                        | 3.2               |
| `packages/engine/praxis/src/openpra_mef/event_tree_quantification.rs`                                            | **New file** — full event tree quantification contract                | 4.1–4.4, 5.2, 5.3 |
| `packages/engine/praxis/src/openpra_mef/mod.rs`                                                                  | Register new module                                                   | 4.5               |
| `packages/engine/praxis/src/openpra_mef/napi.rs`                                                                 | Add `quantify_event_tree` NAPI binding                                | 4.6               |
| `packages/engine/praxis/src/openpra_mef/fault_tree_quantification.rs`                                            | Make `mef_graph_to_fault_tree`, helpers pub                           | 5.1               |
