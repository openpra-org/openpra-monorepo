import { EventSequenceAnalysisSchema } from "interfaces-mef-types/zod/es/event-sequence-analysis";
import { SystemsAnalysisSchema } from "interfaces-mef-types/zod/sy/systems-analysis";
import { createBlankEs } from "../../es-workbooks/blank-es";
import { createBlankSy } from "../../sy-workbooks/blank-sy";
import { LEGACY_ES_EVENT_TREE, LEGACY_SY_FAULT_TREE_MODEL } from "./legacy-workbook-model-fixtures";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
        uuid: expect.stringMatching(UUID_PATTERN),
        code: "LEGACY-TOP",
        name: "Both credited cooling paths unavailable",
        systemReference: "SYS-LEGACY-PUMPS",
        description: "Legacy two-train pump fault tree",
        modelRepresentation: "Fault tree",
        topGate: { gateId: expect.stringMatching(UUID_PATTERN) },
        gates: [
          {
            id: expect.stringMatching(UUID_PATTERN),
            code: "LEGACY-TOP",
            name: "Both credited cooling paths unavailable",
            description: "Both credited cooling paths unavailable",
            kind: "GATE",
            gateType: "OR",
          },
          {
            id: expect.stringMatching(UUID_PATTERN),
            code: "LEGACY-GATE-A",
            name: "Train failures",
            description: "Train failures",
            kind: "GATE",
            gateType: "AND",
          },
        ],
        leafNodes: [
          {
            id: expect.stringMatching(UUID_PATTERN),
            kind: "BASIC_EVENT_REFERENCE",
            basicEventId: expect.stringMatching(UUID_PATTERN),
          },
          {
            id: expect.stringMatching(UUID_PATTERN),
            kind: "BASIC_EVENT_REFERENCE",
            basicEventId: expect.stringMatching(UUID_PATTERN),
          },
          {
            id: expect.stringMatching(UUID_PATTERN),
            code: "LEGACY-TRANSFER",
            name: "Support cooling unavailable",
            description: "Transfer to SY-SUPPORT-COOLING",
            kind: "TRANSFER_REFERENCE",
            target: {
              modelId: expect.stringMatching(UUID_PATTERN),
              entityId: expect.stringMatching(UUID_PATTERN),
            },
          },
        ],
        gateInputs: [
          {
            id: expect.stringMatching(UUID_PATTERN),
            gateId: expect.stringMatching(UUID_PATTERN),
            childId: expect.stringMatching(UUID_PATTERN),
            order: 0,
          },
          {
            id: expect.stringMatching(UUID_PATTERN),
            gateId: expect.stringMatching(UUID_PATTERN),
            childId: expect.stringMatching(UUID_PATTERN),
            order: 1,
          },
          {
            id: expect.stringMatching(UUID_PATTERN),
            gateId: expect.stringMatching(UUID_PATTERN),
            childId: expect.stringMatching(UUID_PATTERN),
            order: 0,
          },
          {
            id: expect.stringMatching(UUID_PATTERN),
            gateId: expect.stringMatching(UUID_PATTERN),
            childId: expect.stringMatching(UUID_PATTERN),
            order: 1,
          },
        ],
        nodePositions: [],
        layout: {
          viewport: { x: 0, y: 0, zoom: 1 },
          mode: "AUTOMATIC",
          direction: "TOP_TO_BOTTOM",
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
        uuid: expect.stringMatching(UUID_PATTERN),
        code: "BE-LEGACY-PUMP-A",
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
        uuid: expect.stringMatching(UUID_PATTERN),
        code: "BE-LEGACY-PUMP-B",
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
    expect(migrated.systemLogicModels[0]).not.toHaveProperty("faultTree");
    const model = migrated.systemLogicModels[0];
    const topGate = model?.gates.find(({ code }) => code === "LEGACY-TOP");
    const branchGate = model?.gates.find(({ code }) => code === "LEGACY-GATE-A");
    const transfer = model?.leafNodes.find((leaf) => leaf.kind === "TRANSFER_REFERENCE");
    expect(model?.topGate?.gateId).toBe(topGate?.id);
    expect(model?.gateInputs.map(({ gateId, childId, order }) => ({ gateId, childId, order }))).toEqual([
      { gateId: branchGate?.id, childId: model?.leafNodes[0]?.id, order: 0 },
      { gateId: branchGate?.id, childId: model?.leafNodes[1]?.id, order: 1 },
      { gateId: topGate?.id, childId: branchGate?.id, order: 0 },
      { gateId: topGate?.id, childId: transfer?.id, order: 1 },
    ]);
    expect(model?.leafNodes.slice(0, 2).map((leaf) =>
      leaf.kind === "BASIC_EVENT_REFERENCE" ? leaf.basicEventId : null,
    )).toEqual(migrated.systemBasicEvents.map(({ uuid }) => uuid));
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
