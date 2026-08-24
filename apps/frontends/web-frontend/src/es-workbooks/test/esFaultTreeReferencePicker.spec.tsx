import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { EventSequenceAnalysis } from "interfaces-mef-types/es/event-sequence-analysis";
import type { FaultTreeTopEventReference } from "interfaces-mef-types/modeling";
import type { Workbook } from "interfaces-shared-types";
import { getSyWorkbook, type SyWorkbookResponse } from "../../sy-workbooks/syWorkbookApi";
import { listWorkbooks } from "../../workbooks/workbookApi";
import { EsFaultTreeReferencePicker } from "../esFaultTreeReferencePicker";
import { setFunctionalEventFaultTreeReference } from "../esFaultTreeReferences";

jest.mock("../../sy-workbooks/syWorkbookApi", () => ({
  getSyWorkbook: jest.fn(),
}));
jest.mock("../../workbooks/workbookApi", () => ({
  listWorkbooks: jest.fn(),
}));

const SOURCE_WORKBOOK_ID = "sy-workbook-1";
const MODEL_ID = "11111111-1111-4111-8111-111111111111";
const TOP_GATE_ID = "22222222-2222-4222-8222-222222222222";
const LEAF_ID = "33333333-3333-4333-8333-333333333333";
const BASIC_EVENT_ID = "44444444-4444-4444-8444-444444444444";
const INPUT_ID = "55555555-5555-4555-8555-555555555555";
const EVENT_TREE_ID = "ET-LOSS-OF-FLOW";
const FUNCTIONAL_EVENT_ID = "66666666-6666-4666-8666-666666666666";
const TARGET_MODEL_ID = "77777777-7777-4777-8777-777777777777";
const TARGET_GATE_ID = "88888888-8888-4888-8888-888888888888";
const TRANSFER_ID = "99999999-9999-4999-8999-999999999999";
const TRANSFER_INPUT_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const workbook: Workbook = {
  id: SOURCE_WORKBOOK_ID,
  projectId: "project-1",
  elementCode: "SY",
  name: "Systems analysis",
  status: "in-progress",
  version: 1,
  ownerUsername: "analyst",
  ownerFullName: "Analyst",
  ownerInitials: "A",
  createdAt: "2026-08-22T10:00:00.000Z",
  updatedAt: "2026-08-22T10:00:00.000Z",
};

const source = {
  workbookId: SOURCE_WORKBOOK_ID,
  projectId: "project-1",
  revision: 4,
  ownerUsername: "analyst",
  myRoles: [],
  hasPreviousMef: false,
  updatedAt: "2026-08-22T10:00:00.000Z",
  mef: {
    systemLogicModels: [{
      uuid: MODEL_ID,
      code: "FT-COOLING",
      name: "Cooling fault tree",
      description: "Loss of cooling",
      systemReference: "SYS-COOLING",
      modelRepresentation: "FAULT_TREE",
      topGate: { gateId: TOP_GATE_ID },
      gates: [{
        id: TOP_GATE_ID,
        code: "TOP",
        name: "Cooling top event",
        description: "Cooling fails",
        kind: "GATE",
        gateType: "OR",
      }],
      leafNodes: [{ id: LEAF_ID, kind: "BASIC_EVENT_REFERENCE", basicEventId: BASIC_EVENT_ID }],
      gateInputs: [{ id: INPUT_ID, gateId: TOP_GATE_ID, childId: LEAF_ID, order: 0 }],
      nodePositions: [],
      layout: {
        viewport: { x: 0, y: 0, zoom: 1 },
        mode: "AUTOMATIC",
        direction: "TOP_TO_BOTTOM",
      },
      implementsSrs: [],
    }],
    systemBasicEvents: [{
      uuid: BASIC_EVENT_ID,
      code: "BE-PUMP",
      name: "Pump failure",
      description: "Pump fails",
      eventType: "BASIC",
      probability: 0.01,
      implementsSrs: [],
    }],
  },
} as unknown as SyWorkbookResponse;

