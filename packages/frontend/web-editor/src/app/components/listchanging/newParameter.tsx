import { useEffect, useState } from "react";
import {
  EuiForm,
  EuiFormRow,
  EuiFieldText,
  EuiButton,
  EuiTextColor,
  EuiFlexGroup,
  EuiFlexItem,
  EuiSpacer,
  useEuiTheme,
  EuiFieldNumber,
} from "@elastic/eui";
export interface NewParameterProps {
  toggleBox: (isVisible: boolean) => void;
}
function NewParameter(props: NewParameterProps): JSX.Element {
  const { toggleBox } = props;
  const { euiTheme } = useEuiTheme();
  interface Item {
    name: string;
    value?: number;
  }
  const newItem: Item = {
    name: "",
  };
  const [itemInfo, setItemInfo] = useState(newItem);
  useEffect(() => {
    const filterOptionsElement = document.querySelector(".euiSelectableList__searchMessage");
    if (filterOptionsElement) {
      filterOptionsElement.textContent = "Search users";
    }
  }, []);
  const setData = (): void => {
    closeOverlay();
  };
  const closeOverlay = (): void => {
    toggleBox(false);
  };
  const isValueValidNumber = typeof itemInfo.value === "number" && !isNaN(itemInfo.value);
  return (
    <EuiForm
      style={{
        backgroundColor: euiTheme.colors.lightShade,
        alignSelf: "center",
        width: "500px",
        borderRadius: "5px",
      }}
    >
      <EuiSpacer size="s" />

      <EuiTextColor style={{ margin: "10px", fontSize: "2rem" }}>
        <strong>New Global Parameter</strong>
      </EuiTextColor>
      <EuiFormRow
        fullWidth={true}
        style={{ margin: "10px" }}
      >
        <EuiFieldText
          fullWidth={true}
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

      <EuiFormRow
        fullWidth={true}
        style={{ margin: "10px" }}
      >
        <EuiFieldNumber
          fullWidth={true}
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

      <EuiFormRow fullWidth={true}>
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
}
export { NewParameter };
