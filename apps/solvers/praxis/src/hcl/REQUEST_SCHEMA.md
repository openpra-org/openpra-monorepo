# HCL request schema version 1

The HCL request contains BN data or an XDSL source, name-based bindings, base
evidence, and BDD settings. The fault tree remains the normal positional PRAXIS
input so existing OpenPSA XML and PBF loading stay canonical.

## Canonical BN request

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
  "base_evidence": [
    {"node": "Environment", "state": "seismic"}
  ],
  "settings": {
    "variable_order": ["A", "B"]
  }
}
```

The example evidence entry is illustrative and must be omitted unless the BN
actually defines `Environment` and its `seismic` state.

Each variable's flat probability table uses TensorBayes row-major axes
`[parents..., child]`; an optional TensorBayes batch axis is not exposed in the
Phase 4 request. Parent order is exactly the order in `parents`, and the last
parent varies fastest.

## XDSL sources

Embedded XDSL uses:

```json
{"format": "xdsl", "document": "<smile>...</smile>"}
```

An XDSL file uses:

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

When `variable_order` is omitted, PRAXIS uses its normal BDD ordering. Unknown
request fields, names, states, duplicate bindings, duplicate evidence, and
unsupported schema versions are rejected before inference.
