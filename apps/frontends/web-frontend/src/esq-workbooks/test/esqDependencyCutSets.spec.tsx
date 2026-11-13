import { fireEvent, render, screen, within } from "@testing-library/react";
import type { EventSequenceQuantification } from "interfaces-mef-types/esq/event-sequence-quantification";
import { esqEndStateRunId, esqSequenceRunId } from "interfaces-mef-types/esq/esq-run-inputs";
import type { EventTreeAnalysisResult } from "interfaces-shared-types/newly-developed-methods/event-tree";
import type { HclDependencyCutSets, HclEventImportance, HclEventTreeHazardConvolutionResult } from "interfaces-shared-types/newly-developed-methods/hybrid-causal-logic";
import { EsqWorkbookProvider } from "../esqWorkbookContext";
import { EsqDependencyResults } from "../EsqDependencyResults";
import type { DependencyStudy } from "../EsqDependencies";
import { withModelImported } from "../esqModel";
import { linkedEsq, modelUpstream } from "./esqModelFixtures";

const NOW = "2026-11-12T12:00:00.000Z";
const RUN = "4f6c1a2e-8b3d-4c5e-9f70-1a2b3c4d5e6f";
const RELEASE_SEQUENCE = esqSequenceRunId("ET-A", "A-2");
const SAFE_SEQUENCE = esqSequenceRunId("ET-A", "A-1");
const RELEASE = esqEndStateRunId("RADIONUCLIDE_RELEASE");
const SAFE = esqEndStateRunId("SUCCESSFUL_MITIGATION");

const ranked: HclDependencyCutSets = {
  score: "FAILED_EVENTS",
  count: 12,
  items: [
    { order: 2, probability: 0.004, annualFrequency: 0.01, basicEventIds: ["E-1", "E-2"] },
    { order: 1, probability: 0.001, annualFrequency: 0.0025, basicEventIds: ["E-3"] },
  ],
};

function result(cutSets: HclDependencyCutSets | undefined): EventTreeAnalysisResult {
  return {
    schemaVersion: "1.0.0",
    runId: RUN,
    owner: { workbookId: "esq-1", workbookRevision: 4, modelId: "HCL" },
    mode: "HYBRID_CAUSAL_LOGIC",
    sequences: [
      {
        sequenceId: RELEASE_SEQUENCE,
        path: [],
        result: { kind: "END_STATE", endStateId: RELEASE },
        conditionalProbability: 0.02,
        annualFrequency: 0.05,
        ...(cutSets === undefined ? {} : { dependencyCutSets: cutSets }),
      },
      { sequenceId: SAFE_SEQUENCE, path: [], result: { kind: "END_STATE", endStateId: SAFE }, conditionalProbability: 0.98, annualFrequency: 2.45 },
    ],
    endStateAggregates: [
      { endStateId: RELEASE, annualFrequency: 0.05 },
      { endStateId: SAFE, annualFrequency: 2.45 },
    ],
    validationIssues: [],
    completedAt: NOW,
  };
}

function show(study: DependencyStudy): void {
  const esq: EventSequenceQuantification = withModelImported(linkedEsq(), modelUpstream(), NOW);
  const model = esq.model;
  if (model === undefined) throw new Error("fixture has no model");
  window.localStorage.clear();
  render(
    <EsqWorkbookProvider data={{ esq }} editable mutateEsq={() => undefined} upstream={modelUpstream()}>
      <EsqDependencyResults study={study} model={model} />
    </EsqWorkbookProvider>,
  );
}

