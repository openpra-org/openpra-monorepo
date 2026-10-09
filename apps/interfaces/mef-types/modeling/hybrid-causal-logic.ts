import type { BayesianNetworkEvidenceConfiguration } from "./bayesian-network";
import type {
  BayesianNetworkNodeReference,
  FaultTreeBasicEventCatalogueReference,
} from "./references";
import type { WorkbookEntityId, WorkbookModelAddress } from "./shared";
import type { AnnualizedFrequencyInput } from "./quantitative-semantics";
import type { UncertainExpression, UncertainVector } from "../core/uncertainty";

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

type HclSampler = "MC" | "LHS";

interface HclBasicEventUncertainty {
  faultTreeBasicEvent: FaultTreeBasicEventCatalogueReference;
  expression: UncertainExpression;
}

interface HclCptRowUncertainty {
  bayesianNetworkNode: BayesianNetworkNodeReference;
  cptRowId: WorkbookEntityId;
  row: UncertainVector;
}

interface HclFragilityDemand {
  stateId: WorkbookEntityId;
  demand: number;
}

interface HclPgaBin {
  stateId: WorkbookEntityId;
  frequency: UncertainExpression;
}

type HclPgaConversion = "POISSON" | "LINEAR";

type HclCptGenerator =
  | {
      kind: "SEISMIC_FRAGILITY";
      pgaParentId: WorkbookEntityId;
      trueStateId: WorkbookEntityId;
      falseStateId: WorkbookEntityId;
      median: UncertainExpression;
      randomness: UncertainExpression;
      demands: HclFragilityDemand[];
    }
  | {
      kind: "SEISMIC_PGA_BINS";
      noneStateId: WorkbookEntityId;
      missionTime: UncertainExpression;
      conversion: HclPgaConversion;
      bins: HclPgaBin[];
    };

interface HclCptGeneratorUncertainty {
  bayesianNetworkNode: BayesianNetworkNodeReference;
  generator: HclCptGenerator;
}

interface HclUncertaintySettings {
  sampleCount: number;
  seed: number;
  sampler: HclSampler;
  basicEvents: HclBasicEventUncertainty[];
  cptRows: HclCptRowUncertainty[];
  cptGenerators: HclCptGeneratorUncertainty[];
}

interface HclSolverSettings {
  variableOrder: WorkbookEntityId[] | null;
  foldConstants: boolean;
  spliceNullGates: boolean;
  uncertainty?: HclUncertaintySettings;
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
  HclCptGenerator,
  HclCptGeneratorUncertainty,
  HclFragilityDemand,
  HclPgaBin,
  HclPgaConversion,
  HclEventBinding,
  HclTrueStateIds,
  HclBayesianNetworkReference,
  HclFaultTreeReference,
  HclBaseEvidence,
  HclEvidenceScenario,
  HclHazardGridDefinition,
  HclSampler,
  HclBasicEventUncertainty,
  HclCptRowUncertainty,
  HclUncertaintySettings,
  HclSolverSettings,
  HclConfigurationDefinition,
};
