# HCL request schema version 1

The HCL request contains BN data or an XDSL source, name-based bindings, base
evidence, and BDD settings. The fault tree remains the normal positional PRAXIS
input so existing OpenPSA XML and PBF loading stay canonical.

This contract quantifies one FT top event and returns probability and diagnostics.
It does not accept the addon's `calculationType`, scenarios or uncertainty settings.
See [execution scope](README.md#execution-scope-and-sources) for the other APIs.

## Runnable FT and canonical BN example

Save this as `fault-tree.xml` in the repository root:

```xml
<?xml version="1.0"?>
<opsa-mef>
  <define-fault-tree name="correlated-and">
    <define-gate name="TOP">
      <and><basic-event name="A"/><basic-event name="B"/></and>
    </define-gate>
    <define-basic-event name="A"><float value="0.2"/></define-basic-event>
    <define-basic-event name="B"><float value="0.24"/></define-basic-event>
  </define-fault-tree>
</opsa-mef>
```

Save this as `hcl-request.json` beside it:

```json
{
  "schema_version": 1,
  "network": {
    "format": "canonical",
    "id": "correlated-example",
    "variables": [
      {
        "name": "A",
        "states": ["false", "true"],
        "probabilities": [0.8, 0.2]
      },
      {
        "name": "B",
        "states": ["false", "true"],
        "parents": ["A"],
        "probabilities": [0.9, 0.1, 0.2, 0.8]
      }
    ]
  },
  "bindings": [
    {"event": "A", "node": "A", "true_states": ["true"]},
    {"event": "B", "node": "B", "true_states": ["true"]}
  ],
  "base_evidence": [],
  "settings": {
    "variable_order": ["A", "B"]
  }
}
```

From the repository root:

```sh
cargo run --manifest-path apps/solvers/praxis/Cargo.toml --bin praxis-cli -- fault-tree.xml --hcl-request hcl-request.json
```

The result's `probability` is approximately `0.16`:
`P(A AND B) = P(A) * P(B | A) = 0.2 * 0.8`.
The two bindings make the BN supply A/B probabilities; the FT's independent
values do not replace that dependence.

To condition on A, change `base_evidence` to
`[{"node":"A","state":"true"}]`. The same FT then returns approximately `0.8`.
Every evidence node/state must exist in the supplied BN; an unlinked BN node can
also provide evidence. The FT need not bind every BN node.

Each variable's flat probability table uses TensorBayes row-major axes
`[parents..., child]`; an optional TensorBayes batch axis is not exposed in the
version 1 request. Parent order is exactly the order in `parents`, and the last
parent varies fastest.

## XDSL sources

To use embedded XDSL, replace the entire `network` object with:

```json
{"format":"xdsl","document":"<smile id=\"correlated-example\"><nodes><cpt id=\"A\"><state id=\"false\"/><state id=\"true\"/><probabilities>0.8 0.2</probabilities></cpt><cpt id=\"B\"><state id=\"false\"/><state id=\"true\"/><parents>A</parents><probabilities>0.9 0.1 0.2 0.8</probabilities></cpt></nodes></smile>"}
```

Alternatively, save that XML document as `network.xdsl` and use:

```json
{"format": "xdsl_file", "path": "network.xdsl"}
```

Relative XDSL paths are resolved against the request file's directory by the
CLI. The minimal importer accepts discrete `<cpt>` nodes with `<state>`,
optional `<parents>`, and `<probabilities>`. GeNIe layout extensions are
ignored. Decision, utility, deterministic, and continuous nodes are rejected.

## Settings

- `variable_order`: optional exact list of every fault-tree basic event.
- `fold_constants`: optional Boolean, default `false`.
- `splice_null_gates`: optional Boolean, default `false`.

When `variable_order` is omitted here, PRAXIS uses its normal BDD ordering.
This differs from the application analysis/addon default, which supplies
HCL_MH's BN-first order. Explicit order takes precedence in both APIs; the GUI
has no manual ordering control. BDD order is separate from BN compilation,
which uses TensorBayes MinFill.

Unknown request fields, names, states, duplicate bindings, duplicate evidence, and
unsupported schema versions are rejected before inference.

## Output and errors

The result is a plain `HclResult` JSON object, not an addon envelope:

| Field | Meaning |
| --- | --- |
| `probability` | FT top-event probability conditional on base evidence |
| `bdd_nodes`, `bdd_variables` | PRAXIS BDD allocation/variable counts |
| `variable_order` | Actual ordered FT basic-event names |
| `bridge` | Point-pass traversal, cache and BN-query counters |
| `junction_tree` | Cliques, largest clique, treewidth and table-entry counts |

By default JSON goes to stdout. Add `--output result.json` to write a file;
add `--print` as well to send the same JSON to stdout. Invalid requests exit
unsuccessfully and report an error on stderr. An event-tree positional input
is rejected with `--hcl-request`; HCL ET execution uses the application API.

The original [CLI](../cli/hcl.rs), [request parser](request.rs),
[settings/result types](model.rs) and [probability API](api.rs) match main commit
`96b949e96ccbb2fa6eef7a27170dfc9cb9f54182`. Supported fields, default values and
error behavior remain unchanged.
