import { ApplyRegexRule } from "./ValidationRules";
import { EmailValidationRule, RegexValidationRule } from "./RegexValidationRule";

describe("ApplyRegexRules", () => {
  it("validates email addresses correctly", () => {
    const emailValidation: RegexValidationRule[] = [
      { regex: "^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$", error: "Invalid email format." },
      EmailValidationRule,
    ];

    const validEmail = "test@example.com";
    const invalidEmail = "test@example";

    expect(ApplyRegexRule(validEmail, emailValidation)).toEqual({ valid: true, errors: [] });
    expect(ApplyRegexRule(invalidEmail, emailValidation)).toEqual({
      valid: false,
      errors: ["Invalid email format.", EmailValidationRule.error],
    });
  });

  it("ensures strings are URL safe", () => {
    const urlSafeValidation: RegexValidationRule[] = [
      { regex: "^[\\w-]*$", error: "String contains URL unsafe characters." },
    ];

    const safeString = "valid_string-123";
    const unsafeString = "invalid/string?123";

    expect(ApplyRegexRule(safeString, urlSafeValidation)).toEqual({ valid: true, errors: [] });
    expect(ApplyRegexRule(unsafeString, urlSafeValidation)).toEqual({
      valid: false,
      errors: ["String contains URL unsafe characters."],
    });
  });

  it("checks for point estimate probabilities (between 0 and 1)", () => {
    const probabilityValidation: RegexValidationRule[] = [
      { regex: "^(0(\\.\\d+)?|1(\\.0+)?)$", error: "Value must be a probability between 0 and 1." },
    ];

    const validProbability = "0.5";
    const invalidProbability1 = "-0.1";
    const invalidProbability2 = "1.01";

    expect(ApplyRegexRule(validProbability, probabilityValidation)).toEqual({ valid: true, errors: [] });
    expect(ApplyRegexRule(invalidProbability1, probabilityValidation)).toEqual({
      valid: false,
      errors: ["Value must be a probability between 0 and 1."],
    });
    expect(ApplyRegexRule(invalidProbability2, probabilityValidation)).toEqual({
      valid: false,
      errors: ["Value must be a probability between 0 and 1."],
    });
  });

  it("validates date formats correctly (YYYY-MM-DD)", () => {
    const dateValidation: RegexValidationRule[] = [
      { regex: "^\\d{4}-\\d{2}-\\d{2}$", error: "Invalid date format. Use YYYY-MM-DD." },
    ];

    const validDate = "2023-01-01";
    const invalidDate = "01-01-2023";

    expect(ApplyRegexRule(validDate, dateValidation)).toEqual({ valid: true, errors: [] });
    expect(ApplyRegexRule(invalidDate, dateValidation)).toEqual({
      valid: false,
      errors: ["Invalid date format. Use YYYY-MM-DD."],
    });
  });

  it("checks password strength", () => {
    const passwordValidation: RegexValidationRule[] = [
      {
        regex: "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)[a-zA-Z\\d]{8,}$",
        error:
          "Password must be at least 8 characters long, include uppercase and lowercase letters, and contain at least one number.",
      },
    ];

    const strongPassword = "ValidPassword1";
    const weakPassword = "weak";

    expect(ApplyRegexRule(strongPassword, passwordValidation)).toEqual({ valid: true, errors: [] });
    expect(ApplyRegexRule(weakPassword, passwordValidation)).toEqual({
      valid: false,
      errors: [
        "Password must be at least 8 characters long, include uppercase and lowercase letters, and contain at least one number.",
      ],
    });
  });

  it("validates hexadecimal color codes", () => {
    const hexColorValidation: RegexValidationRule[] = [
      { regex: "^#(?:[0-9a-fA-F]{3}){1,2}$", error: "Invalid hexadecimal color code." },
    ];

    const validHex = "#fff";
    const invalidHex = "#zzz";

    expect(ApplyRegexRule(validHex, hexColorValidation)).toEqual({ valid: true, errors: [] });
    expect(ApplyRegexRule(invalidHex, hexColorValidation)).toEqual({
      valid: false,
      errors: ["Invalid hexadecimal color code."],
    });
  });

  it("handles empty strings and edge cases", () => {
    const nonEmptyValidation = [{ regex: ".+", error: "String cannot be empty." }];

    const edgeCaseValidation = [{ regex: "^edge$", error: 'String must exactly be "edge".' }];

    expect(ApplyRegexRule("", nonEmptyValidation)).toEqual({
      valid: false,
      errors: ["String cannot be empty."],
    });
    expect(ApplyRegexRule("edge", edgeCaseValidation)).toEqual({ valid: true, errors: [] });
    expect(ApplyRegexRule("notedge", edgeCaseValidation)).toEqual({
      valid: false,
      errors: ['String must exactly be "edge".'],
    });
  });
});
