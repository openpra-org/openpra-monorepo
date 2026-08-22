import { EventSequenceAnalysisSchema } from "interfaces-mef-types/zod/es/event-sequence-analysis";
import { SystemsAnalysisSchema } from "interfaces-mef-types/zod/sy/systems-analysis";
import { createBlankEs } from "../../es-workbooks/blank-es";
import { createBlankSy } from "../../sy-workbooks/blank-sy";
import { LEGACY_ES_EVENT_TREE, LEGACY_SY_FAULT_TREE_MODEL } from "./legacy-workbook-model-fixtures";

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

describe("workbook model migration fixtures", () => {
  it("migrates a frozen legacy SY fault tree without losing topology or basic-event data", () => {
    const legacyModel = deepFreeze(structuredClone(LEGACY_SY_FAULT_TREE_MODEL));
    const legacyMef = structuredClone(createBlankSy("Legacy SY", "analyst")) as unknown as Record<
      string,
      unknown
    >;
    delete legacyMef.systemBasicEvents;
    legacyMef.systemLogicModels = [legacyModel];

    const migrated = SystemsAnalysisSchema.parse(legacyMef);

    expect(migrated.systemLogicModels).toEqual([
      {
        uuid: "SY-LEGACY-MODEL",
        systemReference: "SYS-LEGACY-PUMPS",
        description: "Legacy two-train pump fault tree",
        modelRepresentation: "Fault tree",
        faultTree: {
          id: "LEGACY-TOP",
          type: "OR",
          name: "Both credited cooling paths unavailable",
          children: [
            {
              id: "LEGACY-GATE-A",
              type: "AND",
              name: "Train failures",
              children: [
                { id: "LEGACY-LEAF-A", type: "BE", basicEventId: "BE-LEGACY-PUMP-A" },
                { id: "LEGACY-LEAF-B", type: "BE", basicEventId: "BE-LEGACY-PUMP-B" },
              ],
            },
            {
              id: "LEGACY-TRANSFER",
              type: "TR",
              name: "Support cooling unavailable",
              transfer: "SY-SUPPORT-COOLING",
            },
          ],
        },
        logicLoopResolutions: [
          { loopId: "LOOP-1", resolution: "Transfer boundary breaks the support loop" },
        ],
        nomenclature: { PUMP: "Cooling pump" },
        implementsSrs: [],
      },
    ]);
    expect(migrated.systemBasicEvents).toEqual([
      {
        uuid: "BE-LEGACY-PUMP-A",
        name: "Pump A fails to start",
        description: "Demand failure retained from the model-local catalogue",
        eventType: "BASIC",
        componentReference: "PUMP-A",
        failureMode: "FAILURE_TO_START",
        probability: 0.01,
        repairModeled: true,
        repairJustification: "Repair is credited after diagnosis",
        meanTimeToRepair: 4,
        dataAnalysisBasicEventRef: "DA-PUMP-A",
        implementsSrs: [],
      },
      {
        uuid: "BE-LEGACY-PUMP-B",
        name: "Pump B fails to run",
        eventType: "BASIC",
        failureMode: "FAILURE_TO_RUN",
        probability: 0.02,
        repairModeled: false,
        dataAnalysisBasicEventRef: "DA-PUMP-B",
        implementsSrs: [],
      },
    ]);
    expect(legacyModel).toHaveProperty("basicEvents");
    expect((legacyModel.faultTree.children[0] as { children: unknown[] }).children[0]).toHaveProperty(
      "be",
      "BE-LEGACY-PUMP-A",
    );

    const reparsed = SystemsAnalysisSchema.parse(JSON.parse(JSON.stringify(migrated)));
    expect(reparsed.systemLogicModels).toEqual(migrated.systemLogicModels);
    expect(reparsed.systemBasicEvents).toEqual(migrated.systemBasicEvents);
  });

  it("preserves a frozen legacy ES event-tree topology until typed FT targets can be resolved", () => {
    const legacyTree = deepFreeze(structuredClone(LEGACY_ES_EVENT_TREE));
    const legacyMef = structuredClone(createBlankEs("Legacy ES", "analyst")) as unknown as Record<
      string,
      unknown
    >;
    legacyMef.eventTrees = [legacyTree];

    const parsed = EventSequenceAnalysisSchema.parse(legacyMef);
    const parsedTree = parsed.eventTrees?.[0];

    expect(parsedTree).toEqual(legacyTree);
    expect(parsedTree?.initialState.branchId).toBe("BRANCH-TRIP");
    expect(parsedTree?.branches["BRANCH-TRIP"].paths).toEqual(legacyTree.branches["BRANCH-TRIP"].paths);
    expect(parsedTree?.sequences["SEQ-RELEASE"].functionalEventStates).toEqual({
      TRIP: "SUCCESS",
      DHR: "FAILURE",
    });
    expect(parsedTree?.transfers?.["ET-LEGACY-ATWS"]).toEqual(
      legacyTree.transfers["ET-LEGACY-ATWS"],
    );
    expect(parsedTree?.functionalEvents.TRIP).toMatchObject({
      faultTreeId: "FT-RPS-TRIP",
    });
    expect(parsedTree?.functionalEvents.TRIP).not.toHaveProperty("faultTreeTopEvent");
    expect(parsedTree).not.toHaveProperty("initiatingEventFrequency");
    expect(parsedTree).not.toHaveProperty("canvas");

    const reparsed = EventSequenceAnalysisSchema.parse(JSON.parse(JSON.stringify(parsed)));
    expect(reparsed.eventTrees).toEqual(parsed.eventTrees);
  });
});
