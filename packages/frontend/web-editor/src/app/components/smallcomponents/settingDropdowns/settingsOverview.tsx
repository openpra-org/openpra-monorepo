import {EuiForm, EuiFormRow, EuiSelect, EuiButton, EuiFlexGroup, EuiFlexItem, EuiTextColor, useGeneratedHtmlId, useEuiTheme, EuiText } from '@elastic/eui'
import React, {useState } from 'react'

export default function SettingsOverview() {

    const {euiTheme} = useEuiTheme();

    const [overviewValue, setOverviewValue] = useState('')

    const basicSelectId = useGeneratedHtmlId({ prefix: 'basicSelect' });

    const options = [
        {value: 'eventTree', text: 'Event Tree'},
        {value: 'faultTree', text: 'Fault Tree'},
        {value: 'bayesianNetwork', text: 'Bayesian Network'},
    ]

    const onChange = (e: any) => {
        setOverviewValue(e.target.value);
    };

    return(
        <EuiForm fullWidth={true} style={{marginTop: "20px"}}>
            <EuiFormRow>
                <EuiText style={{fontSize: '2rem'}}> <strong>Select the diagram to be displayed on the overview page </strong></EuiText>
            </EuiFormRow>
            <EuiFormRow fullWidth={true}>
                <EuiFlexGroup>
                    <EuiSelect
                        id={basicSelectId}
                        options={options}
                        value={overviewValue}
                        onChange={(e) => onChange(e)}
                        aria-label="Use aria labels when no actual label is in use"
                        fullWidth={true}
                    />
                    <EuiButton color='text'>
                        Save
                    </EuiButton>
                </EuiFlexGroup>
            </EuiFormRow>
        </EuiForm>
    )
}