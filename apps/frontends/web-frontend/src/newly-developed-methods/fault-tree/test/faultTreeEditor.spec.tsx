import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { parameterReferenceKey, type UncertainExpression } from "interfaces-mef-types/core/uncertainty";
import type { FaultTreeAnalysisResult } from "interfaces-shared-types/newly-developed-methods/fault-tree";
import type { ValidationIssue } from "interfaces-shared-types/newly-developed-methods/shared";
import {
  FaultTreeEditor,
  applyFaultTreeOperation,
  type FaultTreeEditorCapabilities,
  type FaultTreeEditorCatalogue,
  type FaultTreeEditorModel,
  type FaultTreeEditorProps,
  type FaultTreeOperation,
  type FaultTreeSelection,
} from "../index";
import { renderFaultTreePng, type FaultTreePng } from "../faultTreeImage";
import { evaluateUncertainty } from "../../shared/uncertaintyApi";
import { praxisUncertainty, settledWithPraxis } from "../../shared/test/praxisUncertainty";

jest.mock("../faultTreeImage", () => ({ renderFaultTreePng: jest.fn() }));
jest.mock("../../shared/uncertaintyApi", () => ({ evaluateUncertainty: jest.fn() }));

beforeEach(() => {
  jest.mocked(evaluateUncertainty).mockImplementation(praxisUncertainty);
});

async function praxisSettled(): Promise<void> {
  await act(async () => {
    await settledWithPraxis(() => undefined);
  });
}

function typedProbability(value: number): UncertainExpression {
  return { node: "VALUE", value: { unit: "PROBABILITY", law: { family: "POINT", value } } };
}

function hours(value: number): UncertainExpression {
  return { node: "VALUE", value: { unit: "HOURS", law: { family: "POINT", value } } };
}

const mockedRenderPng = jest.mocked(renderFaultTreePng);

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

