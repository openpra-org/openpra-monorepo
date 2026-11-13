import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { pointValue, probability } from "./hcl-source-helpers.mjs";

const addon = createRequire(import.meta.url)("..");
const run = (request) => JSON.parse(addon.execute(JSON.stringify(request)));

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

function snapshots() {
  const outcomes = [
    ["SS", "SUCCESS", "SUCCESS", "OK"],
    ["SF", "SUCCESS", "FAILURE", "CD"],
    ["FS", "FAILURE", "SUCCESS", "CD"],
    ["FF", "FAILURE", "FAILURE", "CD"],
  ];
  return {
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
            rows: [{ id: "H-0", parentStates: [], values: [{ stateId: "LOW", probability: 0.9 }, { stateId: "HIGH", probability: 0.1 }] }],
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
        initiatingEventFrequency: { expression: pointValue("PER_YEAR", 0.01) },
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
        basicEvents: [["A1", 0.3], ["B1", 0.3], ["X", 0.1], ["Y", 0.2]].map(([id, value]) => ({ id, expression: probability(value) })),
      },
    },
  };
}

const tree = (extra = {}) => ({
  schemaVersion: "1.0.0",
  request: {
    schemaVersion: "1.0.0",
    methodType: "EVENT_TREE",
    modelId: "ET",
    revision: 1,
    mode: "HYBRID_CAUSAL_LOGIC",
    requestedBy: "dependency-importance-test",
    calculationType: "PROBABILITY",
    ...extra,
  },
  ...snapshots(),
});

const faultTreeRun = (extra = {}) => ({
  schemaVersion: "1.0.0",
  request: {
    schemaVersion: "1.0.0",
    methodType: "HYBRID_CAUSAL_LOGIC",
    modelId: "HCL",
    revision: 1,
    requestedBy: "dependency-importance-test",
    calculationType: "PROBABILITY",
    faultTreeTopGate: { modelId: "FT-A", entityId: "FT-A-TOP" },
    ...extra,
  },
  ...snapshots(),
});

const PA = 0.9 * 0.01 + 0.1 * 0.5;
const PB = 0.9 * 0.02 + 0.1 * 0.6;
const BOTH = 0.9 * 0.01 * 0.02 + 0.1 * 0.5 * 0.6;
const NEITHER = 0.9 * 0.99 * 0.98 + 0.1 * 0.5 * 0.4;
const hazard = (state) => [{ nodeId: "H", stateId: state }];
const grid = { gridName: "H", hazardNodeIds: ["H"], annualFrequencyScale: { value: 2, unit: "PER_YEAR", annualization: { basis: "PLANT_YEAR", hoursPerYear: 8760 } }, normalizeWeights: false };
const close = (left, right) => Math.abs(left - right) <= 1e-13;
const of = (rows, id) => rows.find((row) => row.basicEventId === id);

function check(row, total, chance, occurred, notOccurred) {
  assert.ok(close(row.probability, chance), `${row.basicEventId} probability ${row.probability}`);
  assert.ok(close(row.occurred, occurred), `${row.basicEventId} occurred ${row.occurred} != ${occurred}`);
  assert.ok(close(row.notOccurred, notOccurred), `${row.basicEventId} not occurred ${row.notOccurred} != ${notOccurred}`);
  assert.ok(close(row.birnbaum, occurred - notOccurred));
  assert.ok(close(row.riskAchievementWorth, occurred / total));
  assert.ok(close(row.riskReductionWorth, total / notOccurred));
  assert.ok(close(row.fussellVesely, (total - notOccurred) / total));
  assert.ok(close(row.criticality, (occurred * chance) / total));
}

test("a run without the option returns no importance", () => {
  const result = run(tree()).result;
  assert.ok(result.sequences.every((row) => row.dependencyImportance === undefined));
  assert.ok(result.endStateAggregates.every((row) => row.dependencyImportance === undefined));
  assert.equal(run(faultTreeRun()).result.dependencyImportance, undefined);
});

test("fault tree importance conditions on each event", () => {
  const plain = run(faultTreeRun()).result;
  const response = run(faultTreeRun({ dependencyImportance: true }));
  assert.equal(response.error, undefined);
  assert.equal(response.result.probability, plain.probability);
  const total = 1 - (1 - PA) * 0.9;
  assert.ok(close(response.result.probability, total));
  const rows = response.result.dependencyImportance;
  assert.deepEqual(rows.map((row) => row.basicEventId), ["A1", "X"]);
  check(of(rows, "A1"), total, PA, 1, 0.1);
  check(of(rows, "X"), total, 0.1, 1, PA);
});

