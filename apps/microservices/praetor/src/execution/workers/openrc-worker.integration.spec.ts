import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { praetorJobTimeout } from "interfaces-shared-types/execution/praetor-job";
import { parseNativeResponse } from "openrc-node/protocol";
import {
  DATA_FILE_CASES,
  FAILS_ONLY_WHEN_RESULTS_ARE_BUILT,
  caseNames,
  codeForPythonType,
  compareJson,
  consequenceRequest,
  exactRequired,
  portable,
  readCase,
  referenceConfig,
  type NumberTally,
} from "../../../test/openrc-reference";
import { runOpenRcProcess } from "./openrc-worker-runner";

const addonPath = resolve(__dirname, "../../../../../solvers/openrc-node/index.js");
const workerPath = resolve(__dirname, "openrc.worker.js");
const limits = { addonPath, workerPath, timeoutMs: praetorJobTimeout() };
const requestJson = JSON.stringify(consequenceRequest(referenceConfig("Example")));

function loadedBinaryFingerprint(): string {
  const directory = dirname(addonPath);
  const binaries = readdirSync(directory).filter(
    (name) => name.startsWith(`openrc-node.${process.platform}-${process.arch}`) && name.endsWith(".node"),
  );
  expect(binaries).toHaveLength(1);
  const digest = createHash("sha256")
    .update(new Uint8Array(readFileSync(join(directory, String(binaries[0])))))
    .digest("hex");
  return `sha256:${digest}`;
}

async function inBatches<T>(items: T[], size: number, work: (item: T) => Promise<void>): Promise<void> {
  for (let start = 0; start < items.length; start += size) {
    await Promise.all(items.slice(start, start + size).map(work));
  }
}

