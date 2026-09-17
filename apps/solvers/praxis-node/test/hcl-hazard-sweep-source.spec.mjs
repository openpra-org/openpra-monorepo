import { strict as assert } from "node:assert";
import { test } from "node:test";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";

const addon = createRequire(import.meta.url)("../index.js");
const { specs: cases, expected } = JSON.parse(
  readFileSync(new URL("../../praxis/tests/fixtures/hcl_mh_hazard_sweep.json", import.meta.url), "utf8"),
);
const a = cases[0].dimensions[0];

function envelope(spec) {
  return {
    schemaVersion: "1.0.0",
    request: {
      schemaVersion: "1.0.0",
      methodType: "HYBRID_CAUSAL_LOGIC",
      operation: "GENERATE_SCENARIOS",
      modelId: "hcl",
      revision: 1,
      requestedBy: "test",
      bayesianNetworkModelId: "bn",
      spec,
    },
    modelSnapshots: [
      {
        id: "bn",
        methodType: "BAYESIAN_NETWORK",
        nodes: spec.dimensions.map((d) => ({
          id: d.bnNode,
          states: d.states.map((id) => ({ id })),
        })),
      },
    ],
    resources: {},
  };
}

for (const [index, spec] of cases.entries()) {
  test(`matches HCL_MH generator exactly: case ${index + 1}`, () => {
    const request = JSON.stringify(envelope(spec));
    assert.equal(JSON.parse(addon.validate(request)).result.valid, true);
    const result = JSON.parse(addon.execute(request));
    assert.equal(result.error, undefined);
    assert.deepEqual(result.result.scenarios, expected[index]);
  });
}

for (const [name, spec] of [
  ["duplicate dimensions", { dimensions: [a, a] }],
  ["duplicate BN nodes", { dimensions: [a, { ...a, id: "Another" }] }],
  ["empty states", { dimensions: [{ ...a, states: [] }] }],
  ["duplicate states", { dimensions: [{ ...a, states: ["low", "low"] }] }],
  ["unknown exclusion", { dimensions: [a], excludedAssignments: [{ Unknown: "low" }] }],
  ["unknown exclusion state", { dimensions: [a], excludedAssignments: [{ Earthquake: "bad" }] }],
  ["zero limit", { dimensions: [a], maxScenarios: 0 }],
]) {
  test(`rejects ${name}`, () => {
    const request = JSON.stringify(envelope(spec));
    assert.ok(JSON.parse(addon.validate(request)).error);
    assert.ok(JSON.parse(addon.execute(request)).error);
  });
}
test("rejects nodes/states outside the referenced BN", () => {
  for (const mutate of [
    (e) => {
      e.modelSnapshots[0].nodes = [];
    },
    (e) => {
      e.modelSnapshots[0].nodes[0].states = [];
    },
  ]) {
    const request = envelope({ dimensions: [a] });
    mutate(request);
    assert.ok(JSON.parse(addon.execute(JSON.stringify(request))).error);
  }
});
