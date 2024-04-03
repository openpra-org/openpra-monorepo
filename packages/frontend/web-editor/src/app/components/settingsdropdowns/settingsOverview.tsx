import {
  EuiForm,
  EuiFormRow,
  EuiSelect,
  EuiButton,
  EuiFlexGroup,
  useGeneratedHtmlId,
  EuiText,
  EuiFlexGrid,
  EuiFlexItem,
  EuiTitle,
  EuiFieldNumber,
  EuiSpacer,
} from "@elastic/eui";
import { useState } from "react";
import { SettingsAccordian } from "./SettingsAccordian";

const SettingsOverview = (): JSX.Element => {
  const [overviewValue, setOverviewValue] = useState("");

  const basicSelectId = useGeneratedHtmlId({ prefix: "basicSelect" });

  const options = [
    { value: "eventTree", text: "Event Tree" },
    { value: "faultTree", text: "Fault Tree" },
    { value: "bayesianNetwork", text: "Bayesian Network" },
  ];

  const onChange = (e: any): void => {
    setOverviewValue(e.target.value);
  };

  return (
    <div>
      <EuiForm component="form">
          <EuiSpacer size="l" />
        <EuiFormRow>
          <EuiTitle size="xs">
            <h6>Overview Diagram</h6>
          </EuiTitle>
        </EuiFormRow>
        <EuiFormRow fullWidth>
          <EuiText size="s" color="subdued" data-testid="text">
            Overview page can display a read-only version of the chosen diagram.
          </EuiText>
        </EuiFormRow>
        <EuiFormRow label="Diagram type">
          <EuiSelect
            id={basicSelectId}
            options={options}
            value={overviewValue}
            data-testid="selectDiagram"
            onChange={onChange}
            aria-label="Use aria labels when no actual label is in use"
          />
        </EuiFormRow>
        <EuiFormRow label="Diagram ID">
          <EuiFieldNumber
            style={{ width: 60 }}
            min={1}
            disabled={true}
            value={1}
            data-testid="diagramNumber"
          />
        </EuiFormRow>
        <EuiFormRow>
          <EuiButton
            isDisabled={false}
            color="primary"
            data-testid="saveButton"
          >
            Save
          </EuiButton>
        </EuiFormRow>
      </EuiForm>
    </div>
  );
};

export { SettingsOverview };
