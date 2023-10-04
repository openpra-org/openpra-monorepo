import {
    EuiForm,
    EuiFormRow,
    EuiSelect,
    EuiButton,
    EuiFlexGroup,
    useGeneratedHtmlId,
    useEuiTheme,
    EuiText,
    EuiPanel,
    EuiFlexGrid,
    EuiFlexItem, EuiIcon, EuiTitle, EuiTextColor, EuiFieldNumber, EuiSpacer
} from "@elastic/eui";
import { useState } from 'react'
import SettingsAccordian from "./SettingsAccordian";

const buttonContent = (
  <div>
      <EuiFlexGroup gutterSize="s" alignItems="center" responsive={false}>
          <EuiFlexItem grow={false}>
              <EuiIcon type="graphApp" size="l" />
          </EuiFlexItem>
          <EuiFlexItem>
              <EuiTitle size="xs">
                  <h3>Overview Visibility</h3>
              </EuiTitle>
          </EuiFlexItem>
      </EuiFlexGroup>
      <EuiText size="s">
          <p>
              <EuiTextColor color="subdued">
                  Change the diagram to displayed on the model overview page.
              </EuiTextColor>
          </p>
      </EuiText>
  </div>
);

//this page in theory changes the diagram on the voerview page, but again, cant even remotely test right now so its mostly dummied out
export default function SettingsOverview() {

    const {euiTheme} = useEuiTheme();

    const [overviewValue, setOverviewValue] = useState('')

    const basicSelectId = useGeneratedHtmlId({ prefix: 'basicSelect' });

    //selectable options, this will change
    const options = [
        {value: 'eventTree', text: 'Event Tree'},
        {value: 'faultTree', text: 'Fault Tree'},
        {value: 'bayesianNetwork', text: 'Bayesian Network'},
    ]

    const onChange = (e: any) => {
        setOverviewValue(e.target.value);
    };

    //returns a form with a place to select which diagram, and then save to make the change
    return(
      <SettingsAccordian
          id="model_overview_settings"
          buttonContent={buttonContent}
      >
          <EuiFlexGrid direction="row" responsive={true} columns={2}>
              <EuiFlexItem grow={false}>
                  <EuiPanel paddingSize="xl">
                      <EuiTitle size="s" data-testid="title" ><h6>Overview Diagram</h6></EuiTitle>
                      <EuiSpacer size="s"/>
                      <EuiText size="s" color="subdued" data-testid="text">Overview page can display a read-only version of the chosen diagram.</EuiText>
                      <EuiSpacer />
                      <EuiForm component="form">
                          <EuiFlexGroup direction="row" justifyContent="flexStart">
                              <EuiFlexItem>
                                  <EuiFormRow label="Diagram type">
                                      <EuiSelect
                                        id={basicSelectId}
                                        options={options}
                                        value={overviewValue}
                                        data-testid="selectDiagram"
                                        onChange={(e) => onChange(e)}
                                        aria-label="Use aria labels when no actual label is in use"
                                      />
                                  </EuiFormRow>
                              </EuiFlexItem>
                              <EuiFlexItem grow={false} >
                                  <EuiFormRow label="Diagram ID" >
                                      <EuiFieldNumber
                                        style={{width: 60}}
                                        min={1}
                                        disabled={true}
                                        value={1}
                                        data-testid="diagramNumber"
                                      />
                                  </EuiFormRow>
                              </EuiFlexItem>
                          </EuiFlexGroup>
                          <EuiSpacer size="m" />
                          <EuiFormRow>
                              <EuiButton isDisabled={false} color="primary" data-testid="saveButton">Save</EuiButton>
                          </EuiFormRow>
                      </EuiForm>
                  </EuiPanel>
              </EuiFlexItem>
          </EuiFlexGrid>
      </SettingsAccordian>
    )
}
