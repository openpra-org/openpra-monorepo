import { useEffect, useState } from "react";
import {
  EuiForm,
  EuiFormRow,
  EuiFieldText,
  EuiTextArea,
  EuiButton,
  EuiFlexGroup,
  EuiFlexItem,
  EuiSpacer,
  EuiSelectable,
  EuiSelectableOption,
  EuiTitle,
  EuiButtonEmpty,
} from "@elastic/eui";
export interface NewItemProps {
  title: string;
  page?: string;
  itemTitle?: string;
  itemDescription?: string;
  users?: string[];
  toggleBox: (isVisible: boolean) => void;
}
function NewItem(props: NewItemProps): JSX.Element {
  const { title, users, toggleBox } = props;
  const newItem = {
    title: props.itemTitle ?? "",
    description: props.itemDescription ?? "",
    users: [] as string[],
  };
  const [itemInfo, setItemInfo] = useState(newItem);
  const [options, setOptions] = useState<EuiSelectableOption[]>([]);
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
  const handleOptionChange = (newOptions: EuiSelectableOption[]): void => {
    const selectedUsers = newOptions.filter((option) => option.checked).map((option) => option.label);
    setItemInfo({
      ...itemInfo,
      users: selectedUsers,
    });
  };
  const setData = (): void => {
    closeOverlay();
  };
  const closeOverlay = (): void => {
    toggleBox(false);
  };
  return (
    <EuiForm style={{ width: "300px" }}>
      <EuiFormRow fullWidth={true}>
        <EuiTitle size="m">
          <strong>New {title}</strong>
        </EuiTitle>
      </EuiFormRow>
      <EuiSpacer size="s"></EuiSpacer>
      <EuiFormRow fullWidth={true}>
        <EuiFieldText
          fullWidth={true}
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

      <EuiFormRow fullWidth={true}>
        <EuiTextArea
          fullWidth={true}
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

      {users && (
        <EuiFormRow fullWidth={true}>
          <EuiSelectable
            options={options}
            onChange={(newOptions): void => {
              setOptions(newOptions);
              handleOptionChange(newOptions);
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

      <EuiFormRow fullWidth={true}>
        <EuiFlexGroup
          justifyContent="spaceBetween"
          gutterSize="xs"
        >
          <EuiFlexItem>
            <EuiButtonEmpty onClick={closeOverlay}>Cancel</EuiButtonEmpty>
          </EuiFlexItem>
          <EuiFlexItem>
            <EuiButton
              fill={true}
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
}
export { NewItem };
