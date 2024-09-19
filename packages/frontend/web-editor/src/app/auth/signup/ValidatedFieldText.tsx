import React, { ReactElement, useState } from "react";
import { EuiFieldText, EuiFieldTextProps, EuiFormRow } from "@elastic/eui";
import { RegexValidationRule } from "shared-types/src/lib/validation/RegexValidationRule";
import { NonEmptyArray } from "shared-types/src/lib/types/ObjectTypes";
import { ApplyRegexRule } from "shared-types/src/lib/validation/ValidationRules";
import { ValidationResult } from "shared-types/src/lib/validation/ValidationResult";
import { EuiFormRowProps } from "@elastic/eui/src/components/form/form_row/form_row";
import { useDebouncedCallback } from "use-debounce";

export interface ValidatedFieldResult<DataType> {
  isInvalid: boolean;
  errors?: string[];
  value: DataType;
}

export type ValidatedFieldTextProps = EuiFieldTextProps & {
  regexRules?: NonEmptyArray<RegexValidationRule>;
  noFormRow?: boolean;
  formRowProps?: Omit<EuiFormRowProps, "children">;
  onChanged?: (changeResult: ValidatedFieldResult<string>) => void;
  noDebounce?: boolean; // TODO:: implement debounce if unset
};

type FormRowWrappedProps = EuiFormRowProps & {
  noFormRow?: boolean;
  children: ReactElement;
};

const FormRowWrapped = (props: FormRowWrappedProps): ReactElement => {
  const { noFormRow, children, ...others } = props;

  if (noFormRow) {
    return <>{children}</>;
  }

  return <EuiFormRow {...others}>{children}</EuiFormRow>;
};

export const ValidatedFieldText = (props: ValidatedFieldTextProps): ReactElement => {
  const { regexRules, noFormRow, formRowProps, onChanged, ...others } = props;

  const [pristine, setPristine] = useState<boolean>(true);
  const [value, setValue] = useState<string>("");

  const debouncedChange = useDebouncedCallback(() => {
    setPristine(false);
    handleChange();
  }, 1000);

  const handleChange = (): void => {
    const changeResult: ValidatedFieldResult<string> = {
      isInvalid: isInvalid,
      value: value,
      errors: result.errors,
    };
    onChanged?.(changeResult); // call onChanged callback with the current state
  };

  const result: ValidationResult = ApplyRegexRule(value, regexRules);
  const isInvalid = !pristine && !result.valid;

  return (
    <FormRowWrapped
      noFormRow={noFormRow}
      isInvalid={isInvalid}
      error={result.errors}
    >
      <EuiFieldText
        {...others}
        isInvalid={isInvalid}
        onChange={(e) => {
          setValue(String(e.target.value)); // set the value, let the component re-render/re-apply validations, etc.
          debouncedChange();
        }}
        onBlur={() => {
          handleChange();
        }}
        value={value}
      />
    </FormRowWrapped>
  );
};
