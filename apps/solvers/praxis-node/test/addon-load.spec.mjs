import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const packageDirectory = fileURLToPath(new URL("..", import.meta.url));

const unsupportedRequestJson = JSON.stringify({
  schemaVersion: "1.0.0",
  request: {
    schemaVersion: "1.0.0",
    methodType: "UNSUPPORTED_TEST_METHOD",
  },
  modelSnapshots: [{ methodType: "UNSUPPORTED_TEST_METHOD" }],
});

const faultTreeRequestJson = JSON.stringify({
  schemaVersion: "1.0.0",
  request: {
    schemaVersion: "1.0.0",
    methodType: "FAULT_TREE",
    modelId: "00000000-0000-4000-8000-000000000002",
    revision: 3,
    requestedBy: "analyst",
  },
  modelSnapshots: [
    {
      id: "00000000-0000-4000-8000-000000000002",
      projectId: "project-1",
      methodType: "FAULT_TREE",
      revision: 3,
      topGate: { gateId: "00000000-0000-4000-8000-000000000001" },
      gates: [
        {
          id: "00000000-0000-4000-8000-000000000001",
          kind: "GATE",
          gateType: "OR",
          code: "TOP",
          name: "Top",
          description: "",
        },
      ],
      leafNodes: [
        { id: "ref-a", kind: "BASIC_EVENT_REFERENCE", basicEventId: "A" },
        { id: "ref-b", kind: "BASIC_EVENT_REFERENCE", basicEventId: "B" },
      ],
      gateInputs: [
        { id: "input-a", gateId: "00000000-0000-4000-8000-000000000001", childId: "ref-a", order: 0 },
        { id: "input-b", gateId: "00000000-0000-4000-8000-000000000001", childId: "ref-b", order: 1 },
      ],
    },
  ],
  resources: {
    faultTreeBasicEventCatalogue: {
      projectId: "project-1",
      basicEvents: [
        { id: "A", probability: { value: 0.1 } },
        { id: "B", probability: { value: 0.2 } },
      ],
    },
  },
});

const bayesianNetworkRequestJson = JSON.stringify({
  schemaVersion: "1.0.0",
  request: {
    schemaVersion: "1.0.0",
    methodType: "BAYESIAN_NETWORK",
    modelId: "BN",
    revision: 2,
    requestedBy: "analyst",
    query: {
      evidence: { observations: [{ nodeId: "B", stateId: "B-true" }] },
      queryNodeIds: ["A"],
    },
  },
  modelSnapshots: [
    {
      id: "BN",
      methodType: "BAYESIAN_NETWORK",
      revision: 2,
      nodes: [
        { id: "A", states: [{ id: "A-false" }, { id: "A-true" }] },
        { id: "B", states: [{ id: "B-false" }, { id: "B-true" }] },
      ],
      conditionalProbabilityTables: [
        {
          nodeId: "A",
          parents: [],
          rows: [
            {
              id: "A-row",
              parentStates: [],
              values: [
                { stateId: "A-false", probability: 0.6 },
                { stateId: "A-true", probability: 0.4 },
              ],
            },
          ],
        },
        {
          nodeId: "B",
          parents: [{ nodeId: "A", order: 0 }],
          rows: [
            {
              id: "B-row-false",
              parentStates: [{ parentNodeId: "A", stateId: "A-false" }],
              values: [
                { stateId: "B-false", probability: 0.7 },
                { stateId: "B-true", probability: 0.3 },
              ],
            },
            {
              id: "B-row-true",
              parentStates: [{ parentNodeId: "A", stateId: "A-true" }],
              values: [
                { stateId: "B-false", probability: 0.2 },
                { stateId: "B-true", probability: 0.8 },
              ],
            },
          ],
        },
      ],
    },
  ],
});

test("converts failure rates before native FT execution using HCL_MH source values", () => {
  const addon = require("..");
  const reference = JSON.parse(readFileSync(new URL(
    "../../praxis/tests/fixtures/hcl_mh_failure_rate/reference.json", import.meta.url,
  ), "utf8"));
  for (const c of reference.cases) {
    const request = JSON.parse(faultTreeRequestJson);
    const events = request.resources.faultTreeBasicEventCatalogue.basicEvents;
    events[0].probability = {
      value: 0.75, // Deliberately stale; native execution must resolve the rate.
      quantificationBasis: {
        kind: "FAILURE_RATE",
        failureRate: { value: c.rate, unit: "HOUR" },
        missionTime: { value: c.time, unit: "HOUR" },
        conversion: "EXPONENTIAL",
      },
    };
    events[1].probability.value = 0;
    const output = JSON.parse(addon.execute(JSON.stringify(request)));
    assert.equal(output.error, undefined, c.name);
    const trace = output.result.basicEventQuantifications.find((e) => e.basicEventId === "A");
    assert.equal(trace.resolvedProbability, Number(c.probability), c.name);
    assert.equal(output.result.topEventProbability, Number(c.probability), c.name);
  }
});

