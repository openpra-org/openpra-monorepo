import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState, type JSX } from "react";
import type { EsqHclConfiguration } from "interfaces-mef-types/esq/workbook-models";
import type { BayesianNetworkEvidenceConfiguration, WorkbookHclConfiguration } from "interfaces-mef-types/modeling";
import {
  validateBayesianNetworkModel,
  type BayesianNetworkAnalysisResult,
  type BayesianNetworkModel,
} from "interfaces-shared-types/newly-developed-methods/bayesian-network";
import { BayesianNetworkEditor } from "../bayesianNetworkEditor";
import { connectNodes } from "../bayesianNetworkOperations";
import type { BayesianNetworkFaultTreeOption } from "../bayesianNetworkTypes";
import { ToastContainer } from "../../../toast/toastContainer";
import { ToastProvider } from "../../../toast/toastProvider";
import {
  HclBindingEditor,
  type HclEditorBatchRunResult,
  type HclEditorRunResult,
  type HclEventTreeOption,
} from "../../hybrid-causal-logic";
import { TEST_ID, testBayesianNetworkModel } from "./bayesianNetworkTestModel";

const WORKBOOK_ID = "esq-workbook";
const FT_WORKBOOK_ID = "sy-workbook";
const FT_MODEL_ID = "20000000-0000-4000-8000-000000000001";
const BASIC_EVENT_ID = "20000000-0000-4000-8000-000000000002";
const TOP_GATE_ID = "20000000-0000-4000-8000-000000000003";
const ET_MODEL_ID = "20000000-0000-4000-8000-000000000005";

function pointerEvent(
  type: "pointerdown" | "pointermove" | "pointerup",
  init: MouseEventInit & { pointerId: number },
): Event {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, ...init });
  Object.defineProperty(event, "pointerId", { value: init.pointerId });
  return event;
}

const faultTreeOptions: BayesianNetworkFaultTreeOption[] = [{
  workbookId: FT_WORKBOOK_ID,
  workbookName: "Systems workbook",
  modelId: FT_MODEL_ID,
  modelCode: "FT-A",
  modelName: "Fault tree A",
  topGateId: TOP_GATE_ID,
  basicEvents: [{ id: BASIC_EVENT_ID, code: "BE-PUMP", name: "Pump failure" }],
  gates: [{ id: TOP_GATE_ID, gateType: "OR" }],
  leafNodes: [{ id: "20000000-0000-4000-8000-000000000004", kind: "BASIC_EVENT_REFERENCE", basicEventId: BASIC_EVENT_ID }],
  gateInputs: [{
    gateId: TOP_GATE_ID,
    childId: "20000000-0000-4000-8000-000000000004",
    order: 0,
  }],
  constantBasicEventStates: {},
}];

const syOwnedConfiguration: WorkbookHclConfiguration = {
  modelId: "20000000-0000-4000-8000-000000000006",
  code: "HCL-SY",
  name: "SY dependency configuration",
  description: "Fault-tree dependency configuration owned by Systems Analysis.",
  bayesianNetwork: { workbookId: FT_WORKBOOK_ID, modelId: TEST_ID.model },
  faultTrees: [{ workbookId: FT_WORKBOOK_ID, modelId: FT_MODEL_ID }],
  bindings: [],
  baseEvidence: { observations: [] },
  evidenceScenarios: [],
  solverSettings: { variableOrder: null, foldConstants: true, spliceNullGates: true },
};

const linkedEventTree: HclEventTreeOption = {
  workbookId: "es-workbook",
  workbookName: "Event Sequence Analysis",
  modelId: ET_MODEL_ID,
  modelName: "Loss of cooling event tree",
  sequences: [{ id: "20000000-0000-4000-8000-000000000007", name: "Safe" }],
  faultTrees: [{ workbookId: FT_WORKBOOK_ID, modelId: FT_MODEL_ID }],
  linkedFaultTrees: [{
    workbookId: FT_WORKBOOK_ID,
    workbookName: "Systems workbook",
    modelId: FT_MODEL_ID,
    modelCode: "FT-A",
    modelName: "Fault tree A",
    functionalEvents: [{
      id: "20000000-0000-4000-8000-000000000008",
      code: "FE-PUMP",
      name: "Pump responds",
      topGateId: TOP_GATE_ID,
    }],
  }],
  transferTargets: [],
};

const analysisResult: BayesianNetworkAnalysisResult = {
  schemaVersion: "1.0.0",
  runId: "30000000-0000-4000-8000-000000000001",
  owner: { workbookId: WORKBOOK_ID, modelId: TEST_ID.model, workbookRevision: 2 },
  evidence: { observations: [] },
  marginals: [{
    nodeId: TEST_ID.a,
    values: [
      { stateId: TEST_ID.aFalse, probability: 0.8 },
      { stateId: TEST_ID.aTrue, probability: 0.2 },
    ],
  }],
  validationIssues: [],
  completedAt: "2026-08-23T12:00:00.000Z",
};

const unchangedBatchResult: HclEditorBatchRunResult = {
  kind: "FAULT_TREE",
  scenarios: ["1", "2"].map((suffix) => ({
    scenarioId: `30000000-0000-4000-8000-00000000000${suffix}`,
    scenarioCode: `SCN-${suffix}`,
    scenarioName: `Scenario ${suffix}`,
    status: "SUCCEEDED" as const,
    failure: null,
    result: {
      kind: "FAULT_TREE" as const,
      result: {
        schemaVersion: "1.0.0" as const,
        runId: `40000000-0000-4000-8000-00000000000${suffix}`,
        owner: { workbookId: WORKBOOK_ID, modelId: TEST_ID.model, workbookRevision: 2 },
        faultTreeTopGate: {
          referenceType: "FAULT_TREE_TOP_EVENT" as const,
          workbookId: FT_WORKBOOK_ID,
          modelId: FT_MODEL_ID,
          entityId: TOP_GATE_ID,
        },
        probability: 0.25,
        bddNodes: 1,
        bddVariables: 1,
        variableOrder: [BASIC_EVENT_ID],
        bridge: {
          quantifications: 1,
          bddContextCacheHits: 0,
          bddContextCacheMisses: 1,
          bnQueryCacheHits: 0,
          bnQueryCacheMisses: 1,
        },
        junctionTree: {
          numCliques: 1,
          maxCliqueSize: 1,
          treewidth: 0,
          totalTableEntries: 2,
        },
        validationIssues: [],
        completedAt: "2026-08-31T12:00:00.000Z",
      },
    },
  })),
};

