import sourceReference from "./fixtures/hclMhSource.json";
import { toCanonicalBayesianNetwork } from "../bayesianNetworkCanonical";
import { createBayesianNetworkModuleFromBranch, instantiateBayesianNetworkModule } from "../bayesianNetworkModules";
import { exportBayesianNetworkJson, importBayesianNetworkJson, importBayesianNetworkXdsl, readBayesianNetworkSubmodels, saveBayesianNetworkSubmodel } from "../bayesianNetworkInterchange";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState, type JSX } from "react";
import type { EsqHclConfiguration } from "interfaces-mef-types/esq/workbook-models";
import type { BayesianNetworkEvidenceConfiguration, WorkbookHclConfiguration } from "interfaces-mef-types/modeling";
import { WorkbookHclUncertaintyConfigurationSchema } from "interfaces-mef-types/zod/modeling";
import {
  validateBayesianNetworkModel,
  type BayesianNetworkAnalysisResult,
  type BayesianNetworkModel,
} from "interfaces-shared-types/newly-developed-methods/bayesian-network";
import { BayesianNetworkEditor } from "../bayesianNetworkEditor";
import { connectNodes } from "../bayesianNetworkOperations";
import type {
  BayesianNetworkFaultTreeOption,
  BayesianNetworkQueryBatchResult,
} from "../bayesianNetworkTypes";
import { ToastContainer } from "../../../toast/toastContainer";
import { ToastProvider } from "../../../toast/toastProvider";
import { TEST_ID, testBayesianNetworkModel } from "./bayesianNetworkTestModel";

const WORKBOOK_ID = "esq-workbook";
const FT_WORKBOOK_ID = "sy-workbook";
const FT_MODEL_ID = "20000000-0000-4000-8000-000000000001";
const BASIC_EVENT_ID = "20000000-0000-4000-8000-000000000002";
const TOP_GATE_ID = "20000000-0000-4000-8000-000000000003";

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
  basicEvents: [{
    id: BASIC_EVENT_ID,
    code: "BE-PUMP",
    name: "Pump failure",
  }],
}];

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

function Harness({
  initialModel = testBayesianNetworkModel(),
  saveBlockedReason = null,
  saving = false,
  onAnalysisInputChange,
  editable = true,
  result = null,
  onRun = jest.fn(),
  onConfigurationsChange = jest.fn(),
  onModelChange = jest.fn(),
  queryBatchResult = null,
  onRunBatch = jest.fn(),
  initialConfigurations = [],
  onModelImport = jest.fn(),
}: {
  initialModel?: BayesianNetworkModel;
  saveBlockedReason?: string | null;
  saving?: boolean;
  onAnalysisInputChange?: () => void;
  editable?: boolean;
  result?: BayesianNetworkAnalysisResult | null;
  onRun?: () => void;
  onConfigurationsChange?: (configurations: EsqHclConfiguration[]) => void;
  onModelChange?: (model: BayesianNetworkModel) => void;
  queryBatchResult?: BayesianNetworkQueryBatchResult | null;
  onRunBatch?: jest.Mock;
  initialConfigurations?: EsqHclConfiguration[];
  onModelImport?: (model: BayesianNetworkModel) => void;
}): JSX.Element {
  const [model, setModel] = useState(initialModel);
  const [evidence, setEvidence] = useState<BayesianNetworkEvidenceConfiguration>({ observations: [] });
  const [queryNodeId, setQueryNodeId] = useState<string | null>(model.nodes[0]?.id ?? null);
  const [configurations, setConfigurations] = useState<EsqHclConfiguration[]>(initialConfigurations);
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
        saveBlockedReason={saveBlockedReason}
        saving={saving}
        onAnalysisInputChange={onAnalysisInputChange}
        editable={editable}
        evidence={evidence}
        queryNodeId={queryNodeId}
        validation={validation}
        analysisResult={result}
        queryBatchResult={queryBatchResult}
        running={false}
        runError={null}
        workbookId={WORKBOOK_ID}
        hclConfigurations={configurations}
        faultTreeOptions={faultTreeOptions}
        onModelChange={replaceModel}
        onModelImport={onModelImport}
        onEvidenceChange={setEvidence}
        onQueryNodeChange={setQueryNodeId}
        onHclConfigurationsChange={replaceConfigurations}
        onRunBatch={onRunBatch}
        onRun={onRun}
      />
      <ToastContainer />
    </ToastProvider>
  );
}

