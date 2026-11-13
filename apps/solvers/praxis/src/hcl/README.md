# PRAXIS HCL bridge

This directory contains the computational bridge between PRAXIS BDDs and
TensorBayes, the public probability API and the existing application analyses.

The probability API (`api.rs`, `model.rs`) is unchanged from main commit
`96b949e96ccbb2fa6eef7a27170dfc9cb9f54182`. `quantify.rs` keeps that commit's
recurrence and changes only how results are cached and how many network
calibrations are run, see [Quantification](#quantification).
`quantify_hcl` accepts the original `HclSettings` and returns the original
`HclResult`: probability and diagnostics only. It performs no cut-set,
importance or uncertainty calculation.

The application API in `analysis/` uses that same original `HclQuantifier`.
It supports probability batches, hazard integration and explicitly configured
uncertainty. A probability run performs no cut-set enumeration unless ranked
cut sets are requested for a fault tree or an event tree, see
[Ranked cut sets](#ranked-cut-sets-of-event-tree-sequences). Importance is
available for probability runs, see
[Importance](#importance-under-the-network). The earlier product scoring of
cut sets is not restored.
The removed implementation is preserved in `outputs/hcl-probability-only/before.zip`.
FT probability sampling, explicit CPT priors and seismic generators follow HCL_MH;
see [the uncertainty source map](uncertainty/SOURCE.md), including the aligned
summary statistics. Point hazard convolution follows HCL_MH; see
[the hazard source map](HAZARD_SOURCE.md). Hazard convolution under
uncertainty is computed sample by sample, see
[Hazard grid under uncertainty](#hazard-grid-under-uncertainty).

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
| FT/CPT uncertainty, MC/LHS, vector evaluation, seismic fragility, PGA bins and seven summaries | Not exposed | Explicit `UNCERTAINTY` selection for HCL FT/ET, including evidence batches | PRAXIS uncertainty contract and sampler, HCL_MH vector evaluation and summaries, see the [uncertainty map](uncertainty/SOURCE.md) |
| Point hazard convolution | Not exposed | Supported for probability batches | HCL_MH [weighting and aggregation](HAZARD_SOURCE.md) |
| Cartesian hazard scenarios, exclusions and limits | Not exposed | Source generator exposed through addon/backend and GUI | HCL_MH [scenario-generation source map](HAZARD_SWEEP_SOURCE.md) |
| BDD order | Explicit order, otherwise normal PRAXIS order | BN-first default; explicit API order wins; GUI displays the order but cannot edit it | Main explicit-order API; HCL_MH [ordering port](ordering.rs) |
| Constant folding and null-gate splicing | Optional FT settings, default false | FT settings only; hidden in the ET editor | Main BDD build options; ET uses its sequence builder |
| BDD/junction-tree/cache diagnostics | Returned with probability | Displayed and saved; UQ counters describe the point pass only | Main counters; [diagnostics source map](../../../../docs-md/guides/result-presentation-source-map.md) |
| Ranked cut sets of event-tree sequences | Not exposed | Optional on ET probability runs, for base evidence, evidence scenarios and the hazard grid | PRAXIS cut-set structure, exact score from the HCL quantifier, see [Ranked cut sets](#ranked-cut-sets-of-event-tree-sequences) |
| Ranked cut sets of a fault tree | Not exposed | Optional on FT probability runs, for base evidence, evidence scenarios and the hazard grid | Same structure engine and score, see [Fault trees](#ranked-cut-sets-of-a-fault-tree) |
| Importance of basic events | Not exposed | Optional on FT and ET probability runs, for base evidence, evidence scenarios and the hazard grid | Exact conditioning on each event, see [Importance](#importance-under-the-network) |
| Importance under uncertainty | Not exposed | Optional on FT and ET uncertainty runs, for a chosen number of leading events | The same conditioning in the sampled pass, see [Importance under uncertainty](#importance-under-uncertainty) |
| Hazard convolution under uncertainty | Not exposed | FT and ET uncertainty batches with a hazard grid | Hazard weights and results sampled together, see [Hazard grid under uncertainty](#hazard-grid-under-uncertainty) |

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

TensorBayes supplies each conditional probability. The path context records
the exact allowed-state mask of every BN node that a BDD decision restricted, so
correlation is preserved across BDD decisions. Base evidence is fixed for a
quantification and is sent with every query. Complemented BDD references are
evaluated as the probability complement of their regular reference.

Two caches are maintained per quantifier ([context rules](context.rs)):

- BDD reference plus the relevant part of the path context to quantified
  probability.
- Bound BDD variable plus the relevant part of the path context to a
  TensorBayes marginal.

The relevant part is exact. A restriction is dropped only when its BN node is
d-separated from every BN node bound below the BDD reference (or from the
queried node), given the base evidence and the other restrictions. A node
observed in one state blocks a chain. A node restricted to several states does
not block, and it opens its parents to each other like an observed child. A BDD
reference with no bound variable below it is cached by the reference alone.
The same reduced evidence is sent to TensorBayes, so a query never carries a
restriction that cannot change its answer.

Keeping the path context only for the bound variables that occur below a BDD
reference is not exact when a variable above depends on one below, so that rule
is not used. A [brute-force test](exact_enumeration_tests.rs) checks the caches
against full enumeration on random models in several variable orders.

In the point pass one calibration answers every bound variable whose relevant
evidence is the calibrated evidence, so `bn_query_cache_misses` counts
calibrations. The uncertainty pass calibrates once per query: sharing was
measured there and saved no time.

Changing base evidence clears both bridge caches and the TensorBayes workspace
cache. The compiled junction tree and bindings remain reusable.

## Ranked cut sets of event-tree sequences

`analysis/sequence_dependency_cut_sets.rs` ranks the cut sets of each sequence
by their probability under the network.

- **Structure.** The cut sets come from the existing PRAXIS sequence path
  (failed branches, with the cut sets of the succeeded systems deleted). An
  optional order limit and an optional probability cut-off bound the size of
  the list, see [Cut-off](#cut-off-under-the-network).
- **Score `FAILED_EVENTS`.** The probability that every event of the cut set
  occurs, given the evidence: the product of the independent events times the
  joint probability of the bound events, taken by the chain rule in BDD order
  (`HclQuantifier::joint_occurrence`).
- **Score `FAILED_EVENTS_AND_SEQUENCE`.** The probability that every event of
  the cut set occurs and the sequence formula holds, so the success branches
  count too: `P(cut set) * P(sequence | cut set)`, where the second factor is
  the sequence BDD evaluated with the cut set events fixed as occurred
  (`HclQuantifier::joint_occurrence_with`).
- **Ranking.** Highest probability first, then fewer events, then event names.
  Each evidence scenario is ranked on its own. For a hazard grid the score of
  a cut set is the weighted sum of its scenario scores, with the same weights
  as the sequence convolution.
- **What it is not.** A sum of cut set scores is not the sequence probability
  when events depend on each other. The sequence probability stays the exact
  value of the probability run.

Both scores are checked against full enumeration on random models
([brute-force test](exact_enumeration_tests.rs)) and against an independent
network tool on the 161-node verification model.

### Ranked cut sets of a fault tree

`hcl/analysis/cut_sets.rs` does the same for one fault tree
(`rank_hcl_cut_sets`, `rank_hcl_cut_sets_batch`). The cut sets come from the
BDD of the run, the score is `FAILED_EVENTS`, and the settings are the same
order limit, cut-off and kept count. Each evidence scenario gets its own list
and a hazard grid gets the weighted list. The brute-force test compares the
cut sets and their scores with full enumeration on random coherent trees.

### Importance under the network

`hcl/importance.rs` gives the importance of each basic event of a target. A
target is a fault tree top event, an event tree sequence or an end state.

- **Two conditional values.** `occurred` is the probability of the target
  given that the event occurred, and `notOccurred` given that it did not, both
  under the evidence. For an event bound to the network the condition is
  evidence on its node, so the other dependent events move with it. For an
  unbound event it is the usual what-if with the event at 1 or at 0.
- **Measures.** With `P` the target probability and `p` the event probability:
  Birnbaum `occurred - notOccurred`, risk achievement worth `occurred / P`,
  risk reduction worth `P / notOccurred`, Fussell-Vesely
  `(P - notOccurred) / P` and criticality `occurred * p / P`.
- **Undefined values.** A bound event that is certain has no `notOccurred`,
  and one that is impossible has no `occurred`. The measures that need the
  missing value are left empty. Risk reduction worth is empty when
  `notOccurred` is 0.
- **How it is computed.** `HclQuantifier::conditional_on` evaluates the same
  BDD under the condition. For a bound event the condition is one more
  restriction in the path context, so every cached value the condition cannot
  reach is reused. For an unbound event only the BDD levels above the event are
  evaluated again.
- **End states.** The sequences of an end state are mutually exclusive, so its
  conditional values are sums over its sequences. A bound event that is not in
  a sequence still changes that sequence through the network, and is included.
- **Hazard grid.** The grid values are the exact conditional values of the
  mixture: scenario values weighted by the hazard weight, times the event
  probability in that scenario for a bound event.
- **Not included.** Importance of network nodes that are not bound to an
  event.

Checked against full enumeration on random models, with an exact grid
mixture, and on the 161-node model against plain evidence runs and against
reruns with the event at 1 and at 0.

### Importance under uncertainty

An uncertainty run can sample the importance of the leading events of each
target. The leading events are the first N by the point Fussell-Vesely value,
where N is chosen by the user.

- **Per sample.** The sampled pass conditions on each leading event in every
  sample, with the same draws as the run (`PreparedHclUncertainty::conditionals`).
  The measures are then formed sample by sample.
- **Summary.** Each measure gets the mean, the median and the 5th and 95th
  percentiles over the samples in which it is defined, with that sample count.
- **End states.** The conditional values of an end state are the sums over its
  sequences in every sample.
- **Limit.** Not combined with a hazard grid.

Checked on random models against independent sampled runs (the event at 1 and
at 0 for unbound events, evidence on the node for bound events) and on the
161-node model against sampled evidence runs.

### Hazard grid under uncertainty

An uncertainty batch with a hazard grid convolves every sample on its own.

- **Sampled weights.** The weight of a grid row is the probability of its
  hazard states under the sampled tables of that sample
  (`PreparedHclUncertainty::evidence_weights`), so uncertain hazard tables move
  the weights together with the results.
- **Convolution.** In each sample the result is the sum over the rows of weight
  times row result, divided by the sum of the weights when normalization is
  on (`sampled_hazard_convolution`). The annual frequency uses the point scale.
- **Summary.** The convolved probability and the integrated annual frequency
  get the usual uncertainty summary, for a fault tree, each sequence and each
  end state.
- **Guard.** A row with zero point weight and a positive sampled weight is an
  error, because the point pass does not evaluate that row.

Checked on random models: a grid over every state of a node gives, sample by
sample, the sampled run without hazard evidence.

### Cause trace

`hcl/cause_trace.rs` can list, for each kept cut set, the network nodes whose
state probabilities the cut set shifts.

- **What is compared.** The marginal of a node given the evidence, and the
  same marginal given the evidence and the bound events of the cut set.
- **Which nodes.** Nodes that are not bound to an event of the run and not
  observed. A node that the cut set cannot influence under the d-separation
  rule of the context keys is left out, so the list holds no rounding noise.
- **What is listed.** The state that changes most, its probability without
  and with the cut set, and the shift, which is half the sum of the absolute
  changes over the states. Largest shift first, a chosen number per cut set.
- **Scope.** Each evidence scenario has its own trace. The hazard-weighted
  list carries none. A cut set with no bound event has an empty trace.

The trace is checked against full enumeration on random models in the
brute-force test and against an independent network tool on the 161-node
model.

### Cut-off under the network

A cut-off on independent probabilities is not safe, because the network can
make a cut set far more likely than the product of its events. The cut-off
therefore uses a bound that holds under the network
(`hcl/occurrence_bound.rs`).

- **Bound of one event.** A bound event gets the largest value its table gives
  to its true states over the parent states that agree with the evidence. An
  event whose node is observed gets 1 or 0. Events that share one node get the
  root of that value by their number, so that their product still bounds the
  node. An unbound event keeps its own probability.
- **Evidence factor.** The product of the largest table values of the observed
  states, divided by the probability of the evidence. It is 1 when all
  evidence sits on root nodes.
- **Why it holds.** Taken node by node in parent-first order, each factor of
  the joint probability of the cut set and the evidence is at most the bound
  above. So `P(cut set | evidence) <= evidence factor * product of bounds`.
- **Use.** The structure engine drops a cut set only when this limit is below
  the cut-off. The exact score then decides: a list holds the cut sets whose
  exact probability reaches the cut-off for that evidence. The hazard-weighted
  list holds the cut sets that reach it in at least one scenario.

The result is the same list as filtering the full ranking, checked on random
models and on the 161-node model (67,300 cut sets, seven scenarios, identical
lists). The bound is checked against full enumeration in the brute-force test.

## Added analyses: definitions and limits

- **Sequence frequency:** `f_s = annual_initiating_frequency * P(sequence_s | evidence)`.
  A transfer adds destination branch conditions; it applies the source initiating
  frequency once. End-state frequency sums the corresponding sequence frequencies.
  This uses the approved sequence method and assumes mutually exclusive paths;
  it performs no general Boolean-union/disjointness calculation.
- **Uncertainty:** draw paired FT and CPT samples with the PRAXIS sampler, then
  evaluate each BDD using HCL_MH's vector recurrence `low + p * (high - low)`.
  Fragility shares one median draw across the CPT rows of its node. PGA bins use
  the Poisson or linear formula. Nothing is clipped. See the
  [uncertainty map](uncertainty/SOURCE.md).
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
execution. `"UNCERTAINTY"` requires configured inputs and can be combined with
hazard convolution. Direct Rust analysis callers provide `HclAnalysisSettings`.

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
