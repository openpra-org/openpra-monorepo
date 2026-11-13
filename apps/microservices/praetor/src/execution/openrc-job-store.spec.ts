import { beforeEach, describe, expect, it } from "vitest";
import { Test } from "@nestjs/testing";
import { FakeMinio } from "../../test/fake-minio";
import { MinioService } from "../shared";
import { OpenRcJobStore } from "./openrc-job-store";

describe("OpenRcJobStore", () => {
  let minio: FakeMinio;
  let store: OpenRcJobStore;

  beforeEach(async () => {
    minio = new FakeMinio();
    const module = await Test.createTestingModule({
      providers: [OpenRcJobStore, { provide: MinioService, useValue: minio }],
    }).compile();
    store = module.get(OpenRcJobStore);
  });

  it("keeps each record of a job under its own OpenRC object name", async () => {
    const request = { schemaVersion: "1.0.0", request: { methodType: "RADIOLOGICAL_CONSEQUENCE", configText: "[run]\n" } };
    await store.putInput("job-1", { operation: "execute", request, timeoutMs: 5000 });
    await store.putSubmission({ jobId: "job-1", operation: "execute", submittedAt: "2026-11-12T00:00:00.000Z", timeoutMs: 5000 });
    await store.putRunning("job-1", { worker: "host:1", startedAt: "a", heartbeatAt: "b", attempts: 1 });
    await store.putCancel("job-1", { requestedAt: "c" });
    await store.putDone("job-1", { status: "SUCCEEDED", completedAt: "d", worker: "host:1", error: null });
    await store.putOutput("job-1", '{"schemaVersion":"1.0.0","result":{}}');

    expect(minio.names()).toEqual([
      "input/openrc-input-job-1.json",
      "jobs/openrc-job-job-1.cancel.json",
      "jobs/openrc-job-job-1.done.json",
      "jobs/openrc-job-job-1.json",
      "jobs/openrc-job-job-1.running.json",
      "output/openrc-output-job-1.json",
    ]);
    expect(minio.names().some((name) => name.includes("praxis"))).toBe(false);
  });

  it("returns what was stored", async () => {
    const request = { schemaVersion: "1.0.0", request: { methodType: "RADIOLOGICAL_CONSEQUENCE", configText: "café χ\n", metFileText: "D,3.0\n" } };
    const submission = { jobId: "job-2", operation: "validate" as const, submittedAt: "2026-11-12T00:00:00.000Z", timeoutMs: 7 };
    const running = { worker: "host:2", startedAt: "s", heartbeatAt: "h", attempts: 2 };
    const done = {
      status: "FAILED" as const,
      completedAt: "c",
      worker: "host:2",
      error: { kind: "SOLVER_ERROR", code: "OPENRC_INVALID_VALUE", message: "bad", details: {} },
    };
    await store.putInput("job-2", { operation: "validate", request, timeoutMs: 7 });
    await store.putSubmission(submission);
    await store.putRunning("job-2", running);
    await store.putCancel("job-2", { requestedAt: "r" });
    await store.putDone("job-2", done);
    await store.putOutput("job-2", "exact text – not parsed");

    expect(await store.input("job-2")).toEqual({ operation: "validate", request, timeoutMs: 7 });
    expect(await store.submission("job-2")).toEqual(submission);
    expect(await store.running("job-2")).toEqual(running);
    expect(await store.cancel("job-2")).toEqual({ requestedAt: "r" });
    expect(await store.done("job-2")).toEqual(done);
    expect(await store.output("job-2")).toBe("exact text – not parsed");
  });

  it("answers undefined for every record of a job it does not know", async () => {
    expect(await store.input("absent")).toBeUndefined();
    expect(await store.submission("absent")).toBeUndefined();
    expect(await store.running("absent")).toBeUndefined();
    expect(await store.cancel("absent")).toBeUndefined();
    expect(await store.done("absent")).toBeUndefined();
    expect(await store.output("absent")).toBeUndefined();
  });

  it("keeps the jobs of two ids apart and lets a later record replace an earlier one", async () => {
    await store.putRunning("a", { worker: "w", startedAt: "s", heartbeatAt: "h1", attempts: 1 });
    await store.putRunning("b", { worker: "w", startedAt: "s", heartbeatAt: "other", attempts: 5 });
    await store.putRunning("a", { worker: "w", startedAt: "s", heartbeatAt: "h2", attempts: 1 });
    expect((await store.running("a"))?.heartbeatAt).toBe("h2");
    expect((await store.running("b"))?.attempts).toBe(5);
  });

  it("stores the request text of an input without losing a negative zero", async () => {
    await store.putInput("zero", { operation: "execute", request: { value: -0, text: "-0" }, timeoutMs: 1 });
    expect(minio.text("input", "openrc-input-zero.json")).toBe('{"operation":"execute","request":{"value":-0.0,"text":"-0"},"timeoutMs":1}');
  });

  it("passes storage failures on", async () => {
    minio.failWrites = (name) => name.endsWith(".done.json");
    await expect(store.putDone("job-3", { status: "CANCELLED", completedAt: "c", worker: null, error: null })).rejects.toThrow("storage refused");
    minio.failReads = (name) => name.startsWith("openrc-output-");
    await expect(store.output("job-3")).rejects.toThrow("storage refused");
  });
});