describe("BayesianNetworkEditor", () => {
  afterEach(() => jest.restoreAllMocks());

  it("renders the canonical graph, CPT, and exact-query controls", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("radio", { name: "Manual" }));

    expect(screen.getByLabelText("Bayesian-network graph")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /BN node/i })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: /Connection handle/i })).toHaveLength(8);
    expect(screen.getAllByLabelText(/State code/)).toHaveLength(2);
    expect(screen.queryByLabelText(/State name/)).not.toBeInTheDocument();
    expect(screen.getByLabelText("CPT for A")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run exact inference" })).toBeEnabled();
    expect(screen.queryByText(/backend selector/i)).not.toBeInTheDocument();
  });

  it("keeps evidence, the dependency configuration and the network query behind compact progressive controls", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const workflow = screen.getByRole("radiogroup", { name: "Network query workflow" });
    expect(screen.getAllByRole("radio")).toEqual(within(workflow).getAllByRole("radio"));
    expect(within(workflow).getAllByRole("radio").map((radio) => radio.closest("label")?.textContent)).toEqual(["Manual", "Batch"]);
    expect(screen.getByRole("radio", { name: "Manual" })).not.toBeChecked();
    expect(screen.getByRole("radio", { name: "Batch" })).not.toBeChecked();
    expect(screen.queryByRole("region", { name: "Network query" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Bayesian-network query node")).not.toBeInTheDocument();

    expect(screen.queryByText("No evidence")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Evidence for A")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create dependency configuration" })).toBeInTheDocument();
    const evidenceAction = screen.getByRole("button", { name: "Edit evidence" });
    expect(evidenceAction).toHaveTextContent("Evidence");
    expect(evidenceAction.closest(".bneditor__evidence-anchor")).not.toBeNull();
    expect(evidenceAction).toHaveClass("posnav__btn", "posnav__btn--sm");
    expect(evidenceAction).toHaveAttribute("aria-expanded", "false");

    await user.click(screen.getByRole("button", { name: "Edit evidence" }));
    const evidenceEditor = screen.getByLabelText("Evidence editor");
    expect(evidenceEditor).toBeInTheDocument();
    expect(evidenceEditor.closest(".bneditor__evidence-anchor")).not.toBeNull();
    expect(evidenceAction).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByLabelText("Evidence for A")).toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: "Manual" }));
    const query = within(screen.getByRole("region", { name: "Network query" }));
    expect(query.getByLabelText("Bayesian-network query node")).toBeInTheDocument();
    expect(query.getByRole("button", { name: "Run exact inference" })).toHaveTextContent("Run inference");
    await user.click(screen.getByRole("radio", { name: "Batch" }));
    expect(query.getByRole("button", { name: "Run batch" })).toBeInTheDocument();
    expect(query.queryByRole("button", { name: "Run exact inference" })).not.toBeInTheDocument();
  });

  it("closes the evidence editor on a click outside it and on Escape", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const evidenceAction = screen.getByRole("button", { name: "Edit evidence" });

    await user.click(evidenceAction);
    await user.click(screen.getByLabelText("Search evidence nodes"));
    expect(screen.getByLabelText("Evidence editor")).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "Manual" }));
    expect(screen.queryByLabelText("Evidence editor")).not.toBeInTheDocument();
    expect(evidenceAction).toHaveAttribute("aria-expanded", "false");

    await user.click(evidenceAction);
    expect(screen.getByLabelText("Evidence editor")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByLabelText("Evidence editor")).not.toBeInTheDocument();
  });

  it("imports JSON or CSV evidence rows for BN batch inference", async () => {
    const user = userEvent.setup();
    const onRunBatch = jest.fn();
    const { container } = render(<Harness onRunBatch={onRunBatch} />);

    await user.click(screen.getByRole("radio", { name: "Batch" }));
    const batchActions = screen.getByRole("region", { name: "Network query" }).querySelector(".bneditor__batch-intake");
    expect(batchActions).not.toBeNull();
    expect(within(batchActions as HTMLElement).getAllByRole("button")).toHaveLength(3);
    expect(within(batchActions as HTMLElement).getByRole("button", { name: "Upload JSON/CSV" })).toBeInTheDocument();
    const sampleButton = within(batchActions as HTMLElement).getByRole("button", { name: "Download samples" });
    expect(sampleButton).toContainHTML("<svg");
    expect(screen.queryByText("JSON or CSV")).not.toBeInTheDocument();

    await user.click(sampleButton);
    const sampleDetails = sampleButton.closest("details");
    expect(sampleDetails).toHaveAttribute("open");
    const sampleMenu = screen.getByRole("menu", { name: "BN query batch samples" });
    expect(within(sampleMenu).getByRole("menuitem", { name: "Sample JSON" })).toBeInTheDocument();
    expect(within(sampleMenu).getByRole("menuitem", { name: "Sample CSV" })).toBeInTheDocument();
    await user.click(screen.getByText("Query node"));
    expect(sampleDetails).not.toHaveAttribute("open");

    const input = container.querySelector<HTMLInputElement>('input[type="file"][accept*=".csv"]');
    expect(input).not.toBeNull();
    expect(input).toHaveAttribute("accept", expect.stringContaining(".json"));
    expect(input).toHaveAttribute("accept", expect.stringContaining(".csv"));
    const source = JSON.stringify({
      schemaVersion: "1.0.0",
      scenarios: [{ code: "SCN-1", name: "Scenario 1", enabled: true, evidence: { A: "TRUE" } }],
    });
    const file = new File([source], "evidence.json", { type: "application/json" });
    Object.defineProperty(file, "text", { value: async () => source });
    fireEvent.change(input!, { target: { files: [file] } });

    expect(await screen.findByText("1", { selector: ".bneditor__batch-upload b" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Run batch" }));
    expect(onRunBatch).toHaveBeenCalledWith([
      expect.objectContaining({
        code: "SCN-1",
        evidence: { observations: [{ nodeId: TEST_ID.a, stateId: TEST_ID.aTrue }] },
      }),
    ]);
  });

  it("presents each BN query batch posterior in a collapsible scenario row", async () => {
    const user = userEvent.setup();
    const queryBatchResult: BayesianNetworkQueryBatchResult = {
      queryNodeId: TEST_ID.a,
      scenarios: [{
        scenarioId: "30000000-0000-4000-8000-000000000099",
        scenarioCode: "BNQ-BASE",
        scenarioName: "No seismic, flood, or fire hazard",
        status: "SUCCEEDED",
        failure: null,
        result: analysisResult,
      }],
    };
    render(<Harness queryBatchResult={queryBatchResult} />);

    await user.click(screen.getByRole("radio", { name: "Batch" }));
    const scenario = screen.getByText("BNQ-BASE").closest("details");
    expect(scenario).not.toHaveAttribute("open");
    expect(scenario).toHaveTextContent("Complete");
    await user.click(screen.getByText("BNQ-BASE"));
    expect(within(scenario!).getByText("0.8")).toBeInTheDocument();
    expect(within(scenario!).getByText("0.2")).toBeInTheDocument();
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
    await user.type(code, "B");

    expect(code).toHaveValue("B");
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
    await user.click(screen.getByRole("button", { name: "Reusable templates" }));
    expect(screen.queryByText("Reusable templates", { selector: "strong" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Save a branch once/i)).not.toBeInTheDocument();
    expect(screen.getByText("Select the branch root and save it as a template")).toBeInTheDocument();
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
    expect(inputList).toHaveTextContent("A — Cause");
    expect(within(savedModules).getByRole("combobox", { name: "Input A for MOD-B" })).toHaveValue(TEST_ID.a);
    expect(screen.queryByText(/Instance code|Instance name|Add instance/i)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Create instance" }));

    expect(screen.getAllByRole("button", { name: /BN node/i })).toHaveLength(3);
    expect(screen.getByText("Template instance")).toBeInTheDocument();
  });

  it("closes the reusable-module viewport when clicking outside it", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const trigger = screen.getByRole("button", { name: "Reusable templates" });
    const menu = trigger.closest("details");
    await user.click(trigger);
    expect(menu).toHaveAttribute("open");

    await user.click(screen.getByLabelText("Bayesian-network graph"));

    expect(menu).not.toHaveAttribute("open");
  });

  it("uses the shared icon treatment for history, file, and canvas tools", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("radio", { name: "Manual" }));

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

    const configurationAction = screen.getByRole("button", { name: "Create dependency configuration" });
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

  it("keeps XDSL import and the other file actions in the File menu", async () => {
    const user = userEvent.setup();
    const inputClick = jest.spyOn(HTMLInputElement.prototype, "click").mockImplementation();
    render(<Harness />);

    const fileButton = screen.getByRole("button", { name: "File" });
    const details = fileButton.closest("details");
    expect(screen.queryByRole("button", { name: "Import XDSL", exact: true })).not.toBeInTheDocument();
    expect(details).not.toHaveAttribute("open");
    await user.click(fileButton);
    expect(details).toHaveAttribute("open");
    const menu = screen.getByRole("menu", { name: "Bayesian-network file actions" });
    expect(within(menu).getAllByRole("menuitem").map((item) => item.textContent)).toEqual([
      "Import XDSL",
      "Import JSON",
      "Export XDSL",
      "Export OpenPRA JSON",
      "Export canonical JSON",
    ]);

    await user.click(within(menu).getByRole("menuitem", { name: "Import JSON" }));
    expect(inputClick).toHaveBeenCalledTimes(1);
    expect(details).not.toHaveAttribute("open");
    await user.click(fileButton);
    await user.click(within(menu).getByRole("menuitem", { name: "Import XDSL" }));
    expect(inputClick).toHaveBeenCalledTimes(2);
    expect(details).not.toHaveAttribute("open");
  });

  it("closes the File menu on a click outside it and on Escape", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const fileButton = screen.getByRole("button", { name: "File" });
    const details = fileButton.closest("details");

    await user.click(fileButton);
    expect(details).toHaveAttribute("open");
    await user.click(screen.getByRole("menu", { name: "Bayesian-network file actions" }));
    expect(details).toHaveAttribute("open");
    await user.click(screen.getByRole("radio", { name: "Manual" }));
    expect(details).not.toHaveAttribute("open");

    await user.click(fileButton);
    expect(details).toHaveAttribute("open");
    await user.keyboard("{Escape}");
    expect(details).not.toHaveAttribute("open");
  });

  it("lists a repeated validation message once with its count", () => {
    const initial = connectNodes(testBayesianNetworkModel(), TEST_ID.a, TEST_ID.b);
    initial.conditionalProbabilityTables.forEach((table) => table.rows.forEach((row) => row.values.forEach((value) => { value.probability = 0.2; })));
    render(<Harness initialModel={initial} />);

    const validation = screen.getByLabelText("Bayesian-network validation");
    expect(within(validation).getByRole("heading", { name: "Validation · 1 issue" })).toBeInTheDocument();
    expect(within(validation).getAllByRole("button")).toHaveLength(1);
    expect(within(validation).getByRole("button")).toHaveTextContent("ERROR Each CPT row must sum to one · 3 times");
  });

  it("shows dependency binding issues in the validation box and not in the configuration", () => {
    const missingNodeId = "40000000-0000-4000-8000-000000000001";
    const bindingTo = (id: string, basicEventId: string): EsqHclConfiguration["bindings"][number] => ({
      id,
      faultTreeBasicEvent: { referenceType: "FAULT_TREE_BASIC_EVENT", workbookId: FT_WORKBOOK_ID, entityId: basicEventId },
      bayesianNetworkNode: { referenceType: "BAYESIAN_NETWORK_NODE", workbookId: WORKBOOK_ID, modelId: TEST_ID.model, entityId: missingNodeId },
      trueStateIds: [TEST_ID.aTrue],
    });
    const configuration: EsqHclConfiguration = {
      modelId: "40000000-0000-4000-8000-000000000002",
      code: "DEP-1",
      name: "Bindings",
      description: "",
      bayesianNetwork: { workbookId: WORKBOOK_ID, modelId: TEST_ID.model },
      faultTrees: [{ workbookId: FT_WORKBOOK_ID, modelId: FT_MODEL_ID }],
      bindings: [
        bindingTo("40000000-0000-4000-8000-000000000003", BASIC_EVENT_ID),
        bindingTo("40000000-0000-4000-8000-000000000004", "40000000-0000-4000-8000-000000000005"),
      ],
      baseEvidence: { observations: [] },
      evidenceScenarios: [],
      solverSettings: { variableOrder: null, foldConstants: true, spliceNullGates: true },
    };
    render(<Harness initialConfigurations={[configuration]} />);

    const validation = screen.getByLabelText("Bayesian-network validation");
    expect(within(validation).getByRole("heading", { name: "Validation · 1 issue" })).toBeInTheDocument();
    expect(within(validation).getByRole("button")).toHaveTextContent("ERROR The dependency binding node reference does not resolve to a node · 2 times");
    expect(within(screen.getByLabelText("Dependency configuration")).queryByText((text) => text.includes("does not resolve"))).not.toBeInTheDocument();
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
    expect(within(cpt).getByLabelText("A STATE-3 probability")).toHaveDisplayValue("0.33333333");
  });

  it("shows a CPT value with at most eight digits and keeps the stored number", () => {
    const onModelChange = jest.fn();
    const initial = testBayesianNetworkModel();
    initial.conditionalProbabilityTables[0]!.rows[0]!.values[0]!.probability = 0.037566666666666665;
    initial.conditionalProbabilityTables[0]!.rows[0]!.values[1]!.probability = 0.9624333333333334;
    render(<Harness initialModel={initial} onModelChange={onModelChange} />);

    expect(screen.getByLabelText("A FALSE probability")).toHaveValue("0.03756667");
    expect(screen.getByLabelText("A TRUE probability")).toHaveValue("0.96243333");
    expect(screen.getByLabelText(`Row total ${TEST_ID.aRow}`)).toHaveTextContent("1.00");
    expect(screen.getByLabelText("A FALSE probability").closest("tr")).not.toHaveClass("is-invalid");
    expect(onModelChange).not.toHaveBeenCalled();
  });

  it("keeps a CPT value below the eighth decimal place readable", () => {
    const initial = testBayesianNetworkModel();
    initial.conditionalProbabilityTables[0]!.rows[0]!.values[0]!.probability = 1.23456789012e-9;
    initial.conditionalProbabilityTables[0]!.rows[0]!.values[1]!.probability = 1 - 1.23456789012e-9;
    render(<Harness initialModel={initial} />);

    expect(screen.getByLabelText("A FALSE probability")).toHaveValue("1.2345679e-9");
    expect(screen.getByLabelText("A TRUE probability")).toHaveValue("1");
    expect(screen.getByLabelText("A FALSE probability").closest("tr")).not.toHaveClass("is-invalid");
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
    expect(within(cpt).getByLabelText("A FALSE probability")).toHaveDisplayValue("0.2");
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
    fireEvent.click(screen.getByRole("radio", { name: "Manual" }));

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

  it("marks only the row action column of the CPT for centering", async () => {
    const user = userEvent.setup();
    render(<Harness initialModel={connectNodes(testBayesianNetworkModel(), TEST_ID.a, TEST_ID.b)} />);

    await user.click(screen.getByRole("button", { name: "BN node Effect" }));
    const cpt = screen.getByLabelText("CPT for B");
    const actionHeader = within(cpt).getByRole("columnheader", { name: "Row actions" });
    const firstRowCells = within(within(cpt).getAllByRole("row")[1]!).getAllByRole("cell");

    expect(actionHeader).toHaveClass("bneditor__cpt-actions");
    expect(within(cpt).getByRole("columnheader", { name: "A" })).not.toHaveClass("bneditor__cpt-actions");
    expect(within(cpt).getByRole("columnheader", { name: "P(TRUE)" })).not.toHaveClass("bneditor__cpt-actions");
    expect(within(cpt).getByRole("columnheader", { name: "Total" })).not.toHaveClass("bneditor__cpt-actions");
    expect(firstRowCells.map((cell) => cell.classList.contains("bneditor__cpt-actions"))).toEqual([false, false, false, false, true]);
  });

  it("applies and clears evidence and displays the exact posterior", async () => {
    const user = userEvent.setup();
    const onRun = jest.fn();
    render(<Harness result={analysisResult} onRun={onRun} />);
    await user.click(screen.getByRole("radio", { name: "Manual" }));

    await user.click(screen.getByRole("button", { name: "Edit evidence" }));
    await user.selectOptions(screen.getByLabelText("Evidence for A"), TEST_ID.aTrue);
    expect(screen.getByRole("button", { name: "BN node Cause" })).toHaveTextContent("Evidence: TRUE");
    await user.selectOptions(screen.getByLabelText("Evidence for A"), "");
    expect(screen.getByRole("button", { name: "BN node Cause" })).not.toHaveTextContent("Evidence:");
    await user.click(screen.getByRole("button", { name: "Run exact inference" }));

    expect(onRun).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("Posterior distribution")).toHaveTextContent("0.8");
  });

  it("shows posterior node/state identities and an export control", () => {
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
    fireEvent.click(screen.getByRole("radio", { name: "Manual" }));

    const posterior = screen.getByLabelText("Posterior distribution");
    expect(within(posterior).getAllByRole("status")).toHaveLength(3);
    expect(within(posterior).getByText("A / SEVERE")).toBeInTheDocument();
    expect(within(posterior).getByText("0.1")).toBeInTheDocument();
    expect(within(posterior).queryByText("A", { selector: "strong" })).not.toBeInTheDocument();
    expect(within(posterior).getByRole("button", { name: "Export results CSV" })).toBeInTheDocument();
    expect(screen.queryByText(/more details/i)).not.toBeInTheDocument();
  });

  it("creates a typed dependency binding and rejects selecting every network state", async () => {
    const user = userEvent.setup();
    const onConfigurationsChange = jest.fn();
    render(<Harness onConfigurationsChange={onConfigurationsChange} />);

    await user.click(screen.getByRole("button", { name: "Create dependency configuration" }));
    expect(screen.getByRole("button", { name: "Add binding" })).toHaveClass(
      "posnav__btn",
      "posnav__btn--sm",
      "posnav__btn--primary",
      "hcleditor__add-binding",
    );
    await user.click(screen.getByRole("button", { name: "Advanced" }));
    expect(screen.getByRole("button", { name: "Delete configuration" })).toHaveClass("hcleditor__aligned-action");
    await user.click(screen.getByText("Bindings", { selector: "summary" }));
    await user.click(screen.getByRole("checkbox", { name: "FALSE" }));
    await user.click(screen.getByRole("checkbox", { name: "TRUE" }));
    await user.click(screen.getByRole("button", { name: "Add binding" }));
    expect(screen.getByRole("alert")).toHaveTextContent("The true-state selection cannot contain every state of the node.");

    await user.click(screen.getByRole("checkbox", { name: "FALSE" }));
    await user.click(screen.getByRole("button", { name: "Add binding" }));
    expect(screen.getByLabelText("Dependency bindings")).toHaveTextContent("FT-A / BE-PUMP");
    expect(screen.getByLabelText("Dependency bindings")).toHaveTextContent("A = TRUE");
    const saved: WorkbookHclConfiguration = onConfigurationsChange.mock.calls.at(-1)?.[0]?.[0];
    expect(saved.faultTrees).toEqual([{ workbookId: FT_WORKBOOK_ID, modelId: FT_MODEL_ID }]);
    expect(saved.bindings).toEqual([{
      id: expect.any(String),
      faultTreeBasicEvent: { referenceType: "FAULT_TREE_BASIC_EVENT", workbookId: FT_WORKBOOK_ID, entityId: BASIC_EVENT_ID },
      bayesianNetworkNode: { referenceType: "BAYESIAN_NETWORK_NODE", workbookId: WORKBOOK_ID, modelId: TEST_ID.model, entityId: TEST_ID.a },
      trueStateIds: [TEST_ID.aTrue],
    }]);
    await user.click(screen.getByRole("checkbox", { name: "TRUE" }));
    await user.click(screen.getByRole("button", { name: "Add binding" }));
    expect(screen.getByRole("alert")).toHaveTextContent("That basic event already has a binding.");
    await user.click(screen.getByRole("button", { name: "Delete binding BE-PUMP" }));
    expect(onConfigurationsChange.mock.calls.at(-1)?.[0]?.[0]?.bindings).toEqual([]);
  });

  it("persists evidence into a new dependency configuration and includes a fault tree explicitly", async () => {
    const user = userEvent.setup();
    const onConfigurationsChange = jest.fn();
    render(<Harness onConfigurationsChange={onConfigurationsChange} />);

    await user.click(screen.getByRole("button", { name: "Edit evidence" }));
    await user.selectOptions(screen.getByLabelText("Evidence for A"), TEST_ID.aTrue);
    await user.click(screen.getByRole("button", { name: "Create dependency configuration" }));
    expect(onConfigurationsChange.mock.calls.at(-1)?.[0]).toEqual([{
      modelId: expect.any(String),
      code: "DEP-1",
      name: "Test network bindings",
      description: "Fault tree events bound to network states.",
      bayesianNetwork: { workbookId: WORKBOOK_ID, modelId: TEST_ID.model },
      faultTrees: [],
      bindings: [],
      baseEvidence: { observations: [{ nodeId: TEST_ID.a, stateId: TEST_ID.aTrue }] },
      evidenceScenarios: [],
      solverSettings: { variableOrder: null, foldConstants: true, spliceNullGates: true },
    }]);

    await user.click(screen.getByText("Fault trees", { selector: "summary" }));
    expect(screen.getByLabelText("Included fault trees")).toHaveTextContent("0 trees");
    await user.click(screen.getByRole("button", { name: "Include" }));
    expect(screen.getByLabelText("Included fault trees")).toHaveTextContent("FT-A");
    expect(onConfigurationsChange.mock.calls.at(-1)?.[0]?.[0]?.faultTrees).toEqual([{ workbookId: FT_WORKBOOK_ID, modelId: FT_MODEL_ID }]);
    await user.click(screen.getByRole("button", { name: "Include" }));
    expect(screen.getByRole("alert")).toHaveTextContent("That fault tree is already included.");
  });

  it("keeps the dependency configuration behind Configuration and Advanced toggles", async () => {
    const user = userEvent.setup();
    const onConfigurationsChange = jest.fn();
    render(<Harness onConfigurationsChange={onConfigurationsChange} />);

    await user.click(screen.getByRole("button", { name: "Create dependency configuration" }));

    const composer = screen.getByLabelText("Dependency configuration controls");
    expect(within(composer).getAllByRole("button").map((button) => button.textContent)).toEqual(["Evidence", "Configuration", "Advanced"]);
    expect(screen.queryByRole("button", { name: "Create dependency configuration" })).not.toBeInTheDocument();
    expect(screen.queryByText("DEP-1")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Edit evidence" }).closest(".bneditor__evidence-anchor")).not.toBeNull();

    await user.click(screen.getByRole("button", { name: "Close configuration" }));
    expect(screen.queryByLabelText("Dependency configuration manager")).not.toBeInTheDocument();
    expect(within(composer).getByRole("button", { name: "Configuration" })).toHaveAttribute("aria-expanded", "false");

    await user.click(within(composer).getByRole("button", { name: "Configuration" }));
    const manager = within(screen.getByLabelText("Dependency configuration manager"));
    expect(manager.getByText("Fault trees", { selector: "summary" })).toBeInTheDocument();
    expect(manager.getByText("Bindings", { selector: "summary" })).toBeInTheDocument();
    expect(manager.getByText("Uncertainty", { selector: "summary" })).toHaveTextContent("Uncertainty Off");
    expect(manager.queryByText("Evidence scenarios", { selector: "summary" })).not.toBeInTheDocument();

    expect(screen.queryByLabelText("Advanced settings")).not.toBeInTheDocument();
    await user.click(within(composer).getByRole("button", { name: "Advanced" }));
    const advanced = within(screen.getByLabelText("Advanced settings"));
    expect(advanced.getByRole("textbox", { name: "Code" })).toHaveValue("DEP-1");
    expect(advanced.getByRole("textbox", { name: "Name" })).toHaveValue("Test network bindings");
    await user.click(advanced.getByRole("checkbox", { name: "Fold constants" }));
    await user.click(advanced.getByRole("checkbox", { name: "Splice null gates" }));
    fireEvent.change(advanced.getByRole("textbox", { name: "Code" }), { target: { value: "DEP-SEISMIC" } });
    fireEvent.change(advanced.getByRole("textbox", { name: "Name" }), { target: { value: "Seismic bindings" } });
    expect(onConfigurationsChange.mock.calls.at(-1)?.[0]?.[0]).toMatchObject({
      code: "DEP-SEISMIC",
      name: "Seismic bindings",
      solverSettings: { variableOrder: null, foldConstants: false, spliceNullGates: false },
    });
    await user.click(advanced.getByRole("button", { name: "Close advanced settings" }));
    expect(screen.queryByLabelText("Advanced settings")).not.toBeInTheDocument();
  });

  it("deletes the dependency configuration after the confirmation", async () => {
    const user = userEvent.setup();
    const onConfigurationsChange = jest.fn();
    render(<Harness onConfigurationsChange={onConfigurationsChange} />);

    await user.click(screen.getByRole("button", { name: "Create dependency configuration" }));
    await user.click(screen.getByText("Bindings", { selector: "summary" }));
    await user.click(screen.getByRole("checkbox", { name: "TRUE" }));
    await user.click(screen.getByRole("button", { name: "Add binding" }));
    await user.click(screen.getByRole("button", { name: "Advanced" }));
    await user.click(screen.getByRole("button", { name: "Delete configuration" }));
    const dialog = screen.getByRole("alertdialog", { name: "Delete DEP-1?" });
    expect(dialog).toHaveTextContent("1 binding will also be removed.");
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(onConfigurationsChange.mock.calls.at(-1)?.[0]).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "Delete configuration" }));
    await user.click(within(screen.getByRole("alertdialog", { name: "Delete DEP-1?" })).getByRole("button", { name: "Delete configuration" }));
    expect(onConfigurationsChange.mock.calls.at(-1)?.[0]).toEqual([]);
    expect(screen.queryByLabelText("Dependency configuration manager")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Advanced settings")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create dependency configuration" })).toBeInTheDocument();
  });

  it("configures CPT row laws on the one contract and offers no basic-event override", async () => {
    const user = userEvent.setup();
    const onConfigurationsChange = jest.fn();
    render(<Harness onConfigurationsChange={onConfigurationsChange} />);
    const savedConfiguration = (): WorkbookHclConfiguration => onConfigurationsChange.mock.calls.at(-1)?.[0]?.[0];

    await user.click(screen.getByRole("button", { name: "Create dependency configuration" }));
    await user.click(screen.getByText("Fault trees", { selector: "summary" }));
    await user.click(screen.getByRole("button", { name: "Include" }));
    const group = screen.getByText("Uncertainty", { selector: "summary" });
    await user.click(group);
    expect(group).toHaveTextContent("Uncertainty Off");
    await user.click(screen.getByRole("button", { name: "Enable uncertainty" }));

    expect(group).toHaveTextContent("Uncertainty On");
    expect(savedConfiguration().solverSettings.uncertainty).toEqual({ sampleCount: 1000, seed: 42, sampler: "LHS", basicEvents: [], cptRows: [], cptGenerators: [] });
    expect(screen.getByRole("region", { name: "Seismic CPT generators" })).toBeInTheDocument();

    expect(screen.queryByRole("region", { name: "Basic event uncertainty" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add override" })).not.toBeInTheDocument();

    const rows = screen.getByRole("region", { name: "CPT row uncertainty" });
    await user.click(within(rows).getByRole("button", { name: "Add row law" }));
    expect(within(rows).getByText("Configured CPT rows").closest("details")).not.toHaveAttribute("open");
    expect(savedConfiguration().solverSettings.uncertainty).toMatchObject({
      cptRows: [{ cptRowId: TEST_ID.aRow, row: { node: "VALUE", law: { family: "FIXED", values: [0.8, 0.2] } } }],
    });
    await user.click(within(rows).getByText("Configured CPT rows"));
    await user.click(within(rows).getByText("Settings"));
    await user.selectOptions(within(rows).getByRole("combobox", { name: "Law" }), "DIRICHLET");
    const concentration = within(rows).getByRole("textbox", { name: "True concentration" });
    await user.clear(concentration);
    await user.type(concentration, "3");
    await user.tab();
    const saved = savedConfiguration();
    expect(saved.solverSettings.uncertainty).toMatchObject({ cptRows: [{ row: { node: "VALUE", law: { family: "DIRICHLET", concentrations: [8, 3] } } }] });
    expect(saved.solverSettings.uncertainty).not.toHaveProperty("cptProbabilityClipEpsilon");
    expect(WorkbookHclUncertaintyConfigurationSchema.safeParse(saved).success).toBe(true);

    await user.click(screen.getByRole("button", { name: "Disable uncertainty" }));
    expect(savedConfiguration().solverSettings).toEqual({ variableOrder: null, foldConstants: true, spliceNullGates: true });
    expect(group).toHaveTextContent("Uncertainty Off");
  });

  it("keeps mutation controls unavailable in read-only mode", () => {
    render(<Harness editable={false} />);

    expect(screen.getByTestId("bayesian-network-editor")).toHaveClass("bneditor--readonly");
    expect(screen.getByLabelText("Bayesian-network code")).toHaveTextContent("BN-TEST");
    expect(screen.getByLabelText("Bayesian-network name")).toHaveTextContent("Test network");
    expect(screen.getByRole("button", { name: "Add node" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Reusable templates" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Add state" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create dependency configuration" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "BN node Effect" }));
    expect(screen.getByLabelText("Bayesian-network node inspector")).toHaveTextContent("B");
    expect(screen.getAllByLabelText(/State code/)[0]).toHaveAttribute("readonly");
  });
});

it("keeps deleted-node evidence visible and restores it through real undo/redo", async () => {
  const user = userEvent.setup();
  render(<Harness />);
  await user.click(screen.getByRole("radio", { name: "Manual" }));
  await user.click(screen.getByRole("button", { name: "Edit evidence" }));
  await user.selectOptions(screen.getByLabelText("Evidence for A"), TEST_ID.aTrue);
  await user.click(screen.getByRole("button", { name: "Delete node", exact: true }));
  await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Delete node" }));
  await user.click(screen.getByRole("button", { name: "Edit evidence" }));
  expect(screen.getByText("1 evidence entry points at a node or state that no longer exists.")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Run exact inference" })).toBeDisabled();
  await user.click(screen.getByRole("button", { name: "Undo" }));
  await user.click(screen.getByRole("button", { name: "Edit evidence" }));
  expect(screen.getByLabelText("Evidence for A")).toHaveValue(TEST_ID.aTrue);
  expect(screen.getByRole("button", { name: "Run exact inference" })).toBeEnabled();
  await user.click(screen.getByRole("button", { name: "Redo" }));
  await user.click(screen.getByRole("button", { name: "Edit evidence" }));
  await user.click(screen.getByRole("button", { name: "Remove" }));
  expect(screen.queryByText("1 evidence entry points at a node or state that no longer exists.")).not.toBeInTheDocument();
});

it.each(["Saving changes. Run after saving finishes.", "Save failed. Reload or save successfully before running."])(
  "disables network query runs: %s", async (message) => {
    const user = userEvent.setup();
    render(<Harness saveBlockedReason={message} />);
    expect(screen.queryByText(message)).not.toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "Manual" }));
    expect(screen.getByRole("button", { name: "Run exact inference" })).toBeDisabled();
    expect(screen.getByText(message)).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "Batch" }));
    expect(screen.getByRole("button", { name: "Run batch" })).toBeDisabled();
    expect(screen.getByText(message)).toBeInTheDocument();
  },
);

