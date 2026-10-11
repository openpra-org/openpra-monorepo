import { esqStableId } from "../esq/esq-run-inputs";
import type { HclEventBinding } from "../modeling/hybrid-causal-logic";
import type { WorkbookHclConfiguration } from "../modeling/workbook-models";
import type { EventTree, FunctionalEvent } from "./event-sequence-analysis";

interface HclEventTreeFacts {
  workbookId: string;
  initiatingEventId?: string;
  plantOperatingStateId?: string;
  faultTrees: Array<{ workbookId: string; modelId: string }>;
  unlinkedFunctionalEventIds: string[];
}

const FUNCTIONAL_EVENT_MODEL_ID = esqStableId("es-functional-events");

function functionalEventBindingId(functionalEventId: string): string {
  return esqStableId(`es-functional-event:${functionalEventId}`);
}

function unlinkedFunctionalEvents(trees: readonly EventTree[]): FunctionalEvent[] {
  const byId = new Map<string, FunctionalEvent>();
  trees.forEach((tree) => {
    Object.values(tree.functionalEvents).forEach((event) => {
      if (event.faultTreeTopEvent === undefined && !byId.has(event.uuid)) byId.set(event.uuid, event);
    });
  });
  return [...byId.values()];
}

function eventTreeHclFacts(workbookId: string, root: EventTree, connected: readonly EventTree[]): HclEventTreeFacts {
  const linked = new Map<string, { workbookId: string; modelId: string }>();
  connected.forEach((tree) => {
    Object.values(tree.functionalEvents).forEach((event) => {
      const reference = event.faultTreeTopEvent;
      if (reference !== undefined) linked.set(`${reference.workbookId}:${reference.modelId}`, { workbookId: reference.workbookId, modelId: reference.modelId });
    });
  });
  return {
    workbookId,
    initiatingEventId: root.initiatingEventId,
    ...(root.plantOperatingStateId === undefined ? {} : { plantOperatingStateId: root.plantOperatingStateId }),
    faultTrees: [...linked.values()],
    unlinkedFunctionalEventIds: unlinkedFunctionalEvents(connected).map((event) => event.uuid),
  };
}

function inEventTreeScope(
  configuration: WorkbookHclConfiguration,
  facts: Pick<HclEventTreeFacts, "initiatingEventId" | "plantOperatingStateId">,
): boolean {
  const scope = configuration.eventTreeScope;
  if (scope === undefined) return true;
  const initiatorMatches = scope.initiatingEventIds.length === 0
    || (facts.initiatingEventId !== undefined && scope.initiatingEventIds.includes(facts.initiatingEventId));
  const stateMatches = scope.plantOperatingStateIds.length === 0
    || (facts.plantOperatingStateId !== undefined && scope.plantOperatingStateIds.includes(facts.plantOperatingStateId));
  return initiatorMatches && stateMatches;
}

function boundFunctionalEventIds(
  configuration: WorkbookHclConfiguration,
  workbookId: string,
  functionalEventIds: readonly string[],
): string[] {
  const bound = new Set(configuration.bindings.flatMap((binding) =>
    binding.faultTreeBasicEvent.workbookId === workbookId ? [binding.faultTreeBasicEvent.entityId] : []));
  return functionalEventIds.filter((id) => bound.has(functionalEventBindingId(id)));
}

function esConfigurationApplies(
  ownerWorkbookId: string,
  configuration: WorkbookHclConfiguration,
  facts: HclEventTreeFacts,
): boolean {
  if (facts.workbookId !== ownerWorkbookId || !inEventTreeScope(configuration, facts)) return false;
  const declared = new Set(configuration.faultTrees.map((reference) => `${reference.workbookId}:${reference.modelId}`));
  return facts.faultTrees.some((reference) => declared.has(`${reference.workbookId}:${reference.modelId}`))
    || boundFunctionalEventIds(configuration, ownerWorkbookId, facts.unlinkedFunctionalEventIds).length > 0;
}

function overriddenBindings(
  syConfiguration: WorkbookHclConfiguration,
  esConfiguration: WorkbookHclConfiguration,
): HclEventBinding[] {
  const esBound = new Set(esConfiguration.bindings.map((binding) =>
    `${binding.faultTreeBasicEvent.workbookId}:${binding.faultTreeBasicEvent.entityId}`));
  return syConfiguration.bindings.filter((binding) =>
    esBound.has(`${binding.faultTreeBasicEvent.workbookId}:${binding.faultTreeBasicEvent.entityId}`));
}

function overridingConfiguration(
  syConfiguration: WorkbookHclConfiguration,
  esConfigurations: readonly WorkbookHclConfiguration[],
  facts: HclEventTreeFacts,
): WorkbookHclConfiguration | undefined {
  return esConfigurations.find((configuration) =>
    esConfigurationApplies(facts.workbookId, configuration, facts)
    && overriddenBindings(syConfiguration, configuration).length > 0);
}

export {
  FUNCTIONAL_EVENT_MODEL_ID,
  boundFunctionalEventIds,
  esConfigurationApplies,
  eventTreeHclFacts,
  functionalEventBindingId,
  inEventTreeScope,
  overriddenBindings,
  overridingConfiguration,
  unlinkedFunctionalEvents,
};
export type { HclEventTreeFacts };
