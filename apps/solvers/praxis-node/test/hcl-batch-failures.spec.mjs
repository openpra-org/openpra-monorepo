import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { requestFor, eventTreeRequestFor } from "./hcl-source-helpers.mjs";
const addon = createRequire(import.meta.url)("..");
const fixture = JSON.parse(readFileSync(new URL("../../praxis/tests/fixtures/hcl_mh_cpt/reference.json", import.meta.url))).mixed[0];
const execute = (request) => JSON.parse(addon.execute(JSON.stringify(request)));

function requestForKind(kind, calculation) {
  const request = kind === "FT" ? requestFor(fixture, true) : eventTreeRequestFor(fixture);
  request.request.calculationType = calculation;
  const bn = request.modelSnapshots.find((s) => s.id === "BN");
  const table = bn.conditionalProbabilityTables.find((t) => t.nodeId === "A");
  for (const v of table.rows[0].values) v.probability = v.stateId === "False" ? 1 : 0;
  const settings = request.modelSnapshots.find((s) => s.id === "HCL").solverSettings;
  settings.uncertainty.sampleCount = 11;
  settings.uncertainty.cptRowDistributions = [];
  return request;
}
const row = (index, impossible) => ({scenarioId: `row-${index}`, observations: impossible ? [{nodeId:"A", stateId:"True"}] : []});
for (const kind of ["FT", "ET"]) for (const calculation of ["PROBABILITY", "UNCERTAINTY"]) {
  for (const failures of [[false,true,false],[true,false,true],[true,true],[true],[false,false]]) {
    test(`${kind} ${calculation}: preserves outcomes ${failures.map(Boolean)}`, () => {
      const request = requestForKind(kind, calculation);
      const rows = failures.map((bad, i) => row(i, bad));
      const expected = rows.map((r) => {
        const single = structuredClone(request);
        single.modelSnapshots.find((s) => s.id === "HCL").baseEvidence.observations = r.observations;
        return execute(single);
      });
      request.request.evidenceBatch = rows;
      const before = structuredClone(request), actual = execute(request);
      assert.equal(actual.error, undefined, JSON.stringify(actual));
      assert.equal(actual.result.batchResults.length, rows.length);
      for (const [i, result] of actual.result.batchResults.entries()) {
        assert.equal(result.scenarioId, rows[i].scenarioId);
        if (failures[i]) {
          assert.deepEqual(Object.keys(result).sort(), ["failure","scenarioId","status"]);
          assert.equal(result.status, "FAILED");
          assert.deepEqual(result.failure, expected[i].error);
        } else {
          assert.equal(expected[i].error, undefined);
          const {scenarioId, ...value} = result;
          assert.deepEqual(value, expected[i].result);
        }
      }
      if (failures.some(Boolean)) assert.equal(actual.result.compilationReuse, undefined);
      else assert.equal(actual.result.compilationReuse.junctionTreeCompilations, 1);
      assert.deepEqual(request, before);
    });
  }
  test(`${kind} ${calculation}: rejects duplicate scenario identities before retry`, () => {
    const request=requestForKind(kind,calculation);request.request.evidenceBatch=[row(0,false),row(0,true)];
    assert.match(execute(request).error.message,/duplicate scenario id/);
  });
}