it("holds network query runs during a save without a status line", async () => {
  const user = userEvent.setup();
  render(<Harness saving />);
  await user.click(screen.getByRole("radio", { name: "Manual" }));
  expect(screen.getByRole("button", { name: "Run exact inference" })).toBeDisabled();
  expect(screen.queryByText((text) => text.includes("Saving changes"))).not.toBeInTheDocument();
  await user.click(screen.getByRole("radio", { name: "Batch" }));
  expect(screen.getByRole("button", { name: "Run batch" })).toBeDisabled();
  expect(screen.queryByText((text) => text.includes("Saving changes"))).not.toBeInTheDocument();
});

it("invalidates results when workflow or incomplete CPT input changes", async () => {
  const user = userEvent.setup(); const invalidated = jest.fn();
  render(<Harness onAnalysisInputChange={invalidated} />);
  invalidated.mockClear();
  await user.click(screen.getByRole("radio", { name: "Manual" }));
  expect(invalidated).toHaveBeenCalled();
  invalidated.mockClear();
  fireEvent.change(screen.getByLabelText("A TRUE probability"), { target: { value: "0." } });
  expect(invalidated).toHaveBeenCalled();
});


describe("source BN file actions", () => {
  it.each(["XDSL", "JSON"])("rejects invalid %s and adds no network", async (kind) => {
    const user = userEvent.setup();
    const changed = jest.fn();
    const imported = jest.fn();
    const { container } = render(<Harness onModelChange={changed} onModelImport={imported} />);
    await user.click(screen.getByRole("button", { name: "File" }));
    await user.click(screen.getByRole("menuitem", { name: `Import ${kind}` }));
    const file = new File([], `invalid.${kind.toLowerCase()}`);
    Object.defineProperty(file, "text", { value: async () => kind === "XDSL"
      ? '<smile><nodes><cpt id="A"><state id="Only"/><probabilities>0.4</probabilities></cpt></nodes></smile>'
      : JSON.stringify({ variables: [{ name: "A", states: ["Only"], probabilities: [0.4] }] }) });
    fireEvent.change(container.querySelector('input[type="file"][accept*=".xdsl"]')!, { target: { files: [file] } });
    expect((await screen.findAllByText(/Each CPT row must sum to one/)).length).toBeGreaterThan(0);
    expect(imported).not.toHaveBeenCalled();
    expect(changed).not.toHaveBeenCalled();
  });

  it.each(["XDSL", "JSON"])("imports %s as a new network and leaves the open network as it is", async (kind) => {
    const user = userEvent.setup();
    const changed = jest.fn();
    const imported = jest.fn();
    const { container } = render(<Harness onModelChange={changed} onModelImport={imported} />);
    await user.click(screen.getByRole("button", { name: "File" }));
    await user.click(screen.getByRole("menuitem", { name: `Import ${kind}` }));
    const file = new File([], `certain.${kind.toLowerCase()}`);
    Object.defineProperty(file, "text", { value: async () => kind === "XDSL"
      ? '<smile id="Certain"><nodes><cpt id="Certain"><state id="Only"/><probabilities>1</probabilities></cpt></nodes></smile>'
      : JSON.stringify({ id: "Certain", variables: [{ name: "Certain", states: ["Only"], probabilities: [1] }] }) });
    fireEvent.change(container.querySelector('input[type="file"][accept*=".xdsl"]')!, { target: { files: [file] } });
    await waitFor(() => expect(imported).toHaveBeenCalledTimes(1));
    const added: BayesianNetworkModel = imported.mock.lastCall![0];
    expect(added.code).toBe("Certain");
    expect(added.modelId).not.toBe(TEST_ID.model);
    expect(added.nodes.map((node) => node.code)).toEqual(["Certain"]);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(changed).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "BN node Cause" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "BN node Effect" })).toBeInTheDocument();
  });

  it("gives a re-imported network of its own file a new identity", async () => {
    const user = userEvent.setup();
    const imported = jest.fn();
    const { container } = render(<Harness onModelImport={imported} />);
    await user.click(screen.getByRole("button", { name: "File" }));
    await user.click(screen.getByRole("menuitem", { name: "Import JSON" }));
    const file = new File([], "same.json");
    Object.defineProperty(file, "text", { value: async () => exportBayesianNetworkJson(testBayesianNetworkModel()) });
    fireEvent.change(container.querySelector('input[type="file"][accept*=".xdsl"]')!, { target: { files: [file] } });
    await waitFor(() => expect(imported).toHaveBeenCalledTimes(1));
    const added: BayesianNetworkModel = imported.mock.lastCall![0];
    expect(added.modelId).not.toBe(TEST_ID.model);
    expect(added.nodes).toEqual(testBayesianNetworkModel().nodes);
  });

  it.each(["Export XDSL", "Export OpenPRA JSON", "Export canonical JSON"])("shows a useful error for an invalid %s", async (action) => {
    const user = userEvent.setup();
    const model = testBayesianNetworkModel();
    model.conditionalProbabilityTables[0]!.rows[0]!.values[0].probability = 0.5;
    render(<Harness initialModel={model} />);
    await user.click(screen.getByRole("button", { name: "File" }));
    await user.click(screen.getByRole("menuitem", { name: action }));
    expect((await screen.findAllByText(/Each CPT row must sum to one/)).length).toBeGreaterThan(0);
  });
});


