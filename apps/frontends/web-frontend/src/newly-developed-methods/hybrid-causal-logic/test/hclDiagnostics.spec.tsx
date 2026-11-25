import { render, screen } from "@testing-library/react";
import type { EventTreeSequenceDiagnostics } from "interfaces-shared-types/newly-developed-methods/event-tree";
import type { HclQuantificationResult } from "interfaces-shared-types/newly-developed-methods/hybrid-causal-logic";
import { HclResults } from "../hclResults";
import { eventResult, eventBatch, eventOption, endStateUq } from "./hclResultFixtures";

const data: EventTreeSequenceDiagnostics = {
  bdd: { nodes: 8, variables: 3, variableOrder: ["Pump", "Power", "Earthquake"] },
  bridge: {
    quantifications: 1,
    bddContextCacheHits: 2,
    bddContextCacheMisses: 7,
    bnQueryCacheHits: 5,
    bnQueryCacheMisses: 4,
  },
  junctionTree: { numCliques: 2, maxCliqueSize: 3, treewidth: 2, totalTableEntries: 12 },
};
const props = { runResult: null, batchRunResult: null, eventTreeOptions: [eventOption], faultTreeOptions: [] };
const ft: HclQuantificationResult = {
  ...eventResult(),
  probability: 0.1,
  uncertainty: endStateUq,
  faultTreeTopGate: { referenceType: "FAULT_TREE_TOP_EVENT", workbookId: "sy", modelId: "ft", entityId: "top" },
  bddNodes: 8,
  bddVariables: 3,
  variableOrder: data.bdd!.variableOrder,
  bridge: data.bridge!,
  junctionTree: data.junctionTree!,
  compilationReuse: { bddCompilations: 1, junctionTreeCompilations: 1, scenarioEvaluations: 1 },
};

function expectNoDiagnostics(): void {
  expect(screen.queryByText("Solver diagnostics")).not.toBeInTheDocument();
  expect(screen.queryByText("Batch compilation diagnostics")).not.toBeInTheDocument();
  expect(screen.queryByText("Point evaluations")).not.toBeInTheDocument();
  expect(screen.queryByText("FT BDD compilations")).not.toBeInTheDocument();
  expect(screen.queryByText("Sequence BDD compilations")).not.toBeInTheDocument();
}

it.each(["PROBABILITY", "UNCERTAINTY"] as const)(
  "shows no diagnostics in a fault tree result or a scenario row in %s mode",
  (calculationType) => {
    const view = render(
      <HclResults
        {...props}
        runResult={{ kind: "FAULT_TREE", result: ft }}
        calculationType={calculationType}
      />,
    );
    expectNoDiagnostics();
    const batch = eventBatch();
    batch.scenarios = [{ ...batch.scenarios[0]!, result: { kind: "FAULT_TREE", result: ft } }];
    view.rerender(
      <HclResults
        {...props}
        batchRunResult={batch}
        workflow="BATCH"
        calculationType={calculationType}
      />,
    );
    expectNoDiagnostics();
  },
);

it.each(["PROBABILITY", "UNCERTAINTY"] as const)(
  "shows no diagnostics under an event tree sequence in %s mode",
  (calculationType) => {
    const result = eventResult();
    result.sequences = [{ ...result.sequences[1]!, diagnostics: data }];
    render(
      <HclResults
        {...props}
        runResult={{ kind: "EVENT_TREE", result }}
        calculationType={calculationType}
      />,
    );
    expectNoDiagnostics();
  },
);
