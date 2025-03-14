/**
 * @packageDocumentation
 * @module technical_elements.core
 * @description Core patterns, enums, and types shared across technical elements
 */

/**
 * Common ID patterns used throughout the technical elements
 * @memberof technical_elements.core
 * @group Shared Patterns
 */
export const IdPatterns = {
    /** Pattern for Plant Operating State IDs */
    STATE: "^POS-[A-Z0-9-]+$",
    /** Pattern for Sequence IDs */
    SEQUENCE: "^SEQ-[A-Z0-9-]{4,}",
    /** Pattern for Component IDs */
    COMPONENT: "^CMP-[A-Z0-9-]+$",
    /** Pattern for Failure Mode IDs */
    FAILURE_MODE: "^FM-[A-Z0-9-]+$",
    /** Pattern for Success Criteria IDs */
    SUCCESS_CRITERIA_ID: "^SC-[A-Z0-9-]+$",
    /** Pattern for System IDs */
    SYSTEM_ID: "^SYS-[A-Z0-9-]+$",
    /** Pattern for Human Action IDs */
    HUMAN_ACTION_ID: "^HRA-[0-9]+$",
    /** Pattern for Source Term IDs */
    SOURCE_TERM_ID: "^ST-[0-9]+$",
    /** Pattern for Release Category IDs */
    RELEASE_CATEGORY_ID: "^RC-[0-9]+$",
    /** Pattern for Event Sequence IDs */
    EVENT_SEQUENCE_ID: "^ES-[0-9]+$",
    /** Pattern for Event Sequence Family IDs */
    EVENT_SEQUENCE_FAMILY_ID: "^ESF-[0-9]+$"
  } as const;

/**
 * Standardized levels for expressing importance, impact, or significance in probabilistic risk assessment
 * @description Provides consistent categorization of significance levels across the PRA technical elements
 * @example
 * const significance: ImportanceLevel = ImportanceLevel.HIGH;
 * @memberof technical_elements.core.enums
 * @group Shared Patterns
 */
export enum ImportanceLevel {
  /** High importance - used for significant risk contributors or major impacts */
  HIGH = "HIGH",
  
  /** Medium importance - used for moderate risk contributors or notable impacts */
  MEDIUM = "MEDIUM",
  
  /** Low importance - used for minor risk contributors or minimal impacts */
  LOW = "LOW"
}