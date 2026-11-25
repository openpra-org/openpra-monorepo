import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { request as httpRequest } from "node:http";
import type { AddressInfo } from "node:net";
import { resolve } from "node:path";
import type { INestApplication } from "@nestjs/common";
import { Test, type TestingModule } from "@nestjs/testing";
import { json, urlencoded } from "express";
import { jsonResponses } from "interfaces-shared-types/json";
import { parseNativeResponse, type NativeResponse } from "openrc-node/protocol";
import { FakeBroker, FakeRabbitMQ } from "../test/fake-broker";
import { FakeMinio } from "../test/fake-minio";
import { stubProcessExit, until, type ExitStub } from "../test/openrc-lane";
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
  type OpenRcEnvelope,
} from "../test/openrc-reference";
import { PraetorEngineModule } from "./praetor-engine.module";
import { PraetorManagerModule } from "./praetor-manager.module";
import { MinioService, RabbitMQChannelModelService } from "./shared";

vi.mock("@nestia/core", async () => {
  const common = await import("@nestjs/common");
  return {
    TypedRoute: { Get: common.Get, Post: common.Post },
    TypedBody: common.Body,
    TypedQuery: common.Query,
    TypedParam: common.Param,
  };
});

interface Reply {
  status: number;
  text: string;
}

interface JobState {
  jobId: string;
  operation: string;
  status: string;
  submittedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  worker: string | null;
  attempts: number;
  queuedJobs: number | null;
  workers: number | null;
  error: { kind: string; code: string; message: string; details: object } | null;
}

const repository = resolve(__dirname, "../../../..");
const environmentFile = resolve(repository, "deploy/microservices/praetor/configs/cd.stack.env");
const smokeScript = resolve(repository, "apps/solvers/openrc-node/test/http-consequence-smoke.mjs");
const WORKERS = 3;
const example = consequenceRequest(referenceConfig("Example"));

const faultTreeRequest = {
  schemaVersion: "1.0.0",
  request: { schemaVersion: "1.0.0", methodType: "FAULT_TREE", modelId: "00000000-0000-4000-8000-000000000002", revision: 3, requestedBy: "analyst" },
  modelSnapshots: [
    {
      id: "00000000-0000-4000-8000-000000000002",
      projectId: "project-1",
      methodType: "FAULT_TREE",
      revision: 3,
      topGate: { gateId: "00000000-0000-4000-8000-000000000001" },
      gates: [{ id: "00000000-0000-4000-8000-000000000001", kind: "GATE", gateType: "AND", code: "TOP", name: "Top", description: "" }],
      leafNodes: [
        { id: "ref-a", kind: "BASIC_EVENT_REFERENCE", basicEventId: "A" },
        { id: "ref-b", kind: "BASIC_EVENT_REFERENCE", basicEventId: "B" },
      ],
      gateInputs: [
        { id: "input-a", gateId: "00000000-0000-4000-8000-000000000001", childId: "ref-a", order: 0 },
        { id: "input-b", gateId: "00000000-0000-4000-8000-000000000001", childId: "ref-b", order: 1 },
      ],
    },
  ],
  resources: {
    faultTreeBasicEventCatalogue: {
      projectId: "project-1",
      basicEvents: [
        { id: "A", expression: { node: "VALUE", value: { unit: "PROBABILITY", law: { family: "POINT", value: 0.1 } } } },
        { id: "B", expression: { node: "VALUE", value: { unit: "PROBABILITY", law: { family: "POINT", value: 0.2 } } } },
      ],
    },
  },
};

function slowRequest(rows: number): OpenRcEnvelope {
  const weather = ["stability_class,wind_speed_m_s,wind_dir_deg"];
  for (let index = 0; index < rows; index += 1) weather.push(`${"ABCDEF".charAt(index % 6)},${1 + (index % 70) / 10},${(index * 53) % 360}`);
  return consequenceRequest(referenceConfig("StressTest_met"), `${weather.join("\n")}\n`);
}

async function inBatches<T>(items: T[], size: number, work: (item: T) => Promise<void>): Promise<void> {
  for (let start = 0; start < items.length; start += size) {
    await Promise.all(items.slice(start, start + size).map(work));
  }
}

