import { fireEvent, render, screen, within } from "@testing-library/react";
import type { EventTree } from "interfaces-mef-types/es/event-sequence-analysis";
import { EndState } from "interfaces-mef-types/core/events";
import type {
  HclFaultTreeHazardConvolutionResult,
  HclQuantificationResult,
  HclUncertaintySummary,
} from "interfaces-shared-types/newly-developed-methods/hybrid-causal-logic";
import { HclResults } from "../hclResults";
import { hclEventTreeResultMetadata, hclResultLabels } from "../hclResultLabels";
import type { HclEditorBatchRunResult, HclEditorRunResult } from "../hclBindingTypes";
import { downloadResultCsv } from "../../shared/resultCsv";
import { eventBatch, eventHazard, eventOption, eventResult, endStateUq } from "./hclResultFixtures";

jest.mock("../../shared/resultCsv", () => ({
  ...jest.requireActual("../../shared/resultCsv"),
  downloadResultCsv: jest.fn(),
}));
const csv = jest.mocked(downloadResultCsv);
const props = { runResult: null, batchRunResult: null, eventTreeOptions: [eventOption], faultTreeOptions: [] };
const choose = (value: string) =>
  fireEvent.change(screen.getByRole("combobox", { name: "End state" }), { target: { value } });
const manual = (result = eventResult(), uncertainty = false) => (
  <HclResults
    {...props}
    runResult={{ kind: "EVENT_TREE", result }}
    calculationType={uncertainty ? "UNCERTAINTY" : "PROBABILITY"}
  />
);
const batchView = (batch: HclEditorBatchRunResult, uncertainty = false) => (
  <HclResults
    {...props}
    batchRunResult={batch}
    workflow="BATCH"
    calculationType={uncertainty ? "UNCERTAINTY" : "PROBABILITY"}
  />
);
const low = () => within(screen.getByText("LOW").closest("details")!);
const openLow = () => fireEvent.click(screen.getByText("LOW").closest("summary")!);
const hazardBatch = () => ({ ...eventBatch(), hazardConvolution: eventHazard() });