describe("ESQ Step 05 ranked cut sets of a dependency run", () => {
  it("opens the ranked cut sets of a sequence with event codes and no identifiers", () => {
    show({ result: "PROBABILITY", evidence: "BASE", cutSets: "FAILED_EVENTS", trees: [{ treeId: "ET-A", runResult: { kind: "EVENT_TREE", result: result(ranked) }, batchRunResult: null, failure: null }] });
    const buttons = screen.getAllByRole("button", { name: /^Cut sets of / });
    expect(buttons).toHaveLength(1);
    fireEvent.click(buttons[0]!);
    const dialog = screen.getByRole("dialog", { name: "Dependency cut sets" });
    expect(within(dialog).getByText("COOL-PMP-FS · SUP-HFE")).toBeTruthy();
    expect(within(dialog).getByText("SUP-FAN-FR")).toBeTruthy();
    expect(within(dialog).getByText("Failed events")).toBeTruthy();
    expect(within(dialog).getByText("12")).toBeTruthy();
    expect(within(dialog).getByText("4E-3")).toBeTruthy();
    expect(within(dialog).getByText("1E-2")).toBeTruthy();
    expect(within(dialog).queryByText(/E-1/)).toBeNull();
    expect(within(dialog).getByRole("columnheader", { name: "Probability" })).toBeTruthy();
  });

  it("lists the causes of a cut set and goes back to the cut sets", () => {
    const traced: HclDependencyCutSets = {
      ...ranked,
      items: [
        { ...ranked.items[0]!, causes: [{ nodeId: "node-not-in-the-fixture", stateId: "state", baseline: 0.002, withCutSet: 0.75, shift: 0.748 }] },
        { ...ranked.items[1]!, causes: [] },
      ],
    };
    show({ result: "PROBABILITY", evidence: "BASE", cutSets: "FAILED_EVENTS", trees: [{ treeId: "ET-A", runResult: { kind: "EVENT_TREE", result: result(traced) }, batchRunResult: null, failure: null }] });
    fireEvent.click(screen.getByRole("button", { name: /^Cut sets of / }));
    const dialog = within(screen.getByRole("dialog", { name: "Dependency cut sets" }));
    expect(dialog.getByRole("columnheader", { name: "Causes" })).toBeTruthy();
    expect(dialog.getByText("None")).toBeTruthy();
    fireEvent.click(dialog.getByRole("button", { name: "Causes of COOL-PMP-FS · SUP-HFE" }));
    const causes = within(dialog.getByRole("table", { name: "Causes of the cut set" }));
    expect(causes.getByText("Missing node")).toBeTruthy();
    expect(causes.getByText("2E-3")).toBeTruthy();
    expect(causes.getByText("7.5E-1")).toBeTruthy();
    expect(causes.queryByText(/node-not-in-the-fixture/)).toBeNull();
    fireEvent.click(dialog.getByRole("button", { name: "Back to cut sets" }));
    expect(dialog.getByRole("table", { name: "Ranked cut sets" })).toBeTruthy();
  });

  it("opens the importance of a sequence and of an end state with event codes", () => {
    const importance: HclEventImportance[] = [
      { basicEventId: "E-3", probability: 1, occurred: 0.02, notOccurred: null, birnbaum: null, riskAchievementWorth: 1, riskReductionWorth: null, fussellVesely: null, criticality: 1 },
      { basicEventId: "E-1", probability: 0.03, occurred: 0.4, notOccurred: 0.008, birnbaum: 0.392, riskAchievementWorth: 20, riskReductionWorth: 2.5, fussellVesely: 0.6, criticality: 0.61 },
    ];
    const traced = result(undefined);
    traced.sequences[0] = { ...traced.sequences[0]!, dependencyImportance: importance };
    traced.endStateAggregates[0] = { ...traced.endStateAggregates[0]!, dependencyImportance: [importance[1]!] };
    show({ result: "PROBABILITY", evidence: "BASE", cutSets: "NONE", trees: [{ treeId: "ET-A", runResult: { kind: "EVENT_TREE", result: traced }, batchRunResult: null, failure: null }] });
    const buttons = screen.getAllByRole("button", { name: /^Importance of / });
    expect(buttons).toHaveLength(2);
    fireEvent.click(within(screen.getByRole("table", { name: "Sequences" })).getByRole("button", { name: /^Importance of / }));
    let dialog = within(screen.getByRole("dialog", { name: "Dependency importance" }));
    const rows = within(dialog.getByRole("table", { name: "Importance" })).getAllByRole("row").slice(1);
    expect(rows.map((row) => within(row).getAllByRole("cell")[0]?.textContent)).toEqual(["COOL-PMP-FS", "SUP-FAN-FR"]);
    expect(within(rows[0]!).getByText("6E-1")).toBeTruthy();
    expect(within(rows[0]!).getByText("2E1")).toBeTruthy();
    expect(within(rows[1]!).getAllByText("—")).toHaveLength(3);
    expect(dialog.queryByText("E-1")).toBeNull();
    expect(dialog.queryByText("E-3")).toBeNull();
    fireEvent.click(dialog.getByRole("button", { name: "Close" }));
    fireEvent.click(within(screen.getByRole("table", { name: "End states" })).getByRole("button", { name: /^Importance of / }));
    dialog = within(screen.getByRole("dialog", { name: "Dependency importance" }));
    expect(within(dialog.getByRole("table", { name: "Importance" })).getAllByRole("row")).toHaveLength(2);
  });

  it("shows the sampled range of importance and of the hazard grid", () => {
    const measure = (mean: number) => ({ sampleCount: 40, mean, percentile05: mean / 2, median: mean * 1.1, percentile95: mean * 1.5 });
    const importance: HclEventImportance[] = [
      { basicEventId: "E-1", probability: 0.03, occurred: 0.4, notOccurred: 0.008, birnbaum: 0.392, riskAchievementWorth: 20, riskReductionWorth: 2.5, fussellVesely: 0.6, criticality: 0.61,
        uncertainty: { birnbaum: measure(0.3), riskAchievementWorth: measure(18), riskReductionWorth: null, fussellVesely: measure(0.55), criticality: measure(0.5) } },
      { basicEventId: "E-3", probability: 0.01, occurred: 0.5, notOccurred: 0.015, birnbaum: 0.485, riskAchievementWorth: 25, riskReductionWorth: 1.333, fussellVesely: 0.25, criticality: 0.25 },
    ];
    const traced = result(undefined);
    traced.sequences[0] = { ...traced.sequences[0]!, dependencyImportance: importance };
    show({ result: "UNCERTAINTY", evidence: "BASE", cutSets: "NONE", trees: [{ treeId: "ET-A", runResult: { kind: "EVENT_TREE", result: traced }, batchRunResult: null, failure: null }] });
    fireEvent.click(within(screen.getByRole("table", { name: "Sequences" })).getByRole("button", { name: /^Importance of / }));
    const dialog = within(screen.getByRole("dialog", { name: "Dependency importance" }));
    const sampled = within(dialog.getByRole("table", { name: "Importance uncertainty" }));
    expect(sampled.getAllByRole("row")).toHaveLength(2);
    expect(sampled.getByText("COOL-PMP-FS")).toBeTruthy();
    expect(sampled.getByText("5.5E-1")).toBeTruthy();
    expect(sampled.getByText("2.75E-1")).toBeTruthy();
    expect(sampled.getByText("8.25E-1")).toBeTruthy();
    fireEvent.change(dialog.getByRole("combobox", { name: "Measure" }), { target: { value: "riskReductionWorth" } });
    expect(within(dialog.getByRole("table", { name: "Importance uncertainty" })).getAllByText("—")).toHaveLength(4);
    expect(within(dialog.getByRole("table", { name: "Importance" })).getAllByRole("row")).toHaveLength(3);
  });

  it("shows no cut set link when the run carries no ranked cut sets", () => {
    show({ result: "PROBABILITY", evidence: "BASE", cutSets: "NONE", trees: [{ treeId: "ET-A", runResult: { kind: "EVENT_TREE", result: result(undefined) }, batchRunResult: null, failure: null }] });
    expect(screen.queryAllByRole("button", { name: /^Cut sets of / })).toHaveLength(0);
    expect(screen.queryAllByRole("button", { name: /^Importance of / })).toHaveLength(0);
  });

  it("opens the hazard-weighted cut sets from the grid table", () => {
    const hazard: HclEventTreeHazardConvolutionResult = {
      targetKind: "EVENT_TREE",
      gridName: "Grid",
      annualFrequencyScale: { value: 2.5, unit: "PER_YEAR", annualization: { basis: "PLANT_YEAR", hoursPerYear: 8760 } },
      annualizedFrequencyScale: 2.5,
      normalizeWeights: false,
      rawWeightSum: 1,
      convolutionWeightSum: 1,
      rows: [{
        scenarioId: "S-1",
        status: "ok",
        rawWeight: 1,
        normalizedWeight: 1,
        convolutionWeight: 1,
        annualFrequency: 2.5,
        sequences: [{ sequenceId: RELEASE_SEQUENCE, conditionalProbability: 0.02, probabilityContribution: 0.02, annualContribution: 0.05 }],
      }],
      sequences: [{ sequenceId: RELEASE_SEQUENCE, convolvedProbability: 0.02, integratedAnnualFrequency: 0.05, dependencyCutSets: { ...ranked, score: "FAILED_EVENTS_AND_SEQUENCE" } }],
      endStateAggregates: [{ endStateId: RELEASE, convolvedProbability: 0.02, integratedAnnualFrequency: 0.05 }],
    };
    show({
      result: "PROBABILITY",
      evidence: "HAZARD",
      cutSets: "FAILED_EVENTS_AND_SEQUENCE",
      trees: [{
        treeId: "ET-A",
        runResult: null,
        batchRunResult: {
          kind: "EVENT_TREE",
          scenarios: [{ scenarioId: "S-1", scenarioCode: "CELL-1", scenarioName: "Cell 1", status: "SUCCEEDED", failure: null, result: { kind: "EVENT_TREE", result: result(ranked) } }],
          hazardConvolution: hazard,
        },
        failure: null,
      }],
    });
    fireEvent.click(screen.getByRole("button", { name: /^Cut sets of / }));
    const dialog = screen.getByRole("dialog", { name: "Dependency cut sets" });
    expect(within(dialog).getByText("Weighted over the hazard grid")).toBeTruthy();
    expect(within(dialog).getByText("Failed events and success branches")).toBeTruthy();
    expect(within(dialog).getByRole("columnheader", { name: "Convolved probability" })).toBeTruthy();
    expect(within(dialog).getByText("COOL-PMP-FS · SUP-HFE")).toBeTruthy();
  });
});
