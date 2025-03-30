import typia from "typia";
import { Named, Unique } from "./core/meta";
import { BaseAssumption } from "./core/documentation";
import { VersionInfo, SCHEMA_VERSION } from "./core/version";

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
 * Interface representing common metadata for all technical elements.
 * 
 * @remarks
 * This interface defines the standard metadata that should be present in all technical elements.
 * It includes fields for version information, analysis dates, analysts/reviewers, approval status,
 * and scope/limitations.
 * 
 * @example
 * ```typescript
 * const metadata: TechnicalElementMetadata = {
 *   versionInfo: {
 *     version: "1.0.0",
 *     lastUpdated: "2024-03-30",
 *     schemaVersion: "1.0.0",
 *     deprecatedFields: []
 *   },
 *   analysisDate: "2023-03-15",
 *   analysts: ["John Doe"],
 *   reviewers: ["Jane Smith"],
 *   approvalStatus: "APPROVED",
 *   scope: "Full plant analysis",
 *   limitations: ["Limited to normal operating conditions"],
 *   lastModifiedDate: "2023-03-20",
 *   lastModifiedBy: "John Doe"
 * };
 * ```
 */
export interface TechnicalElementMetadata {
  /** Version information for the technical element */
  versionInfo: VersionInfo;
  
  /** Date when the analysis was performed */
  analysisDate: string;
  
  /** List of analysts who performed the analysis */
  analysts: string[];
  
  /** List of reviewers who reviewed the analysis */
  reviewers: string[];
  
  /** Current approval status of the analysis */
  approvalStatus: "DRAFT" | "IN_REVIEW" | "APPROVED" | "REJECTED";
  
  /** Scope of the analysis */
  scope: string;
  
  /** List of limitations or assumptions */
  limitations: string[];
  
  /** Date when the element was last modified */
  lastModifiedDate: string;
  
  /** User who last modified the element */
  lastModifiedBy: string;
}

/**
 * Base interface for all technical elements in the PRA model.
 * 
 * Technical elements are the major analytical tasks that, when completed in an integrated manner,
 * make up a PRA model. Each technical element represents a specific aspect of the PRA model.
 * 
 * @typeParam T - The type of technical element
 */
export interface TechnicalElement<T extends TechnicalElementTypes> extends Unique, Named {
    /**
     * The type of technical element
     */
    type: T;

    /**
     * The version of the technical element
     */
    version: string;

    /**
     * The date the technical element was created
     */
    created: string;

    /**
     * The date the technical element was last modified
     */
    modified: string;

    /**
     * The owner of the technical element
     */
    owner?: string;

    /**
     * The status of the technical element
     */
    status?: "DRAFT" | "REVIEW" | "APPROVED" | "DEPRECATED";

    /**
     * The description of the technical element
     */
    description?: string;

    /**
     * Tags associated with the technical element
     */
    tags?: string[];
    
    /**
     * Common assumptions that apply across this technical element
     * Using the standardized BaseAssumption interface
     */
    commonAssumptions?: BaseAssumption[];
    
    /**
     * References to other technical elements
     */
    references?: {
        technicalElementId: string;
        technicalElementType: TechnicalElementTypes;
        description: string;
    }[];
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

/**
 * Runtime validation for technical element metadata
 * 
 * @remarks
 * Provides runtime type checking for technical element metadata.
 * This ensures data consistency throughout the application.
 */
export const validateTechnicalElementMetadata = typia.createValidate<TechnicalElementMetadata>();

/**
 * Type guard for technical element metadata
 * 
 * @remarks
 * A type guard function that checks if a given object is valid technical element metadata.
 * This is useful for runtime type checking and validation.
 */
export const isTechnicalElementMetadata = typia.createIs<TechnicalElementMetadata>();
