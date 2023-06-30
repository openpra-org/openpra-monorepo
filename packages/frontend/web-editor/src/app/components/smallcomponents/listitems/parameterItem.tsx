import {EuiFlexGroup, EuiFlexItem, EuiText, EuiIcon, useEuiTheme} from "@elastic/eui";


export default function (){

    const parameters = [
        {name: 'Parameter1', value: '5000'},
        {name: 'Parameter2', value: '6000'}
    ]

    const {euiTheme} = useEuiTheme();

    return (
        <EuiFlexGroup direction='column'>
            <EuiFlexItem grow={false} style={{margin: '10px', padding: '10px'}}>
                <EuiFlexGroup>
                    <EuiText style={{fontSize: '2rem', width: '19%'}}>Parameter</EuiText>
                    <EuiText style={{fontSize: '2rem'}}>Value</EuiText>
                </EuiFlexGroup>
            </EuiFlexItem>
            {parameters.map((param)=>(
                    <EuiFlexItem grow={false} style={{backgroundColor: euiTheme.colors.lightShade, margin: '10px', padding: '10px'}}>
                        <EuiFlexGroup direction='row'>
                            <EuiText style={{width: '20%'}}> {param.name}</EuiText>
                            <EuiText style={{width: '70%'}}> {param.value} </EuiText>
                            <EuiIcon style={{width: '10%'}} type='trash'/>
                        </EuiFlexGroup>
                    </EuiFlexItem>
            ))}
        </EuiFlexGroup>
    )
}