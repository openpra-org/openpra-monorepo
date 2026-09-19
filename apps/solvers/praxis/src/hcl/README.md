# PRAXIS HCL bridge

This directory contains the computational bridge between PRAXIS BDDs and
TensorBayes, the public probability API and the existing application analyses.

The probability path (`api.rs`, `model.rs`, `quantify.rs`) is unchanged from
main commit `96b949e96ccbb2fa6eef7a27170dfc9cb9f54182`.
`quantify_hcl` accepts the original `HclSettings` and returns the original
`HclResult`: probability and diagnostics only. It performs no cut-set,
importance or uncertainty calculation.

The application API in `analysis/` uses that same original `HclQuantifier`.
It supports probability batches, hazard integration and explicitly configured
uncertainty. Probability execution performs no cut-set enumeration, product
scoring or importance calculation. Tasks 10–11 are deferred pending a future
methodological review; their dependent displays and exports are disabled.
The removed implementation is preserved in `outputs/hcl-probability-only/before.zip`.
FT probability sampling, explicit CPT priors and seismic generators follow HCL_MH;
see [the uncertainty source map](uncertainty/SOURCE.md), including the aligned
summary statistics. Point hazard convolution follows HCL_MH; see
[the hazard source map](HAZARD_SOURCE.md). Task 23 removed sampled hazard
convolution and enforces HCL_MH's point-only guard.

The addon supplies BN-linked events first. `ordering.rs` ports HCL_MH's strict
two-block configuration: stable BN depth order (mapping order breaks ties),
then BFS over FT-only events, with unvisited events appended alphabetically.
Dependency grouping and group interleaving are disabled. Sources are
`oracle/bn_path_oracle.py::compute_topological_order`,
`oracle/hcl_integration.py::derive_inter_order_from_yaml` and
`utils/bdd_ordering.py::compute_ft_bfs_order` under `resources/HCL_MH`.
An explicit supplied order takes precedence. For event trees it is filtered
to each sequence's events and must cover every event in that sequence once.
Each sequence keeps its own BDD; no end-state union BDD is built.

The original main probability API itself remains unchanged: callers of
`quantify_hcl` supply `HclSettings.variable_order` when required. The application's
default ordering is supplied outside that API.

The CLI and `HclRequest` retain main's probability-only schema. Uncertainty
settings belong to the analysis API, not the original probability request.

## Execution scope and sources

The CLI request and addon envelope are separate contracts. CLI schema version
`1` uses names and snake_case fields; addon protocol `1.0.0` uses workbook IDs,
camelCase fields and model snapshots. Neither contract can replace the other.

| Capability | HCL CLI / original `quantify_hcl` | Rust application API / addon / GUI | Solver source |
| --- | --- | --- | --- |
| FT top-event probability, mixed independent/BN events, state subsets and hard evidence | Supported | Supported | Main [API](api.rs) and [conditional Shannon bridge](quantify.rs) |
| Standalone BN prior/posterior marginals and evidence batches | Outside the HCL CLI | Supported through the BN adapter and editor | Main [TensorBayes engine](../../../tensorbayes/src/engine.rs); [batch adapter](bayesian.rs) |
| HCL FT/ET evidence scenarios and compilation reuse | One FT request per invocation | Supported; FT reuses one BDD, ET reuses its sequence BDDs | Main quantifier/cache semantics; [application batching](analysis/mod.rs) |
| ET sequences, shared events and FT/ET transfers | FT input only | Supported with separate sequence BDDs | PRAXIS [sequence formulas](../analysis/sequence_formula.rs), main HCL, HCL_MH [path enumeration](../../../../../resources/HCL_MH/et/et_compiler.py) |
| Sequence annual frequency and end-state totals | Not exposed | Supported; sum sequence frequencies and aligned UQ samples | [ET adapter](../../../praxis-node/src/event_tree.rs); approved sequence-sum and unit-conversion exceptions |
| FT/CPT uncertainty, MC/LHS, vector evaluation, seismic fragility, PGA bins and seven summaries | Not exposed | Explicit `UNCERTAINTY` selection for HCL FT/ET, including evidence batches | HCL_MH [uncertainty source map](uncertainty/SOURCE.md), using main TensorBayes inference |
| Point hazard convolution | Not exposed | Supported for probability batches | HCL_MH [weighting and aggregation](HAZARD_SOURCE.md) |
| Cartesian hazard scenarios, exclusions and limits | Not exposed | Source generator exposed through addon/backend and GUI | HCL_MH [scenario-generation source map](HAZARD_SWEEP_SOURCE.md) |
| BDD order | Explicit order, otherwise normal PRAXIS order | BN-first default; explicit API order wins; GUI displays the order but cannot edit it | Main explicit-order API; HCL_MH [ordering port](ordering.rs) |
| Constant folding and null-gate splicing | Optional FT settings, default false | FT settings only; hidden in the ET editor | Main BDD build options; ET uses its sequence builder |
| BDD/junction-tree/cache diagnostics | Returned with probability | Displayed and saved; UQ counters describe the point pass only | Main counters; [diagnostics source map](../../../../docs-md/guides/result-presentation-source-map.md) |
| Cut sets, importance and sampled hazard convolution | No HCL execution | Removed or disabled; no FT/ET cut-set exposure in the app/addon | Deferred cut-set/importance review; HCL_MH point-hazard guard |