test("sequence and end state importance follow the network", () => {
  const plain = run(tree()).result;
  const response = run(tree({ dependencyImportance: true }));
  assert.equal(response.error, undefined);
  const result = response.result;
  for (const row of result.sequences) {
    assert.equal(row.conditionalProbability, plain.sequences.find((other) => other.sequenceId === row.sequenceId).conditionalProbability);
  }
  const sf = result.sequences.find((row) => row.sequenceId === "SF");
  const sfTotal = 0.9 * ((PB - BOTH) + (1 - PA - (PB - BOTH)) * 0.2);
  assert.ok(close(sf.conditionalProbability, sfTotal));
  check(of(sf.dependencyImportance, "B1"), sfTotal, PB, 0.9 * (1 - BOTH / PB), 0.9 * (NEITHER / (1 - PB)) * 0.2);
  check(of(sf.dependencyImportance, "X"), sfTotal, 0.1, 0, sfTotal / 0.9);
  const damage = result.endStateAggregates.find((row) => row.endStateId === "CD");
  const safe = 0.72 * NEITHER;
  const rows = damage.dependencyImportance;
  assert.deepEqual(rows.map((row) => row.basicEventId), ["A1", "B1", "X", "Y"]);
  check(of(rows, "A1"), 1 - safe, PA, 1, 1 - (0.72 * NEITHER) / (1 - PA));
  check(of(rows, "Y"), 1 - safe, 0.2, 1, 1 - 0.9 * NEITHER);
  const ok = result.endStateAggregates.find((row) => row.endStateId === "OK").dependencyImportance;
  for (const row of rows) {
    const other = of(ok, row.basicEventId);
    assert.ok(close(row.occurred + other.occurred, 1));
    assert.ok(close(row.notOccurred + other.notOccurred, 1));
  }
  assert.equal(of(ok, "A1").riskReductionWorth !== null, true);
  assert.equal(of(ok, "A1").occurred, 0);
});

test("each scenario has its own importance and the grid mixture equals the plain run", () => {
  const rows = ["LOW", "HIGH"].map((state) => ({ scenarioId: state, observations: hazard(state), hazardObservations: hazard(state) }));
  const plain = run(tree({ dependencyImportance: true })).result;
  const response = run(tree({ dependencyImportance: true, evidenceBatch: rows, hazardConvolution: grid }));
  assert.equal(response.error, undefined);
  const [low, high] = response.result.batchResults;
  const lowDamage = low.endStateAggregates.find((row) => row.endStateId === "CD").dependencyImportance;
  const highDamage = high.endStateAggregates.find((row) => row.endStateId === "CD").dependencyImportance;
  assert.ok(close(of(lowDamage, "A1").probability, 0.01));
  assert.ok(close(of(highDamage, "A1").probability, 0.5));
  check(of(highDamage, "A1"), 1 - 0.72 * 0.5 * 0.4, 0.5, 1, 1 - 0.72 * 0.4);
  const mixedStates = response.result.hazardConvolution.endStateAggregates;
  for (const state of plain.endStateAggregates) {
    const mixed = mixedStates.find((row) => row.endStateId === state.endStateId).dependencyImportance;
    for (const row of state.dependencyImportance) {
      const other = of(mixed, row.basicEventId);
      for (const key of ["probability", "occurred", "notOccurred", "birnbaum", "riskAchievementWorth", "riskReductionWorth", "fussellVesely", "criticality"]) {
        assert.ok(close(other[key], row[key]), `${state.endStateId} ${row.basicEventId} ${key}: ${other[key]} != ${row[key]}`);
      }
    }
  }
  for (const sequence of plain.sequences) {
    const mixed = response.result.hazardConvolution.sequences.find((row) => row.sequenceId === sequence.sequenceId).dependencyImportance;
    for (const row of sequence.dependencyImportance) {
      assert.ok(close(of(mixed, row.basicEventId).birnbaum, row.birnbaum), `${sequence.sequenceId} ${row.basicEventId}`);
    }
  }
  const treeGrid = run(faultTreeRun({ dependencyImportance: true, evidenceBatch: rows, hazardConvolution: grid })).result;
  const treePlain = run(faultTreeRun({ dependencyImportance: true })).result.dependencyImportance;
  check(of(treeGrid.batchResults[1].dependencyImportance, "X"), 1 - 0.5 * 0.9, 0.1, 1, 0.5);
  for (const row of treePlain) {
    const other = of(treeGrid.hazardConvolution.dependencyImportance, row.basicEventId);
    assert.ok(close(other.birnbaum, row.birnbaum) && close(other.fussellVesely, row.fussellVesely) && close(other.criticality, row.criticality));
  }
});

