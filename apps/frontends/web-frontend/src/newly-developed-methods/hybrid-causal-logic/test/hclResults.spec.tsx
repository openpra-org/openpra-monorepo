import { fireEvent, render, screen, within } from "@testing-library/react";
import type { EventTree } from "interfaces-mef-types/es/event-sequence-analysis";
import { EndState } from "interfaces-mef-types/core/events";
import { HCL_HAZARD_CONVOLUTION_POINT_ONLY } from "interfaces-shared-types/newly-developed-methods/hybrid-causal-logic";
import { HclResults } from "../hclResults";
import { hclEventTreeResultMetadata, hclResultLabels } from "../hclResultLabels";
import type { HclEditorBatchRunResult } from "../hclBindingTypes";
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
    expect(state.getByText("100 PRAXIS samples · seed 42")).toBeInTheDocument();
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
    const nav = () => within(screen.getByRole("navigation", { name: "HCL sequences pagination" }));
    fireEvent.click(nav().getByRole("button", { name: "Next" }));
    expect(nav().getByText("Page 2 of 3")).toBeInTheDocument();
    choose("release");
    expect(nav().getByText("Page 1 of 2")).toBeInTheDocument();
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
      within(screen.getByRole("navigation", { name: "HCL end states pagination" })).getByRole("button", {
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
    expect(screen.getByLabelText("Hazard convolution summary")).toHaveTextContent("Normalized");
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

  it("does not display integrated hazard UQ even for an incompatible result", () => {
    render(batchView(hazardBatch(), true));
    expect(screen.getByRole("note")).toHaveTextContent(HCL_HAZARD_CONVOLUTION_POINT_ONLY);
    expect(screen.queryByRole("region", { name: "Integrated end-state results" })).not.toBeInTheDocument();
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
    const nav = () => within(screen.getByRole("navigation", { name: "HCL scenarios pagination" }));
    fireEvent.click(nav().getByRole("button", { name: "Next" }));
    expect(nav().getByText("Page 2 of 2")).toBeInTheDocument();
    choose("release");
    expect(nav().getByText("Page 1 of 2")).toBeInTheDocument();
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
