import { fireEvent, render, screen, within } from "@testing-library/react";
import type { EventSequenceQuantification } from "interfaces-mef-types/esq/event-sequence-quantification";
import { esqEndStateRunId, esqSequenceRunId } from "interfaces-mef-types/esq/esq-run-inputs";
import type { EventTreeAnalysisResult } from "interfaces-shared-types/newly-developed-methods/event-tree";
import type { HclDependencyCutSets, HclEventTreeHazardConvolutionResult } from "interfaces-shared-types/newly-developed-methods/hybrid-causal-logic";
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

  it("shows no cut set link when the run carries no ranked cut sets", () => {
    show({ result: "PROBABILITY", evidence: "BASE", cutSets: "NONE", trees: [{ treeId: "ET-A", runResult: { kind: "EVENT_TREE", result: result(undefined) }, batchRunResult: null, failure: null }] });
    expect(screen.queryAllByRole("button", { name: /^Cut sets of / })).toHaveLength(0);
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
