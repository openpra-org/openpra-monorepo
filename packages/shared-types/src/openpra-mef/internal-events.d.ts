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
