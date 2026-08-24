import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState, type JSX } from "react";
import type { EsqHclConfiguration } from "interfaces-mef-types/esq/workbook-models";
import type { BayesianNetworkEvidenceConfiguration } from "interfaces-mef-types/modeling";
import {
  validateBayesianNetworkModel,
  type BayesianNetworkAnalysisResult,
  type BayesianNetworkModel,
} from "interfaces-shared-types/newly-developed-methods/bayesian-network";
import { BayesianNetworkEditor } from "../bayesianNetworkEditor";
import { connectNodes } from "../bayesianNetworkOperations";
import type { BayesianNetworkFaultTreeOption } from "../bayesianNetworkTypes";
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
  basicEvents: [{ id: BASIC_EVENT_ID, code: "BE-PUMP", name: "Pump failure" }],
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
  editable = true,
  result = null,
  onRun = jest.fn(),
  onConfigurationsChange = jest.fn(),
  onRunHclFaultTree = jest.fn(),
}: {
  initialModel?: BayesianNetworkModel;
  editable?: boolean;
  result?: BayesianNetworkAnalysisResult | null;
  onRun?: () => void;
  onConfigurationsChange?: (configurations: EsqHclConfiguration[]) => void;
  onRunHclFaultTree?: jest.Mock;
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
  return (
    <BayesianNetworkEditor
      model={model}
      editable={editable}
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
      hclRunResult={null}
      onModelChange={setModel}
      onEvidenceChange={setEvidence}
      onQueryNodeChange={setQueryNodeId}
      onHclConfigurationsChange={replaceConfigurations}
      onRunHclFaultTree={onRunHclFaultTree}
      onRunHclEventTree={jest.fn()}
      onRun={onRun}
    />
  );
}

describe("BayesianNetworkEditor", () => {
  afterEach(() => jest.restoreAllMocks());

  it("renders the canonical graph, CPT, and exact-query controls", () => {
    render(<Harness />);

    expect(screen.getByLabelText("Bayesian-network graph")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /BN node/i })).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: /Connection handle/i })).toHaveLength(8);
    expect(screen.getByLabelText("CPT for A")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run exact inference" })).toBeEnabled();
    expect(screen.queryByText(/backend selector/i)).not.toBeInTheDocument();
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

    ["Run exact inference", "Create HCL configuration"].forEach((name) => {
      const action = screen.getByRole("button", { name });
      expect(action).toHaveClass("posnav__btn", "posnav__btn--sm", "posnav__btn--primary");
      expect(action).toContainHTML("<svg");
    });
  });

  it("gives an empty network the full canvas and one brief hint", () => {
    const emptyModel = testBayesianNetworkModel();
    emptyModel.nodes = [];
    emptyModel.edges = [];
    emptyModel.conditionalProbabilityTables = [];
    emptyModel.nodePositions = [];
    render(<Harness initialModel={emptyModel} />);

    const editor = screen.getByTestId("bayesian-network-editor");
    expect(editor.querySelector(".bneditor__workspace")).not.toHaveClass("bneditor__workspace--inspecting");
    expect(screen.queryByLabelText("Bayesian-network node inspector")).not.toBeInTheDocument();
    expect(screen.getByText("Add a node to begin.")).toBeInTheDocument();
    expect(screen.queryByText("No discrete nodes yet")).not.toBeInTheDocument();
    expect(screen.queryByText(/Select a node to edit/i)).not.toBeInTheDocument();
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
    expect(within(cpt).getByLabelText("A STATE-3 probability")).toHaveValue(1 / 3);
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

  it("identifies an invalid row and normalizes it only on request", async () => {
    const user = userEvent.setup();
    const initial = testBayesianNetworkModel();
    initial.conditionalProbabilityTables[0]!.rows[0]!.values.forEach((value) => { value.probability = 0.2; });
    render(<Harness initialModel={initial} />);

    expect(screen.getByLabelText(`Row total ${TEST_ID.aRow}`)).toHaveTextContent("0.400000");
    await user.click(screen.getByRole("button", { name: "Normalize row" }));
    expect(screen.getByLabelText(`Row total ${TEST_ID.aRow}`)).toHaveTextContent("1.000000");
  });

  it("applies and clears evidence and displays the exact posterior", async () => {
    const user = userEvent.setup();
    const onRun = jest.fn();
    render(<Harness result={analysisResult} onRun={onRun} />);

    await user.selectOptions(screen.getByLabelText("Evidence for A"), TEST_ID.aTrue);
    expect(screen.getByRole("button", { name: "BN node Cause" })).toHaveTextContent("Evidence: TRUE");
    await user.selectOptions(screen.getByLabelText("Evidence for A"), "");
    expect(screen.getByRole("button", { name: "BN node Cause" })).not.toHaveTextContent("Evidence:");
    await user.click(screen.getByRole("button", { name: "Run exact inference" }));

    expect(onRun).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("Posterior distribution")).toHaveTextContent("80.0000%");
  });

  it("creates a typed HCL binding and rejects selecting every BN state", async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole("button", { name: "Create HCL configuration" }));
    expect(screen.getByRole("button", { name: "Add binding" })).toHaveClass(
      "posnav__btn",
      "posnav__btn--sm",
      "posnav__btn--primary",
      "hcleditor__add-binding",
    );
    expect(screen.getByRole("button", { name: "Delete configuration" })).toHaveClass("hcleditor__aligned-action");
    expect(screen.getByRole("button", { name: "Run HCL quantification" })).toHaveClass("hcleditor__aligned-action");
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

    await user.selectOptions(screen.getByLabelText("Evidence for A"), TEST_ID.aTrue);
    await user.click(screen.getByRole("button", { name: "Create HCL configuration" }));
    expect(onConfigurationsChange.mock.calls.at(-1)?.[0]?.[0]?.baseEvidence).toEqual({
      observations: [{ nodeId: TEST_ID.a, stateId: TEST_ID.aTrue }],
    });

    await user.click(screen.getByRole("button", { name: "Include selected fault tree" }));
    expect(screen.getByLabelText("Included HCL fault trees")).toHaveTextContent("FT-A");
    await user.click(screen.getByRole("button", { name: "Run HCL quantification" }));
    expect(onRunHclFaultTree).toHaveBeenCalledWith(expect.any(Object), faultTreeOptions[0]);
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
