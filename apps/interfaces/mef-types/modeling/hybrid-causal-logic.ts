import type { BayesianNetworkEvidenceConfiguration } from "./bayesian-network";
import type {
  BayesianNetworkNodeReference,
  FaultTreeBasicEventCatalogueReference,
} from "./references";
import type { WorkbookEntityId, WorkbookModelAddress } from "./shared";
import type { AnnualizedFrequencyInput } from "./quantitative-semantics";

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

interface HclEvidenceScenario {
  id: WorkbookEntityId;
  code: string;
  name: string;
  enabled: boolean;
  evidence: BayesianNetworkEvidenceConfiguration;
}

interface HclHazardGridDefinition {
  name: string;
  hazardNodeIds: [WorkbookEntityId, ...WorkbookEntityId[]];
  annualFrequencyScale: AnnualizedFrequencyInput;
  normalizeWeights: boolean;
}

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
  evidenceScenarios?: HclEvidenceScenario[];
  hazardGrid?: HclHazardGridDefinition;
  solverSettings: HclSolverSettings;
}

export type {
  HclEventBinding,
  HclTrueStateIds,
  HclBayesianNetworkReference,
  HclFaultTreeReference,
  HclBaseEvidence,
  HclEvidenceScenario,
  HclHazardGridDefinition,
  HclSolverSettings,
  HclConfigurationDefinition,
};
