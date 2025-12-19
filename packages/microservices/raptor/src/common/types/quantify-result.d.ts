export interface QuantifyModelFileResult {
  type: 'file';
  path: string;
  /** Optional size in bytes of the generated report. */
  size?: number | bigint;
  /** Format of the serialized report. Defaults to JSON. */
  format?: 'json' | string;
}

export type QuantifyModelResult =
  | QuantifyModelFileResult
  | Record<string, unknown>;
