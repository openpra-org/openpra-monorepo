# Event Tree Editor Completion Plan (Final Revision)

This document outlines the tasks required to complete the Event Tree implementation. It emphasizes a simplified user-facing model, robust logical linking, and a high-performance, distributed-ready PDAG architecture in the PRAXIS solver.

## 1. Simplified Frontend Model & Schema

The UI will focus on a "Column-and-Sequence" view (Functional Events as columns, Sequences as rows) while the backend maintains the full logical integrity required for a PDAG.

- [ ] **Define Flattened `EventTreeGraph` Schema**:
  - Focus on **Functional Events** (columns) and **Sequences** (paths).
  - Map the UI's table-like structure to a hierarchical MEF Event Tree representation during serialization.
- [ ] **Fault Tree Linking Support**:
  - Add `faultTreeId` to Functional Event definitions.
  - Implement a selection UI in the Properties Panel to search and link existing Fault Trees.
- [ ] **Backend Persistence**:
  - Ensure `EventTreeGraph` in `web-backend` stores both the visual metadata (columns, rows) and the logical MEF structure.

## 2. Frontend: UI & Results Panel

- [x] **Quantification Toolbar**:
  - Add a "Quantify" button with an options modal for **Monte Carlo, BDD, ZBDD, and MOCUS**.
- [x] **Results Panel**:
  - Implement a side panel to display sequence frequencies and cut sets.
- [x] **Interactive Linking**:
  - Allow users to select a Functional Event column and link/unlink Fault Trees dynamically.

## 3. PRAXIS Solver: Complete PDAG Architecture

Instead of independent sequence formulas, PRAXIS will construct a single, unified Probability Directed Acyclic Graph (PDAG) for the entire Event Tree.

- [ ] **Unified PDAG Construction**:
  - Implement logic to build a single PDAG representing all paths in the Event Tree.
  - Share common sub-graphs (e.g., the same Fault Tree referenced across multiple branches) to minimize memory and compute footprint.
- [ ] **Path-Level Optimization**:
  - Implement optimization passes on the PDAG to identify independent modules and common sub-expressions.
  - This ensures that when distributed, the workload is partitioned based on logical complexity rather than just sequence count.
- [ ] **Algorithm Expansion (BDD, ZBDD, MOCUS)**:
  - Adapt the existing Fault Tree solvers (BDD for frequency, ZBDD/MOCUS for cut sets) to traverse and solve the Event Tree PDAG.
  - Ensure BDD supports frequency-only calculation for complex event sequences.

## 4. Distributed System Strategy

- [ ] **PDAG Partitioning for Distribution**:
  - Design the PDAG so that sub-graphs can be serialized and dispatched to distributed workers.
  - Exploiting the shared structure ensures that if multiple sequences share a large Fault Tree, the worker only computes it once.
- [ ] **Global State Management**:
  - Ensure the solver can aggregate results from distributed path-level computations back into the final Event Tree report.

## 5. Validation & E2E Testing

- [ ] **Verification**:
  - Create an Event Tree with shared Fault Trees across different branches.
  - Run ZBDD/MOCUS and verify that the cut sets and frequencies are calculated globally across the PDAG.
- [ ] **UI/Solver Sync**:
  - Validate that results appear in the frontend panel immediately after the solver completes its distributed run.
