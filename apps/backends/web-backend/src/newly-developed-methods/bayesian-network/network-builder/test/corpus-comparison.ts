import { createBuilder } from "../builders/factory";
import { compileNetworkModel } from "../core/compiler";
import { createModelContext } from "../core/context";
import { DiscretizationService } from "../core/discretization";
import { NetworkBuilderError } from "../core/errors";
import { assertValidNetworkModel } from "../core/network-model";
import type { NetworkModel } from "../core/network-model";
import { writeNetworkFile } from "../core/network-file-writer";
import { Orchestrator } from "../core/orchestrator";
import { getValue, hasKey, isMapping, isSequence, text } from "../core/spec-values";
import type { SpecMapping, SpecValue } from "../core/spec-values";

interface CaseReport {
  caseNumber: number;
  source: string;
  status: "match" | "mismatch" | "pending";
  problems: string[];
  maxDifference: number;
  exactNumbers: number;
  inexactNumbers: number;
}

interface Tally {
  problems: string[];
  maxDifference: number;
  exactNumbers: number;
  inexactNumbers: number;
}

const TOLERANCE = 1e-12;

const GENERATED_AT = new Date(Date.UTC(2026, 0, 1, 0, 0, 0));

const note = (tally: Tally, message: string): void => {
  if (tally.problems.length < 12) tally.problems.push(message);
};

const compareNumbers = (expected: number, actual: number, path: string, tally: Tally): void => {
  if (Object.is(expected, actual) || expected === actual) {
    tally.exactNumbers += 1;
    return;
  }
  const difference = Math.abs(expected - actual);
  const scale = Math.max(1, Math.abs(expected));
  if (Number.isFinite(difference) && difference <= TOLERANCE * scale) {
    tally.inexactNumbers += 1;
    if (difference > tally.maxDifference) tally.maxDifference = difference;
    return;
  }
  note(tally, `${path}: expected ${expected}, got ${actual}`);
};

const specialFloat = (value: SpecMapping): number | null => {
  if (!hasKey(value, "__float__")) return null;
  const tag = text(value.__float__);
  if (tag === "nan") return NaN;
  if (tag === "inf") return Infinity;
  return -Infinity;
};

