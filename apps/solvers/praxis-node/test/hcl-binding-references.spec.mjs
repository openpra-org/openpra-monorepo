import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { requestFor, eventTreeRequestFor } from "./hcl-source-helpers.mjs";
const addon = createRequire(import.meta.url)("..");
const fixture = JSON.parse(readFileSync(new URL("../../praxis/tests/fixtures/hcl_mh_cpt/reference.json", import.meta.url))).mixed[0];
const execute = (request) => JSON.parse(addon.execute(JSON.stringify(request)));
const config = (request) => request.modelSnapshots.find((s) => s.id === "HCL");
function makeRequest(kind, calculation, batch) {
  const request = kind === "ET" ? eventTreeRequestFor(fixture) : requestFor(fixture, true);
  request.request.calculationType = calculation;
  config(request).solverSettings.uncertainty.sampleCount = 11;
  if (batch) request.request.evidenceBatch = [{ scenarioId: "row", observations: [] }];
  return request;
}
function addOtherTree(request, event = "D") {
  const ft = structuredClone(request.modelSnapshots.find((s) => s.id === "FT"));
  ft.id = "OTHER"; ft.gates = [{ id: "TOP", gateType: "AND" }];
  ft.leafNodes = [{ id: "ref-other", kind: "BASIC_EVENT_REFERENCE", basicEventId: event }];
  ft.gateInputs = [{ id: "input-other", gateId: "TOP", childId: "ref-other", order: 0 }];
  request.modelSnapshots.push(ft);
  config(request).faultTrees.push({ faultTree: { modelId: "OTHER" } });
  const events = request.resources.faultTreeBasicEventCatalogue.basicEvents;
  if (!events.some((e) => e.id === event)) events.push({ id: event, probability: { value: 0.125 } });
  config(request).bindings.push({ id: "other-binding", faultTreeBasicEvent: { modelId: "OTHER", entityId: event }, bayesianNetworkNode: { modelId: "BN", entityId: "A" }, trueStateIds: ["True"] });
}
for (const kind of ["FT", "ET"]) for (const calculation of ["PROBABILITY", "UNCERTAINTY"]) for (const batch of [false, true]) {
  const title = `${kind} ${calculation} ${batch ? "batch" : "single"}`;
  for (const event of ["D", "A"]) test(`${title}: preserves valid bindings to another tree (${event})`, () => {
    const request = makeRequest(kind, calculation, batch); addOtherTree(request, event);
    const expectedRequest = structuredClone(request); config(expectedRequest).bindings.pop();
    const expected = execute(expectedRequest), actual = execute(request);
    assert.equal(expected.error, undefined, JSON.stringify(expected));
    for (const row of expected.result.batchResults ?? []) assert.notEqual(row.status, "FAILED");
    assert.deepEqual(actual, expected);
  });
  for (const variant of ["unknown-event", "other-tree-event", "undeclared-tree", "missing-tree", "unknown-unused-event", "missing-unused-catalogue-event", "ambiguous-unused-catalogue-event", "wrong-unused-BN"]) {
    test(`${title}: rejects ${variant} before filtering bindings`, () => {
      const request = makeRequest(kind, calculation, batch); addOtherTree(request);
      const hcl = config(request), binding = hcl.bindings[0], other = hcl.bindings.at(-1);
      if (variant === "unknown-event") binding.faultTreeBasicEvent.entityId = "missing";
      if (variant === "other-tree-event") binding.faultTreeBasicEvent.entityId = "D";
      if (variant === "undeclared-tree") binding.faultTreeBasicEvent.modelId = "missing";
      if (variant === "missing-tree") request.modelSnapshots = request.modelSnapshots.filter((s) => s.id !== "OTHER");
      if (variant === "unknown-unused-event") other.faultTreeBasicEvent.entityId = "missing";
      if (variant === "missing-unused-catalogue-event") request.resources.faultTreeBasicEventCatalogue.basicEvents = request.resources.faultTreeBasicEventCatalogue.basicEvents.filter((e) => e.id !== "D");
      if (variant === "ambiguous-unused-catalogue-event") request.resources.faultTreeBasicEventCatalogue.basicEvents.push({ id: "D", probability: { value: 0.125 } });
      if (variant === "wrong-unused-BN") other.bayesianNetworkNode.modelId = "missing";
      const before = structuredClone(request), result = execute(request);
      assert.ok(result.error, JSON.stringify(result)); assert.equal(result.result, undefined);
      assert.match(result.error.message, variant === "ambiguous-unused-catalogue-event" ? /binding|catalogue contains duplicate id 'D'/ : /binding|snapshot.*missing/);
      assert.deepEqual(request, before);
    });
  }
}
