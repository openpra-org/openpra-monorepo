import { Unique } from "./meta";

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
