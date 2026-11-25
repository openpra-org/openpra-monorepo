import assert from "node:assert/strict";
import test from "node:test";

import {
  DATA_FILE_CASES,
  FAILS_ONLY_WHEN_RESULTS_ARE_BUILT,
  FAILS_WHILE_COMPUTING,
  METHOD_TYPE,
  Tally,
  call,
  caseNames,
  codeForPythonType,
  compareJson,
  consoleMetRecords,
  consoleValue,
  exactRequired,
  parseNativeResponse,
  portable,
  readCase,
} from "./reference-helpers.mjs";

const names = caseNames();
const tally = new Tally();
const counts = {
  comparedResults: 0,
  comparedConsoles: 0,
  failedRuns: 0,
  resultsNotBuilt: 0,
  dataFileCases: 0,
  nonFiniteNumbers: 0,
  validCases: 0,
  rejectedCases: 0,
};

function assertReferenceError(name, output, expectedError) {
  assert.equal(output.result, undefined, name);
  assert.deepEqual(Object.keys(output), ["schemaVersion", "error"], name);
  assert.equal(output.error.kind, "SOLVER_ERROR", name);
  assert.equal(output.error.code, codeForPythonType(expectedError.type), name);
  if (expectedError.type !== "KeyError") {
    assert.equal(portable(output.error.message), portable(expectedError.message), name);
  }
  assert.deepEqual(output.error.details, {}, name);
}

test("the reference set holds every case of the Rust engine tests", () => {
  assert.ok(names.length >= 51, `found ${names.length} cases`);
});

for (const name of names) {
  test(`execute reproduces the reference run ${name}`, () => {
    const reference = readCase(name);
    const output = parseNativeResponse(call("execute", reference.request));

    if (DATA_FILE_CASES.includes(name)) {
      assert.equal(reference.expectedError.type, "FileNotFoundError");
      assert.equal(output.error, undefined);
      assert.equal(output.result.methodType, METHOD_TYPE);
      assert.equal(typeof output.result.results.tede_sv, "number");
      counts.dataFileCases += 1;
      return;
    }

    if (FAILS_ONLY_WHEN_RESULTS_ARE_BUILT.includes(name)) {
      assert.equal(reference.expectedError, undefined);
      assert.equal(reference.expectedResults, undefined);
      assert.deepEqual(output, {
        schemaVersion: "1.0.0",
        error: {
          kind: "SOLVER_ERROR",
          code: "OPENRC_INVALID_VALUE",
          message: "cannot convert float NaN to integer",
          details: {},
        },
      });
      counts.resultsNotBuilt += 1;
      return;
    }

    if (reference.expectedError !== undefined) {
      assertReferenceError(name, output, reference.expectedError);
      counts.failedRuns += 1;
      return;
    }

    assert.equal(output.error, undefined, JSON.stringify(output.error));
    assert.deepEqual(Object.keys(output), ["schemaVersion", "result"]);
    assert.deepEqual(Object.keys(output.result), ["methodType", "console", "results"]);
    assert.equal(output.result.methodType, METHOD_TYPE);
    assert.equal(portable(output.result.console), reference.expectedConsole);
    counts.comparedConsoles += 1;

    if (reference.expectedResults === undefined) {
      assert.equal(typeof output.result.results.case_name, "string");
      return;
    }
    compareJson(output.result.results, reference.expectedResults, 0, name, tally);
    counts.comparedResults += 1;
    counts.nonFiniteNumbers += reference.nonFiniteCount;
  });
}

for (const name of names) {
  test(`validate reports what the engine reads in ${name}`, () => {
    const reference = readCase(name);
    const output = parseNativeResponse(call("validate", reference.request));
    const failsLater = FAILS_WHILE_COMPUTING.includes(name) || DATA_FILE_CASES.includes(name);

    if (reference.expectedError !== undefined && !failsLater) {
      assertReferenceError(name, output, reference.expectedError);
      assert.deepEqual(output, call("execute", reference.request));
      counts.rejectedCases += 1;
      return;
    }

    assert.equal(output.error, undefined, JSON.stringify(output.error));
    assert.deepEqual(Object.keys(output.result), [
      "scope",
      "valid",
      "caseName",
      "mode",
      "geometry",
      "nuclideCount",
      "segmentCount",
      "metRecordCount",
    ]);
    assert.equal(output.result.scope, METHOD_TYPE);
    assert.equal(output.result.valid, true);
    counts.validCases += 1;
    if (DATA_FILE_CASES.includes(name)) return;

    const consoleText = reference.expectedConsole;
    assert.equal(output.result.caseName, consoleValue(consoleText, "  case_name : "));
    assert.equal(output.result.mode, consoleValue(consoleText, "  mode      : "));
    assert.equal(output.result.geometry, consoleValue(consoleText, "  geometry  : "));
    assert.equal(output.result.nuclideCount, Number(consoleValue(consoleText, "  nuclides  : ")));
    assert.equal(output.result.segmentCount, Number(consoleValue(consoleText, "  segments  : ")));
    assert.equal(output.result.metRecordCount, consoleMetRecords(consoleText));
  });
}

test("the addon reproduces every reference number", (context) => {
  context.diagnostic(
    `${names.length} cases, ${counts.failedRuns} expected failures, ` +
      `${counts.comparedResults} results and ${counts.comparedConsoles} consoles compared, ` +
      `${tally.identical} of ${tally.compared} numbers bit-identical, ` +
      `${counts.nonFiniteNumbers} numbers that are not finite returned as null`,
  );
  assert.ok(counts.comparedResults >= 37, `compared ${counts.comparedResults} results`);
  assert.ok(counts.comparedConsoles >= 38, `compared ${counts.comparedConsoles} consoles`);
  assert.ok(counts.failedRuns >= 11, `${counts.failedRuns} failed runs`);
  assert.equal(counts.resultsNotBuilt, 1);
  assert.equal(counts.dataFileCases, 1);
  assert.equal(counts.rejectedCases, 7);
  assert.equal(counts.validCases, names.length - 7);
  assert.ok(tally.compared >= 8336, `compared ${tally.compared} numbers`);
  assert.ok(counts.nonFiniteNumbers >= 200, `${counts.nonFiniteNumbers} numbers are not finite`);
  assert.ok(tally.nulls >= counts.nonFiniteNumbers);
  if (exactRequired) assert.equal(tally.identical, tally.compared);
});
