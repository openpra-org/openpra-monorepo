/**
 * Schema for semantic versioning
 */
export type SemanticVersionSchema = string;

/**
 * JSON schema for the OpenPRA model exchange format
 */
export interface OpenPRASchema {
  model: OpenPRAModelSchema;
}
/**
 * JSON schema for the OpenPRA MEF Model
 */
export interface OpenPRAModelSchema {
  version?: SemanticVersionSchema;
  "operating-state-analysis"?: OperatingStateAnalysis;
  "initiating-event-analysis"?: InitiatingEventAnalysis;
  "event-sequence-analysis"?: EventSequenceAnalysis;
  "success-criteria-development"?: SuccessCriteriaDevelopment;
  "systems-analysis"?: SystemsAnalysis;
  "human-reliability-analysis"?: HumanReliabilityAnalysis;
  "data-analysis"?: DataAnalysis;
  "mechanistic-source-terms"?: MechanisticSourceTerms;
  "consequence-analysis"?: ConsequenceAnalysis;
  "risk-integration"?: RiskIntegration;
}
/**
 * Plant Operating State Analysis Schema
 */
export interface OperatingStateAnalysis {}
export interface InitiatingEventAnalysis {}
export interface EventSequenceAnalysis {}
export interface SuccessCriteriaDevelopment {}
export interface SystemsAnalysis {}
export interface HumanReliabilityAnalysis {}
export interface DataAnalysis {}
export interface MechanisticSourceTerms {}
export interface ConsequenceAnalysis {}
export interface RiskIntegration {}
