import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Logger } from "@nestjs/common";
import { hostname } from "node:os";
import { FakeBroker, type FakeChannel } from "../../../test/fake-broker";
import { FakeMinio } from "../../../test/fake-minio";
import { openRcEngineSide, stubProcessExit, until, watchUnhandledRejections, type ExitStub, type OpenRcEngineSide } from "../../../test/openrc-lane";
import { OpenRcWorkerError } from "../workers/openrc-worker-runner";

const runOpenRcProcess = vi.hoisted(() => vi.fn());
vi.mock("../workers/openrc-worker-runner", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  runOpenRcProcess,
}));

const WORKER = `${hostname()}:${process.pid}`;
const REQUEST = { schemaVersion: "1.0.0", request: { methodType: "RADIOLOGICAL_CONSEQUENCE", configText: "[run]\ncase_name = café\n" } };
const SUCCESS = '{"schemaVersion":"1.0.0","result":{"methodType":"RADIOLOGICAL_CONSEQUENCE","console":"","results":{"tede_sv":-0.0}},"engine":{"name":"OPENRC","version":"sha256:' + "a".repeat(64) + '"}}';
const REJECTED = '{"schemaVersion":"1.0.0","error":{"kind":"SOLVER_ERROR","code":"OPENRC_INVALID_VALUE","message":"[run] mode must be \'lmp\' or \'epz\', got \'fast\'","details":{}}}';