const compareValues = (expected: SpecValue, actual: SpecValue | undefined, path: string, tally: Tally): void => {
  if (actual === undefined) {
    note(tally, `${path}: missing`);
    return;
  }
  if (typeof expected === "number") {
    if (typeof actual !== "number") note(tally, `${path}: expected number ${expected}, got ${JSON.stringify(actual)}`);
    else compareNumbers(expected, actual, path, tally);
    return;
  }
  if (isSequence(expected)) {
    if (!isSequence(actual)) {
      note(tally, `${path}: expected list, got ${JSON.stringify(actual)}`);
      return;
    }
    if (expected.length !== actual.length) {
      note(tally, `${path}: expected length ${expected.length}, got ${actual.length}`);
      return;
    }
    expected.forEach((item, index) => compareValues(item, actual[index], `${path}[${index}]`, tally));
    return;
  }
  if (isMapping(expected)) {
    const special = specialFloat(expected);
    if (special !== null) {
      if (typeof actual !== "number" || !Object.is(special, actual)) {
        note(tally, `${path}: expected ${special}, got ${JSON.stringify(actual)}`);
      }
      return;
    }
    if (!isMapping(actual)) {
      note(tally, `${path}: expected mapping, got ${JSON.stringify(actual)}`);
      return;
    }
    for (const key of Object.keys(expected)) {
      compareValues(expected[key], hasKey(actual, key) ? actual[key] : undefined, `${path}.${key}`, tally);
    }
    for (const key of Object.keys(actual)) {
      if (!hasKey(expected, key)) note(tally, `${path}.${key}: unexpected key`);
    }
    return;
  }
  if (expected !== actual) note(tally, `${path}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
};

const replaceBetween = (source: string, open: string, close: string, replacement: string): string => {
  const start = source.indexOf(open);
  if (start < 0) return source;
  const end = source.indexOf(close, start);
  if (end < 0) return source;
  return source.slice(0, start + open.length) + replacement + source.slice(end);
};

const normalizeFileText = (source: string): string => replaceBetween(source, "<comment>", "</comment>", "generated");

const compareFileText = (expectedRaw: string, actualRaw: string, path: string, tally: Tally): void => {
  const expected = normalizeFileText(expectedRaw).split("\n");
  const actual = normalizeFileText(actualRaw).split("\n");
  if (expected.length !== actual.length) {
    note(tally, `${path}: expected ${expected.length} lines, got ${actual.length}`);
    return;
  }
  const open = "<probabilities>";
  const close = "</probabilities>";
  for (let index = 0; index < expected.length; index += 1) {
    const expectedLine = expected[index];
    const actualLine = actual[index];
    if (expectedLine === actualLine) continue;
    const expectedStart = expectedLine.indexOf(open);
    const actualStart = actualLine.indexOf(open);
    if (expectedStart < 0 || actualStart !== expectedStart) {
      note(
        tally,
        `${path} line ${index + 1}: expected ${expectedLine.slice(0, 160)} | got ${actualLine.slice(0, 160)}`,
      );
      continue;
    }
    const expectedTokens = expectedLine.slice(expectedStart + open.length, expectedLine.indexOf(close)).split(" ");
    const actualTokens = actualLine.slice(actualStart + open.length, actualLine.indexOf(close)).split(" ");
    if (expectedTokens.length !== actualTokens.length) {
      note(tally, `${path} line ${index + 1}: expected ${expectedTokens.length} values, got ${actualTokens.length}`);
      continue;
    }
    expectedTokens.forEach((token, position) => {
      if (token === actualTokens[position]) return;
      compareNumbers(
        Number(token),
        Number(actualTokens[position]),
        `${path} line ${index + 1} value ${position}`,
        tally,
      );
    });
  }
};

const mappingList = (value: SpecValue): SpecMapping[] => (isSequence(value) ? value.filter(isMapping) : []);

const compareModel = (outcome: SpecMapping, model: NetworkModel, tally: Tally): void => {
  const expectedNodes = mappingList(getValue(outcome, "nodes"));
  if (expectedNodes.length !== model.nodes.length) {
    note(tally, `nodes: expected ${expectedNodes.length}, got ${model.nodes.length}`);
  }
  const cpdByNode = new Map(model.cpds.map((cpd) => [cpd.node, cpd]));
  expectedNodes.forEach((expectedNode, index) => {
    const actualNode = model.nodes[index];
    const nodeId = text(getValue(expectedNode, "node_id"));
    if (actualNode === undefined || actualNode.nodeId !== nodeId) {
      note(tally, `node ${index}: expected id ${nodeId}, got ${actualNode === undefined ? "none" : actualNode.nodeId}`);
      return;
    }
    const cpd = cpdByNode.get(nodeId);
    compareValues(getValue(expectedNode, "states"), actualNode.states, `${nodeId}.states`, tally);
    compareValues(getValue(expectedNode, "metadata"), actualNode.metadata, `${nodeId}.metadata`, tally);
    compareValues(getValue(expectedNode, "parents"), cpd === undefined ? [] : cpd.parents, `${nodeId}.parents`, tally);
    compareValues(getValue(expectedNode, "table"), cpd === undefined ? [] : cpd.table, `${nodeId}.table`, tally);
  });
  compareValues(getValue(outcome, "ir_metadata"), model.metadata, "model.metadata", tally);
};

const compareFiles = (outcome: SpecMapping, model: NetworkModel, tally: Tally): void => {
  const variants: [string, boolean, boolean][] = [
    ["xdsl_plain", false, false],
    ["xdsl_layout", true, false],
    ["xdsl_submodels", true, true],
  ];
  for (const [name, includeLayout, includeSubmodels] of variants) {
    const expected = getValue(outcome, name);
    if (typeof expected !== "string") continue;
    const actual = writeNetworkFile(model, { includeLayout, includeSubmodels, generatedAt: GENERATED_AT });
    compareFileText(expected, actual, name, tally);
  }
};

const compareCase = (record: SpecMapping): CaseReport => {
  const tally: Tally = { problems: [], maxDifference: 0, exactNumbers: 0, inexactNumbers: 0 };
  const caseNumber = Number(getValue(record, "case"));
  const source = text(getValue(record, "source"));
  const outcome = getValue(record, "outcome");
  const finish = (status: CaseReport["status"]): CaseReport => ({ caseNumber, source, status, ...tally });
  if (!isMapping(outcome)) {
    note(tally, "reference outcome missing");
    return finish("mismatch");
  }
  const discretization = getValue(record, "discretization");
  const metadata = getValue(record, "metadata");
  const expectedOk = getValue(outcome, "ok") === true;
  let model: NetworkModel;
  try {
    const context = createModelContext({
      schemaVersion: text(getValue(record, "schema_version")),
      modelId: text(getValue(record, "model_id")),
      description: text(getValue(record, "description")),
      discretization: new DiscretizationService(isMapping(discretization) ? discretization : null),
      metadata: isMapping(metadata) ? metadata : {},
    });
    const builders = mappingList(getValue(record, "builders")).map((config) => createBuilder(config));
    const couplings = mappingList(getValue(record, "couplings")).map((rule) => ({
      parentKey: text(getValue(rule, "parent_key")),
      childKey: text(getValue(rule, "child_key")),
    }));
    const summary = new Orchestrator(builders, couplings).run(context);
    if (!expectedOk) {
      note(tally, `expected ${text(getValue(outcome, "error_type"))}: ${text(getValue(outcome, "error_message"))}`);
      return finish("mismatch");
    }
    compareValues(getValue(outcome, "builder_order"), summary.builderOrder, "builder_order", tally);
    compareValues(getValue(outcome, "couplings_applied"), summary.couplingsApplied, "couplings_applied", tally);
    model = compileNetworkModel(context);
  } catch (error) {
    if (!(error instanceof NetworkBuilderError)) throw error;
    if (error.kind === "NotPorted") return finish("pending");
    if (expectedOk) {
      note(tally, `unexpected ${error.kind}: ${error.message}`);
      return finish("mismatch");
    }
    if (error.kind !== text(getValue(outcome, "error_type"))) {
      note(tally, `error type: expected ${text(getValue(outcome, "error_type"))}, got ${error.kind}`);
    }
    if (error.message !== text(getValue(outcome, "error_message"))) {
      note(tally, `error message: expected ${text(getValue(outcome, "error_message"))} | got ${error.message}`);
    }
    return finish(tally.problems.length === 0 ? "match" : "mismatch");
  }
  if (hasKey(outcome, "compile_error")) {
    note(tally, "reference recorded a compile error");
    return finish("mismatch");
  }
  compareModel(outcome, model, tally);
  let validationMessage: string | null = null;
  try {
    assertValidNetworkModel(model, 1e-9);
  } catch (error) {
    if (!(error instanceof NetworkBuilderError)) throw error;
    validationMessage = error.message;
  }
  const expectedValidation = getValue(outcome, "validation_error");
  const expectedMessage = isMapping(expectedValidation) ? text(getValue(expectedValidation, "message")) : null;
  if (expectedMessage !== validationMessage) {
    note(tally, `validation: expected ${String(expectedMessage)} | got ${String(validationMessage)}`);
  }
  if (validationMessage === null && expectedMessage === null) compareFiles(outcome, model, tally);
  return finish(tally.problems.length === 0 ? "match" : "mismatch");
};

const createTally = (): Tally => ({ problems: [], maxDifference: 0, exactNumbers: 0, inexactNumbers: 0 });

export type { CaseReport, Tally };
export { compareCase, compareFileText, compareValues, createTally, note };
