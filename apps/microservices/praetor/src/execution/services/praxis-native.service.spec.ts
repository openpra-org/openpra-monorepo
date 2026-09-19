import { BadRequestException, InternalServerErrorException } from "@nestjs/common";
import { EventEmitter } from "node:events";
import { runPraxisWithWorker, PraxisWorkerError } from "../workers/praxis-worker-runner";
import { PraxisNativeService } from "./praxis-native.service";
vi.mock("../workers/praxis-worker-runner", async (original) => ({
  ...(await original()),
  runPraxisWithWorker: vi.fn(),
}));
const worker = vi.mocked(runPraxisWithWorker);
let service: PraxisNativeService;
beforeEach(() => {
  worker.mockReset();
  service = new PraxisNativeService();
});
it.each(["validate", "execute"] as const)("parses %s responses", async (operation) => {
  worker.mockResolvedValue({ resultJson: '{"schemaVersion":"1.0.0","result":{"ok":true}}', workerProcessId: 7 });
  await expect(service.run(operation, {})).resolves.toHaveProperty("result.ok", true);
  expect(worker).toHaveBeenCalledWith(
    { operation, requestJson: "{}" },
    expect.objectContaining({ timeoutMs: expect.any(Number), signal: expect.any(AbortSignal) }),
  );
});
it("rejects missing requests before starting", async () => {
  await expect(service.run("execute", undefined)).rejects.toBeInstanceOf(BadRequestException);
  expect(worker).not.toHaveBeenCalled();
});
it("preserves negative zero at the worker boundary in both directions", async () => {
  worker.mockResolvedValue({ resultJson: '{"schemaVersion":"1.0.0","result":{"value":-0.0}}', workerProcessId: 7 });
  const response = await service.run("execute", { values: [0, -0] });
  const request = JSON.parse(worker.mock.calls[0]![0].requestJson);
  expect(Object.is(request.values[0], 0)).toBe(true);
  expect(Object.is(request.values[1], -0)).toBe(true);
  expect(Object.is(response.result!.value, -0)).toBe(true);
});
it.each([
  "not-json",
  "[]",
  "null",
  "{}",
  '{"schemaVersion":"2.0.0","result":{}}',
  '{"schemaVersion":"1.0.0","result":{},"error":{}}',
  '{"schemaVersion":"1.0.0","result":null}',
  '{"schemaVersion":"1.0.0","error":{"message":"bad"}}',
])("rejects invalid envelope %s", async (resultJson) => {
  worker.mockResolvedValue({ resultJson, workerProcessId: 7 });
  await expect(service.run("execute", {})).rejects.toBeInstanceOf(InternalServerErrorException);
});
it.each(["PRAXIS_TIMEOUT", "PRAXIS_BUSY", "PRAXIS_CANCELLED"])("preserves %s", async (code) => {
  worker.mockRejectedValue(new PraxisWorkerError(code, "failure"));
  await expect(service.run("execute", {})).resolves.toHaveProperty("error.code", code);
});
it("reports native load failures structurally", async () => {
  worker.mockRejectedValue(new Error("load failed"));
  await expect(service.run("execute", {})).resolves.toHaveProperty("error.code", "PRAXIS_WORKER_FAILURE");
});
it("cancels on HTTP disconnect and removes listeners", async () => {
  const request = Object.assign(new EventEmitter(), { headers: {}, aborted: false });
  const response = Object.assign(new EventEmitter(), { writableEnded: false, destroyed: false });
  worker.mockImplementation(
    (_task, options) =>
      new Promise((_resolve, reject) =>
        options!.signal!.addEventListener("abort", () =>
          reject(new PraxisWorkerError("PRAXIS_CANCELLED", "cancelled")),
        ),
      ),
  );
  const promise = service.run("execute", {}, { request, response } as never);
  response.emit("close");
  await expect(promise).resolves.toHaveProperty("error.code", "PRAXIS_CANCELLED");
  expect(response.listenerCount("close")).toBe(0);
  expect(request.listenerCount("aborted")).toBe(0);
});
it("expires an incoming deadline before spawning", async () => {
  const request = Object.assign(new EventEmitter(), { headers: { "x-praxis-deadline": String(Date.now() - 1) } });
  const response = Object.assign(new EventEmitter(), { writableEnded: false });
  await expect(service.run("execute", {}, { request, response } as never)).resolves.toHaveProperty(
    "error.code",
    "PRAXIS_TIMEOUT",
  );
  expect(worker).not.toHaveBeenCalled();
});
it("cancels active work on shutdown", async () => {
  worker.mockImplementation(
    (_task, options) =>
      new Promise((_resolve, reject) =>
        options!.signal!.addEventListener("abort", () => reject(new PraxisWorkerError("PRAXIS_CANCELLED", "shutdown"))),
      ),
  );
  const promise = service.run("execute", {});
  service.onModuleDestroy();
  await expect(promise).resolves.toHaveProperty("error.code", "PRAXIS_CANCELLED");
});
