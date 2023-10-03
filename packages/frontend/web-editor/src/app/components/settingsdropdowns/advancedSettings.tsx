import {
    useGeneratedHtmlId,
    EuiText,
    EuiFormRow,
    EuiFlexGroup,
    EuiButton,
    EuiPanel,
    EuiSelect,
    EuiFlexGrid,
    EuiFlexItem, EuiIcon, EuiTitle, EuiTextColor, EuiSpacer, useIsWithinBreakpoints
} from "@elastic/eui";
import {useState } from 'react'
import SettingsAccordian from "./SettingsAccordian";

const buttonContent = (
  <div>
      <EuiFlexGroup gutterSize="s" alignItems="center" responsive={false}>
          <EuiFlexItem grow={false}>
              <EuiIcon type="securityApp" size="l" />
          </EuiFlexItem>
          <EuiFlexItem>
              <EuiTitle size="xs">
                  <h3>Housekeeping</h3>
              </EuiTitle>
          </EuiFlexItem>
      </EuiFlexGroup>
      <EuiText size="s">
          <p>
              <EuiTextColor color="subdued">
                  Change model user permissions, model grouping, or delete the model.
              </EuiTextColor>
          </p>
      </EuiText>
  </div>
);

//returns the advanced settings menu, which is a drop down with a few settings
export default function AdvancedSettings() {

    //setting the value of the overview
    const [overviewValue, setOverviewValue] = useState('')

    //generated id
    const basicSelectId = useGeneratedHtmlId({ prefix: 'basicSelect' });

    //list of options to set a model as
    const options = [
        {value: 'project', text: 'Project'},
        {value: 'subsystem', text: 'Subsystem'},
        {value: 'component', text: 'Component'},
    ]

    //part of changing the value in the dropdown menu
    const onChange = (e: any) => {
        setOverviewValue(e.target.value);
    };

    const smallScreen = useIsWithinBreakpoints(['xs', 's', 'm']);
    //returns the three current advanced settings of changing type, deleting (which may be removed seems redundant), and then the third options which changes contorl
    // between each option there is a horizontal rule that proivides a line
    return(
      <SettingsAccordian
        id="model_advanced_settings"
        buttonContent={buttonContent}
      >
          <EuiFlexGrid direction="row" responsive={false} columns={smallScreen ? 1 : 2}>
              <EuiFlexItem grow={false}>
                  <EuiPanel paddingSize="xl">
                      <EuiTitle size="s" data-testid="title"><h6>Model Grouping</h6></EuiTitle>
                      <EuiSpacer size="s"/>
                      <EuiText size="s" data-testid="text" color="subdued">The model can be grouped as a project, subsystem, or component. <EuiSpacer size="s"/> <strong>Default: Component</strong></EuiText>
                      <EuiSpacer />
                      <EuiFormRow label="Grouping">
                          <EuiFlexGroup>
                              <EuiSelect
                                id={basicSelectId}
                                options={options}
                                value={overviewValue}
                                onChange={(e) => onChange(e)}
                                aria-label="Use aria labels when no actual label is in use"
                                fullWidth={true}
                                data-testid="grouping"
                              />
                          </EuiFlexGroup>
                      </EuiFormRow>
                      <EuiFormRow fullWidth>
                          <EuiButton fullWidth isDisabled={false} data-testid="saveButton" color="primary">Save</EuiButton>
                      </EuiFormRow>
                    </EuiPanel>
                </EuiFlexItem>
                <EuiFlexItem>
                  <EuiPanel paddingSize="xl">
                      <EuiFlexGroup direction="column">
                          <EuiTitle size="s" data-testid="trashTitle"><h6>Trash Model</h6></EuiTitle>
                          <EuiSpacer size="s"/>
                          <EuiText size="s" color="subdued" data-testid="trashText">Once deleted, a model cannot be recovered.</EuiText>
                          <EuiSpacer />
                          <EuiFormRow fullWidth>
                              <EuiButton fullWidth isDisabled={false} data-testid="trashButton" color="danger" fill>Trash</EuiButton>
                          </EuiFormRow>
                      </EuiFlexGroup>
                  </EuiPanel>
                </EuiFlexItem>
          </EuiFlexGrid>
      </SettingsAccordian>
    );
}
