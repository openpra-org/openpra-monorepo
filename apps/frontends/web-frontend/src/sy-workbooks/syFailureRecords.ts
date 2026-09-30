import type {
  HumanFailureEventIntegration,
  IsolationTripCondition,
  SimultaneousUnavailabilityEvent,
  SystemBasicEvent,
  SystemsAnalysis,
} from "interfaces-mef-types/sy/systems-analysis";
import { systemLogicModelBasicEvents } from "interfaces-mef-types/sy/system-models";
import { isSystemLevelModel } from "./sySelectors";
import type { SyControlledHumanFailureOption } from "./syWorkbookContext";

type SystemTreeState = "TREE" | "SYSTEM_LEVEL" | "NONE";

const TREATMENT_LABELS: Record<IsolationTripCondition["modeledIn"], string> = {
  SYSTEM_MODEL: "In this fault tree",
  EVENT_SEQUENCE: "In the sequence model",
  EXCLUDED: "Left out",
};

function systemTree(sy: SystemsAnalysis, systemId: string): { state: SystemTreeState; events: SystemBasicEvent[] } {
  const logic = sy.systemLogicModels.find((model) => model.systemReference === systemId);
  if (logic === undefined) return { state: "NONE", events: [] };
  if (isSystemLevelModel(logic)) return { state: "SYSTEM_LEVEL", events: [] };
  return { state: "TREE", events: systemLogicModelBasicEvents(sy, logic) };
}

function humanEventReference(event: SystemBasicEvent): string | undefined {
  const source = event.controlledDataSource;
  if (source?.referenceType === "HUMAN_FAILURE_EVENT") return source.entityId;
  return event.attributes?.find((attribute) => attribute.name === "hfeReference")?.value;
}

function integrationFor(integrations: readonly HumanFailureEventIntegration[], event: SystemBasicEvent): HumanFailureEventIntegration | undefined {
  const direct = integrations.find((item) => item.basicEventId === event.uuid);
  if (direct !== undefined) return direct;
  const reference = humanEventReference(event);
  return reference === undefined ? undefined : integrations.find((item) => item.basicEventId === undefined && item.hfeReference === reference);
}

function humanFailureOption(
  options: readonly SyControlledHumanFailureOption[],
  event: SystemBasicEvent | undefined,
  integration: HumanFailureEventIntegration | undefined,
): SyControlledHumanFailureOption | undefined {
  const eventSource = event?.controlledDataSource;
  const source = eventSource?.referenceType === "HUMAN_FAILURE_EVENT" ? eventSource : integration?.hfeSource;
  if (source !== undefined) {
    const exact = options.find((option) => option.workbookId === source.workbookId && option.humanFailureEventId === source.entityId && option.quantificationId === source.quantificationId);
    if (exact !== undefined) return exact;
  }
  const reference = integration !== undefined && integration.hfeReference.length > 0
    ? integration.hfeReference
    : event === undefined ? undefined : humanEventReference(event);
  return reference === undefined ? undefined : options.find((option) => option.humanFailureEventId === reference);
}

function systemOutages(sy: SystemsAnalysis, systemId: string, eventIds: ReadonlySet<string>): SimultaneousUnavailabilityEvent[] {
  return (sy.simultaneousUnavailabilityEvents ?? []).filter((item) =>
    item.systemReference === systemId || (item.systemReference === undefined && item.componentIds.some((id) => eventIds.has(id))));
}

export {
  TREATMENT_LABELS,
  humanEventReference,
  humanFailureOption,
  integrationFor,
  systemOutages,
  systemTree,
  type SystemTreeState,
};
