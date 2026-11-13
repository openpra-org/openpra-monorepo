import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NATIVE_DEADLINE_HEADER } from "praxis-node/protocol";

import { ExecuteController } from "./execute.controller";
import { ExecuteProducerService } from "../services/execute-producer.service";
import { ExecuteStorageService } from "../services/execute-storage.service";
import { PraxisJobsService } from "../services/praxis-jobs.service";
import { OpenRcJobsService } from "../services/openrc-jobs.service";

const STATE = {
  jobId: "job-1",
  operation: "execute",
  status: "QUEUED",
  submittedAt: "2026-10-16T00:00:00.000Z",
  startedAt: null,
  completedAt: null,
  worker: null,
  attempts: 0,
  queuedJobs: 1,
  workers: 4,
  error: null,
};

describe("ExecuteController PRAXIS API", () => {
  let app: INestApplication;
  const jobs = { run: vi.fn(), submit: vi.fn(), state: vi.fn(), result: vi.fn(), cancel: vi.fn() };

  beforeEach(async () => {
    for (const mock of Object.values(jobs)) mock.mockReset();
    const module = await Test.createTestingModule({
      controllers: [ExecuteController],
      providers: [
        { provide: ExecuteProducerService, useValue: {} },
        { provide: ExecuteStorageService, useValue: {} },
        { provide: PraxisJobsService, useValue: jobs },
        { provide: OpenRcJobsService, useValue: {} },
      ],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it.each(["validate", "execute"] as const)("runs POST /praxis/native/%s as a PRAXIS job and waits for it", async (operation) => {
    jobs.run.mockResolvedValue({ schemaVersion: "1.0.0", result: { valid: true } });
    const body = { schemaVersion: "1.0.0", request: {}, modelSnapshots: [] };

    const response = await request(app.getHttpServer()).post(`/praxis/native/${operation}`).send(body).expect(200);

    expect(response.body).toEqual({ schemaVersion: "1.0.0", result: { valid: true } });
    expect(jobs.run).toHaveBeenCalledWith(operation, body, undefined, expect.any(AbortSignal));
  });

  it("passes the request deadline and refuses a malformed one", async () => {
    jobs.run.mockResolvedValue({ schemaVersion: "1.0.0", result: {} });
    const deadline = Date.now() + 60_000;

    await request(app.getHttpServer()).post("/praxis/native/execute").set(NATIVE_DEADLINE_HEADER, String(deadline)).send({}).expect(200);
    expect(jobs.run).toHaveBeenCalledWith("execute", {}, deadline, expect.any(AbortSignal));

    jobs.run.mockClear();
    await request(app.getHttpServer()).post("/praxis/native/execute").set(NATIVE_DEADLINE_HEADER, "soon").send({}).expect(400);
    expect(jobs.run).not.toHaveBeenCalled();
  });

  it("submits, reports, returns and cancels PRAXIS jobs", async () => {
    jobs.submit.mockResolvedValue(STATE);
    jobs.state.mockResolvedValue({ ...STATE, status: "SUCCEEDED" });
    jobs.result.mockResolvedValue({ schemaVersion: "1.0.0", result: { probability: 0.02 } });
    jobs.cancel.mockResolvedValue({ ...STATE, status: "CANCELLED" });
    const server = app.getHttpServer();
    const body = { operation: "execute", request: { schemaVersion: "1.0.0" }, timeoutMs: 60_000 };

    expect((await request(server).post("/praxis/jobs").send(body).expect(202)).body).toEqual(STATE);
    expect(jobs.submit).toHaveBeenCalledWith(body);
    expect((await request(server).get("/praxis/jobs/job-1").expect(200)).body).toMatchObject({ status: "SUCCEEDED" });
    expect(jobs.state).toHaveBeenCalledWith("job-1");
    expect((await request(server).get("/praxis/jobs/job-1/result").expect(200)).body).toEqual({ schemaVersion: "1.0.0", result: { probability: 0.02 } });
    expect(jobs.result).toHaveBeenCalledWith("job-1");
    expect((await request(server).delete("/praxis/jobs/job-1").expect(200)).body).toMatchObject({ status: "CANCELLED" });
    expect(jobs.cancel).toHaveBeenCalledWith("job-1");
  });
});

describe("ExecuteController OpenRC API", () => {
  const OPENRC_DEADLINE_HEADER = "x-openrc-deadline";
  let app: INestApplication;
  const jobs = { run: vi.fn(), submit: vi.fn(), state: vi.fn(), result: vi.fn(), cancel: vi.fn() };
  const praxisJobs = { run: vi.fn(), submit: vi.fn(), state: vi.fn(), result: vi.fn(), cancel: vi.fn() };
  const envelope = { schemaVersion: "1.0.0", request: { methodType: "RADIOLOGICAL_CONSEQUENCE", configText: "[run]\n" } };

  beforeEach(async () => {
    for (const mock of [...Object.values(jobs), ...Object.values(praxisJobs)]) mock.mockReset();
    const module = await Test.createTestingModule({
      controllers: [ExecuteController],
      providers: [
        { provide: ExecuteProducerService, useValue: {} },
        { provide: ExecuteStorageService, useValue: {} },
        { provide: PraxisJobsService, useValue: praxisJobs },
        { provide: OpenRcJobsService, useValue: jobs },
      ],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it.each(["validate", "execute"] as const)("runs POST /openrc/native/%s as an OpenRC job and waits for it", async (operation) => {
    jobs.run.mockResolvedValue({ schemaVersion: "1.0.0", result: { valid: true } });

    const response = await request(app.getHttpServer()).post(`/openrc/native/${operation}`).send(envelope).expect(200);

    expect(response.body).toEqual({ schemaVersion: "1.0.0", result: { valid: true } });
    expect(jobs.run).toHaveBeenCalledWith(operation, envelope, undefined, expect.any(AbortSignal));
    expect(praxisJobs.run).not.toHaveBeenCalled();
  });

  it("passes the OpenRC request deadline and refuses a malformed one", async () => {
    jobs.run.mockResolvedValue({ schemaVersion: "1.0.0", result: {} });
    const deadline = Date.now() + 60_000;

    await request(app.getHttpServer()).post("/openrc/native/execute").set(OPENRC_DEADLINE_HEADER, String(deadline)).send(envelope).expect(200);
    expect(jobs.run).toHaveBeenCalledWith("execute", envelope, deadline, expect.any(AbortSignal));

    for (const malformed of ["soon", "-5", "1.5", "1e3", "99999999999999999999", "0x10"]) {
      jobs.run.mockClear();
      const refused = await request(app.getHttpServer()).post("/openrc/native/validate").set(OPENRC_DEADLINE_HEADER, malformed).send(envelope).expect(400);
      expect(refused.body.message).toBe("Invalid OpenRC execution deadline");
      expect(jobs.run).not.toHaveBeenCalled();
    }
  });

  it("reads only its own deadline header", async () => {
    jobs.run.mockResolvedValue({ schemaVersion: "1.0.0", result: {} });
    praxisJobs.run.mockResolvedValue({ schemaVersion: "1.0.0", result: {} });
    const deadline = Date.now() + 60_000;

    await request(app.getHttpServer()).post("/openrc/native/execute").set(NATIVE_DEADLINE_HEADER, String(deadline)).send(envelope).expect(200);
    expect(jobs.run).toHaveBeenCalledWith("execute", envelope, undefined, expect.any(AbortSignal));
    await request(app.getHttpServer()).post("/openrc/native/execute").set(NATIVE_DEADLINE_HEADER, "soon").send(envelope).expect(200);

    await request(app.getHttpServer()).post("/praxis/native/execute").set(OPENRC_DEADLINE_HEADER, "soon").send({}).expect(200);
    expect(praxisJobs.run).toHaveBeenCalledWith("execute", {}, undefined, expect.any(AbortSignal));
    expect(OPENRC_DEADLINE_HEADER).not.toBe(NATIVE_DEADLINE_HEADER);
  });

  it("refuses a native request whose body is not an object", async () => {
    for (const body of [[envelope], []]) {
      const refused = await request(app.getHttpServer()).post("/openrc/native/execute").send(body).expect(400);
      expect(refused.body.message).toBe("A versioned OpenRC request body is required.");
    }
    expect(jobs.run).not.toHaveBeenCalled();
  });

  it("submits, reports, returns and cancels OpenRC jobs", async () => {
    jobs.submit.mockResolvedValue(STATE);
    jobs.state.mockResolvedValue({ ...STATE, status: "SUCCEEDED" });
    jobs.result.mockResolvedValue({ schemaVersion: "1.0.0", result: { results: { tede_sv: 0.5 } } });
    jobs.cancel.mockResolvedValue({ ...STATE, status: "CANCELLED" });
    const server = app.getHttpServer();
    const body = { operation: "execute", request: envelope, timeoutMs: 60_000 };

    expect((await request(server).post("/openrc/jobs").send(body).expect(202)).body).toEqual(STATE);
    expect(jobs.submit).toHaveBeenCalledWith(body);
    expect((await request(server).get("/openrc/jobs/job-1").expect(200)).body).toMatchObject({ status: "SUCCEEDED" });
    expect(jobs.state).toHaveBeenCalledWith("job-1");
    expect((await request(server).get("/openrc/jobs/job-1/result").expect(200)).body).toEqual({ schemaVersion: "1.0.0", result: { results: { tede_sv: 0.5 } } });
    expect(jobs.result).toHaveBeenCalledWith("job-1");
    expect((await request(server).delete("/openrc/jobs/job-1").expect(200)).body).toMatchObject({ status: "CANCELLED" });
    expect(jobs.cancel).toHaveBeenCalledWith("job-1");
    for (const mock of Object.values(praxisJobs)) expect(mock).not.toHaveBeenCalled();
  });

  it("keeps the PRAXIS job routes on the PRAXIS service", async () => {
    praxisJobs.submit.mockResolvedValue(STATE);
    praxisJobs.state.mockResolvedValue(STATE);
    const server = app.getHttpServer();
    await request(server).post("/praxis/jobs").send({ operation: "execute", request: {} }).expect(202);
    await request(server).get("/praxis/jobs/job-1").expect(200);
    expect(praxisJobs.submit).toHaveBeenCalledTimes(1);
    expect(praxisJobs.state).toHaveBeenCalledWith("job-1");
    for (const mock of Object.values(jobs)) expect(mock).not.toHaveBeenCalled();
  });

  it("passes on the HTTP status of a job that is unknown, unfinished or malformed", async () => {
    const { BadRequestException, ConflictException, NotFoundException } = await import("@nestjs/common");
    jobs.state.mockRejectedValue(new NotFoundException("OpenRC job nobody was not found."));
    jobs.result.mockRejectedValue(new ConflictException("OpenRC job job-1 is running."));
    jobs.submit.mockRejectedValue(new BadRequestException("An OpenRC job operation is execute or validate."));
    jobs.cancel.mockRejectedValue(new BadRequestException("Invalid OpenRC job id."));
    const server = app.getHttpServer();

    expect((await request(server).get("/openrc/jobs/nobody").expect(404)).body.message).toBe("OpenRC job nobody was not found.");
    expect((await request(server).get("/openrc/jobs/job-1/result").expect(409)).body.message).toBe("OpenRC job job-1 is running.");
    expect((await request(server).post("/openrc/jobs").send({ operation: "preflight" }).expect(400)).body.message).toBe("An OpenRC job operation is execute or validate.");
    expect((await request(server).delete("/openrc/jobs/bad%20id").expect(400)).body.message).toBe("Invalid OpenRC job id.");
    expect(jobs.cancel).toHaveBeenCalledWith("bad id");
  });

  it("tells the job service when the client leaves before the answer", async () => {
    let seen: AbortSignal | undefined;
    jobs.run.mockImplementation(
      (_operation: string, _request: object, _deadline: number | undefined, signal: AbortSignal) =>
        new Promise((done) => {
          seen = signal;
          signal.addEventListener("abort", () => done({ schemaVersion: "1.0.0", result: {} }));
        }),
    );
    await app.listen(0, "127.0.0.1");
    const { port } = app.getHttpServer().address();
    const controller = new AbortController();
    const pending = fetch(`http://127.0.0.1:${port}/openrc/native/execute`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(envelope),
      signal: controller.signal,
    }).catch((error: Error) => error);
    await vi.waitFor(() => expect(seen).toBeDefined());
    expect(seen?.aborted).toBe(false);
    controller.abort();
    await pending;
    await vi.waitFor(() => expect(seen?.aborted).toBe(true));
  });
});
