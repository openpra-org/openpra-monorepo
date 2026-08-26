import type { EventSequence, EventTree } from "./es/event-sequence-analysis";
import type {
  WorkbookBayesianNetwork,
  WorkbookFaultTree,
  WorkbookFaultTreeCatalogue,
} from "./modeling";

/**
 * Workbook-owned logical models conditioned on one external or internal hazard.
 * The records remain in the hazard workbook while the UI is supplied by the
 * same canonical FT, ET, and BN components used by the internal-events hosts.
 */
interface HazardConditionedMethodModels {
  initiatingEventFaultTrees: WorkbookFaultTree[];
  faultTreeCatalogue: WorkbookFaultTreeCatalogue;
  eventTrees: EventTree[];
  eventSequences: EventSequence[];
  dependencyBayesianNetworks: WorkbookBayesianNetwork[];
}

function createEmptyHazardConditionedMethodModels(): HazardConditionedMethodModels {
  return {
    initiatingEventFaultTrees: [],
    faultTreeCatalogue: { basicEvents: [] },
    eventTrees: [],
    eventSequences: [],
    dependencyBayesianNetworks: [],
  };
}

export { createEmptyHazardConditionedMethodModels };
export type { HazardConditionedMethodModels };
