import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { pointValue, probability } from "./hcl-source-helpers.mjs";

const addon = createRequire(import.meta.url)("..");
const run = (request) => JSON.parse(addon.execute(JSON.stringify(request)));
const INITIATOR = 0.01;

function faultTree(id, events) {
  return {
    id,
    projectId: "P",
    methodType: "FAULT_TREE",
    revision: 1,
    topGate: { gateId: `${id}-TOP` },
    gates: [{ id: `${id}-TOP`, kind: "GATE", gateType: "OR", code: `${id}-TOP`, name: `${id}-TOP`, description: "" }],
    leafNodes: events.map((basicEventId) => ({ id: `ref-${basicEventId}`, kind: "BASIC_EVENT_REFERENCE", basicEventId })),
    gateInputs: events.map((event, order) => ({ id: `${id}-input-${order}`, gateId: `${id}-TOP`, childId: `ref-${event}`, order })),
  };
}

function component(nodeId, low, high) {
  return {
    nodeId,
    parents: [{ nodeId: "H", order: 0 }],
    rows: [
      ["LOW", low],
      ["HIGH", high],
    ].map(([state, value]) => ({
      id: `${nodeId}-${state}`,
      parentStates: [{ parentNodeId: "H", stateId: state }],
      values: [
        { stateId: "False", probability: 1 - value },
        { stateId: "True", probability: value },
      ],
    })),
  };
}

function request(extra = {}) {
  const outcomes = [
    ["SS", "SUCCESS", "SUCCESS", "OK"],
    ["SF", "SUCCESS", "FAILURE", "CD"],
    ["FS", "FAILURE", "SUCCESS", "CD"],
    ["FF", "FAILURE", "FAILURE", "CD"],
  ];
  return {
    schemaVersion: "1.0.0",
    request: {
      schemaVersion: "1.0.0",
      methodType: "EVENT_TREE",
      modelId: "ET",
      revision: 1,
      mode: "HYBRID_CAUSAL_LOGIC",
      requestedBy: "dependency-cut-set-test",
      calculationType: "PROBABILITY",
      ...extra,
    },
    modelSnapshots: [
      {
        id: "HCL",
        methodType: "HYBRID_CAUSAL_LOGIC",
        revision: 1,
        bayesianNetwork: { modelId: "BN" },
        faultTrees: [{ faultTree: { modelId: "FT-A" } }, { faultTree: { modelId: "FT-B" } }],
        bindings: [
          ["A1", "FT-A", "NA"],
          ["B1", "FT-B", "NB"],
        ].map(([event, tree, node]) => ({
          id: `link-${event}`,
          faultTreeBasicEvent: { modelId: tree, entityId: event },
          bayesianNetworkNode: { modelId: "BN", entityId: node },
          trueStateIds: ["True"],
        })),
        baseEvidence: { observations: [] },
        solverSettings: { foldConstants: false, spliceNullGates: false },
      },
      {
        id: "BN",
        methodType: "BAYESIAN_NETWORK",
        revision: 1,
        nodes: [
          { id: "H", states: [{ id: "LOW" }, { id: "HIGH" }] },
          { id: "NA", states: [{ id: "False" }, { id: "True" }] },
          { id: "NB", states: [{ id: "False" }, { id: "True" }] },
        ],
        conditionalProbabilityTables: [
          {
            nodeId: "H",
            parents: [],
            rows: [
              {
                id: "H-0",
                parentStates: [],
                values: [
                  { stateId: "LOW", probability: 0.9 },
                  { stateId: "HIGH", probability: 0.1 },
                ],
              },
            ],
          },
          component("NA", 0.01, 0.5),
          component("NB", 0.02, 0.6),
        ],
      },
      faultTree("FT-A", ["A1", "X"]),
      faultTree("FT-B", ["B1", "Y"]),
      {
        id: "ET",
        methodType: "EVENT_TREE",
        revision: 1,
        initiatingEvent: { target: { modelId: "IE", entityId: "IE-1" } },
        initiatingEventFrequency: { expression: pointValue("PER_YEAR", INITIATOR) },
        functionalEvents: [
          { id: "FE-A", name: "System A", order: 0 },
          { id: "FE-B", name: "System B", order: 1 },
        ],
        functionalEventFaultTreeLinks: [
          { functionalEventId: "FE-A", faultTreeTopGate: { modelId: "FT-A", entityId: "FT-A-TOP" } },
          { functionalEventId: "FE-B", faultTreeTopGate: { modelId: "FT-B", entityId: "FT-B-TOP" } },
        ],
        endStates: [{ id: "OK" }, { id: "CD" }],
        sequences: outcomes.map(([id, first, second, endStateId]) => ({
          id,
          path: [
            { functionalEventId: "FE-A", outcome: first },
            { functionalEventId: "FE-B", outcome: second },
          ],
          result: { kind: "END_STATE", endStateId },
        })),
        hclConfiguration: { configuration: { modelId: "HCL" } },
      },
    ],
    resources: {
      faultTreeBasicEventCatalogue: {
        projectId: "P",
        basicEvents: [
          ["A1", 0.3],
          ["B1", 0.3],
          ["X", 0.1],
          ["Y", 0.2],
        ].map(([id, value]) => ({ id, expression: probability(value) })),
      },
    },
  };
}

