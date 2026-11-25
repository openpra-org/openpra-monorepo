import assert from "node:assert/strict";
import test from "node:test";

import {
  METHOD_TYPE,
  addon,
  call,
  consequenceRequest,
  exampleConfig,
  parseNativeResponse,
} from "./reference-helpers.mjs";

const operations = ["validate", "execute"];
const example = exampleConfig();

function assertValidationError(output, code, context) {
  parseNativeResponse(output);
  assert.deepEqual(Object.keys(output), ["schemaVersion", "error"], context);
  assert.equal(output.schemaVersion, "1.0.0", context);
  assert.equal(output.error.kind, "VALIDATION_ERROR", context);
  assert.equal(output.error.code, code, `${context}: ${output.error.message}`);
  assert.deepEqual(Object.keys(output.error), ["kind", "code", "message", "details"], context);
}

test("answers text that is not JSON with a structured failure", () => {
  for (const text of ["", " ", "{", "nonsense", "{\"schemaVersion\":\"1.0.0\",\"request\":{}} extra"]) {
    for (const operation of operations) {
      const output = JSON.parse(addon[operation](text));
      assertValidationError(output, "INVALID_REQUEST_JSON", `${operation} ${JSON.stringify(text)}`);
      assert.deepEqual(Object.keys(output.error.details), ["column", "line"]);
      assert.equal(output.error.details.line, 1);
      assert.ok(output.error.message.startsWith("invalid solver JSON: "));
    }
  }
});

test("reports where the request JSON breaks", () => {
  const output = JSON.parse(addon.execute('{\n  "schemaVersion": "1.0.0",\n  "request": }'));
  assertValidationError(output, "INVALID_REQUEST_JSON", "broken request");
  assert.deepEqual(output.error.details, { column: 14, line: 3 });
});

test("rejects envelopes with missing, mistyped or extra fields", () => {
  const envelopes = [
    null,
    [],
    "text",
    7,
    {},
    { schemaVersion: "1.0.0" },
    { request: { methodType: METHOD_TYPE, configText: example } },
    { schemaVersion: 1, request: {} },
    { schemaVersion: "1.0.0", request: {}, modelSnapshots: [] },
    { schemaVersion: "1.0.0", request: {}, resources: {} },
    { ...consequenceRequest(example), engine: { name: "OPENRC" } },
  ];
  for (const envelope of envelopes) {
    for (const operation of operations) {
      const output = call(operation, envelope);
      assertValidationError(output, "INVALID_REQUEST_JSON", `${operation} ${JSON.stringify(envelope)}`);
    }
  }
});

test("rejects every schema version but the current one", () => {
  for (const schemaVersion of ["", "1", "1.0", "1.0.1", "2.0.0", "v1.0.0", " 1.0.0"]) {
    for (const operation of operations) {
      const output = call(operation, { ...consequenceRequest(example), schemaVersion });
      assertValidationError(output, "UNSUPPORTED_SCHEMA_VERSION", `${operation} ${schemaVersion}`);
      assert.deepEqual(output.error.details, {
        expectedSchemaVersion: "1.0.0",
        receivedSchemaVersion: schemaVersion,
      });
      assert.equal(
        output.error.message,
        `unsupported solver schema version '${schemaVersion}'; expected '1.0.0'`,
      );
    }
  }
});

test("rejects missing, malformed and unsupported methods in both operations", () => {
  for (const methodType of [undefined, null, 1, {}, [], "", "UNKNOWN", "FAULT_TREE", "radiological_consequence"]) {
    for (const operation of operations) {
      const output = call(operation, { schemaVersion: "1.0.0", request: { methodType, configText: example } });
      assertValidationError(output, "UNSUPPORTED_METHOD_TYPE", `${operation} ${JSON.stringify(methodType)}`);
      assert.deepEqual(output.error.details, {
        receivedMethodType: methodType === undefined ? null : methodType,
      });
      assert.equal(output.result, undefined);
    }
  }
  for (const request of [null, [], "text", 7, {}]) {
    for (const operation of operations) {
      const output = call(operation, { schemaVersion: "1.0.0", request });
      assertValidationError(output, "UNSUPPORTED_METHOD_TYPE", `${operation} ${JSON.stringify(request)}`);
      assert.deepEqual(output.error.details, { receivedMethodType: null });
    }
  }
});

