/**
 * @packageDocumentation
 * @module technical_elements.core
 * @description Core patterns, enums, and types shared across technical elements
 */

/**
 * Common ID patterns used throughout the technical elements
 * @memberof technical_elements.core
 */
export const IdPatterns = {
    /** Pattern for Plant Operating State IDs */
    STATE: "^POS-[A-Z0-9-]+$",
    /** Pattern for Sequence IDs */
    SEQUENCE: "^SEQ-[A-Z0-9-]{4,}",
    /** Pattern for Component IDs */
    COMPONENT: "^CMP-[A-Z0-9-]+$",
    /** Pattern for Failure Mode IDs */
    FAILURE_MODE: "^FM-[A-Z0-9-]+$"
  } as const;

/**
 * Standardized levels for expressing importance, impact, or significance in probabilistic risk assessment
 * @description Provides consistent categorization of significance levels across the PRA technical elements
 * @example
 * const significance: ImportanceLevel = ImportanceLevel.HIGH;
 * @memberof technical_elements.core.enums
 */
export enum ImportanceLevel {
  /** High importance - used for significant risk contributors or major impacts */
  HIGH = "HIGH",
  
  /** Medium importance - used for moderate risk contributors or notable impacts */
  MEDIUM = "MEDIUM",
  
  /** Low importance - used for minor risk contributors or minimal impacts */
  LOW = "LOW"
}