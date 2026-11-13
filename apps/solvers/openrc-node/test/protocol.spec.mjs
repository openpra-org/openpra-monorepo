import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const {
  parseNativeResponse,
  nativeWorkerHeapLimit,
  NATIVE_DEADLINE_HEADER,
  SOLVER_PROTOCOL_VERSION,
} = require("../protocol.js");

test("loads the envelope validator without loading the native binary", () => {
  const loaded = Object.keys(require.cache).filter((file) => file.endsWith(".node"));
  assert.deepEqual(loaded, []);
  assert.equal(SOLVER_PROTOCOL_VERSION, "1.0.0");
  assert.deepEqual(Object.keys(require("../protocol.js")).sort(), [
    "NATIVE_DEADLINE_HEADER",
    "SOLVER_PROTOCOL_VERSION",
    "nativeWorkerHeapLimit",
    "parseNativeResponse",
  ]);
});

test("names the request deadline header in lower case", () => {
  assert.equal(NATIVE_DEADLINE_HEADER, "x-openrc-deadline");
  assert.equal(NATIVE_DEADLINE_HEADER, NATIVE_DEADLINE_HEADER.toLowerCase());
});

test("validates explicit native worker heap budgets", () => {
  assert.equal(nativeWorkerHeapLimit("4096"), 4096);
  assert.equal(nativeWorkerHeapLimit("1"), 1);
  assert.equal(nativeWorkerHeapLimit("2147000000"), 2147000000);
  for (const value of ["0", "-1", "1.5", "NaN", "Infinity", "2147000001", "", "many"]) {
    assert.throws(() => nativeWorkerHeapLimit(value), value);
  }
});

test("leaves the worker heap to Node when no budget is configured", () => {
  const previous = process.env.PRAETOR_NATIVE_HEAP_MB;
  delete process.env.PRAETOR_NATIVE_HEAP_MB;
  try {
    assert.equal(nativeWorkerHeapLimit(), undefined);
    process.env.PRAETOR_NATIVE_HEAP_MB = "512";
    assert.equal(nativeWorkerHeapLimit(), 512);
  } finally {
    if (previous === undefined) delete process.env.PRAETOR_NATIVE_HEAP_MB;
    else process.env.PRAETOR_NATIVE_HEAP_MB = previous;
  }
});

test("accepts intact success and structured error envelopes", () => {
  for (const value of [
    { schemaVersion: "1.0.0", result: { methodType: "RADIOLOGICAL_CONSEQUENCE", console: "", results: {} } },
    { schemaVersion: "1.0.0", result: {} },
    {
      schemaVersion: "1.0.0",
      error: { kind: "SOLVER_ERROR", code: "OPENRC_INVALID_VALUE", message: "bad value", details: {} },
    },
    {
      schemaVersion: "1.0.0",
      error: {
        kind: "VALIDATION_ERROR",
        code: "INVALID_REQUEST_JSON",
        message: "invalid solver JSON",
        details: { line: 1, column: 1 },
      },
    },
  ]) {
    assert.equal(parseNativeResponse(value), value);
  }
});

test("rejects missing, ambiguous and malformed envelopes", () => {
  for (const value of [
    undefined,
    null,
    [],
    "text",
    7,
    {},
    { schemaVersion: "2.0.0", result: {} },
    { schemaVersion: "1.0.0" },
    { schemaVersion: "1.0.0", result: {}, error: { kind: "A", code: "B", message: "M", details: {} } },
    { schemaVersion: "1.0.0", result: [], error: {} },
    { schemaVersion: "1.0.0", result: null },
    { schemaVersion: "1.0.0", result: undefined },
    { schemaVersion: "1.0.0", result: "text" },
    { schemaVersion: "1.0.0", result: [] },
    { schemaVersion: "1.0.0", result: {}, other: 1 },
    { schemaVersion: "1.0.0", error: null },
    { schemaVersion: "1.0.0", error: "text" },
    { schemaVersion: "1.0.0", error: { kind: "A", code: "B", message: " ", details: {} } },
    { schemaVersion: "1.0.0", error: { kind: "", code: "B", message: "M", details: {} } },
    { schemaVersion: "1.0.0", error: { kind: "A", code: 5, message: "M", details: {} } },
    { schemaVersion: "1.0.0", error: { kind: "A", code: "B", message: "M" } },
    { schemaVersion: "1.0.0", error: { kind: "A", code: "B", message: "M", details: [] } },
    { schemaVersion: "1.0.0", error: { kind: "A", code: "B", message: "M", details: null } },
    { schemaVersion: "1.0.0", error: { kind: "A", code: "B", message: "M", details: {}, extra: 1 } },
  ]) {
    assert.throws(() => parseNativeResponse(value), JSON.stringify(value));
  }
});

