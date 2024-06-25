/**
 * JSON schema for the OpenPRA MEF Model
 */
export type OpenPRAModelSchema = OpenPRAModelSchema1 & OpenPRAModelSchema2;
export type OpenPRAModelSchema1 = InternalEventSchema;
/**
 * Schema for semantic versioning
 */
export type SemanticVersionSchema = string;
export type OpenPRAModelSchema2 =
  | SeismicPRASchema
  | HighWindsPRASchema
  | ExternalFloodPRASchema
  | InternalFirePRASchema
  | InternalFloodPRASchema
  | HazardPRASchema;
/**
 * JSON schema for the Seismic Probabilistic Risk Assessment Model
 */
export type SeismicPRASchema = SeismicPRASchema1 & SeismicPRASchema2;
export type SeismicPRASchema1 = InternalEventSchema;
/**
 * JSON schema for the High Winds Hazard Probabilistic Risk Assessment Model
 */
export type HighWindsPRASchema = HighWindsPRASchema1 & HighWindsPRASchema2;
export type HighWindsPRASchema1 = InternalEventSchema;
/**
 * JSON schema for the External Flood Probabilistic Risk Assessment Model
 */
export type ExternalFloodPRASchema = ExternalFloodPRASchema1 & ExternalFloodPRASchema2;
export type ExternalFloodPRASchema1 = InternalEventSchema;
/**
 * JSON schema for the Internal Fire Probabilistic Risk Assessment Model
 */
export type InternalFirePRASchema = InternalFirePRASchema1 & InternalFirePRASchema2;
export type InternalFirePRASchema1 = InternalEventSchema;
/**
 * JSON schema for the Internal Flood Probabilistic Risk Assessment Model
 */
export type InternalFloodPRASchema = InternalFloodPRASchema1 & InternalFloodPRASchema2;
export type InternalFloodPRASchema1 = InternalEventSchema;
/**
 * JSON schema for a Hazard Probabilistic Risk Assessment Model
 */
export type HazardPRASchema = HazardPRASchema1 & HazardPRASchema2;
export type HazardPRASchema1 = InternalEventSchema;

/**
 * JSON schema for the OpenPRA MEF Internal Event
 */
export interface InternalEventSchema {
  version?: SemanticVersionSchema;
  "operating-state-analysis"?: OperatingStateAnalysisSchema;
  "initiating-event-analysis"?: InitiatingEventAnalysisSchema;
  "event-sequence-analysis"?: EventSequenceAnalysisSchema;
  "success-criteria-development"?: SuccessCriteriaDevelopmentSchema;
  "systems-analysis"?: SystemsAnalysisSchema;
  "human-reliability-analysis"?: HumanReliabilityAnalysisSchema;
  "data-analysis"?: DataAnalysisSchema;
  "event-sequence-quantification"?: EventSequenceQuantificationSchema;
  "mechanistic-source-terms"?: MechanisticSourceTermsSchema;
  "consequence-analysis"?: ConsequenceAnalysisSchema;
  "risk-integration"?: RiskIntegrationSchema;
}
/**
 * Plant Operating State Analysis Schema
 */
export interface OperatingStateAnalysisSchema {}
/**
 * Initiating Event Analysis Schema
 */
export interface InitiatingEventAnalysisSchema {}
/**
 * Event Sequence Analysis Schema
 */
export interface EventSequenceAnalysisSchema {}
/**
 * Success Criteria Development Schema
 */
export interface SuccessCriteriaDevelopmentSchema {}
/**
 * Systems Analysis Schema
 */
export interface SystemsAnalysisSchema {}
/**
 * Human Reliability Analysis Schema
 */
export interface HumanReliabilityAnalysisSchema {}
/**
 * Data Analysis Schema
 */
export interface DataAnalysisSchema {}
/**
 * Event Sequence Quantification Schema
 */
export interface EventSequenceQuantificationSchema {}
/**
 * Mechanistic Source Terms Schema
 */
export interface MechanisticSourceTermsSchema {}
/**
 * Consequence Analysis Schema
 */
export interface ConsequenceAnalysisSchema {}
/**
 * Risk Integration Schema
 */
export interface RiskIntegrationSchema {}
export interface SeismicPRASchema2 {
  /**
   * Details.
   */
  "seismic-hazard-analysis"?: {};
  /**
   * Details.
   */
  "seismic-fragility-analysis"?: {};
  /**
   * Details.
   */
  "seismic-plant-response-model"?: {};
}
export interface HighWindsPRASchema2 {
  /**
   * Details.
   */
  "high-winds-hazard-analysis"?: {};
  /**
   * Details.
   */
  "high-winds-fragility-analysis"?: {};
  /**
   * Details.
   */
  "high-winds-plant-response-model"?: {};
}
export interface ExternalFloodPRASchema2 {
  /**
   * Details.
   */
  "external-flood-hazard-analysis"?: {};
  /**
   * Details.
   */
  "external-flood-fragility-analysis"?: {};
  /**
   * Details.
   */
  "external-flood-plant-response-analysis"?: {};
}
export interface InternalFirePRASchema2 {
  /**
   * Details.
   */
  "internal-fire-plant-boundary-definition-and-partitioning"?: {};
  /**
   * Details.
   */
  "internal-fire-equipment-selection"?: {};
  /**
   * Details.
   */
  "internal-fire-cable-selection-and-location"?: {};
  /**
   * Details.
   */
  "internal-fire-qualitative-screening"?: {};
  /**
   * Details.
   */
  "internal-fire-plant-response-model"?: {};
  /**
   * Details.
   */
  "internal-fire-scenario-selection-and-analysis"?: {};
  /**
   * Details.
   */
  "internal-fire-ignition-frequency"?: {};
  /**
   * Details.
   */
  "internal-fire-circuit-failure-analysis"?: {};
  /**
   * Details.
   */
  "internal-fire-human-reliability-analysis"?: {};
  /**
   * Details.
   */
  "internal-fire-event-sequence-quantification"?: {};
}
export interface InternalFloodPRASchema2 {
  /**
   * Details the partitioning of the plant into different zones for flood analysis.
   */
  "internal-flood-plant-partitioning"?: {};
  /**
   * Identifies and characterizes potential sources of internal flooding.
   */
  "internal-flood-sources-identification-and-characterization"?: {};
  /**
   * Develops scenarios for internal flooding based on identified sources and plant partitioning.
   */
  "internal-flood-scenarios-development"?: {};
  /**
   * Lists and describes initiating events for internal flood scenarios.
   */
  "internal-flood-initiating-events"?: {};
  /**
   * Analyzes the response of the plant systems to internal flooding events.
   */
  "internal-flood-plant-response"?: {};
  /**
   * Assesses the reliability of human actions in response to internal flooding.
   */
  "internal-flood-human-reliability-analysis"?: {};
  /**
   * Quantifies the event sequences resulting from internal flood initiating events.
   */
  "internal-flood-event-sequence-quantification"?: {};
}
export interface HazardPRASchema2 {
  /**
   * Details.
   */
  "hazard-analysis"?: {};
  /**
   * Details.
   */
  "fragility-analysis"?: {};
  /**
   * Details.
   */
  "plant-response-model"?: {};
}