function minimalAnalysis(): EventSequenceAnalysis {
  return {
    eventTrees: [{
      uuid: EVENT_TREE_ID,
      name: "Loss of flow tree",
      initiatingEventId: "IE-LOSS-OF-FLOW",
      functionalEvents: {
        [FUNCTIONAL_EVENT_ID]: {
          uuid: FUNCTIONAL_EVENT_ID,
          name: "Cooling succeeds",
          order: 0,
        },
      },
      sequences: {},
      branches: {},
      initialState: { branchId: "" },
      implementsSrs: [],
    }],
  } as unknown as EventSequenceAnalysis;
}

describe("ES fault-tree references", () => {
  beforeEach(() => {
    jest.mocked(listWorkbooks).mockResolvedValue({ workbooks: [workbook] });
    jest.mocked(getSyWorkbook).mockResolvedValue(source);
  });

  it("selects the canonical top gate and returns only its stable reference", async () => {
    const user = userEvent.setup();
    const onConfirm = jest.fn<void, [FaultTreeTopEventReference]>();
    render(
      <EsFaultTreeReferencePicker
        projectId="project-1"
        functionalEventName="Cooling succeeds"
        onClose={jest.fn()}
        onConfirm={onConfirm}
      />,
    );

    expect(await screen.findByText("TOP", { selector: ".eslink__selection-summary" })).toBeInTheDocument();
    expect(screen.queryByText(TOP_GATE_ID)).not.toBeInTheDocument();
    expect(screen.queryByText("Stable workbook reference")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Link selected top event" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "Link selected top event" }));

    expect(onConfirm).toHaveBeenCalledWith({
      referenceType: "FAULT_TREE_TOP_EVENT",
      workbookId: SOURCE_WORKBOOK_ID,
      modelId: MODEL_ID,
      entityId: TOP_GATE_ID,
    });
  });

  it("links directly from the Systems Analysis source bundled with an example workbook", async () => {
    const user = userEvent.setup();
    const onConfirm = jest.fn<void, [FaultTreeTopEventReference]>();
    jest.mocked(listWorkbooks).mockClear();
    jest.mocked(getSyWorkbook).mockClear();

    render(
      <EsFaultTreeReferencePicker
        embeddedSource={{
          workbookId: "example-sy-sfr",
          workbookName: "SFR Systems Analysis example",
          mef: source.mef,
        }}
        functionalEventName="Cooling succeeds"
        onClose={jest.fn()}
        onConfirm={onConfirm}
      />,
    );

    expect(await screen.findByText("TOP", { selector: ".eslink__selection-summary" })).toBeInTheDocument();
    expect(screen.queryByText(TOP_GATE_ID)).not.toBeInTheDocument();
    expect(listWorkbooks).not.toHaveBeenCalled();
    expect(getSyWorkbook).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Link selected top event" }));
    expect(onConfirm).toHaveBeenCalledWith({
      referenceType: "FAULT_TREE_TOP_EVENT",
      workbookId: "example-sy-sfr",
      modelId: MODEL_ID,
      entityId: TOP_GATE_ID,
    });
  });

  it("uses Systems Analysis transfer labels and opens the transferred fault tree", async () => {
    const user = userEvent.setup();
    const primaryModel = source.mef.systemLogicModels[0];
    const sourceWithTransfer = {
      ...source,
      mef: {
        ...source.mef,
        systemLogicModels: [
          {
            ...primaryModel,
            leafNodes: [
              ...primaryModel.leafNodes,
              {
                id: TRANSFER_ID,
                kind: "TRANSFER_REFERENCE" as const,
                code: "TR-POWER",
                name: "Loss of power",
                description: "Open the power fault tree",
                target: { modelId: TARGET_MODEL_ID, entityId: TARGET_GATE_ID },
              },
            ],
            gateInputs: [
              ...primaryModel.gateInputs,
              { id: TRANSFER_INPUT_ID, gateId: TOP_GATE_ID, childId: TRANSFER_ID, order: 1 },
            ],
          },
          {
            ...primaryModel,
            uuid: TARGET_MODEL_ID,
            code: "FT-POWER",
            name: "Power fault tree",
            description: "Loss of power",
            systemReference: "SYS-POWER",
            topGate: { gateId: TARGET_GATE_ID },
            gates: [{
              id: TARGET_GATE_ID,
              code: "POWER-TOP",
              name: "Power unavailable",
              description: "Power is unavailable",
              kind: "GATE" as const,
              gateType: "OR" as const,
            }],
            leafNodes: [],
            gateInputs: [],
            nodePositions: [],
          },
        ],
      },
    };

    render(
      <EsFaultTreeReferencePicker
        embeddedSource={{
          workbookId: "example-sy-sfr",
          workbookName: "SFR Systems Analysis example",
          mef: sourceWithTransfer.mef,
        }}
        functionalEventName="Cooling succeeds"
        onClose={jest.fn()}
        onConfirm={jest.fn()}
      />,
    );

    const transfer = await screen.findByRole("button", { name: "Transfer Loss of power" });
    expect(transfer).toHaveTextContent("To FT-POWER");
    expect(transfer).not.toHaveTextContent(TARGET_MODEL_ID);

    await user.click(transfer);
    expect(screen.getByRole("combobox", { name: "Fault tree" })).toHaveValue(TARGET_MODEL_ID);
    expect(await screen.findByText("POWER-TOP", { selector: ".eslink__selection-summary" })).toBeInTheDocument();
  });

  it("persists and removes a reference without copying source-tree content", () => {
    const analysis = minimalAnalysis();
    const reference: FaultTreeTopEventReference = {
      referenceType: "FAULT_TREE_TOP_EVENT",
      workbookId: SOURCE_WORKBOOK_ID,
      modelId: MODEL_ID,
      entityId: TOP_GATE_ID,
    };

    const linked = setFunctionalEventFaultTreeReference(
      analysis,
      EVENT_TREE_ID,
      FUNCTIONAL_EVENT_ID,
      reference,
    );
    const stored = linked.eventTrees?.[0].functionalEvents[FUNCTIONAL_EVENT_ID].faultTreeTopEvent;

    expect(stored).toEqual(reference);
    expect(Object.keys(stored ?? {})).toEqual([
      "referenceType",
      "workbookId",
      "modelId",
      "entityId",
    ]);
    expect(stored).not.toHaveProperty("gates");
    expect(stored).not.toHaveProperty("leafNodes");
    expect(analysis.eventTrees?.[0].functionalEvents[FUNCTIONAL_EVENT_ID].faultTreeTopEvent).toBeUndefined();

    const unlinked = setFunctionalEventFaultTreeReference(
      linked,
      EVENT_TREE_ID,
      FUNCTIONAL_EVENT_ID,
      undefined,
    );
    expect(unlinked.eventTrees?.[0].functionalEvents[FUNCTIONAL_EVENT_ID].faultTreeTopEvent).toBeUndefined();
  });

  it("searches fault trees by tree, top-gate, and system metadata", async () => {
    const user = userEvent.setup();
    render(
      <EsFaultTreeReferencePicker
        projectId="project-1"
        functionalEventName="Cooling succeeds"
        onClose={jest.fn()}
        onConfirm={jest.fn()}
      />,
    );

    const search = await screen.findByRole("searchbox", { name: "Search fault trees" });
    await user.type(search, "SYS-COOLING");
    expect(screen.getByRole("option", { name: /FT-COOLING.*TOP/i })).toBeInTheDocument();
    await user.clear(search);
    await user.type(search, "does-not-exist");
    expect(screen.getByRole("option", { name: "No matching fault tree" })).toBeInTheDocument();
  });
});
