import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

const { execute } = createRequire(import.meta.url)("..");
const reference = JSON.parse(readFileSync(new URL("../../praxis/tests/data/ccf_reference.json", import.meta.url), "utf8"));

const gateId = "00000000-0000-4000-8000-000000000001";
const modelId = "00000000-0000-4000-8000-000000000002";
const pointOf = (unit, value) => ({ node: "VALUE", value: { unit, law: { family: "POINT", value } } });

function run(request) {
  const response = JSON.parse(execute(JSON.stringify({ schemaVersion: "1.0.0", ...request })));
  if (response.error !== undefined) throw new Error(response.error.message);
  return response.result;
}

function faultTree(size, gateType, group, calculationType, settings) {
  const members = Array.from({ length: size }, (_, index) => `M${index + 1}`);
  return run({
    request: {
      schemaVersion: "1.0.0",
      methodType: "FAULT_TREE",
      modelId,
      revision: 1,
      requestedBy: "analyst",
      calculationType,
      workflow: "MANUAL",
      settings: { algorithm: "BDD", approximation: "EXACT", variableOrder: "DFS", reorderBudgetSeconds: 60, expandCcf: true, missionTimeHours: 8760, ...settings },
    },
    modelSnapshots: [{
      id: modelId,
      projectId: "project-1",
      methodType: "FAULT_TREE",
      revision: 1,
      topGate: { gateId },
      gates: [{ id: gateId, kind: "GATE", gateType, code: "TOP", name: "Top", description: "" }],
      leafNodes: members.map((member, index) => ({ id: `ref-${member}`, kind: "BASIC_EVENT_REFERENCE", basicEventId: member, index })),
      gateInputs: members.map((member, index) => ({ id: `input-${member}`, gateId, childId: `ref-${member}`, order: index })),
    }],
    resources: {
      faultTreeBasicEventCatalogue: {
        projectId: "project-1",
        basicEvents: members.map((id) => ({ id, expression: pointOf("PROBABILITY", 0.01) })),
        commonCauseFailureGroups: [{ id: "G", members, ...group }],
      },
    },
  });
}

function groupOf(entry) {
  return entry.total === null ? { factors: entry.factors } : { factors: entry.factors, total: entry.total };
}

test("every common cause model gives the hand top probability for groups of two to eight", () => {
  assert.equal(reference.points.length, 63);
  for (const entry of reference.points) {
    for (const [gateType, expected] of [["AND", entry.andTop], ["OR", entry.orTop]]) {
      const result = faultTree(entry.size, gateType, groupOf(entry), "PROBABILITY", {});
      const top = result.topEventProbability;
      assert.ok(Math.abs(top / expected - 1) < 1e-9, `${entry.name} ${gateType}: ${top} against ${expected}`);
    }
  }
});

test("sampled common cause runs match independently drawn top means", () => {
  assert.equal(reference.sampled.length, 42);
  for (const entry of reference.sampled) {
    for (const [samplingMethod, seed] of [["MONTE_CARLO", 5], ["LATIN_HYPERCUBE", 6]]) {
      const result = faultTree(entry.size, "OR", groupOf(entry), "UNCERTAINTY", { numTrials: 20000, seed, samplingMethod });
      const { mean, standardError } = result.uncertainty;
      const bound = 5 * Math.hypot(standardError, entry.orTopError);
      assert.ok(Math.abs(mean - entry.orTopMean) <= bound, `${entry.name} ${samplingMethod}: ${mean} against ${entry.orTopMean} within ${bound}`);
    }
  }
});

test("a binomial failure rate group refuses a total and the other models need one", () => {
  const bfr = reference.points.find((entry) => entry.name === "bfr 3");
  const beta = reference.points.find((entry) => entry.name === "beta 3");
  assert.throws(() => faultTree(3, "AND", { factors: bfr.factors, total: pointOf("PROBABILITY", 0.01) }, "PROBABILITY", {}), /takes no total/);
  assert.throws(() => faultTree(3, "AND", { factors: beta.factors }, "PROBABILITY", {}), /needs a total/);
});

function operations(list) {
  return run({ request: { schemaVersion: "1.0.0", methodType: "UNCERTAINTY", operations: list }, modelSnapshots: [] }).operations;
}

function assertCounts(actual, expected, label) {
  assert.equal(actual.length, expected.length, label);
  actual.forEach((value, index) => assert.ok(Math.abs(value - expected[index]) <= 1e-12 * Math.max(1, Math.abs(expected[index])), `${label}: ${actual} against ${expected}`));
}

test("impact vectors map down and up between group sizes", () => {
  const down = reference.mapping.down;
  const up = reference.mapping.up;
  const results = operations([
    ...down.map((entry, index) => ({ id: `down-${index}`, operation: { kind: "CCF_MAP_DOWN", counts: entry.counts, targetSize: entry.targetSize } })),
    ...up.map((entry, index) => ({ id: `up-${index}`, operation: { kind: "CCF_MAP_UP", independent: entry.independent, nonLethal: entry.nonLethal, lethal: entry.lethal, rho: entry.rho, targetSize: entry.targetSize } })),
    { id: "table", operation: { kind: "CCF_MAP_UP", independent: 0, nonLethal: [1, 0], lethal: 0, rho: 0.1, targetSize: 4 } },
    { id: "rows", operation: { kind: "CCF_IMPACT_VECTOR", groupSize: 3, multiplicities: [{ failed: 3, events: 2 }, { failed: 2, events: 5 }] } },
  ]);
  down.forEach((entry, index) => {
    assertCounts(results[index].counts, entry.expected, `down ${index}`);
    assert.ok(Math.abs(results[index].noImpact - entry.noImpact) <= 1e-12 * Math.max(1, entry.noImpact));
  });
  up.forEach((entry, index) => assertCounts(results[down.length + index].counts, entry.expected, `up ${index}`));
  assertCounts(results.at(-2).counts, [1.62, 0.225, 0.01, 0], "Table C-6 event 5");
  assert.deepEqual(results.at(-1), { id: "rows", groupSize: 3, counts: [0, 5, 2] });
});

test("an EBR-II beta factor law converts to the standard beta factor", () => {
  const { mean, errorFactor, level, plugin, expected } = reference.betaConversion;
  const parameterReference = { referenceType: "WORKBOOK_PARAMETER", workbookId: "da", entityId: "ebr-beta" };
  const b = { node: "PARAMETER", reference: parameterReference };
  const result = run({
    request: {
      schemaVersion: "1.0.0",
      methodType: "UNCERTAINTY",
      parameters: [{ reference: parameterReference, expression: { node: "VALUE", value: { unit: "FACTOR", law: { family: "LOGNORMAL", mean, errorFactor, level } } } }],
      expressions: [{
        id: "standard",
        unit: "FRACTION",
        expression: { node: "OPERATION", operation: "DIVIDE", operands: [b, { node: "OPERATION", operation: "ADD", operands: [pointOf("FACTOR", 1), b] }] },
        probabilities: [],
        sampling: { method: "LATIN_HYPERCUBE", trials: 50000, seed: 9 },
      }],
    },
    modelSnapshots: [],
  });
  const standard = result.expressions[0];
  assert.ok(Math.abs(standard.point - plugin) < 1e-16);
  assert.ok(Math.abs(standard.sampled.mean - expected) <= 5 * standard.sampled.standardError, `${standard.sampled.mean} against ${expected}`);
});