it("allows an imported source-normalized CPT to run without changing its values", async () => {
  const user = userEvent.setup();
  const model = testBayesianNetworkModel();
  model.conditionalProbabilityTables[0]!.rows[0]!.values[0].probability = 0.8000005;
  const changed = jest.fn();
  render(<Harness initialModel={model} onModelChange={changed} />);
  await user.click(screen.getByRole("radio", { name: "Manual" }));
  expect(screen.getByRole("button", { name: "Run exact inference" })).toBeEnabled();
  expect(changed).not.toHaveBeenCalled();
});


describe("module integrity controls", () => {
  it("chooses the exact input code when another node differs only by case", async () => {
    const user = userEvent.setup();
    const model = importBayesianNetworkJson(JSON.stringify({ variables: [
      { name: "a", states: ["On", "on"], probabilities: [0.2, 0.8] },
      { name: "A", states: ["On", "on"], probabilities: [0.9, 0.1] },
      { name: "Pump", states: ["OFF", "ON"], parents: ["A"], probabilities: [0.9, 0.1, 0.2, 0.8] },
    ] }));
    const created = createBayesianNetworkModuleFromBranch(model, model.nodes[2]!.id);
    const changed = jest.fn();
    render(<Harness initialModel={created.model} onModelChange={changed} />);
    await user.click(screen.getByRole("button", { name: "Reusable templates" }));
    await user.click(within(screen.getByLabelText("Saved modules")).getByText("MOD-Pump"));
    await user.click(screen.getByRole("button", { name: "Create instance" }));
    expect(changed.mock.lastCall![0].moduleInstances[0].inputBindings[0].nodeId).toBe(model.nodes[1]!.id);
    expect(validateBayesianNetworkModel(changed.mock.lastCall![0])).toEqual([]);
  });

  it("rejects an invalid branch without saving a template", async () => {
    const user = userEvent.setup();
    const model = testBayesianNetworkModel();
    model.conditionalProbabilityTables[0]!.rows[0]!.values[0].probability = 0.5;
    const changed = jest.fn();
    render(<Harness initialModel={model} onModelChange={changed} />);
    await user.click(screen.getByRole("button", { name: "Reusable templates" }));
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Each CPT row must sum to one");
    expect(changed).not.toHaveBeenCalled();
  });

  it("explains downstream probability resets, supports cancellation and restores deletion with undo", async () => {
    const user = userEvent.setup();
    const created = createBayesianNetworkModuleFromBranch(testBayesianNetworkModel(), TEST_ID.b);
    const copy = instantiateBayesianNetworkModule(created.model, created.templateId);
    const connected = connectNodes(copy.model, copy.outputNodeIds[0]!, TEST_ID.a);
    const table = connected.conditionalProbabilityTables.find((table) => table.nodeId === TEST_ID.a)!;
    table.rows.forEach((row) => { row.values[0].probability = 0.8; row.values[1]!.probability = 0.2; });
    const node = connected.nodes.find((node) => node.id === copy.outputNodeIds[0])!;
    const changed = jest.fn();
    render(<Harness initialModel={connected} onModelChange={changed} />);
    await user.click(screen.getByRole("button", { name: `BN node ${node.name}` }));
    await user.click(screen.getByRole("button", { name: "Delete node" }));
    let dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveTextContent("uniform probabilities (equal probability for every state)");
    expect(dialog).toHaveTextContent("existing probabilities will be discarded");
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(changed).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Delete node" }));
    dialog = screen.getByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Delete instance" }));
    const deleted: BayesianNetworkModel = changed.mock.lastCall![0];
    expect(deleted.moduleInstances).toEqual([]);
    expect(deleted.conditionalProbabilityTables.find((table) => table.nodeId === TEST_ID.a)!.rows[0]!.values.map((value) => value.probability)).toEqual([0.5, 0.5]);
    await user.click(screen.getByRole("button", { name: "Undo" }));
    expect(changed.mock.lastCall![0]).toEqual(connected);
  });
});


