# TODO

> Implementation-plan-level task list. Items are grouped by feature area.
> Linked to CHANGELOG.md — when a task ships, move it there as `[x]`.

---

## 1. Fault Tree Editor

### 1a. New Node Default Quantification

- `getBasicEventNode()` creates nodes with `data: {}`. Auto-created children (via `+` button or context menu type change) should have `data: { quantification: defaultForType(nodeType) }` so the properties panel has sensible defaults on first open.
- **Where:** `treeUtils.ts → getBasicEventNode()`, `useEdgeClick.ts → useEdgeInsert()`.

### 1b. Properties Panel — Type-Change Reset

- When a node's type is changed via the right-click context menu, the properties panel syncs the node reactively but may carry stale quantification fields from the old type.
- On type change, reset `quantification` to `defaultForType(newType)` before persisting.
- **Where:** `useFaultTreeContextMenuClick.ts` — when `updateClickedNodeTo` is set, also patch `node.data.quantification`.

### 1c. AT-LEAST Gate — Child Count Validation

- The k-value in the properties panel must always be ≤ the number of children.
- Enforce this: clamp `kValue` to `childCount` when children are deleted; show inline validation error in the panel when `kValue > childCount`.
- **Where:** `faultTreePropertiesPanel.tsx → isAtLeast` section; `useFaultTreeContextMenuClick.ts → deleteNode`.

### 1d. Transfer Gate — Deep Link Navigation

- Selecting a target fault tree in the Transfer Gate properties panel already stores `targetFaultTreeId`.
- Add a "Go to target" button in the panel that navigates to `../<targetFaultTreeId>` (relative route within the same typed model).
- **Where:** `faultTreePropertiesPanel.tsx → isTransfer` section.

### 1e. Fault Tree Quantification Engine

- Traverse the tree bottom-up and compute point-estimate probability for each gate node.
  - AND: product of child probabilities
  - OR: 1 − ∏(1 − pᵢ)
  - NOT: 1 − p_child
  - AT-LEAST K-of-N: exact binomial sum
- Display the computed probability as the quantification label on each gate node (already wired via `getQuantificationLabel`).
- **Where:** new `src/utils/faultTreeQuantification.ts`; called in `faultTrees.tsx` after any node/edge change.

### 1f. Fault Tree Export (MEF / JSON)

- Add an "Export" button (toolbar or page header) that serialises the current graph to:
  - OpenPRA JSON (current graph format)
  - MEF XML (per the `mef-types` package schema)
- **Where:** new `src/utils/faultTreeExport.ts`; button in `faultTrees.tsx` toolbar `Panel`.

### 1g. Undo/Redo — Breadcrumb History Reset

- Currently `useUndoRedo` snapshots are per-store; navigating away does NOT clear the history.
- Clear `past`/`future` in the store when `faultTreeId` changes (already partially done via `setIsLoading(true)` reset, but the history arrays are never cleared).
- **Where:** `faultTrees.tsx → useEffect([faultTreeId])` — call `setPast([])` and `setFuture([])`.

---

## 2. Backend — Fault Tree Service

### 2a. Delete by Numeric ID

- `deleteFaultTree` in `fault-trees.service.ts` deletes by `{ _id: modelId }` (Mongoose ObjectId string).
- The controller passes `id` from `@Query("id")` as a `string | number`. Verify that string-form ObjectIds are passed correctly, not the numeric `id` field. Add a guard if needed.
- **Where:** `nestedModel.controller.ts → deleteFaultTree`, `fault-trees.service.ts → deleteFaultTree`.

### 2b. Fault Tree Graph Validation (Server-Side)

- `GraphApiManager.storeFaultTree` currently stores any graph without structural validation.
- Add basic validation in the backend: root node exists, no cycles, NOT gate has exactly 1 child, AT-LEAST gate k ≤ child count.
- **Where:** new `fault-tree-graph.validator.ts`; called in the graph storage endpoint.

---

## 3. FMEA Table

### 3a. Column CRUD

- Column setup modal (`systemsAnalysisDetail`) lets you define columns but the add/remove/reorder flow is incomplete.
- Implement: add column (pick type from enum), remove column, drag-to-reorder. Persist column schema to backend on each change.
- **Where:** `systemsAnalysisDetail.tsx`, `FmeaApiManager.ts`, `fmea.service.ts`.

### 3b. Risk Score Auto-Calculation

- Computed columns (`riskScore = severity × occurrence × detectability`) are defined in `FmeaApiManager` but not yet applied live in the table cells.
- Compute on the frontend whenever any of the three source cells change; also recompute on load.
- **Where:** `fmeaTable.tsx → cell onChange handler`.

### 3c. XLSX Export

- The `xlsx` package is installed. Wire up the "Export" button to serialise the current FMEA rows + column definitions to a `.xlsx` file and trigger a browser download.
- **Where:** `systemsAnalysisDetail.tsx`, new `src/utils/fmeaExport.ts`.

