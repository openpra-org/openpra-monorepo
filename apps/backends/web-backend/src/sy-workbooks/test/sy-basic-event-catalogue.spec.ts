import type {
  LegacySystemFaultTreeNode,
  SystemBasicEvent,
  SystemFaultTreeNode,
  SystemsAnalysis,
} from "interfaces-mef-types/sy/systems-analysis";
import {
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

function findBasicEventNode(tree: SystemFaultTreeNode): Extract<SystemFaultTreeNode, { type: "BE" }> | undefined {
  if (tree.type === "BE") return tree;
  if (tree.type === "TR") return undefined;
  for (const child of tree.children) {
    const match = findBasicEventNode(child);
    if (match !== undefined) return match;
  }
  return undefined;
}

function replaceBasicEventNode(
  tree: SystemFaultTreeNode,
  basicEventId: string,
  replacement: LegacySystemFaultTreeNode,
): SystemFaultTreeNode | LegacySystemFaultTreeNode {
  if (tree.type === "BE") return tree.basicEventId === basicEventId ? replacement : tree;
  if (tree.type === "TR") return tree;
  return {
    ...tree,
    children: tree.children.map((child) => replaceBasicEventNode(child, basicEventId, replacement)),
  };
}

function firstModelWithBasicEvent(analysis: SystemsAnalysis): {
  modelIndex: number;
  basicEventId: string;
  event: SystemBasicEvent;
} {
  for (const [modelIndex, model] of analysis.systemLogicModels.entries()) {
    if (model.faultTree === undefined) continue;
    const node = findBasicEventNode(model.faultTree);
    if (node === undefined) continue;
    const event = analysis.systemBasicEvents.find((candidate) => candidate.uuid === node.basicEventId);
    if (event !== undefined) return { modelIndex, basicEventId: node.basicEventId, event };
  }
  throw new Error("Expected the SY seed to contain a referenced basic event");
}

describe("canonical SY workbook basic-event catalogue", () => {
  it.each([
    ["SFR", SY_ANALYSIS],
    ["HTGR", SY_ANALYSIS_HTGR],
  ])("exports the %s example with reference-only leaves and no model-local catalogues", (_name, analysis) => {
    expect(SystemsAnalysisSchema.safeParse(analysis).success).toBe(true);
    expect(analysis.systemBasicEvents.length).toBeGreaterThan(0);

    const catalogueIds = new Set(analysis.systemBasicEvents.map((event) => event.uuid));
    analysis.systemLogicModels.forEach((model) => {
      expect(model).not.toHaveProperty("basicEvents");
      systemFaultTreeBasicEventIds(model.faultTree).forEach((basicEventId) => {
        expect(catalogueIds.has(basicEventId)).toBe(true);
      });
      expect(systemLogicModelBasicEvents(analysis, model).map((event) => event.uuid)).toEqual(
        systemFaultTreeBasicEventIds(model.faultTree),
      );
    });
  });

  it("migrates the latest model-local event into the workbook catalogue and strips leaf payloads", () => {
    const legacy = structuredClone(SY_ANALYSIS) as SystemsAnalysis & Record<string, unknown>;
    const { modelIndex, basicEventId, event } = firstModelWithBasicEvent(legacy);
    const model = legacy.systemLogicModels[modelIndex];
    if (model === undefined || model.faultTree === undefined) throw new Error("Expected a fault-tree model");

    const migratedName = `${event.name} — migrated edit`;
    const migratedProbability = 0.123456;
    legacy.systemBasicEvents = legacy.systemBasicEvents.map((candidate) =>
      candidate.uuid === basicEventId
        ? { ...candidate, name: "stale workbook copy", probability: 0.9, dataAnalysisBasicEventRef: undefined }
        : candidate,
    );
    legacy.systemLogicModels[modelIndex] = {
      ...model,
      faultTree: replaceBasicEventNode(model.faultTree, basicEventId, {
        id: `leaf-${basicEventId}`,
        type: "BE",
        name: migratedName,
        be: basicEventId,
        mode: event.failureMode ?? "OTHER",
        source: "DA-MIGRATED-SOURCE",
        prob: String(migratedProbability),
      }),
      basicEvents: [{ ...event, name: migratedName, probability: migratedProbability, dataAnalysisBasicEventRef: undefined }],
    } as (typeof legacy.systemLogicModels)[number];

    const migrated = SystemsAnalysisSchema.parse(legacy);
    const migratedModel = migrated.systemLogicModels[modelIndex];
    const migratedEvent = migrated.systemBasicEvents.find((candidate) => candidate.uuid === basicEventId);
    expect(migratedModel).not.toHaveProperty("basicEvents");
    expect(migratedEvent).toMatchObject({
      uuid: basicEventId,
      name: migratedName,
      probability: migratedProbability,
      dataAnalysisBasicEventRef: "DA-MIGRATED-SOURCE",
    });
    expect(migratedModel?.faultTree).toBeDefined();
    expect(findBasicEventNode(migratedModel?.faultTree as SystemFaultTreeNode)).toEqual({
      id: `leaf-${basicEventId}`,
      type: "BE",
      basicEventId,
    });
  });

  it("builds the workbook catalogue when a legacy workbook has only model-local events", () => {
    const legacy = structuredClone(SY_ANALYSIS) as SystemsAnalysis & Record<string, unknown>;
    const { modelIndex, basicEventId, event } = firstModelWithBasicEvent(legacy);
    const model = legacy.systemLogicModels[modelIndex];
    if (model === undefined) throw new Error("Expected a fault-tree model");
    const modelEvents = systemLogicModelBasicEvents(legacy, model);

    delete legacy.systemBasicEvents;
    legacy.systemLogicModels = [
      {
        ...model,
        basicEvents: modelEvents,
      } as (typeof legacy.systemLogicModels)[number],
    ];

    const migrated = SystemsAnalysisSchema.parse(legacy);
    expect(migrated.systemBasicEvents.map((candidate) => candidate.uuid)).toEqual(
      modelEvents.map((candidate) => candidate.uuid),
    );
    expect(migrated.systemBasicEvents.some((candidate) => candidate.uuid === basicEventId)).toBe(true);
    expect(migrated.systemBasicEvents.some((candidate) => candidate.uuid === event.uuid)).toBe(true);
    expect(migrated.systemLogicModels[0]).not.toHaveProperty("basicEvents");
  });

  it("rejects duplicate catalogue IDs and unresolved canonical leaves", () => {
    const duplicate = structuredClone(SY_ANALYSIS);
    const firstEvent = duplicate.systemBasicEvents[0];
    if (firstEvent === undefined) throw new Error("Expected a basic event");
    duplicate.systemBasicEvents.push(firstEvent);
    expect(SystemsAnalysisSchema.safeParse(duplicate).success).toBe(false);

    const unresolved = structuredClone(SY_ANALYSIS);
    const { modelIndex, basicEventId } = firstModelWithBasicEvent(unresolved);
    const model = unresolved.systemLogicModels[modelIndex];
    if (model === undefined || model.faultTree === undefined) throw new Error("Expected a fault-tree model");
    model.faultTree = replaceBasicEventNode(model.faultTree, basicEventId, {
      id: "unresolved-leaf",
      type: "BE",
      name: "Legacy payload should not be needed here",
      be: "MISSING-BASIC-EVENT",
      mode: "OTHER",
      source: "",
      prob: "0.1",
    }) as SystemFaultTreeNode;
    const canonicalUnresolved = SystemsAnalysisSchema.parse(unresolved);
    canonicalUnresolved.systemBasicEvents = canonicalUnresolved.systemBasicEvents.filter(
      (event) => event.uuid !== "MISSING-BASIC-EVENT",
    );
    expect(SystemsAnalysisSchema.safeParse(canonicalUnresolved).success).toBe(false);
  });

  it("does not normalize malformed catalogue fields into valid empty catalogues", () => {
    const malformedCanonical = structuredClone(SY_ANALYSIS) as SystemsAnalysis & Record<string, unknown>;
    malformedCanonical.systemBasicEvents = "corrupt" as unknown as SystemBasicEvent[];
    expect(SystemsAnalysisSchema.safeParse(malformedCanonical).success).toBe(false);

    const malformedLegacy = structuredClone(SY_ANALYSIS) as SystemsAnalysis & Record<string, unknown>;
    delete malformedLegacy.systemBasicEvents;
    malformedLegacy.systemLogicModels[0] = {
      ...malformedLegacy.systemLogicModels[0],
      basicEvents: "corrupt",
    } as unknown as SystemsAnalysis["systemLogicModels"][number];
    expect(SystemsAnalysisSchema.safeParse(malformedLegacy).success).toBe(false);
  });

  it("keeps the direct model and node schemas canonical-only", () => {
    expect(SystemFaultTreeNodeSchema.safeParse({ id: "leaf", type: "BE", basicEventId: "BE-1" }).success).toBe(
      true,
    );
    expect(
      SystemFaultTreeNodeSchema.safeParse({
        id: "leaf",
        type: "BE",
        basicEventId: "BE-1",
        name: "duplicated payload",
      }).success,
    ).toBe(false);
    expect(
      SystemLogicModelSchema.safeParse({
        uuid: "model",
        systemReference: "system",
        description: "description",
        modelRepresentation: "Fault tree",
        basicEvents: [],
        implementsSrs: [],
      }).success,
    ).toBe(false);
  });

  it("creates blank workbooks with an explicit empty catalogue", () => {
    const blank = createBlankSy("Blank SY", "owner");
    expect(blank.systemBasicEvents).toEqual([]);
    expect(SystemsAnalysisSchema.safeParse(blank).success).toBe(true);
  });
});
