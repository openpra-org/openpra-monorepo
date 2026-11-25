import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { Worker } from "node:worker_threads";

import {
  DATA_FILE_CASES,
  addon,
  call,
  caseNames,
  consequenceRequest,
  exampleConfig,
  packageDirectory,
  readCase,
  referenceConfig,
  replaceOnce,
} from "./reference-helpers.mjs";

const example = exampleConfig();
const comparableNames = caseNames().filter((name) => !DATA_FILE_CASES.includes(name));
const referenceRequests = comparableNames.map((name) => JSON.stringify(readCase(name).request));

function runWorker(requests, rounds) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./execute-worker.mjs", import.meta.url), {
      workerData: { requests, rounds },
    });
    worker.once("message", resolve);
    worker.once("error", reject);
    worker.once("exit", (code) => {
      if (code !== 0) reject(new Error(`worker stopped with exit code ${code}`));
    });
  });
}

test("gives the same JSON text every time a request is repeated", () => {
  for (const requestJson of referenceRequests) {
    const first = addon.execute(requestJson);
    assert.equal(addon.execute(requestJson), first);
    assert.equal(addon.validate(requestJson), addon.validate(requestJson));
  }
});

test("gives the same answers whatever ran before", () => {
  const alone = referenceRequests.map((requestJson) => addon.execute(requestJson));
  const reversed = [...referenceRequests].reverse().map((requestJson) => addon.execute(requestJson));
  assert.deepEqual(reversed.reverse(), alone);
  const interleaved = referenceRequests.map((requestJson, index) => {
    addon.execute(referenceRequests[(index * 7 + 3) % referenceRequests.length]);
    addon.validate("{");
    return addon.execute(requestJson);
  });
  assert.deepEqual(interleaved, alone);
});

test("gives the same answers on worker threads that run at the same time", async () => {
  const expected = referenceRequests.map((requestJson) => addon.execute(requestJson));
  const rounds = 3;
  const workers = await Promise.all([0, 1, 2, 3].map(() => runWorker(referenceRequests, rounds)));
  for (const outputs of workers) {
    assert.equal(outputs.length, expected.length * rounds);
    outputs.forEach((output, index) => assert.equal(output, expected[index % expected.length]));
  }
});

test("gives the same answer in a fresh process, which then exits cleanly", () => {
  const requestJson = JSON.stringify(consequenceRequest(example));
  const script =
    "const addon = require(process.argv[1]);" +
    "let text = '';" +
    "process.stdin.setEncoding('utf8');" +
    "process.stdin.on('data', (chunk) => { text += chunk; });" +
    "process.stdin.on('end', () => { process.stdout.write(addon.execute(text)); });";
  const output = execFileSync(process.execPath, ["-e", script, packageDirectory], {
    input: requestJson,
    encoding: "utf8",
  });
  assert.equal(output, addon.execute(requestJson));
});

test("reads no data file and writes no results file", () => {
  const folder = `never_written_${process.pid}`;
  let configText = replaceOnce(example, "output_dir = outputs", `output_dir = ${folder}`);
  configText = replaceOnce(configText, "path = data/DCF.json", "path = absent/dcf.json");
  configText = replaceOnce(configText, "path = data/Chains.json", "path = absent/chains.json");
  const before = readdirSync(process.cwd()).sort();
  const output = call("execute", consequenceRequest(configText));
  assert.equal(output.error, undefined);
  assert.deepEqual(readdirSync(process.cwd()).sort(), before);
  assert.equal(existsSync(path.join(process.cwd(), folder)), false);
  assert.equal(existsSync(path.join(packageDirectory, folder)), false);
  assert.equal(output.result.console.includes("Results written to"), false);
  assert.equal(output.result.console.includes("Loading config"), false);
  assert.deepEqual(output.result.results, call("execute", consequenceRequest(example)).result.results);
});

test("returns results when the config asks for no results file", () => {
  const written = call("execute", consequenceRequest(example));
  const silent = call(
    "execute",
    consequenceRequest(replaceOnce(example, "write_csv = true", "write_csv = false")),
  );
  assert.deepEqual(silent, written);
});

test("reads Windows and Unix line endings alike", () => {
  const unix = call("execute", consequenceRequest(example));
  const windows = call("execute", consequenceRequest(example.replaceAll("\n", "\r\n")));
  const oldMac = call("execute", consequenceRequest(example.replaceAll("\n", "\r")));
  assert.equal(unix.error, undefined);
  assert.deepEqual(windows, unix);
  assert.deepEqual(oldMac, unix);

  const withMetFile = referenceConfig("StressTest_met");
  const metFileText = readCase("StressTest_met").metFileText.replaceAll("\r\n", "\n");
  const metUnix = call("execute", consequenceRequest(withMetFile, metFileText));
  const metWindows = call("execute", consequenceRequest(withMetFile, metFileText.replaceAll("\n", "\r\n")));
  assert.equal(metUnix.error, undefined);
  assert.deepEqual(metWindows, metUnix);
});

