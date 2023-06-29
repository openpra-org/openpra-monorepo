import {EuiForm, EuiFormRow, EuiSelect, EuiButton, EuiFlexGroup, EuiFlexItem, EuiTextColor, useGeneratedHtmlId, useEuiTheme } from '@elastic/eui'
import React, {useState } from 'react'

export default function SettingsOverview() {

    const {euiTheme} = useEuiTheme();

    const [overviewValue, setOverviewValue] = useState('')

    const basicSelectId = useGeneratedHtmlId({ prefix: 'basicSelect' });

    const options = [
        {value: '', text: 'Choose One'},
        {value: 'newEventTree', text: 'New Event Tree'},
        {value: 'newFaultTree', text: 'New Fault Tree'},
        {value: 'newBayesianNetwork', text: 'New Bayesian Network'},
    ]

    const onChange = (e: any) => {
        setOverviewValue(e.target.value);
    };

    return(
        <EuiForm fullWidth={true}>
            <EuiFormRow fullWidth={true} style={{margin: '10px'}}>
                <EuiFlexGroup>
                    <EuiFlexItem>
                        <EuiTextColor>Diagram Name</EuiTextColor>
                    </EuiFlexItem>
                    <EuiSelect
                        id={basicSelectId}
                        options={options}
                        value={overviewValue}
                        onChange={(e) => onChange(e)}
                        aria-label="Use aria labels when no actual label is in use"
                        fullWidth={true}
                    />
                    <EuiButton>
                        Save
                    </EuiButton>
                </EuiFlexGroup>
            </EuiFormRow>
        </EuiForm>
    )
}