const commonHclResult = unchangedBatchResult.scenarios[0]!.result as HclEditorRunResult;
const hazardBatchResult: HclEditorBatchRunResult = {
  ...unchangedBatchResult,
  hazardConvolution: {
    targetKind: "FAULT_TREE",
    gridName: "Hazard grid",
    annualFrequencyScale: {
      value: 1,
      unit: "PER_YEAR",
      annualization: { basis: "PLANT_YEAR", hoursPerYear: 8_760 },
    },
    annualizedFrequencyScale: 1,
    normalizeWeights: true,
    rawWeightSum: 0.9944,
    convolutionWeightSum: 1,
    rows: unchangedBatchResult.scenarios.map((scenario, index) => ({
      scenarioId: scenario.scenarioId,
      rawWeight: index === 0 ? 0.75 : 0.2444,
      normalizedWeight: index === 0 ? 0.7542 : 0.2458,
      convolutionWeight: index === 0 ? 0.7542 : 0.2458,
      annualFrequency: index === 0 ? 0.7542 : 0.2458,
      conditionalProbability: 0.25,
      annualContribution: index === 0 ? 0.18855 : 0.06145,
    })),
    integratedAnnualFrequency: 0.25,
  },
};

function Harness({
  initialModel = testBayesianNetworkModel(),
  editable = true,
  showQueryAnalysis = true,
  hclScope = "FAULT_TREE",
  result = null,
  onRun = jest.fn(),
  onConfigurationsChange = jest.fn(),
  onRunHclFaultTree = jest.fn(),
  onRunHclFaultTreeBatch = jest.fn(),
  hclRunResult = null,
  hclBatchRunResult = null,
  onModelChange = jest.fn(),
}: {
  initialModel?: BayesianNetworkModel;
  editable?: boolean;
  showQueryAnalysis?: boolean;
  hclScope?: "BOTH" | "FAULT_TREE" | "EVENT_TREE";
  result?: BayesianNetworkAnalysisResult | null;
  onRun?: () => void;
  onConfigurationsChange?: (configurations: EsqHclConfiguration[]) => void;
  onRunHclFaultTree?: jest.Mock;
  onRunHclFaultTreeBatch?: jest.Mock;
  hclRunResult?: HclEditorRunResult | null;
  hclBatchRunResult?: HclEditorBatchRunResult | null;
  onModelChange?: (model: BayesianNetworkModel) => void;
}): JSX.Element {
  const [model, setModel] = useState(initialModel);
  const [evidence, setEvidence] = useState<BayesianNetworkEvidenceConfiguration>({ observations: [] });
  const [queryNodeId, setQueryNodeId] = useState<string | null>(model.nodes[0]?.id ?? null);
  const [configurations, setConfigurations] = useState<EsqHclConfiguration[]>([]);
  const validation = validateBayesianNetworkModel(model, {
    evidence,
    hclBindings: configurations.flatMap((configuration) => configuration.bindings),
    workbookId: WORKBOOK_ID,
  });
  function replaceConfigurations(next: EsqHclConfiguration[]): void {
    setConfigurations(next);
    onConfigurationsChange(next);
  }
  function replaceModel(next: BayesianNetworkModel): void {
    setModel(next);
    onModelChange(next);
  }
  return (
    <ToastProvider>
      <BayesianNetworkEditor
        model={model}
        editable={editable}
        showQueryAnalysis={showQueryAnalysis}
        hclScope={hclScope}
        evidence={evidence}
        queryNodeId={queryNodeId}
        validation={validation}
        analysisResult={result}
        running={false}
        runError={null}
        workbookId={WORKBOOK_ID}
        hclConfigurations={configurations}
        faultTreeOptions={faultTreeOptions}
        eventTreeOptions={[]}
        hclRunning={false}
        hclRunError={null}
        hclRunResult={hclRunResult}
        hclBatchRunResult={hclBatchRunResult}
        onModelChange={replaceModel}
        onEvidenceChange={setEvidence}
        onQueryNodeChange={setQueryNodeId}
        onHclConfigurationsChange={replaceConfigurations}
        onRunHclFaultTree={onRunHclFaultTree}
        onRunHclEventTree={jest.fn()}
        onRunHclFaultTreeBatch={onRunHclFaultTreeBatch}
        onRunHclEventTreeBatch={jest.fn()}
        onRun={onRun}
      />
      <ToastContainer />
    </ToastProvider>
  );
}

