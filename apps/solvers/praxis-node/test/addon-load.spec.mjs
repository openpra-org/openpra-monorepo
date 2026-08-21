import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const packageDirectory = fileURLToPath(new URL("..", import.meta.url));

const validRequestJson = JSON.stringify({
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

test("loads the native addon with exactly validate and execute", () => {
  const addon = require("..");

  assert.deepEqual(Object.keys(addon).sort(), ["execute", "validate"]);
});

test("validates the transport envelope and returns structured failures", () => {
  const addon = require("..");

  assert.deepEqual(JSON.parse(addon.validate(validRequestJson)), {
    schemaVersion: "1.0.0",
    result: {
      scope: "TRANSPORT",
      valid: true,
      modelSnapshotCount: 1,
    },
  });

  const invalid = JSON.parse(addon.validate("{"));
  assert.equal(invalid.schemaVersion, "1.0.0");
  assert.equal(invalid.error.kind, "VALIDATION_ERROR");
  assert.equal(invalid.error.code, "INVALID_REQUEST_JSON");
});

test("returns a structured solver error for an unsupported method", () => {
  const addon = require("..");

  const unavailable = JSON.parse(addon.execute(validRequestJson));
  assert.equal(unavailable.schemaVersion, "1.0.0");
  assert.equal(unavailable.error.kind, "SOLVER_ERROR");
  assert.equal(unavailable.error.code, "PRAXIS_ILLEGAL_OPERATION");

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
  assert.equal(execution.result.minimalCutSetCount, 2);
  assert.deepEqual(
    execution.result.leadingCutSets.map((cutSet) => cutSet.probability),
    [0.2, 0.1],
  );
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

test("uses TensorBayes only through PRAXIS", () => {
  const metadata = JSON.parse(
    execFileSync("cargo", ["metadata", "--format-version", "1"], {
      cwd: packageDirectory,
      encoding: "utf8",
    }),
  );
  const addonPackage = metadata.packages.find((candidate) => candidate.name === "praxis-node");
  const praxisPackage = metadata.packages.find((candidate) => candidate.name === "praxis");
  const tensorBayesDependency = praxisPackage.dependencies.find((dependency) => dependency.name === "tensorbayes");

  assert.equal(
    addonPackage.dependencies.some((dependency) => dependency.name === "tensorbayes"),
    false,
  );
  assert.equal(path.resolve(tensorBayesDependency.path), path.resolve(packageDirectory, "../tensorbayes"));
});
