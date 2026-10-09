import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { requestFor, eventTreeRequestFor, checkPopulation, checkScaled } from "./hcl-source-helpers.mjs";
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
      checkPopulation(output.result.uncertainty, scenario.samples, c.name);
    });
  }

for (const c of fixture.cases.filter((c) => c.outputs))
  test(`native seismic ET: ${c.name}`, () => {
    const request = eventTreeRequestFor(c);
    const output = invoke("execute", request);
    assert.equal(output.error, undefined, JSON.stringify(output));
    for (const sequence of output.result.sequences) {
      const samples = c.outputs[0].samples.map((p) => (sequence.sequenceId === "FAILURE" ? p : 1 - p));
      checkPopulation(sequence.uncertainty.conditionalProbability, samples, sequence.sequenceId);
      checkScaled(sequence.uncertainty.annualFrequency, sequence.uncertainty.conditionalProbability, 0.01, sequence.sequenceId);
      assert.equal(sequence.cutSets, undefined);
    }
  });

for (const c of fixture.errors)
  test(`native seismic rejects excessive ${c.name} totals`, () => {
    const output = invoke("execute", requestFor(c, true));
    assert.ok(JSON.stringify(output.error).includes("PGA bin"), JSON.stringify(output));
  });

test("native seismic validates node structure, state coverage and exclusivity", () => {
  const c = fixture.cases.find((c) => c.outputs);
  for (const mutate of [
    (g) => {
      g[0].bayesianNetworkNode.modelId = "OTHER";
    },
    (g) => {
      g[0].bins[0].stateId = "missing";
    },
    (g) => {
      g[1].pgaParentId = "A";
    },
    (g) => {
      g[1].demands.pop();
    },
    (g) => {
      g.push(structuredClone(g[0]));
    },
    (g) => {
      g[0].bayesianNetworkNode.entityId = "Q";
    },
  ]) {
    const request = requestFor(c, true);
    mutate(request.modelSnapshots[0].solverSettings.uncertainty.cptGenerators);
    assert.ok(invoke("validate", request).error);
  }
});