const ownedCatalogue: FaultTreeEditorCatalogue = {
  ...catalogue,
  basicEvents: catalogue.basicEvents.map((event) => ({ ...event, probability: { value: 0.02, expression: typedProbability(0.02) } })),
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

function StatefulEditor({ onOperation, ...overrides }: Partial<FaultTreeEditorProps> & { onOperation: (operation: FaultTreeOperation) => void }): JSX.Element {
  const [state, setState] = useState({ model: overrides.model ?? model, catalogue: overrides.catalogue ?? catalogue });
  return (
    <FaultTreeEditor
      {...editorProps({
        ...overrides,
        model: state.model,
        catalogue: state.catalogue,
        onOperation: (operation) => {
          onOperation(operation);
          setState((current) => {
            const next = applyFaultTreeOperation(current.model, current.catalogue, operation);
            return { model: next.model, catalogue: next.catalogue };
          });
        },
      })}
    />
  );
}

function stageBounds(stage: HTMLElement): { left: number; top: number; right: number; bottom: number } {
  const [translate = "", scale = ""] = stage.style.transform.split(" scale(");
  const [left = "", top = ""] = translate.slice("translate(".length, -1).split(", ");
  const zoom = parseFloat(scale);
  return {
    left: parseFloat(left),
    top: parseFloat(top),
    right: parseFloat(left) + parseFloat(stage.style.width) * zoom,
    bottom: parseFloat(top) + parseFloat(stage.style.height) * zoom,
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
  validationIssues: [],
  completedAt: "2026-08-22T12:00:00.000Z",
};

describe("FaultTreeEditor", () => {
  it("edits and displays XOR with its odd-parity meaning", async () => {
    const user = userEvent.setup();
    const props = editorProps({ selection: { kind: "GATE", gateId: ROOT_GATE_ID } });
    const rendered = render(<FaultTreeEditor {...props} />);
    await user.selectOptions(screen.getByLabelText("Gate type"), "XOR");
    expect(props.onOperation).toHaveBeenCalledWith(expect.objectContaining({
      type: "UPDATE_GATE",
      gate: expect.objectContaining({ id: ROOT_GATE_ID, gateType: "XOR" }),
    }));
    const updated = { ...model, gates: model.gates.map((gate) => gate.id === ROOT_GATE_ID
      ? { ...gate, gateType: "XOR" as const } : gate) };
    rendered.rerender(<FaultTreeEditor {...props} model={updated} />);
    expect(screen.getByLabelText("Gate type")).toHaveValue("XOR");
    expect(screen.getByText("True when an odd number of inputs are true.")).toBeInTheDocument();
    expect(rendered.container.querySelector(".ftgate--xor")).toBeInTheDocument();
  });

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

  it("shows basic-event names, codes, and probabilities without category labels", () => {
    render(<FaultTreeEditor {...editorProps()} />);

    const topGate = screen.getByRole("button", { name: /Loss of cooling/i });
    const basicEvent = screen.getByRole("button", { name: /Shared pump failure/i });
    const topGateMeta = topGate.querySelector(".ftbox__be-meta");
    const basicEventMeta = basicEvent.querySelector(".ftbox__be-meta");
    expect(within(topGate).getByText("Loss of cooling")).toHaveClass("ftbox__name");
    expect(within(topGate).getByText("TOP")).toBeInTheDocument();
    expect(topGateMeta?.firstElementChild).toHaveTextContent("TOP");
    expect(topGateMeta).toHaveClass("ftbox__be-meta--centered");
    expect(within(topGate).queryByText("OR gate")).not.toBeInTheDocument();
    expect(within(basicEvent).getByText("Shared pump failure")).toHaveClass("ftbox__name");
    expect(within(basicEvent).getByText("Shared pump failure")).toHaveAttribute("title", "Shared pump failure");
    expect(within(basicEvent).getByText("BE-PUMP")).toBeInTheDocument();
    expect(basicEventMeta?.firstElementChild).toHaveTextContent("BE-PUMP");
    expect(within(basicEvent).queryByText("FTS")).not.toBeInTheDocument();
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

  it("connects a compact basic-event stack from above and shows one circle below it", () => {
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
    const edges = screen.getAllByTestId("fault-tree-edge");
    const basicEvents = [...container.querySelectorAll<HTMLButtonElement>(".ftbox--be")];
    const tops = basicEvents.map((event) => Number.parseFloat(event.style.top));

    expect(trunks).toHaveLength(1);
    expect(edges).toHaveLength(1);
    expect(basicEvents).toHaveLength(3);
    expect(new Set(basicEvents.map((event) => event.style.left)).size).toBe(1);
    expect(tops[1] - tops[0]).toBe(70);
    expect(tops[2] - tops[1]).toBe(70);
    expect(container.querySelectorAll(".ftsym--be")).toHaveLength(1);
    expect(container.querySelectorAll(".ftbox__fm")).toHaveLength(0);
    expect(basicEvents[0]?.textContent).toContain("BE-PUMP");
    expect(basicEvents[0]?.textContent).toContain("Shared pump failure");
    expect(basicEvents[0]?.textContent).toContain("2.0e-2");
    expect(basicEvents[0]?.textContent).not.toContain("FTS");
    expect(trunks[0]).toHaveAttribute("x1", trunks[0]?.getAttribute("x2"));
    expect(edges[0]).toHaveAttribute("x1", edges[0]?.getAttribute("x2"));
    expect(edges[0]).toHaveAttribute("y2", String(tops[0]));
    expect(edges.every((edge) => edge.tagName.toLowerCase() === "line")).toBe(true);
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
    expect(screen.getByRole("button", { name: /Bypass enabled/i }).querySelector(".ftbox__be-meta")).toHaveClass("ftbox__be-meta--centered");
    expect(screen.getByRole("button", { name: /Support failure/i }).querySelector(".ftbox__be-meta")).toHaveClass("ftbox__be-meta--centered");
    expect(screen.getByRole("button", { name: /Loss of power/i })).toHaveClass("ftbox--tr");
    expect(screen.getByRole("button", { name: /Loss of power/i }).querySelector(".ftbox__be-meta")).not.toHaveClass("ftbox__be-meta--centered");
    expect(container.querySelector(".ftsym--be")).toBeInTheDocument();
    expect(container.querySelector(".ftsym--house")).toBeInTheDocument();
    expect(container.querySelector(".ftsym--undeveloped")).toBeInTheDocument();
    expect(container.querySelector(".ftsym--tr")).toBeInTheDocument();
    expect(screen.getAllByTestId("fault-tree-edge")).toHaveLength(4);
    expect(container.querySelector('line[data-edge-id="ffffffff-ffff-4fff-8fff-fffffffffff3"]')).toBeInTheDocument();
  });

  it("stacks undeveloped events while keeping house events separate", () => {
    const undevelopedIds = ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2"];
    const houseIds = ["bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1", "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2"];
    const leafNodes: FaultTreeEditorModel["leafNodes"] = [
      model.leafNodes[0],
      ...undevelopedIds.map((id, index) => ({
        id,
        kind: "UNDEVELOPED_EVENT" as const,
        code: `UE-${index + 1}`,
        name: `Undeveloped ${index + 1}`,
        description: "",
      })),
      ...houseIds.map((id, index) => ({
        id,
        kind: "HOUSE_EVENT" as const,
        code: `HE-${index + 1}`,
        name: `House ${index + 1}`,
        description: "",
        state: true,
      })),
    ];
    const mixedModel: FaultTreeEditorModel = {
      ...model,
      gates: [model.gates[0]],
      leafNodes,
      gateInputs: leafNodes.map(({ id }, order) => ({
        id: `cccccccc-cccc-4ccc-8ccc-ccccccccccc${order}`,
        gateId: ROOT_GATE_ID,
        childId: id,
        order,
      })),
      nodePositions: [],
      layout: { ...model.layout, mode: "AUTOMATIC", direction: "TOP_TO_BOTTOM" },
    };
    const { container } = render(<FaultTreeEditor {...editorProps({ model: mixedModel })} />);
    const undeveloped = [...container.querySelectorAll<HTMLButtonElement>(".ftbox--undeveloped")];
    const houses = [...container.querySelectorAll<HTMLButtonElement>(".ftbox--house")];

    expect(undeveloped).toHaveLength(2);
    expect(undeveloped[0].style.left).toBe(undeveloped[1].style.left);
    expect(Number.parseFloat(undeveloped[1].style.top) - Number.parseFloat(undeveloped[0].style.top)).toBe(70);
    expect(container.querySelectorAll(".ftsym--undeveloped")).toHaveLength(1);
    expect(houses).toHaveLength(2);
    expect(houses[0].style.left).not.toBe(houses[1].style.left);
    expect(container.querySelectorAll(".ftsym--house")).toHaveLength(2);
    expect(screen.getAllByTestId("fault-tree-edge")).toHaveLength(4);
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
      basicEvent: expect.objectContaining({ name: "New basic event", probability: { value: 1e-3, expression: typedProbability(1e-3) } }),
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

  it("shows node actions on the left that follow the selected node", async () => {
    const user = userEvent.setup();
    const onOperation = jest.fn<void, [FaultTreeOperation]>();
    const { rerender } = render(<FaultTreeEditor {...editorProps({ onOperation })} />);

    const rail = screen.getByRole("complementary", { name: "Fault-tree node actions" });
    expect(within(rail).getByRole("button", { name: "Add gate" })).toBeDisabled();
    expect(within(rail).getByRole("button", { name: "Add basic event" })).toBeDisabled();
    expect(within(rail).getByRole("button", { name: "Delete node" })).toBeDisabled();
    expect(within(rail).getByText("Select a gate to add inputs to it.")).toBeInTheDocument();

    rerender(<FaultTreeEditor {...editorProps({ onOperation, selection: { kind: "GATE", gateId: ROOT_GATE_ID } })} />);
    const gateRail = screen.getByRole("complementary", { name: "Fault-tree node actions" });
    expect(within(gateRail).getByText("Add under TOP")).toBeInTheDocument();
    expect(within(gateRail).getByRole("button", { name: "Add transfer" })).toBeDisabled();
    expect(within(gateRail).getByText("Add transfer needs another fault tree to point to.")).toBeInTheDocument();

    await user.click(within(gateRail).getByRole("button", { name: "Add gate" }));
    expect(onOperation).toHaveBeenLastCalledWith(expect.objectContaining({ type: "ADD_GATE", parentGateId: ROOT_GATE_ID }));
    await user.click(within(gateRail).getByRole("button", { name: "Add house event" }));
    expect(onOperation).toHaveBeenLastCalledWith(expect.objectContaining({
      type: "ADD_LEAF",
      parentGateId: ROOT_GATE_ID,
      leaf: expect.objectContaining({ kind: "HOUSE_EVENT" }),
    }));
  });

  it("adds an existing basic event from the actions column", async () => {
    const user = userEvent.setup();
    const onOperation = jest.fn<void, [FaultTreeOperation]>();
    render(<FaultTreeEditor {...editorProps({ onOperation, selection: { kind: "GATE", gateId: ROOT_GATE_ID } })} />);

    const rail = screen.getByRole("complementary", { name: "Fault-tree node actions" });
    await user.click(within(rail).getByRole("button", { name: "Add basic event" }));
    await user.type(within(rail).getByLabelText("Search basic events"), "PUMP");
    await user.click(within(rail).getByRole("button", { name: "BE-PUMP" }));

    expect(onOperation).toHaveBeenCalledWith({
      type: "ADD_LEAF",
      leaf: { kind: "BASIC_EVENT_REFERENCE", basicEventId: BASIC_EVENT_ID },
      parentGateId: ROOT_GATE_ID,
    });
    expect(within(rail).getByRole("button", { name: "Add gate" })).toBeEnabled();
  });

  it("adds a transfer from the actions column when another fault tree exists", async () => {
    const user = userEvent.setup();
    const onOperation = jest.fn<void, [FaultTreeOperation]>();
    const target = { modelId: "99999999-9999-4999-8999-999999999999", entityId: "99999999-9999-4999-8999-999999999998" };
    render(<FaultTreeEditor {...editorProps({
      onOperation,
      selection: { kind: "GATE", gateId: ROOT_GATE_ID },
      transferTargets: [{ target, code: "FT-POWER", name: "Loss of power" }],
    })} />);

    const rail = screen.getByRole("complementary", { name: "Fault-tree node actions" });
    expect(within(rail).queryByText("Add transfer needs another fault tree to point to.")).not.toBeInTheDocument();
    await user.click(within(rail).getByRole("button", { name: "Add transfer" }));
    expect(onOperation).toHaveBeenCalledWith(expect.objectContaining({
      type: "ADD_LEAF",
      parentGateId: ROOT_GATE_ID,
      leaf: expect.objectContaining({ kind: "TRANSFER_REFERENCE", target }),
    }));
  });

  it("only deletes a selected event from the actions column", async () => {
    const user = userEvent.setup();
    const onOperation = jest.fn<void, [FaultTreeOperation]>();
    render(<FaultTreeEditor {...editorProps({ onOperation, selection: { kind: "LEAF", leafId: LEAF_ID } })} />);

    const rail = screen.getByRole("complementary", { name: "Fault-tree node actions" });
    expect(within(rail).getByRole("button", { name: "Add gate" })).toBeDisabled();
    expect(within(rail).getByRole("button", { name: "Add house event" })).toBeDisabled();
    expect(within(rail).getByText("Only gates take inputs.")).toBeInTheDocument();

    await user.click(within(rail).getByRole("button", { name: "Delete node" }));
    const dialog = screen.getByRole("alertdialog", { name: "Delete this fault-tree node?" });
    expect(onOperation).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole("button", { name: "Delete node" }));
    expect(onOperation).toHaveBeenCalledWith({ type: "DELETE_LEAF", leafId: LEAF_ID, subtree: true });
  });

  it("keeps a NOT gate that already has its input from taking another", () => {
    const notModel: FaultTreeEditorModel = {
      ...model,
      gates: [
        model.gates[0]!,
        { id: BRANCH_GATE_ID, kind: "GATE", gateType: "NOT", code: "G-A", name: "Train unavailable", description: "Train logic" },
        model.gates[2]!,
      ],
    };
    render(<FaultTreeEditor {...editorProps({ model: notModel, selection: { kind: "GATE", gateId: BRANCH_GATE_ID } })} />);

    const rail = screen.getByRole("complementary", { name: "Fault-tree node actions" });
    expect(within(rail).getByRole("button", { name: "Add gate" })).toBeDisabled();
    expect(within(rail).getByRole("button", { name: "Add basic event" })).toBeDisabled();
    expect(within(rail).getByText("This NOT gate already has its single input.")).toBeInTheDocument();
    expect(within(rail).getByRole("button", { name: "Delete node" })).toBeEnabled();
  });

  it("creates the top gate from the actions column in an empty fault tree", async () => {
    const user = userEvent.setup();
    const onOperation = jest.fn<void, [FaultTreeOperation]>();
    const empty: FaultTreeEditorModel = { ...model, topGate: null, gates: [], leafNodes: [], gateInputs: [], nodePositions: [] };
    render(<FaultTreeEditor {...editorProps({ model: empty, onOperation })} />);

    const rail = screen.getByRole("complementary", { name: "Fault-tree node actions" });
    expect(within(rail).getByText("Add gate creates the top gate.")).toBeInTheDocument();
    await user.click(within(rail).getByRole("button", { name: "Add gate" }));
    expect(onOperation).toHaveBeenCalledWith(expect.objectContaining({ type: "ADD_GATE", parentGateId: undefined, setAsTopGate: true }));
  });

  it("hides the actions column outside authoring", () => {
    render(<FaultTreeEditor {...editorProps({ capabilities: { ...authorCapabilities, mode: "READ_ONLY" } })} />);
    expect(screen.queryByRole("complementary", { name: "Fault-tree node actions" })).not.toBeInTheDocument();
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

  it("keeps the same canvas element and refits its contents when the inspector opens", () => {
    const rendered = render(<FaultTreeEditor {...editorProps()} />);
    const workspace = rendered.container.querySelector(".fteditor__workspace");
    const viewport = rendered.container.querySelector<HTMLElement>(".fteditor__viewport")!;
    const stage = rendered.container.querySelector<HTMLElement>(".fteditor__stage")!;
    const transform = stage.style.transform;
    Object.defineProperties(viewport, {
      clientWidth: { configurable: true, value: 960 },
      clientHeight: { configurable: true, value: 680 },
    });

    rendered.rerender(
      <FaultTreeEditor
        {...editorProps({ selection: { kind: "LEAF", leafId: LEAF_ID } })}
      />,
    );

    expect(rendered.container.querySelector(".fteditor__workspace")).toBe(workspace);
    expect(rendered.container.querySelector(".fteditor__viewport")).toBe(viewport);
    expect(workspace).toHaveClass("fteditor__workspace--inspecting");
    expect(screen.getByLabelText("Selected fault-tree node inspector")).toBeInTheDocument();
    expect(stage.style.transform).not.toBe(transform);
    expect(screen.getByLabelText("Zoom level")).not.toHaveTextContent("100%");
  });

  it("fits the whole tree beside the inspector after a node is added", async () => {
    const user = userEvent.setup();
    const onOperation = jest.fn<void, [FaultTreeOperation]>();
    const selection: FaultTreeSelection = { kind: "GATE", gateId: ROOT_GATE_ID };
    const automatic: FaultTreeEditorModel = { ...model, layout: { ...model.layout, mode: "AUTOMATIC" } };
    const rendered = render(<FaultTreeEditor {...editorProps({ model: automatic, onOperation })} />);
    const viewport = rendered.container.querySelector<HTMLElement>(".fteditor__viewport")!;
    Object.defineProperties(viewport, {
      clientWidth: { configurable: true, value: 960 },
      clientHeight: { configurable: true, value: 680 },
    });
    rendered.rerender(<FaultTreeEditor {...editorProps({ model: automatic, onOperation, selection })} />);

    const rail = screen.getByRole("complementary", { name: "Fault-tree node actions" });
    await user.click(within(rail).getByRole("button", { name: "Add gate" }));
    const added = applyFaultTreeOperation(automatic, catalogue, onOperation.mock.calls[0]![0]);
    rendered.rerender(<FaultTreeEditor {...editorProps({ model: added.model, catalogue: added.catalogue, onOperation, selection })} />);

    const bounds = stageBounds(rendered.container.querySelector<HTMLElement>(".fteditor__stage")!);
    expect(bounds.left).toBeGreaterThanOrEqual(0);
    expect(bounds.top).toBeGreaterThanOrEqual(0);
    expect(bounds.right).toBeLessThanOrEqual(960 - 320);
    expect(bounds.bottom).toBeLessThanOrEqual(680);
  });

  it("keeps the current view when only a node's details change", async () => {
    const user = userEvent.setup();
    const selection: FaultTreeSelection = { kind: "GATE", gateId: ROOT_GATE_ID };
    const rendered = render(<FaultTreeEditor {...editorProps({ selection })} />);
    const viewport = rendered.container.querySelector<HTMLElement>(".fteditor__viewport")!;
    Object.defineProperties(viewport, {
      clientWidth: { configurable: true, value: 960 },
      clientHeight: { configurable: true, value: 680 },
    });
    await user.click(screen.getByRole("button", { name: "Zoom in" }));
    const stage = rendered.container.querySelector<HTMLElement>(".fteditor__stage")!;
    const zoomed = stage.style.transform;

    const renamed: FaultTreeEditorModel = {
      ...model,
      gates: model.gates.map((gate) => gate.id === ROOT_GATE_ID ? { ...gate, name: "Loss of all cooling" } : gate),
    };
    rendered.rerender(<FaultTreeEditor {...editorProps({ model: renamed, selection })} />);

    expect(stage.style.transform).toBe(zoomed);
  });

  it("zooms below the usual floor when only that fits the tree beside the inspector", async () => {
    const user = userEvent.setup();
    const selection: FaultTreeSelection = { kind: "GATE", gateId: ROOT_GATE_ID };
    const rendered = render(<FaultTreeEditor {...editorProps()} />);
    const viewport = rendered.container.querySelector<HTMLElement>(".fteditor__viewport")!;
    Object.defineProperties(viewport, {
      clientWidth: { configurable: true, value: 440 },
      clientHeight: { configurable: true, value: 680 },
    });
    rendered.rerender(<FaultTreeEditor {...editorProps({ selection })} />);

    const bounds = stageBounds(rendered.container.querySelector<HTMLElement>(".fteditor__stage")!);
    expect(bounds.left).toBeGreaterThanOrEqual(0);
    expect(bounds.right).toBeLessThanOrEqual(440 - 320);
    const fittedZoom = screen.getByLabelText("Zoom level").textContent;

    await user.click(screen.getByRole("button", { name: "Zoom out" }));
    expect(screen.getByLabelText("Zoom level").textContent).toBe(fittedZoom);
  });

  it("uses icon-only document and canvas controls with accessible names", () => {
    render(<FaultTreeEditor {...editorProps({ capabilities: { ...authorCapabilities, canImport: true, canExport: true } })} />);

    for (const name of ["Undo", "Redo", "File", "Zoom out", "Zoom in", "Fit", "Auto layout"]) {
      const control = screen.getByRole("button", { name });
      expect(control.querySelector("svg")).toBeInTheDocument();
    }
    expect(screen.queryByText("Auto layout")).not.toBeInTheDocument();
  });

  it("offers a high-resolution PNG in read-only views too", async () => {
    const user = userEvent.setup();
    render(<FaultTreeEditor {...editorProps({ capabilities: { ...authorCapabilities, mode: "READ_ONLY", canImport: false, canExport: false } })} />);

    await user.click(screen.getByRole("button", { name: "File" }));
    expect(screen.getByRole("button", { name: "Export high-resolution PNG" })).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Export OpenPSA XML" })).not.toBeInTheDocument();
  });

  it("leaves the PNG out of reference selection and empty trees", () => {
    const { unmount } = render(<FaultTreeEditor {...editorProps({ capabilities: { ...authorCapabilities, mode: "REFERENCE_SELECTION", canImport: false, canExport: false } })} />);
    expect(screen.queryByRole("button", { name: "File" })).not.toBeInTheDocument();
    unmount();

    const empty: FaultTreeEditorModel = { ...model, topGate: null, gates: [], leafNodes: [], gateInputs: [], nodePositions: [] };
    render(<FaultTreeEditor {...editorProps({ model: empty })} />);
    expect(screen.getByRole("button", { name: "Export high-resolution PNG" })).toBeDisabled();
  });

  it("saves the PNG of the drawn tree and reports its size", async () => {
    const user = userEvent.setup();
    let finish: (png: FaultTreePng) => void = () => undefined;
    mockedRenderPng.mockReturnValue(new Promise((resolve) => { finish = resolve; }));
    const createObjectURL = jest.fn(() => "blob:fault-tree");
    const revokeObjectURL = jest.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    const saved: string[] = [];
    const click = jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      saved.push(this.download);
    });
    const { container } = render(<FaultTreeEditor {...editorProps({ selection: { kind: "GATE", gateId: ROOT_GATE_ID } })} />);

    await user.click(screen.getByRole("button", { name: "File" }));
    await user.click(screen.getByRole("button", { name: "Export high-resolution PNG" }));
    expect(mockedRenderPng).toHaveBeenCalledWith(container.querySelector(".ftcanvas"), 24);
    expect(screen.getByText("Preparing the PNG…")).toHaveAttribute("role", "status");
    expect(screen.getByRole("button", { name: "Export high-resolution PNG" })).toBeDisabled();

    finish({ blob: new Blob(["png"], { type: "image/png" }), width: 20018, height: 13172, dotsPerInch: 1921.7 });
    expect(await screen.findByText("FT-COOLING.png: 20,018 × 13,172 px at 1,922 dpi")).toBeInTheDocument();
    expect(saved).toEqual(["FT-COOLING.png"]);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:fault-tree");
    click.mockRestore();
  });

  it("explains when the browser cannot make the PNG", async () => {
    const user = userEvent.setup();
    mockedRenderPng.mockRejectedValue(new Error("This browser could not create a canvas for the image."));
    render(<FaultTreeEditor {...editorProps()} />);

    await user.click(screen.getByRole("button", { name: "File" }));
    await user.click(screen.getByRole("button", { name: "Export high-resolution PNG" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("This browser could not create a canvas for the image.");
    expect(screen.getByRole("button", { name: "Export high-resolution PNG" })).toBeEnabled();
  });

  it("saves a typed value with its PRAXIS point once PRAXIS answers", async () => {
    const onOperation = jest.fn<void, [FaultTreeOperation]>();
    render(<FaultTreeEditor {...editorProps({ catalogue: ownedCatalogue, selection: { kind: "LEAF", leafId: LEAF_ID }, onOperation })} />);
    await praxisSettled();

    const value = within(screen.getByRole("group", { name: "Value" })).getByLabelText("Value");
    fireEvent.focus(value);
    fireEvent.change(value, { target: { value: "0.125" } });
    fireEvent.blur(value);
    expect(onOperation).not.toHaveBeenCalled();
    await praxisSettled();

    expect(onOperation).toHaveBeenCalledTimes(1);
    expect(onOperation).toHaveBeenCalledWith({
      type: "UPDATE_BASIC_EVENT",
      basicEventId: BASIC_EVENT_ID,
      basicEvent: { ...ownedCatalogue.basicEvents[0], probability: { value: 0.125, expression: typedProbability(0.125) } },
    });
  });

  it("models a failure rate over the host's mission time and stores the PRAXIS point", async () => {
    const onOperation = jest.fn<void, [FaultTreeOperation]>();
    render(<FaultTreeEditor {...editorProps({ catalogue: ownedCatalogue, selection: { kind: "LEAF", leafId: LEAF_ID }, defaultMissionTime: hours(72), onOperation })} />);

    fireEvent.change(screen.getByLabelText("Form"), { target: { value: "MISSION" } });
    await praxisSettled();

    const operation = onOperation.mock.calls[0]?.[0];
    expect(operation?.type).toBe("UPDATE_BASIC_EVENT");
    if (operation?.type !== "UPDATE_BASIC_EVENT") throw new Error("Expected a basic-event update");
    expect(operation.basicEvent.probability.expression).toEqual({ node: "MODEL", model: { form: "MISSION", rate: { node: "VALUE", value: { unit: "PER_HOUR", law: { family: "POINT", value: 1e-5 } } }, missionTime: hours(72) } });
    expect(operation.basicEvent.probability.value).toBeCloseTo(-Math.expm1(-1e-5 * 72), 15);
    expect(operation.basicEvent.probability).not.toHaveProperty("quantificationBasis");
  });

  it("saves a lognormal probability with its PRAXIS point", async () => {
    const onOperation = jest.fn<void, [FaultTreeOperation]>();
    render(<FaultTreeEditor {...editorProps({ catalogue: ownedCatalogue, selection: { kind: "LEAF", leafId: LEAF_ID }, onOperation })} />);

    fireEvent.change(screen.getByLabelText("Law"), { target: { value: "LOGNORMAL" } });
    await praxisSettled();

    expect(screen.queryByRole("alert")).toBeNull();
    const operation = onOperation.mock.calls[0]?.[0];
    if (operation?.type !== "UPDATE_BASIC_EVENT") throw new Error("Expected a basic-event update");
    const expression = operation.basicEvent.probability.expression;
    if (expression?.node !== "VALUE" || expression.value.law.family !== "LOGNORMAL") throw new Error("Expected a lognormal value");
    expect(operation.basicEvent.probability.value).toBeCloseTo(expression.value.law.mean, 12);
  });

  it("keeps a value PRAXIS rejects out of the record and says why", async () => {
    const onOperation = jest.fn<void, [FaultTreeOperation]>();
    render(<FaultTreeEditor {...editorProps({ catalogue: ownedCatalogue, selection: { kind: "LEAF", leafId: LEAF_ID }, onOperation })} />);

    const value = screen.getByLabelText("Value");
    fireEvent.change(value, { target: { value: "1.5" } });
    fireEvent.blur(value);
    await praxisSettled();

    expect(screen.getByRole("alert")).toHaveTextContent("Not saved.");
    expect(screen.getByRole("alert")).toHaveTextContent("outside [0, 1]");
    expect(onOperation).not.toHaveBeenCalled();
  });

  it("shows the PRAXIS point of each expression on the canvas, not the stored number", async () => {
    const mission: UncertainExpression = { node: "MODEL", model: { form: "MISSION", rate: { node: "VALUE", value: { unit: "PER_HOUR", law: { family: "GAMMA", shape: 2, rate: 2e5 } } }, missionTime: hours(24) } };
    const stale: FaultTreeEditorCatalogue = { ...ownedCatalogue, basicEvents: [{ ...ownedCatalogue.basicEvents[0], probability: { value: 0.5, expression: mission } }] };
    render(<FaultTreeEditor {...editorProps({ catalogue: stale })} />);
    const basicEvent = screen.getByRole("button", { name: /Shared pump failure/i });

    expect(within(basicEvent).getByText("…")).toBeInTheDocument();
    await praxisSettled();
    expect(within(basicEvent).getByText("2.4e-4")).toBeInTheDocument();
    expect(within(basicEvent).queryByText("5.0e-1")).not.toBeInTheDocument();
  });

  it("links DA and SC values through the host's options and parameter table", async () => {
    const onOperation = jest.fn<void, [FaultTreeOperation]>();
    const rate = { referenceType: "WORKBOOK_PARAMETER" as const, workbookId: "da-1", entityId: "rate-1" };
    const time = { referenceType: "WORKBOOK_PARAMETER" as const, workbookId: "sc-1", entityId: "MT-1" };
    const parameterTable = new Map([
      [parameterReferenceKey(rate), { reference: rate, expression: { node: "VALUE" as const, value: { unit: "PER_HOUR" as const, law: { family: "POINT" as const, value: 2e-5 } } } }],
      [parameterReferenceKey(time), { reference: time, expression: hours(48) }],
    ]);
    render(<StatefulEditor {...{
      catalogue: ownedCatalogue,
      selection: { kind: "LEAF", leafId: LEAF_ID },
      daParameterOptions: [{ reference: rate, label: "DA · Pump fails to run", unit: "PER_HOUR" }],
      missionTimeOptions: [{ reference: time, label: "MT-1 · sequence ES-1", unit: "HOURS" }],
      parameterTable,
      onOperation,
    }} />);

    fireEvent.change(screen.getByLabelText("Form"), { target: { value: "MISSION" } });
    await praxisSettled();
    const [rateSlot, timeSlot] = screen.getAllByLabelText("Source");
    fireEvent.change(rateSlot!, { target: { value: parameterReferenceKey(rate) } });
    await praxisSettled();
    fireEvent.change(timeSlot!, { target: { value: parameterReferenceKey(time) } });
    await praxisSettled();

    const last = onOperation.mock.calls.at(-1)?.[0];
    if (last?.type !== "UPDATE_BASIC_EVENT") throw new Error("Expected a basic-event update");
    expect(last.basicEvent.probability.expression).toEqual({ node: "MODEL", model: { form: "MISSION", rate: { node: "PARAMETER", reference: rate }, missionTime: { node: "PARAMETER", reference: time } } });
    expect(last.basicEvent.probability.value).toBeCloseTo(-Math.expm1(-2e-5 * 48), 15);
  });

  it("offers an older stored value as a typed value and saves it without the old fields", async () => {
    const onOperation = jest.fn<void, [FaultTreeOperation]>();
    const rateCatalogue: FaultTreeEditorCatalogue = { ...catalogue, basicEvents: [{ ...catalogue.basicEvents[0], probability: {
      value: 0.0004798848184297544,
      quantificationBasis: { kind: "FAILURE_RATE", failureRate: { value: 2e-5, unit: "HOUR" }, missionTime: { value: 1, unit: "DAY" }, conversion: "EXPONENTIAL" },
    } }] };
    render(<FaultTreeEditor {...editorProps({ catalogue: rateCatalogue, selection: { kind: "LEAF", leafId: LEAF_ID }, onOperation })} />);

    expect(screen.getByLabelText("Form")).toHaveValue("MISSION");
    fireEvent.click(screen.getByRole("button", { name: "Save this value" }));
    await praxisSettled();

    expect(onOperation).toHaveBeenCalledWith(expect.objectContaining({ basicEvent: expect.objectContaining({ probability: {
      value: expect.closeTo(-Math.expm1(-2e-5 * 24), 15),
      expression: { node: "MODEL", model: { form: "MISSION", rate: { node: "VALUE", value: { unit: "PER_HOUR", law: { family: "POINT", value: 2e-5 } } }, missionTime: hours(24) } },
    } }) }));
  });

  it("asks for a review of a saved linear conversion before it is used", () => {
    const onOperation = jest.fn();
    const legacyCatalogue: FaultTreeEditorCatalogue = { ...catalogue, basicEvents: [{ ...catalogue.basicEvents[0], probability: {
      value: .1, quantificationBasis: { kind: "FAILURE_RATE", conversion: "LINEAR",
        failureRate: { value: .001, unit: "HOUR" }, missionTime: { value: 100, unit: "HOUR" } },
    } }] };
    render(<FaultTreeEditor {...editorProps({ catalogue: legacyCatalogue, selection: { kind: "LEAF", leafId: LEAF_ID }, onOperation })} />);

    expect(screen.getByRole("alert")).toHaveTextContent("Review the rate and mission time");
    expect(screen.getByLabelText("Form")).toHaveValue("MISSION");
    expect(screen.queryByLabelText("Basic-event quantification input")).not.toBeInTheDocument();
    expect(onOperation).not.toHaveBeenCalled();
  });

  it("shows a host-owned basic-event value without letting it change in place", async () => {
    const user = userEvent.setup();
    const onOperation = jest.fn<void, [FaultTreeOperation]>();
    const onOpenReference = jest.fn();
    render(
      <FaultTreeEditor
        {...editorProps({
          selection: { kind: "BASIC_EVENT", basicEventId: BASIC_EVENT_ID },
          readOnlyBasicEventValues: { [BASIC_EVENT_ID]: "Mission: rate Pump fails to run over 24 hours" },
          onOperation,
          onOpenReference,
        })}
      />,
    );

    expect(screen.getByText("Mission: rate Pump fails to run over 24 hours")).toBeInTheDocument();
    expect(screen.queryByLabelText("Probability (0–1)")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Basic-event quantification input")).not.toBeInTheDocument();
    expect(screen.getByText("Point value 2.0e-2. Edit the value in the basic event window.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Open basic event" }));
    expect(onOpenReference).toHaveBeenCalledWith({ kind: "BASIC_EVENT", basicEventId: BASIC_EVENT_ID });
    expect(onOperation).not.toHaveBeenCalled();
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
    expect(within(screen.getByRole("group", { name: "Value" })).getByLabelText("Value")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Save this value" })).not.toBeInTheDocument();
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

  it("shows exact probability without cut-set results", () => {
    render(<FaultTreeEditor {...editorProps({ analysisResult })} />);

    const results = screen.getByLabelText("Fault-tree analysis results");
    const probabilityMetric = within(results).getByText("Exact top-event probability").parentElement!;
    expect(within(probabilityMetric).getByLabelText("2.00 times 10 to the power of −2")).toBeInTheDocument();
    expect(within(results).queryByText(/workbook revision/)).not.toBeInTheDocument();
    expect(within(results).queryByText(/cut sets/i)).not.toBeInTheDocument();
    expect(within(results).queryByRole("table")).not.toBeInTheDocument();
    expect(within(results).queryByText(/stale/i)).not.toBeInTheDocument();
  });

  it("names the Direct Monte Carlo top-event probability", () => {
    render(<FaultTreeEditor {...editorProps({ analysisResult: { ...analysisResult, calculationType: "PROBABILITY", algorithm: "MONTE_CARLO", probabilityMethod: "MONTE_CARLO" } })} />);

    const results = screen.getByLabelText("Fault-tree analysis results");
    expect(within(results).getByText("Direct Monte Carlo top-event probability")).toBeInTheDocument();
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

  it("shows cut sets, importance, uncertainty, Monte Carlo, and SIL result sections", () => {
    render(<FaultTreeEditor {...editorProps({ analysisResult: {
      ...analysisResult,
      calculationType: "PROBABILITY_AND_CUT_SETS",
      workflow: "MANUAL",
      algorithm: "ZBDD",
      probabilityMethod: "EXACT",
      cutSets: {
        primeImplicants: false,
        count: 1,
        distributionByOrder: [0, 1],
        items: [{ order: 1, probability: 0.02, literals: [{ basicEventId: BASIC_EVENT_ID, negated: false }] }],
      },
      importance: [{
        basicEventId: BASIC_EVENT_ID,
        birnbaum: 0.5,
        criticality: 0.25,
        fussellVesely: 0.4,
        riskAchievementWorth: 2,
        riskReductionWorth: 1.5,
      }],
      uncertainty: {
        mean: 0.02,
        standardDeviation: 0.001,
        standardError: 0.00003,
        quantiles: [{ probability: 0.5, value: 0.02 }],
        samples: [0.019, 0.021],
        sampleCount: 1_000,
        seed: 847,
        samplingMethod: "LATIN_HYPERCUBE",
      },
      monteCarlo: {
        trials: 1_000,
        successes: 20,
        standardDeviation: 0.004,
        confidenceInterval: { lower: 0.012, upper: 0.028, confidence: 0.95 },
        seed: 847,
      },
      sil: {
        probabilityOfFailureOnDemand: 0.02,
        dangerousFailureRatePerHour: 2.3e-6,
        pfdLevel: "SIL_1",
        pfhLevel: "SIL_1",
      },
    } })} />);

    const cutSets = screen.getByRole("region", { name: "Cut sets" });
    expect(cutSets).toBeInTheDocument();
    expect(within(cutSets).getByText("BE-PUMP")).toBeInTheDocument();
    expect(within(cutSets).queryByText(BASIC_EVENT_ID)).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Importance measures" })).toBeInTheDocument();
    const uncertainty = screen.getByRole("region", { name: "Uncertainty results" });
    expect(within(uncertainty).getByText("1,000 Latin hypercube samples · seed 847 · standard deviation 1.000E-3 · standard error of the mean 3.000E-5")).toBeInTheDocument();
    expect(within(uncertainty).getByRole("img", { name: "Distribution of the sampled top event probability on a log scale, marked at the 5th percentile, median, mean, 95th percentile and point estimate" })).toBeInTheDocument();
    expect(within(uncertainty).getByRole("status")).toHaveTextContent("The chart draws the 2 stored samples of 1,000.");
    expect(within(within(uncertainty).getByRole("table", { name: "Summary values" })).getAllByRole("cell").map((cell) => cell.textContent)).toEqual(["2.000E-2", "Not given", "2.000E-2", "2.000E-2", "Not given"]);
    fireEvent.click(within(uncertainty).getByRole("button", { name: "Cumulative" }));
    expect(within(uncertainty).getByRole("img", { name: "Cumulative share of samples against the top event probability on a log scale, marked at the 5th percentile, median, mean, 95th percentile and point estimate" })).toBeInTheDocument();
    expect(within(uncertainty).queryByText("Error factor")).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Direct Monte Carlo diagnostics" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "SIL results" })).toBeInTheDocument();
  });

  it("paginates cut sets while retaining basic-event codes", async () => {
    const user = userEvent.setup();
    render(<FaultTreeEditor {...editorProps({ analysisResult: {
      ...analysisResult,
      calculationType: "CUT_SETS",
      workflow: "MANUAL",
      algorithm: "ZBDD",
      probabilityMethod: "EXACT",
      cutSets: {
        primeImplicants: false,
        count: 26,
        distributionByOrder: [0, 26],
        items: Array.from({ length: 26 }, (_, index) => ({
          order: 1,
          probability: 0.02 + index * 1e-8,
          literals: [{ basicEventId: BASIC_EVENT_ID, negated: false }],
        })),
      },
    } })} />);

    const pagination = screen.getByRole("navigation", { name: "Fault-tree cut sets pagination" });
    expect(within(pagination).getByText("Page 1 of 2")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Cut sets" })).getAllByText("BE-PUMP")).toHaveLength(25);
    await user.click(within(pagination).getByRole("button", { name: "Next" }));
    expect(within(pagination).getByText("Page 2 of 2")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Cut sets" })).getAllByText("BE-PUMP")).toHaveLength(1);
  });

  it("hides header status when the host shows save state elsewhere", () => {
    render(<FaultTreeEditor {...editorProps({ showHeaderStatus: false })} />);

    expect(screen.queryByText("Authoring")).not.toBeInTheDocument();
    expect(screen.queryByText("Saved")).not.toBeInTheDocument();
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

    expect(screen.getAllByRole("button", { name: "Shared pump failure" })).toHaveLength(1);
    expect(container.querySelectorAll(".ftbox")).toHaveLength(3);
    expect(container.querySelectorAll(".ftbox--be")).toHaveLength(1);
    expect(screen.getAllByTestId("fault-tree-edge")).toHaveLength(2);
  });
});
