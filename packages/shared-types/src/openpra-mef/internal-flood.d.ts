/**
 * JSON schema for the Internal Flood Probabilistic Risk Assessment Model
 */
export type InternalFloodPRASchema = InternalFloodPRASchema1 & InternalFloodPRASchema2;
export type InternalFloodPRASchema1 = InternalEventSchema;
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
