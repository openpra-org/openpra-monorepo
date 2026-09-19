import type { EventTree } from "interfaces-mef-types/es/event-sequence-analysis";
import { EventTreeSchema } from "interfaces-mef-types/zod/es/event-sequence-analysis";

const FUNCTIONAL_EVENT_ID = "123e4567-e89b-42d3-a456-426614174001";
const FAULT_TREE_MODEL_ID = "123e4567-e89b-42d3-a456-426614174002";
const TOP_EVENT_ID = "123e4567-e89b-42d3-a456-426614174003";
const PARAMETER_ID = "123e4567-e89b-42d3-a456-426614174004";
const SUCCESS_END_STATE_ID = "123e4567-e89b-42d3-a456-426614174005";
const RELEASE_END_STATE_ID = "123e4567-e89b-42d3-a456-426614174006";

const eventTree = (): EventTree => ({
  uuid: "ET-LOFA",
  name: "Loss of forced primary flow",
  initiatingEventId: "IEG-01",
  initiatingEventFrequency: {
    value: 0.01,
    controlledDataSource: {
      workbookId: "da-workbook",
      parameterId: PARAMETER_ID,
    },
  },
  functionalEvents: {
    [FUNCTIONAL_EVENT_ID]: {
      uuid: FUNCTIONAL_EVENT_ID,
      name: "Reactor trip",
      order: 0,
      faultTreeTopEvent: {
        referenceType: "FAULT_TREE_TOP_EVENT",
        workbookId: "sy-workbook",
        modelId: FAULT_TREE_MODEL_ID,
        entityId: TOP_EVENT_ID,
      },
    },
  },
  sequences: {},
  endStateIds: {
    SUCCESSFUL_MITIGATION: SUCCESS_END_STATE_ID,
    RADIONUCLIDE_RELEASE: RELEASE_END_STATE_ID,
  },
  branches: {},
  initialState: { branchId: "" },
  canvas: {
    metadata: {
      viewport: { x: 0, y: 0, zoom: 1 },
      mode: "AUTOMATIC",
      direction: "LEFT_TO_RIGHT",
    },
    nodePositions: [{ nodeId: FUNCTIONAL_EVENT_ID, position: { x: 120, y: 80 } }],
  },
  implementsSrs: [],
});

describe("ES workbook-owned event trees", () => {
  it("persists editor extensions on the existing ES EventTree record", () => {
    const parsed = EventTreeSchema.parse(eventTree());

    expect(parsed.initiatingEventFrequency).toEqual(eventTree().initiatingEventFrequency);
    expect(parsed.functionalEvents[FUNCTIONAL_EVENT_ID].faultTreeTopEvent).toEqual(
      eventTree().functionalEvents[FUNCTIONAL_EVENT_ID].faultTreeTopEvent,
    );
    expect(parsed.canvas).toEqual(eventTree().canvas);
    expect(parsed.endStateIds).toEqual(eventTree().endStateIds);
  });

  it("rejects non-UUID event-tree end-state identities", () => {
    expect(
      EventTreeSchema.safeParse({
        ...eventTree(),
        endStateIds: { SUCCESSFUL_MITIGATION: "SAFE" },
      }).success,
    ).toBe(false);
  });

  it("rejects standalone method-model persistence metadata on an ES event tree", () => {
    expect(
      EventTreeSchema.safeParse({
        ...eventTree(),
        projectId: "project-1",
        methodType: "EVENT_TREE",
        revision: 4,
      }).success,
    ).toBe(false);
  });

  it("rejects ambiguous typed and legacy FT links on one functional event", () => {
    const tree = eventTree();
    tree.functionalEvents[FUNCTIONAL_EVENT_ID].faultTreeId = FAULT_TREE_MODEL_ID;

    const parsed = EventTreeSchema.safeParse(tree);

    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(parsed.error.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: ["functionalEvents", FUNCTIONAL_EVENT_ID, "faultTreeId"],
        }),
      ]),
    );
  });

  it("keeps legacy unqualified FT links parseable until the migration TODO", () => {
    const tree = eventTree();
    delete tree.functionalEvents[FUNCTIONAL_EVENT_ID].faultTreeTopEvent;
    tree.functionalEvents[FUNCTIONAL_EVENT_ID].faultTreeId = FAULT_TREE_MODEL_ID;

    expect(EventTreeSchema.safeParse(tree).success).toBe(true);
  });
});
