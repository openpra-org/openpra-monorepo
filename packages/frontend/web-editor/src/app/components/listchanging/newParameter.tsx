import {
  EuiButton,
  EuiFieldNumber,
  EuiFieldText,
  EuiFlexGroup,
  EuiFlexItem,
  EuiForm,
  EuiFormRow,
  EuiSpacer,
  EuiTextColor,
  useEuiTheme,
} from "@elastic/eui";
import { useEffect, useState } from "react";

export interface NewParameterProps {
  toggleBox: (isVisible: boolean) => void;
}

//returns what is called a newItem, which is actually a panel to create a new item in some sort of list somewhere
const NewParameter = (props: NewParameterProps): JSX.Element => {
  //this is to make sure the new thing gets set
  // const [addNewVisible, setAddNewVisible] = useState(false);

  //grabbing the props
  const { toggleBox } = props;

  //use the theme
  const { euiTheme } = useEuiTheme();

  interface Item {
    name: string;
    value?: number;
  }

  //this is what is in the newItem structure, will eventually be used to actually make things
  //this is also subject tyo change, probably needs a type passed in from props eventually
  const newItem: Item = {
    name: "",
  };

  //use states that change things, called by functions later
  const [itemInfo, setItemInfo] = useState(newItem);

  useEffect(() => {
    const filterOptionsElement = document.querySelector(".euiSelectableList__searchMessage");
    if (filterOptionsElement) {
      filterOptionsElement.textContent = "Search users";
    }
  }, []);

  useEffect(() => {}, [itemInfo]);

  //sets the data, then closes overlay
  const setData = (): void => {
    closeOverlay();
  };

  //just closes the overlay for adding items
  const closeOverlay = (): void => {
    toggleBox(false);
  };

  const isValueValidNumber = typeof itemInfo.value === "number" && !isNaN(itemInfo.value);

  return (
    //this styling is so its in a nice looking box, it scales if the users tab is there or not
    <EuiForm
      style={{
        backgroundColor: euiTheme.colors.lightShade,
        alignSelf: "center",
        width: "500px",
        borderRadius: "5px",
      }}
    >
      <EuiSpacer size="s" />
      {/** this gives the text, and then importantly sets the title of the item */}
      <EuiTextColor style={{ margin: "10px", fontSize: "2rem" }}>
        <strong>New Global Parameter</strong>
      </EuiTextColor>
      <EuiFormRow
        fullWidth
        style={{ margin: "10px" }}
      >
        <EuiFieldText
          fullWidth
          placeholder="Title"
          value={itemInfo.name}
          onChange={(e): void => {
            setItemInfo({
              ...itemInfo,
              name: e.target.value,
            });
          }}
        />
      </EuiFormRow>
      {/** this form row is for the description */}
      <EuiFormRow
        fullWidth
        style={{ margin: "10px" }}
      >
        <EuiFieldNumber
          fullWidth
          placeholder="Value"
          value={itemInfo.value}
          onChange={(e): void => {
            setItemInfo({
              ...itemInfo,
              value: parseInt(e.target.value),
            });
          }}
        />
      </EuiFormRow>
      {/** toggles if users exists and is passed, and it shows the selectable menu of users */}
      {/** the submit and also the go back buttons are right here*/}
      <EuiFormRow fullWidth>
        <EuiFlexGroup
          justifyContent="spaceBetween"
          gutterSize="xs"
          style={{ margin: "5px" }}
        >
          <EuiFlexItem>
            <EuiButton
              style={{
                backgroundColor: euiTheme.colors.mediumShade,
                color: euiTheme.colors.darkestShade,
              }}
              onClick={closeOverlay}
            >
              Cancel
            </EuiButton>
          </EuiFlexItem>
          <EuiFlexItem>
            <EuiButton
              isDisabled={!isValueValidNumber || itemInfo.name.length === 0}
              href="internal-events/1/globalparameters"
              onClick={setData}
              style={{
                backgroundColor: euiTheme.colors.mediumShade,
                color: euiTheme.colors.darkestShade,
              }}
            >
              Submit
            </EuiButton>
          </EuiFlexItem>
        </EuiFlexGroup>
      </EuiFormRow>
    </EuiForm>
  );
};
export { NewParameter };
