import typia from "typia";

/**
 * Mapping of technical element codes to their full names
 * 
 * @remarks
 * This constant provides a mapping between abbreviated codes and their corresponding
 * full technical element names. The codes adhere to the latest ANS standards.
 */
export const TECHNICAL_ELEMENT_CODES = {
  'POS': 'PLANT_OPERATING_STATE_ANALYSIS',
  'IE': 'INITIATING_EVENT_ANALYSIS',
  'ES': 'EVENT_SEQUENCE_ANALYSIS',
  'SC': 'SUCCESS_CRITERIA_DEVELOPMENT',
  'SY': 'SYSTEMS_ANALYSIS',
  'HRA': 'HUMAN_RELIABILITY_ANALYSIS',
  'DA': 'DATA_ANALYSIS',
  'ESQ': 'EVENT_SEQUENCE_QUANTIFICATION',
  'MS': 'MECHANISTIC_SOURCE_TERM_ANALYSIS',
  'RC': 'RADIOLOGICAL_CONSEQUENCE_ANALYSIS',
  'RI': 'RISK_INTEGRATION',
  'FL': 'INTERNAL_FLOOD_PRA',
  'F': 'INTERNAL_FIRE_PRA',
  'S': 'SIESMIC_PRA',
  'HS': 'HAZARDS_SCREENING_ANALYSIS',
  'W': 'HIGH WINDS PRA',
  'XF': 'EXTERNAL_FLOODING_PRA',
  'O': 'OTHER_HAZARDS_PRA',
  'UNK': 'UNKNOWN'
} as const;

/**
 * Type representing valid technical element codes
 */
export type TechnicalElementCode = keyof typeof TECHNICAL_ELEMENT_CODES;


/**
 * Enum representing the types of PRA (Probabilistic Risk Assessment) technical elements.
 * @remarks
 * Each type corresponds to a specific analysis or assessment category.
 * The values are kebab-case strings for API compatibility.
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
  INTERNAL_FLOOD_PRA = "internal-flood-pra",
  INTERNAL_FIRE_PRA = "internal-fire-pra",
  SEISMIC_PRA = "seismic-pra",
  HAZARDS_SCREENING_ANALYSIS = "hazards-screening-analysis",
  HIGH_WINDS_PRA = "high-winds-pra",
  EXTERNAL_FLOODING_PRA = "external-flooding-pra",
  OTHER_HAZARDS_PRA = "other-hazards-pra"
}

/**
 * Interface representing a technical element with a specific type and code.
 *@remarks
 * This interface defines the structure of a technical element in the system.
 * It includes both the full type and the abbreviated code for the element.
 * @typeparam TechnicalElementType - The type of the technical element.
 *
 * @example
 * ```typescript
 *    const element: TechnicalElement<TechnicalElementTypes> = {
 *   "technical-element-type": TechnicalElementTypes.DATA_ANALYSIS,
 *   "technical-element-code": "DA"
 * };
 */
export interface TechnicalElement<TechnicalElementType> {
  "technical-element-type": TechnicalElementType;
  "technical-element-code": TechnicalElementCode;
}

/**
 * JSON schema for validating {@link TechnicalElementTypes}.
 * @remarks
 * This schema is generated using typia and provides runtime validation
 * for technical element types. It ensures that only valid enum values
 * are used throughout the application.
 * @example
 * ```
 * const isValid = TechnicalElementTypesSchema.validate(someData);
 * ```
 */
export const TechnicalElementTypesSchema = typia.json.application<[TechnicalElementTypes], "3.0">();

/**
 * Runtime validation for technical elements
 * 
 * @remarks
 * Provides runtime type checking for technical elements including both
 * their type and code. This ensures data consistency throughout the application.
 */
export const validateTechnicalElement = typia.createValidate<TechnicalElement<TechnicalElementTypes>>();

/**
 * Type guard for technical elements
 * 
 * @remarks
 * A type guard function that checks if a given object is a valid technical element.
 * This is useful for runtime type checking and validation.
 */
export const isTechnicalElement = typia.createIs<TechnicalElement<TechnicalElementTypes>>();
