import type { SystemBasicEvent, SystemsAnalysis } from "interfaces-mef-types/sy/systems-analysis";
import {
  applyFaultTreeBasicEventToSystemBasicEvent,
  systemBasicEventToFaultTreeBasicEvent,
  systemFaultTreeBasicEventIds,
  systemLogicModelBasicEvents,
} from "interfaces-mef-types/sy/system-models";
import {
  SystemFaultTreeNodeSchema,
  SystemLogicModelSchema,
  SystemsAnalysisSchema,
} from "interfaces-mef-types/zod/sy/systems-analysis";
import { SY_ANALYSIS } from "../../example-workbooks/seeds/sy-seed";
import { SY_ANALYSIS_HTGR } from "../../example-workbooks/seeds/sy-seed-htgr";
import { createBlankSy } from "../blank-sy";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function firstModelWithBasicEvent(analysis: SystemsAnalysis): {
  modelIndex: number;
  basicEventId: string;
  event: SystemBasicEvent;
} {
  for (const [modelIndex, model] of analysis.systemLogicModels.entries()) {
    const leaf = model.leafNodes.find((candidate) => candidate.kind === "BASIC_EVENT_REFERENCE");
    if (leaf?.kind !== "BASIC_EVENT_REFERENCE") continue;
    const event = analysis.systemBasicEvents.find((candidate) => candidate.uuid === leaf.basicEventId);
    if (event !== undefined) return { modelIndex, basicEventId: leaf.basicEventId, event };
  }
  throw new Error("Expected the SY seed to contain a referenced basic event");
}

function legacyWorkbook(): Record<string, unknown> {
  const legacy = structuredClone(createBlankSy("Legacy SY", "owner")) as unknown as Record<
    string,
    unknown
  >;
  legacy.systemBasicEvents = [
    {
      uuid: "BE-A",
      name: "stale workbook copy",
      eventType: "BASIC",
      probability: 0.9,
      repairModeled: false,
      implementsSrs: [],
    },
  ];
  legacy.systemLogicModels = [
    {
      uuid: "MODEL-A",
      systemReference: "SYS-A",
      description: "Model A description",
      modelRepresentation: "Fault tree",
      faultTree: {
        id: "TOP-A",
        type: "OR",
        name: "Model A top gate",
        children: [
          {
            id: "GATE-A",
            type: "AND",
            name: "Train failures",
            children: [
              {
                id: "LEAF-A",
                type: "BE",
                name: "Migrated event",
                be: "BE-A",
                mode: "FAILURE_TO_START",
                source: "DA-MIGRATED",
                prob: "0.123456",
              },
            ],
          },
          {
            id: "TRANSFER-B",
            type: "TR",
            name: "Transfer to B",
            transfer: "SYS-B",
          },
        ],
      },
      basicEvents: [
        {
          uuid: "BE-A",
          name: "Migrated event",
          eventType: "BASIC",
          failureMode: "FAILURE_TO_START",
          probability: 0.123456,
          repairModeled: false,
          implementsSrs: [],
        },
      ],
      implementsSrs: [],
    },
    {
      uuid: "MODEL-B",
      systemReference: "SYS-B",
      description: "Model B description",
      modelRepresentation: "Fault tree",
      faultTree: { id: "TOP-B", type: "OR", name: "Model B top gate", children: [] },
      implementsSrs: [],
    },
  ];
  return legacy;
}

