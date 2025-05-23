import {
  EuiButton,
  EuiComboBox,
  EuiComboBoxOptionOption,
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
import React, { useEffect, useState } from "react";
import { ApiManager } from "shared-types/src/lib/api/ApiManager";
import { DEFAULT_TYPED_MODEL_JSON, TypedModelJSON } from "shared-types/src/lib/types/modelTypes/largeModels/typedModel";

import { ToTitleCase } from "../../../utils/StringUtils";

export interface ItemFormProps {
  itemName: string;
  postEndpoint?: (data: Partial<TypedModelJSON>) => Promise<void>;
  patchEndpoint?: (modelId: number, userId: number, data: Partial<TypedModelJSON>) => Promise<void>;
  onSuccess?: () => NonNullable<unknown>;
  onFail?: () => NonNullable<unknown>;
  onCancel?: (func: any) => void;
  action: "create" | "edit"; // TODO: Use this in the title with .ToTitleCase() to prettify
  initialFormValues?: TypedModelJSON;
  compressed?: boolean;
  noHeader?: boolean;
}

const TypedModelActionForm = ({
  itemName,
  onCancel,
  noHeader,
  compressed,
  initialFormValues,
  action,
  patchEndpoint,
  postEndpoint,
}: ItemFormProps): JSX.Element => {
  const userId = ApiManager.getCurrentUser().user_id ?? -1;

  //setting up initial values depending on what has been sent, if init form values are passed it's assumed to be updating instead of adding
  const formInitials = initialFormValues ? initialFormValues : DEFAULT_TYPED_MODEL_JSON;

  //initial users is set depending on if things are new or not, essential sets other people innately if they were already set
  const initUsers = initialFormValues ? initialFormValues.users : [userId];

  //sets the current typed model using our formInitials in a React state, so we can pass it around
  const [typedModel, setTypedModel] = useState(formInitials);

  //need a state for the list of user ids, going dummy it out for now
  const [usersList, setUsersList] = useState<EuiComboBoxOptionOption<any>[]>([]);

  //need a state for selected list of users for the EuiComboBox
  const [selectedUsersList, setSelectedUsersList] = useState<EuiComboBoxOptionOption<any>[]>([]);

  //list of the user ids which we add to the api calls
  const [usersListId, setUsersListId] = useState<number[]>([]);

  //use effect to set up users, only runs if init form values is passed which is only passed on edit!
  if (initialFormValues) {
    // TODO:: BROKEN
    useEffect(() => {
      const logFetchedData = async (): Promise<void> => {
        try {
          const usersData = await ApiManager.getUsers();
          const resultList = usersData.results;
          // Filters out the current user from the list since it's implied that they want to see their own model
          const results = resultList.filter((x: any) => x.id !== ApiManager.getCurrentUser().user_id);
          // Creates the objects that will go in the EuiSelectable
          const listWithoutCurrentUser = results.map((item: any) => ({
            label: item.firstName + " " + item.lastName,
            key: item.id,
          }));

          const selectedList: EuiComboBoxOptionOption[] = [];
          listWithoutCurrentUser.forEach((item: any) => {
            if (initUsers.includes(item.key)) {
              selectedList.push({
                label: item.label,
                key: item.key,
              });
            }
          });
          setSelectedUsersList(selectedList);
          setUsersList(listWithoutCurrentUser);
        } catch (error) {}
      };
      void logFetchedData();
    }, [initUsers]);

    //use effect hook that updates the list of users we are setting
    useEffect(() => {
      const idList: number[] = selectedUsersList.map((item: any) => item.key);
      //sets certain data
      setUsersListId(idList);
    }, [selectedUsersList]);
  }

  //Handles the click for the submit button, functionality depends on whether initform values are passed, indicating an update
  const handleAction = (e: React.FormEvent<HTMLFormElement>): void => {
    e.preventDefault();

    if (typedModel.label.name !== "") {
      //this creates the finalIdList that is added when updated or added to the model
      const finalIdList = usersListId;
      finalIdList.push(userId);

      //creating a partial model to pass for update, may update to work for adding later as well
      const partialModel: Partial<TypedModelJSON> = {
        label: typedModel.label,
        users: finalIdList,
      };

      if (initialFormValues && patchEndpoint) {
        void patchEndpoint(initialFormValues.id, userId, partialModel).then(() => {
          onCancel && onCancel(false);
        });
      } else if (postEndpoint) {
        void postEndpoint(partialModel).then(() => {
          onCancel && onCancel(false);
        });
      } else {
        alert("Please enter a valid name");
      }
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
          <EuiText
            size="s"
            color="subdued"
          >
            {" "}
            A valid {itemLabel} must have a name{" "}
          </EuiText>
          <EuiSpacer />
        </>
      )}
      <EuiForm
        component="form"
        onSubmit={handleAction}
      >
        <EuiFlexGroup>
          <EuiFlexItem grow>
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
        {initialFormValues ?
          <>
            <EuiFlexGroup>
              <EuiFormRow
                fullWidth
                label="Allow access to other users"
                display={compressed ? "rowCompressed" : undefined}
                style={{ width: "100%" }}
              >
                <EuiComboBox
                  fullWidth
                  options={usersList}
                  selectedOptions={selectedUsersList}
                  onChange={(newOptions): void => {
                    setSelectedUsersList(newOptions);
                  }}
                />
              </EuiFormRow>
            </EuiFlexGroup>
            <EuiSpacer size="m" />
          </>
        : null}
        <EuiFlexGroup
          direction="row"
          justifyContent="spaceBetween"
          gutterSize="m"
        >
          <EuiFlexItem grow={false}>
            <EuiFormRow display={compressed ? "rowCompressed" : undefined}>
              <EuiButton
                size={compressed ? "s" : "m"}
                type="submit"
                fill
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
                  iconSide="right"
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
};
export { TypedModelActionForm };
