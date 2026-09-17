import { fireEvent, render, screen, within } from "@testing-library/react";
import type { EventTreeSequenceDiagnostics } from "interfaces-shared-types/newly-developed-methods/event-tree";
import type { HclQuantificationResult } from "interfaces-shared-types/newly-developed-methods/hybrid-causal-logic";
import { HclCompilationDiagnostics, HclSolverDiagnostics } from "../hclDiagnostics";
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
};
const expand = (label = "Solver diagnostics") => fireEvent.click(screen.getByText(label, { selector: "summary" }));
const metric = (label: string) => screen.getByText(label, { selector: "dt" }).nextElementSibling;

it("renders main's FT diagnostics in manual probability and labels counter scope", async () => {
  render(
    <HclResults
      {...props}
      runResult={{ kind: "FAULT_TREE", result: ft }}
    />,
  );
  expect(screen.queryByText("Point evaluations")).not.toBeInTheDocument();
  expand();
  await screen.findByText("Point evaluations");
  expect(metric("Point evaluations")).toHaveTextContent("1");
  expect(metric("BN-query cache hits")).toHaveTextContent("5");
  expect(metric("BN-query cache misses")).toHaveTextContent("4");
  expect(metric("Allocated BDD nodes (excluding terminals)")).toHaveTextContent("8");
  expect(metric("Total table entries")).toHaveTextContent("12");
  expect(screen.getByText(/Counters exclude uncertainty sampling and hazard-weight queries/)).toBeInTheDocument();
  expect(
    within(screen.getByRole("list", { name: "Actual BDD variable order" }))
      .getAllByRole("listitem")
      .map((row) => row.textContent),
  ).toEqual(["Pump", "Power", "Earthquake"]);
});

it.each(["PROBABILITY", "UNCERTAINTY"] as const)(
  "exposes FT scenario diagnostics in %s mode",
  async (calculationType) => {
    const batch = eventBatch();
    batch.scenarios = [{ ...batch.scenarios[0]!, result: { kind: "FAULT_TREE", result: ft } }];
    render(
      <HclResults
        {...props}
        batchRunResult={batch}
        workflow="BATCH"
        calculationType={calculationType}
      />,
    );
    expand();
    await screen.findByText("Point evaluations");
    expect(metric("Point evaluations")).toHaveTextContent("1");
    expect(metric("BDD-context cache misses")).toHaveTextContent("7");
  },
);

it.each(["PROBABILITY", "UNCERTAINTY"] as const)(
  "exposes each ET sequence's diagnostics in %s mode",
  async (calculationType) => {
    const result = eventResult();
    result.sequences = [{ ...result.sequences[1]!, diagnostics: data }];
    render(
      <HclResults
        {...props}
        runResult={{ kind: "EVENT_TREE", result }}
        calculationType={calculationType}
      />,
    );
    expand();
    await screen.findByText("Point evaluations");
    expect(metric("Point evaluations")).toHaveTextContent("1");
    expect(screen.getByRole("list", { name: "Actual BDD variable order" })).toHaveTextContent("Pump");
  },
);

it("does not confuse historical missing diagnostics with zeros or an unconditional sequence", async () => {
  render(<HclSolverDiagnostics resetKey="old" />);
  expand();
  expect(await screen.findByText("Solver diagnostics were not recorded for this result.")).toBeInTheDocument();
  expect(screen.queryByText(/No BDD built/)).not.toBeInTheDocument();
  expect(screen.queryByRole("definition")).not.toBeInTheDocument();
});

it("identifies an unconditional sequence without inventing BDD or bridge metrics", async () => {
  render(
    <HclSolverDiagnostics
      diagnostics={{ bdd: null, bridge: null, junctionTree: data.junctionTree }}
      resetKey="constant"
    />,
  );
  expand();
  expect(await screen.findByText("No BDD built: unconditional sequence.")).toBeInTheDocument();
  expect(screen.getByText("HCL bridge not used for this sequence.")).toBeInTheDocument();
  expect(metric("Cliques")).toHaveTextContent("2");
  expect(screen.queryByText("BDD variables")).not.toBeInTheDocument();
});

it("pages actual order without sorting or truncating it, and resets on a new result", async () => {
  const diagnostics = {
    ...data,
    bdd: { ...data.bdd!, variableOrder: Array.from({ length: 63 }, (_, index) => `event-${63 - index}`) },
  };
  const view = render(
    <HclSolverDiagnostics
      diagnostics={diagnostics}
      resetKey="first"
    />,
  );
  expect(screen.queryByText("event-63")).not.toBeInTheDocument();
  expand();
  await screen.findByText("event-63");
  fireEvent.click(screen.getByRole("button", { name: "Last" }));
  expect(screen.getByText("event-1")).toBeInTheDocument();
  expect(screen.getByRole("list", { name: "Actual BDD variable order" })).toHaveAttribute("start", "51");
  view.rerender(
    <HclSolverDiagnostics
      diagnostics={diagnostics}
      resetKey="next"
    />,
  );
  expect(screen.getByText("event-63")).toBeInTheDocument();
});

it("shows zero compilation counts for skipped batches and labels their batch scope", async () => {
  render(
    <HclCompilationDiagnostics
      stats={{ sequenceBddCompilations: 0, junctionTreeCompilations: 1, scenarioEvaluations: 0 }}
    />,
  );
  expand("Batch compilation diagnostics");
  await screen.findByText("Sequence BDD compilations");
  expect(metric("Sequence BDD compilations")).toHaveTextContent("0");
  expect(metric("Evaluated evidence rows")).toHaveTextContent("0");
  expect(screen.getByText(/Counts cover the entire evidence batch/)).toBeInTheDocument();
  expect(screen.getByText(/Uncertainty sample-chunk compilations are excluded/)).toBeInTheDocument();
});

it("labels unavailable batch counts rather than assuming one compilation", async () => {
  render(<HclCompilationDiagnostics />);
  expand("Batch compilation diagnostics");
  expect(await screen.findByText("Compilation counts were not recorded for this batch.")).toBeInTheDocument();
  expect(screen.queryByRole("definition")).not.toBeInTheDocument();
});

it("keeps compilation counts unchanged when filtering outcomes", async () => {
  const batch = {
    ...eventBatch(),
    compilationReuse: { sequenceBddCompilations: 3, junctionTreeCompilations: 1, scenarioEvaluations: 2 },
  };
  render(
    <HclResults
      {...props}
      batchRunResult={batch}
      workflow="BATCH"
    />,
  );
  fireEvent.change(screen.getByRole("combobox", { name: "End state" }), { target: { value: "release" } });
  expand("Batch compilation diagnostics");
  await screen.findByText("Sequence BDD compilations");
  expect(metric("Sequence BDD compilations")).toHaveTextContent("3");
  expect(metric("Evaluated evidence rows")).toHaveTextContent("2");
});
