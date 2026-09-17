import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { requestFor, eventTreeRequestFor, checkSummary } from "./hcl-source-helpers.mjs";
const addon = createRequire(import.meta.url)("..");
const fixture = JSON.parse(
  readFileSync(new URL("../../praxis/tests/fixtures/hcl_mh_seismic/reference.json", import.meta.url)),
);
const invoke = (method, request) => JSON.parse(addon[method](JSON.stringify(request)));

for (const c of fixture.cases.filter((c) => c.outputs))
  for (const scenario of c.outputs) {
    test(`native seismic FT: ${c.name}, ${JSON.stringify(scenario.evidence)}`, () => {
      const request = requestFor(c, true);
      request.modelSnapshots[0].baseEvidence.observations = Object.entries(scenario.evidence).map(
        ([nodeId, state]) => ({ nodeId, stateId: c.variables.find((v) => v.name === nodeId).states[state] }),
      );
      assert.equal(invoke("validate", request).result?.valid, true);
      const output = invoke("execute", request);
      assert.equal(output.error, undefined, JSON.stringify(output));
      checkSummary(output.result.uncertainty, scenario.samples);
    });
  }

for (const c of fixture.cases.filter((c) => c.outputs))
  test(`native seismic ET: ${c.name}`, () => {
    const request = eventTreeRequestFor(c);
    const output = invoke("execute", request);
    assert.equal(output.error, undefined, JSON.stringify(output));
    for (const sequence of output.result.sequences) {
      const samples = c.outputs[0].samples.map((p) => (sequence.sequenceId === "FAILURE" ? p : 1 - p));
      checkSummary(sequence.uncertainty.conditionalProbability, samples);
      checkSummary(
        sequence.uncertainty.annualFrequency,
        samples.map((p) => p * 0.01),
      );
      assert.equal(sequence.cutSets, undefined);
    }
  });

for (const c of fixture.errors)
  test(`native seismic rejects excessive ${c.name} totals`, () => {
    const output = invoke("execute", requestFor(c, true));
    assert.ok(JSON.stringify(output.error).includes("1 + 1e-9"), JSON.stringify(output));
  });

test("native seismic validates node structure, state coverage and exclusivity", () => {
  const c = fixture.cases.find((c) => c.outputs);
  for (const mutate of [
    (g) => {
      g[0].bayesianNetworkNode.modelId = "OTHER";
    },
    (g) => {
      g[0].generator.bins[0].stateId = "missing";
    },
    (g) => {
      g[1].generator.pgaParentId = "A";
    },
    (g) => {
      g[1].generator.pgaCenters.pop();
    },
    (g) => {
      g.push(structuredClone(g[0]));
    },
    (g) => {
      g[0].bayesianNetworkNode.entityId = "Q";
    },
  ]) {
    const request = requestFor(c, true);
    // Clone because the common fixture objects must remain immutable.
    request.modelSnapshots[0].solverSettings.uncertainty.cptGenerators = structuredClone(
      request.modelSnapshots[0].solverSettings.uncertainty.cptGenerators,
    );
    mutate(request.modelSnapshots[0].solverSettings.uncertainty.cptGenerators);
    assert.ok(invoke("validate", request).error);
  }
});
