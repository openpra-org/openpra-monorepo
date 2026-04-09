# Release Notes — Next Version

> This document tracks high-level feature areas and the specific changes made under each. It is used as the basis for the changelog when the next version of the app is released.

---

## 1. PRA Model & Authentication Infrastructure

New foundational layer for PRA model management and secure access.

- [ ] Add `pra-model` backend module with `pos` controller and service
- [ ] Add MinIO storage service for file/artifact persistence (`minio-storage.service`)
- [ ] Add `MINIO_USE_SSL` and `MINIO_OPENPRA_BUCKET` environment variable support
- [ ] Introduce `zod-dto` validation utilities and refactor existing DTOs
- [ ] Add frontend API clients: `apiClient`, `posApi`, `praModelApi`
- [ ] Introduce `PrivateRoute` component and update `AuthContext` for protected routes
- [ ] Refactor `loginForm` and `rootHeader` for authenticated session handling
- [ ] Refactor `mef-types` exports and structural updates

---

## 2. Typed Model Schema & Timestamp Handling

Cleanup and standardization of typed model schemas and list display.

- [ ] Standardize typed model schemas across all four hazard types (InternalEvents, InternalHazards, ExternalHazards, FullScope) — remove redundant fields, normalize schema shape
- [ ] Add timestamp (`createdAt`, `updatedAt`) support to typed model schemas
- [ ] Refactor `GenericList`, `GenericListItem`, and `LastActionText` components to display timestamps
- [ ] Handle numeric IDs in `rootHeader` (display model ID badge)
- [ ] Purge large/stale type definitions from `shared-types` `typedModel.ts`

---

## 3. Component Parameters (Data Analysis)

New nested model type for component reliability / data analysis.

- [ ] Add `ComponentParameter` schema, DTO, and Mongoose model in backend
- [ ] Add `ComponentParameterApiManager` in `shared-sdk`
- [ ] Add component parameter CRUD endpoints to `nestedModel.controller`
- [ ] Add component parameter entries to the nested model service
- [ ] Build `dataAnalysisDetail` page with nested parameter management UI
- [ ] Build `componentReliabilityTable` component with inline editing
- [ ] Update `NestedModelsState` and `NestedModelsType` in Zustand store for component parameters
- [ ] Refactor `TypedModelApiManager` — split out dedicated managers to reduce size
- [ ] Refactor `NestedModelApiManager` — extract component parameter calls into dedicated manager

---

## 4. Systems Analysis — FMEA Table

New FMEA (Failure Modes and Effects Analysis) module under Systems Analysis.

- [ ] Add `FmeaSchema` and backend FMEA service with CRUD operations
- [ ] Build `fmeaTable` component with inline cell editing
- [ ] Add column setup modal to `systemsAnalysisDetail` page
- [ ] Introduce auto-calculated risk columns and computed column definitions in `FmeaApiManager`
- [ ] Adapt backend schema and service to handle new FMEA column structures
- [ ] Install and integrate `xlsx` utility for data export
- [ ] Update `systemsAnalysis` page to list FMEA entries

---

## 5. Systems Analysis — Fault Tree Editor

Significant improvements to the fault tree graph editor UX and correctness.

### 5a. Dynamic Node Labels

- [x] Node labels now display the user-assigned name (from the properties panel) instead of a hardcoded type string
- [x] Label falls back to the node type label when no name has been assigned

### 5b. Properties Panel Layout

- [x] Fix properties panel top clipping behind the fixed breadcrumb header
- [x] Replace `height: 100%` inheritance chain with `position: absolute; inset: 0` on the inner flex container so the panel is reliably bounded by the explicitly-sized outer div regardless of EUI page template wrapping
- [x] Outer `FaultTreeEditor` div uses `position: relative` + `height: calc(100vh - var(--euiFixedHeadersOffset, 0px))` + `overflow: hidden` as the single height authority

### 5c. Node Hover & Inline Editing

- [x] Remove the inline-editable textarea from `FaultTreeNodeLabel` — replaced with a plain display `<div>`
- [x] Eliminate the edit cursor (`text` / pencil icon) that appeared on node hover
- [x] Remove the inline edit path that was overriding names set via the properties panel
- [x] Single source of truth for node name: `data.quantification.name` via the properties panel only

### 5d. Node & Gate ID Generation

- [x] Fix gibberish UUID-style IDs for gate nodes
- [x] `getBasicEventNode()` now accepts the current node list and assigns the next sequential integer ID (`max(existing IDs) + 1`)
- [x] All three `getBasicEventNode()` call sites in `useFaultTreeContextMenuClick` updated to pass current nodes

