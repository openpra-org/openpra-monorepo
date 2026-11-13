import { BadGatewayException } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { praetorJobTimeout, type PraetorJobState, type PraetorJobStatus } from "interfaces-shared-types/execution/praetor-job";
import { analysisRequestSignal } from "../../newly-developed-methods/shared/analysis-cancellation.interceptor";
import { PraetorAnalysisClient } from "../../newly-developed-methods/shared/praetor-analysis.client";
import { PraetorConsequenceClient } from "../praetor-consequence.client";
import { RcWorkbooksModule } from "../rc-workbooks.module";

const JOB_ID = "job-1";
const BASE = "http://praetor.test/q";
const REQUEST = {
  schemaVersion: "1.0.0",
  request: { methodType: "RADIOLOGICAL_CONSEQUENCE", configText: "[run]\ncase_name = café\n", metFileText: "D,3.0\n" },
};
const RESULT = { schemaVersion: "1.0.0", result: { methodType: "RADIOLOGICAL_CONSEQUENCE", console: "", results: { tede_sv: 0.02 } } };
const FINGERPRINT = `sha256:${"a".repeat(64)}`;

function jobState(status: PraetorJobStatus): PraetorJobState {
  return {
    jobId: JOB_ID,
    operation: "execute",
    status,
    submittedAt: "2026-11-12T00:00:00.000Z",
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
    if (method === "POST" && url.endsWith("/openrc/jobs")) return Promise.resolve(jsonResponse(jobState("QUEUED")));
    if (url.endsWith(`/openrc/jobs/${JOB_ID}/result`)) return Promise.resolve(result());
    if (method === "DELETE") return Promise.resolve(jsonResponse(jobState("CANCELLED")));
    return Promise.resolve(jsonResponse(jobState(status)));
  };
}

async function refusal(work: Promise<object | void>): Promise<string> {
  const caught = await work.then(
    () => undefined,
    (error: Error) => error,
  );
  expect(caught).toBeInstanceOf(BadGatewayException);
  return caught instanceof Error ? caught.message : "";
}

const FAILURES: [string, () => Promise<Response>, string][] = [
  ["network failure", () => Promise.reject(new Error("offline")), `PRAETOR could not be reached at ${BASE}: offline`],
  ["network failure without an error object", () => Promise.reject("refused"), `PRAETOR could not be reached at ${BASE}: refused`],
  ["HTTP failure", () => Promise.resolve(new Response("unavailable", { status: 503 })), "PRAETOR refused to accept an OpenRC job (HTTP 503): unavailable"],
  ["HTTP failure without a body", () => Promise.resolve(new Response("", { status: 500 })), "PRAETOR refused to accept an OpenRC job (HTTP 500)"],
  ["invalid JSON", () => Promise.resolve(new Response("not-json", { status: 200 })), "PRAETOR returned invalid JSON while asked to accept an OpenRC job: "],
  ["invalid job state", () => Promise.resolve(new Response(JSON.stringify({ schemaVersion: "1.0.0" }), { status: 200 })), "PRAETOR returned an invalid job state: PRAETOR job state is malformed"],
  ["job state that is a list", () => Promise.resolve(new Response("[]", { status: 200 })), "PRAETOR returned an invalid job state: PRAETOR job state is malformed"],
  ["job state that is a number", () => Promise.resolve(new Response("7", { status: 200 })), "PRAETOR returned an invalid job state: PRAETOR job state is malformed"],
  ["job state that is null", () => Promise.resolve(new Response("null", { status: 200 })), "PRAETOR returned an invalid job state: PRAETOR job state is malformed"],
  [
    "job state with a malformed error",
    () => Promise.resolve(jsonResponse({ ...jobState("FAILED"), error: { code: "OPENRC_TIMEOUT" } })),
    "PRAETOR returned an invalid job state: PRAETOR job error must contain kind, code, message and details",
  ],
];

