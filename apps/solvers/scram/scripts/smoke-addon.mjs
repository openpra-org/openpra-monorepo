import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const require = createRequire(import.meta.url);
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const addon = require(path.join(projectRoot, "build", "Release", "scram-node.node"));

assert.equal(typeof addon.QuantifyModel, "function");
assert.equal(typeof addon.BuildModelOnly, "function");

console.log("scram-node addon exports verified");