describe("OpenRC native worker integration", () => {
  it.each([
    ["validate", "scope"],
    ["execute", "methodType"],
  ] as const)("runs %s through the native addon outside the calling process", async (operation, field) => {
    const response = await runOpenRcProcess({ operation, requestJson }, limits);
    const output = parseNativeResponse(JSON.parse(response.resultJson));

    expect(response.workerProcessId).toBeGreaterThan(0);
    expect(response.workerProcessId).not.toBe(process.pid);
    expect(output.error).toBeUndefined();
    expect(output.result?.[field]).toBe("RADIOLOGICAL_CONSEQUENCE");
    if (operation === "validate") {
      expect(output.result).toEqual({
        scope: "RADIOLOGICAL_CONSEQUENCE",
        valid: true,
        caseName: "test_case_001",
        mode: "lmp",
        geometry: "centerline",
        nuclideCount: 3,
        segmentCount: 1,
        metRecordCount: 1,
      });
    }
  });

  it("labels the answer with the fingerprint of the binary that produced it", async () => {
    const fingerprint = loadedBinaryFingerprint();
    for (const operation of ["validate", "execute"] as const) {
      const response = await runOpenRcProcess({ operation, requestJson }, limits);
      const output = parseNativeResponse(JSON.parse(response.resultJson));
      expect(output.engine).toEqual({ name: "OPENRC", version: fingerprint });
      expect(Object.keys(output)).toEqual(["schemaVersion", "result", "engine"]);
    }
    const failed = await runOpenRcProcess({ operation: "execute", requestJson: "{" }, limits);
    const failure = parseNativeResponse(JSON.parse(failed.resultJson));
    expect(failure.error?.code).toBe("INVALID_REQUEST_JSON");
    expect(failure.engine).toEqual({ name: "OPENRC", version: fingerprint });
    expect(Object.keys(failure)).toEqual(["schemaVersion", "error", "engine"]);
  });

  it("passes the addon's own text through, character for character", async () => {
    const addon: { execute: (json: string) => string; validate: (json: string) => string } = require(addonPath);
    const label = `,"engine":${JSON.stringify({ name: "OPENRC", version: loadedBinaryFingerprint() })}}`;
    for (const name of ["Example", "PolarWindShift", "NonFiniteMet", "ZeroDose", "MissingSection"]) {
      const json = JSON.stringify(readCase(name).request);
      for (const operation of ["validate", "execute"] as const) {
        const direct = addon[operation](json);
        const response = await runOpenRcProcess({ operation, requestJson: json }, limits);
        expect(response.resultJson).toBe(`${direct.slice(0, -1)}${label}`);
      }
    }
  });

  it("keeps a negative zero that a second JSON pass would lose", async () => {
    const json = JSON.stringify(consequenceRequest(readCase("MetClasses").configText, "D,-0.0,270\nD,3.0,270\n"));
    const response = await runOpenRcProcess({ operation: "execute", requestJson: json }, limits);
    expect(response.resultJson).toContain('"wind_speed_m_s":-0.0');
    expect(JSON.stringify(JSON.parse(response.resultJson))).not.toContain("-0");
    const parsed = JSON.parse(response.resultJson);
    expect(parsed.error).toBeUndefined();
    expect(Object.is(parsed.result.results.realizations[0].wind_speed_m_s, -0)).toBe(true);
    expect(parsed.result.results.realizations[1].wind_speed_m_s).toBe(3);
  });

  it(
    "reproduces every reference run through the worker process",
    async () => {
      const names = caseNames();
      expect(names.length).toBeGreaterThanOrEqual(51);
      const tally: NumberTally = { compared: 0, identical: 0, nulls: 0 };
      const counts = { results: 0, consoles: 0, failures: 0, notBuilt: 0, nonFinite: 0 };
      await inBatches(names, 6, async (name) => {
        const reference = readCase(name);
        const response = await runOpenRcProcess({ operation: "execute", requestJson: JSON.stringify(reference.request) }, limits);
        const output = parseNativeResponse(JSON.parse(response.resultJson));
        expect(output.engine?.name).toBe("OPENRC");
        if (DATA_FILE_CASES.includes(name)) {
          expect(output.error).toBeUndefined();
          return;
        }
        if (FAILS_ONLY_WHEN_RESULTS_ARE_BUILT.includes(name)) {
          expect(output.error).toEqual({
            kind: "SOLVER_ERROR",
            code: "OPENRC_INVALID_VALUE",
            message: "cannot convert float NaN to integer",
            details: {},
          });
          counts.notBuilt += 1;
          return;
        }
        if (reference.expectedError !== undefined) {
          expect(output.result).toBeUndefined();
          expect(output.error?.kind).toBe("SOLVER_ERROR");
          expect(output.error?.code).toBe(codeForPythonType(reference.expectedError.type));
          if (reference.expectedError.type !== "KeyError") {
            expect(portable(output.error?.message ?? "")).toBe(portable(reference.expectedError.message));
          }
          counts.failures += 1;
          return;
        }
        expect(output.error).toBeUndefined();
        const result = output.result ?? {};
        expect(Object.keys(result)).toEqual(["methodType", "console", "results"]);
        expect(portable(String(result["console"]))).toBe(reference.expectedConsole);
        counts.consoles += 1;
        if (reference.expectedResults === undefined) return;
        compareJson(result["results"], reference.expectedResults, 0, name, tally);
        counts.results += 1;
        counts.nonFinite += reference.nonFiniteCount;
      });
      expect(counts.results).toBeGreaterThanOrEqual(37);
      expect(counts.consoles).toBeGreaterThanOrEqual(38);
      expect(counts.failures).toBeGreaterThanOrEqual(11);
      expect(counts.notBuilt).toBe(1);
      expect(counts.nonFinite).toBeGreaterThanOrEqual(200);
      expect(tally.compared).toBeGreaterThanOrEqual(8336);
      if (exactRequired) expect(tally.identical).toBe(tally.compared);
    },
    180_000,
  );

  it(
    "gives every caller its own process and the same answer when runs overlap",
    async () => {
      const alone = await runOpenRcProcess({ operation: "execute", requestJson }, limits);
      const together = await Promise.all(Array.from({ length: 8 }, () => runOpenRcProcess({ operation: "execute", requestJson }, limits)));
      const processIds = new Set(together.map((response) => response.workerProcessId));
      expect(processIds.size).toBe(8);
      expect(processIds.has(process.pid)).toBe(false);
      for (const response of together) expect(response.resultJson).toBe(alone.resultJson);
    },
    60_000,
  );
});
