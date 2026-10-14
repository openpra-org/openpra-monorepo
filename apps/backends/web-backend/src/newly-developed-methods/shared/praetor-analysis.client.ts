import { BadGatewayException, Injectable } from "@nestjs/common";
import {
  parsePraetorJobState,
  praetorJobFinished,
  praetorJobTimeout,
  type PraetorJobOperation,
  type PraetorJobState,
} from "interfaces-shared-types/execution/praetor-job";
import { stringifyJson } from "interfaces-shared-types/json";
import { parseNativeResponse, type NativeResponse, type NativeStructuredError } from "praxis-node/protocol";
import { analysisRequestSignal } from "./analysis-cancellation.interceptor";

type PraetorStructuredError = NativeStructuredError;
type PraetorNativeResponse = NativeResponse;

interface PraetorSubmitOptions {
  jobId?: string;
  operation?: PraetorJobOperation;
  timeoutMs?: number;
}

interface PraetorWaitOptions extends PraetorSubmitOptions {
  onState?: (state: PraetorJobState) => void;
}

const POLL_FIRST_MS = 150;
const POLL_LONGEST_MS = 2_000;
const HTTP_TIMEOUT_MS = 60_000;

function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

function baseUrl(): string {
  const configured = process.env["PRAETOR_URL"] ?? "http://localhost:3000/q";
  return configured.endsWith("/") ? configured.slice(0, -1) : configured;
}

function unreachable(error: Error | string): BadGatewayException {
  const text = error instanceof Error ? error.message : error;
  return new BadGatewayException(`PRAETOR could not be reached at ${baseUrl()}: ${text}`);
}

@Injectable()
class PraetorAnalysisClient {
  private async call(path: string, init: RequestInit): Promise<Response> {
    try {
      return await fetch(`${baseUrl()}${path}`, { ...init, signal: AbortSignal.timeout(HTTP_TIMEOUT_MS) });
    } catch (error) {
      throw unreachable(error instanceof Error ? error : String(error));
    }
  }

  private async json(response: Response, what: string): Promise<object> {
    const body = await response.text();
    if (!response.ok) throw new BadGatewayException(`PRAETOR refused to ${what} (HTTP ${response.status})${body.length > 0 ? `: ${body}` : ""}`);
    try {
      const parsed: object = JSON.parse(body);
      return parsed;
    } catch (error) {
      throw new BadGatewayException(`PRAETOR returned invalid JSON while asked to ${what}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async submit(request: object, options: PraetorSubmitOptions = {}): Promise<PraetorJobState> {
    const timeoutMs = options.timeoutMs ?? praetorJobTimeout();
    const response = await this.call("/praxis/jobs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: stringifyJson({
        operation: options.operation ?? "execute",
        request,
        timeoutMs,
        ...(options.jobId === undefined ? {} : { jobId: options.jobId }),
      }),
    });
    try {
      return parsePraetorJobState(await this.json(response, "accept a PRAXIS job"));
    } catch (error) {
      if (error instanceof BadGatewayException) throw error;
      throw new BadGatewayException(`PRAETOR returned an invalid job state: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async state(jobId: string): Promise<PraetorJobState> {
    const response = await this.call(`/praxis/jobs/${encodeURIComponent(jobId)}`, { method: "GET" });
    try {
      return parsePraetorJobState(await this.json(response, `report PRAXIS job ${jobId}`));
    } catch (error) {
      if (error instanceof BadGatewayException) throw error;
      throw new BadGatewayException(`PRAETOR returned an invalid job state: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async result(jobId: string): Promise<PraetorNativeResponse> {
    const response = await this.call(`/praxis/jobs/${encodeURIComponent(jobId)}/result`, { method: "GET" });
    try {
      return parseNativeResponse(await this.json(response, `return the result of PRAXIS job ${jobId}`));
    } catch (error) {
      if (error instanceof BadGatewayException) throw error;
      throw new BadGatewayException(`PRAETOR returned an invalid native solver response: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async cancel(jobId: string): Promise<void> {
    const response = await this.call(`/praxis/jobs/${encodeURIComponent(jobId)}`, { method: "DELETE" });
    if (!response.ok && response.status !== 404) {
      const body = await response.text();
      throw new BadGatewayException(`PRAETOR could not cancel PRAXIS job ${jobId} (HTTP ${response.status})${body.length > 0 ? `: ${body}` : ""}`);
    }
  }

  async wait(jobId: string, options: PraetorWaitOptions = {}, signal?: AbortSignal): Promise<PraetorNativeResponse> {
    let pause = POLL_FIRST_MS;
    for (;;) {
      const state = await this.state(jobId);
      options.onState?.(state);
      if (praetorJobFinished(state.status)) {
        if (state.status === "CANCELLED") {
          return { schemaVersion: "1.0.0", error: { kind: "EXECUTION_ERROR", code: "PRAXIS_CANCELLED", message: "The PRAXIS job was cancelled.", details: { jobId } } };
        }
        return this.result(jobId);
      }
      if (signal?.aborted) {
        await this.cancel(jobId);
        return { schemaVersion: "1.0.0", error: { kind: "EXECUTION_ERROR", code: "PRAXIS_CANCELLED", message: "The analysis request was cancelled.", details: { jobId } } };
      }
      await delay(pause, signal);
      pause = Math.min(POLL_LONGEST_MS, Math.round(pause * 1.5));
    }
  }

  async execute(request: object, options: PraetorWaitOptions = {}): Promise<PraetorNativeResponse> {
    const submitted = await this.submit(request, options);
    return this.wait(submitted.jobId, options, analysisRequestSignal.getStore());
  }
}

export { PraetorAnalysisClient };
export type { PraetorNativeResponse, PraetorStructuredError, PraetorSubmitOptions, PraetorWaitOptions };
