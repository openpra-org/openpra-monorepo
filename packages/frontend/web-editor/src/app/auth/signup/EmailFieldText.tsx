import { EuiFieldText, EuiFormRow, EuiIcon } from "@elastic/eui";
import React, { ReactElement, useEffect, useState } from "react";
import { useDebouncedCallback } from "use-debounce";
import { ValidationResult } from "shared-types/src/lib/validation/ValidationResult";
import { ApplyRegexRule } from "shared-types/src/lib/validation/ValidationRules";
import { EmailValidationRule, RegexValidationRule } from "shared-types/src/lib/validation/RegexValidationRule";
import { EuiFieldTextProps } from "@elastic/eui/src/components/form/field_text/field_text";
import { ValidatedFieldText } from "./ValidatedFieldText";

// validates the provided text as a usable email address. To be considered usable, a provided string should be a valid
// email, and the backend server should return a true value. This component receives two props, both functions:
// (1) setEmailValid
// (2) setEmailValue
// both these methods trigger something in the parent FormControl. Note that these are functions, they are not being
// used as values
export type ValidatedEuiFieldTextProps = EuiFieldTextProps & {
  setValid?: (valid: boolean) => void;
  setValue?: (value: string) => void;
};

export const EmailFieldText = (props: ValidatedEuiFieldTextProps): ReactElement => {
  // const isUsableEmail = true ? (
  //   <EuiIcon
  //     color="success"
  //     type="check"
  //   />
  // ) : undefined;

  // TODO:: handle case where email is not available for sign-up
  return (
    <ValidatedFieldText
      placeholder="Email"
      name="email"
      onChanged={(changeResult) => {
        console.log("email field change", changeResult);
      }}
      regexRules={[EmailValidationRule]}
    />
  );

  // <EuiFormRow
  //   isInvalid={!validations.valid}
  //   error={validations.errors}
  // >
  //   <EuiFieldText
  //     placeholder="Email"
  //     name="email"
  //     value={props.value}
  //     isInvalid={invalid}
  //     onBlur={(e) => {
  //       console.log("onBlur", e);
  //       debounced.cancel();
  //       setFocus(false);
  //       debounced(e.target.value);
  //     }}
  //     onFocus={(e) => {
  //       console.log("onFocus", e);
  //       debounced.cancel();
  //       setFocus(true);
  //     }}
  //     // isInvalid={(!isValidEmail || (!signup.email && checkEmpty)) && signupButtonClicked}
  //     // value={signup.email}
  //     onChange={(e) => {
  //       //console.log("onChange", e);
  //       debounced(e.target.value);
  //     }}
  //     append={isUsableEmail}
  //     // onChange={(e): void => {
  //     //   setSignup({
  //     //     ...signup,
  //     //     email: e.target.value,
  //     //   });
  //     //   setIsValidEmail(true);
  //     // }}
  //   />
  // </EuiFormRow>
};
