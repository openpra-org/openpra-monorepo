import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { FaultTreeAnalysisResult } from "interfaces-shared-types/newly-developed-methods/fault-tree";
import type { ValidationIssue } from "interfaces-shared-types/newly-developed-methods/shared";
import {
  FaultTreeEditor,
  type FaultTreeEditorCapabilities,
  type FaultTreeEditorCatalogue,
  type FaultTreeEditorModel,
  type FaultTreeEditorProps,
  type FaultTreeOperation,
} from "../index";

const ROOT_GATE_ID = "11111111-1111-4111-8111-111111111111";
const BRANCH_GATE_ID = "22222222-2222-4222-8222-222222222222";
const SPARE_GATE_ID = "33333333-3333-4333-8333-333333333333";
const LEAF_ID = "44444444-4444-4444-8444-444444444444";
const BASIC_EVENT_ID = "55555555-5555-4555-8555-555555555555";

const model: FaultTreeEditorModel = {
  modelId: "66666666-6666-4666-8666-666666666666",
  code: "FT-COOLING",
  name: "Cooling system fault tree",
  description: "Loss of cooling model",
  topGate: { gateId: ROOT_GATE_ID },
  gates: [
    {
      id: ROOT_GATE_ID,
      kind: "GATE",
      gateType: "OR",
      code: "TOP",
      name: "Loss of cooling",
      description: "Top event",
    },
    {
      id: BRANCH_GATE_ID,
      kind: "GATE",
      gateType: "AND",
      code: "G-A",
      name: "Train unavailable",
      description: "Train logic",
    },
    {
      id: SPARE_GATE_ID,
      kind: "GATE",
      gateType: "K_OF_N",
      k: 1,
      code: "G-B",
      name: "Standby train unavailable",
      description: "Standby logic",
    },
  ],
  leafNodes: [
    {
      id: LEAF_ID,
      kind: "BASIC_EVENT_REFERENCE",
      basicEventId: BASIC_EVENT_ID,
    },
  ],
  gateInputs: [
    {
      id: "77777777-7777-4777-8777-777777777771",
      gateId: ROOT_GATE_ID,
      childId: BRANCH_GATE_ID,
      order: 0,
    },
    {
      id: "77777777-7777-4777-8777-777777777772",
      gateId: BRANCH_GATE_ID,
      childId: LEAF_ID,
      order: 0,
    },
  ],
  nodePositions: [
    { nodeId: ROOT_GATE_ID, position: { x: 278, y: 24 } },
    { nodeId: BRANCH_GATE_ID, position: { x: 70, y: 172 } },
    { nodeId: SPARE_GATE_ID, position: { x: 486, y: 172 } },
    { nodeId: LEAF_ID, position: { x: 70, y: 320 } },
  ],
  layout: {
    mode: "MANUAL",
    direction: "TOP_TO_BOTTOM",
    viewport: { x: 0, y: 0, zoom: 1 },
  },
};

const catalogue: FaultTreeEditorCatalogue = {
  basicEvents: [
    {
      id: BASIC_EVENT_ID,
      code: "BE-PUMP",
      name: "Shared pump failure",
      description: "Pump fails on demand",
      probability: { value: 0.02 },
    },
  ],
  presentations: [
    {
      basicEventId: BASIC_EVENT_ID,
      failureModeLabel: "Fails to start",
      failureModeShort: "FTS",
      commonCause: true,
      repairCredited: true,
    },
  ],
};

const authorCapabilities: FaultTreeEditorCapabilities = {
  mode: "AUTHOR",
  canEditBasicEvents: true,
  canEditLayout: true,
  canImport: false,
  canExport: false,
  canRunAnalysis: true,
};

function editorProps(overrides: Partial<FaultTreeEditorProps> = {}): FaultTreeEditorProps {
  return {
    model,
    catalogue,
    capabilities: authorCapabilities,
    selection: null,
    validation: [],
    saveState: "saved",
    analysisResult: null,
    resultIsStale: false,
    onOperation: jest.fn(),
    onSelectionChange: jest.fn(),
    onOpenReference: jest.fn(),
    onRun: jest.fn(),
    ...overrides,
  };
}

