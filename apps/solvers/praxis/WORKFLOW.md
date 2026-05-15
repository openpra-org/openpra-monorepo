# PRAXIS Decision Diagram Workflow

## BDD

### BDD — No Limits

```
Input
 └─ build BddPdag
 └─ compute ordering + modules
 └─ build BddEngine
 └─ walk BDD → exact probability / frequency
 └─ CLI or XML output
```

### BDD — Limits Upfront (`--limit-order`, `--cut-off`, or both)

```
Input
 └─ build BddPdag
 └─ compute ordering + modules
 └─ build BddEngine
 └─ walk BDD with on-the-fly discard:
      depth > limit-order  → prune high branch immediately, do not recurse
      prob  < cut-off      → prune branch immediately, do not recurse
 └─ exact probability / frequency from retained paths only
 └─ CLI or XML output
```

No approximation is allowed for BDD. The `--approximation` flag must be rejected at argument validation.

---

## ZBDD — 4 Independent Workflows

---

### Workflow 1 — ZBDD, No Approximation, No Limits

```
Input
 └─ build BddPdag → ordering → BddEngine
 └─ sweep BDD → exact probability / frequency → CACHE
 └─ ZbddEngine::build_from_bdd(bdd, root, coherent=false)
      convert BDD → ZBDD via cofactoring
      minimize()  → every path in ZBDD = exactly one MCS
 └─ zbdd.count_by_order(zbdd_root)            [cheap walk, no materialization]
 └─ compute per-sequence min/max frequency     [cheap walk, no materialization]
 └─ SHOW METADATA
      Table 1: Sequence / Top Event | Exact Frequency   (from BDD cache)
      Table 2: Sequence / Top Event | Order | Count | Min Freq | Max Freq
 └─ PROMPT: enter --limit-order N and/or --cut-off P
 └─ FILTER the already-built ZBDD in-graph (no rebuild):
      zbdd.limit_order(zbdd_root, N)              if --limit-order provided
      zbdd.prune_below_probability(zbdd_root, P)  if --cut-off provided
      apply limit_order first if both are provided
 └─ exact frequency = BDD cache (unchanged, no recalculation)
 └─ FULL MATERIALIZATION (last step):
      zbdd.enumerate(filtered_root) → map to event names
 └─ CLI or XML output
```

**Invariant**: The exact frequency reported always comes from the BDD cache.
It never changes regardless of what limits the user chooses.
Limits only control which MCS appear in the final enumeration.

---

### Workflow 2 — ZBDD, Approximation, No Limits

```
Input
 └─ build BddPdag → ordering → BddEngine
 └─ ZbddEngine::build_from_bdd(bdd, root, coherent=false)
      convert BDD → ZBDD via cofactoring
      minimize()  → every path in ZBDD = exactly one MCS
 └─ compute approximate probability from full ZBDD:
      rare-event → zbdd.rare_event_probability(zbdd_root)
      mcub       → zbdd.min_cut_upper_bound_graph(zbdd_root)
 └─ zbdd.count_by_order(zbdd_root)            [cheap walk, no materialization]
 └─ compute per-sequence min/max frequency     [cheap walk, no materialization]
 └─ SHOW METADATA
      Table 1: Sequence / Top Event | Approximate Frequency
      Table 2: Sequence / Top Event | Order | Count | Min Freq | Max Freq
 └─ PROMPT: enter --limit-order N and/or --cut-off P
 └─ FILTER the already-built ZBDD in-graph (no rebuild):
      zbdd.limit_order(zbdd_root, N)              if --limit-order provided
      zbdd.prune_below_probability(zbdd_root, P)  if --cut-off provided
      apply limit_order first if both are provided
 └─ RECALCULATE approximate probability from filtered ZBDD:
      rare-event → zbdd.rare_event_probability(filtered_root)
      mcub       → zbdd.min_cut_upper_bound_graph(filtered_root)
 └─ FULL MATERIALIZATION (last step):
      zbdd.enumerate(filtered_root) → map to event names
 └─ CLI or XML output
```

**Invariant**: BDD is never swept. Approximate frequency is always derived from the ZBDD.
After filtering, the approximate frequency must be recalculated on the filtered ZBDD root
because the removed paths would otherwise still contribute to the sum.

