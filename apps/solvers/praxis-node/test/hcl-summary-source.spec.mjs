import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { requestFor, eventTreeRequestFor, checkSourceSummary } from "./hcl-source-helpers.mjs";

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
  for (const scenario of expected.outputs) {
    test(`native summary: ${expected.family}/${c.name}, ${JSON.stringify(scenario.evidence)}`, () => {
      const request = requestFor(c, true);
      request.modelSnapshots[0].baseEvidence.observations = Object.entries(scenario.evidence).map(
        ([nodeId, state]) => ({ nodeId, stateId: c.variables.find((v) => v.name === nodeId).states[state] }),
      );
      checkSourceSummary(execute(request).uncertainty, scenario.summary, c.settings.sample_count, c.settings.seed);
    });
    if (scenario.sequences) {
      for (const combined of [false, true]) {
        test(`native sequence/end-state summaries: ${c.name}, ${JSON.stringify(scenario.evidence)}, shared end state ${combined}`, () => {
          const request = eventTreeRequestFor(c, combined);
          request.modelSnapshots[0].baseEvidence.observations = Object.entries(scenario.evidence).map(
            ([nodeId, state]) => ({ nodeId, stateId: c.variables.find((v) => v.name === nodeId).states[state] }),
          );
          const result = execute(request);
          for (const sequence of result.sequences) {
            const reference = scenario.sequences[sequence.sequenceId];
            checkSourceSummary(
              sequence.uncertainty.conditionalProbability,
              reference.conditional,
              c.settings.sample_count,
              c.settings.seed,
            );
            checkSourceSummary(
              sequence.uncertainty.annualFrequency,
              reference.annual,
              c.settings.sample_count,
              c.settings.seed,
            );
          }
          assert.equal(result.endStateAggregates.length, combined ? 1 : 2);
          for (const aggregate of result.endStateAggregates) {
            const reference =
              combined ?
                scenario.combined_end_state
              : scenario.sequences[aggregate.endStateId === "RELEASE" ? "FAILURE" : "SUCCESS"].annual;
            checkSourceSummary(aggregate.uncertainty, reference, c.settings.sample_count, c.settings.seed);
          }
        });
      }
    }
  }
}
