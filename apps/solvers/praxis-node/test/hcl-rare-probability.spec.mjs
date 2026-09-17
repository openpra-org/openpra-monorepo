import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { checkProbability, requestFor } from "./hcl-source-helpers.mjs";

const addon = createRequire(import.meta.url)("..");
for (const probability of [0, 1e-15, 1e-100]) {
  test(`native HCL retains rare linked probability ${probability}`, () => {
    const request = requestFor({
      variables: [{ name: "N", states: ["True", "False"], parents: [], probabilities: [probability, 1 - probability] }],
      settings: {
        sampler: "MC",
        sample_count: 10,
        seed: 42,
        cpt_probability_clip_epsilon: 0,
        basic_event_distributions: [],
        cpt_row_distributions: [],
      },
    });
    request.request.calculationType = "PROBABILITY";
    delete request.modelSnapshots[0].solverSettings.uncertainty;
    const response = JSON.parse(addon.execute(JSON.stringify(request)));
    assert.equal(response.error, undefined, JSON.stringify(response));
    checkProbability(response.result.probability, probability * 0.2);
  });
}

test("numerical assertions reject zero, wrong magnitude and nonfinite rare outputs", () => {
  for (const actual of [0, 5e-16, 1e-14, NaN, Infinity]) {
    assert.throws(() => checkProbability(actual, 1e-15));
  }
  checkProbability(1e-15, 1e-15);
});
