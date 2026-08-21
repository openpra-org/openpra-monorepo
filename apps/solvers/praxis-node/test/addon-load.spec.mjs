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
    methodType: "HYBRID_CAUSAL_LOGIC",
  },
  modelSnapshots: [{ methodType: "HYBRID_CAUSAL_LOGIC" }],
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

test("returns a structured solver error until a method adapter is connected", () => {
  const addon = require("..");

  const unavailable = JSON.parse(addon.execute(validRequestJson));
  assert.equal(unavailable.schemaVersion, "1.0.0");
  assert.equal(unavailable.error.kind, "SOLVER_ERROR");
  assert.equal(unavailable.error.code, "PRAXIS_ILLEGAL_OPERATION");

  const invalid = JSON.parse(addon.execute("{"));
  assert.equal(invalid.error.kind, "VALIDATION_ERROR");
  assert.equal(invalid.error.code, "INVALID_REQUEST_JSON");
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
