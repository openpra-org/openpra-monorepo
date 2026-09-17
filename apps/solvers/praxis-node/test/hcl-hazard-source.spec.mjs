import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { requestFor, withEventTree } from "./hcl-source-helpers.mjs";

const addon = createRequire(import.meta.url)("..");
const fixture = JSON.parse(readFileSync(new URL("../../praxis/tests/fixtures/hcl_mh_hazard/reference.json", import.meta.url)));
const observations = (map) => Object.entries(map).map(([nodeId, stateId]) => ({ nodeId, stateId }));
const close = (actual, expected) => assert.ok(
  Number.isFinite(actual) && Math.abs(actual - expected) <= 5e-16 + 3e-14 * Math.abs(expected),
  `native ${actual} != source ${expected}`,
);

function request(c, eventTree = false) {
  let r = requestFor({ variables: c.variables, settings: {
    sampler: "MC", sample_count: 10, seed: 42, cpt_probability_clip_epsilon: 0,
    basic_event_distributions: [], cpt_row_distributions: [],
  } });
  r.request.calculationType = "PROBABILITY";
  delete r.modelSnapshots[0].solverSettings.uncertainty;
  r.modelSnapshots[0].bindings[0].trueStateIds = ["True"];
  r.modelSnapshots[0].baseEvidence.observations = observations(c.base);
  if (eventTree) r = withEventTree(r, true);
  r.request.evidenceBatch = c.scenarios.map((scenario) => ({
    scenarioId: scenario.scenario_id,
    observations: observations(scenario.evidence),
    hazardObservations: observations(scenario.evidence).filter((o) => c.hazard_nodes.includes(o.nodeId)),
  }));
  r.request.hazardConvolution = {
    gridName: c.name, hazardNodeIds: c.hazard_nodes, normalizeWeights: c.normalize,
    annualFrequencyScale: { value: c.annual_scale, unit: "PER_YEAR", annualization: { basis: "PLANT_YEAR", hoursPerYear: 8766 } },
  };
  return r;
}

for (const c of fixture.cases) for (const eventTree of [false, true]) {
  test(`native point convolution: ${eventTree ? "ET" : "FT"}, ${c.name}`, () => {
    const validation = JSON.parse(addon.validate(JSON.stringify(request(c, eventTree))));
    assert.equal(validation.error, undefined, JSON.stringify(validation));
    const output = JSON.parse(addon.execute(JSON.stringify(request(c, eventTree))));
    assert.equal(output.error, undefined, JSON.stringify(output));
    const result = output.result;
    const convolution = result.hazardConvolution;
    let evaluated = 0;
    for (const [index, row] of convolution.rows.entries()) {
      const expected = c.weights[index];
      const skipped = expected.execution_status === "skipped_zero_weight";
      assert.equal(row.scenarioId, expected.scenario_id);
      assert.equal(row.status, skipped ? "skipped_zero_weight" : "ok");
      for (const [field, reference] of [["rawWeight", "hazard_weight_raw"], ["normalizedWeight", "hazard_weight_normalized"], ["annualFrequency", "hazard_weight_scaled"]]) {
        close(row[field], expected[reference]);
      }
      close(row.convolutionWeight, expected[c.normalize ? "hazard_weight_normalized" : "hazard_weight_raw"]);
      const batchRow = result.batchResults[index];
      if (skipped) {
        assert.deepEqual(batchRow, { scenarioId: row.scenarioId, status: "skipped_zero_weight" });
        if (eventTree) assert.deepEqual(row.sequences, []);
        else {
          assert.equal(row.conditionalProbability, null);
          assert.equal(row.annualContribution, 0);
          assert.equal(row.probabilityContribution, 0);
        }
      } else {
        evaluated++;
        assert.equal(batchRow.status, undefined);
        if (!eventTree) close(row.conditionalProbability, c.results[index].run_result.tables.top_events[0].probability);
      }
    }
    assert.equal(result.compilationReuse.scenarioEvaluations, evaluated);
    if (!eventTree) {
      const expected = c.aggregate.convolved_top_events[0];
      close(convolution.convolvedProbability, expected?.convolved_probability ?? 0);
      close(convolution.integratedAnnualFrequency, expected?.convolved_scaled_contribution ?? 0);
    } else {
      assert.equal(convolution.sequences.length, c.aggregate.convolved_sequences.length);
      for (const sequence of convolution.sequences) {
        const expected = c.aggregate.convolved_sequences.find((s) => s.sequence_id === sequence.sequenceId);
        close(sequence.convolvedProbability, expected.convolved_probability);
        close(sequence.integratedAnnualFrequency, expected.convolved_scaled_contribution);
      }
      assert.equal(convolution.endStateAggregates.length, c.aggregate.convolved_end_states.length);
      for (const end of convolution.endStateAggregates) {
        const expected = c.aggregate.convolved_end_states.find((s) => s.end_state_id === end.endStateId);
        close(end.convolvedProbability, expected.convolved_probability);
        close(end.integratedAnnualFrequency, expected.convolved_scaled_contribution);
      }
    }
  });
}

for (const eventTree of [false, true]) test(`reject inconsistent hazard/BDD evidence: ${eventTree ? "ET" : "FT"}`, () => {
  const r = request(fixture.cases[0], eventTree);
  r.request.evidenceBatch[0].observations[0].stateId = "True";
  const output = JSON.parse(addon.execute(JSON.stringify(r)));
  assert.match(output.error.message, /hazard assignment must match scenario evidence/);
});

test("annual unit conversion preserves unscaled probability", () => {
  const r = request(fixture.cases[0]);
  r.request.hazardConvolution.annualFrequencyScale = { value: 2, unit: "PER_HOUR", annualization: { basis: "PLANT_YEAR", hoursPerYear: 8760 } };
  const output = JSON.parse(addon.execute(JSON.stringify(r)));
  assert.equal(output.error, undefined);
  close(output.result.hazardConvolution.convolvedProbability, .05);
  close(output.result.hazardConvolution.integratedAnnualFrequency, .05 * 2 * 8760);
});

for (const eventTree of [false, true]) for (const sampler of ["MC", "LHS"]) {
  test(`blocks ${sampler} hazard uncertainty while retaining scenario UQ: ${eventTree ? "ET" : "FT"}`, () => {
    const r = request(fixture.cases[0], eventTree);
    r.modelSnapshots[0].baseEvidence.observations = [{nodeId: "N", stateId: "False"}];
    r.request.calculationType = "UNCERTAINTY";
    r.modelSnapshots[0].solverSettings.uncertainty = {
      sampler, sampleCount: 10, seed: 42,
      basicEventDistributions: [{faultTreeBasicEvent: {entityId: "E"}, distribution: {family: "UNIFORM", lower: .1, upper: .3}}],
      cptRowDistributions: [],
    };
    for (const operation of ["validate", "execute"]) {
      const output = JSON.parse(addon[operation](JSON.stringify(r)));
      assert.match(output.error.message, /Hazard convolution supports point runs only/);
      assert.equal(output.result, undefined);
    }
    delete r.request.hazardConvolution;
    const ordinary = JSON.parse(addon.execute(JSON.stringify(r)));
    assert.equal(ordinary.error, undefined, JSON.stringify(ordinary));
    const row = ordinary.result.batchResults[0];
    assert.equal(eventTree ? row.sequences[0].uncertainty.conditionalProbability.sampleCount : row.uncertainty.sampleCount, 10);
  });
}