test("a certain or impossible event leaves the undefined measures empty", () => {
  const response = run(tree({ dependencyImportance: true, evidenceBatch: [{ scenarioId: "low", observations: [...hazard("LOW"), { nodeId: "NA", stateId: "True" }] }] }));
  assert.equal(response.error, undefined);
  const damage = response.result.batchResults[0].endStateAggregates.find((row) => row.endStateId === "CD").dependencyImportance;
  const certain = of(damage, "A1");
  assert.equal(certain.probability, 1);
  assert.equal(certain.notOccurred, null);
  assert.equal(certain.birnbaum, null);
  assert.equal(certain.riskReductionWorth, null);
  assert.equal(certain.fussellVesely, null);
  assert.ok(close(certain.riskAchievementWorth, 1));
  assert.ok(close(certain.criticality, 1));
});

test("importance is refused outside dependency probability runs", () => {
  for (const extra of [{ dependencyImportance: true, mode: "INDEPENDENT" }, { dependencyImportance: true, calculationType: "UNCERTAINTY" }, { dependencyImportance: "yes" }]) {
    assert.ok(run(tree(extra)).error, JSON.stringify(extra));
  }
  for (const extra of [{ dependencyImportance: true, calculationType: "UNCERTAINTY" }, { dependencyImportance: 1 }]) {
    assert.ok(run(faultTreeRun(extra)).error, JSON.stringify(extra));
  }
});

function sampled(request, extra = {}) {
  request.request = { ...request.request, calculationType: "UNCERTAINTY", ...extra };
  const row = (nodeId, rowId, concentrations) => ({
    bayesianNetworkNode: { modelId: "BN", entityId: nodeId },
    cptRowId: rowId,
    row: { node: "VALUE", law: { family: "DIRICHLET", concentrations } },
  });
  const uniform = (entityId, lower, upper) => ({
    faultTreeBasicEvent: { entityId },
    expression: { node: "VALUE", value: { unit: "PROBABILITY", law: { family: "UNIFORM", lower, upper } } },
  });
  request.modelSnapshots[0].solverSettings.uncertainty = {
    sampler: "MC",
    sampleCount: 40,
    seed: 11,
    basicEvents: [uniform("X", 0.05, 0.15), uniform("Y", 0.1, 0.3)],
    cptRows: [row("H", "H-0", [18, 2]), row("NA", "NA-LOW", [99, 1]), row("NA", "NA-HIGH", [5, 5]), row("NB", "NB-LOW", [49, 1]), row("NB", "NB-HIGH", [4, 6])],
  };
  return request;
}

function checkSummary(summary) {
  assert.ok(summary.sampleCount >= 1 && summary.sampleCount <= 40);
  assert.ok(summary.percentile05 <= summary.median + 1e-15 && summary.median <= summary.percentile95 + 1e-15);
  assert.ok(Number.isFinite(summary.mean));
}

test("importance under uncertainty samples the leading events of each target", () => {
  const point = run(faultTreeRun({ dependencyImportance: true })).result.dependencyImportance;
  const response = run(sampled(faultTreeRun(), { dependencyImportance: true, dependencyImportanceEvents: 1 }));
  assert.equal(response.error, undefined, JSON.stringify(response.error));
  const rows = response.result.dependencyImportance;
  assert.deepEqual(rows.map(({ uncertainty, ...rest }) => rest), point);
  const leading = [...point].sort((left, right) => right.fussellVesely - left.fussellVesely)[0].basicEventId;
  assert.deepEqual(rows.filter((row) => row.uncertainty !== undefined).map((row) => row.basicEventId), [leading]);
  const summary = of(rows, leading).uncertainty;
  for (const key of ["birnbaum", "riskAchievementWorth", "riskReductionWorth", "fussellVesely", "criticality"]) checkSummary(summary[key]);
  assert.ok(summary.fussellVesely.percentile05 < summary.fussellVesely.percentile95);

  const both = run(sampled(faultTreeRun(), { dependencyImportance: true, dependencyImportanceEvents: 5 })).result.dependencyImportance;
  assert.ok(both.every((row) => row.uncertainty !== undefined));
  assert.deepEqual(of(both, leading).uncertainty, summary);

  const treeRun = run(sampled(tree(), { dependencyImportance: true, dependencyImportanceEvents: 2 }));
  assert.equal(treeRun.error, undefined, JSON.stringify(treeRun.error));
  for (const sequence of treeRun.result.sequences) {
    assert.equal(sequence.dependencyImportance.filter((row) => row.uncertainty !== undefined).length, 2);
  }
  const damage = treeRun.result.endStateAggregates.find((row) => row.endStateId === "CD").dependencyImportance;
  const ranked = [...damage].sort((left, right) => right.fussellVesely - left.fussellVesely || left.basicEventId.localeCompare(right.basicEventId));
  assert.deepEqual(damage.filter((row) => row.uncertainty !== undefined).map((row) => row.basicEventId).sort(), ranked.slice(0, 2).map((row) => row.basicEventId).sort());
  for (const row of damage.filter((entry) => entry.uncertainty !== undefined)) checkSummary(row.uncertainty.fussellVesely);

  const batch = run(sampled(tree(), { dependencyImportance: true, dependencyImportanceEvents: 1, evidenceBatch: [{ scenarioId: "low", observations: hazard("LOW") }, { scenarioId: "high", observations: hazard("HIGH") }] }));
  assert.equal(batch.error, undefined, JSON.stringify(batch.error));
  for (const result of batch.result.batchResults) {
    for (const sequence of result.sequences) assert.equal(sequence.dependencyImportance.filter((row) => row.uncertainty !== undefined).length, 1);
  }
  const treeBatch = run(sampled(faultTreeRun(), { dependencyImportance: true, dependencyImportanceEvents: 2, evidenceBatch: [{ scenarioId: "low", observations: hazard("LOW") }, { scenarioId: "high", observations: hazard("HIGH") }] }));
  assert.equal(treeBatch.error, undefined, JSON.stringify(treeBatch.error));
  for (const result of treeBatch.result.batchResults) assert.equal(result.dependencyImportance.filter((row) => row.uncertainty !== undefined).length, 2);

  for (const extra of [{ dependencyImportance: true }, { dependencyImportance: true, dependencyImportanceEvents: 0 }, { dependencyImportance: true, dependencyImportanceEvents: 101 }]) {
    assert.ok(run(sampled(faultTreeRun(), extra)).error, JSON.stringify(extra));
    assert.ok(run(sampled(tree(), extra)).error, JSON.stringify(extra));
  }
  const rowsGrid = ["LOW", "HIGH"].map((state) => ({ scenarioId: state, observations: hazard(state), hazardObservations: hazard(state) }));
  assert.ok(run(sampled(tree(), { dependencyImportance: true, dependencyImportanceEvents: 2, evidenceBatch: rowsGrid, hazardConvolution: grid })).error);
});

