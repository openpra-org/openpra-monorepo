import { BadRequestException, Injectable, InternalServerErrorException, type OnModuleDestroy } from "@nestjs/common";
import { stringifyJson } from "interfaces-shared-types/json";
import type { IncomingMessage, ServerResponse } from "node:http";
import {
  nativeExecutionTimeout,
  NATIVE_DEADLINE_HEADER,
  parseNativeResponse,
  type NativeResponse,
} from "praxis-node/protocol";
import { runPraxisWithWorker, PraxisWorkerError } from "../workers/praxis-worker-runner";

type PraxisNativeOperation = "validate" | "execute";
type PraxisNativeResponse = NativeResponse;
interface NativeHttpContext {
  request: IncomingMessage;
  response: ServerResponse;
}

@Injectable()
class PraxisNativeService implements OnModuleDestroy {
  private readonly shutdown = new AbortController();
  onModuleDestroy(): void {
    this.shutdown.abort();
  }

  async run(
    operation: PraxisNativeOperation,
    request: unknown,
    http?: NativeHttpContext,
  ): Promise<PraxisNativeResponse> {
    const requestJson = stringifyJson(request);
    if (requestJson === undefined) throw new BadRequestException("A versioned PRAXIS request body is required.");
    let timeoutMs = nativeExecutionTimeout();
    const deadline = http?.request.headers[NATIVE_DEADLINE_HEADER];
    if (deadline !== undefined) {
      if (typeof deadline !== "string" || !/^\d+$/.test(deadline) || !Number.isSafeInteger(Number(deadline))) {
        throw new BadRequestException("Invalid PRAXIS execution deadline");
      }
      timeoutMs = Math.min(timeoutMs, Number(deadline) - Date.now());
    }
    const disconnected = new AbortController();
    const cancel = (): void => {
      if (!http?.response.writableEnded) disconnected.abort();
    };
    http?.response.once("close", cancel);
    http?.request.once("aborted", cancel);
    if (http?.request.aborted || http?.response.destroyed) cancel();
    try {
      if (timeoutMs <= 0) throw new PraxisWorkerError("PRAXIS_TIMEOUT", "PRAXIS execution deadline expired");
      const { resultJson } = await runPraxisWithWorker(
        { operation, requestJson },
        {
          timeoutMs,
          signal: AbortSignal.any([this.shutdown.signal, disconnected.signal]),
        },
      );
      try {
        return parseNativeResponse(JSON.parse(resultJson));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new InternalServerErrorException(`PRAXIS worker returned an invalid response: ${message}`);
      }
    } catch (error) {
      if (error instanceof InternalServerErrorException) throw error;
      return {
        schemaVersion: "1.0.0",
        error: {
          kind: "EXECUTION_ERROR",
          code: error instanceof PraxisWorkerError ? error.code : "PRAXIS_WORKER_FAILURE",
          message: error instanceof Error ? error.message : String(error),
          details: {},
        },
      };
    } finally {
      http?.response.removeListener("close", cancel);
      http?.request.removeListener("aborted", cancel);
    }
  }
}

export { PraxisNativeService };
export type { PraxisNativeOperation, PraxisNativeResponse };
