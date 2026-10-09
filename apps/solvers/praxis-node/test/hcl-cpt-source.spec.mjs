import { requestFor, checkPopulation, checkMean, sourceResolvesTails } from "./hcl-source-helpers.mjs";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
const addon = createRequire(import.meta.url)("..");
const fixture = JSON.parse(readFileSync(new URL("../../praxis/tests/fixtures/hcl_mh_cpt/reference.json", import.meta.url)));

const invoke = (method, request) => JSON.parse(addon[method](JSON.stringify(request)));

function exactFirstStateMean(c) {
  const prior = c.settings.cpt_row_distributions[0].prior;
  const n = c.variables.find((v) => v.name === "N");
  const share =
    prior.family === "DIRICHLET" ?
      prior.alpha[0] / prior.alpha.reduce((sum, value) => sum + value, 0)
    : n.states[0] === prior.true_state ? prior.alpha / (prior.alpha + prior.beta)
    : prior.beta / (prior.alpha + prior.beta);
  if (!n.parents.length) return 0.2 * share;
  const p = c.variables.find((v) => v.name === "P");
  return 0.2 * (p.probabilities[0] * n.probabilities[0] + p.probabilities[1] * share);
}

for (const c of fixture.cases)
  test(`native CPT population: ${c.name}`, () => {
    const request = requestFor(c);
    assert.equal(invoke("validate", request).result?.valid, true);
    const output = invoke("execute", request);
    assert.equal(output.error, undefined, JSON.stringify(output));
    const summary = output.result.uncertainty;
    assert.equal(summary.sampleCount, c.settings.sample_count);
    assert.equal(summary.seed, c.settings.seed);
    checkMean(summary, exactFirstStateMean(c), c.name);
    if (c.nonfinite || c.name.includes("clipped") || !sourceResolvesTails(c.settings)) return;
    const count = c.settings.sample_count;
    const n = c.variables.find((v) => v.name === "N");
    const samples = Array.from({ length: count }, (_, i) => {
      if (!n.parents.length) return 0.2 * c.cpts.N[i];
      const p = c.variables.find((v) => v.name === "P");
      return 0.2 * (p.probabilities[0] * c.cpts.N[i] + p.probabilities[1] * c.cpts.N[n.states.length * count + i]);
    });
    checkPopulation(summary, samples, c.name);
  });

for (const c of fixture.mixed)
  for (const scenario of c.outputs)
    test(`native mixed ${c.name}, evidence ${JSON.stringify(scenario.evidence)}`, () => {
      const request = requestFor(c, true);
      request.modelSnapshots[0].baseEvidence.observations = Object.entries(scenario.evidence).map(([nodeId, state]) => ({
        nodeId,
        stateId: state ? "True" : "False",
      }));
      const output = invoke("execute", request);
      assert.equal(output.error, undefined, JSON.stringify(output));
      checkPopulation(output.result.uncertainty, scenario.samples, c.name);
    });

test("native CPT rejects invalid rows and removed fields before execution", () => {
  for (const law of [
    { family: "DIRICHLET", concentrations: [0, 0] },
    { family: "DIRICHLET", concentrations: [1, 2, 3] },
    { family: "FIXED", values: [0.5, 0.3] },
  ]) {
    const request = requestFor(fixture.cases[0]);
    request.modelSnapshots[0].solverSettings.uncertainty.cptRows[0].row = { node: "VALUE", law };
    assert.ok(invoke("validate", request).error);
  }
  const request = requestFor(fixture.cases[0]);
  const row = request.modelSnapshots[0].solverSettings.uncertainty.cptRows[0];
  row.prior = { family: "BETA", alpha: 2, beta: 8, trueStateId: "True" };
  assert.ok(invoke("validate", request).error);
  delete row.prior;
  row.equivalentSampleSize = 20;
  assert.ok(invoke("validate", request).error);
});

test("native rejects the removed sampler alias and clipping setting", () => {
  const request = requestFor(fixture.mixed[1], true);
  const settings = request.modelSnapshots[0].solverSettings.uncertainty;
  settings.cptProbabilityClipEpsilon = 0.05;
  assert.ok(invoke("execute", request).error);
  delete settings.cptProbabilityClipEpsilon;
  settings.basicEventSampler = settings.sampler;
  delete settings.sampler;
  assert.ok(invoke("execute", request).error);
});
