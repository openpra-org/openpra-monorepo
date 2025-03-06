/**
 * @packageDocumentation
 * @module technical_elements.core
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