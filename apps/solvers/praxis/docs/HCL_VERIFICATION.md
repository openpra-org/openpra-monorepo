# HCL numerical verification

## Verification claim

PRAXIS HCL quantification is checked against independently evaluated forms of
the same coupled fault-tree/Bayesian-network problem. The gate is intended to
detect errors in binding semantics, conditional Shannon traversal, path
evidence, variable ordering, and cache handling.

The verification does not use probability values copied from an old README.
It executes the models and compares computed results.

## Independent evaluation paths

`tests/hcl_equivalence.rs` evaluates each suitable case through three paths:

1. **PRAXIS HCL:** `quantify_hcl` builds a BDD and performs conditional Shannon
   traversal. This is the implementation under test.
2. **Unified BN:** a test-only converter clones the original BN, adds Boolean
   indicator nodes for bound fault-tree events, root nodes for independent
   events, and deterministic CPT nodes for gates. TensorBayes then queries the
   unified top node directly. This path never builds a BDD and never calls the
   HCL traversal.
3. **Brute-force enumeration:** for bounded small cases, the test enumerates
   every original BN assignment and every independent Boolean-event assignment,
   multiplies the original CPT and event probabilities, evaluates the PDAG as
   Boolean logic, and normalizes by base-evidence mass. It uses neither the HCL
   traversal nor junction-tree inference.

The legacy case adds a fourth reference: its pre-generated Python unified XDSL
is loaded and queried directly. This checks the new Rust paths against a frozen
artifact produced by the previous implementation.

The test-only unified conversion is:

- unbound basic event -> binary root with CPT `[1 - p, p]`;
- bound basic event -> deterministic binary indicator of its configured BN
  state subset;
- gate -> deterministic binary CPT over its unique input nodes;
- base evidence -> hard evidence on the original BN node;
- query -> probability that the unified top node is `true`.

Separate indicator nodes are important when multiple Boolean events represent
different, possibly overlapping state subsets of one multi-state BN node.

## Cases and recorded results

Recorded on 2026-08-15 with an absolute comparison tolerance of `1e-12`.

| Case | Coverage | Result |
| --- | --- | --- |
| Legacy `lazy_k5` | Original OpenPSA FT, original six-node correlated BN, five bound events, twelve independent events, old Python unified BN | All four paths agree: `P(Top) = 1.9089215571816247e-2`; brute-force accumulation differs by `5.76e-16` |
| Multi-state evidence | Two Boolean events mapped to overlapping subsets of one three-state node, child-node hard evidence, AND and NOT gates | Both BDD orders, unified BN, and enumeration agree: `P(Top given Signal=on) = 0.24 / 0.37 = 0.6486486486486487` |
| Cache invariance | Repeat the same Shannon query, confirm cache reuse, clear caches, query again | Cached and post-clear probabilities equal the enumeration oracle |

The legacy fixture and its provenance are documented in
[`tests/data/hcl_legacy/README.md`](../tests/data/hcl_legacy/README.md).
Only model inputs were retained. GeNIe presentation extensions, GUI code,
profilers, plotting, benchmark drivers, and the legacy test harness were not
copied.

## Reproducing the gate

From `apps/solvers/praxis`:

```bash
cargo test --test hcl_equivalence
```

The equivalence test remains part of the full regression command:

```bash
cargo test --lib --tests
```

## What this does and does not establish

The frozen and rebuilt unified-network paths still use TensorBayes for their
final query, so agreement with those paths alone would not independently prove
the BN engine. Brute-force enumeration closes that gap for these bounded cases.
TensorBayes itself also has the Phase 2 C++ comparison and enumeration corpus in
`apps/solvers/tensorbayes/verification`.

Current HCL path contexts are hard state-subset constraints (zero/one
likelihoods), not general soft evidence. The separator-variable soft-evidence
defect found in the old C++ BNCore therefore is not exercised by this HCL case;
it remains covered by TensorBayes Phase 2 verification.

This gate verifies scalar exact quantification. It is not a performance
benchmark, an uncertainty-quantification comparison, or broad validation of
every legacy dissertation model. Additional compact legacy cases should be
added only when they contribute a distinct semantic feature.
