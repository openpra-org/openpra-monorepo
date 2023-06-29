import {EuiForm, useGeneratedHtmlId, useEuiTheme, EuiText, EuiAccordion, EuiFormRow, EuiFlexGroup, EuiButton, EuiSelect, EuiHorizontalRule } from '@elastic/eui'
import {useState } from 'react'
import DeleteItemBox from '../listchanging/deleteItemBox';

//eports as AdvancedSettings by default
export default function() {

    //use eui theme
    const {euiTheme} = useEuiTheme();

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

    //part of changing the value in the drop down menu
    const onChange = (e: any) => {
        setOverviewValue(e.target.value);
    };

    //constant used to make the delete button visible or not
    const [deleteVisible, setDeleteVisible] = useState(false);

    //function used for the delete part of the page
    function onDeleteClick(){
        setDeleteVisible(!deleteVisible)
    }

    //returns the three current advanced settings of changing type, deleting (which may be removed seems redundant), and then the third options which changes contorl
    // between each option there is a horizontal rule that proivides a line
    return(
        <>
            {/** the whole advanced settings is wrapped within an euiform */}
            <EuiForm fullWidth={true} style={{backgroundColor: euiTheme.colors.lightestShade, padding: '10px'}}>
                {/** this accordian displays all the advanced settings when clicked */}
                <EuiAccordion
                id="accordion11"
                arrowDisplay="right"
                buttonContent= <EuiText style={{fontSize: '2rem'}}>Advanced Settings</EuiText>
                paddingSize="s">
                    <EuiHorizontalRule/>
                    {/** line underneath the title, then the first option */}
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
                    {/** second thing */}
                    <EuiFormRow style={{marginTop: "20px"}}>
                        <EuiText style={{fontSize: '2rem'}}>Transfer </EuiText>
                    </EuiFormRow>
                    <EuiFormRow fullWidth={true}>
                        <EuiButton color='text' style={{borderRadius: '5px', backgroundColor: euiTheme.colors.mediumShade, color: euiTheme.colors.darkestShade}}>
                                Transfer
                        </EuiButton>
                    </EuiFormRow>
                    <EuiHorizontalRule/>
                    {/** third thing */}
                    <EuiFormRow style={{marginTop: "20px"}}>
                        <EuiText style={{fontSize: '2rem'}}>Delete Model</EuiText>
                    </EuiFormRow>
                    <EuiFormRow fullWidth={true}>
                        <EuiButton onClick={onDeleteClick} color='text' style={{borderRadius: '5px', backgroundColor: euiTheme.colors.mediumShade, color: euiTheme.colors.darkestShade}}>
                                Remove
                        </EuiButton>
                    </EuiFormRow>
                </EuiAccordion>
            </EuiForm>
            {deleteVisible && (
                <DeleteItemBox title='Model' page='model/1/settings'></DeleteItemBox>
            )}
        </>
    );
}