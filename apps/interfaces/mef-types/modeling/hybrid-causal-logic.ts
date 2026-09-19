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

type HclBasicEventProbabilityDistribution =
  | { family: "BETA"; alpha: number; beta: number }
  | { family: "LOGNORMAL"; median: number; errorFactor: number }
  | { family: "UNIFORM"; lower: number; upper: number }
  | { family: "NORMAL"; mean: number; standardDeviation: number }
  | { family: "LOGITNORMAL"; mu: number; sigma: number }
  | { family: "GAMMA"; shape: number; scale: number }
  | { family: "EXPONENTIAL"; rate: number }
  | { family: "TRIANGULAR"; lower: number; mode: number; upper: number };

type HclSampler = "MC" | "LHS";

interface HclBasicEventUncertainty {
  faultTreeBasicEvent: FaultTreeBasicEventCatalogueReference;
  distribution: HclBasicEventProbabilityDistribution;
}

interface HclCptRowUncertainty {
  bayesianNetworkNode: BayesianNetworkNodeReference;
  cptRowId: WorkbookEntityId;
  prior: HclCptPrior;
}

type HclCptPrior =
  | { family: "BETA"; alpha: number; beta: number; trueStateId: WorkbookEntityId }
  | { family: "DIRICHLET"; alpha: number[] };

type HclCptGenerator =
  | { type: "seismic_fragility"; pgaParentId: WorkbookEntityId; theta: number; betaR: number; betaU: number; trueStateId: WorkbookEntityId; falseStateId: WorkbookEntityId; pgaCenters: { stateId: WorkbookEntityId; value: number }[] }
  | { type: "seismic_pga_bins"; noneStateId: WorkbookEntityId; missionTime: number; frequencyToProbability: "poisson" | "linear"; bins: { stateId: WorkbookEntityId; medianFrequency: number; errorFactor95: number }[] };

interface HclCptGeneratorUncertainty {
  bayesianNetworkNode: BayesianNetworkNodeReference;
  generator: HclCptGenerator;
}

interface HclUncertaintySettings {
  sampleCount: number;
  seed: number;
  /** Selects HCL_MH's corresponding FT and BN routines. Omitted: MC. */
  sampler?: HclSampler;
  /** Optional clipping of sampled Beta and fragility probabilities; zero disables it. */
  cptProbabilityClipEpsilon?: number;
  basicEventDistributions: HclBasicEventUncertainty[];
  cptRowDistributions: HclCptRowUncertainty[];
  /** Source order: row-prior nodes first, then generators in this order. */
  cptGenerators?: HclCptGeneratorUncertainty[];
}

/** Normalize the former FT-only field when reading saved configurations. */
export function normalizeHclUncertaintySampler(
  settings: HclUncertaintySettings & { basicEventSampler?: HclSampler },
): HclUncertaintySettings {
  const { basicEventSampler, ...current } = settings;
  return { ...current, sampler: current.sampler ?? basicEventSampler ?? "MC" };
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
  HclCptPrior,
  HclEventBinding,
  HclTrueStateIds,
  HclBayesianNetworkReference,
  HclFaultTreeReference,
  HclBaseEvidence,
  HclEvidenceScenario,
  HclHazardGridDefinition,
  HclBasicEventProbabilityDistribution,
  HclSampler,
  HclBasicEventUncertainty,
  HclCptRowUncertainty,
  HclUncertaintySettings,
  HclSolverSettings,
  HclConfigurationDefinition,
};