describe("HCL end-state presentation", () => {
  it("shows returned totals, labels all outcomes and filters sequences by actual destination", () => {
    render(manual());
    const states = within(screen.getByRole("region", { name: "End-state results" }));
    expect(states.getByText("All outcomes")).toBeInTheDocument();
    expect(states.getByTitle("0.001")).toHaveTextContent("1.00E-03/yr");
    choose("release");
    expect(states.queryByText("All outcomes")).not.toBeInTheDocument();
    expect(states.queryByText("Safe state (safe)")).not.toBeInTheDocument();
    const sequences = within(screen.getByRole("region", { name: "Sequence results" }));
    expect(sequences.getByText("2 of 3 shown")).toBeInTheDocument();
    expect(sequences.queryByText("Plant / Mitigated")).not.toBeInTheDocument();
    expect(sequences.getByTitle("0.0004")).toHaveTextContent("4.00E-04/yr");
    expect(sequences.getByText("Conditional probability 0.04")).toBeInTheDocument();
  });

  it("uses returned aggregate UQ, without adding sequence percentiles or changing units", () => {
    render(manual(eventResult(), true));
    choose("release");
    const state = within(screen.getByRole("region", { name: "Release (release) uncertainty results" }));
    expect(state.getAllByRole("definition")).toHaveLength(7);
    for (const value of [
      endStateUq.mean,
      endStateUq.standardDeviation,
      endStateUq.minimum,
      endStateUq.percentile05,
      endStateUq.median,
      endStateUq.percentile95,
      endStateUq.maximum,
    ]) {
      expect(state.getByTitle(`${String(value)}/yr`)).toBeInTheDocument();
    }
    expect(state.queryByText("100 PRAXIS samples · seed 42")).not.toBeInTheDocument();
    expect(state.queryByTitle("0.0025/yr")).not.toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: "Plant / Pump failure conditional probability uncertainty results" }),
    ).toHaveTextContent("4.00E-02");
    expect(screen.getByRole("region", { name: "Plant / Pump failure uncertainty results" })).toHaveTextContent(
      "4.00E-04/yr",
    );
  });

  it("does not substitute point values for missing UQ", () => {
    render(manual(eventResult(), true));
    choose("safe");
    expect(screen.getByText("Safe state (safe): No uncertainty result")).toBeInTheDocument();
    expect(screen.queryByText("9.00E-03/yr")).not.toBeInTheDocument();
  });

  it("exposes sequence and end-state values inside probability scenarios", () => {
    render(batchView(eventBatch()));
    expect(screen.getAllByText("All outcomes: 1.00E-02/yr")).toHaveLength(2);
    choose("release");
    expect(screen.getAllByText("Release (release): 1.00E-03/yr")).toHaveLength(2);
    openLow();
    expect(low().getByRole("region", { name: "Sequence results" })).toHaveTextContent("Plant / Pump failure");
    expect(low().getByRole("region", { name: "End-state results" })).toHaveTextContent("1.00E-03/yr");
  });

  it("shows scenario aggregate UQ and includes it in variation comparisons", () => {
    const batch = eventBatch();
    const second = batch.scenarios[1]!.result!;
    if (second.kind !== "EVENT_TREE") throw new Error("Expected event tree");
    second.result.endStateAggregates[1]!.uncertainty = { ...endStateUq, maximum: 0.003 };
    render(batchView(batch, true));
    choose("release");
    openLow();
    expect(low().getByRole("region", { name: "Release (release) uncertainty results" })).toHaveTextContent(
      "1.90E-03/yr",
    );
    expect(screen.queryByText(/No variation/)).not.toBeInTheDocument();
  });

  it("does not invent zero when a selected state is absent from a scenario", () => {
    const batch = eventBatch();
    const result = batch.scenarios[0]!.result!;
    if (result.kind !== "EVENT_TREE") throw new Error("Expected event tree");
    result.result.endStateAggregates = result.result.endStateAggregates.slice(0, 1);
    result.result.sequences = result.result.sequences.slice(0, 1);
    render(batchView(batch));
    choose("release");
    openLow();
    expect(screen.getByText("No end-state result")).toBeInTheDocument();
    expect(low().getByRole("region", { name: "End-state results" })).toHaveTextContent("No result rows.");
  });

  it("resets selection for a new run", () => {
    const view = render(manual());
    choose("release");
    view.rerender(manual(eventResult("next-run")));
    expect(screen.getByRole("combobox", { name: "End state" })).toHaveValue("");
  });

  it("resets sequence pagination on end-state changes", () => {
    const result = eventResult();
    result.sequences = Array.from({ length: 60 }, (_, index) => ({
      ...result.sequences[index % 3]!,
      sequenceId: `s-${index}`,
    }));
    render(manual(result));
    const nav = () => within(screen.getByRole("navigation", { name: "Dependency sequences pagination" }));
    fireEvent.click(nav().getByRole("button", { name: "Next" }));
    expect(nav().getByText("Page 2 of 6")).toBeInTheDocument();
    choose("release");
    expect(nav().getByText("Page 1 of 4")).toBeInTheDocument();
    expect(screen.getByText("s-1")).toBeInTheDocument();
  });

  it("paginates end-state aggregates without limiting the selector", () => {
    const result = eventResult();
    result.endStateAggregates = Array.from({ length: 30 }, (_, index) => ({
      endStateId: `end-${index}`,
      annualFrequency: index / 1000,
    }));
    render(manual(result));
    const states = within(screen.getByRole("region", { name: "End-state results" }));
    expect(states.queryByText("end-29")).not.toBeInTheDocument();
    fireEvent.click(
      within(screen.getByRole("navigation", { name: "Dependency end states pagination" })).getByRole("button", {
        name: "Last",
      }),
    );
    expect(states.getByTitle("0.029")).toBeInTheDocument();
    choose("end-29");
    expect(states.getByTitle("0.029")).toBeInTheDocument();
  });

  it("exports all outcomes after filtering and leaves the returned object unchanged", () => {
    const result = eventResult();
    const before = JSON.stringify(result);
    render(manual(result));
    choose("release");
    fireEvent.click(screen.getByRole("button", { name: "Export results CSV" }));
    const rows = csv.mock.calls.at(-1)![1];
    expect(rows).toHaveLength(8);
    expect(rows).toContainEqual(expect.objectContaining({ row_type: "END_STATE", end_state_id: "safe", value: 0.009 }));
    expect(rows).toContainEqual(
      expect.objectContaining({ sequence_id: "safe-seq", quantity: "conditional_probability", value: 0.9 }),
    );
    expect(JSON.stringify(result)).toBe(before);
  });
});

