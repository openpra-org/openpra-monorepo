import { afterAll, beforeAll, expect, it } from "vitest";
import { fork } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { praetorJobTimeout } from "interfaces-shared-types/execution/praetor-job";
import { consequenceRequest, referenceConfig } from "../../../test/openrc-reference";
import { runOpenRcProcess } from "./openrc-worker-runner";

const realAddon = resolve(__dirname, "../../../../../solvers/openrc-node/index.js");
const workerPath = resolve(__dirname, "openrc.worker.js");
let directory: string;

function addonFile(name: string, source: string): string {
  const file = join(directory, name);
  writeFileSync(file, source);
  return file;
}

function reply(operation: string, addonPath: string, requestJson: string): Promise<{ resultJson?: string; error?: string }> {
  return new Promise((done, failed) => {
    const child = fork(workerPath, [], { execArgv: [], stdio: ["ignore", "ignore", "ignore", "ipc"] });
    child.once("message", (message: { resultJson?: string; error?: string }) => {
      child.disconnect();
      done(message);
    });
    child.once("error", failed);
    child.send({ operation, requestJson, addonPath });
  });
}

async function running(pidFile: string): Promise<number> {
  const deadline = Date.now() + 5000;
  while (!existsSync(pidFile) && Date.now() < deadline) await new Promise((wake) => setTimeout(wake, 10));
  expect(existsSync(pidFile)).toBe(true);
  return Number(readFileSync(pidFile, "utf8"));
}

beforeAll(() => {
  directory = mkdtempSync(join(tmpdir(), "openrc-worker-test-"));
});
afterAll(() => {
  if (directory) rmSync(directory, { recursive: true, force: true });
});

it("applies heap budgets in the actual worker process", async () => {
  const probe = addonFile(
    "heap-probe.cjs",
    `exports.execute = () => JSON.stringify({
      schemaVersion: '1.0.0', result: {
        args: process.execArgv, heapBytes: require('node:v8').getHeapStatistics().heap_size_limit
      }
    });`,
  );
  const limits: number[] = [];
  for (const heapLimitMb of [128, 256]) {
    const response = await runOpenRcProcess(
      { operation: "execute", requestJson: "{}" },
      { workerPath, addonPath: probe, heapLimitMb, timeoutMs: praetorJobTimeout() },
    );
    const result = JSON.parse(response.resultJson).result;
    expect(result.args).toContain(`--max-old-space-size=${heapLimitMb}`);
    limits.push(result.heapBytes);
  }
  expect(Number(limits[1])).toBeGreaterThan(Number(limits[0]));
});

it.each(["timeout", "cancel"])(
  "stops synchronous native work on %s and starts the next run",
  async (kind) => {
    const blocking = addonFile(
      `blocking-${kind}.cjs`,
      `exports.execute = input => {
        const request = JSON.parse(input);
        require('node:fs').writeFileSync(request.pidFile, String(process.pid));
        require('node:crypto').pbkdf2Sync('password', 'salt', 1000000000, 32, 'sha256');
        return '{}';
      };`,
    );
    const pidFile = join(directory, `${kind}.pid`);
    const controller = new AbortController();
    const started = Date.now();
    const pending = runOpenRcProcess(
      { operation: "execute", requestJson: JSON.stringify({ pidFile }) },
      { workerPath, addonPath: blocking, timeoutMs: kind === "timeout" ? 1200 : 5000, signal: controller.signal },
    );
    const checked = expect(pending).rejects.toMatchObject({
      code: kind === "timeout" ? "OPENRC_TIMEOUT" : "OPENRC_CANCELLED",
    });
    const pid = await running(pidFile);
    if (kind === "cancel") controller.abort();
    await checked;
    expect(() => process.kill(pid, 0)).toThrow();
    expect(Date.now() - started).toBeLessThan(5000);

    const next = await runOpenRcProcess(
      { operation: "validate", requestJson: JSON.stringify({ schemaVersion: "1.0.0", request: { methodType: "UNKNOWN" } }) },
      { workerPath, addonPath: realAddon, timeoutMs: praetorJobTimeout() },
    );
    expect(JSON.parse(next.resultJson).error.code).toBe("UNSUPPORTED_METHOD_TYPE");
  },
  15000,
);

it("finds the addon of the workspace when none is named", async () => {
  const response = await runOpenRcProcess(
    { operation: "validate", requestJson: JSON.stringify(consequenceRequest(referenceConfig("Example"))) },
    { workerPath, timeoutMs: praetorJobTimeout() },
  );
  const output = JSON.parse(response.resultJson);
  expect(output.result.caseName).toBe("test_case_001");
  expect(output.engine.name).toBe("OPENRC");
});

