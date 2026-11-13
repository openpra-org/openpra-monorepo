import { fireEvent, render, screen, within } from "@testing-library/react";
import type { WorkbookHclConfiguration } from "interfaces-mef-types/modeling";
import type {
  HclFaultTreeDependencyCutSets,
  HclFaultTreeHazardConvolutionResult,
  HclQuantificationResult,
} from "interfaces-shared-types/newly-developed-methods/hybrid-causal-logic";
import { ToastProvider } from "../../../toast/toastProvider";
import { HclBindingEditor } from "../hclBindingEditor";
import { HclResults } from "../hclResults";
import type { HclEditorBatchRunResult, HclFaultTreeOption } from "../hclBindingTypes";
import { START_CUT_SET_CHOICE, cutSetSettingsOf } from "../hclFaultTreeCutSets";
import { TEST_ID, testBayesianNetworkModel } from "../../bayesian-network/test/bayesianNetworkTestModel";

const id = (n: number) => `20000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const NOW = "2026-11-12T12:00:00.000Z";
const tree: HclFaultTreeOption = {
  workbookId: "sy",
  workbookName: "Systems",
  modelId: id(2),
  modelCode: "FT-COOL",
  modelName: "Cooling fails",
  topGateId: id(4),
  basicEvents: [
    { id: id(11), code: "COOL-PMP-FS", name: "Pump fails to start" },
    { id: id(12), code: "COOL-VLV-FO", name: "Valve fails to open" },
    { id: id(13), code: "SUP-FAN-FR", name: "Fan fails to run" },
  ],
};
const configuration: WorkbookHclConfiguration = {
  modelId: id(1), code: "HCL", name: "HCL", description: "",
  bayesianNetwork: { workbookId: "sy", modelId: TEST_ID.model },
  faultTrees: [{ workbookId: "sy", modelId: id(2) }],
  bindings: [], baseEvidence: { observations: [] },
  evidenceScenarios: [{ id: id(3), code: "ROW", name: "Row", enabled: true, evidence: { observations: [] } }],
  solverSettings: { variableOrder: null, foldConstants: true, spliceNullGates: true },
};
const ranked: HclFaultTreeDependencyCutSets = {
  count: 14,
  items: [
    { order: 2, probability: 0.004, basicEventIds: [id(11), id(12)] },
    { order: 1, probability: 0.001, basicEventIds: [id(13)] },
  ],
};

function quantification(runId: string, cutSets?: HclFaultTreeDependencyCutSets): HclQuantificationResult {
  return {
    schemaVersion: "1.0.0",
    runId,
    owner: { workbookId: "sy", workbookRevision: 2, modelId: id(1) },
    faultTreeTopGate: { referenceType: "FAULT_TREE_TOP_EVENT", workbookId: "sy", modelId: id(2), entityId: id(4) },
    probability: 0.02,
    bddNodes: 3,
    bddVariables: 0,
    variableOrder: [],
    bridge: { quantifications: 1, bddContextCacheHits: 0, bddContextCacheMisses: 0, bnQueryCacheHits: 0, bnQueryCacheMisses: 0 },
    junctionTree: { numCliques: 1, maxCliqueSize: 1, treewidth: 0, totalTableEntries: 2 },
    ...(cutSets === undefined ? {} : { dependencyCutSets: cutSets }),
    validationIssues: [],
    completedAt: NOW,
  };
}

function panel(onRun: jest.Mock, type: "PROBABILITY" | "UNCERTAINTY" = "PROBABILITY", batch = false) {
  return (
    <ToastProvider>
      <HclBindingEditor
        model={testBayesianNetworkModel()} editable workbookId="sy" configurations={[configuration]}
        scope="FAULT_TREE" faultTreeOptions={[tree]} eventTreeOptions={[]} baseEvidence={{ observations: [] }}
        validation={[]} running={false} runError={null} runResult={null} batchRunResult={null}
        calculationType={type} workflow={batch ? "BATCH" : "MANUAL"} onChange={jest.fn()}
        onRunFaultTree={onRun} onRunEventTree={onRun} onRunFaultTreeBatch={onRun} onRunEventTreeBatch={onRun}
      />
    </ToastProvider>
  );
}

describe("ranked cut sets of a fault tree dependency run", () => {
  it("turns the chosen settings into a request and leaves it out when off", () => {
    expect(cutSetSettingsOf(START_CUT_SET_CHOICE)).toBeUndefined();
    expect(cutSetSettingsOf({ ranked: true, keep: 50, limitOrder: null, cutOff: null })).toEqual({ keep: 50 });
    expect(cutSetSettingsOf({ ranked: true, keep: 50, limitOrder: 4, cutOff: -9 })).toEqual({ keep: 50, limitOrder: 4, cutOff: 1e-9 });
  });

  it("sends the settings with a single run and with a batch run", () => {
    const onRun = jest.fn();
    const { rerender } = render(panel(onRun));
    expect(screen.queryByRole("spinbutton", { name: "Cut sets kept" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Run probability", exact: true }));
    expect(onRun.mock.calls[0]?.[3]).toBeUndefined();

    fireEvent.change(screen.getByRole("combobox", { name: "Ranked cut sets" }), { target: { value: "ON" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Cut sets kept" }), { target: { value: "25" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Maximum cut set order" }), { target: { value: "3" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Cut set cutoff" }), { target: { value: "-8" } });
    fireEvent.click(screen.getByRole("button", { name: "Run probability", exact: true }));
    expect(onRun.mock.calls[1]?.[2]).toBe("PROBABILITY");
    expect(onRun.mock.calls[1]?.[3]).toEqual({ keep: 25, limitOrder: 3, cutOff: 1e-8 });

    fireEvent.change(screen.getByRole("spinbutton", { name: "Cut sets kept" }), { target: { value: "5000" } });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Maximum cut set order" }), { target: { value: "" } });
    rerender(panel(onRun, "PROBABILITY", true));
    fireEvent.click(screen.getByRole("button", { name: "Run probability batch", exact: true }));
    expect(onRun.mock.calls[2]?.[5]).toEqual({ keep: 1000, cutOff: 1e-8 });

    rerender(panel(onRun, "UNCERTAINTY"));
    expect(screen.queryByRole("combobox", { name: "Ranked cut sets" })).not.toBeInTheDocument();
  });

  it("opens the ranked cut sets of a single run with event codes and no identifiers", () => {
    const props = { batchRunResult: null, eventTreeOptions: [], faultTreeOptions: [tree] };
    const { rerender } = render(<HclResults {...props} runResult={{ kind: "FAULT_TREE", result: quantification("run-1") }} />);
    expect(screen.queryByRole("button", { name: /^Cut sets of / })).not.toBeInTheDocument();
    rerender(<HclResults {...props} runResult={{ kind: "FAULT_TREE", result: quantification("run-2", ranked) }} />);
    fireEvent.click(screen.getByRole("button", { name: "Cut sets of FT-COOL · Cooling fails" }));
    const dialog = within(screen.getByRole("dialog", { name: "Dependency cut sets" }));
    expect(dialog.getByText("COOL-PMP-FS · COOL-VLV-FO")).toBeInTheDocument();
    expect(dialog.getByText("SUP-FAN-FR")).toBeInTheDocument();
    expect(dialog.getByText("14")).toBeInTheDocument();
    expect(dialog.getByText("4.00E-03")).toBeInTheDocument();
    expect(dialog.getByRole("columnheader", { name: "Probability" })).toBeInTheDocument();
    expect(dialog.queryByText(/20000000-/)).not.toBeInTheDocument();
    fireEvent.click(dialog.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog", { name: "Dependency cut sets" })).not.toBeInTheDocument();
  });

  it("opens the cut sets of each scenario and of the hazard grid", () => {
    const hazard: HclFaultTreeHazardConvolutionResult = {
      targetKind: "FAULT_TREE",
      gridName: "Grid",
      annualFrequencyScale: { value: 2.5, unit: "PER_YEAR", annualization: { basis: "PLANT_YEAR", hoursPerYear: 8760 } },
      annualizedFrequencyScale: 2.5,
      normalizeWeights: false,
      rawWeightSum: 1,
      convolutionWeightSum: 1,
      rows: [{ scenarioId: "S-1", status: "ok", rawWeight: 1, normalizedWeight: 1, convolutionWeight: 1, annualFrequency: 2.5, conditionalProbability: 0.02, probabilityContribution: 0.02, annualContribution: 0.05 }],
      convolvedProbability: 0.02,
      integratedAnnualFrequency: 0.05,
      dependencyCutSets: { count: 2, items: [ranked.items[1]!] },
    };
    const batch: HclEditorBatchRunResult = {
      kind: "FAULT_TREE",
      scenarios: [{ scenarioId: "S-1", scenarioCode: "CELL-1", scenarioName: "Cell 1", status: "SUCCEEDED", failure: null, result: { kind: "FAULT_TREE", result: quantification("run-3", ranked) } }],
      hazardConvolution: hazard,
    };
    render(<HclResults runResult={null} batchRunResult={batch} workflow="BATCH" eventTreeOptions={[]} faultTreeOptions={[tree]} />);
    fireEvent.click(screen.getByRole("button", { name: "Cut sets of FT-COOL · Cooling fails for Weighted over the hazard grid" }));
    let dialog = within(screen.getByRole("dialog", { name: "Dependency cut sets" }));
    expect(dialog.getByRole("columnheader", { name: "Convolved probability" })).toBeInTheDocument();
    expect(dialog.getByText("SUP-FAN-FR")).toBeInTheDocument();
    expect(dialog.queryByText("COOL-PMP-FS · COOL-VLV-FO")).not.toBeInTheDocument();
    fireEvent.click(dialog.getByRole("button", { name: "Close" }));
    fireEvent.click(screen.getByRole("button", { name: "Cut sets of FT-COOL · Cooling fails for CELL-1 · Cell 1" }));
    dialog = within(screen.getByRole("dialog", { name: "Dependency cut sets" }));
    expect(dialog.getByText("CELL-1 · Cell 1")).toBeInTheDocument();
    expect(dialog.getByText("COOL-PMP-FS · COOL-VLV-FO")).toBeInTheDocument();
  });
});
