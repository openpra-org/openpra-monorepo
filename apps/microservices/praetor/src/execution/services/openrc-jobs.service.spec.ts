import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { praetorJobTimeout } from "interfaces-shared-types/execution/praetor-job";
import { FakeBroker } from "../../../test/fake-broker";
import { FakeMinio } from "../../../test/fake-minio";
import { openRcManagerSide, until, type OpenRcManagerSide } from "../../../test/openrc-lane";
import type { OpenRcJobRequest } from "./openrc-jobs.service";

const REQUEST = { schemaVersion: "1.0.0", request: { methodType: "RADIOLOGICAL_CONSEQUENCE", configText: "[run]\ncase_name = a\n" } };
const SUCCESS = '{"schemaVersion":"1.0.0","result":{"methodType":"RADIOLOGICAL_CONSEQUENCE","console":"","results":{"tede_sv":0.5}}}';

describe("OpenRcJobsService", () => {
  let broker: FakeBroker;
  let minio: FakeMinio;
  let side: OpenRcManagerSide;

  beforeEach(async () => {
    broker = new FakeBroker();
    minio = new FakeMinio();
    side = await openRcManagerSide(broker, minio);
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    vi.useRealTimers();
    await side.module.close();
  });

  it("sets up the OpenRC job queue, its dead letter queue and the cancel fanout at start", () => {
    expect(broker.exchanges.get("openrc_jobs_exchange")).toMatchObject({ type: "direct", durable: true, bindings: [{ queue: "openrc_jobs", key: "openrc_jobs_key" }] });
    expect(broker.exchanges.get("global_exchange")?.bindings).toEqual([{ queue: "openrc_jobs_dead_queue", key: "openrc_jobs_dead_queue_key" }]);
    expect(broker.exchanges.get("openrc_job_cancel")).toMatchObject({ type: "fanout", durable: true });
    expect(broker.queue("openrc_jobs").options).toEqual({
      durable: true,
      messageTtl: 172800000,
      deadLetterExchange: "global_exchange",
      deadLetterRoutingKey: "openrc_jobs_dead_queue_key",
      maxLength: 100000,
    });
    expect([...broker.queues.keys()].sort()).toEqual(["openrc_jobs", "openrc_jobs_dead_queue"]);
    expect([...broker.exchanges.keys()].some((name) => name.includes("praxis"))).toBe(false);
  });

  it("takes its queue names from the configuration", async () => {
    const configured = new FakeBroker();
    const other = await openRcManagerSide(configured, new FakeMinio(), {
      MQ_OPENRC_JOB_QUEUE_ID: "consequence_jobs",
      MQ_OPENRC_JOB_EXCHANGE_ID: "consequence_exchange",
      MQ_OPENRC_JOB_ROUTING_KEY: "consequence_key",
      MQ_OPENRC_CANCEL_EXCHANGE_ID: "consequence_cancel",
    });
    await other.jobs.submit({ jobId: "configured", operation: "execute", request: REQUEST });
    expect(configured.publications).toEqual([
      expect.objectContaining({ exchange: "consequence_exchange", routingKey: "consequence_key", content: '{"jobId":"configured"}' }),
    ]);
    expect(configured.readyCount("consequence_jobs")).toBe(1);
    expect(configured.exchanges.has("consequence_cancel")).toBe(true);
    await other.module.close();
  });

  it("stores a submitted job and queues its id as a persistent message", async () => {
    const before = Date.now();
    const state = await side.jobs.submit({ jobId: "job-1", operation: "execute", request: REQUEST, timeoutMs: 60_000 });

    expect(state).toEqual({
      jobId: "job-1",
      operation: "execute",
      submittedAt: expect.any(String),
      startedAt: null,
      worker: null,
      attempts: 0,
      queuedJobs: 1,
      workers: 0,
      status: "QUEUED",
      completedAt: null,
      error: null,
    });
    expect(Date.parse(state.submittedAt)).toBeGreaterThanOrEqual(before);
    expect(await side.store.input("job-1")).toEqual({ operation: "execute", request: REQUEST, timeoutMs: 60_000 });
    expect(await side.store.submission("job-1")).toEqual({ jobId: "job-1", operation: "execute", submittedAt: state.submittedAt, timeoutMs: 60_000 });
    expect(broker.publications).toEqual([
      {
        exchange: "openrc_jobs_exchange",
        routingKey: "openrc_jobs_key",
        content: '{"jobId":"job-1"}',
        properties: { persistent: true, messageId: "job-1", contentType: "application/json" },
      },
    ]);
    expect(broker.readyCount("openrc_jobs")).toBe(1);
  });

  it("gives a job an id and the longest allowed time when the caller names neither", async () => {
    const state = await side.jobs.submit({ operation: "validate", request: REQUEST });
    expect(state.jobId).toHaveLength(36);
    expect(state.operation).toBe("validate");
    expect((await side.store.submission(state.jobId))?.timeoutMs).toBe(praetorJobTimeout());
    vi.stubEnv("PRAETOR_JOB_TIMEOUT_MS", "9000");
    const limited = await side.jobs.submit({ operation: "execute", request: REQUEST });
    expect((await side.store.input(limited.jobId))?.timeoutMs).toBe(9000);
  });

  it("stores the input before it publishes, so a worker never meets a job without one", async () => {
    await side.jobs.submit({ jobId: "ordered", operation: "execute", request: REQUEST });
    expect(minio.writes).toEqual(["input/openrc-input-ordered.json", "jobs/openrc-job-ordered.json"]);
    minio.failWrites = (name) => name === "openrc-job-refused.json";
    await expect(side.jobs.submit({ jobId: "refused", operation: "execute", request: REQUEST })).rejects.toThrow("storage refused");
    expect(broker.publications).toHaveLength(1);
  });

  it("returns the state of a job that was already submitted instead of queueing it twice", async () => {
    const first = await side.jobs.submit({ jobId: "same", operation: "execute", request: REQUEST, timeoutMs: 1000 });
    const again = await side.jobs.submit({ jobId: "same", operation: "validate", request: { other: true }, timeoutMs: 2000 });
    expect(again.submittedAt).toBe(first.submittedAt);
    expect(again.operation).toBe("execute");
    expect(broker.publications).toHaveLength(1);
    expect(await side.store.input("same")).toEqual({ operation: "execute", request: REQUEST, timeoutMs: 1000 });
  });

  it("refuses a job without a valid operation, request, id or timeout", async () => {
    const ceiling = praetorJobTimeout();
    const refused: [object | null | string, string][] = [
      [null, "An OpenRC job needs an operation and a request."],
      ["text", "An OpenRC job needs an operation and a request."],
      [{ request: REQUEST }, "An OpenRC job operation is execute or validate."],
      [{ operation: "preflight", request: REQUEST }, "An OpenRC job operation is execute or validate."],
      [{ operation: "execute" }, "An OpenRC job needs a versioned request object."],
      [{ operation: "execute", request: null }, "An OpenRC job needs a versioned request object."],
      [{ operation: "execute", request: [REQUEST] }, "An OpenRC job needs a versioned request object."],
      [{ operation: "execute", request: "{}" }, "An OpenRC job needs a versioned request object."],
      [{ operation: "execute", request: REQUEST, jobId: "bad id" }, "Invalid OpenRC job id."],
      [{ operation: "execute", request: REQUEST, jobId: "" }, "Invalid OpenRC job id."],
      [{ operation: "execute", request: REQUEST, jobId: "a/b" }, "Invalid OpenRC job id."],
      [{ operation: "execute", request: REQUEST, jobId: "x".repeat(129) }, "Invalid OpenRC job id."],
      [{ operation: "execute", request: REQUEST, timeoutMs: 0 }, `An OpenRC job timeout must be between 1 and ${ceiling} ms.`],
      [{ operation: "execute", request: REQUEST, timeoutMs: -5 }, `An OpenRC job timeout must be between 1 and ${ceiling} ms.`],
      [{ operation: "execute", request: REQUEST, timeoutMs: 1.5 }, `An OpenRC job timeout must be between 1 and ${ceiling} ms.`],
      [{ operation: "execute", request: REQUEST, timeoutMs: ceiling + 1 }, `An OpenRC job timeout must be between 1 and ${ceiling} ms.`],
      [{ operation: "execute", request: REQUEST, timeoutMs: "soon" }, `An OpenRC job timeout must be between 1 and ${ceiling} ms.`],
    ];
    for (const [body, message] of refused) {
      const error = await side.jobs.submit(body as OpenRcJobRequest).then(
        () => undefined,
        (caught: Error) => caught,
      );
      expect(error, JSON.stringify(body)).toBeInstanceOf(BadRequestException);
      expect(error?.message).toBe(message);
    }
    expect(broker.publications).toHaveLength(0);
    expect(minio.names()).toEqual([]);
  });

  it("accepts the shortest and the longest timeout", async () => {
    await side.jobs.submit({ jobId: "short", operation: "execute", request: REQUEST, timeoutMs: 1 });
    await side.jobs.submit({ jobId: "long", operation: "execute", request: REQUEST, timeoutMs: praetorJobTimeout() });
    expect((await side.store.input("short"))?.timeoutMs).toBe(1);
    expect((await side.store.input("long"))?.timeoutMs).toBe(praetorJobTimeout());
  });

  it("warns but still answers when the broker pushes back", async () => {
    broker.acceptsPublications = false;
    const state = await side.jobs.submit({ jobId: "pressed", operation: "execute", request: REQUEST });
    expect(state.status).toBe("QUEUED");
    expect(broker.readyCount("openrc_jobs")).toBe(1);
  });

  it("reports a job it does not know as not found and a malformed id as a bad request", async () => {
    await expect(side.jobs.state("absent")).rejects.toBeInstanceOf(NotFoundException);
    await expect(side.jobs.state("absent")).rejects.toThrow("OpenRC job absent was not found.");
    await expect(side.jobs.state("no such id!")).rejects.toBeInstanceOf(BadRequestException);
    await expect(side.jobs.result("absent")).rejects.toBeInstanceOf(NotFoundException);
    await expect(side.jobs.cancel("absent")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("reports the worker, start time and attempt of a running job", async () => {
    await side.jobs.submit({ jobId: "busy", operation: "execute", request: REQUEST });
    const now = new Date().toISOString();
    await side.store.putRunning("busy", { worker: "host:9", startedAt: now, heartbeatAt: now, attempts: 2 });
    expect(await side.jobs.state("busy")).toMatchObject({ status: "RUNNING", startedAt: now, worker: "host:9", attempts: 2, completedAt: null, error: null });
  });

  it("reports how a finished job ended, with its error", async () => {
    await side.jobs.submit({ jobId: "ended", operation: "execute", request: REQUEST });
    const error = { kind: "SOLVER_ERROR", code: "OPENRC_INVALID_VALUE", message: "bad value", details: {} };
    await side.store.putRunning("ended", { worker: "host:1", startedAt: "s", heartbeatAt: "1999-01-01T00:00:00.000Z", attempts: 1 });
    await side.store.putDone("ended", { status: "FAILED", completedAt: "c", worker: "host:1", error });
    expect(await side.jobs.state("ended")).toMatchObject({ status: "FAILED", completedAt: "c", worker: "host:1", startedAt: "s", attempts: 1, error });
  });

  it("counts the waiting jobs and the connected workers", async () => {
    await side.jobs.submit({ jobId: "one", operation: "execute", request: REQUEST });
    await side.jobs.submit({ jobId: "two", operation: "execute", request: REQUEST });
    expect(await side.jobs.state("one")).toMatchObject({ queuedJobs: 2, workers: 0 });
    const channel = await side.rabbit.models[0]?.createChannel();
    await channel?.prefetch(1);
    await channel?.consume("openrc_jobs", () => undefined);
    await until(() => broker.readyCount("openrc_jobs") === 1);
    expect(await side.jobs.state("two")).toMatchObject({ queuedJobs: 1, workers: 1 });
  });

  it("reports unknown counts when the queue cannot be read", async () => {
    await side.jobs.submit({ jobId: "blind", operation: "execute", request: REQUEST });
    broker.queues.delete("openrc_jobs");
    expect(await side.jobs.state("blind")).toMatchObject({ status: "QUEUED", queuedJobs: null, workers: null });
  });

  it("fails a job whose worker stopped reporting, and stores that end", async () => {
    await side.jobs.submit({ jobId: "silent", operation: "execute", request: REQUEST });
    const startedAt = new Date(Date.now() - 400_000).toISOString();
    await side.store.putRunning("silent", { worker: "host:4", startedAt, heartbeatAt: startedAt, attempts: 1 });

    const state = await side.jobs.state("silent");
    expect(state.status).toBe("FAILED");
    expect(state.error).toEqual({
      kind: "EXECUTION_ERROR",
      code: "PRAETOR_WORKER_LOST",
      message: expect.stringContaining("The PRAETOR worker host:4 stopped reporting on this job 400 s ago, after attempt 1."),
      details: { worker: "host:4", attempts: 1 },
    });
    expect(await side.store.done("silent")).toMatchObject({ status: "FAILED", worker: "host:4", error: { code: "PRAETOR_WORKER_LOST" } });
    expect((await side.jobs.state("silent")).completedAt).toBe(state.completedAt);
  });

  it("uses the configured silence limit and falls back to five minutes for a bad one", async () => {
    await side.jobs.submit({ jobId: "quiet", operation: "execute", request: REQUEST });
    const heartbeatAt = new Date(Date.now() - 20_000).toISOString();
    await side.store.putRunning("quiet", { worker: "host:4", startedAt: heartbeatAt, heartbeatAt, attempts: 1 });
    for (const value of ["0", "-1", "soon", "1.5"]) {
      vi.stubEnv("PRAETOR_JOB_STALE_MS", value);
      expect((await side.jobs.state("quiet")).status).toBe("RUNNING");
    }
    vi.stubEnv("PRAETOR_JOB_STALE_MS", "60000");
    expect((await side.jobs.state("quiet")).status).toBe("RUNNING");
    vi.stubEnv("PRAETOR_JOB_STALE_MS", "10000");
    expect((await side.jobs.state("quiet")).status).toBe("FAILED");
  });

  it("refuses the result of a job that has not finished", async () => {
    await side.jobs.submit({ jobId: "waiting", operation: "execute", request: REQUEST });
    await expect(side.jobs.result("waiting")).rejects.toBeInstanceOf(ConflictException);
    await expect(side.jobs.result("waiting")).rejects.toThrow("OpenRC job waiting is queued.");
    const now = new Date().toISOString();
    await side.store.putRunning("waiting", { worker: "w", startedAt: now, heartbeatAt: now, attempts: 1 });
    await expect(side.jobs.result("waiting")).rejects.toThrow("OpenRC job waiting is running.");
  });

  it("returns the stored output of a finished job", async () => {
    await side.jobs.submit({ jobId: "good", operation: "execute", request: REQUEST });
    await side.store.putOutput("good", SUCCESS);
    await side.store.putDone("good", { status: "SUCCEEDED", completedAt: "c", worker: "w", error: null });
    expect(await side.jobs.result("good")).toEqual(JSON.parse(SUCCESS));
  });

  it("returns the stored failure of a job that ended without an output", async () => {
    await side.jobs.submit({ jobId: "lost", operation: "execute", request: REQUEST });
    const error = { kind: "EXECUTION_ERROR", code: "OPENRC_TIMEOUT", message: "too slow", details: { worker: "w" } };
    await side.store.putDone("lost", { status: "FAILED", completedAt: "c", worker: "w", error });
    expect(await side.jobs.result("lost")).toEqual({ schemaVersion: "1.0.0", error });

    await side.jobs.submit({ jobId: "stopped", operation: "execute", request: REQUEST });
    await side.store.putDone("stopped", { status: "CANCELLED", completedAt: "c", worker: null, error: null });
    expect(await side.jobs.result("stopped")).toEqual({
      schemaVersion: "1.0.0",
      error: { kind: "EXECUTION_ERROR", code: "PRAETOR_NO_OUTPUT", message: "OpenRC job stopped ended as cancelled without an output.", details: {} },
    });
  });

  it("refuses to pass on a stored output that is not a valid response", async () => {
    await side.jobs.submit({ jobId: "garbled", operation: "execute", request: REQUEST });
    await side.store.putDone("garbled", { status: "SUCCEEDED", completedAt: "c", worker: "w", error: null });
    for (const output of ['{"schemaVersion":"2.0.0","result":{}}', '{"schemaVersion":"1.0.0"}', "[]", '{"schemaVersion":"1.0.0","result":{},"engine":{"name":"PRAXIS","version":"x"}}']) {
      await side.store.putOutput("garbled", output);
      await expect(side.jobs.result("garbled")).rejects.toThrow("OpenRC");
    }
    await side.store.putOutput("garbled", "not json");
    await expect(side.jobs.result("garbled")).rejects.toBeInstanceOf(SyntaxError);
  });

  it("cancels a waiting job at once and tells every worker", async () => {
    await side.jobs.submit({ jobId: "unwanted", operation: "execute", request: REQUEST });
    const state = await side.jobs.cancel("unwanted");
    expect(state).toMatchObject({ status: "CANCELLED", worker: null, error: null });
    expect(state.completedAt).not.toBeNull();
    expect(await side.store.cancel("unwanted")).toEqual({ requestedAt: expect.any(String) });
    expect(broker.publications[1]).toEqual({
      exchange: "openrc_job_cancel",
      routingKey: "",
      content: '{"jobId":"unwanted"}',
      properties: { contentType: "application/json" },
    });
  });

  it("asks the worker of a running job to stop and leaves the end to that worker", async () => {
    await side.jobs.submit({ jobId: "active", operation: "execute", request: REQUEST });
    const now = new Date().toISOString();
    await side.store.putRunning("active", { worker: "host:2", startedAt: now, heartbeatAt: now, attempts: 1 });
    const state = await side.jobs.cancel("active");
    expect(state.status).toBe("RUNNING");
    expect(await side.store.cancel("active")).toBeDefined();
    expect(await side.store.done("active")).toBeUndefined();
    expect(broker.publications.filter((publication) => publication.exchange === "openrc_job_cancel")).toHaveLength(1);
  });

  it("leaves a finished job as it ended when asked to cancel it", async () => {
    await side.jobs.submit({ jobId: "over", operation: "execute", request: REQUEST });
    await side.store.putDone("over", { status: "SUCCEEDED", completedAt: "c", worker: "w", error: null });
    expect((await side.jobs.cancel("over")).status).toBe("SUCCEEDED");
    expect(await side.store.cancel("over")).toBeUndefined();
    expect(broker.publications.filter((publication) => publication.exchange === "openrc_job_cancel")).toHaveLength(0);
  });

  it("waits for a job to finish and returns its output", async () => {
    const finish = async (): Promise<void> => {
      await until(() => broker.publications.length === 1);
      const { jobId } = JSON.parse(String(broker.publications[0]?.content));
      await side.store.putOutput(jobId, SUCCESS);
      await side.store.putDone(jobId, { status: "SUCCEEDED", completedAt: "c", worker: "w", error: null });
    };
    const [response] = await Promise.all([side.jobs.run("execute", REQUEST, undefined, new AbortController().signal), finish()]);
    expect(response).toEqual(JSON.parse(SUCCESS));
    const { jobId } = JSON.parse(String(broker.publications[0]?.content));
    expect((await side.store.input(jobId))?.timeoutMs).toBe(praetorJobTimeout());
  });

  it("cancels the job and answers OPENRC_CANCELLED when the caller goes away", async () => {
    const controller = new AbortController();
    const pending = side.jobs.run("execute", REQUEST, undefined, controller.signal);
    await until(() => broker.publications.length === 1);
    controller.abort();
    expect(await pending).toEqual({
      schemaVersion: "1.0.0",
      error: { kind: "EXECUTION_ERROR", code: "OPENRC_CANCELLED", message: "The OpenRC request was cancelled by its client.", details: {} },
    });
    const { jobId } = JSON.parse(String(broker.publications[0]?.content));
    expect((await side.jobs.state(jobId)).status).toBe("CANCELLED");
  });

  it("cancels the job and answers OPENRC_TIMEOUT when the deadline passes", async () => {
    const deadline = Date.now() + 250;
    const response = await side.jobs.run("validate", REQUEST, deadline, new AbortController().signal);
    const { jobId } = JSON.parse(String(broker.publications[0]?.content));
    expect(response).toEqual({
      schemaVersion: "1.0.0",
      error: {
        kind: "EXECUTION_ERROR",
        code: "OPENRC_TIMEOUT",
        message: "The OpenRC request deadline passed before a worker finished it.",
        details: { jobId },
      },
    });
    expect(Date.now()).toBeGreaterThanOrEqual(deadline);
    expect((await side.jobs.state(jobId)).status).toBe("CANCELLED");
    const timeoutMs = (await side.store.input(jobId))?.timeoutMs ?? 0;
    expect(timeoutMs).toBeGreaterThan(0);
    expect(timeoutMs).toBeLessThanOrEqual(250);
  });

  it("gives a job whose deadline has already passed one millisecond", async () => {
    const response = await side.jobs.run("execute", REQUEST, Date.now() - 5000, new AbortController().signal);
    expect(response.error?.code).toBe("OPENRC_TIMEOUT");
    const { jobId } = JSON.parse(String(broker.publications[0]?.content));
    expect((await side.store.input(jobId))?.timeoutMs).toBe(1);
  });

  it("opens a new channel after it loses the old one", async () => {
    await side.jobs.submit({ jobId: "before", operation: "execute", request: REQUEST });
    const first = side.rabbit.models[0]?.channels[0];
    first?.lose();
    await side.jobs.submit({ jobId: "after", operation: "execute", request: REQUEST });
    expect(side.rabbit.models).toHaveLength(2);
    expect(broker.readyCount("openrc_jobs")).toBe(2);
    expect((await side.jobs.state("after")).queuedJobs).toBe(2);
  });

  it("shares one connection attempt between callers that arrive together", async () => {
    side.rabbit.models[0]?.channels[0]?.lose();
    await Promise.all(["a", "b", "c", "d"].map((jobId) => side.jobs.submit({ jobId, operation: "execute", request: REQUEST })));
    expect(side.rabbit.models).toHaveLength(2);
    expect(broker.readyCount("openrc_jobs")).toBe(4);
  });

  it("fails to start when the broker cannot be reached, and to submit when it goes away", async () => {
    const unreachable = openRcManagerSide(new FakeBroker(), new FakeMinio(), {}, (rabbit) => {
      rabbit.failConnections = true;
    });
    await expect(unreachable).rejects.toThrow("OpenRcJobsService failed to connect to RabbitMQ broker.");

    side.rabbit.failConnections = true;
    side.rabbit.models[0]?.channels[0]?.lose();
    await expect(side.jobs.submit({ jobId: "nowhere", operation: "execute", request: REQUEST })).rejects.toThrow("failed to connect to RabbitMQ broker");
    side.rabbit.failConnections = false;
    expect((await side.jobs.submit({ jobId: "nowhere", operation: "execute", request: REQUEST })).status).toBe("QUEUED");
  });

  it("closes its channel and connection at shutdown", async () => {
    const model = side.rabbit.models[0];
    const channel = model?.channels[0];
    await side.module.close();
    expect(channel?.closed).toBe(true);
    expect(model?.closed).toBe(true);
    side = await openRcManagerSide(broker, minio);
  });
});
