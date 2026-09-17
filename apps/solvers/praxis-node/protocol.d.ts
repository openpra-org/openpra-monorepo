export interface NativeStructuredError {
  kind: string;
  code: string;
  message: string;
  details: Record<string, unknown>;
}
export interface NativeResponse {
  schemaVersion: "1.0.0";
  engine?: { name: "PRAXIS"; version: string };
  result?: Record<string, unknown>;
  error?: NativeStructuredError;
}
export function parseNativeResponse(value: unknown): NativeResponse;
export function nativeExecutionTimeout(value?: string): number;
export function nativeWorkerHeapLimit(value?: string): number | undefined;
export const DEFAULT_NATIVE_TIMEOUT_MS: number;
export const NATIVE_TRANSPORT_GRACE_MS: number;
export const NATIVE_DEADLINE_HEADER: string;
/** Return a resource/validation error, or undefined when the clique budget permits inference. */
export declare function checkCliqueMemory(preflight: unknown, value?: string): ReturnType<typeof parseNativeResponse> | undefined;