describe("HCL hazard presentation", () => {
  it("separates integrated outcomes from per-bin sequence contributions", () => {
    render(batchView(hazardBatch()));
    const states = within(screen.getByRole("region", { name: "Integrated end-state results" }));
    expect(states.getByText("All outcomes")).toBeInTheDocument();
    choose("release");
    expect(states.getByTitle("0.0008")).toHaveTextContent("0.0008");
    expect(states.getByTitle("0.08")).toBeInTheDocument();
    expect(states.queryByText("Safe state (safe)")).not.toBeInTheDocument();
    const integrated = within(screen.getByRole("region", { name: "Integrated sequence results" }));
    expect(integrated.getByTitle("0.00032")).toBeInTheDocument();
    expect(integrated.queryByText("Plant / Mitigated")).not.toBeInTheDocument();
    openLow();
    const bin = within(low().getByRole("region", { name: "Hazard-bin contributions" }));
    expect(bin.getByTitle("0.012")).toBeInTheDocument();
    expect(bin.getByTitle("0.00012")).toBeInTheDocument();
    expect(bin.getByTitle("0.04")).toBeInTheDocument();
    expect(bin.queryByText("Plant / Mitigated")).not.toBeInTheDocument();
    expect(bin.getByText("Applied weight")).toBeInTheDocument();
    expect(bin.getByTitle("0.375")).toHaveTextContent("37.50%");
  });

  it("uses returned normalized results without applying weights or annual scale again", () => {
    const batch = hazardBatch();
    batch.hazardConvolution.normalizeWeights = true;
    batch.hazardConvolution.convolutionWeightSum = 1;
    batch.hazardConvolution.endStateAggregates[1]!.integratedAnnualFrequency = 0.00123456789012345;
    render(batchView(batch));
    choose("release");
    const summary = screen.getByLabelText("Hazard convolution summary");
    expect(summary).toHaveTextContent("Covered probability");
    for (const echoed of ["Normalized", "Weights", "Annual scale", "Applied weight sum", "PGA grid"]) expect(summary).not.toHaveTextContent(echoed);
    expect(
      within(screen.getByRole("region", { name: "Integrated end-state results" })).getByTitle("0.00123456789012345"),
    ).toHaveTextContent("0.00123456789012");
  });

  it("retains skipped and failed scenarios without fake sequence values", () => {
    const batch = hazardBatch();
    batch.scenarios.push({
      scenarioId: "zero",
      scenarioCode: "ZERO",
      scenarioName: "Zero bin",
      status: "SKIPPED",
      failure: null,
      result: null,
    });
    batch.scenarios.push({
      scenarioId: "fail",
      scenarioCode: "FAIL",
      scenarioName: "Failed evidence",
      status: "FAILED",
      failure: "Impossible evidence",
      result: null,
    });
    batch.hazardConvolution.rows.push({
      scenarioId: "zero",
      status: "skipped_zero_weight",
      rawWeight: 0,
      normalizedWeight: 0,
      convolutionWeight: 0,
      annualFrequency: 0,
      sequences: [],
    });
    render(batchView(batch));
    choose("release");
    expect(screen.getByText("Impossible evidence")).toBeInTheDocument();
    const zero = screen.getByText("ZERO").closest("details")!;
    fireEvent.click(within(zero).getByText("ZERO"));
    expect(zero).toHaveTextContent("Skipped: zero hazard weight");
    expect(within(zero).queryByRole("table")).not.toBeInTheDocument();
  });

  it("keeps unknown sequence identities reviewable and safely excludes them from a selected outcome", () => {
    const batch = hazardBatch();
    batch.hazardConvolution.sequences.push({
      sequenceId: "unmapped",
      convolvedProbability: 1e-10,
      integratedAnnualFrequency: 1e-12,
    });
    batch.hazardConvolution.rows[0]!.sequences.push({
      sequenceId: "unmapped",
      conditionalProbability: 1e-9,
      probabilityContribution: 1e-10,
      annualContribution: 1e-12,
    });
    render(batchView(batch));
    const rows = within(screen.getByRole("region", { name: "Integrated sequence results" }));
    expect(rows.getByText("unmapped")).toBeInTheDocument();
    expect(rows.getByText("Unavailable")).toBeInTheDocument();
    choose("release");
    openLow();
    expect(rows.queryByText("unmapped")).not.toBeInTheDocument();
    expect(rows.getByText(/Some sequence destinations are unavailable/)).toBeInTheDocument();
  });

  it("keeps complete hazard records in CSV after end-state filtering", () => {
    const batch = hazardBatch();
    const before = JSON.stringify(batch);
    render(batchView(batch));
    choose("release");
    fireEvent.click(screen.getByRole("button", { name: "Export results CSV" }));
    const rows = csv.mock.calls.at(-1)![1];
    expect(rows).toContainEqual(
      expect.objectContaining({
        row_type: "INTEGRATED_END_STATE",
        end_state_id: "safe",
        integrated_annual_frequency: 0.0072,
      }),
    );
    expect(rows.filter((row) => row.row_type === "HAZARD_BIN_SEQUENCE")).toHaveLength(6);
    expect(JSON.stringify(batch)).toBe(before);
  });

  it("displays the integrated hazard results of an uncertainty batch", () => {
    render(batchView(hazardBatch(), true));
    expect(screen.queryByRole("note")).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Integrated end-state results" })).toBeInTheDocument();
    openLow();
    expect(low().getByRole("region", { name: "Release (release) uncertainty results" })).toBeInTheDocument();
  });

  it("paginates integrated rows and bin contributions without losing selected outcomes", () => {
    const batch = hazardBatch();
    const result = batch.scenarios[0]!.result!;
    if (result.kind !== "EVENT_TREE") throw new Error("Expected event tree");
    result.result.sequences = Array.from({ length: 30 }, (_, index) => ({
      ...result.result.sequences[1]!,
      sequenceId: `seq-${index}`,
    }));
    batch.hazardConvolution.sequences = result.result.sequences.map((sequence, index) => ({
      sequenceId: sequence.sequenceId,
      convolvedProbability: index / 1000,
      integratedAnnualFrequency: index / 100000,
    }));
    batch.hazardConvolution.rows[0]!.sequences = result.result.sequences.map((sequence, index) => ({
      sequenceId: sequence.sequenceId,
      conditionalProbability: index / 100,
      probabilityContribution: index / 1000,
      annualContribution: index / 100000,
    }));
    render(batchView(batch));
    choose("release");
    openLow();
    const integrated = within(screen.getByRole("region", { name: "Integrated sequence results" }));
    const bin = within(low().getByRole("region", { name: "Hazard-bin contributions" }));
    for (const view of [integrated, bin]) {
      expect(view.queryByText("seq-29")).not.toBeInTheDocument();
      fireEvent.click(view.getByRole("button", { name: "Last" }));
      expect(view.getByText("seq-29")).toBeInTheDocument();
      expect(view.getByTitle("0.00029")).toBeInTheDocument();
    }
  });

  it("resets scenario pagination on filtering and selection on new batch results", () => {
    const batch = eventBatch();
    batch.scenarios = Array.from({ length: 30 }, (_, index) => ({
      ...batch.scenarios[0]!,
      scenarioId: `s-${index}`,
      scenarioCode: `S-${index}`,
    }));
    const view = render(batchView(batch));
    const nav = () => within(screen.getByRole("navigation", { name: "Dependency scenarios pagination" }));
    fireEvent.click(nav().getByRole("button", { name: "Next" }));
    expect(nav().getByText("Page 2 of 3")).toBeInTheDocument();
    choose("release");
    expect(nav().getByText("Page 1 of 3")).toBeInTheDocument();
    view.rerender(batchView(eventBatch()));
    expect(screen.getByRole("combobox", { name: "End state" })).toHaveValue("");
  });
});