it("reports an addon that cannot be loaded", async () => {
  const missing = join(directory, "absent-addon.cjs");
  await expect(
    runOpenRcProcess({ operation: "execute", requestJson: "{}" }, { workerPath, addonPath: missing, timeoutMs: praetorJobTimeout() }),
  ).rejects.toMatchObject({ code: "OPENRC_WORKER_FAILURE" });
  const broken = addonFile("broken.cjs", "throw new Error('the binary is for another platform');");
  await expect(
    runOpenRcProcess({ operation: "execute", requestJson: "{}" }, { workerPath, addonPath: broken, timeoutMs: praetorJobTimeout() }),
  ).rejects.toMatchObject({ code: "OPENRC_WORKER_FAILURE", message: "the binary is for another platform" });
});

it("reports an addon that throws or answers with text that is not JSON", async () => {
  const throwing = addonFile("throwing.cjs", "exports.execute = () => { throw new Error('native call failed'); };");
  await expect(
    runOpenRcProcess({ operation: "execute", requestJson: "{}" }, { workerPath, addonPath: throwing, timeoutMs: praetorJobTimeout() }),
  ).rejects.toMatchObject({ code: "OPENRC_WORKER_FAILURE", message: "native call failed" });
  const garbled = addonFile("garbled.cjs", "exports.execute = () => 'not json';");
  await expect(
    runOpenRcProcess({ operation: "execute", requestJson: "{}" }, { workerPath, addonPath: garbled, timeoutMs: praetorJobTimeout() }),
  ).rejects.toMatchObject({ code: "OPENRC_WORKER_FAILURE" });
});

it("reports a worker process that exits or crashes before answering", async () => {
  const exiting = addonFile(
    "exiting.cjs",
    "exports.execute = () => { process.stderr.write('ran out of memory'); process.exit(3); };",
  );
  await expect(
    runOpenRcProcess({ operation: "execute", requestJson: "{}" }, { workerPath, addonPath: exiting, timeoutMs: praetorJobTimeout() }),
  ).rejects.toMatchObject({
    code: "OPENRC_PROCESS_EXITED",
    message: "The OpenRC process stopped before returning a result (exit code 3): ran out of memory",
  });
});

it("refuses an operation that is neither validate nor execute", async () => {
  for (const operation of ["preflight", "", "EXECUTE", "constructor", "toString"]) {
    expect(await reply(operation, realAddon, "{}")).toEqual({ error: "Invalid OpenRC operation" });
  }
});

it("adds the engine label only to an answer that is an object without one", async () => {
  const cases: [string, string][] = [
    ['{"schemaVersion":"1.0.0","result":{"a":1}}', '{"schemaVersion":"1.0.0","result":{"a":1},"engine":'],
    ['{"schemaVersion":"1.0.0","result":{"a":1}}  ', '{"schemaVersion":"1.0.0","result":{"a":1},"engine":'],
    ['{"schemaVersion":"1.0.0","result":{},"engine":{"name":"OTHER"}}', '{"schemaVersion":"1.0.0","result":{},"engine":{"name":"OTHER"}}'],
    ["{}", "{}"],
    ["[1,2]", "[1,2]"],
    ["null", "null"],
    ['"text"', '"text"'],
    ["7", "7"],
  ];
  for (const [index, [answer, expected]] of cases.entries()) {
    const crafted = addonFile(
      `crafted-${index}.cjs`,
      `require(${JSON.stringify(realAddon)}); exports.execute = () => ${JSON.stringify(answer)};`,
    );
    const message = await reply("execute", crafted, "{}");
    expect(message.error).toBeUndefined();
    const resultJson = String(message.resultJson);
    if (expected.endsWith('"engine":')) {
      expect(resultJson.startsWith(expected)).toBe(true);
      const parsed = JSON.parse(resultJson);
      expect(Object.keys(parsed)).toEqual(["schemaVersion", "result", "engine"]);
      expect(parsed.engine.name).toBe("OPENRC");
      expect(parsed.engine.version.startsWith("sha256:")).toBe(true);
      expect(parsed.engine.version).toHaveLength(71);
    } else {
      expect(resultJson).toBe(expected);
    }
  }
});

it("leaves the answer of an addon without a native binary unlabelled", async () => {
  const plain = addonFile("plain.cjs", `exports.validate = () => '{"schemaVersion":"1.0.0","result":{"valid":true}}';`);
  expect(await reply("validate", plain, "{}")).toEqual({ resultJson: '{"schemaVersion":"1.0.0","result":{"valid":true}}' });
});

it("stops when its parent disconnects without sending a task", async () => {
  const child = fork(workerPath, [], { execArgv: [], stdio: ["ignore", "ignore", "ignore", "ipc"] });
  const exited = new Promise<number | null>((done) => child.once("exit", (code) => done(code)));
  child.disconnect();
  expect(await exited).toBe(0);
});