const ranked = { score: "FAILED_EVENTS", keep: 10 };
const hazard = (state) => [{ nodeId: "H", stateId: state }];
const sequence = (result, id) => result.sequences.find((row) => row.sequenceId === id);

function check(row, expected, scale = INITIATOR) {
  const cutSets = row.dependencyCutSets;
  assert.equal(cutSets.count, expected.length);
  assert.deepEqual(
    cutSets.items.map((item) => item.basicEventIds),
    expected.map(([events]) => events),
  );
  for (const [index, [events, value]] of expected.entries()) {
    const item = cutSets.items[index];
    assert.equal(item.order, events.length);
    assert.ok(Math.abs(item.probability - value) <= 1e-15, `${events}: ${item.probability} != ${value}`);
    assert.ok(Math.abs(item.annualFrequency - value * scale) <= 1e-17, `${events}: annual ${item.annualFrequency}`);
  }
}

test("a dependency run without the option returns no ranked cut sets", () => {
  const response = run(request());
  assert.equal(response.error, undefined);
  assert.ok(response.result.sequences.every((row) => row.dependencyCutSets === undefined));
});

test("ranked cut sets use the joint probability of their events", () => {
  const plain = run(request()).result;
  const response = run(request({ dependencyCutSets: ranked }));
  assert.equal(response.error, undefined);
  const result = response.result;
  for (const row of result.sequences) {
    assert.equal(row.conditionalProbability, sequence(plain, row.sequenceId).conditionalProbability);
    assert.equal(row.dependencyCutSets.score, "FAILED_EVENTS");
  }
  check(sequence(result, "FF"), [
    [["A1", "B1"], 0.9 * 0.01 * 0.02 + 0.1 * 0.5 * 0.6],
    [["X", "Y"], 0.1 * 0.2],
    [["A1", "Y"], (0.9 * 0.01 + 0.1 * 0.5) * 0.2],
    [["B1", "X"], (0.9 * 0.02 + 0.1 * 0.6) * 0.1],
  ]);
  check(sequence(result, "SF"), [
    [["Y"], 0.2],
    [["B1"], 0.9 * 0.02 + 0.1 * 0.6],
  ]);
});

test("the sequence score also requires the success branches", () => {
  const result = run(request({ dependencyCutSets: { score: "FAILED_EVENTS_AND_SEQUENCE", keep: 10 } })).result;
  check(sequence(result, "SF"), [
    [["Y"], 0.2 * (0.9 * 0.99 + 0.1 * 0.5) * 0.9],
    [["B1"], (0.9 * 0.02 * 0.99 + 0.1 * 0.6 * 0.5) * 0.9],
  ]);
});

