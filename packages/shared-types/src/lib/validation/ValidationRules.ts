import { NonEmptyArray } from "../types/ObjectTypes";
import { RegexValidationRule } from "./RegexValidationRule";
import { ValidationResult } from "./ValidationResult";

/**
 * Applies a set of validation rules to a given query string.
 *
 * @param query - The string to validate.
 * @param validations - An array of {@link RegexValidationRule} objects, each containing a regex pattern and an error message.
 * @returns A {@link ValidationResult} object containing a `valid` flag and an `errors` array.
 *
 * @example
 * ```typescript
 * const query = "test@example.com";
 * const validations: ValidationRule[] = [
 *   { regex: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$", error: "Invalid email format." }
 * ];
 * const result = ApplyValidationRules(query, validations);
 * console.log(result); // { valid: true, errors: [] }
 * ```
 */
export const ApplyRegexRule = (
  query: string,
  validations?: NonEmptyArray<RegexValidationRule> | RegexValidationRule[],
): ValidationResult => {
  const result: ValidationResult = {
    valid: true,
    errors: [],
  };

  validations?.forEach((validation: RegexValidationRule) => {
    const regex = new RegExp(validation.regex);
    if (!regex.test(query)) {
      result.valid = false;
      result.errors.push(validation.error);
    }
  });

  return result;
};
