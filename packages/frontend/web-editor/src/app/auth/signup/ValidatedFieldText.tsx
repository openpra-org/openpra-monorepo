import React, { ReactElement, useState } from "react";
import { EuiFieldText, EuiFieldTextProps, EuiFormRow } from "@elastic/eui";
import { RegexValidationRule } from "shared-types/src/lib/validation/RegexValidationRule";
import { NonEmptyArray } from "shared-types/src/lib/types/ObjectTypes";
import { ApplyRegexRule } from "shared-types/src/lib/validation/ValidationRules";
import { ValidationResult } from "shared-types/src/lib/validation/ValidationResult";
import { EuiFormRowProps } from "@elastic/eui/src/components/form/form_row/form_row";
import { useDebouncedCallback } from "use-debounce";

/**
 * Interface representing the result of a validated field.
 *
 * @typeparam DataType - The type of the value being validated.
 */
export interface ValidatedFieldResult<DataType> {
  /** Indicates if the field is invalid. */
  isInvalid: boolean;
  /** Array of error messages, if any. */
  errors?: string[];
  /** The value of the field. */
  value: DataType;
}

/**
 * Props for the `ValidatedFieldText` component.
 */
export type ValidatedFieldTextProps = EuiFieldTextProps & {
  /** Array of regex validation rules to apply. */
  regexRules?: NonEmptyArray<RegexValidationRule>;
  /** If true, the field will not be wrapped in a form row. */
  noFormRow?: boolean;
  /** Additional props for the form row. */
  formRowProps?: Omit<EuiFormRowProps, "children">;
  /** Callback function to handle changes in the field value. */
  onChanged?: (changeResult: ValidatedFieldResult<string>) => void;
  /** If true, debounce will not be applied to the field. */
  noDebounce?: boolean;
  /** default debounce timeout of 1000ms */
  debounceTimeoutMs?: number;
};

/**
 * Props for the `FormRowWrapped` component.
 */
type FormRowWrappedProps = EuiFormRowProps & {
  /** If true, the field will not be wrapped in a form row. */
  noFormRow?: boolean;
  /** The child element to be wrapped. */
  children: ReactElement;
};

/**
 * A component that conditionally wraps its children in an `EuiFormRow`.
 *
 * @param props - The props for the component.
 * @returns The wrapped or unwrapped child element.
 */
const FormRowWrapped = (props: FormRowWrappedProps): ReactElement => {
  const { noFormRow, children, ...others } = props;

  if (noFormRow) {
    return <>{children}</>;
  }

  return <EuiFormRow {...others}>{children}</EuiFormRow>;
};

/**
 * A validated text field component that applies regex validation rules.
 *
 * @param props - The props for the component.
 * @returns The validated text field component.
 *
 * @example
 * ```
 * <ValidatedFieldText
 *   regexRules={[{ pattern: /^[a-z]+$/, message: "Only lowercase letters allowed" }]}
 *   onChanged={(result) => console.log(result)}
 * />
 * ```
 */
export const ValidatedFieldText = (props: ValidatedFieldTextProps): ReactElement => {
  const { regexRules, noFormRow, formRowProps, noDebounce, debounceTimeoutMs, onChanged, ...others } = props;

  const [pristine, setPristine] = useState<boolean>(true);
  const [value, setValue] = useState<string>("");

  const debouncedChange = useDebouncedCallback(
    () => {
      setPristine(false);
      handleChange();
    },
    debounceTimeoutMs ? debounceTimeoutMs : 1000,
  );

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
          noDebounce ? handleChange() : debouncedChange();
        }}
        onBlur={() => {
          handleChange();
        }}
        value={value}
      />
    </FormRowWrapped>
  );
};
