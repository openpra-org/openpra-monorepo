import typia from "typia";

/**
 * enums describing types of PRA technical elements
 */
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
}

export interface TechnicalElement<TechnicalElementType> {
  "technical-element-type": TechnicalElementType;
}

export const TechnicalElementTypesSchema = typia.json.application<[TechnicalElementTypes], "3.0">();
