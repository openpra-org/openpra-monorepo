import { deserialize, serialize } from "node:v8";
import "@testing-library/jest-dom";

// jsdom does not expose the browser structuredClone API used by workbook projections.
globalThis.structuredClone ??= <T,>(value: T): T => deserialize(serialize(value)) as T;

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

class MockResponse {
  readonly status: number;
  readonly ok: boolean;
  readonly headers: Headers;
  readonly statusText: string;
  private readonly bodyText: string;

  constructor(body?: string | null, init?: { status?: number; headers?: Record<string, string>; statusText?: string }) {
    this.status = init?.status ?? 200;
    this.ok = this.status >= 200 && this.status < 300;
    this.statusText = init?.statusText ?? (this.ok ? "OK" : "Error");
    this.headers = new Headers(init?.headers ?? {});
    this.bodyText = body ?? "";
  }

  async text(): Promise<string> {
    return this.bodyText;
  }

  async json(): Promise<unknown> {
    return JSON.parse(this.bodyText);
  }
}

if (typeof globalThis.Response === "undefined") {
  (globalThis as unknown as { Response: unknown }).Response = MockResponse;
}
