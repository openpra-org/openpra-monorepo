import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
import { runOpenRcProcess } from "./openrc-worker-runner";

const spawn = vi.hoisted(() => vi.fn());
vi.mock("node:child_process", () => ({ spawn }));

const task = { operation: "execute" as const, requestJson: "{}" };
const options = { addonPath: "addon", workerPath: "worker", timeoutMs: 100 };

function worker() {
  return Object.assign(new EventEmitter(), {
    pid: 7,
    kill: vi.fn(() => true),
    send: vi.fn((_data: object, callback: (error: Error | null) => void) => callback(null)),
  });
}

let child: ReturnType<typeof worker>;
beforeEach(() => {
  vi.useFakeTimers();
  child = worker();
  spawn.mockReturnValue(child);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
  vi.clearAllMocks();
});

it("passes the configured heap to the process and allows an internal override", async () => {
  vi.stubEnv("PRAETOR_NATIVE_HEAP_MB", "4096");
  const configured = runOpenRcProcess(task, options);
  expect(spawn).toHaveBeenLastCalledWith(process.execPath, ["--max-old-space-size=4096", "worker"], expect.anything());
  child.emit("message", { resultJson: "{}" });
  child.emit("close", 0, null);
  await configured;
  child = worker();
  spawn.mockReturnValue(child);
  const overridden = runOpenRcProcess(task, { ...options, heapLimitMb: 1024 });
  expect(spawn).toHaveBeenLastCalledWith(process.execPath, ["--max-old-space-size=1024", "worker"], expect.anything());
  child.emit("message", { resultJson: "{}" });
  child.emit("close", 0, null);
  await overridden;
});

it.each(["0", "-1", "1.5", "NaN", "Infinity"])("rejects an invalid heap budget %s before spawning", async (heap) => {
  vi.stubEnv("PRAETOR_NATIVE_HEAP_MB", heap);
  await expect(runOpenRcProcess(task, options)).rejects.toThrow("PRAETOR_NATIVE_HEAP_MB");
  expect(spawn).not.toHaveBeenCalled();
});

it("uses a hidden process, sends the task with its addon and kills the process once it answers", async () => {
  const pending = runOpenRcProcess(task, options);
  expect(spawn).toHaveBeenCalledWith(
    process.execPath,
    ["worker"],
    expect.objectContaining({ windowsHide: true, shell: false, stdio: ["ignore", "ignore", "pipe", "ipc"] }),
  );
  expect(child.send).toHaveBeenCalledWith({ ...task, addonPath: "addon" }, expect.any(Function));
  child.emit("message", { resultJson: "{}" });
  expect(child.kill).toHaveBeenCalledWith("SIGKILL");
  child.emit("close", 0, null);
  await expect(pending).resolves.toEqual({ resultJson: "{}", workerProcessId: 7 });
  expect(vi.getTimerCount()).toBe(0);
});

it("starts the worker script that sits next to the runner when none is named", async () => {
  const pending = runOpenRcProcess(task, { addonPath: "addon", timeoutMs: 100 });
  const script = spawn.mock.calls[0][1][0];
  expect(script.endsWith("openrc.worker.js")).toBe(true);
  expect(script.includes("praxis")).toBe(false);
  child.emit("message", { resultJson: "{}" });
  child.emit("close", 0, null);
  await pending;
});

it("kills a timed-out process", async () => {
  const promise = runOpenRcProcess(task, options);
  const check = expect(promise).rejects.toMatchObject({ code: "OPENRC_TIMEOUT", message: "OpenRC execution exceeded 100 ms" });
  await vi.advanceTimersByTimeAsync(100);
  expect(child.kill).toHaveBeenCalledWith("SIGKILL");
  child.emit("close", null, "SIGKILL");
  await check;
});

it("does not time out a process that answered just before its limit", async () => {
  const promise = runOpenRcProcess(task, options);
  await vi.advanceTimersByTimeAsync(99);
  child.emit("message", { resultJson: "{\"late\":true}" });
  child.emit("close", 0, null);
  await vi.advanceTimersByTimeAsync(10);
  await expect(promise).resolves.toEqual({ resultJson: "{\"late\":true}", workerProcessId: 7 });
  expect(child.kill).toHaveBeenCalledTimes(1);
});

