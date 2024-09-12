import { ApplyValidationRules } from "./ValidationRules";
import { ValidationRule } from "./ValidationRule";

describe("ApplyValidationRules", () => {
  it("validates email addresses correctly", () => {
    const emailValidation: ValidationRule[] = [
      { regex: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$", error: "Invalid email format." },
    ];

    const validEmail = "test@example.com";
    const invalidEmail = "test@example";

    expect(ApplyValidationRules(validEmail, emailValidation)).toEqual({ valid: true, errors: [] });
    expect(ApplyValidationRules(invalidEmail, emailValidation)).toEqual({
      valid: false,
      errors: ["Invalid email format."],
    });
  });

  it("ensures strings are URL safe", () => {
    const urlSafeValidation: ValidationRule[] = [
      { regex: "^[\\w-]*$", error: "String contains URL unsafe characters." },
    ];

    const safeString = "valid_string-123";
    const unsafeString = "invalid/string?123";

    expect(ApplyValidationRules(safeString, urlSafeValidation)).toEqual({ valid: true, errors: [] });
    expect(ApplyValidationRules(unsafeString, urlSafeValidation)).toEqual({
      valid: false,
      errors: ["String contains URL unsafe characters."],
    });
  });

  it("checks for point estimate probabilities (between 0 and 1)", () => {
    const probabilityValidation: ValidationRule[] = [
      { regex: "^(0(\\.\\d+)?|1(\\.0+)?)$", error: "Value must be a probability between 0 and 1." },
    ];

    const validProbability = "0.5";
    const invalidProbability1 = "-0.1";
    const invalidProbability2 = "1.01";

    expect(ApplyValidationRules(validProbability, probabilityValidation)).toEqual({ valid: true, errors: [] });
    expect(ApplyValidationRules(invalidProbability1, probabilityValidation)).toEqual({
      valid: false,
      errors: ["Value must be a probability between 0 and 1."],
    });
    expect(ApplyValidationRules(invalidProbability2, probabilityValidation)).toEqual({
      valid: false,
      errors: ["Value must be a probability between 0 and 1."],
    });
  });

  it("validates date formats correctly (YYYY-MM-DD)", () => {
    const dateValidation: ValidationRule[] = [
      { regex: "^\\d{4}-\\d{2}-\\d{2}$", error: "Invalid date format. Use YYYY-MM-DD." },
    ];

    const validDate = "2023-01-01";
    const invalidDate = "01-01-2023";

    expect(ApplyValidationRules(validDate, dateValidation)).toEqual({ valid: true, errors: [] });
    expect(ApplyValidationRules(invalidDate, dateValidation)).toEqual({
      valid: false,
      errors: ["Invalid date format. Use YYYY-MM-DD."],
    });
  });

  it("checks password strength", () => {
    const passwordValidation: ValidationRule[] = [
      {
        regex: "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)[a-zA-Z\\d]{8,}$",
        error:
          "Password must be at least 8 characters long, include uppercase and lowercase letters, and contain at least one number.",
      },
    ];

    const strongPassword = "ValidPassword1";
    const weakPassword = "weak";

    expect(ApplyValidationRules(strongPassword, passwordValidation)).toEqual({ valid: true, errors: [] });
    expect(ApplyValidationRules(weakPassword, passwordValidation)).toEqual({
      valid: false,
      errors: [
        "Password must be at least 8 characters long, include uppercase and lowercase letters, and contain at least one number.",
      ],
    });
  });

  it("validates hexadecimal color codes", () => {
    const hexColorValidation: ValidationRule[] = [
      { regex: "^#(?:[0-9a-fA-F]{3}){1,2}$", error: "Invalid hexadecimal color code." },
    ];

    const validHex = "#fff";
    const invalidHex = "#zzz";

    expect(ApplyValidationRules(validHex, hexColorValidation)).toEqual({ valid: true, errors: [] });
    expect(ApplyValidationRules(invalidHex, hexColorValidation)).toEqual({
      valid: false,
      errors: ["Invalid hexadecimal color code."],
    });
  });

  it("handles empty strings and edge cases", () => {
    const nonEmptyValidation = [{ regex: ".+", error: "String cannot be empty." }];

    const edgeCaseValidation = [{ regex: "^edge$", error: 'String must exactly be "edge".' }];

    expect(ApplyValidationRules("", nonEmptyValidation)).toEqual({
      valid: false,
      errors: ["String cannot be empty."],
    });
    expect(ApplyValidationRules("edge", edgeCaseValidation)).toEqual({ valid: true, errors: [] });
    expect(ApplyValidationRules("notedge", edgeCaseValidation)).toEqual({
      valid: false,
      errors: ['String must exactly be "edge".'],
    });
  });
});
