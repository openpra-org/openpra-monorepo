import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  getDefaultDgWeibullParams,
  getTable7Params,
  loadAndValidatePhaseR1DgDataset,
  loadAndValidatePhaseR1LoopDataset,
  validatePhaseR1DgDataset,
  validatePhaseR1LoopDataset,
} from "../builders/recovery-data";
import { NetworkBuilderError } from "../core/errors";
import { parseJsonText } from "../core/spec-text";
import { entriesOf, getValue, isMapping, isSequence, repr, text, truthy } from "../core/spec-values";
import type { SpecMapping, SpecValue } from "../core/spec-values";

interface DirectProblem {
  name: string;
  expected: string;
  actual: string;
}

const directPath =
  process.env.NETWORK_BUILDER_RECOVERY_DIRECT ?? join(__dirname, "fixtures", "recovery-data-direct.json");
const directReportPath = process.env.NETWORK_BUILDER_RECOVERY_DIRECT_REPORT ?? "";

const encodeNumber = (value: number): SpecValue => {
  if (Number.isNaN(value)) return { __float__: "nan" };
  if (value === Infinity) return { __float__: "inf" };
  if (value === -Infinity) return { __float__: "-inf" };
  return value;
};

const encode = (value: SpecValue): SpecValue => {
  if (typeof value === "number") return encodeNumber(value);
  if (isSequence(value)) return value.map((entry) => encode(entry));
  if (isMapping(value)) {
    const output: SpecMapping = {};
    for (const [key, entry] of entriesOf(value)) output[key] = encode(entry);
    return output;
  }
  return value;
};

const asData = (value: SpecValue): SpecMapping => (isMapping(value) ? value : {});

const asCategories = (value: SpecValue): string[] | null =>
  isSequence(value) ? value.map((entry) => text(entry)) : null;

const asCurveId = (value: SpecValue): string | null => (value === null ? null : text(value));

const evaluate = (functionName: string, data: SpecValue, argument: SpecValue): SpecValue => {
  if (functionName === "validate_loop") {
    validatePhaseR1LoopDataset(asData(data));
    return null;
  }
  if (functionName === "validate_dg") {
    validatePhaseR1DgDataset(asData(data));
    return null;
  }
  if (functionName === "table_7") {
    const parameters = getTable7Params(asData(data), asCategories(argument));
    return Array.from(parameters.entries()).map(([category, record]) => [category, record.mu, record.sigma]);
  }
  if (functionName === "dg_params") {
    const parameters = getDefaultDgWeibullParams(asData(data), asCurveId(argument));
    return [parameters.alpha, parameters.betaHours];
  }
  if (functionName === "load_loop") return loadAndValidatePhaseR1LoopDataset(null);
  if (functionName === "load_dg") return loadAndValidatePhaseR1DgDataset(null);
  throw new Error(`unsupported function ${functionName}`);
};

const describeOutcome = (functionName: string, data: SpecValue, argument: SpecValue): string => {
  try {
    return `ok ${repr(encode(evaluate(functionName, data, argument)))}`;
  } catch (error) {
    if (error instanceof NetworkBuilderError) return `error ${error.kind}: ${error.message}`;
    throw error;
  }
};

const describeExpected = (outcome: SpecMapping): string =>
  truthy(getValue(outcome, "ok")) ?
    `ok ${repr(getValue(outcome, "result"))}`
  : `error ${text(getValue(outcome, "error_type"))}: ${text(getValue(outcome, "error_message"))}`;

describe("recovery data reference calls", () => {
  it("reproduces every direct reference call", () => {
    const records = parseJsonText(readFileSync(directPath, "utf-8"));
    const problems: DirectProblem[] = [];
    let count = 0;
    if (isSequence(records)) {
      for (const record of records) {
        if (!isMapping(record)) continue;
        count += 1;
        const expected = describeExpected(asData(getValue(record, "outcome")));
        const actual = describeOutcome(
          text(getValue(record, "function")),
          getValue(record, "data"),
          getValue(record, "argument"),
        );
        if (expected !== actual) problems.push({ name: text(getValue(record, "name")), expected, actual });
      }
    }
    if (directReportPath.length > 0) {
      writeFileSync(directReportPath, JSON.stringify({ count, problems }, null, 1), "utf-8");
    }
    expect(count).toBeGreaterThan(0);
    expect(problems).toEqual([]);
  });

  it("rejects a dataset path", () => {
    expect(() => loadAndValidatePhaseR1LoopDataset("custom.json")).toThrow(
      "Recovery LOOP dataset path is not supported; only the built-in dataset is available.",
    );
    expect(() => loadAndValidatePhaseR1DgDataset("custom.json")).toThrow(
      "Recovery DG dataset path is not supported; only the built-in dataset is available.",
    );
  });
});
