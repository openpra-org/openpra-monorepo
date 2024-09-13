import { EuiFieldText, EuiFormRow, EuiIcon } from "@elastic/eui";
import React, { ReactElement, useEffect, useState } from "react";
import { useDebouncedCallback } from "use-debounce";
import { ValidationResult } from "shared-types/src/lib/validation/ValidationResult";
import { ApplyValidationRules } from "shared-types/src/lib/validation/ValidationRules";
import { EmailValidationRule, ValidationRule } from "shared-types/src/lib/validation/ValidationRule";
import { EuiFieldTextProps } from "@elastic/eui/src/components/form/field_text/field_text";

// validates the provided text as a usable email address. To be considered usable, a provided string should be a valid
// email, and the backend server should return a true value. This component receives two props, both functions:
// (1) setEmailValid
// (2) setEmailValue
// both these methods trigger something in the parent FormControl. Note that these are functions, they are not being
// used as values
export type ValidatedEuiFieldTextProps = EuiFieldTextProps & {
  setValid: (valid: boolean) => void;
  setValue: (value: string) => void;
};

export const SignUpEmailForm = (props: ValidatedEuiFieldTextProps): ReactElement => {
  const EMPTY = "";
  const [pristine, setPristine] = useState<boolean>(true);
  const [focus, setFocus] = useState<boolean>(false);
  const [validations, setValidations] = useState<ValidationResult>({ valid: true, errors: [] });

  const rules: ValidationRule[] = [EmailValidationRule];

  const debounced = useDebouncedCallback((value: string) => {
    console.log("debounced_value", value);
    debounced.cancel();
    // set isPristine to sticky-off i.f.f. value is non-empty.
    if (pristine && value !== EMPTY) {
      setPristine(false);
      return;
    }
    if (pristine && value === EMPTY) {
      setValidations(ApplyValidationRules(value, []));
      return;
    }
    setValidations(ApplyValidationRules(value, rules));
  }, 1000);

  // When the component goes to be unmounted, we will fetch data if the input has changed.
  useEffect(
    () => () => {
      console.log("flushing");
      debounced.flush();
    },
    [debounced],
  );

  const invalid = !pristine && !validations.valid;

  const isUsableEmail =
    !pristine && validations.valid ? (
      <EuiIcon
        color="success"
        type="check"
      />
    ) : undefined;
  return (
    <EuiFormRow
      isInvalid={!validations.valid}
      error={validations.errors}
    >
      <EuiFieldText
        placeholder="Email"
        name="email"
        value={props.value}
        isInvalid={invalid}
        onBlur={(e) => {
          console.log("onBlur", e);
          debounced.cancel();
          setFocus(false);
          debounced(e.target.value);
        }}
        onFocus={(e) => {
          console.log("onFocus", e);
          debounced.cancel();
          setFocus(true);
        }}
        // isInvalid={(!isValidEmail || (!signup.email && checkEmpty)) && signupButtonClicked}
        // value={signup.email}
        onChange={(e) => {
          //console.log("onChange", e);
          debounced(e.target.value);
        }}
        append={isUsableEmail}
        // onChange={(e): void => {
        //   setSignup({
        //     ...signup,
        //     email: e.target.value,
        //   });
        //   setIsValidEmail(true);
        // }}
      />
    </EuiFormRow>
  );
};
