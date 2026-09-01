# HCL event-tree quantification workflow

This guide explains, at a high level, how OpenPRA quantifies an event tree whose functional events are linked to fault trees and whose fault-tree basic events are mapped to Bayesian-network nodes through Hybrid Causal Logic (HCL).

The central idea is:

```text
Event-tree functional event
  -> fault-tree top gate
      -> fault-tree basic event
          -> HCL binding
              -> Bayesian-network node and occurrence states
```

The final solver input is one JSON envelope. The event tree, fault trees, Bayesian network, and HCL configuration are sibling model snapshots connected by stable model and entity IDs. They are not copied into one deeply nested object.

## System overview

```text
OpenPRA editors
  -> revisioned workbook data
  -> small browser run request
  -> web backend loads and freezes every referenced model
  -> one solver JSON envelope
  -> HTTP request to Praetor
  -> praxis-node converts JSON to Rust structures
  -> PRAXIS builds and quantifies sequence BDDs
  -> TensorBayes supplies exact conditional BN probabilities
  -> praxis-node converts the Rust result to JSON
  -> HTTP response through Praetor
  -> web backend stores the result and provenance
  -> editor displays sequence probabilities and frequencies
```

The browser does **not** send the complete ET/FT/BN model graph. It sends the selected HCL configuration, event-tree reference, and workbook revision. The web backend resolves those references and creates the complete, revision-pinned solver envelope.

## Responsibilities at each boundary

| Component | Responsibility |
| --- | --- |
| OpenPRA editors | Author ET, FT, BN, bindings, evidence, and solver settings. |
| Web backend | Load referenced workbooks, check revisions and access, resolve DA/HRA-controlled values, adapt models, record provenance, and construct the solver envelope. |
| Praetor | Expose the HTTP execution endpoint and isolate native execution in a worker thread. |
| `praxis-node` | Deserialize the JSON envelope, resolve cross-model IDs, construct Rust model structures, invoke PRAXIS, and serialize the result. |
| PRAXIS | Build Boolean formulas and BDDs and perform HCL quantification. |
| TensorBayes | Perform exact Bayesian-network inference under base evidence and the temporary evidence accumulated along a BDD path. |

## Small example

Assume an initiating event with frequency:

```text
0.01 per year
```

The event tree contains two functional events:

1. Cooling succeeds or fails.
2. Injection succeeds or fails.

This produces four complete sequences:

| Sequence | Cooling | Injection | End state |
| --- | --- | --- | --- |
| `SS` | Success | Success | Safe |
| `SF` | Success | Failure | Degraded |
| `FS` | Failure | Success | Degraded |
| `FF` | Failure | Failure | Release |

### Linked fault trees

Cooling failure is represented by:

```text
F1 = A OR C
```

Injection failure is represented by:

```text
F2 = B OR (D AND E)
```

Basic events `A` and `B` are mapped to the Bayesian network. Events `C`, `D`, and `E` remain independent fault-tree events:

```text
P(C) = 0.05
P(D) = 0.10
P(E) = 0.20
```

### Bayesian network

The Bayesian network contains two dependent nodes.

Node `BN-A` has two states:

| State | Probability |
| --- | ---: |
| `OK` | 0.80 |
| `FAILED` | 0.20 |

Node `BN-B` has three states and depends on `BN-A`:

| State of `BN-A` | `B=OK` | `B=DEGRADED` | `B=FAILED` |
| --- | ---: | ---: | ---: |
| `OK` | 0.90 | 0.06 | 0.04 |
| `FAILED` | 0.20 | 0.30 | 0.50 |

### HCL bindings

The bindings define which BN states mean that a Boolean fault-tree basic event has occurred:

```text
FT event A -> BN-A -> occurrence state: FAILED

FT event B -> BN-B -> occurrence states: DEGRADED or FAILED
```

Consequently:

```text
P(B occurs | A does not occur) = 0.06 + 0.04 = 0.10
P(B occurs | A occurs)         = 0.30 + 0.50 = 0.80
```

This conditional relationship is why independently multiplying the marginal probabilities of `A` and `B` would be incorrect.

## Editor-owned JSON

The editors persist each model in its owning workbook. The following objects are abbreviated to emphasize the connections rather than UI metadata.

### Event-tree data

The event tree references fault-tree top gates by model and entity ID:

