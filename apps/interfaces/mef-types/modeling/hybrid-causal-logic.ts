import type { BayesianNetworkEvidenceConfiguration } from "./bayesian-network";
import type {
  BayesianNetworkNodeReference,
  FaultTreeBasicEventCatalogueReference,
} from "./references";
import type { WorkbookEntityId, WorkbookModelAddress } from "./shared";

interface HclEventBinding {
  id: WorkbookEntityId;
  faultTreeBasicEvent: FaultTreeBasicEventCatalogueReference;
  bayesianNetworkNode: BayesianNetworkNodeReference;
  trueStateIds: HclTrueStateIds;
}

type HclTrueStateIds = [WorkbookEntityId, ...WorkbookEntityId[]];

type HclBayesianNetworkReference = WorkbookModelAddress;

type HclFaultTreeReference = WorkbookModelAddress;

type HclBaseEvidence = BayesianNetworkEvidenceConfiguration;

interface HclSolverSettings {
  variableOrder: WorkbookEntityId[] | null;
  foldConstants: boolean;
  spliceNullGates: boolean;
}

interface HclConfigurationDefinition {
  bayesianNetwork: HclBayesianNetworkReference;
  faultTrees: HclFaultTreeReference[];
  bindings: HclEventBinding[];
  baseEvidence: HclBaseEvidence;
  solverSettings: HclSolverSettings;
}

export type {
  HclEventBinding,
  HclTrueStateIds,
  HclBayesianNetworkReference,
  HclFaultTreeReference,
  HclBaseEvidence,
  HclSolverSettings,
  HclConfigurationDefinition,
};
