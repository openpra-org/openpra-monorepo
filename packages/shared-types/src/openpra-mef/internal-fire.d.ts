/**
 * JSON schema for the Internal Fire Probabilistic Risk Assessment Model
 */
export type InternalFirePRASchema = InternalFirePRASchema1 & InternalFirePRASchema2;
export type InternalFirePRASchema1 = InternalEventSchema;
/**
 * Schema for semantic versioning
 */
export type SemanticVersionSchema = string;

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