describe("OpenRcJobConsumerService", () => {
  let broker: FakeBroker;
  let minio: FakeMinio;
  let side: OpenRcEngineSide;
  let exit: ExitStub;

  async function start(settings: Record<string, string> = {}): Promise<void> {
    side = await openRcEngineSide(broker, minio, settings);
  }

  async function queueJob(jobId: string, operation: "execute" | "validate" = "execute", timeoutMs = 5000): Promise<void> {
    await side.store.putInput(jobId, { operation, request: REQUEST, timeoutMs });
    await side.store.putSubmission({ jobId, operation, submittedAt: new Date().toISOString(), timeoutMs });
    publish(JSON.stringify({ jobId }));
  }

  function publish(content: string): void {
    channel().publish("openrc_jobs_exchange", "openrc_jobs_key", Buffer.from(content), { persistent: true });
  }

  function channel(): FakeChannel {
    const found = side.rabbit.models[0]?.channels[0];
    if (found === undefined) throw new Error("the consumer has no channel");
    return found;
  }

  async function settled(jobId: string): Promise<void> {
    await until(async () => (await side.store.done(jobId)) !== undefined && broker.unackedCount() === 0, 5000, `the end of ${jobId}`);
  }

  beforeAll(() => {
    exit = stubProcessExit();
  });

  afterAll(async () => {
    await exit.restore();
  });

  beforeEach(() => {
    broker = new FakeBroker();
    minio = new FakeMinio();
    runOpenRcProcess.mockReset();
    runOpenRcProcess.mockResolvedValue({ resultJson: SUCCESS, workerProcessId: 99 });
  });

  afterEach(async () => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    await side.module.close();
    exit.clearExitCode();
  });

  it("joins the OpenRC job queue with one slot and listens for cancellations", async () => {
    await start();
    expect(broker.consumerCount("openrc_jobs")).toBe(1);
    expect(channel().calls).toContain("prefetch 1");
    const cancelQueues = [...broker.queues.values()].filter((queue) => queue.options.exclusive === true);
    expect(cancelQueues).toHaveLength(1);
    expect(cancelQueues[0]?.options.autoDelete).toBe(true);
    expect(broker.exchanges.get("openrc_job_cancel")?.bindings).toEqual([{ queue: cancelQueues[0]?.name, key: "" }]);
    expect(broker.exchanges.get("openrc_jobs_exchange")?.bindings).toEqual([{ queue: "openrc_jobs", key: "openrc_jobs_key" }]);
    expect([...broker.queues.keys()].some((name) => name.includes("praxis"))).toBe(false);
  });

  it("runs a queued job and stores its output and its end", async () => {
    await start();
    await queueJob("job-1", "execute", 4321);
    await settled("job-1");

    expect(runOpenRcProcess).toHaveBeenCalledTimes(1);
    const [task, limits] = runOpenRcProcess.mock.calls[0];
    expect(task).toEqual({ operation: "execute", requestJson: JSON.stringify(REQUEST) });
    expect(limits.timeoutMs).toBe(4321);
    expect(limits.signal).toBeInstanceOf(AbortSignal);
    expect(limits.signal.aborted).toBe(false);
    expect(await side.store.output("job-1")).toBe(SUCCESS);
    expect(await side.store.done("job-1")).toEqual({ status: "SUCCEEDED", completedAt: expect.any(String), worker: WORKER, error: null });
    expect(await side.store.running("job-1")).toMatchObject({ worker: WORKER, attempts: 1 });
    expect(broker.readyCount("openrc_jobs")).toBe(0);
    expect(broker.readyCount("openrc_jobs_dead_queue")).toBe(0);
  });

  it("passes a validation job to the worker as a validation", async () => {
    await start();
    await queueJob("check", "validate");
    await settled("check");
    expect(runOpenRcProcess.mock.calls[0][0].operation).toBe("validate");
  });

  it("writes the running record before the worker starts", async () => {
    await start();
    let seen: object | undefined;
    runOpenRcProcess.mockImplementationOnce(async () => {
      seen = await side.store.running("early");
      return { resultJson: SUCCESS, workerProcessId: 1 };
    });
    await queueJob("early");
    await settled("early");
    expect(seen).toMatchObject({ worker: WORKER, attempts: 1 });
  });

  it("stores an answer that the engine rejected as a failed job with the engine's error", async () => {
    await start();
    runOpenRcProcess.mockResolvedValueOnce({ resultJson: REJECTED, workerProcessId: 1 });
    await queueJob("rejected");
    await settled("rejected");
    expect(await side.store.output("rejected")).toBe(REJECTED);
    expect(await side.store.done("rejected")).toMatchObject({
      status: "FAILED",
      error: { kind: "SOLVER_ERROR", code: "OPENRC_INVALID_VALUE", message: "[run] mode must be 'lmp' or 'epz', got 'fast'", details: {} },
    });
  });

  it.each([
    "not json",
    "[]",
    '{"schemaVersion":"2.0.0","result":{}}',
    '{"schemaVersion":"1.0.0"}',
    '{"schemaVersion":"1.0.0","result":{},"error":{}}',
    '{"schemaVersion":"1.0.0","result":{},"engine":{"name":"PRAXIS","version":"sha256:' + "a".repeat(64) + '"}}',
  ])("fails a job whose worker answer is not a valid OpenRC response %#", async (resultJson) => {
    await start();
    runOpenRcProcess.mockResolvedValueOnce({ resultJson, workerProcessId: 1 });
    await queueJob("invalid");
    await settled("invalid");
    expect(await side.store.output("invalid")).toBeUndefined();
    expect(await side.store.done("invalid")).toMatchObject({
      status: "FAILED",
      error: { kind: "EXECUTION_ERROR", code: "OPENRC_INVALID_RESPONSE", details: { worker: WORKER } },
    });
    expect((await side.store.done("invalid"))?.error?.message.startsWith("OpenRC returned an invalid response: ")).toBe(true);
  });

  it.each(["OPENRC_TIMEOUT", "OPENRC_PROCESS_EXITED", "OPENRC_WORKER_FAILURE", "OPENRC_INVALID_LIMITS"])(
    "stores the worker failure %s with the worker and the attempt",
    async (code) => {
      await start();
      runOpenRcProcess.mockRejectedValueOnce(new OpenRcWorkerError(code, `what happened: ${code}`));
      await queueJob("broken");
      await settled("broken");
      expect(await side.store.done("broken")).toEqual({
        status: "FAILED",
        completedAt: expect.any(String),
        worker: WORKER,
        error: { kind: "EXECUTION_ERROR", code, message: `what happened: ${code}`, details: { worker: WORKER, attempts: 1 } },
      });
      expect(await side.store.output("broken")).toBeUndefined();
    },
  );

  it("stores an unexpected worker error as OPENRC_WORKER_FAILURE", async () => {
    await start();
    runOpenRcProcess.mockRejectedValueOnce(new Error("spawn EACCES"));
    await queueJob("unexpected");
    await settled("unexpected");
    expect((await side.store.done("unexpected"))?.error).toMatchObject({ code: "OPENRC_WORKER_FAILURE", message: "spawn EACCES" });
    runOpenRcProcess.mockRejectedValueOnce("a thrown text");
    await queueJob("text");
    await settled("text");
    expect((await side.store.done("text"))?.error).toMatchObject({ code: "OPENRC_WORKER_FAILURE", message: "a thrown text" });
  });

  it("ends a job that the worker reports as cancelled without an error", async () => {
    await start();
    runOpenRcProcess.mockRejectedValueOnce(new OpenRcWorkerError("OPENRC_CANCELLED", "OpenRC execution was cancelled"));
    await queueJob("stopped");
    await settled("stopped");
    expect(await side.store.done("stopped")).toEqual({ status: "CANCELLED", completedAt: expect.any(String), worker: WORKER, error: null });
  });

  it("aborts the running job that a cancel message names, and only that one", async () => {
    vi.stubEnv("PRAETOR_WORKER_SLOTS", "2");
    await start();
    const signals: AbortSignal[] = [];
    runOpenRcProcess.mockImplementation(
      (_task: object, limits: { signal: AbortSignal }) =>
        new Promise((_done, failed) => {
          signals.push(limits.signal);
          limits.signal.addEventListener("abort", () => failed(new OpenRcWorkerError("OPENRC_CANCELLED", "OpenRC execution was cancelled")));
        }),
    );
    await queueJob("first");
    await queueJob("second");
    await until(() => signals.length === 2);

    channel().publish("openrc_job_cancel", "", Buffer.from("not json"));
    channel().publish("openrc_job_cancel", "", Buffer.from("{}"));
    channel().publish("openrc_job_cancel", "", Buffer.from('{"jobId":"someone-else"}'));
    channel().publish("openrc_job_cancel", "", Buffer.from('{"jobId":"first"}'));
    await until(async () => (await side.store.done("first")) !== undefined);

    expect(await side.store.done("first")).toMatchObject({ status: "CANCELLED", error: null });
    expect(signals[0]?.aborted).toBe(true);
    expect(signals[1]?.aborted).toBe(false);
    expect(await side.store.done("second")).toBeUndefined();
    channel().publish("openrc_job_cancel", "", Buffer.from('{"jobId":"second"}'));
    await settled("second");
    expect(signals[1]?.aborted).toBe(true);
  });

  it("does not run a job that is already finished", async () => {
    await start();
    await side.store.putDone("done-before", { status: "SUCCEEDED", completedAt: "c", worker: "other:1", error: null });
    await queueJob("done-before");
    await until(() => broker.unackedCount() === 0 && broker.readyCount("openrc_jobs") === 0);
    expect(runOpenRcProcess).not.toHaveBeenCalled();
    expect((await side.store.done("done-before"))?.worker).toBe("other:1");
  });

  it("ends a job that was cancelled while it waited, without running it", async () => {
    await start();
    await side.store.putCancel("cancelled-before", { requestedAt: "r" });
    await queueJob("cancelled-before");
    await settled("cancelled-before");
    expect(runOpenRcProcess).not.toHaveBeenCalled();
    expect(await side.store.done("cancelled-before")).toMatchObject({ status: "CANCELLED", worker: WORKER, error: null });
    expect(await side.store.running("cancelled-before")).toBeUndefined();
  });

  it("ends a job that was cancelled between its pickup and its start, without running it", async () => {
    await start();
    minio.afterWrite = (name) => {
      if (name === "openrc-job-raced.running.json") minio.objects.set("jobs/openrc-job-raced.cancel.json", '{"requestedAt":"r"}');
    };
    await queueJob("raced");
    await settled("raced");
    expect(runOpenRcProcess).not.toHaveBeenCalled();
    expect(await side.store.done("raced")).toMatchObject({ status: "CANCELLED", worker: WORKER, error: null });
    expect(await side.store.running("raced")).toMatchObject({ attempts: 1 });
    minio.afterWrite = () => undefined;
    await queueJob("after-race");
    await settled("after-race");
    expect(runOpenRcProcess).toHaveBeenCalledTimes(1);
  });

  it("counts the attempts of a job that comes back and gives up after the limit", async () => {
    await start();
    await side.store.putRunning("again", { worker: "lost:7", startedAt: "s", heartbeatAt: "h", attempts: 1 });
    await queueJob("again");
    await settled("again");
    expect(runOpenRcProcess).toHaveBeenCalledTimes(1);
    expect((await side.store.running("again"))?.attempts).toBe(2);
    expect((await side.store.done("again"))?.status).toBe("SUCCEEDED");

    await side.store.putRunning("crashing", { worker: "lost:7", startedAt: "s", heartbeatAt: "h", attempts: 2 });
    await queueJob("crashing");
    await settled("crashing");
    expect(runOpenRcProcess).toHaveBeenCalledTimes(1);
    expect(await side.store.done("crashing")).toEqual({
      status: "FAILED",
      completedAt: expect.any(String),
      worker: WORKER,
      error: {
        kind: "EXECUTION_ERROR",
        code: "PRAETOR_WORKER_LOST",
        message: "OpenRC stopped 2 times while running this job (last on lost:7). The case may need more memory than a worker has.",
        details: { worker: "lost:7", attempts: 2 },
      },
    });
  });

  it("takes the attempt limit and the slot count from the environment", async () => {
    vi.stubEnv("PRAETOR_JOB_MAX_ATTEMPTS", "4");
    vi.stubEnv("PRAETOR_WORKER_SLOTS", "3");
    await start();
    expect(channel().calls).toContain("prefetch 3");
    await side.store.putRunning("patient", { worker: "lost:7", startedAt: "s", heartbeatAt: "h", attempts: 3 });
    await queueJob("patient");
    await settled("patient");
    expect((await side.store.done("patient"))?.status).toBe("SUCCEEDED");
    expect((await side.store.running("patient"))?.attempts).toBe(4);
  });

  it.each(["0", "-2", "1.5", "many"])("keeps the default slot and attempt limits for the setting %s", async (value) => {
    vi.stubEnv("PRAETOR_JOB_MAX_ATTEMPTS", value);
    vi.stubEnv("PRAETOR_WORKER_SLOTS", value);
    await start();
    expect(channel().calls).toContain("prefetch 1");
    await side.store.putRunning("limited", { worker: "lost:7", startedAt: "s", heartbeatAt: "h", attempts: 2 });
    await queueJob("limited");
    await settled("limited");
    expect((await side.store.done("limited"))?.error?.code).toBe("PRAETOR_WORKER_LOST");
  });

  it("fails a job whose input is missing from storage", async () => {
    await start();
    publish(JSON.stringify({ jobId: "no-input" }));
    await settled("no-input");
    expect(runOpenRcProcess).not.toHaveBeenCalled();
    expect(await side.store.done("no-input")).toMatchObject({
      status: "FAILED",
      error: { kind: "EXECUTION_ERROR", code: "PRAETOR_INPUT_MISSING", message: "The job input is missing from PRAETOR storage.", details: { worker: WORKER } },
    });
  });

  it.each(["not json", "{}", '{"jobId":"bad id"}', '{"jobId":""}', '{"jobId":7}', "null"])("dead-letters the malformed job message %s", async (content) => {
    await start();
    publish(content);
    await until(() => broker.readyCount("openrc_jobs_dead_queue") === 1 && broker.unackedCount() === 0);
    expect(runOpenRcProcess).not.toHaveBeenCalled();
    expect(broker.readyCount("openrc_jobs")).toBe(0);
    expect(minio.names()).toEqual([]);
  });

  it("stores a failure when its own storage calls fail, and still takes the next job", async () => {
    await start();
    minio.failWrites = (name) => name === "openrc-job-unlucky.running.json";
    await queueJob("unlucky");
    await settled("unlucky");
    expect(await side.store.done("unlucky")).toMatchObject({
      status: "FAILED",
      error: {
        kind: "EXECUTION_ERROR",
        code: "PRAETOR_WORKER_FAILURE",
        message: "The PRAETOR worker could not process this job: storage refused to write openrc-job-unlucky.running.json",
        details: { worker: WORKER },
      },
    });
    expect(runOpenRcProcess).not.toHaveBeenCalled();
    minio.failWrites = () => false;
    await queueJob("next");
    await settled("next");
    expect((await side.store.done("next"))?.status).toBe("SUCCEEDED");
  });

  it("acknowledges a job even when its failure cannot be stored", async () => {
    await start();
    minio.failWrites = (name) => name === "openrc-job-doomed.running.json" || name === "openrc-job-doomed.done.json";
    await queueJob("doomed");
    await until(() => broker.unackedCount() === 0 && broker.readyCount("openrc_jobs") === 0);
    expect(await side.store.done("doomed")).toBeUndefined();
    expect(broker.readyCount("openrc_jobs_dead_queue")).toBe(0);
  });

  it("keeps the same start time and attempt in every heartbeat", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
    await start();
    let finish: (value: { resultJson: string; workerProcessId: number }) => void = () => undefined;
    runOpenRcProcess.mockImplementationOnce(() => new Promise((done) => (finish = done)));
    await queueJob("beating");
    await until(() => runOpenRcProcess.mock.calls.length === 1);
    const first = await side.store.running("beating");
    expect(first?.heartbeatAt).toBe(first?.startedAt);

    await vi.advanceTimersByTimeAsync(10_000);
    await until(async () => (await side.store.running("beating"))?.heartbeatAt !== first?.heartbeatAt);
    const second = await side.store.running("beating");
    expect(second).toMatchObject({ worker: WORKER, startedAt: first?.startedAt, attempts: 1 });
    expect(Date.parse(String(second?.heartbeatAt)) - Date.parse(String(first?.heartbeatAt))).toBe(10_000);

    await vi.advanceTimersByTimeAsync(25_000);
    const beats = minio.writes.filter((name) => name === "jobs/openrc-job-beating.running.json").length;
    expect(beats).toBe(4);

    finish({ resultJson: SUCCESS, workerProcessId: 1 });
    await settled("beating");
    await vi.advanceTimersByTimeAsync(60_000);
    expect(minio.writes.filter((name) => name === "jobs/openrc-job-beating.running.json").length).toBe(4);
  });

  it("runs as many jobs at once as it has slots, and no more", async () => {
    vi.stubEnv("PRAETOR_WORKER_SLOTS", "2");
    await start();
    const finishers: ((value: { resultJson: string; workerProcessId: number }) => void)[] = [];
    runOpenRcProcess.mockImplementation(() => new Promise((done) => finishers.push(done)));
    for (const jobId of ["a", "b", "c", "d"]) await queueJob(jobId);
    await until(() => finishers.length === 2);
    await new Promise((wake) => setTimeout(wake, 50));
    expect(finishers).toHaveLength(2);
    expect(broker.readyCount("openrc_jobs")).toBe(2);
    finishers[0]?.({ resultJson: SUCCESS, workerProcessId: 1 });
    await until(() => finishers.length === 3);
    expect(broker.readyCount("openrc_jobs")).toBe(1);
    for (let index = 1; index < 4; index += 1) {
      await until(() => finishers.length > index);
      finishers[index]?.({ resultJson: SUCCESS, workerProcessId: 1 });
    }
    for (const jobId of ["a", "b", "c", "d"]) await settled(jobId);
    expect(runOpenRcProcess).toHaveBeenCalledTimes(4);
  });

  it("stops taking jobs and aborts the running one at shutdown", async () => {
    await start();
    const rejections = watchUnhandledRejections();
    let signal: AbortSignal | undefined;
    runOpenRcProcess.mockImplementation(
      (_task: object, limits: { signal: AbortSignal }) =>
        new Promise((_done, failed) => {
          signal = limits.signal;
          limits.signal.addEventListener("abort", () => failed(new OpenRcWorkerError("OPENRC_CANCELLED", "OpenRC execution was cancelled")));
        }),
    );
    await queueJob("interrupted");
    await until(() => signal !== undefined);
    const model = side.rabbit.models[0];
    await side.module.close();

    expect(signal?.aborted).toBe(true);
    expect(channel().closed).toBe(true);
    expect(model?.closed).toBe(true);
    expect(broker.consumerCount("openrc_jobs")).toBe(0);
    await until(async () => (await side.store.done("interrupted")) !== undefined);
    expect(await rejections.stop()).toEqual([]);
    expect((await side.store.done("interrupted"))?.status).toBe("CANCELLED");
    await start();
    await until(() => broker.readyCount("openrc_jobs") === 0 && broker.unackedCount() === 0);
    expect(runOpenRcProcess).toHaveBeenCalledTimes(1);
  });

  it("keeps the end of a job whose channel closed while it ran, and does not run it again", async () => {
    await start();
    const rejections = watchUnhandledRejections();
    const warned = vi.spyOn(Logger.prototype, "warn");
    let finish: (value: { resultJson: string; workerProcessId: number }) => void = () => undefined;
    runOpenRcProcess.mockImplementationOnce(() => new Promise((done) => (finish = done)));
    await queueJob("cut-off");
    await until(() => runOpenRcProcess.mock.calls.length === 1);
    broker.dropChannel(channel());
    finish({ resultJson: SUCCESS, workerProcessId: 1 });
    await until(async () => (await side.store.done("cut-off")) !== undefined);

    expect(await rejections.stop()).toEqual([]);
    expect(warned.mock.calls).toEqual([[`${WORKER} could not settle an OpenRC job message: Channel closed`]]);
    warned.mockRestore();
    expect(await side.store.done("cut-off")).toMatchObject({ status: "SUCCEEDED", worker: WORKER, error: null });
    expect(await side.store.output("cut-off")).toBe(SUCCESS);
    expect(broker.readyCount("openrc_jobs")).toBe(1);

    await side.module.close();
    await start();
    await until(() => broker.readyCount("openrc_jobs") === 0 && broker.unackedCount() === 0);
    expect(runOpenRcProcess).toHaveBeenCalledTimes(1);
    expect(await side.store.running("cut-off")).toMatchObject({ attempts: 1 });
  });

  it("leaves the process when it loses its job channel, so the broker hands its jobs to another worker", async () => {
    await start();
    runOpenRcProcess.mockImplementation(() => new Promise(() => undefined));
    await queueJob("orphan");
    await until(() => runOpenRcProcess.mock.calls.length === 1);
    expect(broker.unackedCount()).toBe(1);
    await new Promise((wake) => setTimeout(wake, 1_100));
    const before = exit.codes.length;
    exit.clearExitCode();

    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    broker.dropChannel(channel());
    expect(process.exitCode).toBe(1);
    expect(exit.codes).toHaveLength(before);
    vi.advanceTimersByTime(999);
    expect(exit.codes).toHaveLength(before);
    vi.advanceTimersByTime(1);
    expect(exit.codes).toHaveLength(before + 1);
    expect(exit.codes[before]).toBe(1);
    vi.useRealTimers();
    expect(broker.readyCount("openrc_jobs")).toBe(1);
    expect(broker.unackedCount()).toBe(0);
    expect(broker.consumerCount("openrc_jobs")).toBe(0);
    await start();
  });

  it("fails to start when the broker cannot be reached", async () => {
    const unreachable = openRcEngineSide(new FakeBroker(), new FakeMinio(), {}, (rabbit) => {
      rabbit.failConnections = true;
    });
    await expect(unreachable).rejects.toThrow("OpenRcJobConsumerService failed to connect to RabbitMQ broker.");
    await start();
  });
});
