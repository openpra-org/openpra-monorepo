import type {
  BayesianNetworkEvidenceConfiguration,
  BayesianNetworkNodeReference,
  FaultTreeBasicEventCatalogueReference,
  HclSolverSettings,
  WorkbookEntityId,
  WorkbookModelAddress,
  WorkbookModelId,
  WorkbookBayesianNetwork,
} from "../modeling";

interface EsqWorkbookModelIdentity {
  modelId: WorkbookModelId;
  code: string;
  name: string;
  description: string;
}

interface EsqBayesianNetwork extends EsqWorkbookModelIdentity, WorkbookBayesianNetwork {}

type EsqHclTrueStateIds = [WorkbookEntityId, ...WorkbookEntityId[]];

interface EsqHclEventBinding {
  id: WorkbookEntityId;
  faultTreeBasicEvent: FaultTreeBasicEventCatalogueReference;
  bayesianNetworkNode: BayesianNetworkNodeReference;
  trueStateIds: EsqHclTrueStateIds;
}

interface EsqHclConfiguration extends EsqWorkbookModelIdentity {
  bayesianNetwork: WorkbookModelAddress;
  faultTrees: WorkbookModelAddress[];
  bindings: EsqHclEventBinding[];
  baseEvidence: BayesianNetworkEvidenceConfiguration;
  solverSettings: HclSolverSettings;
}

export type {
  EsqWorkbookModelIdentity,
  EsqBayesianNetwork,
  EsqHclTrueStateIds,
  EsqHclEventBinding,
  EsqHclConfiguration,
};
