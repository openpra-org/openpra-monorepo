import type { BayesianNetworkDefinition } from "interfaces-mef-types/modeling";
import type { WorkbookModelId } from "../shared";

interface BayesianNetworkModel extends BayesianNetworkDefinition {
  modelId: WorkbookModelId;
  code: string;
  name: string;
  description: string;
}

export type {
  BayesianNetworkEntityIdentity,
  BayesianNetworkNodeState,
  BayesianNetworkNodeStates,
  BayesianNetworkChanceNode,
  BayesianNetworkNode,
  BayesianNetworkParentReference,
  BayesianNetworkDirectedEdge,
  BayesianNetworkParentStateSelection,
  BayesianNetworkCptValue,
  BayesianNetworkCptValues,
  BayesianNetworkCptRow,
  BayesianNetworkConditionalProbabilityTable,
  BayesianNetworkNodePosition,
  BayesianNetworkEvidenceObservation,
  BayesianNetworkEvidenceConfiguration,
  BayesianNetworkDefinition,
} from "interfaces-mef-types/modeling";
export type { BayesianNetworkModel };