it("cancels an active process and removes its timer after exit", async () => {
  const controller = new AbortController();
  const promise = runOpenRcProcess(task, { ...options, signal: controller.signal });
  const check = expect(promise).rejects.toMatchObject({ code: "OPENRC_CANCELLED" });
  controller.abort();
  expect(child.kill).toHaveBeenCalledTimes(1);
  child.emit("close", null, "SIGKILL");
  await check;
  expect(vi.getTimerCount()).toBe(0);
});

it("does not start an already-cancelled request", async () => {
  await expect(runOpenRcProcess(task, { ...options, signal: AbortSignal.abort() })).rejects.toMatchObject({
    code: "OPENRC_CANCELLED",
  });
  expect(spawn).not.toHaveBeenCalled();
});

it("keeps the first outcome when a cancel follows an answer", async () => {
  const controller = new AbortController();
  const promise = runOpenRcProcess(task, { ...options, signal: controller.signal });
  child.emit("message", { resultJson: "{}" });
  controller.abort();
  child.emit("close", null, "SIGKILL");
  await expect(promise).resolves.toEqual({ resultJson: "{}", workerProcessId: 7 });
  expect(child.kill).toHaveBeenCalledTimes(1);
});

it.each([null, [], {}, { resultJson: 2 }, { resultJson: "{}", error: "failure" }, "text", 7])("rejects invalid IPC %#", async (message) => {
  const promise = runOpenRcProcess(task, options);
  const check = expect(promise).rejects.toMatchObject({ code: "OPENRC_WORKER_FAILURE", message: "OpenRC worker returned an invalid result message" });
  child.emit("message", message);
  child.emit("close", null, "SIGKILL");
  await check;
});

it("reports the failure text the worker sends", async () => {
  const promise = runOpenRcProcess(task, options);
  const check = expect(promise).rejects.toMatchObject({ code: "OPENRC_WORKER_FAILURE", message: "native failed" });
  child.emit("message", { error: "native failed" });
  child.emit("close", 1, null);
  await check;
});

it.each(["error", "message", "exit"])("cleans up on process %s failure", async (kind) => {
  const promise = runOpenRcProcess(task, options);
  const check = expect(promise).rejects.toBeInstanceOf(Error);
  if (kind === "error") child.emit("error", new Error("load failed"));
  if (kind === "message") child.emit("message", { error: "native failed" });
  child.emit("close", 1, null);
  await check;
  expect(vi.getTimerCount()).toBe(0);
  expect(child.listenerCount("message")).toBe(0);
  expect(child.listenerCount("close")).toBe(0);
});

it("reports a process that stops before answering, with what it wrote", async () => {
  const stderr = new EventEmitter();
  Object.assign(child, { stderr });
  const promise = runOpenRcProcess(task, options);
  const check = expect(promise).rejects.toMatchObject({
    code: "OPENRC_PROCESS_EXITED",
    message: "The OpenRC process stopped before returning a result (exit code 3): out of memory",
  });
  stderr.emit("data", Buffer.from("out of memory\n"));
  child.emit("close", 3, null);
  await check;
});

it("names the signal that stopped the process", async () => {
  const promise = runOpenRcProcess(task, options);
  const check = expect(promise).rejects.toMatchObject({
    code: "OPENRC_PROCESS_EXITED",
    message: "The OpenRC process stopped before returning a result (SIGSEGV)",
  });
  child.emit("close", null, "SIGSEGV");
  await check;
});

it("reports a task that could not be sent", async () => {
  child.send.mockImplementationOnce((_data: object, callback: (error: Error | null) => void) => callback(new Error("channel closed")));
  const promise = runOpenRcProcess(task, options);
  const check = expect(promise).rejects.toMatchObject({ code: "OPENRC_WORKER_FAILURE", message: "channel closed" });
  child.emit("close", null, "SIGKILL");
  await check;
  expect(child.kill).toHaveBeenCalledWith("SIGKILL");
});

it("rejects when spawning throws and still runs the next request", async () => {
  spawn.mockImplementationOnce(() => {
    throw new Error("spawn failed");
  });
  await expect(runOpenRcProcess(task, options)).rejects.toThrow("spawn failed");
  const next = runOpenRcProcess(task, options);
  child.emit("message", { resultJson: "{}" });
  child.emit("close", 0, null);
  await next;
});

it.each([0, -1, 1.5, NaN, Infinity, 2_147_000_001])("rejects invalid timeout %s", async (timeoutMs) => {
  await expect(runOpenRcProcess(task, { ...options, timeoutMs })).rejects.toMatchObject({ code: "OPENRC_INVALID_LIMITS" });
  expect(spawn).not.toHaveBeenCalled();
});
