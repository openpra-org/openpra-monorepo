import {
  EuiButton,
  EuiFieldText,
  EuiFlexGroup,
  EuiFlexItem,
  EuiForm,
  EuiFormRow,
  EuiSpacer,
  EuiText,
  EuiTextArea,
  EuiTitle,
} from "@elastic/eui";
import React, { useState } from "react";

import TypedModelApiManager from "shared-types/src/lib/api/TypedModelApiManager";
import {
  DEFAULT_NESTED_MODEL_JSON,
  NestedModelJSON,
} from "shared-types/src/lib/types/modelTypes/innerModels/nestedModel";
import { LabelJSON } from "shared-types/src/lib/types/Label";

import { toTitleCase } from "../../../utils/StringUtils";

export type NestedItemFormProps = {
  itemName: string;
  // TODO:: TODO :: replace endpoint string with TypedApiManager method
  id?: number;
  postEndpoint?: (data: NestedModelJSON) => {};
  patchEndpoint?: (id: number, data: LabelJSON) => {};
  onSuccess?: () => {};
  onFail?: () => {};
  onCancel?: (func: any) => void;
  action: "create" | "edit"; // TODO: Use this in the title with .ToTitleCase() to prettify
  initialFormValues?: NestedModelJSON;
  compressed?: boolean;
  noHeader?: boolean;
};

export default function NestedModelActionForm({
  itemName,
  onCancel,
  noHeader,
  compressed,
  initialFormValues,
  action,
  patchEndpoint,
  postEndpoint,
  onSuccess,
  onFail,
  id,
}: NestedItemFormProps) {
  //setting up initial values depending on what has been send, if init form values are passed its assumed to be updating instead of adding
  const formInitials = initialFormValues
    ? initialFormValues
    : DEFAULT_NESTED_MODEL_JSON;

  //sets the current typed model using our formIntials, in a react state so we can pass it around
  const [typedModel, setTypedModel] = useState(formInitials);

  //Handles the click for the submit button, functionality depends on whether initform values are passed, indicating an update
  const handleAction = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (typedModel.label.name != "") {
      //creating a partial model to pass for update, may update to work for adding later aswell
      const partialModel: NestedModelJSON = {
        label: typedModel.label,
        parentIds: [TypedModelApiManager.getCurrentModelId()],
      };

      //dummied out patch functionality as I think this will be very different
      //calls the 2 functions depending on what is passed to patch
      // if(initialFormValues){
      // }

      //does postEndpoint if it has been passed
      if (postEndpoint) {
        postEndpoint(partialModel);
      } else if (patchEndpoint) {
        if (id) {
          patchEndpoint(id, typedModel.label);
        }
      }
    } else {
      alert("Please enter a valid name");
    }
    onSuccess && onSuccess();
    onFail && onFail();
    location.reload();
  };

  //const formTouched = label.name !== DEFAULT_LABEL_JSON.name || label.description !== DEFAULT_LABEL_JSON.description;
  const actionLabel = toTitleCase(action);
  const itemLabel = toTitleCase(itemName);
  return (
    <>
      {!noHeader && (
        <>
          <EuiTitle size="xs">
            <h6> Create {itemLabel} </h6>
          </EuiTitle>
          <EuiSpacer size="s" />
          <EuiText size="s" color="subdued">
            {" "}
            A valid {itemLabel} must have a name{" "}
          </EuiText>
          <EuiSpacer />
        </>
      )}
      <EuiForm component="form" onSubmit={handleAction}>
        <EuiFlexGroup>
          <EuiFlexItem grow={true}>
            <EuiFormRow
              fullWidth
              label={`${itemLabel} name`}
              display={compressed ? "rowCompressed" : undefined}
            >
              <EuiFieldText
                fullWidth
                compressed
                placeholder={initialFormValues?.label.name}
                value={typedModel.label.name}
                onChange={(e) =>
                  setTypedModel({
                    ...typedModel,
                    label: {
                      ...typedModel.label,
                      name: e.target.value,
                    },
                  })
                }
              />
            </EuiFormRow>
          </EuiFlexItem>
        </EuiFlexGroup>
        <EuiSpacer size="m" />
        <EuiFormRow
          fullWidth
          label={`${itemLabel} description`}
          display={compressed ? "rowCompressed" : undefined}
        >
          <EuiTextArea
            resize="none"
            fullWidth
            compressed
            placeholder={initialFormValues?.label.description}
            value={typedModel.label.description}
            onChange={(e) =>
              setTypedModel({
                ...typedModel,
                label: {
                  ...typedModel.label,
                  description: e.target.value,
                },
              })
            }
          />
        </EuiFormRow>
        <EuiSpacer size="m" />
        <EuiFlexGroup direction="row" justifyContent="flexStart" gutterSize="m">
          <EuiFlexItem grow={false}>
            <EuiFormRow display={compressed ? "rowCompressed" : undefined}>
              <EuiButton
                size={compressed ? "s" : "m"}
                type="submit"
                fill
                color="primary"
              >
                {actionLabel}
              </EuiButton>
            </EuiFormRow>
          </EuiFlexItem>
          {onCancel && (
            <EuiFlexItem grow={false}>
              <EuiFormRow display={compressed ? "rowCompressed" : undefined}>
                <EuiButton
                  size={compressed ? "s" : "m"}
                  onClick={onCancel}
                  color="primary"
                >
                  Cancel
                </EuiButton>
              </EuiFormRow>
            </EuiFlexItem>
          )}
        </EuiFlexGroup>
        <EuiSpacer size="m" />
      </EuiForm>
    </>
  );
}