test("each evidence scenario gets its own ranking", () => {
  const response = run(
    request({
      dependencyCutSets: ranked,
      evidenceBatch: [
        { scenarioId: "low", observations: hazard("LOW") },
        { scenarioId: "high", observations: hazard("HIGH") },
      ],
    }),
  );
  assert.equal(response.error, undefined);
  const [low, high] = response.result.batchResults;
  check(sequence(low, "FF"), [
    [["X", "Y"], 0.1 * 0.2],
    [["A1", "Y"], 0.01 * 0.2],
    [["B1", "X"], 0.02 * 0.1],
    [["A1", "B1"], 0.01 * 0.02],
  ]);
  check(sequence(high, "FF"), [
    [["A1", "B1"], 0.5 * 0.6],
    [["A1", "Y"], 0.5 * 0.2],
    [["B1", "X"], 0.6 * 0.1],
    [["X", "Y"], 0.1 * 0.2],
  ]);
});

test("the hazard-weighted ranking equals the ranking without hazard evidence", () => {
  const rows = ["LOW", "HIGH"].map((state) => ({
    scenarioId: state,
    observations: hazard(state),
    hazardObservations: hazard(state),
  }));
  const response = run(
    request({
      dependencyCutSets: ranked,
      evidenceBatch: rows,
      hazardConvolution: {
        gridName: "H",
        hazardNodeIds: ["H"],
        annualFrequencyScale: { value: 2, unit: "PER_YEAR", annualization: { basis: "PLANT_YEAR", hoursPerYear: 8760 } },
        normalizeWeights: false,
      },
    }),
  );
  assert.equal(response.error, undefined);
  const weighted = response.result.hazardConvolution;
  check(
    sequence(weighted, "FF"),
    [
      [["A1", "B1"], 0.9 * 0.01 * 0.02 + 0.1 * 0.5 * 0.6],
      [["X", "Y"], 0.1 * 0.2],
      [["A1", "Y"], (0.9 * 0.01 + 0.1 * 0.5) * 0.2],
      [["B1", "X"], (0.9 * 0.02 + 0.1 * 0.6) * 0.1],
    ],
    2,
  );
  check(sequence(response.result.batchResults[1], "FF"), [
    [["A1", "B1"], 0.5 * 0.6],
    [["A1", "Y"], 0.5 * 0.2],
    [["B1", "X"], 0.6 * 0.1],
    [["X", "Y"], 0.1 * 0.2],
  ]);
});

test("the order limit and the kept count are applied", () => {
  const result = run(request({ dependencyCutSets: { score: "FAILED_EVENTS", keep: 1, limitOrder: 1 } })).result;
  assert.equal(sequence(result, "FF").dependencyCutSets.count, 0);
  const kept = sequence(result, "SF").dependencyCutSets;
  assert.equal(kept.count, 2);
  assert.deepEqual(
    kept.items.map((item) => item.basicEventIds),
    [["Y"]],
  );
});

test("ranked cut sets are refused outside dependency probability runs", () => {
  const cases = [
    { dependencyCutSets: ranked, mode: "INDEPENDENT" },
    { dependencyCutSets: ranked, calculationType: "UNCERTAINTY" },
    { dependencyCutSets: { score: "FAILED_EVENTS", keep: 0 } },
    { dependencyCutSets: { score: "FAILED_EVENTS", keep: 10001 } },
    { dependencyCutSets: { score: "FAILED_EVENTS", keep: 5, limitOrder: 0 } },
    { dependencyCutSets: { score: "PRODUCT", keep: 5 } },
  ];
  for (const extra of cases) {
    const response = run(request(extra));
    assert.ok(response.error, JSON.stringify(extra));
  }
});

test("the cut-off keeps the cut sets that reach it under the network", () => {
  const result = run(request({ dependencyCutSets: { ...ranked, cutOff: 0.015 } })).result;
  check(sequence(result, "FF"), [
    [["A1", "B1"], 0.9 * 0.01 * 0.02 + 0.1 * 0.5 * 0.6],
    [["X", "Y"], 0.1 * 0.2],
  ]);
  const full = run(request({ dependencyCutSets: ranked })).result;
  for (const cutOff of [0.5, 0.11, 0.05, 0.012, 0.009, 0.001]) {
    const limited = run(request({ dependencyCutSets: { ...ranked, cutOff } })).result;
    for (const row of full.sequences) {
      const wanted = row.dependencyCutSets.items.filter((item) => item.probability >= cutOff);
      const got = sequence(limited, row.sequenceId).dependencyCutSets;
      assert.equal(got.count, wanted.length, `${row.sequenceId} at ${cutOff}`);
      assert.deepEqual(got.items, wanted);
    }
  }
  for (const cutOff of [0, -1, 1.5]) {
    assert.ok(run(request({ dependencyCutSets: { ...ranked, cutOff } })).error, String(cutOff));
  }
});

