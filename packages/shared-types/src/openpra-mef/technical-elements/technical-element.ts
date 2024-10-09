import typia from "typia";

/**
 * Enum representing the types of PRA (Probabilistic Risk Assessment) technical elements.
 *
 * @example
 * ```
 * const type: TechnicalElementTypes = TechnicalElementTypes.PLANT_OPERATING_STATES_ANALYSIS;
 * ```
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

/**
 * Interface representing a technical element with a specific type.
 *
 * @typeparam TechnicalElementType - The type of the technical element.
 *
 * @example
 * ```
 * const element: TechnicalElement<TechnicalElementTypes> = {
 *   "technical-element-type": TechnicalElementTypes.DATA_ANALYSIS
 * };
 * ```
 */
export interface TechnicalElement<TechnicalElementType> {
  "technical-element-type": TechnicalElementType;
}

/**
 * JSON schema for validating {@link TechnicalElementTypes}.
 *
 * @example
 * ```
 * const isValid = TechnicalElementTypesSchema.validate(someData);
 * ```
 */
export const TechnicalElementTypesSchema = typia.json.application<[TechnicalElementTypes], "3.0">();
