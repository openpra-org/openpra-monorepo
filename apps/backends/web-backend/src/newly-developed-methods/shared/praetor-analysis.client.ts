import { BadGatewayException, Injectable } from "@nestjs/common";
import { stringifyJson } from "interfaces-shared-types/json";
import {
  nativeExecutionTimeout,
  NATIVE_DEADLINE_HEADER,
  NATIVE_TRANSPORT_GRACE_MS,
  parseNativeResponse,
  type NativeResponse,
  type NativeStructuredError,
} from "praxis-node/protocol";
import { analysisRequestSignal } from "./analysis-cancellation.interceptor";

type PraetorStructuredError = NativeStructuredError;
type PraetorNativeResponse = NativeResponse;

@Injectable()
class PraetorAnalysisClient {
  async execute(request: unknown): Promise<PraetorNativeResponse> {
    const baseUrl = (process.env["PRAETOR_URL"] ?? "http://localhost:3000/q").replace(/\/$/, "");
    const timeoutMs = nativeExecutionTimeout();
    const cancelled = analysisRequestSignal.getStore();
    const timeout = AbortSignal.timeout(timeoutMs + NATIVE_TRANSPORT_GRACE_MS);
    const signal = cancelled === undefined ? timeout : AbortSignal.any([cancelled, timeout]);
    try {
      const response = await fetch(`${baseUrl}/praxis/native/execute`, {
        method: "POST",
        headers: { "content-type": "application/json", [NATIVE_DEADLINE_HEADER]: String(Date.now() + timeoutMs) },
        body: stringifyJson(request),
        signal,
      });
      if (!response.ok) {
        const body = await response.text();
        throw new BadGatewayException(`Praetor returned HTTP ${response.status}${body.length > 0 ? `: ${body}` : ""}`);
      }
      let body: unknown;
      try {
        body = await response.json();
      } catch (error) {
        if (signal.aborted) throw error;
        throw new BadGatewayException(
          `Praetor returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      try {
        return parseNativeResponse(body);
      } catch {
        throw new BadGatewayException("Praetor returned an invalid native solver response");
      }
    } catch (error) {
      if (signal.aborted)
        return {
          schemaVersion: "1.0.0",
          error: {
            kind: "EXECUTION_ERROR",
            code: cancelled?.aborted ? "PRAXIS_CANCELLED" : "PRAXIS_TIMEOUT",
            message: cancelled?.aborted ? "Analysis request was cancelled" : "Praetor execution response timed out",
            details: {},
          },
        };
      if (error instanceof BadGatewayException) throw error;
      throw new BadGatewayException(
        `Unable to reach Praetor: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

export { PraetorAnalysisClient };
export type { PraetorNativeResponse, PraetorStructuredError };