test("checks the version first, then the method, then the request fields", () => {
  const output = call("execute", { schemaVersion: "0.9.0", request: { methodType: "OTHER", extra: 1 } });
  assert.equal(output.error.code, "UNSUPPORTED_SCHEMA_VERSION");
  const method = call("execute", { schemaVersion: "1.0.0", request: { methodType: "OTHER", extra: 1 } });
  assert.equal(method.error.code, "UNSUPPORTED_METHOD_TYPE");
  const fields = call("execute", { schemaVersion: "1.0.0", request: { methodType: METHOD_TYPE, extra: 1 } });
  assert.equal(fields.error.code, "INVALID_REQUEST");
});

test("rejects requests with missing, mistyped or unknown fields", () => {
  const requests = [
    [{ methodType: METHOD_TYPE }, "missing field `configText`"],
    [{ methodType: METHOD_TYPE, configText: 5 }, "invalid type: integer `5`, expected a string"],
    [{ methodType: METHOD_TYPE, configText: null }, "invalid type: null, expected a string"],
    [{ methodType: METHOD_TYPE, configText: [example] }, "invalid type: sequence, expected a string"],
    [{ methodType: METHOD_TYPE, configText: example, metFileText: 5 }, "invalid type: integer `5`, expected a string"],
    [{ methodType: METHOD_TYPE, configText: example, metFileText: {} }, "invalid type: map, expected a string"],
    [{ methodType: METHOD_TYPE, configText: example, configPath: "a.txt" }, "unknown field `configPath`"],
    [{ methodType: METHOD_TYPE, configText: example, met_file_text: "D,3" }, "unknown field `met_file_text`"],
    [{ methodType: METHOD_TYPE, configText: example, writeResults: true }, "unknown field `writeResults`"],
  ];
  for (const [request, reason] of requests) {
    for (const operation of operations) {
      const output = call(operation, { schemaVersion: "1.0.0", request });
      assertValidationError(output, "INVALID_REQUEST", `${operation} ${reason}`);
      assert.deepEqual(output.error.details, {});
      assert.ok(
        output.error.message.startsWith(`invalid consequence request: ${reason}`),
        output.error.message,
      );
    }
  }
});

test("treats a null met file text as absent", () => {
  const envelope = consequenceRequest(example);
  envelope.request.metFileText = null;
  const output = call("execute", envelope);
  assert.equal(output.error, undefined);
  assert.deepEqual(output, call("execute", consequenceRequest(example)));
});

test("throws on arguments that are not strings and stays usable", () => {
  for (const value of [undefined, null, 5, true, {}, [], Symbol("request")]) {
    for (const operation of operations) {
      assert.throws(() => addon[operation](value), `${operation} ${String(value)}`);
    }
  }
  for (const operation of operations) assert.throws(() => addon[operation]());
  const output = call("validate", consequenceRequest(example));
  assert.equal(output.result.valid, true);
});

test("ignores arguments after the request", () => {
  const json = JSON.stringify(consequenceRequest(example));
  assert.equal(addon.execute(json, "validate", 7), addon.execute(json));
});

test("returns compact JSON text in one line", () => {
  const text = addon.execute(JSON.stringify(consequenceRequest(example)));
  assert.equal(typeof text, "string");
  assert.equal(text.includes("\n"), false);
  assert.ok(text.startsWith('{"schemaVersion":"1.0.0","result":{"methodType":"RADIOLOGICAL_CONSEQUENCE","console":"'));
  assert.equal(JSON.stringify(JSON.parse(text)).length <= text.length, true);
});
