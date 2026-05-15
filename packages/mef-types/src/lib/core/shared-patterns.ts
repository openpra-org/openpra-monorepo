import { Unique } from "./meta";
import { DistributionType } from "../data-analysis/data-analysis";
export const IdPatterns = {
  STATE: "^POS-[A-Z0-9-]+$",
  SEQUENCE: "^SEQ-[A-Z0-9-]{4,}",
  COMPONENT: "^CMP-[A-Z0-9-]+$",
  FAILURE_MODE: "^FM-[A-Z0-9-]+$",
  SUCCESS_CRITERIA_ID: "^SC-[A-Z0-9-]+$",
  SYSTEM_ID: "^SYS-[A-Z0-9-]+$",
  HUMAN_ACTION_ID: "^HRA-[0-9]+$",
  SOURCE_TERM_ID: "^ST-[0-9]+$",
  RELEASE_CATEGORY_ID: "^RC-[0-9]+$",
  EVENT_SEQUENCE_ID: "^ES-[0-9]+$",
  EVENT_SEQUENCE_FAMILY_ID: "^ESF-[0-9]+$",
} as const;
export type SuccessCriteriaId = string;
export enum ImportanceLevel {
  HIGH = "HIGH",
  MEDIUM = "MEDIUM",
  LOW = "LOW",
}
export interface SensitivityStudy extends Unique {
  name?: string;
  description: string;
  variedParameters: string[];
  parameterRanges: Record<string, [number, number]>;
  results?: string;
  insights?: string;
  impact?: string;
  modelUncertaintyId?: string;
  elementSpecificProperties?: Record<string, unknown>;
}
export interface BaseUncertaintyAnalysis extends Unique {
  propagationMethod: "MONTE_CARLO" | "LATIN_HYPERCUBE" | "ANALYTICAL" | "OTHER";
  numberOfSamples?: number;
  randomSeed?: number;
  modelUncertainties: {
    uncertaintyId: string;
    description: string;
    impact: string;
    isQuantified: boolean;
    treatmentApproach: string;
  }[];
  sensitivityStudies?: SensitivityStudy[];
}
export enum ScreeningStatus {
  RETAINED = "RETAINED",
  SCREENED_OUT = "SCREENED_OUT",
  MERGED = "MERGED",
  FULL_ANALYSIS = "FULL_ANALYSIS",
  QUALITATIVE_ANALYSIS = "QUALITATIVE_ANALYSIS",
}
export interface ScreeningCriteria {
  frequency_criterion?: number;
  risk_criterion?: number;
  damage_frequency_criterion?: number;
  basis: string;
  screened_out_elements: {
    element_id: string;
    reason: string;
    justification: string;
  }[];
  elementSpecificProperties?: Record<string, unknown>;
}
export enum RiskMetricType {
  INDIVIDUAL_EARLY_FATALITY_RISK = "INDIVIDUAL_EARLY_FATALITY_RISK",
  INDIVIDUAL_LATENT_CANCER_FATALITY_RISK = "INDIVIDUAL_LATENT_CANCER_FATALITY_RISK",
  POPULATION_DOSE = "POPULATION_DOSE",
  LAND_CONTAMINATION_AREA = "LAND_CONTAMINATION_AREA",
  ECONOMIC_COST = "ECONOMIC_COST",
  CUSTOM = "CUSTOM",
}
export enum RiskSignificanceCriteriaType {
  QHO = "QHO",
  SAFETY_GOAL = "SAFETY_GOAL",
  DESIGN_OBJECTIVE = "DESIGN_OBJECTIVE",
  OTHER = "OTHER",
}
