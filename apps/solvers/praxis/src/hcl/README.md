# PRAXIS HCL bridge

This directory contains the computational bridge between PRAXIS BDDs and
TensorBayes plus the Phase 4 public API and model-input boundary. OpenPRA and
Praetor transport integration remains a Phase 5 concern.

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

## Public API

- `HclEventBinding` and `HclEventBindings`
- `HclBaseEvidence`
- `HclQuantifier`
- `HclBridgeStats`
- `build_bdd_with_order` in `algorithms::build`
- `HclModel`, `HclSettings`, `HclResult`, and `quantify_hcl`
- `CanonicalBayesianNetwork` and `parse_xdsl`
- `HclRequest` and `HclNetworkInput`

Bindings and evidence use fault-tree event, BN node, and BN state names at the
public boundary. They are resolved to dense TensorBayes IDs only after the
request and network have been validated.

## CLI

HCL is an opt-in branch of the existing command. The positional input remains
the normal OpenPSA XML or PBF fault tree:

```text
praxis-cli fault-tree.xml --hcl-request hcl-request.json
```

The result is JSON on stdout. `--output result.json` writes it to a file, and
`--print` also prints it when an output file is selected. Without
`--hcl-request`, all existing CLI behavior is unchanged.

See `REQUEST_SCHEMA.md` for the versioned request and canonical BN layouts.
The independent unified-BN and brute-force verification gate is documented in
[`../../docs/HCL_VERIFICATION.md`](../../docs/HCL_VERIFICATION.md).
