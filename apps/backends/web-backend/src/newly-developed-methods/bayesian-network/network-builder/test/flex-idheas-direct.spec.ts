import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  aggregateTableHep,
  getRowById,
  getRowBySubject,
  getRowHep,
  getTable,
  getTableRows,
  loadAndValidatePhase0Dataset,
  loadPhase0Dataset,
  validatePhase0Dataset,
} from "../builders/flex-idheas-data";
import { NetworkBuilderError } from "../core/errors";
import { parseJsonText } from "../core/spec-text";
import { getValue, hasKey, isMapping, isSequence, keysOf, recordKeyOrder, text } from "../core/spec-values";
import type { SpecMapping, SpecValue } from "../core/spec-values";
import { FLEX_IDHEAS_ECA_PHASE0 } from "../data/flex-idheas-eca-phase0";

const directPath = process.env.NETWORK_BUILDER_FLEX_DIRECT ?? join(__dirname, "fixtures", "flex-idheas-direct.json");

interface Outcome {
  ok: boolean;
  result: SpecValue;
  errorType: string;
  errorMessage: string;
}

const decodeNumbers = (value: SpecValue): SpecValue => {
  if (isSequence(value)) return value.map((item) => decodeNumbers(item));
  if (isMapping(value)) {
    if (hasKey(value, "__float__") && keysOf(value).length === 1) {
      if (value.__float__ === "nan") return NaN;
      return value.__float__ === "inf" ? Infinity : -Infinity;
    }
    const output: SpecMapping = {};
    for (const key of keysOf(value)) output[key] = decodeNumbers(value[key]);
    return output;
  }
  return value;
};

const cloneValue = (value: SpecValue): SpecValue => {
  if (isSequence(value)) return value.map((item) => cloneValue(item));
  if (isMapping(value)) {
    const output: SpecMapping = {};
    const keys = keysOf(value);
    for (const key of keys) output[key] = cloneValue(value[key]);
    return recordKeyOrder(output, keys);
  }
  return value;
};

const childOf = (target: SpecValue, step: SpecValue): SpecValue => {
  if (isSequence(target) && typeof step === "number") return target[step] ?? null;
  if (isMapping(target)) return getValue(target, text(step));
  return null;
};

const applyPatch = (base: SpecValue, operations: SpecValue): SpecValue => {
  let output = cloneValue(base);
  for (const operation of isSequence(operations) ? operations.filter(isMapping) : []) {
    const path = getValue(operation, "path");
    const steps = isSequence(path) ? path : [];
    const removing = getValue(operation, "op") === "delete";
    const value = cloneValue(decodeNumbers(getValue(operation, "value")));
    if (steps.length === 0) {
      output = value;
      continue;
    }
    let target = output;
    for (const step of steps.slice(0, -1)) target = childOf(target, step);
    const last = steps[steps.length - 1];
    if (isSequence(target) && typeof last === "number") {
      if (removing) target.splice(last, 1);
      else target[last] = value;
    } else if (isMapping(target)) {
      const key = text(last);
      if (removing) {
        Reflect.deleteProperty(target, key);
      } else {
        const keys = hasKey(target, key) ? keysOf(target) : [...keysOf(target), key];
        target[key] = value;
        recordKeyOrder(target, keys);
      }
    }
  }
  return output;
};

const resolveData = (record: SpecMapping): SpecValue =>
  hasKey(record, "patch") ?
    applyPatch(FLEX_IDHEAS_ECA_PHASE0, getValue(record, "patch"))
  : decodeNumbers(getValue(record, "data"));

const describeValue = (value: SpecValue): string => {
  if (typeof value === "number") return String(value);
  if (isSequence(value)) return `list(${value.length})`;
  if (isMapping(value)) return `mapping(${keysOf(value).join(",")})`;
  return JSON.stringify(value);
};

const collectDifferences = (expected: SpecValue, actual: SpecValue, path: string, differences: string[]): void => {
  if (typeof expected === "number" && typeof actual === "number") {
    const same = Number.isNaN(expected) ? Number.isNaN(actual) : expected === actual;
    if (!same) differences.push(`${path}: expected ${expected}, got ${actual}`);
    return;
  }
  if (isSequence(expected) && isSequence(actual)) {
    if (expected.length !== actual.length) {
      differences.push(`${path}: expected length ${expected.length}, got ${actual.length}`);
      return;
    }
    expected.forEach((item, index) => collectDifferences(item, actual[index], `${path}[${index}]`, differences));
    return;
  }
  if (isMapping(expected) && isMapping(actual)) {
    const expectedKeys = keysOf(expected);
    const actualKeys = keysOf(actual);
    if (expectedKeys.join("\u0000") !== actualKeys.join("\u0000")) {
      differences.push(`${path}: expected keys ${expectedKeys.join(",")}, got ${actualKeys.join(",")}`);
      return;
    }
    for (const key of expectedKeys) collectDifferences(expected[key], actual[key], `${path}.${key}`, differences);
    return;
  }
  if (expected !== actual)
    differences.push(`${path}: expected ${describeValue(expected)}, got ${describeValue(actual)}`);
};

