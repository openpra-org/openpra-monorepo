import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { validateBayesianNetworkModel } from "interfaces-shared-types/newly-developed-methods/bayesian-network";
import {
  exportCanonicalBayesianNetworkJson,
  importBayesianNetworkXdsl,
  readBayesianNetworkSubmodels,
} from "../bayesianNetworkInterchange";

interface BuiltNode {
  node_id: string;
  states: string[];
  parents: string[];
  table: number[];
}

interface BuiltCase {
  source: string;
  outcome: { ok: boolean; valid?: boolean; nodes?: BuiltNode[]; xdsl_submodels?: string };
}

interface CanonicalVariable {
  name: string;
  states: string[];
  parents: string[];
  probabilities: number[];
}

const directory = process.env.NETWORK_BUILDER_CORPUS ?? join(__dirname, "fixtures", "builtNetworks");

const loadCases = (): BuiltCase[] =>
  readdirSync(directory)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => JSON.parse(readFileSync(join(directory, name), "utf-8")) as BuiltCase)
    .filter((entry) => entry.outcome.ok && entry.outcome.valid === true);

describe("networks built from a specification", () => {
  it("open in the editor with the same nodes, parents and probabilities", () => {
    const cases = loadCases();
    expect(cases.length).toBeGreaterThan(0);
    const problems: string[] = [];
    for (const entry of cases) {
      const nodes = entry.outcome.nodes ?? [];
      const model = importBayesianNetworkXdsl(entry.outcome.xdsl_submodels ?? "");
      const issues = validateBayesianNetworkModel(model).filter((issue) => issue.severity === "ERROR");
      if (issues.length > 0) problems.push(`${entry.source}: ${issues[0]!.message}`);
      const canonical = JSON.parse(exportCanonicalBayesianNetworkJson(model)) as { variables: CanonicalVariable[] };
      const variables = new Map(canonical.variables.map((variable) => [variable.name, variable]));
      if (variables.size !== nodes.length)
        problems.push(`${entry.source}: ${variables.size} nodes, expected ${nodes.length}`);
      for (const node of nodes) {
        const variable = variables.get(node.node_id);
        if (variable === undefined) {
          problems.push(`${entry.source}: node ${node.node_id} is missing`);
          continue;
        }
        if (variable.states.length !== node.states.length)
          problems.push(`${entry.source}: ${node.node_id} states differ`);
        if (variable.parents.join(" ") !== node.parents.join(" "))
          problems.push(`${entry.source}: ${node.node_id} parents differ`);
        if (
          variable.probabilities.length !== node.table.length ||
          variable.probabilities.some((value, index) => value !== node.table[index])
        ) {
          problems.push(`${entry.source}: ${node.node_id} probabilities differ`);
        }
      }
      const grouped = new Set(readBayesianNetworkSubmodels(model).flatMap((group) => group.nodeIds));
      if (grouped.size > model.nodes.length) problems.push(`${entry.source}: groups hold unknown nodes`);
    }
    expect(problems.slice(0, 20)).toEqual([]);
  });
});