describe("canonical SY workbook fault-tree storage", () => {
  it.each([
    ["SFR", SY_ANALYSIS],
    ["HTGR", SY_ANALYSIS_HTGR],
  ])("exports the %s seed with normalized trees and one basic-event catalogue", (_name, analysis) => {
    const parsed = SystemsAnalysisSchema.parse(analysis);
    expect(parsed).toEqual(analysis);
    expect(analysis.systemBasicEvents.length).toBeGreaterThan(0);

    const catalogueIds = new Set(analysis.systemBasicEvents.map((event) => event.uuid));
    analysis.systemBasicEvents.forEach((event) => expect(event.uuid).toMatch(UUID_PATTERN));
    analysis.systemLogicModels.forEach((model) => {
      expect(model).not.toHaveProperty("faultTree");
      expect(model).not.toHaveProperty("basicEvents");
      expect(model).toEqual(
        expect.objectContaining({
          code: expect.any(String),
          name: expect.any(String),
          gates: expect.any(Array),
          leafNodes: expect.any(Array),
          gateInputs: expect.any(Array),
          nodePositions: expect.any(Array),
          layout: expect.objectContaining({ mode: expect.any(String), viewport: expect.any(Object) }),
        }),
      );
      expect(model.uuid).toMatch(UUID_PATTERN);
      model.gates.forEach((gate) => expect(gate.id).toMatch(UUID_PATTERN));
      model.leafNodes.forEach((leaf) => expect(leaf.id).toMatch(UUID_PATTERN));
      model.gateInputs.forEach((input) => expect(input.id).toMatch(UUID_PATTERN));
      if (model.topGate !== null) expect(model.topGate.gateId).toEqual(expect.any(String));
      systemFaultTreeBasicEventIds(model).forEach((basicEventId) => {
        expect(catalogueIds.has(basicEventId)).toBe(true);
      });
      expect(systemLogicModelBasicEvents(analysis, model).map((event) => event.uuid)).toEqual(
        systemFaultTreeBasicEventIds(model),
      );
      model.leafNodes
        .filter((leaf) => leaf.kind === "TRANSFER_REFERENCE")
        .forEach((leaf) => {
          if (leaf.kind !== "TRANSFER_REFERENCE") return;
          expect(leaf.target.modelId).not.toMatch(/^unresolved:/);
          const targetModel = analysis.systemLogicModels.find(
            (candidate) => candidate.uuid === leaf.target.modelId,
          );
          expect(targetModel?.topGate?.gateId).toBe(leaf.target.entityId);
        });
    });
  });

  it("flattens a legacy tree, preserves catalogue precedence, and resolves transfers across models", () => {
    const migrated = SystemsAnalysisSchema.parse(legacyWorkbook());
    const modelA = migrated.systemLogicModels[0];
    const modelB = migrated.systemLogicModels[1];
    const migratedEvent = migrated.systemBasicEvents.find((candidate) => candidate.code === "BE-A");
    if (modelA === undefined || modelB === undefined || migratedEvent === undefined) {
      throw new Error("Expected both migrated models and their basic event");
    }
    const topGate = modelA.gates.find(({ code }) => code === "TOP-A");
    const branchGate = modelA.gates.find(({ code }) => code === "GATE-A");
    const eventLeaf = modelA.leafNodes.find((leaf) => leaf.kind === "BASIC_EVENT_REFERENCE");
    const transferLeaf = modelA.leafNodes.find((leaf) => leaf.kind === "TRANSFER_REFERENCE");
    if (topGate === undefined || branchGate === undefined || eventLeaf?.kind !== "BASIC_EVENT_REFERENCE" || transferLeaf?.kind !== "TRANSFER_REFERENCE") {
      throw new Error("Expected the migrated topology");
    }

    expect(modelA).not.toHaveProperty("faultTree");
    expect(modelA).not.toHaveProperty("basicEvents");
    expect(modelA).toMatchObject({
      uuid: expect.stringMatching(UUID_PATTERN),
      code: "TOP-A",
      name: "Model A top gate",
      nodePositions: [],
      layout: {
        viewport: { x: 0, y: 0, zoom: 1 },
        mode: "AUTOMATIC",
        direction: "TOP_TO_BOTTOM",
      },
    });
    expect(modelA.topGate?.gateId).toBe(topGate.id);
    expect(topGate.gateType).toBe("OR");
    expect(branchGate.gateType).toBe("AND");
    expect(eventLeaf.basicEventId).toBe(migratedEvent.uuid);
    expect(transferLeaf.target).toEqual({
      modelId: modelB.uuid,
      entityId: modelB.topGate?.gateId,
    });
    expect(modelA.gateInputs).toEqual([
      { id: expect.stringMatching(UUID_PATTERN), gateId: branchGate.id, childId: eventLeaf.id, order: 0 },
      { id: expect.stringMatching(UUID_PATTERN), gateId: topGate.id, childId: branchGate.id, order: 0 },
      { id: expect.stringMatching(UUID_PATTERN), gateId: topGate.id, childId: transferLeaf.id, order: 1 },
    ]);
    expect(migratedEvent).toMatchObject({
      uuid: expect.stringMatching(UUID_PATTERN),
      code: "BE-A",
      name: "Migrated event",
      probability: 0.123456,
      dataAnalysisBasicEventRef: "DA-MIGRATED",
    });

    expect(SystemsAnalysisSchema.parse(structuredClone(migrated))).toEqual(migrated);
  });

  it("builds the workbook catalogue when a legacy workbook has only model-local events", () => {
    const legacy = legacyWorkbook();
    delete legacy.systemBasicEvents;
    const migrated = SystemsAnalysisSchema.parse(legacy);

    expect(migrated.systemBasicEvents).toEqual([
      expect.objectContaining({
        uuid: expect.stringMatching(UUID_PATTERN),
        code: "BE-A",
        name: "Migrated event",
        probability: 0.123456,
      }),
    ]);
    expect(migrated.systemLogicModels[0]).not.toHaveProperty("basicEvents");
  });

  it("rejects duplicate catalogue IDs and unresolved normalized leaves", () => {
    const duplicate = structuredClone(SY_ANALYSIS);
    const firstEvent = duplicate.systemBasicEvents[0];
    if (firstEvent === undefined) throw new Error("Expected a basic event");
    duplicate.systemBasicEvents.push(firstEvent);
    expect(SystemsAnalysisSchema.safeParse(duplicate).success).toBe(false);

    const unresolved = structuredClone(SY_ANALYSIS);
    const { modelIndex } = firstModelWithBasicEvent(unresolved);
    const model = unresolved.systemLogicModels[modelIndex];
    if (model === undefined) throw new Error("Expected a fault-tree model");
    const leafIndex = model.leafNodes.findIndex((leaf) => leaf.kind === "BASIC_EVENT_REFERENCE");
    const leaf = model.leafNodes[leafIndex];
    if (leaf?.kind !== "BASIC_EVENT_REFERENCE") throw new Error("Expected a basic-event leaf");
    model.leafNodes[leafIndex] = { ...leaf, basicEventId: "MISSING-BASIC-EVENT" };
    expect(SystemsAnalysisSchema.safeParse(unresolved).success).toBe(false);
  });

  it("does not normalize malformed catalogue fields into valid empty catalogues", () => {
    const malformedCanonical = structuredClone(SY_ANALYSIS) as SystemsAnalysis & Record<string, unknown>;
    malformedCanonical.systemBasicEvents = "corrupt" as unknown as SystemBasicEvent[];
    expect(SystemsAnalysisSchema.safeParse(malformedCanonical).success).toBe(false);

    const malformedLegacy = legacyWorkbook();
    const models = malformedLegacy.systemLogicModels as Array<Record<string, unknown>>;
    models[0] = { ...models[0], basicEvents: "corrupt" };
    expect(SystemsAnalysisSchema.safeParse(malformedLegacy).success).toBe(false);
  });

  it("normalizes a standalone legacy model and preserves an unresolved transfer target", () => {
    expect(
      SystemFaultTreeNodeSchema.safeParse({ id: "leaf", type: "BE", basicEventId: "BE-1" }).success,
    ).toBe(true);
    const models = legacyWorkbook().systemLogicModels as Array<Record<string, unknown>>;
    const migrated = SystemLogicModelSchema.parse(models[0]);
    expect(migrated).not.toHaveProperty("faultTree");
    expect(migrated.leafNodes).toContainEqual(
      expect.objectContaining({
        id: "TRANSFER-B",
        kind: "TRANSFER_REFERENCE",
        target: {
          modelId: "unresolved:SYS-B",
          entityId: "unresolved:SYS-B",
        },
      }),
    );
    expect(
      SystemLogicModelSchema.safeParse({
        uuid: "model",
        code: "FT-1",
        name: "Fault tree",
        systemReference: "system",
        description: "description",
        modelRepresentation: "Fault tree",
        topGate: null,
        gates: [],
        leafNodes: [],
        gateInputs: [],
        nodePositions: [],
        layout: {
          viewport: { x: 0, y: 0, zoom: 1 },
          mode: "AUTOMATIC",
          direction: "TOP_TO_BOTTOM",
        },
        implementsSrs: [],
      }).success,
    ).toBe(true);
  });

  it("projects the sole SY catalogue into the reusable FT basic-event contract without persisting defaults", () => {
    const source: SystemBasicEvent = {
      uuid: "BE-1",
      code: "PUMP-FAIL",
      name: "Event",
      eventType: "BASIC",
      failureMode: "OTHER",
      implementsSrs: [],
    };
    const projected = systemBasicEventToFaultTreeBasicEvent(source);
    expect(projected).toMatchObject({
      id: "BE-1",
      code: "PUMP-FAIL",
      name: "Event",
      description: "",
    });
    expect(Number.isNaN(projected.probability.value)).toBe(true);
    expect(applyFaultTreeBasicEventToSystemBasicEvent(source, projected)).toEqual(source);
    expect(
      applyFaultTreeBasicEventToSystemBasicEvent(source, { ...projected, code: "EDITED" }),
    ).toEqual({ ...source, code: "EDITED" });
    const controlled = applyFaultTreeBasicEventToSystemBasicEvent(source, {
      ...projected,
      probability: {
        value: 0.1,
        controlledDataSource: {
          referenceType: "WORKBOOK_PARAMETER",
          workbookId: "workbook",
          entityId: "parameter",
        },
      },
    });
    expect(controlled).toMatchObject({
      probability: 0.1,
      controlledDataSource: {
        referenceType: "WORKBOOK_PARAMETER",
        workbookId: "workbook",
        entityId: "parameter",
      },
    });
  });

  it("creates blank workbooks with explicit normalized empty collections", () => {
    const blank = createBlankSy("Blank SY", "owner");
    expect(blank.systemBasicEvents).toEqual([]);
    expect(blank.systemLogicModels).toEqual([]);
    expect(SystemsAnalysisSchema.safeParse(blank).success).toBe(true);
  });
});
