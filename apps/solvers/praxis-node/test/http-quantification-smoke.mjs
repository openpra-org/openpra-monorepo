import assert from "node:assert/strict";

const baseUrl = (process.argv[2] ?? process.env.PRAETOR_URL ?? "http://127.0.0.1:3000/q").replace(
  /\/$/,
  "",
);

function envelope(request, modelSnapshots, resources) {
  return {
    schemaVersion: "1.0.0",
    request: { schemaVersion: "1.0.0", requestedBy: "platform-smoke", ...request },
    modelSnapshots,
    ...(resources === undefined ? {} : { resources }),
  };
}

function faultTree(id, topGateId, gateType, basicEventIds, k) {
  return {
    id,
    projectId: "platform-smoke",
    methodType: "FAULT_TREE",
    revision: 2,
    topGate: { gateId: topGateId },
    gates: [{ id: topGateId, gateType, ...(k === undefined ? {} : { k }) }],
    leafNodes: basicEventIds.map((basicEventId, order) => ({
      id: `ref-${id}-${order}`,
      kind: "BASIC_EVENT_REFERENCE",
      basicEventId,
    })),
    gateInputs: basicEventIds.map((basicEventId, order) => ({
      id: `input-${id}-${order}`,
      gateId: topGateId,
      childId: `ref-${id}-${order}`,
      order,
    })),
  };
}

function catalogue(probabilities) {
  return {
    faultTreeBasicEventCatalogue: {
      projectId: "platform-smoke",
      basicEvents: Object.entries(probabilities).map(([id, value]) => ({
        id,
        probability: { value },
      })),
    },
  };
}

