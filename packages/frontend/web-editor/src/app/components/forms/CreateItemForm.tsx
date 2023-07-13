import {
  EuiButton,
  EuiFieldText,
  EuiForm,
  EuiFormRow,
  EuiSpacer,
  EuiTextArea
} from "@elastic/eui";
import React, { FormEventHandler, useState } from "react";

import { DEFAULT_LABEL_JSON } from "shared-types/src/lib/types/Label";
import { toTitleCase } from "../../../utils/StringUtils";

export type CreateItemFormProps = {
  itemName: string;
  endpoint: string;
  onSuccess?: () => {};
  onFail?: () => {};
}

export default function({ itemName, endpoint, onSuccess, onFail }: CreateItemFormProps) {
  const [label, setLabel] = useState(DEFAULT_LABEL_JSON);

  const handleCreate = () => {
    alert(`Created ${itemName.toLowerCase()} at endpoint ${endpoint}`);
    onSuccess && onSuccess();
    onFail && onFail();
  }

  const formTouched = label.name !== DEFAULT_LABEL_JSON.name || label.description !== DEFAULT_LABEL_JSON.description;
  const createButtonLabel = !formTouched ? "Decide later" : "Create";


  const itemLabel = toTitleCase(itemName);
  return (
    <EuiForm fullWidth component="form" onSubmit={handleCreate} >
      <EuiFormRow fullWidth label={`${itemLabel} name`}>
        <EuiFieldText
          id="name"
          fullWidth
          placeholder={`Title for the ${itemLabel.toLowerCase()}`}
          value={label.name}
          onChange={(e) => setLabel({
            ...label,
            name: e.target.value
          })}
        />
      </EuiFormRow>
      <EuiSpacer size="m" />
      <EuiFormRow fullWidth label={`${itemLabel} description`}>
        <EuiTextArea
          id="description"
          resize='none'
          fullWidth
          placeholder={`Describe the ${itemLabel.toLowerCase()} in a few words.`}
          value={label.description}
          onChange={(e) => setLabel({
              ...label,
              description: e.target.value
          })}
        />
      </EuiFormRow>
      <EuiSpacer size="m" />
      <EuiFormRow>
        <EuiButton fullWidth color="primary" type="submit">{createButtonLabel}</EuiButton>
      </EuiFormRow>
    </EuiForm>
  );
}
