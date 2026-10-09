import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { requestFor, eventTreeRequestFor, checkPopulation, checkScaled } from "./hcl-source-helpers.mjs";

const addon = createRequire(import.meta.url)("..");
const load = (family) =>
  JSON.parse(readFileSync(new URL(`../../praxis/tests/fixtures/hcl_mh_${family}/reference.json`, import.meta.url)));
const references = { cpt: load("cpt"), seismic: load("seismic") };
const fixture = load("summaries");
const execute = (request) => {
  const output = JSON.parse(addon.execute(JSON.stringify(request)));
  assert.equal(output.error, undefined, JSON.stringify(output));
  return output.result;
};

for (const expected of fixture.native) {
  const referencesForFamily = references[expected.family];
  const c = (referencesForFamily.mixed ?? referencesForFamily.cases).find((c) => c.name === expected.name);
  for (const [index, scenario] of expected.outputs.entries()) {
    const failures = c.outputs[index].samples;
    const observations = Object.entries(scenario.evidence).map(([nodeId, state]) => ({
      nodeId,
      stateId: c.variables.find((v) => v.name === nodeId).states[state],
    }));
    test(`native summary: ${expected.family}/${c.name}, ${JSON.stringify(scenario.evidence)}`, () => {
      const request = requestFor(c, true);
      request.modelSnapshots[0].baseEvidence.observations = observations;
      const summary = execute(request).uncertainty;
      assert.equal(summary.sampleCount, c.settings.sample_count);
      assert.equal(summary.seed, c.settings.seed);
      checkPopulation(summary, failures, c.name);
    });
    if (scenario.sequences) {
      for (const combined of [false, true]) {
        test(`native sequence/end-state summaries: ${c.name}, ${JSON.stringify(scenario.evidence)}, shared end state ${combined}`, () => {
          const request = eventTreeRequestFor(c, combined);
          request.modelSnapshots[0].baseEvidence.observations = observations;
          const result = execute(request);
          const annual = {};
          for (const sequence of result.sequences) {
            const samples = sequence.sequenceId === "FAILURE" ? failures : failures.map((p) => 1 - p);
            checkPopulation(sequence.uncertainty.conditionalProbability, samples, sequence.sequenceId);
            checkScaled(sequence.uncertainty.annualFrequency, sequence.uncertainty.conditionalProbability, 0.01, sequence.sequenceId);
            annual[sequence.sequenceId] = sequence.uncertainty.annualFrequency;
          }
          assert.equal(result.endStateAggregates.length, combined ? 1 : 2);
          for (const aggregate of result.endStateAggregates) {
            if (combined) {
              const total = aggregate.uncertainty;
              assert.ok(Math.abs(total.mean - 0.01) <= 1e-15, `combined mean ${total.mean}`);
              assert.ok(total.standardDeviation <= 1e-17, `combined spread ${total.standardDeviation}`);
              assert.ok(Math.abs(total.maximum - total.minimum) <= 1e-17, "combined samples stay paired");
            } else {
              checkScaled(aggregate.uncertainty, annual[aggregate.endStateId === "RELEASE" ? "FAILURE" : "SUCCESS"], 1, aggregate.endStateId);
            }
          }
        });
      }
    }
  }
}

test("a sampled initiating frequency multiplies each paired sample", () => {
  const c = references.cpt.mixed[1];
  const request = eventTreeRequestFor(c, true);
  const tree = request.modelSnapshots.find((s) => s.id === "ET");
  tree.initiatingEventFrequency = {
    expression: { node: "VALUE", value: { unit: "PER_YEAR", law: { family: "UNIFORM", lower: 0.005, upper: 0.015 } } },
  };
  const result = execute(request);
  const total = result.endStateAggregates[0].uncertainty;
  assert.ok(total.minimum >= 0.005 && total.maximum <= 0.015, JSON.stringify(total));
  assert.ok(Math.abs(total.mean - 0.01) <= 1e-6, `mean ${total.mean}`);
  assert.ok(Math.abs(total.standardDeviation - 0.01 / Math.sqrt(12)) <= 5e-5, `spread ${total.standardDeviation}`);
  assert.ok(Math.abs(result.frequencySemantics.annualizedInitiatingEventFrequency.value - 0.01) <= 1e-15);
  const failure = result.sequences.find((sequence) => sequence.sequenceId === "FAILURE").uncertainty;
  const error = Math.sqrt(failure.annualFrequency.standardDeviation ** 2 / failure.annualFrequency.sampleCount);
  assert.ok(Math.abs(failure.annualFrequency.mean - 0.01 * failure.conditionalProbability.mean) <= 5 * error);
});