```json
{
  "id": "ET-1",
  "methodType": "EVENT_TREE",
  "initiatingEventFrequency": { "value": 0.01 },
  "functionalEvents": [
    { "id": "FE-COOLING", "name": "Cooling", "order": 0 },
    { "id": "FE-INJECTION", "name": "Injection", "order": 1 }
  ],
  "functionalEventFaultTreeLinks": [
    {
      "functionalEventId": "FE-COOLING",
      "faultTreeTopGate": {
        "modelId": "FT-COOLING",
        "entityId": "TOP-COOLING"
      }
    },
    {
      "functionalEventId": "FE-INJECTION",
      "faultTreeTopGate": {
        "modelId": "FT-INJECTION",
        "entityId": "TOP-INJECTION"
      }
    }
  ],
  "hclConfiguration": {
    "configuration": { "modelId": "HCL-1" }
  },
  "sequences": [
    {
      "id": "SS",
      "path": [
        { "functionalEventId": "FE-COOLING", "outcome": "SUCCESS" },
        { "functionalEventId": "FE-INJECTION", "outcome": "SUCCESS" }
      ],
      "result": { "kind": "END_STATE", "endStateId": "SAFE" }
    },
    {
      "id": "SF",
      "path": [
        { "functionalEventId": "FE-COOLING", "outcome": "SUCCESS" },
        { "functionalEventId": "FE-INJECTION", "outcome": "FAILURE" }
      ],
      "result": { "kind": "END_STATE", "endStateId": "DEGRADED" }
    },
    {
      "id": "FS",
      "path": [
        { "functionalEventId": "FE-COOLING", "outcome": "FAILURE" },
        { "functionalEventId": "FE-INJECTION", "outcome": "SUCCESS" }
      ],
      "result": { "kind": "END_STATE", "endStateId": "DEGRADED" }
    },
    {
      "id": "FF",
      "path": [
        { "functionalEventId": "FE-COOLING", "outcome": "FAILURE" },
        { "functionalEventId": "FE-INJECTION", "outcome": "FAILURE" }
      ],
      "result": { "kind": "END_STATE", "endStateId": "RELEASE" }
    }
  ]
}
```

### Fault-tree data

Conceptually, the two fault-tree snapshots contain:

```json
[
  {
    "id": "FT-COOLING",
    "methodType": "FAULT_TREE",
    "topGate": { "gateId": "TOP-COOLING" },
    "expression": "A OR C"
  },
  {
    "id": "FT-INJECTION",
    "methodType": "FAULT_TREE",
    "topGate": { "gateId": "TOP-INJECTION" },
    "expression": "B OR (D AND E)"
  }
]
```

`expression` is explanatory shorthand in this guide. The real solver snapshot represents the same logic through `gates`, `leafNodes`, and `gateInputs`.

### Bayesian-network data

```json
{
  "id": "BN-1",
  "methodType": "BAYESIAN_NETWORK",
  "nodes": [
    {
      "id": "BN-A",
      "states": [{ "id": "OK" }, { "id": "FAILED" }]
    },
    {
      "id": "BN-B",
      "states": [
        { "id": "OK" },
        { "id": "DEGRADED" },
        { "id": "FAILED" }
      ]
    }
  ],
  "conditionalProbabilityTables": [
    {
      "nodeId": "BN-A",
      "parents": [],
      "rows": [
        {
          "parentStates": [],
          "values": [
            { "stateId": "OK", "probability": 0.80 },
            { "stateId": "FAILED", "probability": 0.20 }
          ]
        }
      ]
    },
    {
      "nodeId": "BN-B",
      "parents": [{ "nodeId": "BN-A", "order": 0 }],
      "rows": [
        {
          "parentStates": [{ "parentNodeId": "BN-A", "stateId": "OK" }],
          "values": [
            { "stateId": "OK", "probability": 0.90 },
            { "stateId": "DEGRADED", "probability": 0.06 },
            { "stateId": "FAILED", "probability": 0.04 }
          ]
        },
        {
          "parentStates": [{ "parentNodeId": "BN-A", "stateId": "FAILED" }],
          "values": [
            { "stateId": "OK", "probability": 0.20 },
            { "stateId": "DEGRADED", "probability": 0.30 },
            { "stateId": "FAILED", "probability": 0.50 }
          ]
        }
      ]
    }
  ]
}
```

### HCL configuration data

The HCL configuration references the BN and fault trees and provides the basic-event mappings:

