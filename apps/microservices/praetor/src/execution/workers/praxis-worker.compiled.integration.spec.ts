import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { praetorJobTimeout } from "interfaces-shared-types/execution/praetor-job";
import { runPraxisProcess } from "./praxis-worker-runner";

const appDir = resolve(__dirname, "../../..");
const repo = resolve(appDir, "../../..");
const compiled = join(appDir, "dist/src/execution");
const workerPath = join(compiled, "workers/praxis.worker.js");
let directory: string;
let fakeAddon: string;
beforeAll(() => {
  execFileSync(
    process.execPath,
    [join(repo, "node_modules/@nestjs/cli/bin/nest.js"), "build", "--path", "tsconfig.build.json"],
    { cwd: appDir, windowsHide: true, stdio: "pipe" },
  );
  expect(readFileSync(workerPath, "utf8")).toBe(readFileSync(join(__dirname, "praxis.worker.js"), "utf8"));
  directory = mkdtempSync(join(tmpdir(), "praxis-worker-test-"));
  fakeAddon = join(directory, "blocking.cjs");
  writeFileSync(
    fakeAddon,
    `exports.preflight = () => '{"schemaVersion":"1.0.0","result":{"scope":"CLIQUE_MEMORY_PREFLIGHT","largestTable":null}}';
    exports.execute = input => {
    const request=JSON.parse(input);
    require('node:fs').writeFileSync(request.pidFile,String(process.pid));
    require('node:crypto').pbkdf2Sync('password','salt',1000000000,32,'sha256');
    return '{}';
  };`,
  );
}, 30000);
afterAll(() => {
  if (directory) rmSync(directory, { recursive: true, force: true });
});

it("applies heap budgets in the actual compiled worker process", async () => {
  const probe = join(directory, "heap-probe.cjs");
  writeFileSync(probe, `exports.preflight = () => '{"schemaVersion":"1.0.0","result":{"scope":"CLIQUE_MEMORY_PREFLIGHT","largestTable":null}}';
  exports.execute = () => JSON.stringify({
    schemaVersion: '1.0.0', result: {
      args: process.execArgv, heapBytes: require('node:v8').getHeapStatistics().heap_size_limit
    }
  });`);
  const limits: number[] = [];
  for (const heapLimitMb of [128, 256]) {
    const response = await runPraxisProcess(
      { operation: "execute", requestJson: "{}" },
      { workerPath, addonPath: probe, heapLimitMb, timeoutMs: praetorJobTimeout() },
    );
    const result = JSON.parse(response.resultJson).result;
    expect(result.args).toContain(`--max-old-space-size=${heapLimitMb}`);
    limits.push(result.heapBytes);
  }
  expect(limits[1]).toBeGreaterThan(limits[0]!);
});
async function running(pidFile: string) {
  const deadline = Date.now() + 5000;
  while (!existsSync(pidFile) && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 10));
  expect(existsSync(pidFile)).toBe(true);
  return Number(readFileSync(pidFile, "utf8"));
}

it.each(["validate", "execute"] as const)("rejects oversized tables before %s starts", async (operation) => {
  const probe = join(directory, `allocation-${operation}.cjs`);
  const marker = join(directory, `inference-${operation}.started`);
  writeFileSync(probe, `exports.preflight = () => JSON.stringify({schemaVersion:'1.0.0',result:{
    scope:'CLIQUE_MEMORY_PREFLIGHT',largestTable:{bytes:'824633720832',batchSize:1}
  }});
  exports.${operation} = () => {require('node:fs').writeFileSync(${JSON.stringify(marker)},'started');return '{}';};`);
  const response = await runPraxisProcess({ operation, requestJson: "{}" }, { workerPath, addonPath: probe, timeoutMs: praetorJobTimeout() });
  const failure = JSON.parse(response.resultJson).error;
  expect(failure.code).toBe("PRAXIS_RESOURCE_LIMIT");
  expect(failure.details.requiredBytes).toBe("824633720832");
  expect(failure.details.stage).toBe("PREFLIGHT");
  expect(existsSync(marker)).toBe(false);
});
it.each(["timeout", "cancel"])(
  "stops synchronous native work on %s and starts the next run",
  async (kind) => {
    const pidFile = join(directory, `${kind}.pid`);
    const controller = new AbortController();
    const started = Date.now();
    const pending = runPraxisProcess(
      { operation: "execute", requestJson: JSON.stringify({ pidFile }) },
      {
        workerPath,
        addonPath: fakeAddon,
        timeoutMs: kind === "timeout" ? 1200 : 5000,
        signal: controller.signal,
      },
    );
    const checked = expect(pending).rejects.toMatchObject({
      code: kind === "timeout" ? "PRAXIS_TIMEOUT" : "PRAXIS_CANCELLED",
    });
    const pid = await running(pidFile);
    if (kind === "cancel") controller.abort();
    await checked;
    expect(() => process.kill(pid, 0)).toThrow();
    expect(Date.now() - started).toBeLessThan(5000);
    const response = await runPraxisProcess(
      {
        operation: "validate",
        requestJson: JSON.stringify({ schemaVersion: "1.0.0", request: { methodType: "UNKNOWN" }, modelSnapshots: [] }),
      },
      { workerPath, timeoutMs: praetorJobTimeout() },
    );
    expect(JSON.parse(response.resultJson).error.code).toBe("UNSUPPORTED_METHOD_TYPE");
  },
  10000,
);
it("loads the compiled HTTP controller and PRAXIS job services", () => {
  const { ExecuteController } = require(join(compiled, "controllers/execute.controller.js"));
  const { PraxisJobsService } = require(join(compiled, "services/praxis-jobs.service.js"));
  const { PraxisJobConsumerService } = require(join(compiled, "services/praxis-job-consumer.service.js"));
  expect(typeof ExecuteController).toBe("function");
  expect(typeof PraxisJobsService).toBe("function");
  expect(typeof PraxisJobConsumerService).toBe("function");
});
