export type NativeJson = null | boolean | number | string | NativeJson[] | { [key: string]: NativeJson };
export interface NativeStructuredError {
  kind: string;
  code: string;
  message: string;
  details: { [key: string]: NativeJson };
}
export interface NativeResponse {
  schemaVersion: "1.0.0";
  engine?: { name: "OPENRC"; version: string };
  result?: { [key: string]: NativeJson };
  error?: NativeStructuredError;
}
export function parseNativeResponse(value: NativeJson | undefined): NativeResponse;
export function nativeWorkerHeapLimit(value?: string): number | undefined;
export const NATIVE_DEADLINE_HEADER: string;
export const SOLVER_PROTOCOL_VERSION: "1.0.0";