test("uses 8760-hour years in native FT rate and mission-time conversion", () => {
  const addon = require("..");
  for (const [rate, rateUnit, time, timeUnit, exposure] of [
    [0.2, "YEAR", 365, "DAY", 0.2],
    [0.001, "HOUR", 1, "YEAR", 8.76],
  ]) {
    const request = JSON.parse(faultTreeRequestJson);
    const events = request.resources.faultTreeBasicEventCatalogue.basicEvents;
    events[0].probability.quantificationBasis = {
      kind: "FAILURE_RATE", conversion: "EXPONENTIAL",
      failureRate: { value: rate, unit: rateUnit },
      missionTime: { value: time, unit: timeUnit },
    };
    events[1].probability.value = 0;
    const output = JSON.parse(addon.execute(JSON.stringify(request)));
    assert.equal(output.error, undefined, JSON.stringify(output));
    assert.equal(output.result.topEventProbability, 1 - Math.exp(-exposure));
  }
});

test("rejects removed FT conversions at native validation and execution", () => {
  const addon = require("..");
  for (const conversion of ["LINEAR", "UNKNOWN"]) {
    const request = JSON.parse(faultTreeRequestJson);
    request.resources.faultTreeBasicEventCatalogue.basicEvents[0].probability.quantificationBasis = {
      kind: "FAILURE_RATE", conversion,
      failureRate: { value: .001, unit: "HOUR" }, missionTime: { value: 100, unit: "HOUR" },
    };
    for (const operation of ["validate", "execute"]) {
      const output = JSON.parse(addon[operation](JSON.stringify(request)));
      assert.match(output.error.message, /review the rate and mission time/);
      assert.equal(output.result, undefined);
    }
  }
});

test("loads the native addon with validate, execute and resource preflight", () => {
  const addon = require("..");

  assert.deepEqual(Object.keys(addon).sort(), ["execute", "preflight", "validate"]);
});

test("validates the transport envelope and returns structured failures", () => {
  const addon = require("..");

  assert.equal(JSON.parse(addon.validate(unsupportedRequestJson)).error.code, "UNSUPPORTED_METHOD_TYPE");

  const invalid = JSON.parse(addon.validate("{"));
  assert.equal(invalid.schemaVersion, "1.0.0");
  assert.equal(invalid.error.kind, "VALIDATION_ERROR");
  assert.equal(invalid.error.code, "INVALID_REQUEST_JSON");
});

test("returns a structured validation error for an unsupported method", () => {
  const addon = require("..");

  const unavailable = JSON.parse(addon.execute(unsupportedRequestJson));
  assert.equal(unavailable.schemaVersion, "1.0.0");
  assert.equal(unavailable.error.kind, "VALIDATION_ERROR");
  assert.equal(unavailable.error.code, "UNSUPPORTED_METHOD_TYPE");

  const invalid = JSON.parse(addon.execute("{"));
  assert.equal(invalid.error.kind, "VALIDATION_ERROR");
  assert.equal(invalid.error.code, "INVALID_REQUEST_JSON");
});

test("quantifies a fault tree through the native Node-API boundary", () => {
  const addon = require("..");

  const validation = JSON.parse(addon.validate(faultTreeRequestJson));
  assert.equal(validation.result.scope, "FAULT_TREE");
  assert.equal(validation.result.valid, true);
  assert.equal(validation.result.basicEventCount, 2);

  const execution = JSON.parse(addon.execute(faultTreeRequestJson));
  assert.equal(execution.result.methodType, "FAULT_TREE");
  assert.ok(Math.abs(execution.result.topEventProbability - 0.28) < 1e-12);
  assert.equal(execution.result.minimalCutSetCount, undefined);
  assert.equal(execution.result.leadingCutSets, undefined);
});

test("returns exact NOT probability without cut-set results", () => {
  const addon = require("..");
  const request = JSON.parse(faultTreeRequestJson);
  const snapshot = request.modelSnapshots[0];
  snapshot.gates[0].gateType = "NOT";
  snapshot.gateInputs = snapshot.gateInputs.slice(0, 1);
  const execution = JSON.parse(addon.execute(JSON.stringify(request)));
  assert.ok(Math.abs(execution.result.topEventProbability - 0.9) < 1e-12);
  assert.equal(execution.result.minimalCutSetCount, undefined);
  assert.equal(execution.result.leadingCutSets, undefined);
  assert.deepEqual(execution.result.validationIssues, []);
});

