import type { EventTree, FunctionalEvent } from "interfaces-mef-types/es/event-sequence-analysis";
import type { SystemsAnalysis } from "interfaces-mef-types/sy/systems-analysis";

function withSystemTops(
  trees: readonly EventTree[],
  systems: SystemsAnalysis,
  workbookId: string,
  systemOf: (tree: EventTree, functionId: string) => string | undefined,
): EventTree[] {
  const tops = new Map(systems.systemLogicModels.flatMap((model) => {
    const gateId = model.topGate?.gateId;
    return model.systemReference === undefined || gateId === undefined ? [] : [[model.systemReference, { modelId: model.uuid, entityId: gateId }] as const];
  }));
  return trees.map((tree) => ({
    ...tree,
    functionalEvents: Object.fromEntries(Object.entries(tree.functionalEvents).map(([key, event]): [string, FunctionalEvent] => {
      const systemId = systemOf(tree, key);
      const top = systemId === undefined ? undefined : tops.get(systemId);
      if (systemId === undefined || top === undefined) return [key, event];
      return [key, { ...event, faultTreeTopEvent: { referenceType: "FAULT_TREE_TOP_EVENT", workbookId, ...top } }];
    })),
  }));
}

export { withSystemTops };
