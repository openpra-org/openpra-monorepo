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
import { useState } from "react";

import { GetCurrentModelIdString } from "shared-types/src/lib/api/TypedModelApiManager";
import {
  DefaultNestedModelJSON,
  NestedModelJSON,
} from "shared-types/src/lib/types/modelTypes/innerModels/nestedModel";
import { LabelJSON } from "shared-types/src/lib/types/Label";

import { ToTitleCase } from "../../../utils/StringUtils";

export type NestedItemFormProps = {
  itemName: string;
  // TODO:: TODO :: replace endpoint string with TypedApiManager method
  id?: number;
  _id?: string;
  postEndpoint?: (data: NestedModelJSON) => NonNullable<unknown>;
  patchEndpoint?: (id: number, data: LabelJSON) => NonNullable<unknown>;
  postNestedEndpoint?: (data: NestedModelJSON) => Promise<void>;
  patchNestedEndpoint?: (
    modelId: string,
    data: Partial<NestedModelJSON>,
  ) => Promise<void>;
  onSuccess?: () => NonNullable<unknown>;
  onFail?: () => NonNullable<unknown>;
  onCancel?: (func: any) => void;
  action: "create" | "edit"; // TODO: Use this in the title with .ToTitleCase() to prettify
  initialFormValues?: NestedModelJSON;
  compressed?: boolean;
  noHeader?: boolean;
};

function NestedModelActionForm({
  itemName,
  onCancel,
  noHeader,
  compressed,
  initialFormValues,
  action,
  patchEndpoint,
  postEndpoint,
  postNestedEndpoint,
  patchNestedEndpoint,
  id,
  _id,
}: NestedItemFormProps): JSX.Element {
  //setting up initial values depending on what has been sent, if init form values are passed it's assumed to be updating instead of adding
  const formInitials = initialFormValues
    ? initialFormValues
    : DefaultNestedModelJSON;

  //sets the current typed model using our formInitials, in a React state, so we can pass it around
  const [typedModel, setTypedModel] = useState(formInitials);

  //Handles the click for the submit button, functionality depends on whether initform values are passed, indicating an update
  const handleAction = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault();

    if (typedModel.label.name !== "") {
      //creating a partial model to pass for update, may update to work for adding later as well
      const partialModel: NestedModelJSON = {
        label: typedModel.label,
        parentIds: [GetCurrentModelIdString()],
      };

      if (itemName === "initiating-event") {
        if (initialFormValues && _id && patchNestedEndpoint) {
          void patchNestedEndpoint(_id, partialModel).then(() => {
            onCancel && onCancel(false);
          });
        } else if (postNestedEndpoint) {
          void postNestedEndpoint(partialModel).then(() => {
            onCancel && onCancel(false);
          });
        }
      } else {
        if (postEndpoint) {
          postEndpoint(partialModel);
        } else if (patchEndpoint) {
          if (id) {
            patchEndpoint(id, typedModel.label);
          }
        }
      }
    } else {
      alert("Please enter a valid name");
    }
  };

  //const formTouched = label.name !== DEFAULT_LABEL_JSON.name || label.description !== DEFAULT_LABEL_JSON.description;
  const actionLabel = ToTitleCase(action);
  const itemLabel = ToTitleCase(itemName);
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
                onChange={(e): void => {
                  setTypedModel({
                    ...typedModel,
                    label: {
                      ...typedModel.label,
                      name: e.target.value,
                    },
                  });
                }}
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
            onChange={(e): void => {
              setTypedModel({
                ...typedModel,
                label: {
                  ...typedModel.label,
                  description: e.target.value,
                },
              });
            }}
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
export { NestedModelActionForm };
