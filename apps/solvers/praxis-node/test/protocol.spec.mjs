import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
const { parseNativeResponse, nativeExecutionTimeout, nativeWorkerHeapLimit, checkCliqueMemory } = createRequire(import.meta.url)("../protocol.js");

test("enforces exact per-table limits without rounding large byte counts", () => {
  const report = bytes => ({ schemaVersion: "1.0.0", result: {
    scope: "CLIQUE_MEMORY_PREFLIGHT", largestTable: { bytes }
  }});
  assert.equal(checkCliqueMemory(report("1048576"), "1"), undefined);
  assert.equal(checkCliqueMemory(report("1048577"), "1").error.code, "PRAXIS_RESOURCE_LIMIT");
  for (const bytes of ["824633720832", "9007199254740993"]) {
    assert.equal(checkCliqueMemory(report(bytes), "1").error.details.requiredBytes, bytes);
  }
  for (const bytes of ["0", "-1", "1.5", "1e10", 1024, undefined])
    assert.throws(() => checkCliqueMemory(report(bytes), "1"));
  for (const limit of ["0", "-1", "1.5", "NaN", "Infinity", "2147000001", ""])
    assert.throws(() => checkCliqueMemory(report("8"), limit));
});

test("preserves preflight errors and accepts operations without Bayesian tables", () => {
  const failure = {schemaVersion:"1.0.0", error:{kind:"SOLVER_ERROR",code:"PRAXIS_HCL",message:"bad model",details:{}}};
  assert.equal(checkCliqueMemory(failure), failure);
  assert.equal(checkCliqueMemory({schemaVersion:"1.0.0",result:{scope:"CLIQUE_MEMORY_PREFLIGHT",largestTable:null}}), undefined);
  assert.throws(() => checkCliqueMemory({schemaVersion:"1.0.0",result:{}}));
});

test("accepts intact success and structured error envelopes", () => {
  for (const value of [
    { schemaVersion: "1.0.0", result: { probability: 0.123 } },
    {
      schemaVersion: "1.0.0",
      error: { kind: "SOLVER_ERROR", code: "PRAXIS_HCL", message: "bad evidence", details: { nodeId: "PUMP" } },
    },
  ]) {
    assert.equal(parseNativeResponse(value), value);
  }
});
test("rejects missing, ambiguous and malformed envelopes", () => {
  for (const value of [
    null,
    [],
    {},
    { schemaVersion: "2.0.0", result: {} },
    { schemaVersion: "1.0.0" },
    { schemaVersion: "1.0.0", result: [], error: {} },
    { schemaVersion: "1.0.0", result: null },
    { schemaVersion: "1.0.0", result: undefined },
    { schemaVersion: "1.0.0", result: {}, other: 1 },
    { schemaVersion: "1.0.0", error: { kind: "A", code: "B", message: " ", details: {} } },
    { schemaVersion: "1.0.0", error: { kind: "A", code: "B", message: "M", details: [] } },
    { schemaVersion: "1.0.0", error: { kind: "A", code: "B", message: "M", details: {}, extra: 1 } },
  ])
    assert.throws(() => parseNativeResponse(value));
});
test("rejects invalid execution budgets instead of disabling deadlines", () => {
  assert.equal(nativeExecutionTimeout("240000"), 240000);
  for (const value of ["0", "-1", "1.5", "NaN", "Infinity", "2147000001", ""])
    assert.throws(() => nativeExecutionTimeout(value));
});

test("validates explicit native worker heap budgets", () => {
  assert.equal(nativeWorkerHeapLimit("4096"), 4096);
  for (const value of ["0", "-1", "1.5", "NaN", "Infinity", "2147000001", ""])
    assert.throws(() => nativeWorkerHeapLimit(value));
});

test("preserves a native fingerprint and rejects fabricated or malformed identity fields", () => {
  const engine = { name: "PRAXIS", version: "sha256:" + "a".repeat(64) };
  const value = { schemaVersion: "1.0.0", result: { probability: 0.25 }, engine };
  assert.equal(parseNativeResponse(value).engine, engine);
  for (const wrong of [
    { ...engine, version: "1.0.0" },
    { ...engine, name: "OTHER" },
    { ...engine, extra: true },
    null,
  ]) {
    assert.throws(() => parseNativeResponse({ ...value, engine: wrong }));
  }
});
