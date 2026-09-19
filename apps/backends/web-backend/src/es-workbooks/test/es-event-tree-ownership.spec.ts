import { EventSequenceAnalysisSchema } from "interfaces-mef-types/zod/es/event-sequence-analysis";
import { createBlankEs } from "../blank-es";

const FUNCTIONAL_EVENT_ID = "123e4567-e89b-42d3-a456-426614174101";
const FAULT_TREE_MODEL_ID = "123e4567-e89b-42d3-a456-426614174102";
const TOP_EVENT_ID = "123e4567-e89b-42d3-a456-426614174103";

describe("ES workbook event-tree ownership", () => {
  it("round-trips editor data through the ES workbook MEF schema", () => {
    const mef = createBlankEs("ES ownership", "analyst");
    mef.eventTrees = [
      {
        uuid: "ET-01",
        name: "Loss of flow",
        initiatingEventId: "IE-01",
        initiatingEventFrequency: { value: 0.02 },
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
        branches: {},
        initialState: { branchId: "" },
        canvas: {
          metadata: {
            viewport: { x: 0, y: 0, zoom: 1 },
            mode: "MANUAL",
            direction: "LEFT_TO_RIGHT",
          },
          nodePositions: [{ nodeId: FUNCTIONAL_EVENT_ID, position: { x: 100, y: 60 } }],
        },
        implementsSrs: [],
      },
    ];

    const parsed = EventSequenceAnalysisSchema.parse(JSON.parse(JSON.stringify(mef)));

    expect(parsed.eventTrees).toHaveLength(1);
    expect(parsed.eventTrees?.[0].initiatingEventFrequency).toEqual({ value: 0.02 });
    expect(parsed.eventTrees?.[0].functionalEvents[FUNCTIONAL_EVENT_ID].faultTreeTopEvent).toEqual({
      referenceType: "FAULT_TREE_TOP_EVENT",
      workbookId: "sy-workbook",
      modelId: FAULT_TREE_MODEL_ID,
      entityId: TOP_EVENT_ID,
    });
    expect(parsed.eventTrees?.[0].canvas?.nodePositions).toEqual([
      { nodeId: FUNCTIONAL_EVENT_ID, position: { x: 100, y: 60 } },
    ]);
  });
});