describe("BayesianNetworkEditor", () => {
  afterEach(() => jest.restoreAllMocks());

  it("renders the canonical graph, CPT, and exact-query controls", () => {
    render(<Harness />);

    expect(screen.getByLabelText("Bayesian-network graph")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /BN node/i })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: /Connection handle/i })).toHaveLength(8);
    expect(screen.getAllByLabelText(/State code/)).toHaveLength(2);
    expect(screen.queryByLabelText(/State name/)).not.toBeInTheDocument();
    expect(screen.getByLabelText("CPT for A")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run exact inference" })).toBeEnabled();
    expect(screen.queryByText(/backend selector/i)).not.toBeInTheDocument();
  });

  it("keeps evidence and HCL setup behind compact progressive controls", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    expect(screen.queryByText("No evidence")).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "BN query" })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByLabelText("Evidence for A")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create HCL configuration" })).not.toBeInTheDocument();
    const evidenceAction = screen.getByRole("button", { name: "Edit evidence" });
    expect(evidenceAction.closest(".bneditor__query-composer")).not.toBeNull();
    expect(evidenceAction).toHaveClass("posnav__btn", "posnav__btn--sm");

    await user.click(screen.getByRole("button", { name: "Edit evidence" }));
    expect(screen.getByLabelText("Evidence editor")).toBeInTheDocument();
    expect(screen.getByLabelText("Evidence for A")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "HCL quantification" }));
    expect(screen.getByRole("button", { name: "Create HCL configuration" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Run exact inference" })).not.toBeInTheDocument();
  });

  it("adds a node and supports undo and redo", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: "Add node" }));
    expect(screen.getAllByRole("button", { name: /BN node/i })).toHaveLength(3);
    await user.click(screen.getByRole("button", { name: "Undo" }));
    expect(screen.getAllByRole("button", { name: /BN node/i })).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: "Redo" }));
    expect(screen.getAllByRole("button", { name: /BN node/i })).toHaveLength(3);
  });

  it("closes the node inspector when the blank canvas is clicked", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    expect(screen.getByLabelText("Bayesian-network node inspector")).toBeInTheDocument();

    await user.click(screen.getByLabelText("Bayesian-network graph"));

    expect(screen.queryByLabelText("Bayesian-network node inspector")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "BN node Cause" }));
    expect(screen.getByLabelText("Bayesian-network node inspector")).toBeInTheDocument();
  });

  it("allows temporarily empty node identity fields without persisting an invalid model", async () => {
    const user = userEvent.setup();
    const onModelChange = jest.fn();
    render(<Harness onModelChange={onModelChange} />);
    const inspector = screen.getByLabelText("Bayesian-network node inspector");
    const code = within(inspector).getByLabelText("Code");
    const name = within(inspector).getByLabelText("Name");

    await user.clear(code);
    expect(code).toHaveValue("");
    expect(onModelChange).not.toHaveBeenCalled();
    expect(screen.getByText("Node code is required.")).toBeInTheDocument();

    await user.type(code, "X");
    expect(code).toHaveValue("X");
    expect(onModelChange).toHaveBeenCalledWith(expect.objectContaining({
      nodes: expect.arrayContaining([expect.objectContaining({ id: TEST_ID.a, code: "X" })]),
    }));

    onModelChange.mockClear();
    await user.clear(name);
    expect(name).toHaveValue("");
    expect(onModelChange).not.toHaveBeenCalled();
    expect(screen.getByText("Node name is required.")).toBeInTheDocument();
  });

  it("keeps a duplicate node code local and reports it through a warning toast", async () => {
    const user = userEvent.setup();
    const onModelChange = jest.fn();
    render(<Harness onModelChange={onModelChange} />);
    const code = within(screen.getByLabelText("Bayesian-network node inspector")).getByLabelText("Code");

    await user.clear(code);
    await user.type(code, "b");

    expect(code).toHaveValue("b");
    expect(onModelChange).not.toHaveBeenCalled();
    expect(screen.getByText("Bayesian-network node codes must be unique.")).toBeInTheDocument();
    expect(screen.queryByText("Validation")).not.toBeInTheDocument();
  });

  it("allows a temporarily empty state code without persisting an invalid model", async () => {
    const user = userEvent.setup();
    const onModelChange = jest.fn();
    render(<Harness onModelChange={onModelChange} />);
    const stateCode = screen.getAllByLabelText(/State code/)[0]!;

    await user.clear(stateCode);

    expect(stateCode).toHaveValue("");
    expect(onModelChange).not.toHaveBeenCalled();
    expect(screen.getByText("State code is required.")).toBeInTheDocument();

    await user.type(stateCode, "OFF");
    expect(stateCode).toHaveValue("OFF");
    expect(onModelChange).toHaveBeenLastCalledWith(expect.objectContaining({
      nodes: expect.arrayContaining([expect.objectContaining({
        id: TEST_ID.a,
        states: expect.arrayContaining([expect.objectContaining({ id: TEST_ID.aFalse, code: "OFF" })]),
      })]),
    }));
  });

  it("creates and instantiates a reusable branch module with compatible inputs", async () => {
    const user = userEvent.setup();
    const initial = testBayesianNetworkModel();
    initial.nodes[1]!.states = initial.nodes[1]!.states.map((state, index) => ({
      ...state,
      code: index === 0 ? "OFF" : "ON",
    }));
    render(<Harness initialModel={connectNodes(initial, TEST_ID.a, TEST_ID.b)} />);

    await user.click(screen.getByRole("button", { name: "BN node Effect" }));
    await user.click(screen.getByRole("button", { name: "Reusable modules" }));
    expect(screen.queryByText("Reusable modules", { selector: "strong" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Save a branch once/i)).not.toBeInTheDocument();
    expect(screen.getByText("Select the branch root and save it as a module")).toBeInTheDocument();
    const save = screen.getByRole("button", { name: "Save" });
    expect(save).toHaveClass("bneditor__module-save");
    await user.click(save);

    const savedModules = screen.getByLabelText("Saved modules");
    const moduleCard = within(savedModules).getByText("MOD-B").closest("details");
    expect(moduleCard).not.toHaveAttribute("open");
    await user.click(within(savedModules).getByText("MOD-B"));
    expect(moduleCard).toHaveAttribute("open");
    expect(within(savedModules).getByLabelText("Code")).toHaveValue("MOD-B-1");
    expect(within(savedModules).getByLabelText("Name")).toHaveValue("Effect module 1");
    expect(within(savedModules).getByText("Input")).toBeInTheDocument();
    const inputList = within(savedModules).getByText("Input").parentElement;
    expect(inputList).toHaveTextContent(/^InputA$/);
    expect(inputList).not.toHaveTextContent(/→|Cause/);
    expect(within(savedModules).queryByRole("combobox", { name: "Input A" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Instance code|Instance name|Add instance/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Use this module" }));

    expect(screen.getAllByRole("button", { name: /BN node/i })).toHaveLength(3);
    expect(screen.getByText("Module instance")).toBeInTheDocument();
  });

  it("closes the reusable-module viewport when clicking outside it", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const trigger = screen.getByRole("button", { name: "Reusable modules" });
    const menu = trigger.closest("details");
    await user.click(trigger);
    expect(menu).toHaveAttribute("open");

    await user.click(screen.getByLabelText("Bayesian-network graph"));

    expect(menu).not.toHaveAttribute("open");
  });

  it("uses the shared icon treatment for history, file, and canvas tools", () => {
    render(<Harness />);

    const toolbar = screen.getByLabelText("Bayesian-network tools");
    ["Undo", "Redo", "File"].forEach((name) => {
      const control = within(toolbar).getByRole("button", { name });
      expect(control).toContainHTML("<svg");
      expect(control).not.toHaveTextContent(name);
    });

    const canvas = screen.getByLabelText("Bayesian-network graph").closest(".bneditor__canvas");
    const controls = screen.getByLabelText("Bayesian-network canvas controls");
    expect(canvas).toContainElement(controls);
    ["Add node", "Auto arrange", "Zoom out", "Zoom in", "Fit"].forEach((name) => {
      expect(within(controls).getByRole("button", { name })).toContainHTML("<svg");
    });

    const deleteNode = screen.getByRole("button", { name: "Delete node" });
    const inspector = screen.getByLabelText("Bayesian-network node inspector");
    expect(deleteNode).toHaveClass("posnav__btn", "posnav__btn--sm", "bneditor__delete-btn");
    expect(deleteNode).toContainHTML("<svg");
    expect(inspector.lastElementChild).toContainElement(deleteNode);
    expect(screen.queryByText("Selected node")).not.toBeInTheDocument();

    const inferenceAction = screen.getByRole("button", { name: "Run exact inference" });
    expect(inferenceAction).toHaveClass(
      "posnav__btn",
      "posnav__btn--sm",
      "posnav__btn--primary",
      "bneditor__query-submit",
    );
    expect(inferenceAction).toContainHTML("<svg");

    fireEvent.click(screen.getByRole("tab", { name: "HCL quantification" }));
    const configurationAction = screen.getByRole("button", { name: "Create HCL configuration" });
    expect(configurationAction).toHaveClass("posnav__btn", "posnav__btn--sm", "posnav__btn--primary");
    expect(configurationAction).toContainHTML("<svg");
  });

  it("offers a centered first-node action before showing canvas controls", async () => {
    const user = userEvent.setup();
    const emptyModel = testBayesianNetworkModel();
    emptyModel.nodes = [];
    emptyModel.edges = [];
    emptyModel.conditionalProbabilityTables = [];
    emptyModel.nodePositions = [];
    render(<Harness initialModel={emptyModel} />);

    const editor = screen.getByTestId("bayesian-network-editor");
    expect(editor.querySelector(".bneditor__workspace")).not.toHaveClass("bneditor__workspace--inspecting");
    expect(screen.queryByLabelText("Bayesian-network node inspector")).not.toBeInTheDocument();
    expect(screen.getByText("Add node to begin.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add first node" })).toContainHTML("<svg");
    expect(screen.queryByLabelText("Bayesian-network canvas controls")).not.toBeInTheDocument();
    expect(screen.queryByText("No discrete nodes yet")).not.toBeInTheDocument();
    expect(screen.queryByText(/Select a node to edit/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Add first node" }));

    expect(screen.getByLabelText("Bayesian-network canvas controls")).toBeInTheDocument();
    expect(screen.getByLabelText("Bayesian-network node inspector")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add first node" })).not.toBeInTheDocument();
  });

  it("groups import and export actions under the File menu", async () => {
    const user = userEvent.setup();
    const inputClick = jest.spyOn(HTMLInputElement.prototype, "click").mockImplementation();
    render(<Harness />);

    const fileButton = screen.getByRole("button", { name: "File" });
    const details = fileButton.closest("details");
    expect(details).not.toHaveAttribute("open");
    await user.click(fileButton);
    expect(details).toHaveAttribute("open");
    const menu = screen.getByRole("menu", { name: "Bayesian-network file actions" });
    expect(within(menu).getAllByRole("menuitem").map((item) => item.textContent)).toEqual([
      "Export XDSL",
      "Export JSON",
      "Import XDSL",
      "Import JSON",
    ]);

    await user.click(within(menu).getByRole("menuitem", { name: "Import JSON" }));
    expect(inputClick).toHaveBeenCalledTimes(1);
    expect(details).not.toHaveAttribute("open");
  });

  it("warns and rebuilds CPTs after a state change", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: "Add state" }));

    const dialog = screen.getByRole("alertdialog", { name: "Rebuild probability tables?" });
    expect(dialog).toHaveTextContent(/will not be reinterpreted/i);
    expect(screen.getAllByLabelText(/State code/)).toHaveLength(2);
    await user.click(within(dialog).getByRole("button", { name: "Rebuild CPTs" }));

    expect(screen.getAllByLabelText(/State code/)).toHaveLength(3);
    const cpt = screen.getByLabelText("CPT for A");
    expect(within(cpt).getByLabelText("A STATE-3 probability")).toHaveDisplayValue("0.33");
  });

  it("reveals destination docks, snaps to one, and connects only through it", () => {
    render(<Harness />);

    const target = screen
      .getByRole("button", { name: "BN node Effect" })
      .closest<HTMLElement>("[data-bn-node-id]");
    expect(target).not.toBeNull();
    const handle = screen.getByRole("button", { name: "Connection handle A right" });
    fireEvent(handle, pointerEvent("pointerdown", {
      button: 0,
      pointerId: 7,
      clientX: 220,
      clientY: 82,
    }));
    expect(document.querySelector(".bneditor__connection-preview")).toBeInTheDocument();
    fireEvent(handle, pointerEvent("pointermove", {
      pointerId: 7,
      clientX: 390,
      clientY: 82,
    }));
    expect(target).toHaveClass("is-connection-candidate");
    expect(target).not.toHaveClass("is-connection-target");
    within(target!).getAllByRole("button", { name: /Connection handle B/ }).forEach((dock) => {
      expect(dock).toHaveClass("is-dock-option");
      expect(dock).not.toHaveClass("is-dock-active");
    });

    fireEvent(handle, pointerEvent("pointermove", {
      pointerId: 7,
      clientX: 300,
      clientY: 82,
    }));
    expect(target).toHaveClass("is-connection-target");
    expect(screen.getByRole("button", { name: "Connection handle B left" })).toHaveClass("is-dock-active");
    expect(document.querySelector(".bneditor__connection-preview")).toHaveClass("is-docked");
    expect(document.querySelector(".bneditor__connection-preview")).toHaveAttribute(
      "d",
      expect.stringMatching(/L 300 82$/),
    );
    fireEvent(handle, pointerEvent("pointerup", {
      button: 0,
      pointerId: 7,
      clientX: 300,
      clientY: 82,
    }));

    expect(screen.getByTestId("bayesian-network-edge")).toBeInTheDocument();
    expect(screen.getByLabelText("CPT for B").querySelectorAll("tbody tr")).toHaveLength(2);
    expect(document.querySelector(".bneditor__connection-preview")).not.toBeInTheDocument();
    expect(screen.queryByText(/Connecting from/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Connect from/ })).not.toBeInTheDocument();
  });

  it("does not connect when released over a node away from its docking points", () => {
    render(<Harness />);

    const handle = screen.getByRole("button", { name: "Connection handle A right" });
    fireEvent(handle, pointerEvent("pointerdown", {
      button: 0,
      pointerId: 8,
      clientX: 220,
      clientY: 82,
    }));
    fireEvent(handle, pointerEvent("pointermove", {
      pointerId: 8,
      clientX: 390,
      clientY: 82,
    }));
    fireEvent(handle, pointerEvent("pointerup", {
      button: 0,
      pointerId: 8,
      clientX: 390,
      clientY: 82,
    }));

    expect(screen.queryByTestId("bayesian-network-edge")).not.toBeInTheDocument();
  });

  it("selects and moves a node with a left-button drag", () => {
    render(<Harness />);

    const node = screen.getByRole("button", { name: "BN node Effect" });
    const shell = node.closest<HTMLElement>("[data-bn-node-id]");
    expect(shell).not.toBeNull();
    fireEvent(node, pointerEvent("pointerdown", {
      button: 0,
      pointerId: 9,
      clientX: 320,
      clientY: 70,
    }));
    expect(screen.getByLabelText("Bayesian-network node inspector")).toHaveTextContent("B");
    fireEvent(node, pointerEvent("pointermove", {
      pointerId: 9,
      clientX: 380,
      clientY: 120,
    }));
    fireEvent(node, pointerEvent("pointerup", {
      button: 0,
      pointerId: 9,
      clientX: 380,
      clientY: 120,
    }));

    expect(shell).toHaveStyle({ left: "360px", top: "90px" });
  });

  it("opens an edge context menu on right click and deletes the connection", async () => {
    const user = userEvent.setup();
    render(<Harness initialModel={connectNodes(testBayesianNetworkModel(), TEST_ID.a, TEST_ID.b)} />);

    expect(screen.getByTestId("bayesian-network-edge")).toBeInTheDocument();
    fireEvent.contextMenu(screen.getByTestId("bayesian-network-edge-hit"), {
      clientX: 280,
      clientY: 140,
    });
    const menu = screen.getByRole("menu", { name: "Actions for connection A to B" });
    expect(menu).toBeInTheDocument();
    await user.click(within(menu).getByRole("menuitem", { name: "Delete connection" }));

    expect(screen.queryByTestId("bayesian-network-edge")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "BN node Effect" }));
    expect(screen.getByLabelText("CPT for B").querySelectorAll("tbody tr")).toHaveLength(1);
  });

  it("keeps zoom controls with the canvas and scales only its contents", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const workspace = screen.getByTestId("bayesian-network-editor").querySelector(".bneditor__workspace");
    const heightBefore = workspace?.getBoundingClientRect().height;
    expect(screen.getByLabelText("Bayesian-network canvas controls")).toBeInTheDocument();
    expect(screen.getByLabelText("Zoom level")).toHaveTextContent("100%");
    await user.click(screen.getByRole("button", { name: "Zoom in" }));

    expect(screen.getByLabelText("Zoom level")).toHaveTextContent("110%");
    expect(workspace?.getBoundingClientRect().height).toBe(heightBefore);
  });

  it("does not automatically enlarge the network beyond its saved zoom", () => {
    jest.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(900);
    jest.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(500);

    render(<Harness />);

    expect(screen.getByLabelText("Zoom level")).toHaveTextContent("100%");
  });

  it("allows deliberate zooming beyond the automatic fit scale", async () => {
    const user = userEvent.setup();
    jest.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(300);
    jest.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(500);

    render(<Harness />);
    expect(screen.getByLabelText("Zoom level")).toHaveTextContent("52%");
    await user.click(screen.getByRole("button", { name: "Zoom in" }));

    expect(screen.getByLabelText("Zoom level")).toHaveTextContent("62%");
  });

  it("disables zoom in when a viewport constraint prevents the requested increase", async () => {
    const user = userEvent.setup();
    const resizeCallbacks: ResizeObserverCallback[] = [];
    class TestResizeObserver implements ResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        resizeCallbacks.push(callback);
      }
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
    Object.defineProperty(globalThis, "ResizeObserver", {
      configurable: true,
      value: TestResizeObserver,
    });
    jest.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(640);
    jest.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(500);

    render(<Harness />);
    const zoomIn = screen.getByRole("button", { name: "Zoom in" });
    await user.click(zoomIn);
    await user.click(zoomIn);
    expect(screen.getByLabelText("Zoom level")).toHaveTextContent("120%");

    act(() => resizeCallbacks.at(-1)?.([], {} as ResizeObserver));

    expect(screen.getByLabelText("Zoom level")).toHaveTextContent("117%");
    expect(zoomIn).toBeDisabled();
    delete (globalThis as { ResizeObserver?: typeof ResizeObserver }).ResizeObserver;
  });

  it("identifies an invalid row and normalizes it only on request", async () => {
    const user = userEvent.setup();
    const initial = testBayesianNetworkModel();
    initial.conditionalProbabilityTables[0]!.rows[0]!.values.forEach((value) => { value.probability = 0.2; });
    render(<Harness initialModel={initial} />);

    const cpt = screen.getByLabelText("CPT for A");
    expect(within(cpt).queryByText(/Rows are never normalized automatically/)).not.toBeInTheDocument();
    expect(within(cpt).getByRole("columnheader", { name: "Row actions" })).toBeEmptyDOMElement();
    expect(within(cpt).queryByRole("columnheader", { name: "Action" })).not.toBeInTheDocument();
    expect(within(cpt).getByLabelText("A FALSE probability")).toHaveDisplayValue("0.20");
    expect(screen.getByLabelText(`Row total ${TEST_ID.aRow}`)).toHaveTextContent("0.40");
    await user.click(screen.getByRole("button", { name: "Normalize row" }));
    expect(screen.getByLabelText(`Row total ${TEST_ID.aRow}`)).toHaveTextContent("1.00");
  });

  it("keeps incomplete CPT edits local and editable until the whole row is valid", () => {
    const onModelChange = jest.fn();
    const initial = testBayesianNetworkModel();
    initial.conditionalProbabilityTables[0]!.rows[0]!.values[0]!.probability = 0.03;
    initial.conditionalProbabilityTables[0]!.rows[0]!.values[1]!.probability = 0.97;
    render(<Harness initialModel={initial} onModelChange={onModelChange} />);

    const firstProbability = screen.getByLabelText("A FALSE probability");
    const secondProbability = screen.getByLabelText("A TRUE probability");
    const row = firstProbability.closest("tr");
    const runExactInference = screen.getByRole("button", { name: "Run exact inference" });

    expect(firstProbability).toHaveAttribute("type", "text");
    expect(firstProbability).toHaveAttribute("inputmode", "decimal");
    fireEvent.change(firstProbability, { target: { value: "0.0" } });

    expect(firstProbability).toHaveValue("0.0");
    expect(firstProbability).toBeEnabled();
    expect(secondProbability).toBeEnabled();
    expect(row).toHaveClass("is-invalid");
    expect(runExactInference).toBeDisabled();
    expect(onModelChange).not.toHaveBeenCalled();

    fireEvent.change(firstProbability, { target: { value: "0.04" } });
    expect(firstProbability).toHaveValue("0.04");
    expect(onModelChange).not.toHaveBeenCalled();

    fireEvent.change(secondProbability, { target: { value: "0.96" } });

    expect(firstProbability).toHaveValue("0.04");
    expect(secondProbability).toHaveValue("0.96");
    expect(row).not.toHaveClass("is-invalid");
    expect(runExactInference).toBeEnabled();
    expect(onModelChange).toHaveBeenLastCalledWith(expect.objectContaining({
      conditionalProbabilityTables: expect.arrayContaining([
        expect.objectContaining({
          nodeId: TEST_ID.a,
          rows: expect.arrayContaining([
            expect.objectContaining({
              id: TEST_ID.aRow,
              values: [
                expect.objectContaining({ stateId: TEST_ID.aFalse, probability: 0.04 }),
                expect.objectContaining({ stateId: TEST_ID.aTrue, probability: 0.96 }),
              ],
            }),
          ]),
        }),
      ]),
    }));
  });

  it("refuses to normalize negative and above-one CPT drafts", async () => {
    const user = userEvent.setup();
    const onModelChange = jest.fn();
    render(<Harness onModelChange={onModelChange} />);

    const probability = screen.getByLabelText("A FALSE probability");
    const row = probability.closest("tr");
    const normalize = screen.getByRole("button", { name: "Normalize row" });

    fireEvent.change(probability, { target: { value: "-0.20" } });
    await user.click(normalize);

    expect(probability).toHaveValue("-0.20");
    expect(row).toHaveClass("is-invalid");
    expect(onModelChange).not.toHaveBeenCalled();
    expect(screen.getByText("Enter probabilities between 0 and 1 before normalizing this row.")).toBeInTheDocument();

    fireEvent.change(probability, { target: { value: "1.20" } });
    await user.click(normalize);

    expect(probability).toHaveValue("1.20");
    expect(row).toHaveClass("is-invalid");
    expect(onModelChange).not.toHaveBeenCalled();
  });

  it("marks only parent-state CPT columns for left alignment", async () => {
    const user = userEvent.setup();
    render(<Harness initialModel={connectNodes(testBayesianNetworkModel(), TEST_ID.a, TEST_ID.b)} />);

    await user.click(screen.getByRole("button", { name: "BN node Effect" }));
    const cpt = screen.getByLabelText("CPT for B");
    const parentHeader = within(cpt).getByRole("columnheader", { name: "A" });
    const probabilityHeader = within(cpt).getByRole("columnheader", { name: "P(TRUE)" });

    expect(parentHeader).toHaveClass("bneditor__cpt-parent");
    expect(within(cpt).getAllByRole("cell")[0]).toHaveClass("bneditor__cpt-parent");
    expect(probabilityHeader).not.toHaveClass("bneditor__cpt-parent");
  });

  it("applies and clears evidence and displays the exact posterior", async () => {
    const user = userEvent.setup();
    const onRun = jest.fn();
    render(<Harness result={analysisResult} onRun={onRun} />);

    await user.click(screen.getByRole("button", { name: "Edit evidence" }));
    await user.selectOptions(screen.getByLabelText("Evidence for A"), TEST_ID.aTrue);
    expect(screen.getByRole("button", { name: "BN node Cause" })).toHaveTextContent("Evidence: TRUE");
    await user.selectOptions(screen.getByLabelText("Evidence for A"), "");
    expect(screen.getByRole("button", { name: "BN node Cause" })).not.toHaveTextContent("Evidence:");
    await user.click(screen.getByRole("button", { name: "Run exact inference" }));

    expect(onRun).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("Posterior distribution")).toHaveTextContent("80.00%");
  });

  it("shows every posterior state without repeating the queried node or collapsing details", () => {
    const severeStateId = "10000000-0000-4000-8000-000000000010";
    const initial = testBayesianNetworkModel();
    initial.nodes[0]!.states = [
      ...initial.nodes[0]!.states,
      { id: severeStateId, code: "SEVERE", name: "Severe" },
    ];
    initial.conditionalProbabilityTables[0]!.rows[0]!.values = [
      { stateId: TEST_ID.aFalse, probability: 0.6 },
      { stateId: TEST_ID.aTrue, probability: 0.3 },
      { stateId: severeStateId, probability: 0.1 },
    ];
    const threeStateResult: BayesianNetworkAnalysisResult = {
      ...analysisResult,
      marginals: [{
        nodeId: TEST_ID.a,
        values: [
          { stateId: TEST_ID.aFalse, probability: 0.6 },
          { stateId: TEST_ID.aTrue, probability: 0.3 },
          { stateId: severeStateId, probability: 0.1 },
        ],
      }],
    };

    render(<Harness initialModel={initial} result={threeStateResult} />);

    const posterior = screen.getByLabelText("Posterior distribution");
    expect(within(posterior).getAllByRole("status")).toHaveLength(3);
    expect(within(posterior).getByText("SEVERE")).toBeInTheDocument();
    expect(within(posterior).getByText("10.00%")).toBeInTheDocument();
    expect(within(posterior).queryByText("A", { selector: "strong" })).not.toBeInTheDocument();
    expect(within(posterior).queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByText(/more details/i)).not.toBeInTheDocument();
  });

  it("creates a typed HCL binding and rejects selecting every BN state", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("tab", { name: "HCL quantification" }));
    await user.click(screen.getByRole("button", { name: "Create HCL configuration" }));
    expect(screen.getByRole("button", { name: "Add binding" })).toHaveClass(
      "posnav__btn",
      "posnav__btn--sm",
      "posnav__btn--primary",
      "hcleditor__add-binding",
    );
    await user.click(screen.getByRole("tab", { name: "Advanced" }));
    expect(screen.getByRole("button", { name: "Delete configuration" })).toHaveClass("hcleditor__aligned-action");
    expect(screen.getByRole("button", { name: "Run HCL quantification" })).toHaveClass(
      "posnav__btn",
      "posnav__btn--sm",
      "posnav__btn--primary",
    );
    await user.click(screen.getByRole("tab", { name: "Bindings" }));
    await user.click(screen.getByRole("checkbox", { name: "FALSE" }));
    await user.click(screen.getByRole("checkbox", { name: "TRUE" }));
    await user.click(screen.getByRole("button", { name: "Add binding" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/cannot contain every state/i);

    await user.click(screen.getByRole("checkbox", { name: "FALSE" }));
    await user.click(screen.getByRole("button", { name: "Add binding" }));
    expect(screen.getByLabelText("HCL bindings")).toHaveTextContent("FT-A / BE-PUMP");
    expect(screen.getByLabelText("HCL bindings")).toHaveTextContent("A = TRUE");
  });

  it("persists evidence into HCL and runs an explicitly included fault tree", async () => {
    const user = userEvent.setup();
    const onConfigurationsChange = jest.fn();
    const onRunHclFaultTree = jest.fn();
    render(
      <Harness
        onConfigurationsChange={onConfigurationsChange}
        onRunHclFaultTree={onRunHclFaultTree}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Edit evidence" }));
    await user.selectOptions(screen.getByLabelText("Evidence for A"), TEST_ID.aTrue);
    await user.click(screen.getByRole("tab", { name: "HCL quantification" }));
    await user.click(screen.getByRole("button", { name: "Create HCL configuration" }));
    expect(onConfigurationsChange.mock.calls.at(-1)?.[0]?.[0]?.baseEvidence).toEqual({
      observations: [{ nodeId: TEST_ID.a, stateId: TEST_ID.aTrue }],
    });

    await user.click(screen.getByRole("tab", { name: "Fault trees" }));
    await user.click(screen.getByRole("button", { name: "Include" }));
    expect(screen.getByLabelText("Included HCL fault trees")).toHaveTextContent("FT-A");
    await user.click(screen.getByRole("button", { name: "Run HCL quantification" }));
    expect(onRunHclFaultTree).toHaveBeenCalledWith(expect.any(Object), faultTreeOptions[0]);
  });

  it("keeps ESQ event-tree orchestration read-only and exposes its automatically linked fault trees", async () => {
    const user = userEvent.setup();
    const onRunEventTree = jest.fn();
    render(
      <HclBindingEditor
        model={testBayesianNetworkModel()}
        editable={false}
        workbookId={FT_WORKBOOK_ID}
        configurations={[syOwnedConfiguration]}
        scope="EVENT_TREE"
        faultTreeOptions={faultTreeOptions}
        eventTreeOptions={[linkedEventTree]}
        baseEvidence={syOwnedConfiguration.baseEvidence}
        validation={[]}
        running={false}
        runError={null}
        runResult={null}
        batchRunResult={null}
        onChange={jest.fn()}
        onRunFaultTree={jest.fn()}
        onRunEventTree={onRunEventTree}
        onRunFaultTreeBatch={jest.fn()}
        onRunEventTreeBatch={jest.fn()}
      />,
    );

    expect(screen.queryByLabelText("HCL target type")).not.toBeInTheDocument();
    expect(screen.getByLabelText("HCL event-tree target")).toHaveValue(`${linkedEventTree.workbookId}:${linkedEventTree.modelId}`);
    expect(screen.getByLabelText("Automatically linked fault trees")).toHaveTextContent("FT-A");
    expect(screen.getByLabelText("Automatically linked fault trees")).toHaveTextContent("FE-PUMP");
    expect(screen.queryByRole("button", { name: "Manage" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("HCL fault-tree target")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Run HCL quantification" }));
    expect(onRunEventTree).toHaveBeenCalledWith(syOwnedConfiguration, linkedEventTree);
  });

  it("blocks HCL quantification while a CPT edit is invalid", () => {
    render(
      <HclBindingEditor
        model={testBayesianNetworkModel()}
        editable={false}
        workbookId={FT_WORKBOOK_ID}
        configurations={[syOwnedConfiguration]}
        faultTreeOptions={faultTreeOptions}
        eventTreeOptions={[]}
        baseEvidence={syOwnedConfiguration.baseEvidence}
        validation={[]}
        quantificationBlocked
        running={false}
        runError={null}
        runResult={null}
        batchRunResult={null}
        onChange={jest.fn()}
        onRunFaultTree={jest.fn()}
        onRunEventTree={jest.fn()}
        onRunFaultTreeBatch={jest.fn()}
        onRunEventTreeBatch={jest.fn()}
      />,
    );

    expect(screen.queryByText(/Needs attention/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run HCL quantification" })).toBeDisabled();
  });

  it("uses the compact Systems Analysis HCL composer without configuration details or a target-kind selector", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("tab", { name: "HCL quantification" }));
    await user.click(screen.getByRole("button", { name: "Create HCL configuration" }));

    const composer = screen.getByLabelText("HCL quantification controls");
    expect(within(composer).getByLabelText("HCL fault-tree target")).toBeInTheDocument();
    expect(within(composer).getByLabelText("HCL evidence mode")).toBeInTheDocument();
    expect(within(composer).getByRole("button", { name: "Edit evidence" })).toBeInTheDocument();
    expect(within(composer).getByRole("button", { name: "Manage" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close HCL manager" })).toBeInTheDocument();
    expect(within(composer).getByRole("button", { name: "Run HCL quantification" })).toBeInTheDocument();
    expect(within(composer).queryByLabelText("HCL target type")).not.toBeInTheDocument();
    expect(screen.queryByText("HCL-1")).not.toBeInTheDocument();
    expect(screen.queryByText(/Ready.*FTs.*bindings.*scenarios/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Close HCL manager" }));
    expect(screen.queryByLabelText("HCL configuration manager")).not.toBeInTheDocument();
    expect(within(composer).getByRole("button", { name: "Manage" })).toBeInTheDocument();

    await user.click(within(composer).getByRole("button", { name: "Manage" }));
    expect(screen.getByLabelText("HCL configuration manager")).toBeInTheDocument();
    expect(within(composer).getByRole("button", { name: "Manage" })).toBeInTheDocument();
  });

  it("keeps the BN canvas visible when ESQ exposes only event-tree HCL analysis", () => {
    render(<Harness editable={false} showQueryAnalysis={false} />);

    expect(screen.getByLabelText("Bayesian-network graph")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "HCL quantification" })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByRole("tab", { name: "BN query" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Run exact inference" })).not.toBeInTheDocument();
  });

  it("builds and runs an enabled evidence-scenario batch", async () => {
    const user = userEvent.setup();
    const onRunHclFaultTreeBatch = jest.fn();
    render(<Harness onRunHclFaultTreeBatch={onRunHclFaultTreeBatch} />);

    await user.click(screen.getByRole("tab", { name: "HCL quantification" }));
    await user.click(screen.getByRole("button", { name: "Create HCL configuration" }));
    await user.click(screen.getByRole("checkbox", { name: "TRUE" }));
    await user.click(screen.getByRole("button", { name: "Add binding" }));
    await user.click(screen.getByRole("tab", { name: "Evidence scenarios" }));
    await user.click(screen.getByRole("button", { name: "Add scenario" }));
    await user.selectOptions(screen.getByLabelText("A evidence for SCN-1"), TEST_ID.aTrue);
    await user.click(screen.getByRole("button", { name: "Add scenario" }));
    await user.selectOptions(screen.getByLabelText("A evidence for SCN-2"), TEST_ID.aTrue);
    expect(screen.getByLabelText("Evidence scenario list")).toHaveTextContent("SCN-1");
    expect(screen.getByLabelText("Evidence scenario list")).toHaveTextContent("SCN-2");

    await user.click(screen.getByRole("tab", { name: "Fault trees" }));
    await user.click(screen.getByRole("button", { name: "Include" }));
    await user.selectOptions(screen.getByLabelText("HCL evidence mode"), "SCENARIOS");
    expect(screen.getByLabelText("HCL evidence mode")).toHaveDisplayValue("Enabled scenarios (2)");
    expect(screen.queryByLabelText("HCL batch target scope")).not.toBeInTheDocument();
    expect(screen.getByLabelText("HCL fault-tree target")).toHaveTextContent("No affected fault tree");
    expect(screen.getByRole("button", { name: "Run scenario batch" })).toBeDisabled();

    await user.click(screen.getByRole("tab", { name: "Evidence scenarios" }));
    await user.click(screen.getByRole("button", { name: /SCN-2 Evidence scenario 2/i }));
    await user.selectOptions(screen.getByLabelText("A evidence for SCN-2"), TEST_ID.aFalse);
    expect(screen.getByLabelText("HCL fault-tree target")).toHaveTextContent("FT-A");
    await user.click(screen.getByRole("button", { name: "Run scenario batch" }));

    expect(onRunHclFaultTreeBatch).toHaveBeenCalledWith(
      expect.objectContaining({
        evidenceScenarios: expect.arrayContaining([
          expect.objectContaining({ code: "SCN-1" }),
          expect.objectContaining({ code: "SCN-2" }),
        ]),
      }),
      faultTreeOptions[0],
      [expect.any(String), expect.any(String)],
      false,
    );

    onRunHclFaultTreeBatch.mockClear();
    await user.click(screen.getByRole("tab", { name: "Evidence scenarios" }));
    await user.click(screen.getByRole("button", { name: "Enable" }));
    await user.selectOptions(screen.getByLabelText("HCL evidence mode"), "HAZARD_GRID");
    await user.click(screen.getByRole("button", { name: "Run hazard convolution" }));
    expect(onRunHclFaultTreeBatch).toHaveBeenCalledWith(
      expect.objectContaining({
        hazardGrid: expect.objectContaining({
          hazardNodeIds: [TEST_ID.a],
          normalizeWeights: false,
        }),
      }),
      faultTreeOptions[0],
      [expect.any(String), expect.any(String)],
      true,
    );
  });

  it("shows the missing hazard-grid setup beside the enable control", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("tab", { name: "HCL quantification" }));
    await user.click(screen.getByRole("button", { name: "Create HCL configuration" }));
    await user.click(screen.getByRole("tab", { name: "Evidence scenarios" }));
    await user.click(screen.getByRole("button", { name: "Add scenario" }));

    const hazardSettings = screen.getByRole("region", { name: "Hazard convolution settings" });
    expect(within(hazardSettings).getByRole("status")).toHaveTextContent(
      /Choose BN states for every enabled scenario so each scenario has a complete, unique combination/i,
    );
    expect(within(hazardSettings).getByRole("button", { name: "Enable" })).toBeDisabled();
    expect(within(hazardSettings).queryByRole("alert")).not.toBeInTheDocument();
    expect(within(hazardSettings).queryByText("Annual scale")).not.toBeInTheDocument();
  });

  it("preserves scenario edits by disabling an invalidated hazard grid", async () => {
    const user = userEvent.setup();
    const onConfigurationsChange = jest.fn();
    render(<Harness onConfigurationsChange={onConfigurationsChange} />);

    await user.click(screen.getByRole("tab", { name: "HCL quantification" }));
    await user.click(screen.getByRole("button", { name: "Create HCL configuration" }));
    await user.click(screen.getByRole("tab", { name: "Evidence scenarios" }));
    await user.click(screen.getByRole("button", { name: "Add scenario" }));
    await user.selectOptions(screen.getByLabelText("A evidence for SCN-1"), TEST_ID.aTrue);

    const hazardSettings = screen.getByRole("region", { name: "Hazard convolution settings" });
    await user.click(within(hazardSettings).getByRole("button", { name: "Enable" }));
    expect(within(hazardSettings).getByLabelText("Hours/year")).toHaveValue(8_760);

    await user.selectOptions(screen.getByLabelText("A evidence for SCN-1"), "");

    const updatedConfiguration = onConfigurationsChange.mock.calls.at(-1)?.[0]?.[0];
    expect(updatedConfiguration?.hazardGrid).toBeUndefined();
    expect(updatedConfiguration?.evidenceScenarios?.[0]?.evidence.observations).toEqual([]);
    expect(screen.getByText(/Scenario updated\. Hazard convolution was turned off/i)).toBeInTheDocument();
  });

  it("selects every dimension needed to make hazard-grid cells unique", async () => {
    const user = userEvent.setup();
    const onConfigurationsChange = jest.fn();
    render(<Harness onConfigurationsChange={onConfigurationsChange} />);

    await user.click(screen.getByRole("tab", { name: "HCL quantification" }));
    await user.click(screen.getByRole("button", { name: "Create HCL configuration" }));
    await user.click(screen.getByRole("tab", { name: "Evidence scenarios" }));
    const combinations = [
      [TEST_ID.aFalse, TEST_ID.bFalse],
      [TEST_ID.aFalse, TEST_ID.bTrue],
      [TEST_ID.aTrue, TEST_ID.bFalse],
      [TEST_ID.aTrue, TEST_ID.bTrue],
    ] as const;
    for (const [index, [aStateId, bStateId]] of combinations.entries()) {
      await user.click(screen.getByRole("button", { name: "Add scenario" }));
      const scenarioNumber = index + 1;
      await user.selectOptions(screen.getByLabelText(`A evidence for SCN-${String(scenarioNumber)}`), aStateId);
      await user.selectOptions(screen.getByLabelText(`B evidence for SCN-${String(scenarioNumber)}`), bStateId);
    }

    const hazardSettings = screen.getByRole("region", { name: "Hazard convolution settings" });
    expect(within(hazardSettings).getByRole("button", { name: "Enable" })).toBeEnabled();
    await user.click(within(hazardSettings).getByRole("button", { name: "Enable" }));

    expect(within(hazardSettings).getByRole("checkbox", { name: "A" })).toBeChecked();
    expect(within(hazardSettings).getByRole("checkbox", { name: "B" })).toBeChecked();
    expect(onConfigurationsChange.mock.calls.at(-1)?.[0]?.[0]?.hazardGrid?.hazardNodeIds).toEqual([
      TEST_ID.a,
      TEST_ID.b,
    ]);
  });

  it("labels completed batches whose numerical result does not vary", async () => {
    const user = userEvent.setup();
    render(<Harness hclRunResult={commonHclResult} hclBatchRunResult={unchangedBatchResult} />);

    await user.click(screen.getByRole("tab", { name: "HCL quantification" }));
    await user.click(screen.getByRole("button", { name: "Create HCL configuration" }));

    const commonResult = screen.getByLabelText("HCL fault-tree result");
    expect(commonResult).toHaveTextContent("Top event probability");
    expect(commonResult).toHaveTextContent("2.50E-01");
    expect(commonResult.querySelectorAll(".hcleditor__result-metric")).toHaveLength(1);

    const scenarioResult = screen.getByLabelText("HCL scenario batch result");
    expect(scenarioResult).toHaveTextContent("No variation across scenarios");
    expect(scenarioResult.querySelectorAll(".hcleditor__batch-table .hcleditor__result-metric"))
      .toHaveLength(2);
  });

  it("presents hazard convolution as summary and weighted contribution metrics", async () => {
    const user = userEvent.setup();
    render(<Harness hclBatchRunResult={hazardBatchResult} />);

    await user.click(screen.getByRole("tab", { name: "HCL quantification" }));
    await user.click(screen.getByRole("button", { name: "Create HCL configuration" }));

    const result = screen.getByLabelText("HCL scenario batch result");
    expect(within(result).getByLabelText("Hazard convolution summary")).toHaveTextContent("99.44%");
    expect(result).toHaveTextContent("1.89E-01/yr");
    expect(result).toHaveTextContent("75.42% weight");
    expect(result).not.toHaveTextContent("w=");
  });

  it("keeps mutation controls unavailable in read-only mode", () => {
    render(<Harness editable={false} />);

    expect(screen.getByRole("button", { name: "Add node" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Add state" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create HCL configuration" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "BN node Effect" }));
    expect(screen.getByLabelText("Bayesian-network node inspector")).toHaveTextContent("B");
  });
});
