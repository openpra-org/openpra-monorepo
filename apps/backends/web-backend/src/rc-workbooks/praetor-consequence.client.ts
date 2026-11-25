import { BadGatewayException, Injectable } from "@nestjs/common";
import {
  parsePraetorJobState,
  praetorJobFinished,
  praetorJobTimeout,
  type PraetorJobOperation,
  type PraetorJobState,
} from "interfaces-shared-types/execution/praetor-job";
import { stringifyJson } from "interfaces-shared-types/json";
import { parseNativeResponse, type NativeJson, type NativeResponse, type NativeStructuredError } from "openrc-node/protocol";
import { analysisRequestSignal } from "../newly-developed-methods/shared/analysis-cancellation.interceptor";

type PraetorConsequenceError = NativeStructuredError;
type PraetorConsequenceResponse = NativeResponse;

interface PraetorConsequenceSubmitOptions {
  jobId?: string;
  operation?: PraetorJobOperation;
  timeoutMs?: number;
}

interface PraetorConsequenceWaitOptions extends PraetorConsequenceSubmitOptions {
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

function cancelled(jobId: string, message: string): PraetorConsequenceResponse {
  return { schemaVersion: "1.0.0", error: { kind: "EXECUTION_ERROR", code: "OPENRC_CANCELLED", message, details: { jobId } } };
}

@Injectable()
class PraetorConsequenceClient {
  private async call(path: string, init: RequestInit): Promise<Response> {
    try {
      return await fetch(`${baseUrl()}${path}`, { ...init, signal: AbortSignal.timeout(HTTP_TIMEOUT_MS) });
    } catch (error) {
      throw unreachable(error instanceof Error ? error : String(error));
    }
  }

  private async json(response: Response, what: string): Promise<NativeJson> {
    const body = await response.text();
    if (!response.ok) throw new BadGatewayException(`PRAETOR refused to ${what} (HTTP ${response.status})${body.length > 0 ? `: ${body}` : ""}`);
    try {
      const parsed: NativeJson = JSON.parse(body);
      return parsed;
    } catch (error) {
      throw new BadGatewayException(`PRAETOR returned invalid JSON while asked to ${what}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private jobState(body: NativeJson): PraetorJobState {
    try {
      if (body === null || typeof body !== "object") throw new Error("PRAETOR job state is malformed");
      return parsePraetorJobState(body);
    } catch (error) {
      throw new BadGatewayException(`PRAETOR returned an invalid job state: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async submit(request: object, options: PraetorConsequenceSubmitOptions = {}): Promise<PraetorJobState> {
    const timeoutMs = options.timeoutMs ?? praetorJobTimeout();
    const response = await this.call("/openrc/jobs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: stringifyJson({
        operation: options.operation ?? "execute",
        request,
        timeoutMs,
        ...(options.jobId === undefined ? {} : { jobId: options.jobId }),
      }),
    });
    return this.jobState(await this.json(response, "accept an OpenRC job"));
  }

  async state(jobId: string): Promise<PraetorJobState> {
    const response = await this.call(`/openrc/jobs/${encodeURIComponent(jobId)}`, { method: "GET" });
    return this.jobState(await this.json(response, `report OpenRC job ${jobId}`));
  }

  async result(jobId: string): Promise<PraetorConsequenceResponse> {
    const response = await this.call(`/openrc/jobs/${encodeURIComponent(jobId)}/result`, { method: "GET" });
    const body = await this.json(response, `return the result of OpenRC job ${jobId}`);
    try {
      return parseNativeResponse(body);
    } catch (error) {
      throw new BadGatewayException(`PRAETOR returned an invalid native solver response: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async cancel(jobId: string): Promise<void> {
    const response = await this.call(`/openrc/jobs/${encodeURIComponent(jobId)}`, { method: "DELETE" });
    if (!response.ok && response.status !== 404) {
      const body = await response.text();
      throw new BadGatewayException(`PRAETOR could not cancel OpenRC job ${jobId} (HTTP ${response.status})${body.length > 0 ? `: ${body}` : ""}`);
    }
  }

  async wait(jobId: string, options: PraetorConsequenceWaitOptions = {}, signal?: AbortSignal): Promise<PraetorConsequenceResponse> {
    let pause = POLL_FIRST_MS;
    for (;;) {
      const state = await this.state(jobId);
      options.onState?.(state);
      if (praetorJobFinished(state.status)) {
        if (state.status === "CANCELLED") return cancelled(jobId, "The OpenRC job was cancelled.");
        return this.result(jobId);
      }
      if (signal?.aborted) {
        await this.cancel(jobId);
        return cancelled(jobId, "The consequence request was cancelled.");
      }
      await delay(pause, signal);
      pause = Math.min(POLL_LONGEST_MS, Math.round(pause * 1.5));
    }
  }

  async execute(request: object, options: PraetorConsequenceWaitOptions = {}): Promise<PraetorConsequenceResponse> {
    const submitted = await this.submit(request, options);
    return this.wait(submitted.jobId, options, analysisRequestSignal.getStore());
  }
}

export { PraetorConsequenceClient };
export type { PraetorConsequenceError, PraetorConsequenceResponse, PraetorConsequenceSubmitOptions, PraetorConsequenceWaitOptions };
