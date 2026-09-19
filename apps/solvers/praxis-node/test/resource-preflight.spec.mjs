import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { requestFor, eventTreeRequestFor } from "./hcl-source-helpers.mjs";
const addon = createRequire(import.meta.url)("..");
const fixture = JSON.parse(readFileSync(new URL("../../praxis/tests/fixtures/hcl_mh_cpt/reference.json", import.meta.url))).mixed[0];
const preflight = (request, operation="execute") => JSON.parse(addon.preflight(JSON.stringify(request), operation));

for (const [kind, make] of [["FT", () => requestFor(fixture, true)], ["ET", () => eventTreeRequestFor(fixture)]]) {
  test(`${kind}: nominal and uncertainty table geometry follows sample slices`, () => {
    const request = make();
    const settings = request.modelSnapshots.find(s => s.id === "HCL").solverSettings;
    request.request.calculationType = "PROBABILITY";
    const nominal = preflight(request).result.largestTable;
    assert.equal(nominal.batchSize, 1);
    assert.equal(BigInt(nominal.bytes), BigInt(nominal.scalarEntries) * 8n);
    request.request.calculationType = "UNCERTAINTY";
    for (const count of [10,255,256,257]) {
      settings.uncertainty.sampleCount = count;
      const table = preflight(request).result.largestTable;
      assert.equal(table.batchSize, Math.min(count,256));
      assert.equal(BigInt(table.bytes), BigInt(nominal.bytes) * BigInt(Math.min(count,256)));
      assert.equal(preflight(request,"validate").result.largestTable.bytes, nominal.bytes);
    }
  });
}

test("BN query batching scales table memory; structural validation allocates no table", () => {
  const request = requestFor(fixture, true);
  request.request = {schemaVersion:"1.0.0",methodType:"BAYESIAN_NETWORK",modelId:"BN",revision:1,requestedBy:"test",
    query:{evidence:{observations:[]},queryNodeIds:["A"]}};
  const bn = request.modelSnapshots.find(s => s.id === "BN");
  request.request.revision = bn.revision;
  const scalar = preflight(request).result.largestTable;
  request.request.query = {queryNodeIds:["A"],scenarios:[0,1,2].map(i=>({id:`s${i}`,code:`s${i}`,name:`s${i}`,evidence:{observations:[]}}))};
  const batch = preflight(request).result.largestTable;
  assert.equal(BigInt(batch.bytes), BigInt(scalar.bytes)*3n);
  assert.equal(batch.batchSize,3);
  assert.equal(preflight(request,"validate").result.largestTable,null);
});

test("transport errors remain structured and unsupported preflight operations fail", () => {
  assert.equal(JSON.parse(addon.preflight("{}","execute")).error.code,"INVALID_REQUEST_JSON");
  const request = requestFor(fixture, true);
  assert.throws(() => addon.preflight(JSON.stringify(request), "unknown"));
  request.request.calculationType="UNCERTAINTY";
  request.modelSnapshots.find(s=>s.id==="HCL").solverSettings.uncertainty.sampleCount=0;
  assert.ok(preflight(request).error);
});
