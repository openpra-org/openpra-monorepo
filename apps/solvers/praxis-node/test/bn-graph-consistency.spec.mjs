import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { requestFor, eventTreeRequestFor } from "./hcl-source-helpers.mjs";
const addon = createRequire(import.meta.url)("..");
const fixture = JSON.parse(readFileSync(new URL("../../praxis/tests/fixtures/hcl_mh_cpt/reference.json", import.meta.url))).mixed[0];
const execute = (request) => JSON.parse(addon.execute(JSON.stringify(request)));

function makeRequest(kind, calculation, batch) {
  const request = kind === "ET" ? eventTreeRequestFor(fixture) : requestFor(fixture, true);
  request.request.calculationType = calculation;
  request.modelSnapshots.find((s) => s.id === "HCL").solverSettings.uncertainty.sampleCount = 11;
  if (kind === "BN") {
    request.request = { schemaVersion: "1.0.0", methodType: "BAYESIAN_NETWORK", modelId: "BN", revision: 1, requestedBy: "graph-test", query: { queryNodeIds: ["A", "B"], evidence: { observations: [] } } };
    if (batch) {
      delete request.request.query.evidence;
      request.request.query.scenarios = [{ id: "row", code: "ROW", name: "Row", evidence: { observations: [] } }];
    }
  } else if (batch) request.request.evidenceBatch = [{ scenarioId: "row", observations: [] }];
  return request;
}

const modes = [["BN", "PROBABILITY"], ...["FT", "ET"].flatMap((kind) => ["PROBABILITY", "UNCERTAINTY"].map((calculation) => [kind, calculation]))];
for (const [kind, calculation] of modes) for (const batch of [false, true]) {
  const title = `${kind} ${calculation} ${batch ? "batch" : "single"}`;
  test(`${title}: matching edges preserve the CPT-only source result`, () => {
    const request = makeRequest(kind, calculation, batch);
    const expected = execute(request);
    assert.equal(expected.error, undefined, JSON.stringify(expected));
    for (const row of expected.result.batchResults ?? expected.result.scenarios ?? []) assert.notEqual(row.status, "FAILED");
    const bn = request.modelSnapshots.find((s) => s.id === "BN");
    bn.edges = bn.conditionalProbabilityTables.flatMap((t) => t.parents.map((p) => ({ parentNodeId: p.nodeId, childNodeId: t.nodeId })));
    bn.edges.reverse();
    const before = structuredClone(request);
    assert.deepEqual(execute(request), expected);
    assert.deepEqual(request, before);
  });
  for (const variant of ["missing", "extra", "reversed", "duplicate", "dangling-parent", "dangling-child", "self-cycle", "edge-cycle", "null", "object", "parent-cycle"]) {
    test(`${title}: rejects ${variant}`, () => {
      const request = makeRequest(kind, calculation, batch), bn = request.modelSnapshots.find((s) => s.id === "BN");
      bn.edges = [{ parentNodeId: "A", childNodeId: "B" }];
      if (variant === "missing") bn.edges = [];
      if (variant === "extra") {
        const b = bn.conditionalProbabilityTables.find((t) => t.nodeId === "B");
        b.parents = []; b.rows = [{ ...b.rows[0], parentStates: [] }];
      }
      if (variant === "reversed") bn.edges = [{ parentNodeId: "B", childNodeId: "A" }];
      if (variant === "duplicate") bn.edges.push({ ...bn.edges[0] });
      if (variant === "dangling-parent") bn.edges[0].parentNodeId = "missing";
      if (variant === "dangling-child") bn.edges[0].childNodeId = "missing";
      if (variant === "self-cycle") bn.edges.push({ parentNodeId: "A", childNodeId: "A" });
      if (variant === "edge-cycle" || variant === "parent-cycle") bn.edges.push({ parentNodeId: "B", childNodeId: "A" });
      if (variant === "null") bn.edges = null;
      if (variant === "object") bn.edges = {};
      if (variant === "parent-cycle") {
        const a = bn.conditionalProbabilityTables.find((t) => t.nodeId === "A");
        a.parents = [{ nodeId: "B", order: 0 }];
        a.rows = ["False", "True"].map((stateId) => ({ ...structuredClone(a.rows[0]), id: `cycle-${stateId}`, parentStates: [{ parentNodeId: "B", stateId }] }));
      }
      const response = execute(request);
      assert.equal(response.result, undefined, JSON.stringify(response));
      assert.ok(response.error, JSON.stringify(response));
      assert.match(response.error.message, variant === "parent-cycle" ? /cycl|DAG/i : variant === "null" || variant === "object" ? /invalid Bayesian-network model snapshot/ : /edge/);
    });
  }
}
