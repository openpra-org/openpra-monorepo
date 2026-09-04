import type { HclConfigurationDefinition } from "interfaces-mef-types/modeling";
import type { WorkbookModelId } from "../shared";

interface HclConfigurationModel extends HclConfigurationDefinition {
  modelId: WorkbookModelId;
  code: string;
  name: string;
  description: string;
}

export type {
  HclBayesianNetworkReference,
  HclFaultTreeReference,
  HclBaseEvidence,
  HclEvidenceScenario,
  HclHazardGridDefinition,
  HclBasicEventProbabilityDistribution,
  HclBasicEventUncertainty,
  HclCptRowUncertainty,
  HclUncertaintySettings,
  HclSolverSettings,
  HclConfigurationDefinition,
} from "interfaces-mef-types/modeling";
export type { HclConfigurationModel };