### 5e. Edge `+` Button — Node Type Picker

- [x] Remove hardcoded "always insert NOT gate" behavior from the `+` button on edges
- [x] Clicking `+` now opens a type-picker popover (AND, OR, AT-LEAST, NOT, TRANSFER, HOUSE, BASIC EVENT) identical in style to the node context menu's type list
- [x] All nodes inserted via the `+` button receive sequential integer IDs (no more UUIDs)
- [x] `+` button now adds the new node as a **sibling** of the edge's target (new child of the parent), instead of inserting it between parent and child — the existing edge is preserved
- [x] Gate types auto-create their required children: AND/OR/AT-LEAST → 2 basic events; NOT → 1 basic event; leaf types → no children
- [x] `+` button is blocked when the parent is a NOT gate (which must have exactly one child)

### 5f. Context Menu Cleanup

- [x] Remove the non-functional "Import JSON" option from the node right-click context menu

---

## 6. Plant Diagrams (P&ID)

New plant diagram viewer/editor module across all four hazard model types.

- [ ] Add `PlantDiagram` backend module, controller, schema, and service
- [ ] Add `PlantDiagramApiManager` in `shared-sdk`
- [ ] Build `plantDiagramEditor` page with ReactFlow canvas
- [ ] Build `pidSymbols` component library for P&ID symbol rendering
- [ ] Implement DEXPI/Proteus XML parser (`dexpiParser`) for diagram imports
- [ ] Add `symbolPalette` component for drag-and-drop symbol insertion
- [ ] Add collapsible sidebar (`collapsibleSidebar`) for editor tooling
- [ ] Wire plant diagrams into navigation for all four model containers (InternalEvents, InternalHazards, ExternalHazards, FullScope)
- [ ] Update `navConfig` to include plant diagrams entry

---

## 7. Backend — Nested Model Infrastructure Fixes

Correctness fixes to the nested model create/delete pipeline.

### 7a. CastError: ObjectId vs Numeric ID

- [x] Fix `CastError: Cast to ObjectId failed` when creating fault trees — `TypedModel` schema uses `_id: false` and integer `id` field; queries in `NestedModelHelperService` were incorrectly using `{ _id: typedModelId }` instead of `{ id: Number(typedModelId) }`
- [x] Fix `CastError: Cast to Number failed for value "NaN"` — frontend was sending raw string IDs (`GetCurrentModelIdString()`) into `parentIds`; corrected to use the numeric `GetCurrentModelId()`

### 7b. Dead Code Removal — Frontend Zustand Store

- [x] Remove `AddToParentModel` and `RemoveFromParentModel` calls from `FaultTreesActions` — these compared numeric `parentIds` against MongoDB ObjectId strings and never matched; the typed model's `faultTrees` array is not used for loading
- [x] Fault trees are always loaded via `FaultTree.find({ parentIds: parentId })` — the `faultTrees` array on the typed model document is not read

### 7c. Dead Code Removal — Backend Service

- [x] Remove `AddNestedModelToTypedModel` loop from `FaultTreesService.createFaultTree` — redundant for the same reason as 7b
- [x] Remove `RemoveNestedModelToTypedModel` loop from `FaultTreesService.deleteFaultTree` — same redundancy
- [x] Remove unused `typedModel: TypedModelType` parameter from both `createFaultTree` and `deleteFaultTree`
- [x] Remove `NestedModelHelperService` constructor injection from `FaultTreesService` — no longer used
- [x] Update `nestedModel.controller` call sites to match the simplified signatures

### 7d. NestedModelHelperService Robustness

- [x] Fix `AddNestedModelToTypedModel` and `RemoveNestedModelToTypedModel` — queries now use `{ id: numericId }` instead of `{ _id: typedModelId }`
- [x] Add NaN guard with `Logger.warn` in both methods to prevent Mongoose casting errors from corrupt `parentIds`

---

## 8. Navigation & Layout

Structural UI improvements to page containers and navigation.

- [ ] Refactor `recentModelsPage` — simplify layout and data loading
- [ ] Update all four page containers (InternalEvents, InternalHazards, ExternalHazards, FullScope) to use shared sidebar and layout patterns
- [ ] Add `collapsibleSidebar` component for editor pages
- [ ] Update `navConfig` for new module entries

---

## Legend

| Symbol | Meaning                                                      |
| ------ | ------------------------------------------------------------ |
| `[x]`  | Completed / merged                                           |
| `[ ]`  | Implemented on `revamp` branch, pending final review / merge |
