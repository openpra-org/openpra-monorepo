import { analysisRequestSignal } from "../analysis-cancellation.interceptor";
import { BadGatewayException } from "@nestjs/common";
import { praetorJobTimeout, type PraetorJobStatus } from "interfaces-shared-types/execution/praetor-job";
import { PraetorAnalysisClient } from "../praetor-analysis.client";

const JOB_ID = "job-1";

function jobState(status: PraetorJobStatus): object {
  return {
    jobId: JOB_ID,
    operation: "execute",
    status,
    submittedAt: "2026-10-16T00:00:00.000Z",
    startedAt: null,
    completedAt: null,
    worker: null,
    attempts: 0,
    queuedJobs: 0,
    workers: 1,
    error: null,
  };
}

function jsonResponse(body: object, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function urlOf(input: string | URL | Request): string {
  if (typeof input === "string") return input;
  return input instanceof URL ? input.href : input.url;
}

function praetorRoutes(result: () => Response, status: PraetorJobStatus = "SUCCEEDED"): (input: string | URL | Request, init?: RequestInit) => Promise<Response> {
  return (input, init) => {
    const url = urlOf(input);
    const method = init?.method ?? "GET";
    if (method === "POST" && url.endsWith("/praxis/jobs")) return Promise.resolve(jsonResponse(jobState("QUEUED")));
    if (url.endsWith(`/praxis/jobs/${JOB_ID}/result`)) return Promise.resolve(result());
    if (method === "DELETE") return Promise.resolve(jsonResponse(jobState("CANCELLED")));
    return Promise.resolve(jsonResponse(jobState(status)));
  };
}

const FAILURES: [string, () => Promise<Response>][] = [
  ["network failure", () => Promise.reject(new Error("offline"))],
  ["HTTP failure", () => Promise.resolve(new Response("unavailable", { status: 503 }))],
  ["invalid JSON", () => Promise.resolve(new Response("not-json", { status: 200 }))],
  ["invalid job state", () => Promise.resolve(new Response(JSON.stringify({ schemaVersion: "1.0.0" }), { status: 200 }))],
];

describe("PraetorAnalysisClient", () => {
  let client: PraetorAnalysisClient;
  let fetchMock: jest.SpiedFunction<typeof fetch>;
  const previousUrl = process.env["PRAETOR_URL"];

  beforeEach(() => {
    client = new PraetorAnalysisClient();
    fetchMock = jest.spyOn(global, "fetch");
    process.env["PRAETOR_URL"] = "http://praetor.test/q/";
  });

  afterEach(() => {
    fetchMock.mockRestore();
    if (previousUrl === undefined) delete process.env["PRAETOR_URL"];
    else process.env["PRAETOR_URL"] = previousUrl;
  });

  it("submits a versioned envelope as a PRAXIS job and returns its result", async () => {
    fetchMock.mockImplementation(praetorRoutes(() => jsonResponse({ schemaVersion: "1.0.0", result: { probability: 0.02 } })));
    const request = { schemaVersion: "1.0.0", request: {}, modelSnapshots: [] };

    await expect(client.execute(request)).resolves.toEqual({
      schemaVersion: "1.0.0",
      result: { probability: 0.02 },
    });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("http://praetor.test/q/praxis/jobs");
    expect(init).toMatchObject({ method: "POST" });
    expect(JSON.parse(String(init?.body))).toEqual({ operation: "execute", request, timeoutMs: praetorJobTimeout() });
    expect(fetchMock.mock.calls.map(([target]) => urlOf(target))).toEqual([
      "http://praetor.test/q/praxis/jobs",
      `http://praetor.test/q/praxis/jobs/${JOB_ID}`,
      `http://praetor.test/q/praxis/jobs/${JOB_ID}/result`,
    ]);
  });

  it("preserves structured solver errors as successful Praetor responses", async () => {
    const error = {
      kind: "SOLVER_ERROR",
      code: "PRAXIS_LOGIC",
      message: "Invalid gate",
      details: { gateId: "G-1" },
    };
    fetchMock.mockImplementation(praetorRoutes(() => jsonResponse({ schemaVersion: "1.0.0", error }), "FAILED"));

    await expect(client.execute({})).resolves.toEqual({ schemaVersion: "1.0.0", error });
  });

  it("sends the job timeout with the submitted job", async () => {
    fetchMock.mockImplementation(praetorRoutes(() => jsonResponse({ schemaVersion: "1.0.0", result: {} })));

    await client.execute({}, { timeoutMs: 120_000 });

    expect(JSON.parse(String(fetchMock.mock.calls[0]![1]?.body))).toMatchObject({ operation: "execute", timeoutMs: 120_000 });
  });

  it("cancels the PRAXIS job when the analysis request is cancelled", async () => {
    const controller = new AbortController();
    const calls: string[] = [];
    fetchMock.mockImplementation((input, init) => {
      const method = init?.method ?? "GET";
      calls.push(`${method} ${urlOf(input)}`);
      if (method === "POST") return Promise.resolve(jsonResponse(jobState("QUEUED")));
      if (method === "DELETE") return Promise.resolve(jsonResponse(jobState("CANCELLED")));
      controller.abort();
      return Promise.resolve(jsonResponse(jobState("RUNNING")));
    });

    const response = await analysisRequestSignal.run(controller.signal, () => client.execute({}));

    expect(response).toHaveProperty("error.code", "PRAXIS_CANCELLED");
    expect(calls).toContain(`DELETE http://praetor.test/q/praxis/jobs/${JOB_ID}`);
  });

  it("maps an invalid PRAXIS result to a bad gateway error", async () => {
    fetchMock.mockImplementation(praetorRoutes(() => jsonResponse({ schemaVersion: "1.0.0" })));

    await expect(client.execute({})).rejects.toBeInstanceOf(BadGatewayException);
  });

  it.each(FAILURES)("maps %s to a bad gateway error", async (_case, responseFactory) => {
    fetchMock.mockImplementation(responseFactory);

    await expect(client.execute({})).rejects.toBeInstanceOf(BadGatewayException);
  });
});