const INVALID_RESULTS: [string, object, string][] = [
  ["neither result nor error", { schemaVersion: "1.0.0" }, "OpenRC response must contain version 1.0.0 and exactly one of result or error"],
  ["both result and error", { schemaVersion: "1.0.0", result: {}, error: { kind: "k", code: "c", message: "m", details: {} } }, "OpenRC response must contain version 1.0.0 and exactly one of result or error"],
  ["another schema version", { schemaVersion: "2.0.0", result: {} }, "OpenRC response must contain version 1.0.0 and exactly one of result or error"],
  ["an unknown field", { schemaVersion: "1.0.0", result: {}, extra: 1 }, "OpenRC response must contain version 1.0.0 and exactly one of result or error"],
  ["a list", [RESULT], "OpenRC response must contain version 1.0.0 and exactly one of result or error"],
  ["a result that is not an object", { schemaVersion: "1.0.0", result: [1] }, "OpenRC result must be an object"],
  ["an error without details", { schemaVersion: "1.0.0", error: { kind: "SOLVER_ERROR", code: "OPENRC_INVALID_VALUE", message: "bad" } }, "OpenRC error must contain kind, code, message and details"],
  ["the engine identity of another solver", { ...RESULT, engine: { name: "PRAXIS", version: FINGERPRINT } }, "OpenRC engine identity must identify the loaded native binary"],
  ["an engine identity without a binary fingerprint", { ...RESULT, engine: { name: "OPENRC", version: "1.0.0" } }, "OpenRC engine identity must identify the loaded native binary"],
];