```json
{
  "id": "HCL-1",
  "methodType": "HYBRID_CAUSAL_LOGIC",
  "bayesianNetwork": { "modelId": "BN-1" },
  "faultTrees": [
    { "faultTree": { "modelId": "FT-COOLING" } },
    { "faultTree": { "modelId": "FT-INJECTION" } }
  ],
  "bindings": [
    {
      "id": "BIND-A",
      "faultTreeBasicEvent": {
        "modelId": "FT-COOLING",
        "entityId": "A"
      },
      "bayesianNetworkNode": {
        "modelId": "BN-1",
        "entityId": "BN-A"
      },
      "trueStateIds": ["FAILED"]
    },
    {
      "id": "BIND-B",
      "faultTreeBasicEvent": {
        "modelId": "FT-INJECTION",
        "entityId": "B"
      },
      "bayesianNetworkNode": {
        "modelId": "BN-1",
        "entityId": "BN-B"
      },
      "trueStateIds": ["DEGRADED", "FAILED"]
    }
  ],
  "baseEvidence": { "observations": [] },
  "solverSettings": {
    "variableOrder": null,
    "foldConstants": true,
    "spliceNullGates": true
  }
}
```

## Browser request and backend assembly

When the user selects `ET-1` and runs HCL quantification, the browser sends a small request similar to:

```json
{
  "schemaVersion": "1.0.0",
  "modelId": "HCL-1",
  "workbookRevision": 12,
  "eventTree": {
    "workbookId": "ES-WORKBOOK",
    "modelId": "ET-1"
  }
}
```

The backend then:

1. Loads the selected HCL configuration and its exact ESQ workbook revision.
2. Loads the referenced Bayesian network.
3. Loads the target event tree and any transferred event trees.
4. Finds every fault tree linked by the functional events.
5. Verifies that those fault trees are declared in the HCL configuration.
6. Resolves independent and DA/HRA-controlled basic-event probabilities.
7. Converts the workbook models to solver snapshots.
8. Records the exact source revisions and contributing entities.
9. Sends the resulting envelope to Praetor.

The solver envelope has this top-level shape:

```json
{
  "schemaVersion": "1.0.0",
  "request": {
    "schemaVersion": "1.0.0",
    "methodType": "EVENT_TREE",
    "mode": "HYBRID_CAUSAL_LOGIC",
    "modelId": "ET-1",
    "revision": 2,
    "requestedBy": "developer"
  },
  "modelSnapshots": [
    { "id": "ET-1", "methodType": "EVENT_TREE" },
    { "id": "FT-COOLING", "methodType": "FAULT_TREE" },
    { "id": "FT-INJECTION", "methodType": "FAULT_TREE" },
    { "id": "BN-1", "methodType": "BAYESIAN_NETWORK" },
    { "id": "HCL-1", "methodType": "HYBRID_CAUSAL_LOGIC" }
  ],
  "resources": {
    "faultTreeBasicEventCatalogue": {
      "basicEvents": [
        { "id": "A", "probability": { "value": 0.20 } },
        { "id": "B", "probability": { "value": 0.24 } },
        { "id": "C", "probability": { "value": 0.05 } },
        { "id": "D", "probability": { "value": 0.10 } },
        { "id": "E", "probability": { "value": 0.20 } }
      ]
    }
  }
}
```

The abbreviated entries in `modelSnapshots` stand for the complete ET, FT, BN, and HCL objects shown above.

## Praetor overview

Praetor provides the HTTP boundary around native solver execution. The backend posts the solver envelope to the native PRAXIS execution endpoint, and Praetor starts an isolated worker thread that loads `praxis-node`.

Praetor does not currently distribute HCL jobs across a durable queue or cluster. The analysis record briefly uses statuses such as `QUEUED` and `RUNNING`, but these are persisted lifecycle states rather than evidence of a distributed message queue. The backend waits for Praetor to return the result before completing the run request.

## Node addon overview

`praxis-node` is the N-API bridge between JavaScript and the Rust solver. Its relevant operation accepts the solver envelope as a JSON string and returns either a versioned result JSON string or a structured error JSON string.

At a high level, the addon:

1. Parses and validates the versioned transport envelope.
2. Dispatches the request by `methodType`.
3. Finds the referenced snapshots by their model IDs.
4. Converts FT snapshots into PRAXIS fault-tree structures.
5. Converts BN nodes and CPT rows into a TensorBayes network.
6. Converts HCL bindings and evidence into PRAXIS HCL structures.
7. Converts event-tree paths into PRAXIS sequence formulas.
8. Invokes PRAXIS quantification.
9. Serializes the Rust result into the versioned JSON response.

The Node addon is an adapter and transport boundary; the probability calculation itself occurs in PRAXIS and TensorBayes.

## Rust data structures overview

The JSON is deserialized into a small set of transport and adapter structures before native PRAXIS structures are created.

