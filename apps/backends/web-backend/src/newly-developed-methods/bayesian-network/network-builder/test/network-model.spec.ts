import { readFileSync } from "node:fs";
import { join } from "node:path";
import { NetworkBuilderError } from "../core/errors";
import { writeNetworkFile } from "../core/network-file-writer";
import { validateNetworkModel } from "../core/network-model";
import type { NetworkModel } from "../core/network-model";
import { parseJsonText } from "../core/spec-text";
import { getValue, hasKey, isMapping, isSequence, text, toFloat } from "../core/spec-values";
import type { SpecMapping, SpecValue } from "../core/spec-values";
import { compareFileText, createTally, note } from "./corpus-comparison";

const GENERATED_AT = new Date(Date.UTC(2026, 0, 1, 0, 0, 0));

const mappings = (value: SpecValue): SpecMapping[] => (isSequence(value) ? value.filter(isMapping) : []);

const texts = (value: SpecValue): string[] => (isSequence(value) ? value.map((item) => text(item)) : []);

const toModel = (source: SpecMapping): NetworkModel => {
  const metadata = getValue(source, "metadata");
  return {
    schemaVersion: text(getValue(source, "schema_version")),
    modelId: text(getValue(source, "model_id")),
    description: text(getValue(source, "description")),
    nodes: mappings(getValue(source, "nodes")).map((node) => {
      const nodeMetadata = getValue(node, "metadata");
      return {
        nodeId: text(getValue(node, "node_id")),
        kind: text(getValue(node, "kind")),
        states: texts(getValue(node, "states")),
        metadata: isMapping(nodeMetadata) ? nodeMetadata : {},
      };
    }),
    edges: mappings(getValue(source, "edges")).map((edge) => ({
      parent: text(getValue(edge, "parent")),
      child: text(getValue(edge, "child")),
    })),
    cpds: mappings(getValue(source, "cpds")).map((cpd) => {
      const table = getValue(cpd, "table");
      return {
        node: text(getValue(cpd, "node")),
        parents: texts(getValue(cpd, "parents")),
        table: isSequence(table) ? table.map((value) => toFloat(value)) : [],
      };
    }),
    metadata: isMapping(metadata) ? metadata : {},
  };
};

const compareModelCase = (entry: SpecMapping): string[] => {
  const tally = createTally();
  const source = getValue(entry, "model");
  const outcome = getValue(entry, "outcome");
  if (!isMapping(source) || !isMapping(outcome)) return ["reference case is incomplete"];
  const model = toModel(source);
  const expectedIssues = mappings(getValue(outcome, "issues")).map(
    (issue) => `[${text(getValue(issue, "code"))}] ${text(getValue(issue, "message"))}`,
  );
  const actualIssues = validateNetworkModel(model, toFloat(getValue(outcome, "tolerance"))).map(
    (issue) => `[${issue.code}] ${issue.message}`,
  );
  if (expectedIssues.join("\n") !== actualIssues.join("\n")) {
    note(tally, `issues: expected ${JSON.stringify(expectedIssues)} | got ${JSON.stringify(actualIssues)}`);
  }
  const variants: [string, boolean, boolean][] = [
    ["plain", false, false],
    ["layout", true, false],
    ["submodels", true, true],
  ];
  for (const [name, includeLayout, includeSubmodels] of variants) {
    if (!hasKey(outcome, name)) continue;
    try {
      const actual = writeNetworkFile(model, { includeLayout, includeSubmodels, generatedAt: GENERATED_AT });
      compareFileText(text(getValue(outcome, name)), actual, name, tally);
    } catch (error) {
      if (!(error instanceof NetworkBuilderError)) throw error;
      note(tally, `${name}: unexpected ${error.kind}: ${error.message}`);
    }
  }
  return tally.problems;
};

describe("network model validation and file writing", () => {
  it("reports the same issues and writes the same files as the reference", () => {
    const parsed = parseJsonText(readFileSync(join(__dirname, "fixtures", "models.json"), "utf-8"));
    const cases = mappings(parsed);
    expect(cases.length).toBeGreaterThan(70);
    const failures: string[] = [];
    for (const entry of cases) {
      const problems = compareModelCase(entry);
      if (problems.length > 0) failures.push(`${text(getValue(entry, "name"))}: ${problems.slice(0, 2).join(" ; ")}`);
    }
    expect(failures).toEqual([]);
  });

  it("refuses submodels without layout", () => {
    const model: NetworkModel = {
      schemaVersion: "0.1",
      modelId: "m",
      description: "d",
      nodes: [],
      edges: [],
      cpds: [],
      metadata: {},
    };
    expect(() =>
      writeNetworkFile(model, { includeLayout: false, includeSubmodels: true, generatedAt: GENERATED_AT }),
    ).toThrow("include_genie_submodels=True requires include_genie_extension=True.");
  });
});
