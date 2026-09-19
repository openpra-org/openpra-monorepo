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

// HCL_MH hazard_convolution.py::ensure_hazard_convolution_supported.
export const HCL_HAZARD_CONVOLUTION_POINT_ONLY =
  "Hazard convolution supports point runs only. Select probability or use evidence scenarios.";
