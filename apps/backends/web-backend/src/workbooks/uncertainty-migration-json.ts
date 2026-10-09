import type { CanonicalValue } from "interfaces-mef-types/core/uncertainty";
import { stringifyJson } from "interfaces-shared-types/json";

type Json = null | boolean | number | string | Json[] | JsonRecord;

interface JsonRecord {
  [key: string]: Json;
}

function isRecord(value: Json | undefined): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function field(record: JsonRecord, key: string): Json | undefined {
  return Object.hasOwn(record, key) ? record[key] : undefined;
}

function present(record: JsonRecord, key: string): boolean {
  const value = field(record, key);
  return value !== undefined && value !== null;
}

function recordField(record: JsonRecord, key: string): JsonRecord | undefined {
  const value = field(record, key);
  return isRecord(value) ? value : undefined;
}

function arrayField(record: JsonRecord, key: string): Json[] | undefined {
  const value = field(record, key);
  return Array.isArray(value) ? value : undefined;
}

function textField(record: JsonRecord, key: string): string | undefined {
  const value = field(record, key);
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function rawText(record: JsonRecord, key: string): string | undefined {
  const value = field(record, key);
  return typeof value === "string" ? value : undefined;
}

function numberField(record: JsonRecord, key: string): number | undefined {
  const value = field(record, key);
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function positiveField(record: JsonRecord, key: string): number | undefined {
  const value = numberField(record, key);
  return value !== undefined && value > 0 ? value : undefined;
}

function numberList(value: Json | undefined): number[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const numbers = value.flatMap((entry) => (typeof entry === "number" && Number.isFinite(entry) ? [entry] : []));
  return numbers.length === value.length ? numbers : undefined;
}

function numberRecord(value: Json | undefined): Map<string, number> | undefined {
  if (!isRecord(value)) return undefined;
  const entries = Object.entries(value);
  const numbers = entries.flatMap(([key, entry]) => (typeof entry === "number" && Number.isFinite(entry) ? [[key, entry] as const] : []));
  return numbers.length === entries.length ? new Map(numbers) : undefined;
}

function without(record: JsonRecord, keys: readonly string[]): JsonRecord {
  return Object.fromEntries(Object.entries(record).filter(([key]) => !keys.includes(key)));
}

function jsonOf(value: CanonicalValue): Json {
  return JSON.parse(stringifyJson(value) ?? "null");
}

function jsonRecordOf(text: string | undefined): JsonRecord | undefined {
  if (text === undefined) return undefined;
  const value: Json = JSON.parse(text);
  return isRecord(value) ? value : undefined;
}

function jsonTextOf(value: Json): string {
  return stringifyJson(value) ?? "null";
}

function mapRecords(values: Json[], convert: (record: JsonRecord) => JsonRecord): Json[] {
  let changed = false;
  const next = values.map((value) => {
    if (!isRecord(value)) return value;
    const converted = convert(value);
    if (converted !== value) changed = true;
    return converted;
  });
  return changed ? next : values;
}

function withArray(record: JsonRecord, key: string, convert: (item: JsonRecord) => JsonRecord): JsonRecord {
  const values = arrayField(record, key);
  if (values === undefined) return record;
  const next = mapRecords(values, convert);
  return next === values ? record : { ...record, [key]: next };
}

function withRecord(record: JsonRecord, key: string, convert: (item: JsonRecord) => JsonRecord): JsonRecord {
  const value = recordField(record, key);
  if (value === undefined) return record;
  const next = convert(value);
  return next === value ? record : { ...record, [key]: next };
}

function replaced(record: JsonRecord, removed: readonly string[], added: JsonRecord): JsonRecord {
  return { ...without(record, [...removed, ...Object.keys(added)]), ...added };
}

function sortedNumbers(values: ReadonlyMap<string, number>): number[] {
  return [...values.entries()].sort(([left], [right]) => left.localeCompare(right, undefined, { numeric: true })).map(([, value]) => value);
}

export {
  arrayField,
  field,
  isRecord,
  jsonOf,
  jsonRecordOf,
  jsonTextOf,
  numberField,
  numberList,
  numberRecord,
  positiveField,
  present,
  rawText,
  recordField,
  replaced,
  sortedNumbers,
  textField,
  withArray,
  withRecord,
  without,
};
export type { Json, JsonRecord };
