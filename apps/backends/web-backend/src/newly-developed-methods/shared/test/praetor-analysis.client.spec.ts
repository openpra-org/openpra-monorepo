import { analysisRequestSignal } from "../analysis-cancellation.interceptor";
import { BadGatewayException } from "@nestjs/common";
import { PraetorAnalysisClient } from "../praetor-analysis.client";

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

  it("posts a versioned envelope to the native execute endpoint", async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ schemaVersion: "1.0.0", result: { probability: 0.02 } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    const request = { schemaVersion: "1.0.0", request: {}, modelSnapshots: [] };

    await expect(client.execute(request)).resolves.toEqual({
      schemaVersion: "1.0.0",
      result: { probability: 0.02 },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "http://praetor.test/q/praxis/native/execute",
      expect.objectContaining({ method: "POST", body: JSON.stringify(request) }),
    );
  });

  it("preserves structured solver errors as successful Praetor responses", async () => {
    const error = {
      kind: "SOLVER_ERROR",
      code: "PRAXIS_LOGIC",
      message: "Invalid gate",
      details: { gateId: "G-1" },
    };
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ schemaVersion: "1.0.0", error }), { status: 200 }));

    await expect(client.execute({})).resolves.toEqual({ schemaVersion: "1.0.0", error });
  });

  it.each([
    ["network failure", () => Promise.reject(new Error("offline"))],
    ["HTTP failure", () => Promise.resolve(new Response("unavailable", { status: 503 }))],
    ["invalid JSON", () => Promise.resolve(new Response("not-json", { status: 200 }))],
    [
      "invalid response",
      () => Promise.resolve(new Response(JSON.stringify({ schemaVersion: "1.0.0" }), { status: 200 })),
    ],
  ])("maps %s to a bad gateway error", async (_case, responseFactory) => {
    fetchMock.mockImplementation(responseFactory as never);

    await expect(client.execute({})).rejects.toBeInstanceOf(BadGatewayException);
  });
});

it("propagates request cancellation to fetch and preserves its failure code", async () => {
  const controller = new AbortController();
  const fetchSpy = jest.spyOn(global, "fetch").mockImplementation(
    (_url, init) =>
      new Promise((_resolve, reject) => {
        init!.signal!.addEventListener("abort", () => reject(new Error("aborted")));
      }),
  );
  try {
    const pending = analysisRequestSignal.run(controller.signal, () => new PraetorAnalysisClient().execute({}));
    controller.abort();
    await expect(pending).resolves.toHaveProperty("error.code", "PRAXIS_CANCELLED");
    expect(fetchSpy.mock.calls[0][1]?.signal?.aborted).toBe(true);
  } finally {
    fetchSpy.mockRestore();
  }
});
it("sends an absolute worker deadline before the transport timeout", async () => {
  const fetchSpy = jest
    .spyOn(global, "fetch")
    .mockResolvedValue(new Response(JSON.stringify({ schemaVersion: "1.0.0", result: {} })));
  const before = Date.now();
  try {
    await new PraetorAnalysisClient().execute({});
    const headers = fetchSpy.mock.calls[0][1]!.headers as Record<string, string>;
    expect(Number(headers["x-praxis-deadline"])).toBeGreaterThan(before);
    expect(Number(headers["x-praxis-deadline"])).toBeLessThanOrEqual(Date.now() + 300000);
  } finally {
    fetchSpy.mockRestore();
  }
});
