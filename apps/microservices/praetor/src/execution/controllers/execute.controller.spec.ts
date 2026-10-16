import { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NATIVE_DEADLINE_HEADER } from "praxis-node/protocol";

import { ExecuteController } from "./execute.controller";
import { ExecuteProducerService } from "../services/execute-producer.service";
import { ExecuteStorageService } from "../services/execute-storage.service";
import { PraxisJobsService } from "../services/praxis-jobs.service";

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
