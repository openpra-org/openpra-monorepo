import {
  EuiButton,
  EuiButtonEmpty,
  EuiFieldText,
  EuiFlexGroup,
  EuiFlexItem,
  EuiForm,
  EuiFormRow,
  EuiSelectable,
  EuiSelectableOption,
  EuiSpacer,
  EuiTextArea,
  EuiTitle,
} from "@elastic/eui";
import { useEffect, useState } from "react";

//list of props passed in, the users is optional and controls which version is shown, this is so we can reuse this structure later
export interface NewItemProps {
  title: string;
  page?: string;
  itemTitle?: string;
  itemDescription?: string;
  users?: string[];
  toggleBox: (isVisible: boolean) => void;
}

//returns what is called a newItem, which is actually a panel to create a new item in some sort of list somewhere
const NewItem = (props: NewItemProps): JSX.Element => {
  //grabbing the props
  const { title, users, toggleBox } = props;

  //this is what is in the newItem strucutre, will eventually be used to actually make things
  //this is also subject tyo change, propbably needs a type passed in from props eventually
  const newItem = {
    title: props.itemTitle ?? "",
    description: props.itemDescription ?? "",
    users: [] as string[],
  };

  //use states that change things, called by functions later
  const [itemInfo, setItemInfo] = useState(newItem);
  const [options, setOptions] = useState<EuiSelectableOption[]>([]);

  //this shows which things have actually been selected
  useEffect(() => {
    if (users) {
      const selectableOptions = users.map((user) => ({
        label: user,
      }));
      setOptions(selectableOptions);
    }
  }, [users]);

  useEffect(() => {
    const filterOptionsElement = document.querySelector(".euiSelectableList__searchMessage");
    if (filterOptionsElement) {
      filterOptionsElement.textContent = "Search users";
    }
  }, []);

  //this does something if users exist, it will map the users in the new item to the selected users
  const handleOptionChange = (newOptions: EuiSelectableOption[]): void => {
    const selectedUsers = newOptions.filter((option) => option.checked).map((option) => option.label);
    setItemInfo({
      ...itemInfo,
      users: selectedUsers,
    });
  };

  //sets the data, then closes overlay
  const setData = (): void => {
    closeOverlay();
  };

  //just closes the overlay for adding items
  const closeOverlay = (): void => {
    toggleBox(false);
  };

  return (
    //Setting form width seems to be the only real way to make this look a little bigger
    <EuiForm style={{ width: "300px" }}>
      {/** this gives the text, and then importantly sets the title of the item */}
      <EuiFormRow fullWidth>
        <EuiTitle size="m">
          <strong>New {title}</strong>
        </EuiTitle>
      </EuiFormRow>
      <EuiSpacer size="s" />
      <EuiFormRow fullWidth>
        <EuiFieldText
          fullWidth
          placeholder="Title"
          value={itemInfo.title}
          onChange={(e): void => {
            setItemInfo({
              ...itemInfo,
              title: e.target.value,
            });
          }}
        />
      </EuiFormRow>
      {/** this form row is for the description */}
      <EuiFormRow fullWidth>
        <EuiTextArea
          fullWidth
          placeholder="Description"
          resize="none"
          value={itemInfo.description}
          onChange={(e): void => {
            setItemInfo({
              ...itemInfo,
              description: e.target.value,
            });
          }}
        />
      </EuiFormRow>
      {/** toggles if users exists and is passed, and it shows the selectable menu of users */}
      {users && (
        <EuiFormRow fullWidth>
          <EuiSelectable
            options={options}
            onChange={(newOptions): void => {
              setOptions(newOptions);
              handleOptionChange(newOptions); // call handleOptionChange with newOptions
            }}
            searchable
            singleSelection={false}
          >
            {(list, search): JSX.Element => (
              <div>
                {search}
                {list}
              </div>
            )}
          </EuiSelectable>
        </EuiFormRow>
      )}
      {/** the submit and also the go back buttons are right here*/}
      <EuiFormRow fullWidth>
        <EuiFlexGroup
          justifyContent="spaceBetween"
          gutterSize="xs"
        >
          <EuiFlexItem>
            <EuiButtonEmpty onClick={closeOverlay}>Cancel</EuiButtonEmpty>
          </EuiFlexItem>
          <EuiFlexItem>
            <EuiButton
              fill
              isDisabled={(users && itemInfo.users.length === 0) ?? itemInfo.title.length === 0}
              onClick={setData}
            >
              Submit
            </EuiButton>
          </EuiFlexItem>
        </EuiFlexGroup>
      </EuiFormRow>
    </EuiForm>
  );
};
export { NewItem };
