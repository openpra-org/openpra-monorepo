# HCL variable order and exact verification

The application supplies main's unchanged HCL probability algorithm with an
order derived from HCL_MH. The selected source configuration uses two blocks,
with dependency grouping and dynamic reordering disabled:

1. Keep bindings that occur in the requested fault tree, in mapping order.
2. Sort linked events by BN depth, preserving mapping order for equal depths.
   Unlinked BN ancestors still contribute to that depth.
3. Append FT-only events in breadth-first traversal order, following stored
   gate operands. Append any remaining events alphabetically.

Source functions in `resources/HCL_MH`:

- `oracle/hcl_integration.py::derive_inter_order_from_yaml`
- `oracle/bn_path_oracle.py::BNPathOracle.compute_topological_order`
- `utils/bdd_ordering.py::compute_ft_bfs_order`

The Rust port is `ordering.rs`. A valid explicit API/CLI order is retained,
including an order with FT-only events first. It is not silently replaced by
the automatic order.

The approved event-tree integration builds a separate PRAXIS BDD for each
sequence. An explicit global order is restricted to that sequence's reachable
events. Automatic ordering applies the same linked-prefix rule to the
sequence graph. It does not build an end-state union BDD.

For exact verification, use identical binary64 inputs, evidence, bindings,
build options, reachable event sets and supplied BDD orders. Verify automatic
ordering independently against HCL_MH. Then pass that order to original main
for point probabilities. For sequence probabilities, pass the recorded
sequence order to original main and independently check its linked prefix.
This probability check does not establish identical FT-only traversal between
different graph constructions.

Reconstructing a sequence as another fault tree can change traversal order.
Both orders can be valid while rounding differently. Retain those comparisons
as separate diagnostics; do not round the results or change solver arithmetic
to make different orders appear identical. Uncertainty also retains its
selected order and the vector reference specified in `uncertainty/SOURCE.md`.
