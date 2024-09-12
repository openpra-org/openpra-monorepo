/**
 * Represents the result of applying validation rules to a query.
 */
export interface ValidationResult {
  /** Indicates whether the query passed all validation rules. */
  valid: boolean;
  /** An array of error messages for each validation rule that failed. */
  errors: string[];
}
