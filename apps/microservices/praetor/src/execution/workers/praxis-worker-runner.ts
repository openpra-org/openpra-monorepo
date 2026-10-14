import { spawn, type Serializable } from "node:child_process";
import { join } from "node:path";
import { nativeWorkerHeapLimit } from "praxis-node/protocol";

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
  timeoutMs: number;
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

function heapArguments(heapLimitMb: number | undefined): string[] {
  const limit = heapLimitMb ?? nativeWorkerHeapLimit();
  return limit === undefined ? [] : [`--max-old-space-size=${limit}`];
}

function runPraxisProcess(task: PraxisWorkerTask, options: PraxisWorkerRunnerOptions): Promise<PraxisWorkerResult> {
  if (options.signal?.aborted) return Promise.reject(new PraxisWorkerError("PRAXIS_CANCELLED", "PRAXIS execution was cancelled"));
  if (!Number.isSafeInteger(options.timeoutMs) || options.timeoutMs < 1 || options.timeoutMs > 2_147_000_000) {
    return Promise.reject(new PraxisWorkerError("PRAXIS_INVALID_LIMITS", "PRAXIS execution needs a positive timeout"));
  }
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [...heapArguments(options.heapLimitMb), options.workerPath ?? join(__dirname, "praxis.worker.js")], {
      shell: false,
      windowsHide: true,
      stdio: ["ignore", "ignore", "pipe", "ipc"],
    });
    const errorOutput: string[] = [];
    child.stderr?.on("data", (chunk: Buffer) => {
      if (errorOutput.join("").length < 8192) errorOutput.push(chunk.toString("utf8"));
    });
    let outcome: PraxisWorkerResult | Error | undefined;
    const stop = (result: PraxisWorkerResult | Error): void => {
      if (outcome !== undefined) return;
      outcome = result;
      try {
        child.kill("SIGKILL");
      } catch (error) {
        if (!(error instanceof Error)) throw error;
      }
    };
    const cancel = (): void => stop(new PraxisWorkerError("PRAXIS_CANCELLED", "PRAXIS execution was cancelled"));
    const timer = setTimeout(
      () => stop(new PraxisWorkerError("PRAXIS_TIMEOUT", `PRAXIS execution exceeded ${options.timeoutMs} ms`)),
      options.timeoutMs,
    );
    options.signal?.addEventListener("abort", cancel, { once: true });
    child.once("message", (message: Serializable) => {
      if (typeof message !== "object" || message === null || Array.isArray(message)) {
        stop(new PraxisWorkerError("PRAXIS_WORKER_FAILURE", "PRAXIS worker returned an invalid result message"));
        return;
      }
      const value = message as Record<string, string | undefined>;
      if (typeof value["resultJson"] === "string" && value["error"] === undefined) {
        stop({ resultJson: value["resultJson"], workerProcessId: child.pid ?? 0 });
      } else if (typeof value["error"] === "string" && value["resultJson"] === undefined) {
        stop(new PraxisWorkerError("PRAXIS_WORKER_FAILURE", value["error"]));
      } else {
        stop(new PraxisWorkerError("PRAXIS_WORKER_FAILURE", "PRAXIS worker returned an invalid result message"));
      }
    });
    child.on("error", (error: Error) => stop(new PraxisWorkerError("PRAXIS_WORKER_FAILURE", error.message)));
    child.once("close", (code, signal) => {
      clearTimeout(timer);
      options.signal?.removeEventListener("abort", cancel);
      child.removeAllListeners();
      if (outcome === undefined) {
        const detail = errorOutput.join("").trim();
        outcome = new PraxisWorkerError(
          "PRAXIS_PROCESS_EXITED",
          `The PRAXIS process stopped before returning a result (${signal ?? `exit code ${String(code)}`})${detail.length === 0 ? "" : `: ${detail.slice(0, 2000)}`}`,
        );
      }
      if (outcome instanceof Error) reject(outcome);
      else resolve(outcome);
    });
    if (options.signal?.aborted) cancel();
    if (outcome === undefined) {
      try {
        child.send({ ...task, addonPath: options.addonPath ?? require.resolve("praxis-node") }, (error) => {
          if (error) stop(new PraxisWorkerError("PRAXIS_WORKER_FAILURE", error.message));
        });
      } catch (error) {
        stop(new PraxisWorkerError("PRAXIS_WORKER_FAILURE", error instanceof Error ? error.message : String(error)));
      }
    }
  });
}

export { runPraxisProcess, PraxisWorkerError };
export type { PraxisOperation, PraxisWorkerTask, PraxisWorkerResult, PraxisWorkerRunnerOptions };