function treeRequest(extra = {}) {
  const base = request();
  base.request = {
    schemaVersion: "1.0.0",
    methodType: "HYBRID_CAUSAL_LOGIC",
    modelId: "HCL",
    revision: 1,
    requestedBy: "dependency-cut-set-test",
    calculationType: "PROBABILITY",
    faultTreeTopGate: { modelId: "FT-A", entityId: "FT-A-TOP" },
    ...extra,
  };
  return base;
}

function checkTree(cutSets, expected) {
  assert.equal(cutSets.count, expected.length);
  assert.deepEqual(
    cutSets.items.map((item) => item.basicEventIds),
    expected.map(([events]) => events),
  );
  for (const [index, [events, value]] of expected.entries()) {
    assert.equal(cutSets.items[index].order, events.length);
    assert.ok(Math.abs(cutSets.items[index].probability - value) <= 1e-15, `${events}: ${cutSets.items[index].probability}`);
  }
}

test("a fault tree dependency run ranks its cut sets only when asked", () => {
  const plain = run(treeRequest());
  assert.equal(plain.error, undefined);
  assert.equal(plain.result.dependencyCutSets, undefined);
  const response = run(treeRequest({ dependencyCutSets: { keep: 10 } }));
  assert.equal(response.error, undefined);
  assert.equal(response.result.probability, plain.result.probability);
  checkTree(response.result.dependencyCutSets, [
    [["X"], 0.1],
    [["A1"], 0.9 * 0.01 + 0.1 * 0.5],
  ]);
});

test("fault tree cut sets follow each evidence scenario and the hazard grid", () => {
  const rows = ["LOW", "HIGH"].map((state) => ({
    scenarioId: state,
    observations: hazard(state),
    hazardObservations: hazard(state),
  }));
  const batch = run(treeRequest({ dependencyCutSets: { keep: 10 }, evidenceBatch: rows.map(({ scenarioId, observations }) => ({ scenarioId, observations })) }));
  assert.equal(batch.error, undefined);
  checkTree(batch.result.batchResults[0].dependencyCutSets, [
    [["X"], 0.1],
    [["A1"], 0.01],
  ]);
  checkTree(batch.result.batchResults[1].dependencyCutSets, [
    [["A1"], 0.5],
    [["X"], 0.1],
  ]);
  const grid = (cutSets, normalizeWeights = false) =>
    run(
      treeRequest({
        dependencyCutSets: cutSets,
        evidenceBatch: rows,
        hazardConvolution: {
          gridName: "H",
          hazardNodeIds: ["H"],
          annualFrequencyScale: { value: 2, unit: "PER_YEAR", annualization: { basis: "PLANT_YEAR", hoursPerYear: 8760 } },
          normalizeWeights,
        },
      }),
    );
  const weighted = grid({ keep: 10 });
  assert.equal(weighted.error, undefined);
  checkTree(weighted.result.hazardConvolution.dependencyCutSets, [
    [["X"], 0.1],
    [["A1"], 0.9 * 0.01 + 0.1 * 0.5],
  ]);
  const limited = grid({ keep: 10, cutOff: 0.05 }).result;
  checkTree(limited.batchResults[0].dependencyCutSets, [[["X"], 0.1]]);
  checkTree(limited.batchResults[1].dependencyCutSets, [
    [["A1"], 0.5],
    [["X"], 0.1],
  ]);
  assert.equal(limited.hazardConvolution.dependencyCutSets.count, 2);
  const one = grid({ keep: 1 }).result;
  assert.equal(one.hazardConvolution.dependencyCutSets.count, 2);
  assert.equal(one.hazardConvolution.dependencyCutSets.items.length, 1);
});