describe("end-state and transferred sequence labels", () => {
  const tree = (uuid: string, name: string, endState: EndState): EventTree => ({
    uuid,
    name,
    initiatingEventId: "initiator",
    functionalEvents: {},
    branches: {},
    initialState: { branchId: "branch" },
    implementsSrs: [],
    sequences: { same: { uuid: "same", name: `${name} sequence`, endState } },
  });

  it("uses the terminal tree's saved label for legacy IDs, even when only the root is eligible", () => {
    const root = tree("tree", "Root", EndState.SUCCESSFUL_MITIGATION);
    root.transfers = { same: { targetEventTreeId: "child" } };
    const child = tree("child", "Child", EndState.RADIONUCLIDE_RELEASE);
    const metadata = hclEventTreeResultMetadata([root, child]);
    expect(metadata.sequences[0]).not.toHaveProperty("endStateName");
    expect(metadata.endStates).toEqual([]);
    const result = eventResult();
    result.sequences = [
      {
        ...result.sequences[1]!,
        sequenceChain: [
          { modelId: "tree", entityId: "same" },
          { modelId: "child", entityId: "same" },
        ],
      },
    ];
    const labels = hclResultLabels([{ ...eventOption, ...metadata }], [result]);
    expect(labels.endStateName("release")).toBe("Release (release)");
    expect(labels.sequenceName("child", "same")).toBe("Child / Child sequence");
    render(
      <HclResults
        {...props}
        eventTreeOptions={[{ ...eventOption, ...metadata }]}
        runResult={{ kind: "EVENT_TREE", result }}
      />,
    );
    choose("release");
    expect(screen.getByText("Root / Root sequence → Child / Child sequence")).toBeInTheDocument();
  });

  it("uses explicit saved end-state IDs and falls back to IDs for unavailable or conflicting names", () => {
    const saved = tree("tree", "Plant", EndState.RADIONUCLIDE_RELEASE);
    saved.endStateIds = { [EndState.RADIONUCLIDE_RELEASE]: "explicit" };
    const metadata = hclEventTreeResultMetadata([saved]);
    const labels = hclResultLabels([{ ...eventOption, ...metadata }], [eventResult()]);
    expect(labels.endStateName("explicit")).toBe("Release (explicit)");
    expect(labels.endStateName("unknown")).toBe("unknown");
    expect(labels.sequenceName("absent", "same")).toBeUndefined();
    const conflicting = hclResultLabels(
      [
        {
          ...eventOption,
          endStates: [
            { id: "same-id", name: "Release" },
            { id: "same-id", name: "Safe state" },
          ],
        },
      ],
      [eventResult()],
    );
    expect(conflicting.endStateName("same-id")).toBe("same-id");
  });
});