test("queries a Bayesian network through PRAXIS and TensorBayes", () => {
  const addon = require("..");

  const validation = JSON.parse(addon.validate(bayesianNetworkRequestJson));
  assert.equal(validation.result.scope, "BAYESIAN_NETWORK");
  assert.equal(validation.result.valid, true);
  assert.equal(validation.result.nodeCount, 2);

  const execution = JSON.parse(addon.execute(bayesianNetworkRequestJson));
  assert.equal(execution.result.methodType, "BAYESIAN_NETWORK");
  assert.deepEqual(
    execution.result.marginals[0].values.map((value) => value.stateId),
    ["A-false", "A-true"],
  );
  assert.ok(Math.abs(execution.result.marginals[0].values[0].probability - 0.36) < 1e-12);
  assert.ok(Math.abs(execution.result.marginals[0].values[1].probability - 0.64) < 1e-12);
});

test("depends directly on the local PRAXIS crate at the Node-API boundary", () => {
  const metadata = JSON.parse(
    execFileSync("cargo", ["metadata", "--format-version", "1", "--no-deps"], {
      cwd: packageDirectory,
      encoding: "utf8",
    }),
  );
  const addonPackage = metadata.packages.find((candidate) => candidate.name === "praxis-node");
  const praxisDependency = addonPackage.dependencies.find((dependency) => dependency.name === "praxis");

  assert.equal(path.resolve(praxisDependency.path), path.resolve(packageDirectory, "../praxis"));
  assert.equal(
    addonPackage.dependencies.some((dependency) => dependency.name === "napi"),
    true,
  );
});

test("resource preflight shares PRAXIS's original TensorBayes dependency", () => {
  const metadata = JSON.parse(
    execFileSync("cargo", ["metadata", "--format-version", "1"], {
      cwd: packageDirectory,
      encoding: "utf8",
    }),
  );
  const addonPackage = metadata.packages.find((candidate) => candidate.name === "praxis-node");
  const praxisPackage = metadata.packages.find((candidate) => candidate.name === "praxis");
  const tensorBayesDependency = praxisPackage.dependencies.find((dependency) => dependency.name === "tensorbayes");

  const preflightDependency = addonPackage.dependencies.find((dependency) => dependency.name === "tensorbayes");
  assert.equal(path.resolve(preflightDependency.path), path.resolve(tensorBayesDependency.path));
  assert.equal(path.resolve(tensorBayesDependency.path), path.resolve(packageDirectory, "../tensorbayes"));
});


test("quantifies a single-state parent using main TensorBayes", () => {
  const addon = require("..");
  const request = JSON.parse(bayesianNetworkRequestJson);
  const snapshot = request.modelSnapshots[0];
  snapshot.nodes[0].states = [{ id: "A-false" }];
  snapshot.conditionalProbabilityTables[0].rows[0].values = [{ stateId: "A-false", probability: 1 }];
  snapshot.conditionalProbabilityTables[1].rows.length = 1;
  request.request.query = { queryNodeIds: ["A", "B"], evidence: { observations: [] } };
  const execution = JSON.parse(addon.execute(JSON.stringify(request)));
  assert.equal(execution.result.methodType, "BAYESIAN_NETWORK");
  assert.deepEqual(execution.result.marginals[0].values, [{ stateId: "A-false", probability: 1 }]);
  assert.ok(Math.abs(execution.result.marginals[1].values[1].probability - 0.3) < 1e-12);
  request.request.query.evidence.observations = [{ nodeId: "B", stateId: "B-true" }];
  const posterior = JSON.parse(addon.execute(JSON.stringify(request)));
  assert.equal(posterior.result.methodType, "BAYESIAN_NETWORK");
  assert.deepEqual(posterior.result.marginals[0].values, [{ stateId: "A-false", probability: 1 }]);
});


test("rejects missing, malformed and unsupported methods in both operations", () => {
  const addon = require("..");
  for (const methodType of [undefined, null, 1, {}, "", "UNKNOWN"]) {
    for (const operation of ["validate", "execute"]) {
      const output = JSON.parse(addon[operation](JSON.stringify({schemaVersion:"1.0.0",request:{methodType},modelSnapshots:[]})));
      assert.equal(output.error.kind, "VALIDATION_ERROR");
      assert.equal(output.error.code, "UNSUPPORTED_METHOD_TYPE");
      assert.equal(output.result, undefined);
    }
  }
});
