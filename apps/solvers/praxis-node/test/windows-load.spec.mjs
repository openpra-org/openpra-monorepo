import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const packageDirectory = dirname(dirname(fileURLToPath(import.meta.url)));
const bindingPath = join(packageDirectory, "praxis-node.win32-x64-msvc.node");

test("loads the Windows x64 MSVC binary directly", () => {
  assert.equal(process.platform, "win32");
  assert.equal(process.arch, "x64");
  assert.equal(existsSync(bindingPath), true);

  const addon = require(bindingPath);
  const requestJson = JSON.stringify({
    schemaVersion: "1.0.0",
    request: { methodType: "UNSUPPORTED_TEST_METHOD" },
    modelSnapshots: [{ methodType: "UNSUPPORTED_TEST_METHOD" }],
  });

  assert.deepEqual(Object.keys(addon).sort(), ["execute", "validate"]);
  assert.equal(JSON.parse(addon.validate(requestJson)).result.valid, true);
  assert.equal(JSON.parse(addon.execute(requestJson)).error.code, "PRAXIS_ILLEGAL_OPERATION");
});