describe("OpenRC jobs through the PRAETOR manager and engines", () => {
  let exit: ExitStub;
  let broker: FakeBroker;
  let minio: FakeMinio;
  let manager: INestApplication;
  let engines: TestingModule[];
  let engineRabbits: FakeRabbitMQ[];
  let baseUrl: string;

  async function send(method: string, path: string, body?: object, headers: Record<string, string> = {}): Promise<Reply> {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: body === undefined ? headers : { "content-type": "application/json", ...headers },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return { status: response.status, text: await response.text() };
  }

  async function native(operation: "validate" | "execute", envelope: object, headers: Record<string, string> = {}): Promise<NativeResponse> {
    const reply = await send("POST", `/openrc/native/${operation}`, envelope, headers);
    expect(reply.status, reply.text).toBe(200);
    return parseNativeResponse(JSON.parse(reply.text));
  }

  async function state(jobId: string): Promise<JobState> {
    const reply = await send("GET", `/openrc/jobs/${jobId}`);
    expect(reply.status, reply.text).toBe(200);
    const parsed: JobState = JSON.parse(reply.text);
    return parsed;
  }

  async function finished(jobId: string): Promise<JobState> {
    let last = await state(jobId);
    await until(async () => {
      last = await state(jobId);
      return ["SUCCEEDED", "FAILED", "CANCELLED"].includes(last.status);
    }, 60_000, `the end of job ${jobId}`);
    return last;
  }

  async function startEngine(): Promise<void> {
    const rabbit = new FakeRabbitMQ(broker);
    const engine = await Test.createTestingModule({ imports: [PraetorEngineModule] })
      .overrideProvider(RabbitMQChannelModelService)
      .useValue(rabbit)
      .overrideProvider(MinioService)
      .useValue(minio)
      .compile();
    await engine.init();
    engines.push(engine);
    engineRabbits.push(rabbit);
  }

  beforeAll(async () => {
    exit = stubProcessExit();
    for (const line of readFileSync(environmentFile, "utf8").split("\n")) {
      const text = line.trim();
      const cut = text.indexOf("=");
      if (text.length === 0 || text.startsWith("#") || cut === -1) continue;
      vi.stubEnv(text.slice(0, cut), text.slice(cut + 1));
    }
    broker = new FakeBroker();
    minio = new FakeMinio();
    engines = [];
    engineRabbits = [];
    const managerModule = await Test.createTestingModule({ imports: [PraetorManagerModule] })
      .overrideProvider(RabbitMQChannelModelService)
      .useValue(new FakeRabbitMQ(broker))
      .overrideProvider(MinioService)
      .useValue(minio)
      .compile();
    manager = managerModule.createNestApplication();
    manager.use(jsonResponses);
    manager.use(json({ limit: "256mb" }));
    manager.use(urlencoded({ extended: true, limit: "256mb" }));
    await manager.listen(0, "127.0.0.1");
    const address: AddressInfo = manager.getHttpServer().address();
    baseUrl = `http://127.0.0.1:${address.port}/q`;
    for (let worker = 0; worker < WORKERS; worker += 1) await startEngine();
  }, 60_000);

  afterAll(async () => {
    for (const engine of engines) await engine.close();
    await manager.close();
    vi.unstubAllEnvs();
    await exit.restore();
  }, 60_000);

  afterEach(() => {
    exit.clearExitCode();
  });

  it("starts with the OpenRC queue next to the PRAXIS queue, each with its own workers", () => {
    expect(broker.consumerCount("openrc_jobs")).toBe(WORKERS);
    expect(broker.consumerCount("praxis_jobs")).toBe(WORKERS);
    expect(broker.exchanges.get("openrc_jobs_exchange")?.bindings).toEqual([{ queue: "openrc_jobs", key: "openrc_jobs_key" }]);
    expect(broker.exchanges.get("praxis_jobs_exchange")?.bindings).toEqual([{ queue: "praxis_jobs", key: "praxis_jobs_key" }]);
    expect(broker.exchanges.get("openrc_job_cancel")?.bindings).toHaveLength(WORKERS);
    expect(broker.exchanges.get("praxis_job_cancel")?.bindings).toHaveLength(WORKERS);
    expect(broker.queues.has("openrc_jobs_dead_queue")).toBe(true);
  });

  it("validates and executes a case over HTTP on a worker process", async () => {
    const validation = await native("validate", example);
    expect(validation.error).toBeUndefined();
    expect(validation.result).toEqual({
      scope: "RADIOLOGICAL_CONSEQUENCE",
      valid: true,
      caseName: "test_case_001",
      mode: "lmp",
      geometry: "centerline",
      nuclideCount: 3,
      segmentCount: 1,
      metRecordCount: 1,
    });
    const execution = await native("execute", example);
    expect(execution.error).toBeUndefined();
    expect(execution.result?.["methodType"]).toBe("RADIOLOGICAL_CONSEQUENCE");
    expect(execution.engine?.name).toBe("OPENRC");
    expect(execution.engine?.version).toBe(validation.engine?.version);
    expect(Object.keys(execution)).toEqual(["schemaVersion", "result", "engine"]);
  });

  it(
    "reproduces every reference run over HTTP, the queue and the workers",
    async () => {
      const names = caseNames();
      expect(names.length).toBeGreaterThanOrEqual(51);
      const tally: NumberTally = { compared: 0, identical: 0, nulls: 0 };
      const counts = { results: 0, consoles: 0, failures: 0, notBuilt: 0 };
      await inBatches(names, WORKERS * 2, async (name) => {
        const reference = readCase(name);
        const output = await native("execute", reference.request);
        expect(output.engine?.name).toBe("OPENRC");
        if (DATA_FILE_CASES.includes(name)) {
          expect(output.error).toBeUndefined();
          return;
        }
        if (FAILS_ONLY_WHEN_RESULTS_ARE_BUILT.includes(name)) {
          expect(output.error?.message).toBe("cannot convert float NaN to integer");
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
        expect(portable(String(result["console"]))).toBe(reference.expectedConsole);
        counts.consoles += 1;
        if (reference.expectedResults === undefined) return;
        compareJson(result["results"], reference.expectedResults, 0, name, tally);
        counts.results += 1;
      });
      expect(counts.results).toBeGreaterThanOrEqual(37);
      expect(counts.consoles).toBeGreaterThanOrEqual(38);
      expect(counts.failures).toBeGreaterThanOrEqual(11);
      expect(counts.notBuilt).toBe(1);
      expect(tally.compared).toBeGreaterThanOrEqual(8336);
      if (exactRequired) expect(tally.identical).toBe(tally.compared);
      expect(broker.readyCount("openrc_jobs")).toBe(0);
      expect(broker.readyCount("openrc_jobs_dead_queue")).toBe(0);
    },
    300_000,
  );

  it("takes a job, reports its progress, returns its result and stores its records", async () => {
    const jobId = "lane-job-1";
    const submitted = await send("POST", "/openrc/jobs", { jobId, operation: "execute", request: example, timeoutMs: 60_000 });
    expect(submitted.status).toBe(202);
    const first: JobState = JSON.parse(submitted.text);
    expect(first).toMatchObject({ jobId, operation: "execute", attempts: 0, error: null });
    expect(["QUEUED", "RUNNING", "SUCCEEDED"]).toContain(first.status);

    const ended = await finished(jobId);
    expect(ended).toMatchObject({ jobId, operation: "execute", status: "SUCCEEDED", attempts: 1, error: null, queuedJobs: 0, workers: WORKERS });
    expect(ended.worker).toContain(String(process.pid));
    expect(Date.parse(String(ended.completedAt))).toBeGreaterThanOrEqual(Date.parse(String(ended.startedAt)));
    expect(Date.parse(String(ended.startedAt))).toBeGreaterThanOrEqual(Date.parse(ended.submittedAt));

    const result = await send("GET", `/openrc/jobs/${jobId}/result`);
    expect(result.status).toBe(200);
    const output = parseNativeResponse(JSON.parse(result.text));
    expect(output).toEqual(await native("execute", example));

    expect(minio.names().filter((name) => name.includes(jobId))).toEqual([
      `input/openrc-input-${jobId}.json`,
      `jobs/openrc-job-${jobId}.done.json`,
      `jobs/openrc-job-${jobId}.json`,
      `jobs/openrc-job-${jobId}.running.json`,
      `output/openrc-output-${jobId}.json`,
    ]);
    const stored = String(minio.text("output", `openrc-output-${jobId}.json`));
    expect(JSON.parse(stored)).toEqual(output);

    const again = await send("POST", "/openrc/jobs", { jobId, operation: "validate", request: {} });
    expect(again.status).toBe(202);
    expect(JSON.parse(again.text)).toMatchObject({ status: "SUCCEEDED", operation: "execute", submittedAt: first.submittedAt });
    const cancelled = await send("DELETE", `/openrc/jobs/${jobId}`);
    expect(cancelled.status).toBe(200);
    expect(JSON.parse(cancelled.text).status).toBe("SUCCEEDED");
  });

  it("stores a case the engine rejects as a failed job with the engine's message", async () => {
    const jobId = "lane-job-rejected";
    const config = referenceConfig("Example").replace("mode      = lmp", "mode      = fast");
    expect((await send("POST", "/openrc/jobs", { jobId, operation: "validate", request: consequenceRequest(config) })).status).toBe(202);
    const ended = await finished(jobId);
    expect(ended.status).toBe("FAILED");
    expect(ended.error).toEqual({ kind: "SOLVER_ERROR", code: "OPENRC_INVALID_VALUE", message: "[run] mode must be 'lmp' or 'epz', got 'fast'", details: {} });
    const output = parseNativeResponse(JSON.parse((await send("GET", `/openrc/jobs/${jobId}/result`)).text));
    expect(output.error).toEqual(ended.error);
    expect(output.engine?.name).toBe("OPENRC");
  });

  it("keeps a negative zero and non-ASCII text all the way to the HTTP answer", async () => {
    const config = readCase("MetClasses").configText.replace("case_name = met_classes", "case_name = café χ/Q 試験");
    const reply = await send("POST", "/openrc/native/execute", consequenceRequest(config, "D,-0.0,270\nD,3.0,270\n"));
    expect(reply.status).toBe(200);
    expect(reply.text).toContain('"wind_speed_m_s":-0.0');
    const output = JSON.parse(reply.text);
    expect(output.result.results.case_name).toBe("café χ/Q 試験");
    expect(Object.is(output.result.results.realizations[0].wind_speed_m_s, -0)).toBe(true);
    expect(output.result.console.split("\n")[0]).toBe("  case_name : café χ/Q 試験");
  });

  it(
    "accepts a request far larger than the default body limit",
    async () => {
      const request = slowRequest(30_000);
      expect(JSON.stringify(request).length).toBeGreaterThan(300_000);
      const validation = await native("validate", request);
      expect(validation.result?.["metRecordCount"]).toBe(30_000);
    },
    60_000,
  );

  it(
    "stops a running job when it is cancelled, and frees the worker",
    async () => {
      const jobId = "lane-job-cancelled";
      expect((await send("POST", "/openrc/jobs", { jobId, operation: "execute", request: slowRequest(60_000) })).status).toBe(202);
      await until(async () => (await state(jobId)).status === "RUNNING", 20_000, "the start of the long job");
      const started = Date.now();
      const cancelling = await send("DELETE", `/openrc/jobs/${jobId}`);
      expect(cancelling.status).toBe(200);
      const ended = await finished(jobId);
      expect(ended.status).toBe("CANCELLED");
      expect(ended.error).toBeNull();
      expect(Date.now() - started).toBeLessThan(10_000);
      const result = parseNativeResponse(JSON.parse((await send("GET", `/openrc/jobs/${jobId}/result`)).text));
      expect(result.error?.code).toBe("PRAETOR_NO_OUTPUT");
      expect(minio.text("output", `openrc-output-${jobId}.json`)).toBeUndefined();
      expect((await native("validate", example)).result?.["valid"]).toBe(true);
    },
    120_000,
  );

  it(
    "cancels waiting jobs without running them",
    async () => {
      const busy = ["lane-busy-1", "lane-busy-2", "lane-busy-3"];
      for (const jobId of busy) await send("POST", "/openrc/jobs", { jobId, operation: "execute", request: slowRequest(60_000) });
      await until(async () => (await Promise.all(busy.map(state))).every((job) => job.status === "RUNNING"), 30_000, "three busy workers");
      const waiting = "lane-job-waiting";
      const submitted: JobState = JSON.parse((await send("POST", "/openrc/jobs", { jobId: waiting, operation: "execute", request: example })).text);
      expect(submitted).toMatchObject({ status: "QUEUED", queuedJobs: 1, workers: WORKERS });

      const cancelled: JobState = JSON.parse((await send("DELETE", `/openrc/jobs/${waiting}`)).text);
      expect(cancelled).toMatchObject({ status: "CANCELLED", worker: null, error: null });
      for (const jobId of busy) expect((await send("DELETE", `/openrc/jobs/${jobId}`)).status).toBe(200);
      for (const jobId of busy) expect((await finished(jobId)).status).toBe("CANCELLED");
      await until(() => broker.readyCount("openrc_jobs") === 0 && broker.unackedCount() === 0, 20_000, "an empty queue");
      expect(minio.text("jobs", `openrc-job-${waiting}.running.json`)).toBeUndefined();
      expect(minio.text("output", `openrc-output-${waiting}.json`)).toBeUndefined();
      expect((await state(waiting)).status).toBe("CANCELLED");
    },
    180_000,
  );

  it(
    "fails a job that runs past its time limit and a native request past its deadline",
    async () => {
      const jobId = "lane-job-slow";
      await send("POST", "/openrc/jobs", { jobId, operation: "execute", request: slowRequest(60_000), timeoutMs: 400 });
      const ended = await finished(jobId);
      expect(ended.status).toBe("FAILED");
      expect(ended.error).toMatchObject({ kind: "EXECUTION_ERROR", code: "OPENRC_TIMEOUT", message: "OpenRC execution exceeded 400 ms" });
      const result = parseNativeResponse(JSON.parse((await send("GET", `/openrc/jobs/${jobId}/result`)).text));
      expect(result.error).toEqual(ended.error);

      const started = Date.now();
      const late = await native("execute", slowRequest(60_000), { "x-openrc-deadline": String(Date.now() + 500) });
      expect(late.error?.code).toBe("OPENRC_TIMEOUT");
      expect(Date.now() - started).toBeLessThan(10_000);
      await until(() => broker.unackedCount() === 0, 20_000, "free workers");
    },
    120_000,
  );

  it(
    "cancels the job of a native request whose client goes away",
    async () => {
      const before = new Set(minio.names().filter((name) => name.endsWith(".cancel.json")));
      const body = JSON.stringify(slowRequest(60_000));
      await new Promise<void>((done) => {
        const request = httpRequest(`${baseUrl}/openrc/native/execute`, {
          method: "POST",
          headers: { "content-type": "application/json", "content-length": Buffer.byteLength(body) },
        });
        request.on("error", () => done());
        request.end(body, () => setTimeout(() => request.destroy(), 1_500));
      });
      const added = (): string[] => minio.names().filter((name) => name.endsWith(".cancel.json") && !before.has(name));
      await until(() => added().length === 1, 20_000, "a cancel record");
      await until(() => broker.unackedCount() === 0, 20_000, "free workers");
      const cancelRecord = String(added()[0]);
      const jobId = cancelRecord.slice("jobs/openrc-job-".length, -".cancel.json".length);
      expect((await state(jobId)).status).toBe("CANCELLED");
    },
    120_000,
  );

  it(
    "gives a job to another worker when the first one is lost",
    async () => {
      const jobId = "lane-job-recovered";
      await send("POST", "/openrc/jobs", { jobId, operation: "execute", request: slowRequest(4_000) });
      await until(async () => (await state(jobId)).status === "RUNNING", 20_000, "the start of the job");
      const holder = broker.channels.find((channel) => [...channel.unacked.values()].some((held) => held.queue === "openrc_jobs"));
      expect(holder).toBeDefined();
      if (holder !== undefined) broker.dropChannel(holder);
      expect(process.exitCode).toBe(1);
      expect(broker.consumerCount("openrc_jobs")).toBe(WORKERS - 1);

      const ended = await finished(jobId);
      expect(ended.status).toBe("SUCCEEDED");
      await until(async () => (await state(jobId)).attempts === 2, 60_000, "the second attempt");
      const result = parseNativeResponse(JSON.parse((await send("GET", `/openrc/jobs/${jobId}/result`)).text));
      expect(result.result?.["results"]).toMatchObject({ n_realizations: 4000 });
      await startEngine();
      expect(broker.consumerCount("openrc_jobs")).toBe(WORKERS);
    },
    180_000,
  );

  it(
    "runs PRAXIS and OpenRC jobs side by side without mixing their queues or records",
    async () => {
      const publicationsBefore = broker.publications.length;
      const [praxis, openRc] = await Promise.all([
        send("POST", "/praxis/native/execute", faultTreeRequest),
        send("POST", "/openrc/native/execute", example),
      ]);
      expect(praxis.status, praxis.text).toBe(200);
      expect(openRc.status, openRc.text).toBe(200);
      const praxisOutput = JSON.parse(praxis.text);
      expect(praxisOutput.error).toBeUndefined();
      expect(praxisOutput.result.topEventProbability).toBeCloseTo(0.02, 12);
      expect(praxisOutput.engine.name).toBe("PRAXIS");
      const openRcOutput = JSON.parse(openRc.text);
      expect(openRcOutput.result.methodType).toBe("RADIOLOGICAL_CONSEQUENCE");
      expect(openRcOutput.engine.name).toBe("OPENRC");

      const published = broker.publications.slice(publicationsBefore).map((publication) => publication.exchange).sort();
      expect(published).toEqual(["openrc_jobs_exchange", "praxis_jobs_exchange"]);
      const wrongLane = await send("POST", "/openrc/native/execute", faultTreeRequest);
      const refused = parseNativeResponse(JSON.parse(wrongLane.text));
      expect(refused.error?.code).toBe("INVALID_REQUEST_JSON");
      const names = minio.names();
      expect(names.some((name) => name.startsWith("input/praxis-input-"))).toBe(true);
      expect(names.every((name) => name.includes("/praxis-") || name.includes("/openrc-"))).toBe(true);
    },
    120_000,
  );

  it("answers with HTTP errors for unknown jobs, bad ids, bad bodies and early results", async () => {
    expect((await send("GET", "/openrc/jobs/nobody")).status).toBe(404);
    expect((await send("GET", "/openrc/jobs/nobody/result")).status).toBe(404);
    expect((await send("DELETE", "/openrc/jobs/nobody")).status).toBe(404);
    expect((await send("GET", "/openrc/jobs/bad%20id")).status).toBe(400);
    expect((await send("POST", "/openrc/jobs", { operation: "preflight", request: example })).status).toBe(400);
    expect((await send("POST", "/openrc/jobs", { operation: "execute", request: example, timeoutMs: 0 })).status).toBe(400);
    expect((await send("POST", "/openrc/jobs", { operation: "execute", request: example, jobId: "a b" })).status).toBe(400);
    expect((await send("POST", "/openrc/native/execute", [example])).status).toBe(400);
    const deadline = await send("POST", "/openrc/native/execute", example, { "x-openrc-deadline": "soon" });
    expect(deadline.status).toBe(400);
    expect(deadline.text).toContain("Invalid OpenRC execution deadline");
    const praxisHeader = await send("POST", "/openrc/native/validate", example, { "x-praxis-deadline": "soon" });
    expect(praxisHeader.status).toBe(200);

    const jobId = "lane-job-early";
    await send("POST", "/openrc/jobs", { jobId, operation: "execute", request: slowRequest(60_000) });
    const early = await send("GET", `/openrc/jobs/${jobId}/result`);
    expect(early.status).toBe(409);
    await send("DELETE", `/openrc/jobs/${jobId}`);
    expect((await finished(jobId)).status).toBe("CANCELLED");
    await until(() => broker.unackedCount() === 0, 20_000, "free workers");
  }, 120_000);

  it(
    "passes the HTTP smoke script that the deployed image is checked with",
    async () => {
      const output = await new Promise<{ code: number; stdout: string; stderr: string }>((done) => {
        execFile(process.execPath, [smokeScript, baseUrl], { windowsHide: true, timeout: 280_000, maxBuffer: 16 * 1024 * 1024 }, (error, stdout, stderr) => {
          done({ code: error === null ? 0 : 1, stdout, stderr });
        });
      });
      expect(output.stderr).toBe("");
      expect(output.code).toBe(0);
      const summary = JSON.parse(output.stdout);
      expect(summary.cases).toBeGreaterThanOrEqual(51);
      expect(summary.results).toBeGreaterThanOrEqual(37);
      expect(summary.numbers).toBeGreaterThanOrEqual(8336);
      expect(summary.engine.startsWith("sha256:")).toBe(true);
      if (exactRequired) expect(summary.bitIdenticalNumbers).toBe(summary.numbers);
      await until(() => broker.unackedCount() === 0 && broker.readyCount("openrc_jobs") === 0, 60_000, "an empty queue");
    },
    300_000,
  );

  it("leaves nothing in the dead letter queue and no job without an end", async () => {
    expect(broker.readyCount("openrc_jobs_dead_queue")).toBe(0);
    expect(broker.readyCount("openrc_jobs")).toBe(0);
    const submissions = minio.names().filter((name) => name.startsWith("jobs/openrc-job-") && name.split(".").length === 2);
    expect(submissions.length).toBeGreaterThan(100);
    for (const name of submissions) {
      expect(minio.names(), name).toContain(name.replace(".json", ".done.json"));
    }
  });
});