it.each(["Save", "Create instance"].flatMap((action) => ["probability", "node code", "state code"].map((field) => [action, field])))(
  "blocks %s while the visible %s edit is incomplete", async (action, field) => {
    const user = userEvent.setup();
    const created = createBayesianNetworkModuleFromBranch(testBayesianNetworkModel(), TEST_ID.b);
    const changed = jest.fn();
    render(<Harness initialModel={created.model} onModelChange={changed} />);
    if (field === "probability") fireEvent.change(screen.getByLabelText("A FALSE probability"), { target: { value: "0.3" } });
    if (field === "node code") fireEvent.change(within(screen.getByLabelText("Bayesian-network node inspector")).getByLabelText("Code"), { target: { value: "" } });
    if (field === "state code") fireEvent.change(screen.getByLabelText("State code 1"), { target: { value: "" } });
    await user.click(screen.getByRole("button", { name: "Reusable templates" }));
    if (action === "Create instance") await user.click(within(screen.getByLabelText("Saved modules")).getByText("MOD-B"));
    await user.click(screen.getByRole("button", { name: action }));
    expect(screen.getByRole("alert")).toHaveTextContent("Finish or correct pending node, state and CPT edits");
    expect(changed).not.toHaveBeenCalled();
  },
);


describe("visual submodels and general templates", () => {
  it("reuses the graph and node components in both views, with controls outside the viewport", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const viewport = screen.getByLabelText("Bayesian-network graph");
    const cause = screen.getByRole("button", { name: "BN node Cause" });
    const controls = screen.getByLabelText("Bayesian-network view controls");
    expect(viewport.contains(controls)).toBe(false);
    await user.selectOptions(screen.getByLabelText("BN graph view"), "SUBMODELS");
    expect(screen.getByLabelText("Bayesian-network graph")).toBe(viewport);
    expect(screen.getByRole("button", { name: "BN node Cause" })).toBe(cause);
    expect(screen.getAllByLabelText("Zoom level")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Connection handle A right" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Auto arrange" })).toBeEnabled();
  });

  it("creates a group from existing nodes and supports undo, redo, reassignment and removal", async () => {
    const user = userEvent.setup();
    const changed = jest.fn();
    const original = testBayesianNetworkModel();
    render(<Harness initialModel={original} onModelChange={changed} />);
    await user.click(screen.getByRole("button", { name: "Manage groups", exact: true }));
    const groupManager = screen.getByLabelText("Manage BN groups");
    expect(within(groupManager).queryByText(/Group existing nodes/)).not.toBeInTheDocument();
    const removeGroup = within(groupManager).getByRole("button", { name: "Remove group" });
    expect(removeGroup).toBeDisabled();
    expect(removeGroup).toHaveClass("bneditor__delete-btn", "bneditor__group-remove");
    expect(removeGroup.parentElement?.lastElementChild).toBe(removeGroup);
    expect(within(screen.getByLabelText("Group members")).queryByText("Cause")).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("Group name"), "Equipment");
    await user.click(screen.getByLabelText("Include A in group"));
    await user.click(screen.getByLabelText("Include B in group"));
    await user.click(screen.getByRole("button", { name: "Create group" }));
    expect(toCanonicalBayesianNetwork(changed.mock.lastCall![0])).toEqual(toCanonicalBayesianNetwork(original));
    await user.selectOptions(screen.getByLabelText("BN graph view"), "SUBMODELS");
    expect(screen.queryByRole("button", { name: "BN node Cause" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Undo", exact: true }));
    expect(screen.queryByRole("button", { name: "Open submodel Equipment" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Redo", exact: true }));
    await user.click(screen.getByRole("button", { name: "Open submodel Equipment" }));
    await user.click(screen.getByRole("button", { name: "BN node Cause" }));
    expect(screen.getByLabelText("CPT for A")).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Node group"), "");
    expect(screen.getByRole("button", { name: "BN node Cause" })).toBeInTheDocument();
    const updated = changed.mock.lastCall![0];
    const groupId = readBayesianNetworkSubmodels(updated)[0]!.id;
    await user.selectOptions(screen.getByLabelText("Group to edit"), groupId);
    await user.click(screen.getByRole("button", { name: "Remove group" }));
    expect(screen.getByRole("button", { name: "BN node Effect" })).toBeInTheDocument();
    expect(toCanonicalBayesianNetwork(changed.mock.lastCall![0])).toEqual(toCanonicalBayesianNetwork(original));
  });

  it("creates nested groups, filters membership choices and adds nodes to the current scope", async () => {
    const user = userEvent.setup();
    const changed = jest.fn();
    const model = saveBayesianNetworkSubmodel(testBayesianNetworkModel(), { name: "Equipment", parentId: null, nodeIds: [] });
    const parentId = readBayesianNetworkSubmodels(model)[0]!.id;
    render(<Harness initialModel={model} onModelChange={changed} />);
    await user.click(screen.getByRole("button", { name: "Manage groups", exact: true }));
    await user.type(screen.getByLabelText("Group name"), "Controls");
    await user.selectOptions(screen.getByLabelText("Parent group"), parentId);
    await user.type(screen.getByLabelText("Find group nodes"), "A");
    expect(screen.queryByLabelText("Include B in group")).not.toBeInTheDocument();
    await user.click(screen.getByLabelText("Include A in group"));
    await user.click(screen.getByRole("button", { name: "Create group" }));
    await user.selectOptions(screen.getByLabelText("BN graph view"), "SUBMODELS");
    await user.click(screen.getByRole("button", { name: "Open submodel Equipment", exact: true }));
    await user.click(screen.getByRole("button", { name: "Open submodel Equipment / Controls" }));
    await user.click(screen.getByRole("button", { name: "Add node", exact: true }));
    const updated: BayesianNetworkModel = changed.mock.lastCall![0];
    expect(readBayesianNetworkSubmodels(updated).find((group) => group.name === "Controls")!.nodeIds).toHaveLength(2);
    expect(updated.nodes).toHaveLength(3);
  });

  it("connects and drags actual nodes inside a group using the shared controls", async () => {
    const user = userEvent.setup();
    const changed = jest.fn();
    const before = testBayesianNetworkModel();
    const model = saveBayesianNetworkSubmodel(before, { name: "Equipment", parentId: null, nodeIds: before.nodes.map((node) => node.id) });
    render(<Harness initialModel={model} onModelChange={changed} />);
    await user.selectOptions(screen.getByLabelText("BN graph view"), "SUBMODELS");
    await user.click(screen.getByRole("button", { name: "Open submodel Equipment" }));
    const handle = screen.getByRole("button", { name: "Connection handle A right" });
    fireEvent(handle, pointerEvent("pointerdown", { button: 0, pointerId: 70, clientX: 220, clientY: 82 }));
    fireEvent(handle, pointerEvent("pointermove", { pointerId: 70, clientX: 300, clientY: 82 }));
    fireEvent(handle, pointerEvent("pointerup", { button: 0, pointerId: 70, clientX: 300, clientY: 82 }));
    expect(changed.mock.lastCall![0].edges).toHaveLength(1);
    expect(screen.getByLabelText("CPT for B").querySelectorAll("tbody tr")).toHaveLength(2);
    const node = screen.getByRole("button", { name: "BN node Effect" });
    fireEvent(node, pointerEvent("pointerdown", { button: 0, pointerId: 71, clientX: 320, clientY: 70 }));
    fireEvent(node, pointerEvent("pointermove", { pointerId: 71, clientX: 380, clientY: 120 }));
    fireEvent(node, pointerEvent("pointerup", { button: 0, pointerId: 71, clientX: 380, clientY: 120 }));
    expect(node.closest("[data-bn-node-id]")).toHaveStyle({ left: "360px", top: "90px" });
    expect(readBayesianNetworkSubmodels(changed.mock.lastCall![0])[0]!.nodeIds).toHaveLength(2);
  });

  it("does not offer mutation controls in read-only mode or allow deleting summary edges", async () => {
    const user = userEvent.setup();
    render(<Harness initialModel={importBayesianNetworkXdsl(sourceReference.submodels.xdsl)} editable={false} />);
    expect(screen.getByRole("button", { name: "Manage groups", exact: true })).toBeDisabled();
    expect(screen.queryByLabelText("Manage BN groups")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "File" }));
    expect(screen.getByRole("menuitem", { name: "Import XDSL", exact: true })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "File" }));
    expect(screen.getByText(/This network is read-only/)).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("BN graph view"), "SUBMODELS");
    expect(screen.getByRole("button", { name: "Add node", exact: true })).toBeDisabled();
    expect(screen.queryByTestId("bayesian-network-edge-hit")).not.toBeInTheDocument();
    fireEvent.contextMenu(screen.getAllByTestId("bayesian-network-edge")[0]!);
    expect(screen.queryByRole("menu", { name: /Actions for connection/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "BN node Power" }));
    expect(screen.getByLabelText("Node group")).toBeDisabled();
  });

  it.each([true, false])("navigates nested source groups without changing the model, editable=%s", async (editable) => {
    const user = userEvent.setup();
    const model = importBayesianNetworkXdsl(sourceReference.submodels.xdsl);
    const changed = jest.fn();
    render(<Harness initialModel={model} onModelChange={changed} editable={editable} />);
    await user.selectOptions(screen.getByRole("combobox", { name: "BN graph view" }), "SUBMODELS");
    const home = screen.getByRole("button", { name: "Home", exact: true });
    const back = screen.getByRole("button", { name: "Back", exact: true });
    expect(home).toBeDisabled();
    expect(home).toContainHTML("<svg");
    expect(back).toContainHTML("<svg");
    expect(home).not.toHaveTextContent("Home");
    expect(back).not.toHaveTextContent("Back");
    expect(screen.getByLabelText("Connections between visible groups and nodes")).toHaveTextContent("Pumps → Cooling: 2 connections");
    fireEvent.doubleClick(screen.getByRole("button", { name: "Open submodel Pumps", exact: true }));
    expect(screen.getByRole("button", { name: "BN node A" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "BN node D" })).not.toBeInTheDocument();
    const control = screen.getByRole("button", { name: "Open submodel Pumps / Controls" });
    control.focus(); await user.keyboard("{Enter}");
    expect(screen.getByRole("button", { name: "BN node C" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "BN node C" }));
    expect(screen.getByLabelText("CPT for C")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Back", exact: true }));
    expect(screen.getByRole("button", { name: "BN node B" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Home", exact: true }));
    expect(screen.getByRole("button", { name: "Open submodel Cooling" })).toBeInTheDocument();
    await user.selectOptions(screen.getByRole("combobox", { name: "BN graph view" }), "NODES");
    expect(screen.getByRole("button", { name: "BN node D" })).toBeInTheDocument();
    expect(changed).not.toHaveBeenCalled();
  });

  it("offers compatible template input choices and binds the chosen node", async () => {
    const user = userEvent.setup();
    const model = importBayesianNetworkJson(JSON.stringify({ ...sourceReference.synthetic.network, variables: [
      ...sourceReference.synthetic.network.variables,
      {name: "Other", states: ["LOW", "MID", "HIGH"], probabilities: [0.4, 0.3, 0.3]},
    ] }));
    const created = createBayesianNetworkModuleFromBranch(model, model.nodes[0]!.id);
    const changed = jest.fn();
    render(<Harness initialModel={created.model} onModelChange={changed} />);
    await user.click(screen.getByRole("button", { name: "Reusable templates" }));
    await user.click(within(screen.getByLabelText("Saved modules")).getByText("MOD-Z"));
    const input = screen.getByRole("combobox", { name: "Input A for MOD-Z" });
    expect(within(input).queryByRole("option", {name: /Z —/})).not.toBeInTheDocument();
    await user.selectOptions(input, "");
    expect(screen.getByRole("button", { name: "Create instance" })).toBeDisabled();
    const other = model.nodes.find((node) => node.code === "Other")!;
    await user.selectOptions(input, other.id);
    await user.click(screen.getByRole("button", { name: "Create instance" }));
    const updated: BayesianNetworkModel = changed.mock.lastCall![0];
    expect(updated.moduleInstances![0]!.inputBindings[0]!.nodeId).toBe(other.id);
    expect(validateBayesianNetworkModel(updated)).toEqual([]);
    await user.selectOptions(screen.getByRole("combobox", { name: "BN graph view" }), "SUBMODELS");
    expect(screen.getByRole("button", { name: `Open submodel ${updated.moduleInstances![0]!.name}` })).toBeInTheDocument();
  });

  it("reorders an instance's parents without resetting probabilities and supports undo", async () => {
    const user = userEvent.setup();
    const model = importBayesianNetworkJson(JSON.stringify(sourceReference.synthetic.network));
    const created = createBayesianNetworkModuleFromBranch(model, model.nodes[0]!.id);
    const template = created.model.moduleTemplates![0]!;
    const copy = instantiateBayesianNetworkModule(created.model, template.id, {inputBindings:[{portId:template.inputPorts[0]!.id,nodeId:model.nodes[1]!.id}]});
    const node = copy.model.nodes.find((candidate) => candidate.code.endsWith("-C"))!;
    const changed = jest.fn();
    render(<Harness initialModel={copy.model} onModelChange={changed} />);
    await user.click(screen.getByRole("button", { name: `BN node ${node.name}` }));
    await user.click(screen.getByRole("button", { name: "Move parent 1 down" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    const updated: BayesianNetworkModel = changed.mock.lastCall![0];
    const actual = toCanonicalBayesianNetwork(updated).variables.find((candidate) => candidate.name === node.code)!;
    expect(actual.probabilities).toEqual(sourceReference.synthetic.reordered.find((candidate) => candidate.name === "C")!.probabilities);
    expect(validateBayesianNetworkModel(updated)).toEqual([]);
    await user.click(screen.getByRole("button", { name: "Undo" }));
    expect(changed.mock.lastCall![0]).toEqual(copy.model);
  });

  it("shows malformed grouping metadata as an error and keeps the ordinary graph available", async () => {
    const user = userEvent.setup();
    const model = testBayesianNetworkModel();
    model.xdslMetadata = {rootAttributes:{},nodeIdentifiers:[],extensionsXml:"<extensions><broken>"};
    const changed = jest.fn();
    render(<Harness initialModel={model} onModelChange={changed} />);
    await user.selectOptions(screen.getByRole("combobox", { name: "BN graph view" }), "SUBMODELS");
    expect(screen.getByRole("alert")).toHaveTextContent("not valid XML");
    await user.selectOptions(screen.getByRole("combobox", { name: "BN graph view" }), "NODES");
    expect(screen.getByRole("button", { name: "BN node Cause" })).toBeInTheDocument();
    expect(changed).not.toHaveBeenCalled();
  });
});


it("creates an instance with a valid default name when its template name reaches the limit", async () => {
  const user = userEvent.setup();
  const model = testBayesianNetworkModel();
  model.nodes[0]!.name = "A".repeat(200);
  const created = createBayesianNetworkModuleFromBranch(model, TEST_ID.a);
  const changed = jest.fn();
  render(<Harness initialModel={created.model} onModelChange={changed} />);
  await user.click(screen.getByRole("button", {name:"Reusable templates"}));
  await user.click(within(screen.getByLabelText("Saved modules")).getByText("MOD-A"));
  expect(within(screen.getByLabelText("Saved modules")).getByLabelText("Name")).toHaveValue(created.model.moduleTemplates![0]!.name);
  await user.click(screen.getByRole("button", {name:"Create instance"}));
  expect(validateBayesianNetworkModel(changed.mock.lastCall![0])).toEqual([]);
});