| Structure | Purpose |
| --- | --- |
| `SolverRequest` | Holds the request, model snapshots, resources, and schema version received from Node.js. |
| `EventTreeSnapshot` | Represents functional events, FT links, sequences, transfers, end states, and initiating frequency. |
| `HclSnapshot` | Represents the selected BN, included fault trees, bindings, evidence, and solver settings. |
| `FaultTree` | Native PRAXIS Boolean gate and basic-event model. |
| `CanonicalBayesianNetwork` | Validated discrete BN with ordered states, parents, and CPT values. |
| `HclModel` | Combines the native fault tree, BN, bindings, evidence, and selected top event. |
| `HclEventBinding` / `HclBindingSpec` | Maps a Boolean FT basic event to a non-empty set of BN node states. |
| `HclSettings` | Controls BDD variable order and structural simplification options. |
| `EventTree` and `Sequence` | Native event-tree topology and complete sequence paths. |
| `EventTreeHclContext` | Makes the BN and HCL mappings available while event-tree sequence BDDs are quantified. |
| `HclResult` / sequence results | Holds probabilities, frequencies, BDD statistics, inference statistics, and issues for serialization. |

The snapshot structures mirror the JSON boundary. The native structures are optimized for validation, BDD construction, and exact inference.

## Native quantification

For this example, PRAXIS constructs the two functional-event failure formulas:

```text
F1 = A OR C
F2 = B OR (D AND E)
```

The four sequence formulas are:

```text
SS = NOT F1 AND NOT F2
SF = NOT F1 AND F2
FS = F1 AND NOT F2
FF = F1 AND F2
```

PRAXIS builds a BDD for each complete sequence formula. While traversing a BDD:

- Bound events `A` and `B` obtain conditional probabilities from TensorBayes.
- Unbound events `C`, `D`, and `E` use their independent catalogue probabilities.
- Taking a bound event's true or false branch adds the corresponding allowed or excluded BN states to the current path context.
- TensorBayes evaluates subsequent BN probabilities under that complete context, preserving dependency.

At a bound BDD variable `x`, HCL evaluates:

```text
P(F | context)
  = P(x | context) * P(high branch | context, x)
  + P(not x | context) * P(low branch | context, not x)
```

This is why the order used to traverse the BDD can affect performance but does not change the exact probability.

## Example calculation

First, the independent sub-expression in the injection fault tree is:

```text
P(D AND E) = 0.10 * 0.20 = 0.02
```

For sequence `SS`, both functions succeed:

```text
P(SS)
  = P(not A, not B) * P(not C) * P(not (D AND E))
  = (0.80 * 0.90) * 0.95 * 0.98
  = 0.67032
```

The four exact conditional sequence probabilities are:

| Sequence | Conditional probability |
| --- | ---: |
| `SS` | 0.67032 |
| `SF` | 0.08968 |
| `FS` | 0.07448 |
| `FF` | 0.16552 |
| **Total** | **1.00000** |

The annual frequency of each sequence is:

```text
sequence annual frequency
  = sequence conditional probability * initiating-event frequency
```

With an initiating frequency of `0.01/year`:

| Sequence | Conditional probability | Annual frequency |
| --- | ---: | ---: |
| `SS` | 0.67032 | 0.0067032/year |
| `SF` | 0.08968 | 0.0008968/year |
| `FS` | 0.07448 | 0.0007448/year |
| `FF` | 0.16552 | 0.0016552/year |

## Result JSON

The Node addon serializes the native result into a versioned JSON response. Praetor returns that response to the web backend, which validates and stores it with the run provenance.

An abbreviated result for the example is:

```json
{
  "schemaVersion": "1.0.0",
  "result": {
    "modelId": "ET-1",
    "mode": "HYBRID_CAUSAL_LOGIC",
    "sequences": [
      {
        "sequenceId": "SS",
        "conditionalProbability": 0.67032,
        "annualFrequency": 0.0067032
      },
      {
        "sequenceId": "SF",
        "conditionalProbability": 0.08968,
        "annualFrequency": 0.0008968
      },
      {
        "sequenceId": "FS",
        "conditionalProbability": 0.07448,
        "annualFrequency": 0.0007448
      },
      {
        "sequenceId": "FF",
        "conditionalProbability": 0.16552,
        "annualFrequency": 0.0016552
      }
    ],
    "endStateAggregates": [
      { "endStateId": "SAFE", "annualFrequency": 0.0067032 },
      { "endStateId": "DEGRADED", "annualFrequency": 0.0016416 },
      { "endStateId": "RELEASE", "annualFrequency": 0.0016552 }
    ]
  }
}
```

The web backend retains both the result and the exact revisions of the ET, FT, BN, HCL, DA, and HRA inputs that contributed to it. The frontend then retrieves this stored result and displays the sequence conditional probabilities, annual frequencies, end-state aggregates, and revision-pinned provenance.
