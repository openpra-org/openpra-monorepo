import type {
  WorkbookEntityId,
  WorkbookModelId,
  WorkbookBayesianNetwork,
  WorkbookHclConfiguration,
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
  faultTreeBasicEvent: import("../modeling").FaultTreeBasicEventCatalogueReference;
  bayesianNetworkNode: import("../modeling").BayesianNetworkNodeReference;
  trueStateIds: EsqHclTrueStateIds;
}

interface EsqHclConfiguration extends WorkbookHclConfiguration {}

export type {
  EsqWorkbookModelIdentity,
  EsqBayesianNetwork,
  EsqHclTrueStateIds,
  EsqHclEventBinding,
  EsqHclConfiguration,
};
