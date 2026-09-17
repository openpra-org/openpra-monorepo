import { EventEmitter } from "node:events";
import { spawn } from "node:child_process";
import { runPraxisWithWorker } from "./praxis-worker-runner";

vi.mock("node:child_process", () => ({ spawn: vi.fn() }));
const task = { operation: "execute" as const, requestJson: "{}" };
const options = { addonPath: "addon", workerPath: "worker", timeoutMs: 100, maxConcurrent: 1 };
function worker() {
  return Object.assign(new EventEmitter(), {
    pid: 7,
    kill: vi.fn(() => true),
    send: vi.fn((_data, callback) => callback(null)),
  });
}
let child: ReturnType<typeof worker>;
beforeEach(() => {
  vi.useFakeTimers();
  child = worker();
  vi.mocked(spawn).mockReturnValue(child as never);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
  vi.clearAllMocks();
});

it("passes the configured heap to the worker and allows an internal override", async () => {
  vi.stubEnv("PRAETOR_NATIVE_HEAP_MB", "4096");
  const configured = runPraxisWithWorker(task, options);
  expect(spawn).toHaveBeenLastCalledWith(process.execPath, ["--max-old-space-size=4096", "worker"], expect.anything());
  child.emit("message", { resultJson: "{}" });
  child.emit("close", 0, null);
  await configured;
  child = worker();
  vi.mocked(spawn).mockReturnValue(child as never);
  const overridden = runPraxisWithWorker(task, { ...options, heapLimitMb: 1024 });
  expect(spawn).toHaveBeenLastCalledWith(process.execPath, ["--max-old-space-size=1024", "worker"], expect.anything());
  child.emit("message", { resultJson: "{}" });
  child.emit("close", 0, null);
  await overridden;
});

it.each([0, -1, 1.5, NaN, Infinity])("rejects invalid heap budget %s before spawning", (heapLimitMb) => {
  expect(() => runPraxisWithWorker(task, { ...options, heapLimitMb })).toThrow("PRAETOR_NATIVE_HEAP_MB");
  expect(spawn).not.toHaveBeenCalled();
});

it("uses a hidden process and holds capacity until the process exits", async () => {
  const first = runPraxisWithWorker(task, options);
  child.emit("message", { resultJson: "{}" });
  expect(spawn).toHaveBeenCalledWith(
    process.execPath,
    ["worker"],
    expect.objectContaining({ windowsHide: true, shell: false }),
  );
  expect(child.kill).toHaveBeenCalledWith("SIGKILL");
  await expect(runPraxisWithWorker(task, options)).rejects.toMatchObject({ code: "PRAXIS_BUSY" });
  child.emit("close", 0, null);
  await expect(first).resolves.toEqual({ resultJson: "{}", workerProcessId: 7 });
  const nextChild = worker();
  vi.mocked(spawn).mockReturnValue(nextChild as never);
  const next = runPraxisWithWorker(task, options);
  nextChild.emit("message", { resultJson: "{}" });
  nextChild.emit("close", 0, null);
  await expect(next).resolves.toHaveProperty("workerProcessId", 7);
});

it("kills a timed-out process before releasing its slot", async () => {
  const promise = runPraxisWithWorker(task, options);
  const check = expect(promise).rejects.toMatchObject({ code: "PRAXIS_TIMEOUT" });
  await vi.advanceTimersByTimeAsync(100);
  expect(child.kill).toHaveBeenCalledWith("SIGKILL");
  child.emit("close", null, "SIGKILL");
  await check;
});
it("cancels an active process and removes abort listeners after exit", async () => {
  const controller = new AbortController();
  const promise = runPraxisWithWorker(task, { ...options, signal: controller.signal });
  const check = expect(promise).rejects.toMatchObject({ code: "PRAXIS_CANCELLED" });
  controller.abort();
  expect(child.kill).toHaveBeenCalledTimes(1);
  child.emit("close", null, "SIGKILL");
  await check;
  expect(vi.getTimerCount()).toBe(0);
});
it("does not start an already-cancelled request", async () => {
  await expect(runPraxisWithWorker(task, { ...options, signal: AbortSignal.abort() })).rejects.toMatchObject({
    code: "PRAXIS_CANCELLED",
  });
  expect(spawn).not.toHaveBeenCalled();
});
it.each([null, [], {}, { resultJson: 2 }, { resultJson: "{}", error: "failure" }])(
  "rejects invalid IPC %#",
  async (message) => {
    const promise = runPraxisWithWorker(task, options);
    const check = expect(promise).rejects.toThrow("invalid result message");
    child.emit("message", message);
    child.emit("close", null, "SIGKILL");
    await check;
  },
);
it.each(["error", "message", "exit"])("cleans up on worker %s failure", async (kind) => {
  const promise = runPraxisWithWorker(task, options);
  const check = expect(promise).rejects.toBeInstanceOf(Error);
  if (kind === "error") child.emit("error", new Error("load failed"));
  if (kind === "message") child.emit("message", { error: "native failed" });
  child.emit("close", 1, null);
  await check;
  expect(vi.getTimerCount()).toBe(0);
});
it("does not leak capacity when spawning throws", async () => {
  vi.mocked(spawn).mockImplementationOnce(() => {
    throw new Error("spawn failed");
  });
  await expect(runPraxisWithWorker(task, options)).rejects.toThrow("spawn failed");
  const next = runPraxisWithWorker(task, options);
  child.emit("message", { resultJson: "{}" });
  child.emit("close", 0, null);
  await next;
});
it.each([0, -1, 1.5, NaN, Infinity])("rejects invalid timeout %s", async (timeoutMs) => {
  await expect(runPraxisWithWorker(task, { ...options, timeoutMs })).rejects.toThrow("Invalid PRAXIS execution limits");
  expect(spawn).not.toHaveBeenCalled();
});
