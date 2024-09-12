/**
 * Represents a single validation rule with a regex pattern and an associated error message.
 */
export interface ValidationRule {
  /** The regex pattern as a string. */
  regex: string;
  /** The error message to display if the validation fails. */
  error: string;
}

export const EmailValidationRule: ValidationRule = {
  regex: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$",
  error: "Invalid email format.",
};

export const EmptyStringValidationRule: ValidationRule = {
  regex: "^[\\s]*$",
  error: "String must not be empty.",
};