const analysisResult: FaultTreeAnalysisResult = {
  schemaVersion: "1.0.0",
  runId: "88888888-8888-4888-8888-888888888888",
  owner: {
    workbookId: "sy-workbook-1",
    workbookRevision: 12,
    modelId: model.modelId,
  },
  topGateId: ROOT_GATE_ID,
  topEventProbability: 0.02,
  minimalCutSetCount: 1,
  leadingCutSets: [
    {
      rank: 1,
      order: 1,
      probability: 0.02,
      contribution: 1,
      events: [{ basicEventId: BASIC_EVENT_ID, complemented: false }],
    },
  ],
  validationIssues: [],
  completedAt: "2026-08-22T12:00:00.000Z",
};

describe("FaultTreeEditor", () => {
  it("renders the approved SY boxes, symbols, and connectors without a persistent legend", () => {
    const { container } = render(<FaultTreeEditor {...editorProps()} />);

    const topGate = screen.getByRole("button", { name: /Loss of cooling/i });
    expect(topGate).toHaveClass("ftbox", "ftbox--gate");
    expect(topGate).toHaveStyle({ width: "184px", height: "66px" });
    expect(screen.getByRole("button", { name: /Shared pump failure/i })).toHaveClass(
      "ftbox--be",
      "ftbox--ccf",
    );
    expect(container.querySelector(".sytree .ftgate--or")).toBeInTheDocument();
    expect(container.querySelector(".sytree .ftgate--and")).toBeInTheDocument();
    expect(container.querySelector(".sytree .ftsym--ccf")).toBeInTheDocument();
    expect(container.querySelectorAll(".sytree .ftline").length).toBeGreaterThan(0);

    expect(screen.queryByLabelText("Fault-tree legend")).not.toBeInTheDocument();
  });

  it("shows names above a consistent bottom-left code row without type headings or a name toggle", () => {
    render(<FaultTreeEditor {...editorProps()} />);

    const topGate = screen.getByRole("button", { name: /Loss of cooling/i });
    const basicEvent = screen.getByRole("button", { name: /Shared pump failure/i });
    const topGateMeta = topGate.querySelector(".ftbox__be-meta");
    const basicEventMeta = basicEvent.querySelector(".ftbox__be-meta");
    expect(within(topGate).getByText("Loss of cooling")).toHaveClass("ftbox__name");
    expect(within(topGate).getByText("TOP")).toBeInTheDocument();
    expect(topGateMeta?.firstElementChild).toHaveTextContent("TOP");
    expect(within(topGate).queryByText("OR gate")).not.toBeInTheDocument();
    expect(within(basicEvent).getByText("Shared pump failure")).toHaveClass("ftbox__name");
    expect(within(basicEvent).getByText("BE-PUMP")).toBeInTheDocument();
    expect(basicEventMeta?.firstElementChild).toHaveTextContent("BE-PUMP");
    expect(within(basicEvent).getByText("FTS")).toBeInTheDocument();
    expect(within(basicEvent).getByText("2.0e-2")).toBeInTheDocument();
    expect(within(basicEvent).queryByText("Repair credited")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /(?:Show|Hide) names/ })).not.toBeInTheDocument();
  });

  it("keeps navigation controls on the canvas and authoring actions on node context menus", () => {
    render(<FaultTreeEditor {...editorProps()} />);

    expect(screen.queryByLabelText("Add fault-tree node")).not.toBeInTheDocument();
    const navigation = screen.getByLabelText("Fault-tree canvas controls");
    expect(within(navigation).getByRole("button", { name: "Zoom in" })).toBeInTheDocument();
    expect(within(navigation).getByRole("button", { name: "Zoom out" })).toBeInTheDocument();
    expect(within(navigation).getByRole("button", { name: "Fit" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Selected fault-tree node inspector")).not.toBeInTheDocument();
    expect(screen.queryByText(/Select a gate or event to inspect/i)).not.toBeInTheDocument();

    fireEvent.contextMenu(screen.getByRole("button", { name: /Loss of cooling/i }), {
      clientX: 200,
      clientY: 120,
    });
    const menu = screen.getByRole("menu", { name: /Actions for Loss of cooling/i });
    expect(within(menu).getByRole("menuitem", { name: "Add gate" })).toBeInTheDocument();
    expect(within(menu).getAllByRole("menuitem", { name: "Add basic event" })).toHaveLength(1);
    expect(within(menu).queryByLabelText("Search basic events")).not.toBeInTheDocument();
    expect(within(menu).queryByRole("menuitem", { name: "Create new basic event" })).not.toBeInTheDocument();
    expect(within(menu).queryByText(/shared basic event/i)).not.toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: "Delete node" })).toBeInTheDocument();
  });

  it("lets an ordinary wheel gesture scroll the workbook and reserves wheel zoom for pinch gestures", () => {
    const onPageWheel = jest.fn();
    const { container } = render(<div onWheel={onPageWheel}><FaultTreeEditor {...editorProps()} /></div>);
    const viewport = container.querySelector<HTMLElement>(".fteditor__viewport");
    const stage = container.querySelector<HTMLElement>(".fteditor__stage");
    expect(viewport).not.toBeNull();
    expect(stage).not.toBeNull();
    const initialTransform = stage!.style.transform;

    fireEvent.wheel(viewport!, { deltaX: 25, deltaY: 80 });
    expect(screen.getByLabelText("Zoom level")).toHaveTextContent("100%");
    expect(stage!.style.transform).toBe(initialTransform);
    expect(onPageWheel).toHaveBeenCalledTimes(1);

    fireEvent.wheel(viewport!, {
      ctrlKey: true,
      clientX: 100,
      clientY: 100,
      deltaY: -60,
    });
    expect(screen.getByLabelText("Zoom level")).not.toHaveTextContent("100%");
  });

  it("does not emit a layout operation when the blank canvas is only clicked", () => {
    const onOperation = jest.fn<void, [FaultTreeOperation]>();
    const { container } = render(<FaultTreeEditor {...editorProps({ onOperation })} />);
    const viewport = container.querySelector<HTMLElement>(".fteditor__viewport")!;

    fireEvent.pointerDown(viewport, { button: 0, pointerId: 7, clientX: 140, clientY: 120 });
    fireEvent.pointerUp(viewport, { button: 0, pointerId: 7, clientX: 140, clientY: 120 });

    expect(onOperation).not.toHaveBeenCalled();
  });

  it("renders visible, addressable edges and highlights the selected path", () => {
    const edgeIssue: ValidationIssue = {
      code: "FT_EDGE_INVALID",
      severity: "ERROR",
      message: "This connection is invalid.",
      entityId: model.gateInputs[1].id,
      fieldPath: ["gateInputs", 1],
    };
    const { container } = render(
      <FaultTreeEditor
        {...editorProps({ selection: { kind: "LEAF", leafId: LEAF_ID }, validation: [edgeIssue] })}
      />,
    );

    const edges = screen.getAllByTestId("fault-tree-edge");
    expect(edges).toHaveLength(model.gateInputs.length);
    expect(edges.every((edge) => edge.getAttribute("vector-effect") === "non-scaling-stroke")).toBe(true);
    expect(edges.some((edge) => edge.classList.contains("ftline--selected"))).toBe(true);
    expect(edges.some((edge) => edge.classList.contains("ftline--invalid"))).toBe(true);
    expect(container.querySelector(".ftsvg")).toBeInTheDocument();
  });

  it("renders automatic trees top to bottom with a shared straight trunk and straight relationship branches", () => {
    const automaticModel: FaultTreeEditorModel = {
      ...model,
      nodePositions: [],
      layout: { ...model.layout, mode: "AUTOMATIC", direction: "TOP_TO_BOTTOM" },
    };
    const { container } = render(<FaultTreeEditor {...editorProps({ model: automaticModel })} />);

    const edges = screen.getAllByTestId("fault-tree-edge");
    const basicEventTop = Number.parseFloat(screen.getByRole("button", { name: /Shared pump failure/i }).style.top);
    const branchTop = Number.parseFloat(screen.getByRole("button", { name: /^AND gate Train unavailable$/i }).style.top);
    const topEventTop = Number.parseFloat(screen.getByRole("button", { name: /Loss of cooling/i }).style.top);

    expect(edges.every((edge) => edge.tagName.toLowerCase() === "line")).toBe(true);
    expect(container.querySelectorAll(".ftline--trunk")).toHaveLength(2);
    expect(container.querySelectorAll("path.ftedge")).toHaveLength(0);
    expect(topEventTop).toBeLessThan(branchTop);
    expect(branchTop).toBeLessThan(basicEventTop);
  });

  it("uses one gate trunk and one rail to branch to stacked basic events", () => {
    const secondLeafId = "99999999-9999-4999-8999-999999999991";
    const thirdLeafId = "99999999-9999-4999-8999-999999999992";
    const threeBasicEventsModel: FaultTreeEditorModel = {
      ...model,
      gates: [model.gates[0]],
      leafNodes: [
        model.leafNodes[0],
        { ...model.leafNodes[0], id: secondLeafId },
        { ...model.leafNodes[0], id: thirdLeafId },
      ],
      gateInputs: [
        { ...model.gateInputs[0], childId: LEAF_ID },
        { ...model.gateInputs[0], id: "99999999-9999-4999-8999-999999999993", childId: secondLeafId, order: 1 },
        { ...model.gateInputs[0], id: "99999999-9999-4999-8999-999999999994", childId: thirdLeafId, order: 2 },
      ],
      nodePositions: [],
      layout: { ...model.layout, mode: "AUTOMATIC", direction: "TOP_TO_BOTTOM" },
    };
    const { container } = render(<FaultTreeEditor {...editorProps({ model: threeBasicEventsModel })} />);

    const trunks = screen.getAllByTestId("fault-tree-trunk");
    const rails = screen.getAllByTestId("fault-tree-basic-event-rail");
    const edges = screen.getAllByTestId("fault-tree-edge");

    expect(trunks).toHaveLength(1);
    expect(rails).toHaveLength(1);
    expect(edges).toHaveLength(3);
    expect(trunks[0]).toHaveAttribute("x1", trunks[0]?.getAttribute("x2"));
    expect(rails[0]).toHaveAttribute("x1", rails[0]?.getAttribute("x2"));
    expect(edges.every((edge) => edge.tagName.toLowerCase() === "line")).toBe(true);
    expect(edges.every((edge) => edge.getAttribute("y1") === edge.getAttribute("y2"))).toBe(true);
    expect(container.querySelectorAll("path.ftedge")).toHaveLength(0);
  });

  it("renders every supported leaf-node symbol through the canonical editor", () => {
    const houseId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    const undevelopedId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const transferId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    const everyLeafModel: FaultTreeEditorModel = {
      ...model,
      gates: [model.gates[0]],
      leafNodes: [
        model.leafNodes[0],
        {
          id: houseId,
          kind: "HOUSE_EVENT",
          code: "HE-BYPASS",
          name: "Bypass enabled",
          description: "A true house event",
          state: true,
        },
        {
          id: undevelopedId,
          kind: "UNDEVELOPED_EVENT",
          code: "UE-SUPPORT",
          name: "Support failure",
          description: "An undeveloped event",
        },
        {
          id: transferId,
          kind: "TRANSFER_REFERENCE",
          code: "TR-POWER",
          name: "Loss of power",
          description: "A transferred fault tree",
          target: {
            modelId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
            entityId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
          },
        },
      ],
      gateInputs: [LEAF_ID, houseId, undevelopedId, transferId].map((childId, order) => ({
        id: `ffffffff-ffff-4fff-8fff-fffffffffff${order}`,
        gateId: ROOT_GATE_ID,
        childId,
        order,
      })),
      nodePositions: [
        { nodeId: ROOT_GATE_ID, position: { x: 278, y: 24 } },
        { nodeId: LEAF_ID, position: { x: 10, y: 220 } },
        { nodeId: houseId, position: { x: 210, y: 220 } },
        { nodeId: undevelopedId, position: { x: 410, y: 220 } },
        { nodeId: transferId, position: { x: 610, y: 220 } },
      ],
    };
    const { container } = render(
      <FaultTreeEditor
        {...editorProps({
          model: everyLeafModel,
          transferTargets: [{
            target: {
              modelId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
              entityId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
            },
            code: "FT-POWER",
            name: "Power fault tree",
          }],
        })}
      />,
    );

    expect(screen.getByRole("button", { name: /Shared pump failure/i })).toHaveClass("ftbox--be");
    expect(screen.getByRole("button", { name: /Bypass enabled/i })).toHaveTextContent("HE-BYPASS");
    expect(screen.getByRole("button", { name: /Support failure/i })).toHaveTextContent("UE-SUPPORT");
    expect(screen.getByRole("button", { name: /Loss of power/i })).toHaveClass("ftbox--tr");
    expect(container.querySelector(".ftsym--be")).toBeInTheDocument();
    expect(container.querySelector(".ftsym--house")).toBeInTheDocument();
    expect(container.querySelector(".ftsym--undeveloped")).toBeInTheDocument();
    expect(container.querySelector(".ftsym--tr")).toBeInTheDocument();
    expect(screen.getAllByTestId("fault-tree-edge")).toHaveLength(4);
    expect(container.querySelector('line[data-edge-id="ffffffff-ffff-4fff-8fff-fffffffffff3"]')).toBeInTheDocument();
  });

  it("opens an external record only from the explicit inspector action", async () => {
    const user = userEvent.setup();
    const onSelectionChange = jest.fn();
    const onOpenReference = jest.fn();
    const rendered = render(
      <FaultTreeEditor {...editorProps({ onSelectionChange, onOpenReference })} />,
    );

    await user.click(screen.getByRole("button", { name: /Shared pump failure/i }));
    expect(onSelectionChange).toHaveBeenCalledWith({ kind: "LEAF", leafId: LEAF_ID });
    expect(onOpenReference).not.toHaveBeenCalled();

    rendered.rerender(
      <FaultTreeEditor
        {...editorProps({
          selection: { kind: "LEAF", leafId: LEAF_ID },
          onSelectionChange,
          onOpenReference,
        })}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Open basic event" }));
    expect(onOpenReference).toHaveBeenCalledWith({ kind: "BASIC_EVENT", basicEventId: BASIC_EVENT_ID });
  });

  it("prevents an empty required identity from being committed", async () => {
    const user = userEvent.setup();
    const onOperation = jest.fn<void, [FaultTreeOperation]>();
    render(<FaultTreeEditor {...editorProps({ onOperation })} />);

    const code = screen.getByLabelText("Tree code");
    await user.clear(code);
    await user.tab();

    expect(screen.getByText("Tree code is required.")).toBeInTheDocument();
    expect(onOperation).not.toHaveBeenCalled();
  });

  it("emits one controlled operation when the tree is renamed", async () => {
    const user = userEvent.setup();
    const onOperation = jest.fn<void, [FaultTreeOperation]>();
    render(<FaultTreeEditor {...editorProps({ onOperation })} />);

    const name = screen.getByLabelText("Fault-tree name");
    await user.clear(name);
    await user.type(name, "Updated cooling tree");
    await user.tab();

    expect(onOperation).toHaveBeenCalledTimes(1);
    expect(onOperation).toHaveBeenCalledWith({
      type: "UPDATE_MODEL",
      patch: { name: "Updated cooling tree" },
    });
  });

  it("emits a controlled create operation", async () => {
    const user = userEvent.setup();
    const onOperation = jest.fn<void, [FaultTreeOperation]>();
    render(<FaultTreeEditor {...editorProps({ onOperation })} />);

    fireEvent.contextMenu(screen.getByRole("button", { name: /Loss of cooling/i }), {
      clientX: 200,
      clientY: 120,
    });
    await user.click(screen.getByRole("menuitem", { name: "Add gate" }));

    expect(onOperation).toHaveBeenCalledTimes(1);
    expect(onOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "ADD_GATE",
        parentGateId: ROOT_GATE_ID,
        gate: expect.objectContaining({ kind: "GATE", gateType: "OR", name: "New gate" }),
      }),
    );
  });

  it("uses one basic-event action to add an existing event under a gate", async () => {
    const user = userEvent.setup();
    const onOperation = jest.fn<void, [FaultTreeOperation]>();
    render(<FaultTreeEditor {...editorProps({ onOperation })} />);

    fireEvent.contextMenu(screen.getByRole("button", { name: /Loss of cooling/i }));
    const menu = screen.getByRole("menu", { name: /Actions for Loss of cooling/i });
    await user.click(within(menu).getByRole("menuitem", { name: "Add basic event" }));
    await user.type(within(menu).getByLabelText("Search basic events"), "BE-PUMP");
    await user.click(within(menu).getByRole("menuitem", { name: "BE-PUMP" }));

    expect(onOperation).toHaveBeenCalledWith({
      type: "ADD_LEAF",
      leaf: { kind: "BASIC_EVENT_REFERENCE", basicEventId: BASIC_EVENT_ID },
      parentGateId: ROOT_GATE_ID,
    });
  });

  it("uses the same basic-event action to create and attach a new event", async () => {
    const user = userEvent.setup();
    const onOperation = jest.fn<void, [FaultTreeOperation]>();
    render(<FaultTreeEditor {...editorProps({ onOperation })} />);

    fireEvent.contextMenu(screen.getByRole("button", { name: /Loss of cooling/i }));
    const menu = screen.getByRole("menu", { name: /Actions for Loss of cooling/i });
    await user.click(within(menu).getByRole("menuitem", { name: "Add basic event" }));
    await user.click(within(menu).getByRole("menuitem", { name: "Create new basic event" }));

    expect(onOperation).toHaveBeenCalledWith(expect.objectContaining({
      type: "ADD_BASIC_EVENT",
      parentGateId: ROOT_GATE_ID,
      basicEvent: expect.objectContaining({ name: "New basic event", probability: { value: 0 } }),
    }));
  });

  it("removes K when a voting gate changes to a non-voting type", async () => {
    const user = userEvent.setup();
    const onOperation = jest.fn<void, [FaultTreeOperation]>();
    render(
      <FaultTreeEditor
        {...editorProps({
          selection: { kind: "GATE", gateId: SPARE_GATE_ID },
          onOperation,
        })}
      />,
    );

    await user.selectOptions(screen.getByLabelText("Gate type"), "OR");

    expect(onOperation).toHaveBeenCalledWith({
      type: "UPDATE_GATE",
      gateId: SPARE_GATE_ID,
      gate: {
        id: SPARE_GATE_ID,
        kind: "GATE",
        gateType: "OR",
        code: "G-B",
        name: "Standby train unavailable",
        description: "Standby logic",
      },
    });
  });

  it("removes the add-another-parent control while retaining existing connection management", () => {
    render(
      <FaultTreeEditor
        {...editorProps({
          selection: { kind: "LEAF", leafId: LEAF_ID },
        })}
      />,
    );

    expect(screen.queryByLabelText("Add another parent")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Parent gate")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Disconnect" })).toBeInTheDocument();
  });

  it("offers deletion but no authoring from a basic-event context menu", async () => {
    const user = userEvent.setup();
    const onOperation = jest.fn<void, [FaultTreeOperation]>();
    render(<FaultTreeEditor {...editorProps({ onOperation })} />);

    fireEvent.contextMenu(screen.getByRole("button", { name: /Shared pump failure/i }), {
      clientX: 170,
      clientY: 250,
    });
    const menu = screen.getByRole("menu", { name: /Actions for Shared pump failure/i });
    expect(within(menu).queryByRole("menuitem", { name: "Add gate" })).not.toBeInTheDocument();
    expect(within(menu).queryByRole("menuitem", { name: "Add basic event" })).not.toBeInTheDocument();
    expect(within(menu).queryByRole("menuitem", { name: "Add house event" })).not.toBeInTheDocument();

    await user.click(within(menu).getByRole("menuitem", { name: "Delete node" }));
    const dialog = screen.getByRole("alertdialog", { name: "Delete this fault-tree node?" });
    expect(onOperation).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole("button", { name: "Delete node" }));
    expect(onOperation).toHaveBeenCalledWith({ type: "DELETE_LEAF", leafId: LEAF_ID, subtree: true });
  });

  it("offers the same child-authoring actions from a non-top gate", () => {
    render(<FaultTreeEditor {...editorProps()} />);

    fireEvent.contextMenu(screen.getByRole("button", { name: /^AND gate Train unavailable$/i }));
    const menu = screen.getByRole("menu", { name: /Actions for Train unavailable/i });
    expect(within(menu).getByRole("menuitem", { name: "Add gate" })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: "Add basic event" })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: "Add house event" })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: "Delete node" })).toBeInTheDocument();
  });

  it("keeps the same canvas element when the inspector opens", () => {
    const rendered = render(<FaultTreeEditor {...editorProps()} />);
    const workspace = rendered.container.querySelector(".fteditor__workspace");
    const viewport = rendered.container.querySelector(".fteditor__viewport");
    const stage = rendered.container.querySelector<HTMLElement>(".fteditor__stage")!;
    const transform = stage.style.transform;

    rendered.rerender(
      <FaultTreeEditor
        {...editorProps({ selection: { kind: "LEAF", leafId: LEAF_ID } })}
      />,
    );

    expect(rendered.container.querySelector(".fteditor__workspace")).toBe(workspace);
    expect(rendered.container.querySelector(".fteditor__viewport")).toBe(viewport);
    expect(workspace).toHaveClass("fteditor__workspace--inspecting");
    expect(screen.getByLabelText("Selected fault-tree node inspector")).toBeInTheDocument();
    expect(stage.style.transform).toBe(transform);
  });

  it("uses icon-only document and canvas controls with accessible names", () => {
    render(<FaultTreeEditor {...editorProps({ capabilities: { ...authorCapabilities, canImport: true, canExport: true } })} />);

    for (const name of ["Undo", "Redo", "File", "Zoom out", "Zoom in", "Fit", "Auto layout"]) {
      const control = screen.getByRole("button", { name });
      expect(control.querySelector("svg")).toBeInTheDocument();
    }
    expect(screen.queryByText("Auto layout")).not.toBeInTheDocument();
  });

  it("emits a catalogue operation for a basic-event probability", async () => {
    const user = userEvent.setup();
    const onOperation = jest.fn<void, [FaultTreeOperation]>();
    render(
      <FaultTreeEditor
        {...editorProps({
          selection: { kind: "LEAF", leafId: LEAF_ID },
          onOperation,
        })}
      />,
    );

    const probability = screen.getByLabelText(/Probability \(0/);
    await user.clear(probability);
    await user.type(probability, "0.125");
    await user.tab();

    expect(onOperation).toHaveBeenCalledTimes(1);
    expect(onOperation).toHaveBeenCalledWith({
      type: "UPDATE_BASIC_EVENT",
      basicEventId: BASIC_EVENT_ID,
      basicEvent: {
        ...catalogue.basicEvents[0],
        probability: { value: 0.125 },
      },
    });
  });

  it("emits an automatic layout operation", async () => {
    const user = userEvent.setup();
    const onOperation = jest.fn<void, [FaultTreeOperation]>();
    render(<FaultTreeEditor {...editorProps({ onOperation })} />);

    await user.click(screen.getByRole("button", { name: "Auto layout" }));

    expect(onOperation).toHaveBeenCalledTimes(1);
    const operation = onOperation.mock.calls[0][0];
    expect(operation).toMatchObject({
      type: "SET_LAYOUT",
      layout: { mode: "AUTOMATIC", direction: "TOP_TO_BOTTOM" },
    });
    expect(operation.type === "SET_LAYOUT" ? operation.nodePositions : []).toHaveLength(4);
  });

  it("keeps authoring controls unavailable in read-only mode", async () => {
    const user = userEvent.setup();
    const onOperation = jest.fn<void, [FaultTreeOperation]>();
    const onSelectionChange = jest.fn();
    render(
      <FaultTreeEditor
        {...editorProps({
          capabilities: { ...authorCapabilities, mode: "READ_ONLY" },
          selection: { kind: "LEAF", leafId: LEAF_ID },
          onOperation,
          onSelectionChange,
        })}
      />,
    );

    expect(screen.getByText("Read only")).toBeInTheDocument();
    expect(screen.getByLabelText("Tree code")).toBeDisabled();
    expect(screen.getByLabelText("Fault-tree name")).toBeDisabled();
    expect(screen.getByLabelText("Basic event")).toBeDisabled();
    expect(screen.getByLabelText(/Probability \(0/)).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Auto layout" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Delete node/ })).not.toBeInTheDocument();

    fireEvent.contextMenu(screen.getByRole("button", { name: /Shared pump failure/i }));
    expect(screen.queryByRole("menu", { name: /Actions for/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Shared pump failure/i }));
    await user.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(onSelectionChange).toHaveBeenCalledWith({ kind: "LEAF", leafId: LEAF_ID });
    expect(onOperation).not.toHaveBeenCalled();
  });

  it("emits a stable gate target without mutating in reference-selection mode", async () => {
    const user = userEvent.setup();
    const onOperation = jest.fn<void, [FaultTreeOperation]>();
    const onSelectionChange = jest.fn();
    const onOpenReference = jest.fn();
    render(
      <FaultTreeEditor
        {...editorProps({
          capabilities: { ...authorCapabilities, mode: "REFERENCE_SELECTION" },
          onOperation,
          onSelectionChange,
          onOpenReference,
        })}
      />,
    );

    await user.click(screen.getByRole("button", { name: /Loss of cooling/i }));

    expect(onSelectionChange).toHaveBeenCalledWith({ kind: "GATE", gateId: ROOT_GATE_ID });
    expect(onOpenReference).toHaveBeenCalledWith({
      kind: "GATE",
      target: { modelId: model.modelId, entityId: ROOT_GATE_ID },
    });
    expect(onOperation).not.toHaveBeenCalled();
  });

  it("highlights affected nodes and routes validation issue selection", async () => {
    const user = userEvent.setup();
    const onSelectionChange = jest.fn();
    const issue: ValidationIssue = {
      code: "FT_BASIC_EVENT_PROBABILITY_INVALID",
      severity: "ERROR",
      message: "Enter a probability between zero and one.",
      entityId: LEAF_ID,
      fieldPath: ["leafNodes", 0],
    };
    render(
      <FaultTreeEditor
        {...editorProps({ validation: [issue], onSelectionChange })}
      />,
    );

    expect(screen.getByRole("button", { name: /Shared pump failure/i })).toHaveClass(
      "ftbox--invalid",
    );
    expect(screen.getByRole("button", { name: "Run analysis" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /Enter a probability/i }));
    expect(onSelectionChange).toHaveBeenCalledWith({ kind: "LEAF", leafId: LEAF_ID });
  });

  it("shows exact analysis results and their cut sets", () => {
    render(<FaultTreeEditor {...editorProps({ analysisResult })} />);

    const results = screen.getByLabelText("Fault-tree analysis results");
    expect(within(results).getByText(/Exact top-event probability:/)).toHaveTextContent(
      "Exact top-event probability: 2.00e-2. Minimal cut sets: 1.",
    );
    const table = within(results).getByRole("table");
    expect(within(table).getByText(BASIC_EVENT_ID)).toBeInTheDocument();
    expect(within(table).getByText("1.00e+0")).toBeInTheDocument();
    expect(within(results).queryByText(/stale/i)).not.toBeInTheDocument();
  });

  it("renders the warning details captured with a completed run", () => {
    render(
      <FaultTreeEditor
        {...editorProps({
          analysisResult: {
            ...analysisResult,
            validationIssues: [{
              code: "FT_SCREENING_ASSUMPTION",
              severity: "WARNING",
              message: "A screening probability was used for this run.",
              entityId: BASIC_EVENT_ID,
            }],
          },
        })}
      />,
    );

    const results = screen.getByLabelText("Fault-tree analysis results");
    expect(within(results).getByText(/immutable run record contains 1 validation warning/)).toBeInTheDocument();
    expect(within(results).getByText("A screening probability was used for this run.")).toBeInTheDocument();
  });

  it("makes stale results unmistakable", () => {
    render(
      <FaultTreeEditor
        {...editorProps({ analysisResult, resultIsStale: true })}
      />,
    );

    expect(screen.getByText("Results stale")).toBeInTheDocument();
    expect(screen.getByText("Results are stale")).toBeInTheDocument();
  });

  it("forwards the Run analysis intent", async () => {
    const user = userEvent.setup();
    const onRun = jest.fn();
    render(<FaultTreeEditor {...editorProps({ onRun })} />);

    await user.click(screen.getByRole("button", { name: "Run analysis" }));

    expect(onRun).toHaveBeenCalledTimes(1);
  });

  it("renders a shared DAG child once while drawing both parent connections", () => {
    const dagModel: FaultTreeEditorModel = {
      ...model,
      gates: model.gates.slice(0, 2),
      gateInputs: [
        {
          id: "99999999-9999-4999-8999-999999999991",
          gateId: ROOT_GATE_ID,
          childId: LEAF_ID,
          order: 0,
        },
        {
          id: "99999999-9999-4999-8999-999999999992",
          gateId: BRANCH_GATE_ID,
          childId: LEAF_ID,
          order: 0,
        },
      ],
      nodePositions: model.nodePositions.filter(({ nodeId }) => nodeId !== SPARE_GATE_ID),
    };
    const { container } = render(
      <FaultTreeEditor {...editorProps({ model: dagModel })} />,
    );

    expect(screen.getAllByText("Shared pump failure")).toHaveLength(1);
    expect(container.querySelectorAll(".ftbox")).toHaveLength(3);
    expect(container.querySelectorAll(".ftbox--be")).toHaveLength(1);
    expect(screen.getAllByTestId("fault-tree-edge")).toHaveLength(2);
  });
});