describe("dependency fault tree presentation", () => {
  const treeProps = { runResult: null, batchRunResult: null, eventTreeOptions: [], faultTreeOptions: [] };
  const spread: HclUncertaintySummary = {
    sampleCount: 1_000,
    seed: 42,
    mean: 0.25,
    standardDeviation: 0.01,
    minimum: 0.2,
    percentile05: 0.23,
    median: 0.25,
    percentile95: 0.27,
    maximum: 0.3,
  };

  function treeResult(suffix: string, uncertainty?: HclUncertaintySummary): HclQuantificationResult {
    return {
      schemaVersion: "1.0.0",
      runId: `ft-run-${suffix}`,
      owner: { workbookId: "esq", modelId: "configuration", workbookRevision: 2 },
      faultTreeTopGate: { referenceType: "FAULT_TREE_TOP_EVENT", workbookId: "sy", modelId: "ft", entityId: "top" },
      probability: 0.25,
      ...(uncertainty === undefined ? {} : { uncertainty }),
      bddNodes: 1,
      bddVariables: 1,
      variableOrder: ["basic-event"],
      bridge: { quantifications: 1, bddContextCacheHits: 0, bddContextCacheMisses: 1, bnQueryCacheHits: 0, bnQueryCacheMisses: 1 },
      junctionTree: { numCliques: 1, maxCliqueSize: 1, treewidth: 0, totalTableEntries: 2 },
      validationIssues: [],
      completedAt: "2026-08-31T12:00:00.000Z",
    };
  }

  function treeBatch(uncertainty?: HclUncertaintySummary): HclEditorBatchRunResult {
    return {
      kind: "FAULT_TREE",
      scenarios: ["1", "2"].map((suffix) => ({
        scenarioId: `scenario-${suffix}`,
        scenarioCode: `SCN-${suffix}`,
        scenarioName: `Scenario ${suffix}`,
        status: "SUCCEEDED",
        failure: null,
        result: { kind: "FAULT_TREE", result: treeResult(suffix, uncertainty) },
      })),
    };
  }

  function treeHazard(): HclFaultTreeHazardConvolutionResult {
    return {
      targetKind: "FAULT_TREE",
      gridName: "Hazard grid",
      annualFrequencyScale: { value: 1, unit: "PER_YEAR", annualization: { basis: "PLANT_YEAR", hoursPerYear: 8_760 } },
      annualizedFrequencyScale: 1,
      normalizeWeights: true,
      rawWeightSum: 0.9944,
      convolutionWeightSum: 1,
      rows: ["1", "2"].map((suffix, index) => ({
        scenarioId: `scenario-${suffix}`,
        status: "ok",
        rawWeight: index === 0 ? 0.75 : 0.2444,
        normalizedWeight: index === 0 ? 0.7542 : 0.2458,
        convolutionWeight: index === 0 ? 0.7542 : 0.2458,
        annualFrequency: index === 0 ? 0.7542 : 0.2458,
        conditionalProbability: 0.25,
        probabilityContribution: index === 0 ? 0.18855 : 0.06145,
        annualContribution: index === 0 ? 0.18855 : 0.06145,
      })),
      convolvedProbability: 0.25,
      integratedAnnualFrequency: 0.25,
    };
  }

  it("labels completed batches whose numerical result does not vary", () => {
    const manual: HclEditorRunResult = { kind: "FAULT_TREE", result: treeResult("1") };
    const view = render(<HclResults {...treeProps} runResult={manual} />);
    const commonResult = screen.getByLabelText("Dependency fault tree result");
    expect(commonResult).toHaveTextContent("Top event probability");
    expect(commonResult).toHaveTextContent("2.50E-01");
    expect(commonResult.querySelectorAll(".hcleditor__result-metric")).toHaveLength(1);
    view.rerender(<HclResults {...treeProps} batchRunResult={treeBatch()} workflow="BATCH" />);
    const scenarioResult = screen.getByLabelText("Dependency scenario batch result");
    expect(scenarioResult).toHaveTextContent("2 of 2 completed · No variation across scenarios");
    expect(scenarioResult.querySelectorAll(".hcleditor__batch-table .hcleditor__result-metric")).toHaveLength(2);
  });

  it("separates uncertainty statistics for manual and scenario results", () => {
    const manual: HclEditorRunResult = { kind: "FAULT_TREE", result: treeResult("1", spread) };
    const view = render(<HclResults {...treeProps} runResult={manual} calculationType="UNCERTAINTY" />);
    const manualUncertainty = screen.getByLabelText("Uncertainty results");
    expect(manualUncertainty.querySelectorAll(".hcleditor__uncertainty-metric")).toHaveLength(7);
    expect(within(manualUncertainty).getByText("Standard deviation")).toBeInTheDocument();
    view.rerender(<HclResults {...treeProps} batchRunResult={treeBatch(spread)} workflow="BATCH" calculationType="UNCERTAINTY" />);
    const scenarioOne = screen.getByText("SCN-1").closest("details");
    const scenarioTwo = screen.getByText("SCN-2").closest("details");
    expect(scenarioOne).not.toHaveAttribute("open");
    expect(scenarioTwo).not.toHaveAttribute("open");
    expect(scenarioOne).toHaveTextContent("Mean 2.50E-01");
    fireEvent.click(screen.getByText("SCN-1"));
    fireEvent.click(screen.getByText("SCN-2"));
    const [first, second] = screen.getAllByLabelText("Statistics uncertainty results");
    expect(first).toHaveClass("hcleditor__uncertainty-result--inline");
    expect(first?.querySelectorAll(".hcleditor__uncertainty-metric")).toHaveLength(7);
    expect(second?.querySelectorAll(".hcleditor__uncertainty-metric")).toHaveLength(7);
  });

  it("presents hazard convolution as summary and weighted contribution metrics", () => {
    render(<HclResults {...treeProps} batchRunResult={{ ...treeBatch(), hazardConvolution: treeHazard() }} workflow="BATCH" />);
    const result = screen.getByLabelText("Dependency scenario batch result");
    expect(within(result).getByLabelText("Hazard convolution summary")).toHaveTextContent("99.44%");
    expect(result).toHaveTextContent("Convolved probability");
    expect(result).toHaveTextContent("1.89E-01/yr");
    expect(result).toHaveTextContent("75.42% weight");
    expect(result).not.toHaveTextContent("w=");
  });

  it("shows each hazard value once and the frequency only when the annual scale is not 1", () => {
    const view = render(<HclResults {...treeProps} batchRunResult={{ ...treeBatch(), hazardConvolution: treeHazard() }} workflow="BATCH" />);
    const summary = (): HTMLElement => screen.getByLabelText("Hazard convolution summary");
    expect(summary().querySelectorAll(".hcleditor__result-metric")).toHaveLength(2);
    expect(summary()).toHaveTextContent("Convolved probability2.50E-01");
    for (const echoed of ["Hazard grid", "Annual scale", "Weights", "Normalized", "Applied weight sum", "Integrated frequency"]) expect(summary()).not.toHaveTextContent(echoed);
    view.rerender(<HclResults {...treeProps} batchRunResult={{ ...treeBatch(), hazardConvolution: { ...treeHazard(), annualizedFrequencyScale: 0.5, integratedAnnualFrequency: 0.125 } }} workflow="BATCH" />);
    expect(summary().querySelectorAll(".hcleditor__result-metric")).toHaveLength(3);
    expect(summary()).toHaveTextContent("Integrated frequency1.25E-01/yr");
    expect(summary()).not.toHaveTextContent("Annual scale");
  });

  it("shows zero-weight hazard scenarios as skipped", () => {
    const batch = treeBatch();
    const hazard = treeHazard();
    const [skipped] = batch.scenarios;
    if (skipped === undefined) throw new Error("Expected a scenario");
    batch.scenarios[0] = { ...skipped, status: "SKIPPED", failure: null, result: null };
    hazard.rows[0] = {
      scenarioId: skipped.scenarioId,
      status: "skipped_zero_weight",
      rawWeight: 0,
      normalizedWeight: 0,
      convolutionWeight: 0,
      annualFrequency: 0,
      conditionalProbability: null,
      probabilityContribution: 0,
      annualContribution: 0,
    };
    render(<HclResults {...treeProps} batchRunResult={{ ...batch, hazardConvolution: hazard }} workflow="BATCH" />);
    expect(screen.getByLabelText("Dependency scenario batch result")).toHaveTextContent("Skipped: zero hazard weight");
  });
});