test("fault tree cut sets are refused for uncertainty runs and bad settings", () => {
  const cases = [
    { dependencyCutSets: { keep: 10 }, calculationType: "UNCERTAINTY" },
    { dependencyCutSets: { keep: 0 } },
    { dependencyCutSets: { keep: 10001 } },
    { dependencyCutSets: { keep: 5, limitOrder: 0 } },
    { dependencyCutSets: { keep: 5, cutOff: 0 } },
    { dependencyCutSets: { keep: 5, score: "FAILED_EVENTS" } },
  ];
  for (const extra of cases) {
    assert.ok(run(treeRequest(extra)).error, JSON.stringify(extra));
  }
});

const HIGH_GIVEN_BOTH = (0.1 * 0.5 * 0.6) / (0.9 * 0.01 * 0.02 + 0.1 * 0.5 * 0.6);

function checkCause(cause, withCutSet) {
  assert.equal(cause.nodeId, "H");
  assert.equal(cause.stateId, "LOW");
  assert.ok(Math.abs(cause.baseline - 0.9) <= 1e-15);
  assert.ok(Math.abs(cause.withCutSet - withCutSet) <= 1e-12, String(cause.withCutSet));
  assert.ok(Math.abs(cause.shift - (0.9 - withCutSet)) <= 1e-12);
}

test("the cause trace lists the network nodes that a cut set shifts", () => {
  const plain = run(request({ dependencyCutSets: ranked })).result;
  assert.ok(sequence(plain, "FF").dependencyCutSets.items.every((item) => item.causes === undefined));
  const response = run(request({ dependencyCutSets: { ...ranked, causes: 5 } }));
  assert.equal(response.error, undefined);
  const items = sequence(response.result, "FF").dependencyCutSets.items;
  assert.deepEqual(items.map(({ causes, ...rest }) => rest), sequence(plain, "FF").dependencyCutSets.items);
  assert.deepEqual(items[0].basicEventIds, ["A1", "B1"]);
  assert.equal(items[0].causes.length, 1);
  checkCause(items[0].causes[0], 1 - HIGH_GIVEN_BOTH);
  assert.deepEqual(items[1].basicEventIds, ["X", "Y"]);
  assert.deepEqual(items[1].causes, []);
  checkCause(items[2].causes[0], 1 - 0.05 / 0.059);

  const rows = ["LOW", "HIGH"].map((state) => ({ scenarioId: state, observations: hazard(state), hazardObservations: hazard(state) }));
  const grid = run(
    request({
      dependencyCutSets: { ...ranked, causes: 5 },
      evidenceBatch: rows,
      hazardConvolution: {
        gridName: "H",
        hazardNodeIds: ["H"],
        annualFrequencyScale: { value: 2, unit: "PER_YEAR", annualization: { basis: "PLANT_YEAR", hoursPerYear: 8760 } },
        normalizeWeights: false,
      },
    }),
  ).result;
  for (const row of grid.batchResults) {
    assert.ok(sequence(row, "FF").dependencyCutSets.items.every((item) => Array.isArray(item.causes) && item.causes.length === 0));
  }
  assert.ok(sequence(grid.hazardConvolution, "FF").dependencyCutSets.items.every((item) => item.causes === undefined));

  const tree = run(treeRequest({ dependencyCutSets: { keep: 10, causes: 1 } }));
  assert.equal(tree.error, undefined);
  const [free, bound] = tree.result.dependencyCutSets.items;
  assert.deepEqual(free.basicEventIds, ["X"]);
  assert.deepEqual(free.causes, []);
  assert.deepEqual(bound.basicEventIds, ["A1"]);
  checkCause(bound.causes[0], 1 - 0.05 / 0.059);
  assert.equal(run(treeRequest({ dependencyCutSets: { keep: 10 } })).result.dependencyCutSets.items[1].causes, undefined);

  for (const causes of [0, 101, 1.5, -1]) {
    assert.ok(run(request({ dependencyCutSets: { ...ranked, causes } })).error, `event tree ${causes}`);
    assert.ok(run(treeRequest({ dependencyCutSets: { keep: 10, causes } })).error, `fault tree ${causes}`);
  }
});