test("the hazard grid under uncertainty equals the sampled run without hazard evidence", () => {
  const rows = ["LOW", "HIGH"].map((state) => ({ scenarioId: state, observations: hazard(state), hazardObservations: hazard(state) }));
  const same = (left, right) => {
    for (const key of ["sampleCount", "mean", "standardDeviation", "minimum", "percentile05", "median", "percentile95", "maximum"]) {
      assert.ok(Math.abs(left[key] - right[key]) <= 1e-12, `${key}: ${left[key]} != ${right[key]}`);
    }
  };
  for (const normalizeWeights of [false, true]) {
    const plain = run(sampled(faultTreeRun())).result;
    const gridded = run(sampled(faultTreeRun(), { evidenceBatch: rows, hazardConvolution: { ...grid, normalizeWeights } }));
    assert.equal(gridded.error, undefined, JSON.stringify(gridded.error));
    const hazardResult = gridded.result.hazardConvolution;
    same(hazardResult.uncertainty.convolvedProbability, plain.uncertainty);
    assert.ok(Math.abs(hazardResult.uncertainty.integratedAnnualFrequency.mean - 2 * plain.uncertainty.mean) <= 1e-12);
    assert.ok(plain.uncertainty.minimum < plain.uncertainty.maximum);

    const plainTree = run(sampled(tree())).result;
    const griddedTree = run(sampled(tree(), { evidenceBatch: rows, hazardConvolution: { ...grid, normalizeWeights } }));
    assert.equal(griddedTree.error, undefined, JSON.stringify(griddedTree.error));
    for (const sequence of plainTree.sequences) {
      const mixed = griddedTree.result.hazardConvolution.sequences.find((row) => row.sequenceId === sequence.sequenceId);
      same(mixed.uncertainty.convolvedProbability, sequence.uncertainty.conditionalProbability);
    }
    for (const state of griddedTree.result.hazardConvolution.endStateAggregates) {
      assert.equal(state.uncertainty.convolvedProbability.sampleCount, 40);
      assert.ok(Math.abs(state.uncertainty.integratedAnnualFrequency.mean - 2 * state.uncertainty.convolvedProbability.mean) <= 1e-12);
    }
    const damage = griddedTree.result.hazardConvolution.endStateAggregates.find((row) => row.endStateId === "CD");
    const safe = griddedTree.result.hazardConvolution.endStateAggregates.find((row) => row.endStateId === "OK");
    assert.ok(Math.abs(damage.uncertainty.convolvedProbability.mean + safe.uncertainty.convolvedProbability.mean - 1) <= 1e-12);
  }
  const pointGrid = run(tree({ evidenceBatch: rows, hazardConvolution: grid })).result.hazardConvolution;
  assert.ok(pointGrid.sequences.every((row) => row.uncertainty === undefined));
});