async function execute(body) {
  const response = await fetch(`${baseUrl}/praxis/native/execute`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const responseBody = await response.text();
  assert.equal(response.status, 200, responseBody);
  const parsed = JSON.parse(responseBody);
  assert.equal(parsed.schemaVersion, "1.0.0");
  assert.equal(parsed.error, undefined, JSON.stringify(parsed.error));
  return parsed.result;
}

const ft = faultTree("FT", "TOP", "OR", ["A", "B"]);
const ftResult = await execute(
  envelope(
    { methodType: "FAULT_TREE", modelId: "FT", revision: 2 },
    [ft],
    catalogue({ A: 0.1, B: 0.2 }),
  ),
);
assert.ok(Math.abs(ftResult.topEventProbability - 0.28) < 1e-12);
assert.deepEqual(
  ftResult.leadingCutSets.map((cutSet) => cutSet.probability),
  [0.2, 0.1],
);

const ftFixtures = [
  {
    snapshot: faultTree("FT-AND", "TOP-AND", "AND", ["A", "B"]),
    probabilities: { A: 0.1, B: 0.2 },
    expected: 0.02,
  },
  {
    snapshot: faultTree("FT-SHARED", "TOP-SHARED", "OR", ["SHARED", "SHARED"]),
    probabilities: { SHARED: 0.25 },
    expected: 0.25,
  },
  {
    snapshot: faultTree("FT-KOFN", "TOP-KOFN", "K_OF_N", ["A", "B", "C"], 2),
    probabilities: { A: 0.5, B: 0.5, C: 0.5 },
    expected: 0.5,
  },
  {
    snapshot: faultTree("FT-NOT", "TOP-NOT", "NOT", ["A"]),
    probabilities: { A: 0.2 },
    expected: 0.8,
  },
];
for (const fixture of ftFixtures) {
  const result = await execute(
    envelope(
      {
        methodType: "FAULT_TREE",
        modelId: fixture.snapshot.id,
        revision: fixture.snapshot.revision,
      },
      [fixture.snapshot],
      catalogue(fixture.probabilities),
    ),
  );
  assert.ok(Math.abs(result.topEventProbability - fixture.expected) < 1e-12);
}

const bn = {
  id: "BN",
  methodType: "BAYESIAN_NETWORK",
  revision: 2,
  nodes: [
    { id: "NA", states: [{ id: "A-false" }, { id: "A-true" }] },
    { id: "NB", states: [{ id: "B-false" }, { id: "B-true" }] },
  ],
  conditionalProbabilityTables: [
    {
      nodeId: "NA",
      parents: [],
      rows: [
        {
          id: "row-a",
          parentStates: [],
          values: [
            { stateId: "A-false", probability: 0.6 },
            { stateId: "A-true", probability: 0.4 },
          ],
        },
      ],
    },
    {
      nodeId: "NB",
      parents: [{ nodeId: "NA", order: 0 }],
      rows: [
        {
          id: "row-b-false",
          parentStates: [{ parentNodeId: "NA", stateId: "A-false" }],
          values: [
            { stateId: "B-false", probability: 0.7 },
            { stateId: "B-true", probability: 0.3 },
          ],
        },
        {
          id: "row-b-true",
          parentStates: [{ parentNodeId: "NA", stateId: "A-true" }],
          values: [
            { stateId: "B-false", probability: 0.2 },
            { stateId: "B-true", probability: 0.8 },
          ],
        },
      ],
    },
  ],
};
const bnResult = await execute(
  envelope(
    {
      methodType: "BAYESIAN_NETWORK",
      modelId: "BN",
      revision: 2,
      query: {
        evidence: { observations: [{ nodeId: "NB", stateId: "B-true" }] },
        queryNodeIds: ["NA"],
      },
    },
    [bn],
  ),
);
assert.ok(Math.abs(bnResult.marginals[0].values[0].probability - 0.36) < 1e-12);
assert.ok(Math.abs(bnResult.marginals[0].values[1].probability - 0.64) < 1e-12);

const etFt = faultTree("FT-ET", "TOP-ET", "OR", ["E"]);
const et = {
  id: "ET",
  methodType: "EVENT_TREE",
  revision: 2,
  initiatingEvent: { target: { modelId: "IE", entityId: "IE-1" } },
  initiatingEventFrequency: { value: 0.01 },
  functionalEvents: [{ id: "FE", name: "Safety function", order: 0 }],
  functionalEventFaultTreeLinks: [
    { functionalEventId: "FE", faultTreeTopGate: { modelId: "FT-ET", entityId: "TOP-ET" } },
  ],
  endStates: [{ id: "SAFE" }, { id: "RELEASE" }],
  sequences: [
    {
      id: "SUCCESS",
      path: [{ functionalEventId: "FE", outcome: "SUCCESS" }],
      result: { kind: "END_STATE", endStateId: "SAFE" },
    },
    {
      id: "FAILURE",
      path: [{ functionalEventId: "FE", outcome: "FAILURE" }],
      result: { kind: "END_STATE", endStateId: "RELEASE" },
    },
  ],
};
const etResult = await execute(
  envelope(
    { methodType: "EVENT_TREE", modelId: "ET", revision: 2, mode: "INDEPENDENT" },
    [etFt, et],
    catalogue({ E: 0.2 }),
  ),
);
assert.ok(Math.abs(etResult.sequences[0].conditionalProbability - 0.8) < 1e-12);
assert.ok(Math.abs(etResult.sequences[1].conditionalProbability - 0.2) < 1e-12);
assert.deepEqual(
  etResult.endStateAggregates.map((aggregate) => aggregate.annualFrequency),
  [0.002, 0.008],
);

const hclFt = faultTree("FT-HCL", "TOP-HCL", "AND", ["A", "B"]);
const hclBn = {
  id: "BN-HCL",
  methodType: "BAYESIAN_NETWORK",
  revision: 3,
  nodes: [
    { id: "NA", states: [{ id: "A-false" }, { id: "A-true" }] },
    { id: "NB", states: [{ id: "B-false" }, { id: "B-true" }] },
  ],
  conditionalProbabilityTables: [
    {
      nodeId: "NA",
      parents: [],
      rows: [
        {
          id: "hcl-row-a",
          parentStates: [],
          values: [
            { stateId: "A-false", probability: 0.8 },
            { stateId: "A-true", probability: 0.2 },
          ],
        },
      ],
    },
    {
      nodeId: "NB",
      parents: [{ nodeId: "NA", order: 0 }],
      rows: [
        {
          id: "hcl-row-b-false",
          parentStates: [{ parentNodeId: "NA", stateId: "A-false" }],
          values: [
            { stateId: "B-false", probability: 0.9 },
            { stateId: "B-true", probability: 0.1 },
          ],
        },
        {
          id: "hcl-row-b-true",
          parentStates: [{ parentNodeId: "NA", stateId: "A-true" }],
          values: [
            { stateId: "B-false", probability: 0.2 },
            { stateId: "B-true", probability: 0.8 },
          ],
        },
      ],
    },
  ],
};
const hclConfiguration = {
  id: "HCL",
  methodType: "HYBRID_CAUSAL_LOGIC",
  revision: 4,
  bayesianNetwork: { modelId: "BN-HCL" },
  faultTrees: [{ faultTree: { modelId: "FT-HCL" } }],
  bindings: [
    {
      id: "binding-a",
      faultTreeBasicEvent: { modelId: "FT-HCL", entityId: "A" },
      bayesianNetworkNode: { modelId: "BN-HCL", entityId: "NA" },
      trueStateIds: ["A-true"],
    },
    {
      id: "binding-b",
      faultTreeBasicEvent: { modelId: "FT-HCL", entityId: "B" },
      bayesianNetworkNode: { modelId: "BN-HCL", entityId: "NB" },
      trueStateIds: ["B-true"],
    },
  ],
  baseEvidence: { observations: [] },
  solverSettings: {
    variableOrder: ["A", "B"],
    foldConstants: false,
    spliceNullGates: false,
  },
};
const hclResult = await execute(
  envelope(
    {
      methodType: "HYBRID_CAUSAL_LOGIC",
      modelId: "HCL",
      revision: 4,
      faultTreeTopGate: { modelId: "FT-HCL", entityId: "TOP-HCL" },
    },
    [hclFt, hclBn, hclConfiguration],
    catalogue({ A: 0.2, B: 0.24 }),
  ),
);
assert.ok(Math.abs(hclResult.probability - 0.16) < 1e-12);
assert.ok(Math.abs(hclResult.probability - 0.048) > 1e-6);
assert.equal(hclResult.cutSets.totalCount, 1);
assert.ok(Math.abs(hclResult.cutSets.cutSets[0].probability - 0.16) < 1e-12);
assert.deepEqual(hclResult.cutSets.cutSets[0].bnRootCauseNodeIds, ["NODE-A"]);
assert.equal(hclResult.importance.totalCount, 2);
assert.ok(
  Math.abs(
    hclResult.importance.measures.find(({ basicEventId }) => basicEventId === "A")
      .riskAchievementWorth - 1.5,
  ) < 1e-12,
);

const hclEt = {
  id: "ET-HCL",
  methodType: "EVENT_TREE",
  revision: 2,
  initiatingEvent: { target: { modelId: "IE", entityId: "IE-HCL" } },
  initiatingEventFrequency: { value: 0.01 },
  functionalEvents: [
    { id: "FE-A", name: "First function", order: 0 },
    { id: "FE-B", name: "Second function", order: 1 },
  ],
  functionalEventFaultTreeLinks: [
    {
      functionalEventId: "FE-A",
      faultTreeTopGate: { modelId: "FT-HCL", entityId: "TOP-HCL" },
    },
    {
      functionalEventId: "FE-B",
      faultTreeTopGate: { modelId: "FT-HCL", entityId: "TOP-HCL" },
    },
  ],
  endStates: [{ id: "SAFE-HCL" }, { id: "RELEASE-HCL" }],
  hclConfiguration: { configuration: { modelId: "HCL" } },
  sequences: [
    {
      id: "SS",
      path: [
        { functionalEventId: "FE-A", outcome: "SUCCESS" },
        { functionalEventId: "FE-B", outcome: "SUCCESS" },
      ],
      result: { kind: "END_STATE", endStateId: "SAFE-HCL" },
    },
    {
      id: "SF",
      path: [
        { functionalEventId: "FE-A", outcome: "SUCCESS" },
        { functionalEventId: "FE-B", outcome: "FAILURE" },
      ],
      result: { kind: "END_STATE", endStateId: "SAFE-HCL" },
    },
    {
      id: "FS",
      path: [
        { functionalEventId: "FE-A", outcome: "FAILURE" },
        { functionalEventId: "FE-B", outcome: "SUCCESS" },
      ],
      result: { kind: "END_STATE", endStateId: "SAFE-HCL" },
    },
    {
      id: "FF",
      path: [
        { functionalEventId: "FE-A", outcome: "FAILURE" },
        { functionalEventId: "FE-B", outcome: "FAILURE" },
      ],
      result: { kind: "END_STATE", endStateId: "RELEASE-HCL" },
    },
  ],
};
const hclEtResult = await execute(
  envelope(
    {
      methodType: "EVENT_TREE",
      modelId: "ET-HCL",
      revision: 2,
      mode: "HYBRID_CAUSAL_LOGIC",
    },
    [hclFt, hclBn, hclConfiguration, hclEt],
    catalogue({ A: 0.2, B: 0.24 }),
  ),
);
for (const [index, expected] of [0.84, 0, 0, 0.16].entries()) {
  assert.ok(
    Math.abs(hclEtResult.sequences[index].conditionalProbability - expected) < 1e-12,
  );
}
assert.ok(Math.abs(hclEtResult.sequences[3].conditionalProbability - 0.048) > 1e-6);
assert.equal(hclEtResult.sequences[3].cutSets.totalCount, 1);
assert.ok(Math.abs(hclEtResult.sequences[3].cutSets.cutSets[0].probability - 0.16) < 1e-12);
assert.equal(hclEtResult.sequences[3].importance.totalCount, 2);

console.log(
  JSON.stringify({
    faultTree: ftResult.topEventProbability,
    bayesianNetwork: bnResult.marginals[0].values.map((value) => value.probability),
    eventTree: etResult.sequences.map((sequence) => sequence.conditionalProbability),
    hybridCausalLogic: hclResult.probability,
    hybridCausalLogicEventTree: hclEtResult.sequences.map(
      (sequence) => sequence.conditionalProbability,
    ),
  }),
);
