import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { requestFor, eventTreeRequestFor } from "./hcl-source-helpers.mjs";
const addon = createRequire(import.meta.url)("..");
const fixture = JSON.parse(readFileSync(new URL("../../praxis/tests/fixtures/hcl_mh_cpt/reference.json", import.meta.url))).mixed[0];
const execute = (request) => JSON.parse(addon.execute(JSON.stringify(request)));
const requestForKind = (kind) => {
  const request = kind === "FT" ? requestFor(fixture, true) : eventTreeRequestFor(fixture, false);
  request.modelSnapshots.find((s) => s.id === "HCL").solverSettings.uncertainty.sampleCount = 10;
  return request;
};
const uq = (kind, result) => kind === "FT" ? result.uncertainty : result.sequences[0].uncertainty?.conditionalProbability;
const rows = ["False", "True"].map((stateId, index) => ({
  scenarioId: `scenario-${index}`, observations: [{ nodeId: "A", stateId }],
}));

for (const kind of ["FT", "ET"]) {
  for (const batch of [false, true]) test(`${kind} ${batch ? "batch" : "single"} executes only the requested calculation`, () => {
    const request = requestForKind(kind);
    if (batch) request.request.evidenceBatch = rows;
    const saved = structuredClone(request.modelSnapshots);
    let point;
    for (const calculationType of [undefined, "PROBABILITY", "UNCERTAINTY"]) {
      if (calculationType === undefined) delete request.request.calculationType;
      else request.request.calculationType = calculationType;
      const output = execute(request);
      assert.equal(output.error, undefined, JSON.stringify(output));
      const results = batch ? output.result.batchResults : [output.result];
      for (const result of results) {
        if (calculationType === "UNCERTAINTY") assert.equal(uq(kind, result).sampleCount, 10);
        else assert.equal(uq(kind, result), undefined);
      }
      const probabilities = results.map((result) => kind === "FT" ? result.probability : result.sequences.map((s) => s.conditionalProbability));
      if (point === undefined) point = probabilities;
      else assert.deepEqual(probabilities, point);
      assert.deepEqual(request.modelSnapshots, saved);
    }
  });

  test(`${kind} skips unused invalid settings and requires settings for uncertainty`, () => {
    const request = requestForKind(kind);
    const settings = request.modelSnapshots.find((s) => s.id === "HCL").solverSettings;
    settings.uncertainty = { legacyUnsupportedSettings: true };
    request.request.calculationType = "PROBABILITY";
    assert.equal(execute(request).error, undefined);
    request.request.calculationType = "UNCERTAINTY";
    assert.match(execute(request).error.message, /invalid uncertainty settings/);
    delete settings.uncertainty;
    assert.match(execute(request).error.message, /requires saved uncertainty settings/);
    request.request.calculationType = "CUT_SETS";
    assert.ok(execute(request).error);
  });

  test(`${kind} point hazard ignores saved UQ while uncertainty hazard remains disabled`, () => {
    const request = requestForKind(kind);
    request.request.evidenceBatch = rows.map((row) => ({ ...row, hazardObservations: row.observations }));
    request.request.hazardConvolution = { gridName: "Earthquake", hazardNodeIds: ["A"], normalizeWeights: false,
      annualFrequencyScale: { value: 1, unit: "PER_YEAR", annualization: { basis: "PLANT_YEAR", hoursPerYear: 8760 } } };
    request.request.calculationType = "PROBABILITY";
    const output = execute(request);
    assert.equal(output.error, undefined, JSON.stringify(output));
    const totals = kind === "FT" ? [output.result.hazardConvolution] : output.result.hazardConvolution.sequences;
    assert.ok(totals.length > 0 && totals.every((total) => Number.isFinite(total.convolvedProbability)));
    for (const row of output.result.batchResults) assert.equal(uq(kind, row), undefined);
    request.request.calculationType = "UNCERTAINTY";
    assert.match(execute(request).error.message, /point runs only/);
    assert.ok(request.modelSnapshots.find((s) => s.id === "HCL").solverSettings.uncertainty);
  });
}
