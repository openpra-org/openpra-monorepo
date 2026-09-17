import { spawn, type ChildProcess } from "node:child_process";
import { join } from "node:path";
import { nativeExecutionTimeout, nativeWorkerHeapLimit } from "praxis-node/protocol";

type PraxisOperation = "validate" | "execute";
interface PraxisWorkerTask {
  operation: PraxisOperation;
  requestJson: string;
}
interface PraxisWorkerResult {
  resultJson: string;
  workerProcessId: number;
}
interface PraxisWorkerRunnerOptions {
  addonPath?: string;
  workerPath?: string;
  timeoutMs?: number;
  maxConcurrent?: number;
  heapLimitMb?: number;
  signal?: AbortSignal;
}

class PraxisWorkerError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

// Shared by validation and execution. No unbounded queue of model snapshots.
const activeWorkers = new Set<ChildProcess>();
function concurrencyLimit(): number {
  const value = Number(process.env["PRAETOR_NATIVE_MAX_CONCURRENT"] ?? 2);
  if (!Number.isSafeInteger(value) || value < 1)
    throw new Error("PRAETOR_NATIVE_MAX_CONCURRENT must be a positive integer");
  return value;
}

function runPraxisWithWorker(
  task: PraxisWorkerTask,
  options: PraxisWorkerRunnerOptions = {},
): Promise<PraxisWorkerResult> {
  if (options.signal?.aborted)
    return Promise.reject(new PraxisWorkerError("PRAXIS_CANCELLED", "PRAXIS execution was cancelled"));
  const timeoutMs = options.timeoutMs ?? nativeExecutionTimeout();
  const limit = options.maxConcurrent ?? concurrencyLimit();
  const heapLimitMb = nativeWorkerHeapLimit(options.heapLimitMb === undefined ? undefined : String(options.heapLimitMb));
  if (
    !Number.isSafeInteger(timeoutMs) ||
    timeoutMs < 1 ||
    timeoutMs > 2_147_000_000 ||
    !Number.isSafeInteger(limit) ||
    limit < 1
  ) {
    return Promise.reject(new Error("Invalid PRAXIS execution limits"));
  }
  if (activeWorkers.size >= limit)
    return Promise.reject(new PraxisWorkerError("PRAXIS_BUSY", "PRAXIS is busy; retry when an active run finishes"));
  return new Promise((resolve, reject) => {
    const args = heapLimitMb === undefined ? [] : [`--max-old-space-size=${heapLimitMb}`];
    args.push(options.workerPath ?? join(__dirname, "praxis.worker.js"));
    const child = spawn(process.execPath, args, {
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "ignore", "ignore", "ipc"],
    });
    activeWorkers.add(child);
    let outcome: PraxisWorkerResult | Error | undefined;
    const stop = (result: PraxisWorkerResult | Error): void => {
      if (outcome !== undefined) return;
      outcome = result;
      // SIGKILL terminates native code too. Keep the slot until close confirms exit.
      try {
        child.kill("SIGKILL");
      } catch {
        /* close/error handles an already-exited process */
      }
    };
    const cancel = (): void => stop(new PraxisWorkerError("PRAXIS_CANCELLED", "PRAXIS execution was cancelled"));
    const timer = setTimeout(
      () => stop(new PraxisWorkerError("PRAXIS_TIMEOUT", `PRAXIS execution exceeded ${timeoutMs} ms`)),
      timeoutMs,
    );
    options.signal?.addEventListener("abort", cancel, { once: true });
    child.once("message", (message: unknown) => {
      if (message === null || typeof message !== "object" || Array.isArray(message)) {
        stop(new Error("PRAXIS worker returned an invalid result message"));
        return;
      }
      const value = message as Record<string, unknown>;
      if (typeof value["resultJson"] === "string" && value["error"] === undefined) {
        stop({ resultJson: value["resultJson"], workerProcessId: child.pid! });
      } else if (typeof value["error"] === "string" && value["resultJson"] === undefined) {
        stop(new Error(value["error"]));
      } else stop(new Error("PRAXIS worker returned an invalid result message"));
    });
    child.on("error", (error: Error) => stop(error));
    child.once("close", (code, signal) => {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", cancel);
      activeWorkers.delete(child);
      child.removeAllListeners();
      if (outcome === undefined)
        outcome = new Error(`PRAXIS worker exited before returning a result (${signal ?? code})`);
      if (outcome instanceof Error) reject(outcome);
      else resolve(outcome);
    });
    if (options.signal?.aborted) cancel();
    if (outcome === undefined) {
      try {
        child.send({ ...task, addonPath: options.addonPath ?? require.resolve("praxis-node") }, (error) => {
          if (error) stop(error);
        });
      } catch (error) {
        stop(error instanceof Error ? error : new Error(String(error)));
      }
    }
  });
}

export { runPraxisWithWorker, PraxisWorkerError };
export type { PraxisOperation, PraxisWorkerTask, PraxisWorkerResult, PraxisWorkerRunnerOptions };
