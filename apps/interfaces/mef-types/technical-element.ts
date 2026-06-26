import { Named, Unique } from "./core/meta";
import { BaseAssumption } from "./core/documentation";
import { VersionInfo } from "./core/version";
import {
  CapabilityCategory,
  CommentCollection,
  PlantStage,
  ReviewerReference,
  SRConformance,
  WorkflowHistoryEntry,
  WorkflowState,
} from "./core/pra-common";

export const TECHNICAL_ELEMENT_CODES = {
  POS: "PLANT_OPERATING_STATE_ANALYSIS",
  IE: "INITIATING_EVENT_ANALYSIS",
  ES: "EVENT_SEQUENCE_ANALYSIS",
  SC: "SUCCESS_CRITERIA_DEVELOPMENT",
  SY: "SYSTEMS_ANALYSIS",
  HRA: "HUMAN_RELIABILITY_ANALYSIS",
  DA: "DATA_ANALYSIS",
  ESQ: "EVENT_SEQUENCE_QUANTIFICATION",
  MS: "MECHANISTIC_SOURCE_TERM_ANALYSIS",
  RC: "RADIOLOGICAL_CONSEQUENCE_ANALYSIS",
  RI: "RISK_INTEGRATION",
  FL: "INTERNAL_FLOOD_PRA",
  F: "INTERNAL_FIRE_PRA",
  S: "SIESMIC_PRA",
  HS: "HAZARDS_SCREENING_ANALYSIS",
  W: "HIGH WINDS PRA",
  XF: "EXTERNAL_FLOODING_PRA",
  O: "OTHER_HAZARDS_PRA",
  CC: "PRA_CONFIGURATION_CONTROL",
  NM: "NEWLY_DEVELOPED_METHOD",
  UNK: "UNKNOWN",
} as const;

export type TechnicalElementCode = keyof typeof TECHNICAL_ELEMENT_CODES;

export enum TechnicalElementTypes {
  UNKNOWN = "unknown",
  PLANT_OPERATING_STATES_ANALYSIS = "plant-operating-states-analysis",
  INITIATING_EVENT_ANALYSIS = "initiating-event-analysis",
  EVENT_SEQUENCE_ANALYSIS = "event-sequence-analysis",
  SUCCESS_CRITERIA_DEVELOPMENT = "success-criteria-development",
  SYSTEMS_ANALYSIS = "systems-analysis",
  HUMAN_RELIABILITY_ANALYSIS = "human-reliability-analysis",
  DATA_ANALYSIS = "data-analysis",
  EVENT_SEQUENCE_QUANTIFICATION = "event-sequence-quantification",
  MECHANISTIC_SOURCE_TERM_ANALYSIS = "mechanistic-source-term-analysis",
  CONSEQUENCE_ANALYSIS = "consequence-analysis",
  RISK_INTEGRATION = "risk-integration",
  INTERNAL_FLOOD_PRA = "internal-flood-pra",
  INTERNAL_FIRE_PRA = "internal-fire-pra",
  SEISMIC_PRA = "seismic-pra",
  HAZARDS_SCREENING_ANALYSIS = "hazards-screening-analysis",
  HIGH_WINDS_PRA = "high-winds-pra",
  EXTERNAL_FLOODING_PRA = "external-flooding-pra",
  OTHER_HAZARDS_PRA = "other-hazards-pra",
  PRA_CONFIGURATION_CONTROL = "pra-configuration-control",
  NEWLY_DEVELOPED_METHOD = "newly-developed-method",
}

// Additional
export interface PlantIdentity {
  name: string;
  vendor: string;
  reactorType: string;
  thermalPower: string;
  primaryCoolant: string;
  intermediateCoolant?: string;
  powerConversionFluid?: string;
  siteName?: string;
  // Modules per site (set in step 01 scope); used for per-module vs per-site frequency conversion
  numberOfModules?: number;
}

export interface TechnicalElementMetadata {
  versionInfo: VersionInfo;
  analysisDate: string;
  analysts: string[];
  reviewers: ReviewerReference[];
  scope: string;
  limitations: string[];
  lastModifiedDate: string;
  lastModifiedBy: string;
  // Additional
  plantIdentity?: PlantIdentity;
}

export interface TechnicalElement<T extends TechnicalElementTypes> extends Unique, Named {
  type: T;
  version: string;
  created: string;
  modified: string;
  owner?: string;
  tags?: string[];
  commonAssumptions?: BaseAssumption[];
  references?: {
    technicalElementId: string;
    technicalElementType: TechnicalElementTypes;
    description: string;
  }[];

  workflowState: WorkflowState;
  workflowHistory: WorkflowHistoryEntry[];
  capabilityCategory?: CapabilityCategory;
  plantStage: PlantStage;
  metadata: TechnicalElementMetadata;
  conformanceMatrix: SRConformance[];
  internalReviewComments: CommentCollection;
  activePeerReviewIds: string[];
  activeAuditIds: string[];
}
