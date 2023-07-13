import {
  EuiButton, EuiButtonEmpty, EuiFieldNumber,
  EuiFieldText, EuiFlexGroup, EuiFlexItem,
  EuiForm,
  EuiFormRow,
  EuiSpacer, EuiText,
  EuiTextArea, EuiTitle
} from "@elastic/eui";
import React, { useState } from "react";

import { DEFAULT_LABEL_JSON, LabelJSON } from "shared-types/src/lib/types/Label";
import { toTitleCase } from "../../../utils/StringUtils";

export type ItemFormProps = {
  itemName: string;
  endpoint: string;
  onSuccess?: () => {};
  onFail?: () => {};
  onCancel?: (func: any) => void;
  action: "create" | "edit";
  initialFormValues?: LabelJSON;
  compressed?: boolean;
  noHeader?: boolean;
}

export default function({ itemName, onCancel, noHeader, compressed, initialFormValues, action, endpoint, onSuccess, onFail }: ItemFormProps) {
  const formInitials = initialFormValues ? initialFormValues : DEFAULT_LABEL_JSON;
  const [label, setLabel] = useState(formInitials);

  const handleAction = () => {
    alert(`Performed action ${itemName.toLowerCase()} at endpoint ${endpoint}`);
    onSuccess && onSuccess();
    onFail && onFail();
  }

  //const formTouched = label.name !== DEFAULT_LABEL_JSON.name || label.description !== DEFAULT_LABEL_JSON.description;
  const actionLabel = toTitleCase(action);
  const itemLabel = toTitleCase(itemName);
  return (
    <>
      {!noHeader &&
        <>
          <EuiTitle size="s" ><h6>Basic Information</h6></EuiTitle>
          <EuiSpacer size="s"/>
          <EuiText size="s" color="subdued">Basic {itemLabel} information including title, description, and ID.</EuiText>
          <EuiSpacer />
        </>
      }
      <EuiForm component="form" onSubmit={handleAction}>
        <EuiFlexGroup>
          <EuiFlexItem grow={true}>
            <EuiFormRow fullWidth label={`${itemLabel} name`} display={compressed ? "rowCompressed" : undefined}>
              <EuiFieldText
                fullWidth
                compressed
                placeholder={initialFormValues?.name}
                value={label.name}
                onChange={(e) => setLabel({
                  ...label,
                  name: e.target.value
                })}
              />
            </EuiFormRow>
          </EuiFlexItem>
          <EuiFlexItem grow={false}>
            <EuiFormRow label="ID" display={compressed ? "rowCompressed" : undefined}>
              <EuiFieldNumber
                min={1}
                compressed
                disabled={true}
                style={{width: 60}}
                value={1}
              />
            </EuiFormRow>
          </EuiFlexItem>
        </EuiFlexGroup>
        <EuiSpacer size="m" />
        <EuiFormRow fullWidth label={`${itemLabel} description`} display={compressed ? "rowCompressed" : undefined}>
          <EuiTextArea
            resize='none'
            fullWidth
            compressed
            placeholder={initialFormValues?.description}
            value={label.description}
            onChange={(e) => setLabel({
              ...label,
              description: e.target.value,
            })}
          />
        </EuiFormRow>
        <EuiSpacer size="m" />
        <EuiFlexGroup direction="row" justifyContent="flexStart" gutterSize="m">
          <EuiFlexItem grow={false}>
            <EuiFormRow display={compressed ? "rowCompressed" : undefined}>
              <EuiButton size={compressed ? "s" : "m"} type="submit" fill color="primary">{actionLabel}</EuiButton>
            </EuiFormRow>
          </EuiFlexItem>
          {
            onCancel && <EuiFlexItem grow={false}>
              <EuiFormRow display={compressed ? "rowCompressed" : undefined}>
                <EuiButtonEmpty size={compressed ? "s" : "m"} onClick={onCancel}>Cancel</EuiButtonEmpty>
              </EuiFormRow>
            </EuiFlexItem>
          }
        </EuiFlexGroup>
      </EuiForm>
    </>
  );
}
