import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { Test } from "@nestjs/testing";
import request from "supertest";
import type { INestApplication } from "@nestjs/common";
import { runPraxisWithWorker } from "./praxis-worker-runner";

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
    const response = await runPraxisWithWorker(
      { operation: "execute", requestJson: "{}" },
      { workerPath, addonPath: probe, heapLimitMb },
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
  const response = await runPraxisWithWorker({operation, requestJson:"{}"}, {workerPath,addonPath:probe});
  const failure = JSON.parse(response.resultJson).error;
  expect(failure.code).toBe("PRAXIS_RESOURCE_LIMIT");
  expect(failure.details.requiredBytes).toBe("824633720832");
  expect(failure.details.stage).toBe("PREFLIGHT");
  expect(existsSync(marker)).toBe(false);
});
it.each(["timeout", "cancel"])(
  "stops synchronous native work on %s and releases capacity",
  async (kind) => {
    const pidFile = join(directory, `${kind}.pid`);
    const controller = new AbortController();
    const started = Date.now();
    const pending = runPraxisWithWorker(
      { operation: "execute", requestJson: JSON.stringify({ pidFile }) },
      {
        workerPath,
        addonPath: fakeAddon,
        timeoutMs: kind === "timeout" ? 1200 : 5000,
        maxConcurrent: 1,
        signal: controller.signal,
      },
    );
    const checked = expect(pending).rejects.toMatchObject({
      code: kind === "timeout" ? "PRAXIS_TIMEOUT" : "PRAXIS_CANCELLED",
    });
    const pid = await running(pidFile);
    await expect(
      runPraxisWithWorker({ operation: "execute", requestJson: "{}" }, { maxConcurrent: 1 }),
    ).rejects.toMatchObject({ code: "PRAXIS_BUSY" });
    if (kind === "cancel") controller.abort();
    await checked;
    expect(() => process.kill(pid, 0)).toThrow();
    expect(Date.now() - started).toBeLessThan(5000);
    // Validation after termination must start successfully, with no stale capacity slot.
    const response = await runPraxisWithWorker(
      {
        operation: "validate",
        requestJson: JSON.stringify({ schemaVersion: "1.0.0", request: { methodType: "UNKNOWN" }, modelSnapshots: [] }),
      },
      { workerPath, maxConcurrent: 1 },
    );
    expect(JSON.parse(response.resultJson).error.code).toBe("UNSUPPORTED_METHOD_TYPE");
  },
  10000,
);
it("loads the compiled HTTP controller, service and worker", async () => {
  const { ExecuteController } = require(join(compiled, "controllers/execute.controller.js"));
  const { PraxisNativeService } = require(join(compiled, "services/praxis-native.service.js"));
  const { ExecuteProducerService } = require(join(compiled, "services/execute-producer.service.js"));
  const { ExecuteStorageService } = require(join(compiled, "services/execute-storage.service.js"));
  const module = await Test.createTestingModule({
    controllers: [ExecuteController],
    providers: [
      PraxisNativeService,
      { provide: ExecuteProducerService, useValue: {} },
      { provide: ExecuteStorageService, useValue: {} },
    ],
  }).compile();
  const app: INestApplication = module.createNestApplication();
  await app.init();
  try {
    const result = await request(app.getHttpServer())
      .post("/praxis/native/validate")
      .send({ schemaVersion: "1.0.0", request: { methodType: "UNKNOWN" }, modelSnapshots: [] })
      .expect(200);
    expect(result.body.error.code).toBe("UNSUPPORTED_METHOD_TYPE");
    const expired = await request(app.getHttpServer())
      .post("/praxis/native/execute")
      .set("x-praxis-deadline", String(Date.now() - 1))
      .send({})
      .expect(200);
    expect(expired.body.error.code).toBe("PRAXIS_TIMEOUT");
  } finally {
    await app.close();
  }
});
