import { fireEvent, render, screen, within } from "@testing-library/react";
import type { WorkbookHclConfiguration } from "interfaces-mef-types/modeling";
import type {
  HclEventImportance,
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
    expect(cutSetSettingsOf({ ranked: true, keep: 50, limitOrder: null, cutOff: null, causes: null, importance: false })).toEqual({ keep: 50 });
    expect(cutSetSettingsOf({ ranked: true, keep: 50, limitOrder: 4, cutOff: -9, causes: 5, importance: true })).toEqual({ keep: 50, limitOrder: 4, cutOff: 1e-9, causes: 5 });
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
    fireEvent.change(screen.getByRole("spinbutton", { name: "Causes per cut set" }), { target: { value: "250" } });
    fireEvent.click(screen.getByRole("button", { name: "Run probability batch", exact: true }));
    expect(onRun.mock.calls[3]?.[5]).toEqual({ keep: 1000, cutOff: 1e-8, causes: 100 });
    fireEvent.change(screen.getByRole("spinbutton", { name: "Causes per cut set" }), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Run probability batch", exact: true }));
    expect(onRun.mock.calls[4]?.[5]).toEqual({ keep: 1000, cutOff: 1e-8 });

    rerender(panel(onRun, "UNCERTAINTY"));
    expect(screen.queryByRole("combobox", { name: "Ranked cut sets" })).not.toBeInTheDocument();
  });

  it("asks for importance with and without ranked cut sets", () => {
    const onRun = jest.fn();
    const { rerender } = render(panel(onRun));
    fireEvent.change(screen.getByRole("combobox", { name: "Importance" }), { target: { value: "ON" } });
    fireEvent.click(screen.getByRole("button", { name: "Run probability", exact: true }));
    expect(onRun.mock.calls[0]?.slice(2)).toEqual(["PROBABILITY", undefined, true]);
    fireEvent.change(screen.getByRole("combobox", { name: "Ranked cut sets" }), { target: { value: "ON" } });
    rerender(panel(onRun, "PROBABILITY", true));
    fireEvent.click(screen.getByRole("button", { name: "Run probability batch", exact: true }));
    expect(onRun.mock.calls[1]?.slice(4)).toEqual(["PROBABILITY", { keep: 100 }, true]);
    fireEvent.change(screen.getByRole("combobox", { name: "Importance" }), { target: { value: "OFF" } });
    fireEvent.click(screen.getByRole("button", { name: "Run probability batch", exact: true }));
    expect(onRun.mock.calls[2]?.slice(4)).toEqual(["PROBABILITY", { keep: 100 }]);
    rerender(panel(onRun, "UNCERTAINTY"));
    expect(screen.queryByRole("combobox", { name: "Ranked cut sets" })).not.toBeInTheDocument();
    expect(screen.queryByRole("spinbutton", { name: "Events sampled for importance" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "Importance" }), { target: { value: "ON" } });
    expect(screen.getByRole("spinbutton", { name: "Events sampled for importance" })).toHaveValue(10);
    fireEvent.change(screen.getByRole("spinbutton", { name: "Events sampled for importance" }), { target: { value: "500" } });
    expect(screen.getByRole("spinbutton", { name: "Events sampled for importance" })).toHaveValue(100);
    fireEvent.change(screen.getByRole("spinbutton", { name: "Events sampled for importance" }), { target: { value: "4" } });
  });

  it("shows the sampled range of each importance measure for the sampled events", () => {
    const measure = (mean: number) => ({ sampleCount: 40, mean, percentile05: mean / 2, median: mean * 1.1, percentile95: mean * 1.5 });
    const importance: HclEventImportance[] = [
      { basicEventId: id(11), probability: 0.03, occurred: 0.4, notOccurred: 0.008, birnbaum: 0.392, riskAchievementWorth: 20, riskReductionWorth: 2.5, fussellVesely: 0.6, criticality: 0.61,
        uncertainty: { birnbaum: measure(0.3), riskAchievementWorth: measure(18), riskReductionWorth: null, fussellVesely: measure(0.55), criticality: measure(0.5) } },
      { basicEventId: id(12), probability: 0.01, occurred: 0.5, notOccurred: 0.015, birnbaum: 0.485, riskAchievementWorth: 25, riskReductionWorth: 1.333, fussellVesely: 0.25, criticality: 0.25 },
    ];
    render(<HclResults batchRunResult={null} eventTreeOptions={[]} faultTreeOptions={[tree]} calculationType="UNCERTAINTY" runResult={{ kind: "FAULT_TREE", result: { ...quantification("run-7"), dependencyImportance: importance } }} />);
    fireEvent.click(screen.getByRole("button", { name: "Importance of FT-COOL · Cooling fails" }));
    const dialog = within(screen.getByRole("dialog", { name: "Dependency importance" }));
    const sampled = within(dialog.getByRole("table", { name: "Importance uncertainty" }));
    expect(sampled.getAllByRole("row")).toHaveLength(2);
    expect(sampled.getByText("COOL-PMP-FS")).toBeInTheDocument();
    expect(sampled.getByText("5.50E-01")).toBeInTheDocument();
    expect(sampled.getByText("2.75E-01")).toBeInTheDocument();
    expect(sampled.getByText("8.25E-01")).toBeInTheDocument();
    fireEvent.change(dialog.getByRole("combobox", { name: "Importance measure" }), { target: { value: "riskReductionWorth" } });
    const worth = within(dialog.getByRole("table", { name: "Importance uncertainty" }));
    expect(worth.getByText("2.50E+00")).toBeInTheDocument();
    expect(worth.getAllByText("—")).toHaveLength(4);
    expect(within(dialog.getByRole("table", { name: "Importance" })).getAllByRole("row")).toHaveLength(3);
  });

  it("opens the importance of a run, most important first, with event codes", () => {
    const importance: HclEventImportance[] = [
      { basicEventId: id(13), probability: 1, occurred: 0.02, notOccurred: null, birnbaum: null, riskAchievementWorth: 1, riskReductionWorth: null, fussellVesely: null, criticality: 1 },
      { basicEventId: id(12), probability: 0.01, occurred: 0.5, notOccurred: 0.015, birnbaum: 0.485, riskAchievementWorth: 25, riskReductionWorth: 1.333, fussellVesely: 0.25, criticality: 0.25 },
      { basicEventId: id(11), probability: 0.03, occurred: 0.4, notOccurred: 0.008, birnbaum: 0.392, riskAchievementWorth: 20, riskReductionWorth: 2.5, fussellVesely: 0.6, criticality: 0.61 },
    ];
    const props = { batchRunResult: null, eventTreeOptions: [], faultTreeOptions: [tree] };
    const { rerender } = render(<HclResults {...props} runResult={{ kind: "FAULT_TREE", result: quantification("run-5") }} />);
    expect(screen.queryByRole("button", { name: /^Importance of / })).not.toBeInTheDocument();
    rerender(<HclResults {...props} runResult={{ kind: "FAULT_TREE", result: { ...quantification("run-6"), dependencyImportance: importance } }} />);
    fireEvent.click(screen.getByRole("button", { name: "Importance of FT-COOL · Cooling fails" }));
    const dialog = within(screen.getByRole("dialog", { name: "Dependency importance" }));
    const rows = within(dialog.getByRole("table", { name: "Importance" })).getAllByRole("row").slice(1);
    expect(rows.map((row) => within(row).getAllByRole("cell")[0]?.textContent)).toEqual(["COOL-PMP-FS", "COOL-VLV-FO", "SUP-FAN-FR"]);
    expect(within(rows[0]!).getByText("6.00E-01")).toBeInTheDocument();
    expect(within(rows[0]!).getByText("2.00E+01")).toBeInTheDocument();
    expect(within(rows[2]!).getAllByText("—")).toHaveLength(3);
    expect(dialog.queryByText(/20000000-/)).not.toBeInTheDocument();
    for (const heading of ["Basic event", "Probability", "Fussell-Vesely", "Birnbaum", "RAW", "RRW", "Criticality"]) {
      expect(dialog.getByRole("columnheader", { name: heading })).toBeInTheDocument();
    }
    fireEvent.click(dialog.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog", { name: "Dependency importance" })).not.toBeInTheDocument();
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

  it("lists the network nodes a cut set shifts and goes back to the cut sets", () => {
    const nodes = [{ id: id(21), code: "SEISMIC-LEVEL", states: [{ id: id(22), code: "NONE" }, { id: id(23), code: "PGA3" }] }];
    const traced: HclFaultTreeDependencyCutSets = {
      count: 2,
      items: [
        { ...ranked.items[0]!, causes: [{ nodeId: id(21), stateId: id(23), baseline: 0.002, withCutSet: 0.75, shift: 0.748 }] },
        { ...ranked.items[1]!, causes: [] },
      ],
    };
    render(<HclResults batchRunResult={null} eventTreeOptions={[]} faultTreeOptions={[tree]} networkNodes={nodes} runResult={{ kind: "FAULT_TREE", result: quantification("run-4", traced) }} />);
    fireEvent.click(screen.getByRole("button", { name: "Cut sets of FT-COOL · Cooling fails" }));
    const dialog = within(screen.getByRole("dialog", { name: "Dependency cut sets" }));
    expect(dialog.getByRole("columnheader", { name: "Causes" })).toBeInTheDocument();
    expect(dialog.getByText("None")).toBeInTheDocument();
    fireEvent.click(dialog.getByRole("button", { name: "Causes of COOL-PMP-FS · COOL-VLV-FO" }));
    const causes = within(dialog.getByRole("table", { name: "Causes of the cut set" }));
    expect(causes.getByText("SEISMIC-LEVEL")).toBeInTheDocument();
    expect(causes.getByText("PGA3")).toBeInTheDocument();
    expect(causes.getByText("2.00E-03")).toBeInTheDocument();
    expect(causes.getByText("7.50E-01")).toBeInTheDocument();
    expect(dialog.queryByText(/20000000-/)).not.toBeInTheDocument();
    expect(dialog.queryByRole("table", { name: "Ranked cut sets" })).not.toBeInTheDocument();
    fireEvent.click(dialog.getByRole("button", { name: "Back to cut sets" }));
    expect(dialog.getByRole("table", { name: "Ranked cut sets" })).toBeInTheDocument();
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
