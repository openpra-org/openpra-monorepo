import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NetworkBuilderError } from "../core/errors";
import { parseJsonText } from "../core/spec-text";
import { getValue, isMapping, isSequence, text } from "../core/spec-values";
import type { SpecMapping, SpecValue } from "../core/spec-values";
import { buildNetwork } from "../network-builder";
import { compareFileText, compareValues, createTally, note } from "./corpus-comparison";

const GENERATED_AT = new Date(Date.UTC(2026, 0, 1, 0, 0, 0));

const loadCases = (): SpecMapping[] => {
  const parsed = parseJsonText(readFileSync(join(__dirname, "fixtures", "documents.json"), "utf-8"));
  return isSequence(parsed) ? parsed.filter(isMapping) : [];
};

const compareDocument = (entry: SpecMapping): string[] => {
  const tally = createTally();
  const outcome = getValue(entry, "outcome");
  if (!isMapping(outcome)) return ["reference outcome missing"];
  const expectedOk = getValue(outcome, "ok") === true;
  try {
    const result = buildNetwork(getValue(entry, "document"), { generatedAt: GENERATED_AT });
    if (!expectedOk) {
      note(tally, `expected ${text(getValue(outcome, "error_type"))}: ${text(getValue(outcome, "error_message"))}`);
      return tally.problems;
    }
    compareValues(getValue(outcome, "builder_order"), result.summary.builderOrder, "builder_order", tally);
    compareValues(getValue(outcome, "couplings_applied"), result.summary.couplingsApplied, "couplings_applied", tally);
    const cpds = new Map(result.model.cpds.map((cpd) => [cpd.node, cpd]));
    const actualNodes: SpecValue[] = result.model.nodes.map((node) => ({
      node_id: node.nodeId,
      states: node.states,
      parents: cpds.get(node.nodeId)?.parents ?? [],
      table: cpds.get(node.nodeId)?.table ?? [],
    }));
    compareValues(getValue(outcome, "nodes"), actualNodes, "nodes", tally);
    compareFileText(text(getValue(outcome, "file_text")), result.fileText, "file", tally);
  } catch (error) {
    if (!(error instanceof NetworkBuilderError)) throw error;
    if (expectedOk) {
      note(tally, `unexpected ${error.kind}: ${error.message}`);
    } else {
      if (error.kind !== text(getValue(outcome, "error_type"))) {
        note(tally, `error type: expected ${text(getValue(outcome, "error_type"))}, got ${error.kind}`);
      }
      if (error.message !== text(getValue(outcome, "error_message"))) {
        note(tally, `error message: expected ${text(getValue(outcome, "error_message"))} | got ${error.message}`);
      }
    }
  }
  return tally.problems;
};

describe("network builder whole documents", () => {
  it("builds or rejects every reference document the same way", () => {
    const cases = loadCases();
    expect(cases.length).toBeGreaterThan(200);
    const failures: string[] = [];
    for (const entry of cases) {
      const problems = compareDocument(entry);
      if (problems.length > 0) failures.push(`${text(getValue(entry, "name"))}: ${problems.slice(0, 2).join(" ; ")}`);
    }
    expect(failures).toEqual([]);
  });
});
