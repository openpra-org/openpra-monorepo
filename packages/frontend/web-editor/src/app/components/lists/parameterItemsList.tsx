import {EuiFlexGroup, EuiFlexItem, EuiText, useEuiTheme, EuiHorizontalRule, EuiButtonIcon} from "@elastic/eui";
import DeleteItemBox from "../listchanging/deleteItemBox";
import { useState } from "react";


export default function parameterItems(){

    //state to toggle the delete menu
    const [deleteVisible, setDeleteVisible] = useState(false);


    function onDeleteClick(){
        setDeleteVisible(!deleteVisible)
    }

    //dummy data right now
    const parameters = [
        {name: 'Parameter1', value: '5000'},
        {name: 'Parameter2', value: '6000'}
    ]

    const {euiTheme} = useEuiTheme();

    return (
        <EuiFlexGroup direction='column' alignItems="center" gutterSize="s">
            {/** displays the title, this is seperate from the items and has the width 47% to line up correctl, it look sright because it is in the flex group */}
            <EuiFlexItem grow={false} style={{marginTop: "20px", width: "1000px"}}>
                <EuiFlexGroup>
                    <EuiText style={{fontSize: '2rem', width: '47%'}}><strong>Parameter</strong></EuiText>
                    <EuiText style={{fontSize: '2rem'}}><strong>Value</strong></EuiText>
                </EuiFlexGroup>
                {/** horizontal line */}
                <EuiHorizontalRule style={{width: "1000px", marginTop: "10px", marginBottom: "0px"}}/>
            </EuiFlexItem>
            {/** a list that is generated through paramters and displays all the global parameters */}
            {parameters.map((param)=>(
                <EuiFlexItem grow={false} style={{backgroundColor: euiTheme.colors.lightShade, padding: '10px', width: "1000px", borderRadius: "4px"}}>
                    <EuiFlexGroup direction='row'>
                        <EuiText style={{fontSize: '1.5rem', width: '50%'}}> {param.name}</EuiText>
                        <EuiText style={{fontSize: '1.5rem', width: '40%'}}> {param.value} </EuiText>
                        <EuiButtonIcon color='text' onClick={onDeleteClick} iconType='trash' title='delete' style={{width: "10%"}}/>
                    </EuiFlexGroup>
                </EuiFlexItem>
            ))}
            {/** this is where the delete overlay mask will go for confiring a delete */}
        {deleteVisible && (
          <DeleteItemBox title='Global Parameter' toggleBox={setDeleteVisible}></DeleteItemBox>
        )}
        </EuiFlexGroup>
        
    )
}