---

### Workflow 3 — ZBDD, No Approximation, Limits Upfront

```
Input
 └─ build BddPdag → ordering → BddEngine
 └─ sweep BDD → exact probability / frequency → CACHE
 └─ build ZBDD from BDD with on-the-fly discard during construction:
      discard any path whose order exceeds --limit-order    (prune high branch)
      discard any path whose probability is below --cut-off (prune during traversal)
      never allocate ZBDD nodes for discarded paths
 └─ NO metadata display
 └─ exact frequency = BDD cache (no recalculation)
 └─ FULL MATERIALIZATION (last step):
      zbdd.enumerate(zbdd_root) → map to event names
 └─ CLI or XML output
```

**Invariant**: The ZBDD is never fully built. Pruning is integrated into the construction
so nodes that would be discarded are never allocated.
The exact frequency always comes from the BDD cache.

---

### Workflow 4 — ZBDD, Approximation, Limits Upfront

```
Input
 └─ build BddPdag → ordering → BddEngine
 └─ build ZBDD from BDD with on-the-fly discard during construction:
      discard any path whose order exceeds --limit-order    (prune high branch)
      discard any path whose probability is below --cut-off (prune during traversal)
      never allocate ZBDD nodes for discarded paths
 └─ NO metadata display
 └─ compute approximate probability from the already-pruned ZBDD:
      rare-event → zbdd.rare_event_probability(zbdd_root)
      mcub       → zbdd.min_cut_upper_bound_graph(zbdd_root)
 └─ FULL MATERIALIZATION (last step):
      zbdd.enumerate(zbdd_root) → map to event names
 └─ CLI or XML output
```

**Invariant**: BDD is never swept. The ZBDD is never fully built.
Pruning is integrated into construction. Approximate frequency is computed once
from the already-pruned ZBDD root.

---

## Metadata Format (Workflows 1 and 2 only)

### Table 1 — Sequence / Top Event Summary

| Sequence / Top Event | Frequency  |
|----------------------|------------|
| SEQ-001              | 1.23e-05   |
| SEQ-002              | 4.56e-07   |
| TOP (fault tree)     | 7.89e-06   |

### Table 2 — MCS Order Distribution

| Sequence / Top Event | Order | Count | Min Frequency | Max Frequency |
|----------------------|-------|-------|---------------|---------------|
| SEQ-001              | 1     | 3     | 1.23e-06      | 4.56e-05      |
| SEQ-001              | 2     | 12    | 2.34e-08      | 1.23e-06      |
| SEQ-002              | 1     | 5     | 2.34e-07      | 9.87e-06      |
| TOP                  | 1     | 2     | 3.11e-06      | 7.89e-06      |
| TOP                  | 2     | 8     | 1.00e-08      | 3.10e-06      |

---

## Decision Matrix

| Workflow | Approximation | Limits       | BDD swept | Full ZBDD built | Metadata shown | Freq recalculated after filter |
|----------|--------------|--------------|-----------|-----------------|----------------|-------------------------------|
| 1        | no           | none → prompt| yes       | yes             | yes            | no (BDD cache reused)         |
| 2        | yes          | none → prompt| no        | yes             | yes            | yes (ZBDD re-swept)           |
| 3        | no           | upfront      | yes       | no (on-the-fly) | no             | no (BDD cache reused)         |
| 4        | yes          | upfront      | no        | no (on-the-fly) | no             | no (computed once on pruned)  |

---

## Module Boundaries

Each workflow is an independent module. They do not share runtime state.
Data flows between modules only through well-defined interfaces:

```
BddPdag  →  BddEngine  →  [BDD cache]
                       →  ZbddEngine  →  [metadata]  →  [filtered ZbddEngine]  →  materialization
```

- **BDD cache**: `(sequence_id, probability, frequency)` tuples, produced by the BDD sweep.
- **ZbddEngine**: opaque structure passed between the build step, the metadata step, the filter step, and the materialization step. Never reconstructed mid-workflow.
- **Materialization**: `Vec<CutSet>` produced once at the very end. Never intermediate.
