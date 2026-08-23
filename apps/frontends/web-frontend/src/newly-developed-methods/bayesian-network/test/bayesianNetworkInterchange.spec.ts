import {
  exportBayesianNetworkJson,
  exportBayesianNetworkXdsl,
  importBayesianNetworkJson,
  importBayesianNetworkXdsl,
} from "../bayesianNetworkInterchange";
import { connectNodes } from "../bayesianNetworkOperations";
import { TEST_ID, testBayesianNetworkModel } from "./bayesianNetworkTestModel";

describe("Bayesian-network interchange", () => {
  it("round-trips a canonical model through OpenPRA JSON", () => {
    const original = connectNodes(testBayesianNetworkModel(), TEST_ID.a, TEST_ID.b);
    expect(importBayesianNetworkJson(exportBayesianNetworkJson(original))).toEqual(original);
  });

  it("exports and imports discrete XDSL while preserving parent order and probabilities", () => {
    const connected = connectNodes(testBayesianNetworkModel(), TEST_ID.a, TEST_ID.b);
    const table = connected.conditionalProbabilityTables.find(({ nodeId }) => nodeId === TEST_ID.b)!;
    const withConditionalValues = {
      ...connected,
      conditionalProbabilityTables: connected.conditionalProbabilityTables.map((candidate) =>
        candidate.nodeId === TEST_ID.b
          ? {
              ...table,
              rows: table.rows.map((row, index) => ({
                ...row,
                values: [
                  { stateId: TEST_ID.bFalse, probability: index === 0 ? 0.9 : 0.2 },
                  { stateId: TEST_ID.bTrue, probability: index === 0 ? 0.1 : 0.8 },
                ] as typeof row.values,
              })),
            }
          : candidate,
      ),
    };

    const xdsl = exportBayesianNetworkXdsl(withConditionalValues);
    const imported = importBayesianNetworkXdsl(xdsl, testBayesianNetworkModel());
    const importedB = imported.nodes.find(({ code }) => code === "B")!;
    const importedTable = imported.conditionalProbabilityTables.find(({ nodeId }) => nodeId === importedB.id)!;

    expect(xdsl).toContain('<cpt id="B">');
    expect(xdsl).toContain("<parents>A</parents>");
    expect(importedTable.parents).toHaveLength(1);
    expect(importedTable.rows.map((row) => row.values.map(({ probability }) => probability))).toEqual([
      [0.9, 0.1],
      [0.2, 0.8],
    ]);
  });

  it("rejects unsupported XDSL node families", () => {
    expect(() => importBayesianNetworkXdsl(
      '<smile><nodes><decision id="D"><state id="no"/></decision></nodes></smile>',
    )).toThrow(/Only discrete CPT nodes/i);
  });
});