describe("PraetorConsequenceClient", () => {
  let client: PraetorConsequenceClient;
  let fetchMock: jest.SpiedFunction<typeof fetch>;
  const previousUrl = process.env["PRAETOR_URL"];
  const previousTimeout = process.env["PRAETOR_JOB_TIMEOUT_MS"];

  function restore(name: string, value: string | undefined): void {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }

  function calls(): string[] {
    return fetchMock.mock.calls.map(([target, init]) => `${init?.method ?? "GET"} ${urlOf(target)}`);
  }

  beforeEach(() => {
    client = new PraetorConsequenceClient();
    fetchMock = jest.spyOn(global, "fetch");
    process.env["PRAETOR_URL"] = `${BASE}/`;
  });

  afterEach(() => {
    fetchMock.mockRestore();
    restore("PRAETOR_URL", previousUrl);
    restore("PRAETOR_JOB_TIMEOUT_MS", previousTimeout);
  });

  it("submits a versioned envelope as an OpenRC job and returns its result", async () => {
    fetchMock.mockImplementation(praetorRoutes(() => jsonResponse(RESULT)));

    await expect(client.execute(REQUEST)).resolves.toEqual(RESULT);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(`${BASE}/openrc/jobs`);
    expect(init).toMatchObject({ method: "POST", headers: { "content-type": "application/json" } });
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    expect(JSON.parse(String(init?.body))).toEqual({ operation: "execute", request: REQUEST, timeoutMs: praetorJobTimeout() });
    expect(calls()).toEqual([`POST ${BASE}/openrc/jobs`, `GET ${BASE}/openrc/jobs/${JOB_ID}`, `GET ${BASE}/openrc/jobs/${JOB_ID}/result`]);
  });

  it("never sends an OpenRC job to the PRAXIS routes", async () => {
    fetchMock.mockImplementation(praetorRoutes(() => jsonResponse(RESULT)));
    await client.execute(REQUEST);
    await client.cancel(JOB_ID);
    expect(calls().some((call) => call.includes("/praxis/"))).toBe(false);
    expect(calls().every((call) => call.includes("/openrc/jobs"))).toBe(true);
  });

  it("keeps the config text and the weather text as they were given", async () => {
    fetchMock.mockImplementation(praetorRoutes(() => jsonResponse(RESULT)));
    const request = {
      schemaVersion: "1.0.0",
      request: { methodType: "RADIOLOGICAL_CONSEQUENCE", configText: "[run]\r\ncase_name = Zürich 100%%\r\n\tx = -0.0\r\n", metFileText: "D,3.0,270,,500\nE,2.1\n" },
    };
    await client.execute(request);
    expect(JSON.parse(String(fetchMock.mock.calls[0]![1]?.body)).request).toEqual(request);
  });

  it("preserves structured solver errors as successful PRAETOR responses", async () => {
    const error = { kind: "SOLVER_ERROR", code: "OPENRC_INVALID_VALUE", message: "[run] mode must be 'lmp' or 'epz', got 'fast'", details: {} };
    fetchMock.mockImplementation(praetorRoutes(() => jsonResponse({ schemaVersion: "1.0.0", error }), "FAILED"));

    await expect(client.execute(REQUEST)).resolves.toEqual({ schemaVersion: "1.0.0", error });
  });

  it("returns the engine identity that PRAETOR adds to a result", async () => {
    const identified = { ...RESULT, engine: { name: "OPENRC", version: FINGERPRINT } };
    fetchMock.mockImplementation(praetorRoutes(() => jsonResponse(identified)));
    await expect(client.execute(REQUEST)).resolves.toEqual(identified);
  });

  it("keeps a negative zero and a number that is not finite as PRAETOR sent them", async () => {
    const body = '{"schemaVersion":"1.0.0","result":{"methodType":"RADIOLOGICAL_CONSEQUENCE","console":"","results":{"tede_sv":-0.0,"epz_distance_m":null,"chi_over_q_s_m3":1e-300}}}';
    fetchMock.mockImplementation(praetorRoutes(() => new Response(body, { status: 200 })));
    const response = await client.execute(REQUEST);
    const results = response.result?.["results"];
    expect(results).toEqual({ tede_sv: -0, epz_distance_m: null, chi_over_q_s_m3: 1e-300 });
    expect(results !== null && typeof results === "object" && !Array.isArray(results) && Object.is(results["tede_sv"], -0)).toBe(true);
  });

  it("sends the job timeout with the submitted job", async () => {
    fetchMock.mockImplementation(praetorRoutes(() => jsonResponse(RESULT)));

    await client.execute(REQUEST, { timeoutMs: 120_000 });

    expect(JSON.parse(String(fetchMock.mock.calls[0]![1]?.body))).toMatchObject({ operation: "execute", timeoutMs: 120_000 });
  });

  it("takes the default job timeout from the PRAETOR setting", async () => {
    process.env["PRAETOR_JOB_TIMEOUT_MS"] = "9000";
    fetchMock.mockImplementation(praetorRoutes(() => jsonResponse(RESULT)));
    await client.submit(REQUEST);
    expect(JSON.parse(String(fetchMock.mock.calls[0]![1]?.body)).timeoutMs).toBe(9000);
  });

  it("sends the job id and the operation that the caller names", async () => {
    fetchMock.mockImplementation(praetorRoutes(() => jsonResponse(RESULT)));
    const state = await client.submit(REQUEST, { jobId: "case-7", operation: "validate", timeoutMs: 5 });
    expect(state).toEqual(jobState("QUEUED"));
    expect(JSON.parse(String(fetchMock.mock.calls[0]![1]?.body))).toEqual({ operation: "validate", request: REQUEST, timeoutMs: 5, jobId: "case-7" });
  });

  it("uses the default PRAETOR address when none is configured", async () => {
    delete process.env["PRAETOR_URL"];
    fetchMock.mockImplementation(praetorRoutes(() => jsonResponse(RESULT)));
    await client.state(JOB_ID);
    expect(calls()).toEqual([`GET http://localhost:3000/q/openrc/jobs/${JOB_ID}`]);
  });

  it("keeps a configured address that has no trailing slash", async () => {
    process.env["PRAETOR_URL"] = "http://other.test/base";
    fetchMock.mockImplementation(praetorRoutes(() => jsonResponse(RESULT)));
    await client.state(JOB_ID);
    expect(calls()).toEqual([`GET http://other.test/base/openrc/jobs/${JOB_ID}`]);
  });

  it("encodes the job id in the state, result and cancel addresses", async () => {
    fetchMock.mockImplementation((input, init) => {
      const url = urlOf(input);
      if (url.endsWith("/result")) return Promise.resolve(jsonResponse(RESULT));
      return Promise.resolve(jsonResponse(init?.method === "DELETE" ? jobState("CANCELLED") : jobState("SUCCEEDED")));
    });
    await client.state("a/b c");
    await client.result("a/b c");
    await client.cancel("a/b c");
    expect(calls()).toEqual([`GET ${BASE}/openrc/jobs/a%2Fb%20c`, `GET ${BASE}/openrc/jobs/a%2Fb%20c/result`, `DELETE ${BASE}/openrc/jobs/a%2Fb%20c`]);
  });

  it("polls a waiting job until it finishes and reports every state it saw", async () => {
    const statuses: PraetorJobStatus[] = ["QUEUED", "RUNNING", "SUCCEEDED"];
    let polls = 0;
    fetchMock.mockImplementation((input, init) => {
      const url = urlOf(input);
      if ((init?.method ?? "GET") === "POST") return Promise.resolve(jsonResponse(jobState("QUEUED")));
      if (url.endsWith("/result")) return Promise.resolve(jsonResponse(RESULT));
      const status = statuses[Math.min(polls, statuses.length - 1)]!;
      polls += 1;
      return Promise.resolve(jsonResponse({ ...jobState(status), attempts: polls }));
    });
    const seen: string[] = [];
    const started = Date.now();
    const response = await client.execute(REQUEST, { onState: (state) => seen.push(`${state.status}:${state.attempts}`) });
    expect(response).toEqual(RESULT);
    expect(seen).toEqual(["QUEUED:1", "RUNNING:2", "SUCCEEDED:3"]);
    expect(Date.now() - started).toBeGreaterThanOrEqual(370);
    expect(calls().filter((call) => call.endsWith("/result"))).toHaveLength(1);
  });

  it("cancels the OpenRC job when the consequence request is cancelled", async () => {
    const controller = new AbortController();
    fetchMock.mockImplementation((_input, init) => {
      const method = init?.method ?? "GET";
      if (method === "POST") return Promise.resolve(jsonResponse(jobState("QUEUED")));
      if (method === "DELETE") return Promise.resolve(jsonResponse(jobState("CANCELLED")));
      controller.abort();
      return Promise.resolve(jsonResponse(jobState("RUNNING")));
    });

    const response = await analysisRequestSignal.run(controller.signal, () => client.execute(REQUEST));

    expect(response).toEqual({
      schemaVersion: "1.0.0",
      error: { kind: "EXECUTION_ERROR", code: "OPENRC_CANCELLED", message: "The consequence request was cancelled.", details: { jobId: JOB_ID } },
    });
    expect(calls()).toEqual([`POST ${BASE}/openrc/jobs`, `GET ${BASE}/openrc/jobs/${JOB_ID}`, `DELETE ${BASE}/openrc/jobs/${JOB_ID}`]);
  });

  it("stops waiting at once when the request is cancelled during a pause", async () => {
    const controller = new AbortController();
    fetchMock.mockImplementation((_input, init) => {
      const method = init?.method ?? "GET";
      if (method === "DELETE") return Promise.resolve(jsonResponse(jobState("CANCELLED")));
      return Promise.resolve(jsonResponse(jobState("RUNNING")));
    });
    const started = Date.now();
    const pending = client.wait(JOB_ID, {}, controller.signal);
    setTimeout(() => controller.abort(), 20);
    const response = await pending;
    expect(response.error?.code).toBe("OPENRC_CANCELLED");
    expect(Date.now() - started).toBeLessThan(140);
    expect(calls().filter((call) => call.startsWith("DELETE"))).toHaveLength(1);
  });

  it("is provided and exported by the RC workbooks module", async () => {
    expect(Reflect.getMetadata("providers", RcWorkbooksModule)).toContain(PraetorConsequenceClient);
    expect(Reflect.getMetadata("exports", RcWorkbooksModule)).toContain(PraetorConsequenceClient);
    const moduleRef = await Test.createTestingModule({ providers: [PraetorConsequenceClient, PraetorAnalysisClient] }).compile();
    expect(moduleRef.get(PraetorConsequenceClient)).toBeInstanceOf(PraetorConsequenceClient);
    expect(moduleRef.get(PraetorConsequenceClient)).not.toBe(moduleRef.get(PraetorAnalysisClient));
    await moduleRef.close();
  });

  it("returns a finished job even when its request was cancelled, and keeps a cancel inside its own request", async () => {
    const other = new AbortController();
    other.abort();
    fetchMock.mockImplementation(praetorRoutes(() => jsonResponse(RESULT)));
    const [cancelledRun, plainRun] = await Promise.all([
      analysisRequestSignal.run(other.signal, () => client.wait(JOB_ID, {}, analysisRequestSignal.getStore())),
      client.execute(REQUEST),
    ]);
    expect(cancelledRun).toEqual(RESULT);
    expect(plainRun).toEqual(RESULT);
  });

  it("reports a job that PRAETOR cancelled without asking for its result", async () => {
    fetchMock.mockImplementation(praetorRoutes(() => jsonResponse(RESULT), "CANCELLED"));
    await expect(client.execute(REQUEST)).resolves.toEqual({
      schemaVersion: "1.0.0",
      error: { kind: "EXECUTION_ERROR", code: "OPENRC_CANCELLED", message: "The OpenRC job was cancelled.", details: { jobId: JOB_ID } },
    });
    expect(calls().some((call) => call.endsWith("/result"))).toBe(false);
  });

  it("treats a job that PRAETOR no longer knows as already cancelled", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(new Response("gone", { status: 404 })));
    await expect(client.cancel(JOB_ID)).resolves.toBeUndefined();
  });

  it("reports a cancel that PRAETOR refuses", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(new Response("busy", { status: 500 })));
    expect(await refusal(client.cancel(JOB_ID))).toBe(`PRAETOR could not cancel OpenRC job ${JOB_ID} (HTTP 500): busy`);
    fetchMock.mockImplementation(() => Promise.resolve(new Response("", { status: 503 })));
    expect(await refusal(client.cancel(JOB_ID))).toBe(`PRAETOR could not cancel OpenRC job ${JOB_ID} (HTTP 503)`);
  });

  it("reports a state or a result that PRAETOR refuses with what was asked", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(new Response("missing", { status: 404 })));
    expect(await refusal(client.state(JOB_ID))).toBe(`PRAETOR refused to report OpenRC job ${JOB_ID} (HTTP 404): missing`);
    expect(await refusal(client.result(JOB_ID))).toBe(`PRAETOR refused to return the result of OpenRC job ${JOB_ID} (HTTP 404): missing`);
    fetchMock.mockImplementation(() => Promise.resolve(new Response("{", { status: 200 })));
    expect(await refusal(client.result(JOB_ID))).toContain(`PRAETOR returned invalid JSON while asked to return the result of OpenRC job ${JOB_ID}: `);
  });

  it.each(INVALID_RESULTS)("maps an OpenRC result with %s to a bad gateway error", async (_case, body, reason) => {
    fetchMock.mockImplementation(praetorRoutes(() => jsonResponse(body)));

    expect(await refusal(client.execute(REQUEST))).toBe(`PRAETOR returned an invalid native solver response: ${reason}`);
  });

  it.each(FAILURES)("maps %s to a bad gateway error", async (_case, responseFactory, message) => {
    fetchMock.mockImplementation(responseFactory);

    const text = await refusal(client.execute(REQUEST));
    expect(text.startsWith(message)).toBe(true);
    if (!message.endsWith(": ")) expect(text).toBe(message);
  });
});
