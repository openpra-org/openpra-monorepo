import assert from "node:assert/strict";

import {
  DATA_FILE_CASES,
  FAILS_ONLY_WHEN_RESULTS_ARE_BUILT,
  METHOD_TYPE,
  Tally,
  caseNames,
  codeForPythonType,
  compareJson,
  consequenceRequest,
  exactRequired,
  parseNativeResponse,
  portable,
  readCase,
  referenceConfig,
} from "./reference-data.mjs";

const requestedUrl = process.argv[2] ?? process.env.PRAETOR_URL ?? "http://127.0.0.1:3000/q";
const baseUrl = requestedUrl.endsWith("/") ? requestedUrl.slice(0, -1) : requestedUrl;
const PARALLEL_REQUESTS = 4;
const POLL_MS = 100;
const WAIT_LIMIT_MS = 120_000;

async function send(method, path, body, headers = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: body === undefined ? headers : { "content-type": "application/json", ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, text };
}

function parsed(reply, expectedStatus, what) {
  assert.equal(reply.status, expectedStatus, `${what}: ${reply.text}`);
  return JSON.parse(reply.text);
}

async function native(operation, envelope) {
  const output = parsed(await send("POST", `/openrc/native/${operation}`, envelope), 200, `native ${operation}`);
  return parseNativeResponse(output);
}

function assertEngine(output, what) {
  assert.equal(output.engine?.name, "OPENRC", what);
  assert.equal(output.engine.version.length, 71, what);
  assert.ok(output.engine.version.startsWith("sha256:"), what);
}

function assertState(state, jobId, operation, what) {
  assert.equal(state.jobId, jobId, what);
  assert.equal(state.operation, operation, what);
  assert.ok(["QUEUED", "RUNNING", "SUCCEEDED", "FAILED", "CANCELLED"].includes(state.status), `${what}: ${state.status}`);
  assert.equal(typeof state.submittedAt, "string", what);
  assert.ok(Number.isSafeInteger(state.attempts) && state.attempts >= 0, what);
}

async function finished(jobId, operation) {
  const deadline = Date.now() + WAIT_LIMIT_MS;
  for (;;) {
    const state = parsed(await send("GET", `/openrc/jobs/${jobId}`), 200, `state of ${jobId}`);
    assertState(state, jobId, operation, `state of ${jobId}`);
    if (["SUCCEEDED", "FAILED", "CANCELLED"].includes(state.status)) return state;
    assert.ok(Date.now() < deadline, `job ${jobId} is still ${state.status} after ${WAIT_LIMIT_MS} ms`);
    await new Promise((wake) => setTimeout(wake, POLL_MS));
  }
}

async function inBatches(items, size, work) {
  for (let start = 0; start < items.length; start += size) {
    await Promise.all(items.slice(start, start + size).map(work));
  }
}

const example = consequenceRequest(referenceConfig("Example"));

const validation = await native("validate", example);
assert.equal(validation.error, undefined, JSON.stringify(validation.error));
assert.deepEqual(validation.result, {
  scope: METHOD_TYPE,
  valid: true,
  caseName: "test_case_001",
  mode: "lmp",
  geometry: "centerline",
  nuclideCount: 3,
  segmentCount: 1,
  metRecordCount: 1,
});
assertEngine(validation, "validation");

const names = caseNames();
assert.ok(names.length >= 51, `found ${names.length} reference cases`);
const tally = new Tally();
const counts = { results: 0, consoles: 0, failures: 0, notBuilt: 0, nonFinite: 0 };
const versions = new Set();

await inBatches(names, PARALLEL_REQUESTS, async (name) => {
  const reference = readCase(name);
  const output = await native("execute", reference.request);
  assertEngine(output, name);
  versions.add(output.engine.version);
  if (DATA_FILE_CASES.includes(name)) {
    assert.equal(output.error, undefined, name);
    return;
  }
  if (FAILS_ONLY_WHEN_RESULTS_ARE_BUILT.includes(name)) {
    assert.equal(output.error?.code, "OPENRC_INVALID_VALUE", name);
    assert.equal(output.error.message, "cannot convert float NaN to integer", name);
    counts.notBuilt += 1;
    return;
  }
  if (reference.expectedError !== undefined) {
    assert.equal(output.result, undefined, name);
    assert.equal(output.error.kind, "SOLVER_ERROR", name);
    assert.equal(output.error.code, codeForPythonType(reference.expectedError.type), name);
    if (reference.expectedError.type !== "KeyError") {
      assert.equal(portable(output.error.message), portable(reference.expectedError.message), name);
    }
    counts.failures += 1;
    return;
  }
  assert.equal(output.error, undefined, `${name}: ${JSON.stringify(output.error)}`);
  assert.equal(output.result.methodType, METHOD_TYPE, name);
  assert.equal(portable(output.result.console), reference.expectedConsole, name);
  counts.consoles += 1;
  if (reference.expectedResults === undefined) return;
  compareJson(output.result.results, reference.expectedResults, 0, name, tally);
  counts.results += 1;
  counts.nonFinite += reference.nonFiniteCount;
});

assert.ok(counts.results >= 37, `compared ${counts.results} results`);
assert.ok(counts.failures >= 11, `${counts.failures} expected failures`);
assert.equal(counts.notBuilt, 1);
assert.ok(tally.compared >= 8336, `compared ${tally.compared} numbers`);
assert.equal(versions.size, 1, "every worker must run the same OpenRC binary");
if (exactRequired) assert.equal(tally.identical, tally.compared);