test("preserves a native fingerprint and rejects fabricated or malformed identity fields", () => {
  const engine = { name: "OPENRC", version: `sha256:${"a".repeat(64)}` };
  const value = { schemaVersion: "1.0.0", result: { results: {} }, engine };
  assert.equal(parseNativeResponse(value).engine, engine);
  const digits = "0123456789abcdef".repeat(4);
  assert.equal(
    parseNativeResponse({ ...value, engine: { name: "OPENRC", version: `sha256:${digits}` } }).engine.version,
    `sha256:${digits}`,
  );
  for (const wrong of [
    { ...engine, version: "1.0.0" },
    { ...engine, version: `sha256:${"a".repeat(63)}` },
    { ...engine, version: `sha256:${"a".repeat(65)}` },
    { ...engine, version: `sha256:${"A".repeat(64)}` },
    { ...engine, version: `sha256:${"g".repeat(64)}` },
    { ...engine, version: `sha512:${"a".repeat(64)}` },
    { ...engine, version: `${"a".repeat(64)}` },
    { ...engine, version: 5 },
    { ...engine, name: "PRAXIS" },
    { ...engine, name: "openrc" },
    { ...engine, extra: true },
    { name: "OPENRC" },
    null,
    [],
    "OPENRC",
  ]) {
    assert.throws(() => parseNativeResponse({ ...value, engine: wrong }), JSON.stringify(wrong));
  }
  const error = {
    schemaVersion: "1.0.0",
    error: { kind: "SOLVER_ERROR", code: "OPENRC_INVALID_VALUE", message: "bad value", details: {} },
    engine,
  };
  assert.equal(parseNativeResponse(error).engine, engine);
});

test("accepts every response the native addon returns", () => {
  const addon = require("..");
  const configText = "[run]\ncase_name = x\n";
  const requests = [
    "{",
    JSON.stringify({ schemaVersion: "2.0.0", request: {} }),
    JSON.stringify({ schemaVersion: "1.0.0", request: { methodType: "OTHER" } }),
    JSON.stringify({ schemaVersion: "1.0.0", request: { methodType: "RADIOLOGICAL_CONSEQUENCE" } }),
    JSON.stringify({ schemaVersion: "1.0.0", request: { methodType: "RADIOLOGICAL_CONSEQUENCE", configText } }),
    JSON.stringify({ schemaVersion: "1.0.0", request: { methodType: "RADIOLOGICAL_CONSEQUENCE", configText: "" } }),
  ];
  const codes = [];
  for (const requestJson of requests) {
    for (const operation of ["validate", "execute"]) {
      const output = parseNativeResponse(JSON.parse(addon[operation](requestJson)));
      codes.push(output.error.code);
    }
  }
  assert.deepEqual(codes, [
    "INVALID_REQUEST_JSON",
    "INVALID_REQUEST_JSON",
    "UNSUPPORTED_SCHEMA_VERSION",
    "UNSUPPORTED_SCHEMA_VERSION",
    "UNSUPPORTED_METHOD_TYPE",
    "UNSUPPORTED_METHOD_TYPE",
    "INVALID_REQUEST",
    "INVALID_REQUEST",
    "OPENRC_INVALID_VALUE",
    "OPENRC_INVALID_VALUE",
    "OPENRC_INVALID_VALUE",
    "OPENRC_INVALID_VALUE",
  ]);
});