Ordinary PRAXIS cut-set algorithms remain in the Rust library and non-HCL CLI.
Standalone FT uncertainty is not exposed by the ordinary FT addon. FT uncertainty
in the table runs through an HCL configuration and can include unbound events.

The source references identify the selected implementations, not the historical
origin of every branch edit. Main is pinned above. HCL_MH file hashes, numerical
dependencies and original licenses are recorded in the source maps and
[verification manifest](../../tests/hcl-reference-manifest.json).
Editors, transport, IDs, run history and display controls are application code;
they do not introduce solver methods. See the [addon contract](../../../praxis-node/README.md),
[execution source map](../../../../docs-md/guides/praxis-execution-source-map.md),
[history source map](../../../../docs-md/guides/analysis-run-history-source-map.md)
and [visual submodels/templates](../../../../docs-md/guides/bayesian-network-submodel-template-source-map.md).

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

## Added analyses: definitions and limits

- **Sequence frequency:** `f_s = annual_initiating_frequency * P(sequence_s | evidence)`.
  A transfer adds destination branch conditions; it applies the source initiating
  frequency once. End-state frequency sums the corresponding sequence frequencies.
  This uses the approved sequence method and assumes mutually exclusive paths;
  it performs no general Boolean-union/disjointness calculation.
- **Uncertainty:** generate paired FT/CPT sample vectors, then evaluate each BDD
  using HCL_MH's vector recurrence `low + p * (high - low)`. FT LHS uses strata
  and inverse CDFs; BN-prior LHS preserves the source's Beta/Gamma sorting and
  shuffling routine. Fragility shares one sampled capacity across that component's
  CPT rows; PGA bins convert sampled frequencies using the source Poisson/linear
  formulas. All expressions, clipping, draw order and dependencies are specified
  in the [uncertainty source map](uncertainty/SOURCE.md).
- **Summaries:** mean, population SD (`sqrt(sum((x - mean)^2) / N)`), minimum, maximum,
  median and linear-interpolated 5th/95th percentiles follow HCL_MH/NumPy.
  End-state UQ sums aligned sequence samples before summarizing; it does not add
  sequence percentiles or standard deviations.
- **Point hazard:** `w_i = P(all scenario observations_i | base evidence)`.
  Optional normalization divides by the selected total mass. Convolved probability
  is `sum(weight_i * conditional_probability_i)`; annual frequency applies the
  separate annual scale. Zero-weight rows are skipped and an all-zero grid returns
  zero. See [weight definitions and source arithmetic](HAZARD_SOURCE.md).
- **Rate conversion:** FT failure rates use HCL_MH's literal
  `1 - exp(-rate * mission_time)` from [calculation type 3](../../../../../resources/HCL_MH/uq/basic_event_models.py).
  Generic FT linear conversion is removed; PGA-bin linear conversion is a separate
  source generator. The approved [unit conversion](../quantitative.rs) defaults
  to 8,760 hours per year and preserves explicit saved exposure values.

At the application boundary, `calculationType: "PROBABILITY"` is the default.
Saved uncertainty settings remain in the workbook but are omitted from probability
execution. `"UNCERTAINTY"` requires configured inputs and cannot be combined with
hazard convolution. Direct Rust analysis callers provide `HclAnalysisSettings`;
core hazard functions reject active uncertainty settings. Neither core nor app
supports sampled hazard integration.

Point and per-sample BDD evaluation is mathematically exact for the supplied
probabilities. Floating-point source complement subtraction can lose relative
precision on rare noncoherent paths. The
[verification report](../../docs/HCL_VERIFICATION.md) records tested tolerances,
observed limits and the distinction between reconstructed and published case studies.

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

See [the request schema and runnable example](REQUEST_SCHEMA.md) for the
versioned request, FT input, canonical BN layout, evidence and result fields.
The independent unified-BN and brute-force verification gate is documented in
[`../../docs/HCL_VERIFICATION.md`](../../docs/HCL_VERIFICATION.md).