const jobId = `smoke-${process.pid}-${Date.now()}`;
const submitted = parsed(
  await send("POST", "/openrc/jobs", { jobId, operation: "execute", request: example, timeoutMs: 60_000 }),
  202,
  "submit a job",
);
assertState(submitted, jobId, "execute", "submitted job");
const again = parsed(
  await send("POST", "/openrc/jobs", { jobId, operation: "validate", request: {}, timeoutMs: 1 }),
  202,
  "submit the same job again",
);
assert.equal(again.submittedAt, submitted.submittedAt);
assert.equal(again.operation, "execute");
const ended = await finished(jobId, "execute");
assert.equal(ended.status, "SUCCEEDED", JSON.stringify(ended.error));
assert.equal(ended.error, null);
assert.equal(ended.attempts, 1);
assert.equal(typeof ended.worker, "string");
assert.equal(typeof ended.startedAt, "string");
assert.equal(typeof ended.completedAt, "string");
const jobResult = parseNativeResponse(parsed(await send("GET", `/openrc/jobs/${jobId}/result`), 200, "job result"));
const direct = await native("execute", example);
assert.deepEqual(jobResult, direct);
const afterEnd = parsed(await send("DELETE", `/openrc/jobs/${jobId}`), 200, "cancel a finished job");
assert.equal(afterEnd.status, "SUCCEEDED");

const rejectedId = `${jobId}-rejected`;
parsed(
  await send("POST", "/openrc/jobs", { jobId: rejectedId, operation: "execute", request: consequenceRequest("") }),
  202,
  "submit a job the engine rejects",
);
const rejected = await finished(rejectedId, "execute");
assert.equal(rejected.status, "FAILED");
assert.equal(rejected.error.kind, "SOLVER_ERROR");
assert.equal(rejected.error.code, "OPENRC_INVALID_VALUE");
const rejectedResult = parseNativeResponse(
  parsed(await send("GET", `/openrc/jobs/${rejectedId}/result`), 200, "result of a rejected job"),
);
assert.deepEqual(rejectedResult.error, rejected.error);

const weather = ["stability_class,wind_speed_m_s,wind_dir_deg"];
for (let index = 0; index < 20000; index += 1) weather.push(`${"ABCDEF"[index % 6]},${1 + (index % 70) / 10},${(index * 53) % 360}`);
const slowRequest = consequenceRequest(referenceConfig("StressTest_met"), `${weather.join("\n")}\n`);
const cancelId = `${jobId}-cancelled`;
parsed(await send("POST", "/openrc/jobs", { jobId: cancelId, operation: "execute", request: slowRequest }), 202, "submit a long job");
const cancelling = parsed(await send("DELETE", `/openrc/jobs/${cancelId}`), 200, "cancel a job");
assertState(cancelling, cancelId, "execute", "cancelling job");
const cancelled = await finished(cancelId, "execute");
assert.equal(cancelled.status, "CANCELLED", JSON.stringify(cancelled));
assert.equal(cancelled.error, null);
const cancelledResult = parseNativeResponse(
  parsed(await send("GET", `/openrc/jobs/${cancelId}/result`), 200, "result of a cancelled job"),
);
assert.equal(cancelledResult.error.code, "PRAETOR_NO_OUTPUT");

const timedOutId = `${jobId}-timed-out`;
parsed(
  await send("POST", "/openrc/jobs", { jobId: timedOutId, operation: "execute", request: slowRequest, timeoutMs: 50 }),
  202,
  "submit a job with a short time limit",
);
const timedOut = await finished(timedOutId, "execute");
assert.equal(timedOut.status, "FAILED");
assert.equal(timedOut.error.code, "OPENRC_TIMEOUT");

const late = parsed(
  await send("POST", "/openrc/native/execute", slowRequest, { "x-openrc-deadline": String(Date.now() + 300) }),
  200,
  "a native request with a deadline",
);
assert.equal(parseNativeResponse(late).error.code, "OPENRC_TIMEOUT");

assert.equal((await send("GET", `/openrc/jobs/${jobId}-unknown`)).status, 404);
assert.equal((await send("GET", `/openrc/jobs/${jobId}-unknown/result`)).status, 404);
assert.equal((await send("GET", "/openrc/jobs/bad%20id")).status, 400);
assert.equal((await send("POST", "/openrc/jobs", { operation: "preflight", request: example })).status, 400);
assert.equal((await send("POST", "/openrc/jobs", { operation: "execute", request: example, timeoutMs: 0 })).status, 400);
assert.equal((await send("POST", "/openrc/native/execute", example, { "x-openrc-deadline": "soon" })).status, 400);
assert.equal((await send("POST", "/openrc/native/execute", [example])).status, 400);
const unfinishedId = `${jobId}-unfinished`;
parsed(await send("POST", "/openrc/jobs", { jobId: unfinishedId, operation: "execute", request: slowRequest }), 202, "submit a second long job");
const early = await send("GET", `/openrc/jobs/${unfinishedId}/result`);
assert.ok([200, 409].includes(early.status), early.text);
parsed(await send("DELETE", `/openrc/jobs/${unfinishedId}`), 200, "cancel the second long job");
await finished(unfinishedId, "execute");

const wrongMethod = await native("execute", { schemaVersion: "1.0.0", request: { methodType: "FAULT_TREE" } });
assert.equal(wrongMethod.error.kind, "VALIDATION_ERROR");
assert.equal(wrongMethod.error.code, "UNSUPPORTED_METHOD_TYPE");

console.log(
  JSON.stringify({
    cases: names.length,
    results: counts.results,
    consoles: counts.consoles,
    expectedFailures: counts.failures,
    numbers: tally.compared,
    bitIdenticalNumbers: tally.identical,
    nonFiniteAsNull: counts.nonFinite,
    engine: [...versions][0],
    tedeSv: direct.result.results.tede_sv,
  }),
);