test("keeps characters outside ASCII in the case name, the console and the results", () => {
  const caseName = "café χ/Q 試験 😀";
  const configText = replaceOnce(example, "case_name = test_case_001", `case_name = ${caseName}`);
  const validation = call("validate", consequenceRequest(configText));
  assert.equal(validation.result.caseName, caseName);
  const output = call("execute", consequenceRequest(configText));
  assert.equal(output.result.results.case_name, caseName);
  assert.equal(output.result.console.split("\n")[0], `  case_name : ${caseName}`);
  assert.ok(output.result.console.includes("  chi/Q            : "));
  assert.ok(output.result.console.includes(" s/m³"));
});

test("reads a number the same way however it is spelled", () => {
  const reference = call("execute", consequenceRequest(example)).result.results;
  for (const spelling of ["1000000000000", "1e12", "1.0e+12", "1_000_000_000_000.0", " 1E12 ", "+1.0E12"]) {
    const configText = replaceOnce(example, "Cs-137 = 1.0E12", `Cs-137 = ${spelling}`);
    const output = call("execute", consequenceRequest(configText));
    assert.deepEqual(output.result.results, reference, spelling);
  }
});

test("carries every digit of a result number across the boundary", () => {
  const output = call("execute", consequenceRequest(example));
  const results = output.result.results;
  assert.ok(Object.is(results.tede_msv, results.tede_sv * 1000));
  for (const [nuclide, dose] of Object.entries(results.breakdown_msv)) {
    assert.ok(Number.isFinite(dose) && dose > 0, nuclide);
  }
  const consoleLine = output.result.console
    .split("\n")
    .find((line) => line.startsWith("  TEDE             : "));
  assert.ok(consoleLine.startsWith(`  TEDE             : ${results.tede_msv.toFixed(4)} mSv  (`), consoleLine);
});

test("returns a signed zero and a missing value as they are", () => {
  const zeroDose = call("execute", readCase("ZeroDose").request).result.results;
  assert.ok(Object.is(zeroDose.tede_sv, 0));
  const polar = call("execute", readCase("PolarWindShift").request).result.results;
  assert.deepEqual(
    polar.segment_met.map((record) => record.mixing_height_m),
    [500, null, 1200],
  );
  const receptor = replaceOnce(example, "y_m = 0.0", "y_m = -0.0");
  assert.deepEqual(
    call("execute", consequenceRequest(receptor)).result.results,
    call("execute", consequenceRequest(example)).result.results,
  );
});

test("returns numbers that are not finite as null", () => {
  const nanReceptor = call("execute", readCase("NonFiniteReceptor").request).result.results;
  assert.equal(nanReceptor.receptor_x_m, null);
  assert.equal(nanReceptor.tede_sv, null);
  assert.deepEqual(nanReceptor.breakdown_msv, { "Cs-137": null, "I-131": null, "Xe-133": null });
  assert.equal(typeof nanReceptor.lmp_tede_sv, "number");

  const infinite = call("execute", readCase("InfiniteActivity").request);
  assert.equal(infinite.result.results.tede_sv, null);
  assert.ok(infinite.result.console.includes("  TEDE             : inf mSv  (inf Sv)"));
  assert.equal(addon.execute(JSON.stringify(readCase("InfiniteActivity").request)).includes("Infinity"), false);
  assert.equal(addon.execute(JSON.stringify(readCase("NonFiniteReceptor").request)).includes("NaN"), false);
});

test("handles a weather file with thousands of rows", () => {
  const rows = ["stability_class,wind_speed_m_s,wind_dir_deg"];
  const classes = "ABCDEF";
  for (let index = 0; index < 3000; index += 1) {
    const speed = 0.5 + ((index * 37) % 97) / 10;
    rows.push(`${classes[index % 6]},${speed},${(index * 53) % 360}`);
  }
  const configText = referenceConfig("StressTest_met");
  const metFileText = `${rows.join("\n")}\n`;
  const started = process.hrtime.bigint();
  const text = addon.execute(JSON.stringify(consequenceRequest(configText, metFileText)));
  const seconds = Number(process.hrtime.bigint() - started) / 1e9;
  const output = JSON.parse(text);
  assert.equal(output.error, undefined);
  assert.equal(output.result.results.n_realizations, 3000);
  assert.equal(output.result.results.realizations.length, 3000);
  assert.equal(output.result.results.realizations[2999].index, 2999);
  const doses = output.result.results.realizations.map((realization) => realization.tede_msv);
  assert.ok(doses.every((dose) => Number.isFinite(dose) && dose >= 0));
  assert.equal(output.result.results.tede_msv.max, Math.max(...doses));
  assert.equal(output.result.results.tede_msv.min, Math.min(...doses));
  assert.ok(seconds < 60, `the run took ${seconds} s`);
  assert.equal(call("validate", consequenceRequest(configText, metFileText)).result.metRecordCount, 3000);
});

test("accepts a config with thousands of comment lines", () => {
  const padding = Array.from({ length: 20000 }, (_, index) => `# note ${index}`).join("\n");
  const output = call("execute", consequenceRequest(`${padding}\n${example}\n${padding}\n`));
  assert.deepEqual(output, call("execute", consequenceRequest(example)));
});