const optionalText = (argumentValues: SpecMapping, key: string): string | null => {
  const value = getValue(argumentValues, key);
  return value === null ? null : text(value);
};

const requiredText = (argumentValues: SpecMapping, key: string): string => text(getValue(argumentValues, key));

const callFunction = (name: string, data: SpecMapping, argumentValues: SpecMapping): SpecValue => {
  if (name === "load_phase0_dataset") return loadPhase0Dataset();
  if (name === "load_and_validate_phase0_dataset") return loadAndValidatePhase0Dataset();
  if (name === "validate_phase0_dataset") {
    validatePhase0Dataset(data);
    return null;
  }
  const tableKey = requiredText(argumentValues, "table_key");
  if (name === "aggregate_table_hep") {
    return aggregateTableHep(
      data,
      tableKey,
      requiredText(argumentValues, "policy"),
      optionalText(argumentValues, "subject_id"),
    );
  }
  if (name === "get_table") return getTable(data, tableKey);
  if (name === "get_table_rows") return getTableRows(data, tableKey);
  if (name === "get_row_by_id") return getRowById(data, tableKey, requiredText(argumentValues, "row_id"));
  if (name === "get_row_by_subject") return getRowBySubject(data, tableKey, requiredText(argumentValues, "subject_id"));
  if (name === "get_row_hep") {
    return getRowHep(
      data,
      tableKey,
      optionalText(argumentValues, "row_id"),
      optionalText(argumentValues, "subject_id"),
    );
  }
  throw new Error(`no direct call is defined for ${name}`);
};

const runCase = (name: string, data: SpecMapping, argumentValues: SpecMapping): Outcome => {
  try {
    return { ok: true, result: callFunction(name, data, argumentValues), errorType: "", errorMessage: "" };
  } catch (error) {
    if (error instanceof NetworkBuilderError) {
      return { ok: false, result: null, errorType: error.kind, errorMessage: error.message };
    }
    throw error;
  }
};

const compareCase = (record: SpecMapping): string[] => {
  const name = text(getValue(record, "name"));
  const data = resolveData(record);
  const argumentValues = getValue(record, "arguments");
  if (!isMapping(data) || !isMapping(argumentValues)) return [`${name}: the case record is malformed`];
  const outcome = runCase(text(getValue(record, "function")), data, argumentValues);
  const expectedOk = getValue(record, "ok") === true;
  if (expectedOk !== outcome.ok) {
    const actual = outcome.ok ? "a result" : `${outcome.errorType}: ${outcome.errorMessage}`;
    const expected =
      expectedOk ? "a result" : `${text(getValue(record, "error_type"))}: ${text(getValue(record, "error_message"))}`;
    return [`${name}: expected ${expected}, got ${actual}`];
  }
  if (!expectedOk) {
    const differences: string[] = [];
    if (outcome.errorType !== getValue(record, "error_type")) {
      differences.push(
        `${name}: expected error type ${text(getValue(record, "error_type"))}, got ${outcome.errorType}`,
      );
    }
    if (outcome.errorMessage !== getValue(record, "error_message")) {
      differences.push(
        `${name}: expected message ${text(getValue(record, "error_message"))}, got ${outcome.errorMessage}`,
      );
    }
    return differences;
  }
  const differences: string[] = [];
  collectDifferences(decodeNumbers(getValue(record, "result")), outcome.result, name, differences);
  return differences;
};

describe("flex IDHEAS dataset helpers against the reference", () => {
  it("reproduces every direct reference call", () => {
    const parsed = parseJsonText(readFileSync(directPath, "utf-8"));
    const cases = isMapping(parsed) ? getValue(parsed, "cases") : null;
    const records: SpecMapping[] = isSequence(cases) ? cases.filter(isMapping) : [];
    const differences: string[] = [];
    for (const record of records) differences.push(...compareCase(record));
    expect(records.length).toBeGreaterThan(0);
    expect(differences).toEqual([]);
  });
});
