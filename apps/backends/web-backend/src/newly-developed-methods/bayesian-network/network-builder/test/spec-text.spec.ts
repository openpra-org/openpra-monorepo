import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { NetworkBuilderError } from "../core/errors";
import { parseSpecText } from "../core/spec-text";
import { hasKey, isMapping, isSequence } from "../core/spec-values";
import type { SpecValue } from "../core/spec-values";

interface ReadingCase {
  source: string;
  expected?: SpecValue;
  error?: boolean;
}

const loadCases = (path: string): ReadingCase[] => JSON.parse(readFileSync(path, "utf-8"));

const hasSkippedValue = (value: SpecValue): boolean => {
  if (isSequence(value)) return value.some((item) => hasSkippedValue(item));
  if (isMapping(value))
    return hasKey(value, "__skip__") || Object.keys(value).some((key) => hasSkippedValue(value[key]));
  return false;
};

const decodeExpected = (value: SpecValue): SpecValue => {
  if (isSequence(value)) return value.map((item) => decodeExpected(item));
  if (isMapping(value)) {
    if (hasKey(value, "__float__")) {
      if (value.__float__ === "nan") return NaN;
      return value.__float__ === "inf" ? Infinity : -Infinity;
    }
    const output: { [key: string]: SpecValue } = {};
    for (const key of Object.keys(value)) output[key] = decodeExpected(value[key]);
    return output;
  }
  return value;
};

const describeDifferences = (cases: readonly ReadingCase[]): string[] => {
  const differences: string[] = [];
  for (const entry of cases) {
    let actual: SpecValue = null;
    let failed = false;
    try {
      actual = parseSpecText("YAML", entry.source);
    } catch (error) {
      if (!(error instanceof NetworkBuilderError)) throw error;
      failed = true;
    }
    if (entry.error === true) {
      if (!failed) differences.push(`expected an error: ${JSON.stringify(entry.source)}`);
      continue;
    }
    const expected = entry.expected ?? null;
    if (hasSkippedValue(expected)) continue;
    if (failed) {
      differences.push(`unexpected error: ${JSON.stringify(entry.source)}`);
      continue;
    }
    const expectedText = JSON.stringify(decodeExpected(expected), (_key, item: SpecValue) =>
      typeof item === "number" && !Number.isFinite(item) ? String(item) : item,
    );
    const actualText = JSON.stringify(actual, (_key, item: SpecValue) =>
      typeof item === "number" && !Number.isFinite(item) ? String(item) : item,
    );
    if (expectedText !== actualText) {
      differences.push(`${JSON.stringify(entry.source)}: expected ${expectedText}, got ${actualText}`);
    }
  }
  return differences;
};

describe("network builder specification text", () => {
  it("reads YAML scalars, anchors and merges like the reference reader", () => {
    const cases = loadCases(join(__dirname, "fixtures", "yaml-reading.json"));
    expect(cases.length).toBeGreaterThan(400);
    expect(describeDifferences(cases)).toEqual([]);
  });

  it("reads the reference demo specifications identically", () => {
    const path = process.env.NETWORK_BUILDER_YAML_SPECS ?? "";
    if (path.length === 0 || !existsSync(path)) return;
    expect(describeDifferences(loadCases(path))).toEqual([]);
  });

  it("reads JSON and rejects invalid text", () => {
    expect(parseSpecText("JSON", '{"a": [1, 2.5, "x", null, true]}')).toEqual({ a: [1, 2.5, "x", null, true] });
    expect(parseSpecText("JSON", "null")).toEqual({});
    expect(() => parseSpecText("JSON", "{")).toThrow(NetworkBuilderError);
    expect(() => parseSpecText("YAML", "a: [1, 2")).toThrow(NetworkBuilderError);
  });
});