---

## 4. Component Parameters (Data Analysis)

### 4a. Connect Table to Backend CRUD

- `dataAnalysisDetail.tsx` renders the component parameter table but some create/update/delete calls may be hitting stub endpoints.
- Verify each operation against `ComponentParameterApiManager`; fix any mismatched route or payload shapes.
- **Where:** `dataAnalysisDetail.tsx`, `ComponentParameterApiManager.ts`, `nestedModel.controller.ts`.

### 4b. Bulk Import

- Add CSV import: parse rows client-side, POST each as a component parameter, refresh the table.
- **Where:** `dataAnalysisDetail.tsx`, new `src/utils/csvImport.ts`.

---

## 5. Plant Diagrams (P&ID)

### 5a. DEXPI Parser Edge Cases

- `dexpiParser.ts` handles common P&ID element types. Add handling for: unrecognised element types (fallback to generic shape), missing `ID` attributes, nested `Equipment` elements.
- **Where:** `dexpiParser.ts`.

### 5b. Symbol Palette — Drag to Canvas

- `symbolPalette.tsx` renders the palette but drag-and-drop onto the ReactFlow canvas is not yet connected.
- Implement `onDragStart` on palette items and `onDrop` / `onDragOver` on the ReactFlow canvas to create a new node at the drop position.
- **Where:** `symbolPalette.tsx`, `plantDiagramEditor.tsx`.

### 5c. Backend Persistence for Diagram Layout

- `PlantDiagramApiManager` has the CRUD calls but storing the full ReactFlow graph (nodes + edges + positions) needs a dedicated endpoint, separate from the DEXPI XML source.
- Add a `PUT /plant-diagrams/:id/graph` endpoint that stores serialised ReactFlow state.
- **Where:** `plant-diagram.controller.ts`, `plant-diagram.service.ts`, `plant-diagram.schema.ts`.

---

## 6. Navigation & Layout

### 6a. Breadcrumb — Show Model / Sub-model Name

- The breadcrumb currently shows raw URL path segments (e.g. `fault-trees / 640`).
- Resolve the numeric IDs to their label names (`label.name`) and display those instead.
- **Where:** `rootHeader.tsx → createBreadcrumbs()`; fetch from the Zustand store (data is already loaded).

### 6b. Page Container — Remove EUI Section Auto-Wrap Padding

- `FullScopeContainer` passes `<Outlet />` directly to `EuiPageTemplate`, which auto-wraps it in `EuiPageSection` and adds padding. This causes the `calc(100vh - ...)` height to be slightly off for full-bleed editor pages.
- Wrap the outlet in `<EuiPageTemplate.Section paddingSize="none" grow>` so padding is explicit and zero for editor routes.
- **Where:** `fullScopeContainer.tsx`; also `internalEventsContainer.tsx`, `internalHazardsContainer.tsx`, `externalHazardsContainer.tsx`.

### 6c. Sidebar — Active Route Highlight

- `collapsibleSidebar.tsx` renders nav items but does not highlight the currently active route.
- Use `useMatch` / `useLocation` to add an `isActive` style to the matching nav item.
- **Where:** `collapsibleSidebar.tsx`, `navConfig.ts`.

---

## 7. Authentication & Session

### 7a. Token Refresh

- `ApiManager.getTokenTimer()` is stored but no automatic refresh logic exists. When the JWT expires the user silently loses access.
- Implement a `setInterval`-based refresh that calls the `/auth/refresh` endpoint before expiry.
- **Where:** `rootContainer.tsx`, `ApiManager.ts` (or `AuthContext.tsx`).

### 7b. Login Error Feedback

- `loginForm.tsx` catches auth errors but does not display them in the UI.
- Show an `EuiCallOut` with the error message below the submit button.
- **Where:** `loginForm.tsx`.

---

## 8. Testing

### 8a. Fault Tree Hook Unit Tests

- `useFaultTreeContextMenuClick` has a spec stub but no actual tests.
- Cover: type change leaf→gate (child creation), type change gate→leaf (subtree deletion), NOT gate flush, delete node (reconnect), delete subtree.
- **Where:** `useFaultTreeContextMenuClick.spec.ts`.

### 8b. `useEdgeInsert` Unit Tests

- New hook with non-trivial branching (gate auto-children, NOT gate block, LEAF_TYPES, sequential IDs).
- Cover each branch with a minimal node/edge fixture.
- **Where:** new `useEdgeClick.spec.ts`.

### 8c. Backend Integration Tests for Fault Tree Service

- `fault-trees.service.spec.ts` is a stub.
- Add tests for `createFaultTree`, `deleteFaultTree`, `getFaultTree` against an in-memory MongoDB instance.
- **Where:** `fault-trees.service.spec.ts`.
