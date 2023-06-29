import {EuiForm, useGeneratedHtmlId, useEuiTheme, EuiText, EuiAccordion, EuiFormRow, EuiFlexGroup, EuiButton, EuiSelect, EuiHorizontalRule } from '@elastic/eui'
import {useState } from 'react'

export default function() {

    const {euiTheme} = useEuiTheme();

    const [overviewValue, setOverviewValue] = useState('')

    const basicSelectId = useGeneratedHtmlId({ prefix: 'basicSelect' });

    const options = [
        {value: 'project', text: 'Project'},
        {value: 'subsystem', text: 'Subsystem'},
        {value: 'component', text: 'Component'},
    ]

    const onChange = (e: any) => {
        setOverviewValue(e.target.value);
    };

    return(
        <EuiForm fullWidth={true} style={{backgroundColor: euiTheme.colors.lightestShade, padding: '10px'}}>
            <EuiAccordion
            id="accordion11"
            arrowDisplay="right"
            buttonContent= <EuiText style={{fontSize: '2rem'}}>Advanced Settings</EuiText>
            paddingSize="s">
                <EuiHorizontalRule/>
                <EuiFormRow style={{marginTop: "20px"}}>
                    <EuiText style={{fontSize: '2rem'}}> Select the type for this model</EuiText>
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
                        <EuiButton color='text' style={{borderRadius: '5px', backgroundColor: euiTheme.colors.mediumShade, color: euiTheme.colors.darkestShade}}>
                            Save
                        </EuiButton>
                    </EuiFlexGroup>
                </EuiFormRow>
                <EuiHorizontalRule/>
                <EuiFormRow style={{marginTop: "20px"}}>
                    <EuiText style={{fontSize: '2rem'}}>Transfer </EuiText>
                </EuiFormRow>
                <EuiFormRow fullWidth={true}>
                    <EuiButton color='text' style={{borderRadius: '5px', backgroundColor: euiTheme.colors.mediumShade, color: euiTheme.colors.darkestShade}}>
                            Transfer
                    </EuiButton>
                </EuiFormRow>
                <EuiHorizontalRule/>
                <EuiFormRow style={{marginTop: "20px"}}>
                    <EuiText style={{fontSize: '2rem'}}>Delete Model</EuiText>
                </EuiFormRow>
                <EuiFormRow fullWidth={true}>
                    <EuiButton color='text' style={{borderRadius: '5px', backgroundColor: euiTheme.colors.mediumShade, color: euiTheme.colors.darkestShade}}>
                            Remove
                    </EuiButton>
                </EuiFormRow>
            </EuiAccordion>
        </EuiForm>
    )
}