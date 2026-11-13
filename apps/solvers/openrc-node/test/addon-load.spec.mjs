import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const packageDirectory = fileURLToPath(new URL("..", import.meta.url));
const manifest = JSON.parse(readFileSync(path.join(packageDirectory, "package.json"), "utf8"));

const unsupportedRequestJson = JSON.stringify({
  schemaVersion: "1.0.0",
  request: { schemaVersion: "1.0.0", methodType: "UNSUPPORTED_TEST_METHOD" },
});

const consequenceRequestJson = JSON.stringify({
  schemaVersion: "1.0.0",
  request: {
    methodType: "RADIOLOGICAL_CONSEQUENCE",
    configText: readFileSync(
      new URL("../../openrc/tests/data/python_reference/input/Example.txt", import.meta.url),
      "utf8",
    ),
  },
});

function cargoMetadata(...extra) {
  return JSON.parse(
    execFileSync("cargo", ["metadata", "--format-version", "1", "--offline", ...extra], {
      cwd: packageDirectory,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    }),
  );
}

test("loads the native addon with validate and execute", () => {
  const addon = require("..");

  assert.deepEqual(Object.keys(addon).sort(), ["execute", "validate"]);
  assert.equal(typeof addon.validate, "function");
  assert.equal(typeof addon.execute, "function");
});

test("loads exactly one native binary, the one built for this platform", () => {
  require("..");
  const binaries = Object.keys(require.cache).filter((file) => file.endsWith(".node"));
  assert.equal(binaries.length, 1);
  assert.equal(path.dirname(binaries[0]), path.resolve(packageDirectory));
  assert.ok(path.basename(binaries[0]).startsWith(`openrc-node.${process.platform}-${process.arch}`));
});

test("ships the loader, the declarations and the envelope validator named in the package", () => {
  assert.equal(manifest.name, "openrc-node");
  assert.equal(manifest.main, "index.js");
  assert.equal(manifest.types, "index.d.ts");
  assert.equal(manifest.napi.binaryName, "openrc-node");
  for (const file of ["index.js", "index.d.ts", "protocol.js", "protocol.d.ts", "THIRD_PARTY_NOTICES.txt"]) {
    assert.ok(manifest.files.includes(file), file);
    assert.ok(statSync(path.join(packageDirectory, file)).size > 0, file);
  }
  const declarations = readFileSync(path.join(packageDirectory, "index.d.ts"), "utf8");
  assert.ok(declarations.includes("export declare function validate(requestJson: string): string"));
  assert.ok(declarations.includes("export declare function execute(requestJson: string): string"));
  for (const script of manifest.scripts.test.split(" ").filter((word) => word.endsWith(".spec.mjs"))) {
    assert.ok(existsSync(path.join(packageDirectory, script)), script);
  }
});

test("pins every package version exactly", () => {
  for (const [name, version] of Object.entries(manifest.devDependencies)) {
    assert.ok(Array.from(version).every((character) => "0123456789.".includes(character)), `${name} ${version}`);
  }
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

test("runs a consequence case through the native Node-API boundary", () => {
  const addon = require("..");

  const validation = JSON.parse(addon.validate(consequenceRequestJson));
  assert.equal(validation.result.scope, "RADIOLOGICAL_CONSEQUENCE");
  assert.equal(validation.result.valid, true);
  assert.equal(validation.result.nuclideCount, 3);

  const execution = JSON.parse(addon.execute(consequenceRequestJson));
  assert.equal(execution.result.methodType, "RADIOLOGICAL_CONSEQUENCE");
  const expected = JSON.parse(
    readFileSync(
      new URL("../../openrc/tests/data/python_reference/expected/Example.json", import.meta.url),
      "utf8",
    ),
  );
  assert.deepEqual(Object.keys(execution.result.results), Object.keys(expected));
  assert.ok(Math.abs(execution.result.results.tede_sv - expected.tede_sv) <= 1e-10 * expected.tede_sv);
  assert.equal(execution.result.results.case_name, "test_case_001");
});

test("depends directly on the local OpenRC crate at the Node-API boundary", () => {
  const metadata = cargoMetadata("--no-deps");
  const addonPackage = metadata.packages.find((candidate) => candidate.name === "openrc-node");
  const engineDependency = addonPackage.dependencies.find((dependency) => dependency.name === "openrc");

  assert.equal(path.resolve(engineDependency.path), path.resolve(packageDirectory, "../openrc"));
  assert.equal(
    addonPackage.dependencies.some((dependency) => dependency.name === "napi"),
    true,
  );
  const library = addonPackage.targets.find((target) => target.kind.includes("cdylib"));
  assert.deepEqual(library.crate_types, ["cdylib"]);
});
