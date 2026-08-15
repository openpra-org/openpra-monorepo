# PRAXIS HCL bridge

This directory contains the Phase 3 computational bridge between PRAXIS BDDs
and TensorBayes. It deliberately does not define model files, CLI arguments, or
the final OpenPRA request/response envelope; those belong to Phase 4 and later.

## Model boundary

An `HclEventBinding` maps one Boolean BDD variable to a non-empty, non-total
subset of states on one TensorBayes node. The Boolean event is true exactly when
the BN node occupies one of those states. Multiple Boolean variables may map to
different partitions of the same multi-state BN node.

`HclBaseEvidence` contains persistent hard BN observations. BDD decisions add
temporary set-valued evidence while traversing a path. Unbound BDD variables
continue to use the independent probabilities already stored in the BDD.

## Quantification

At a bound BDD node `x`, `HclQuantifier` evaluates

```text
P(F | context)
  = P(x | context) P(high | context, x)
  + P(not x | context) P(low | context, not x)
```

TensorBayes supplies each conditional probability. The branch context records
the exact allowed-state mask for every BN node, so correlation is preserved
across BDD decisions. Complemented BDD references are evaluated as the
probability complement of their regular reference.

Two caches are maintained per quantifier:

- BDD reference plus exact BN path context to quantified probability.
- Bound BDD variable plus exact BN path context to a TensorBayes marginal.

Changing base evidence clears both bridge caches and the TensorBayes workspace
cache. The compiled junction tree and bindings remain reusable.

## Phase 3 API

- `HclEventBinding` and `HclEventBindings`
- `HclBaseEvidence`
- `HclQuantifier`
- `HclBridgeStats`
- `build_bdd_with_order` in `algorithms::build`

The higher-level `HclModel`, `HclSettings`, `quantify_hcl`, canonical BN input,
and CLI integration are intentionally deferred to Phase 4.
