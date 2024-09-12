/**
 * Represents a single validation rule with a regex pattern and an associated error message.
 */
export interface ValidationRule {
  /** The regex pattern as a string. */
  regex: string;
  /** The error message to display if the validation fails. */
  error: string;
}
