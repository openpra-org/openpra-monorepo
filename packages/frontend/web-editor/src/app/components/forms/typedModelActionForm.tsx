import {
  EuiButton, 
  EuiFieldText, EuiFlexGroup, EuiFlexItem,
  EuiForm,
  EuiFormRow, EuiComboBox, EuiComboBoxOptionOption,
  EuiSpacer, EuiText,
  EuiTextArea, EuiTitle
} from "@elastic/eui";
import React, {useEffect, useState} from "react";
import { toTitleCase } from "../../../utils/StringUtils";
import { DEFAULT_TYPED_MODEL_JSON, TypedModelJSON } from "shared-types/src/lib/types/modelTypes/largeModels/typedModel";
import ApiManager from "packages/shared-types/src/lib/api/ApiManager";
import TypedModelApiManager from "shared-types/src/lib/api/TypedModelApiManager";

export type ItemFormProps = {
  itemName: string;
  // TODO:: TODO :: replace endpoint string with TypedApiManager method
  postEndpoint?: (data: Partial<TypedModelJSON>) => {};
  patchEndpoint?: (modelId: number, userId: number, data: Partial<TypedModelJSON>) => {}
  onSuccess?: () => {};
  onFail?: () => {};
  onCancel?: (func: any) => void;
  action: "create" | "edit"; // TODO: Use this in the title with .ToTitleCase() to prettify
  initialFormValues?: TypedModelJSON;
  compressed?: boolean;
  noHeader?: boolean;
}

export default function TypedModelActionForm({ itemName, onCancel, noHeader, compressed, initialFormValues, action, patchEndpoint, postEndpoint, onSuccess, onFail}: ItemFormProps) {

  const userId = (ApiManager.getCurrentUser()?.user_id ?? -1)

  //setting up initial values depending on what has been send, if init form values are passed its assumed to be updating instead of adding
  const formInitials = initialFormValues ? initialFormValues : DEFAULT_TYPED_MODEL_JSON;

  //initial users is set depending on if things are new or not, essentiall sets other people innately if they were already set
  const initUsers = initialFormValues ? initialFormValues.users : [userId]

  //sets the current typed model using our formIntials, in a react state so we can pass it around
  const [typedModel, setTypedModel] = useState(formInitials);

  //for setting if the page is loading
  const [isLoading, setIsLoading] = useState(true);

  //need a state for the list of user ints, gonna dummy it out for now
  const [updateUsersList, setUpdateUsersList] = useState(initUsers)

  //need a state for the list of user ints, gonna dummy it out for now
  const [usersList, setUsersList] = useState<EuiComboBoxOptionOption<any>[]>([])

  //need a state for selected list of users for the EuiComboBox
  const [selectedUsersList, setSelectedUsersList] = useState<EuiComboBoxOptionOption<any>[]>([])

  //list of the user ids which we add to the api calls
  const [usersListId, setUsersListId] = useState([0])

  //
  useEffect(() => {
    const logFetchedData = async () => {
      try {
        const usersData = await ApiManager.getUsers();
        const resultList = usersData.results;
        // Filters out the current user from the list since it's implied that they want to see their own model
        let listWithoutCurrentUser = resultList.filter((x: any) => x.id != ApiManager.getCurrentUser().user_id)
        // Creates the objects that will go in the EuiSelectable
        listWithoutCurrentUser = listWithoutCurrentUser.map((item: any) => {
          return {
            label: item.firstName + ' ' + item.lastName,
            key: item.id,
          };
        })
        let selectedList = listWithoutCurrentUser.map((item: any) => {
          if (initUsers.includes(item.key)) {
            return {
              label: item.label,
              key: item.key,
            };
          }
        })
        selectedList = selectedList.filter((item: any) => item !== undefined)
        setSelectedUsersList(selectedList)
        setUsersList(listWithoutCurrentUser)
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    };
    logFetchedData();
  }, []);

  //use effect hook that updates the list of users we are setting
  useEffect(() => {
    const idList : number[] = selectedUsersList.map((item: any) => {
      return item.key
    })
    //sets certain data
    setUsersListId(idList)
  }, [selectedUsersList])

  //Handles the click for the submit button, functionality depends on whether initform values are passed, indicating an update
  const handleAction = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()

    if (typedModel.label.name != '') {

      //this creates the finalIdList that is added when updated or added to the model
      const finalIdList = usersListId
      finalIdList.push(userId)

      //creating a partial model to pass for update, may update to work for adding later aswell
      const partialModel: Partial<TypedModelJSON> = {
        label: typedModel.label,
        users: finalIdList
      };

      //calls the 2 functions depending on what is passed to patch
      if(initialFormValues){
        if(patchEndpoint){
          TypedModelApiManager.patchInternalEvent(initialFormValues.id, userId, partialModel)
          patchEndpoint(initialFormValues.id, userId, partialModel)
        }
      }
      if(postEndpoint){
        postEndpoint(partialModel)
      }
    } else {
      alert('Please enter a valid name')
    }
    onSuccess && onSuccess();
    onFail && onFail();
    window.location.reload();
  }

  //const formTouched = label.name !== DEFAULT_LABEL_JSON.name || label.description !== DEFAULT_LABEL_JSON.description;
  const actionLabel = toTitleCase(action);
  const itemLabel = toTitleCase(itemName);
  return (
    <>
      {!noHeader &&
        <>
          <EuiTitle size="xs" ><h6> Create {itemLabel} Model </h6></EuiTitle>
          <EuiSpacer size="s"/>
          <EuiText size="s" color="subdued"> A valid {itemLabel.toLowerCase()} model must have a name </EuiText>
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
                placeholder={initialFormValues?.label.name}
                value={typedModel.label.name}
                onChange={(e) => setTypedModel({
                  ...typedModel,
                  label: {
                    ...typedModel.label,
                    name: e.target.value,
                  },
                })}
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
            placeholder={initialFormValues?.label.description}
            value={typedModel.label.description}
            onChange={(e) => setTypedModel({
              ...typedModel,
              label: {
                ...typedModel.label,
                description: e.target.value,
              },
            })}
          />
        </EuiFormRow>
        <EuiSpacer size="m" />
        <EuiFlexGroup>
          <EuiFormRow fullWidth label='Allow access to other users' display={compressed ? "rowCompressed" : undefined} style={{width: '100%'}}>
            <EuiComboBox
                fullWidth
                options={usersList}
                selectedOptions={selectedUsersList}
                onChange={(newOptions) => setSelectedUsersList(newOptions)}
            />
          </EuiFormRow>
        </EuiFlexGroup>
        <EuiSpacer size="m" />
        <EuiFlexGroup direction="row" justifyContent="spaceBetween" gutterSize="m">
          <EuiFlexItem grow={false}>
            <EuiFormRow display={compressed ? "rowCompressed" : undefined}>
              <EuiButton size={compressed ? "s" : "m"} type="submit" fill color="primary">{actionLabel}</EuiButton>
            </EuiFormRow>
          </EuiFlexItem>
          {
            onCancel && <EuiFlexItem grow={false}>
              <EuiFormRow display={compressed ? "rowCompressed" : undefined}>
                <EuiButton size={compressed ? "s" : "m"} onClick={onCancel} color="danger">Cancel</EuiButton>
              </EuiFormRow>
            </EuiFlexItem>
          }
        </EuiFlexGroup>
        <EuiSpacer size='m' />
      </EuiForm>
    </>
  );
}
