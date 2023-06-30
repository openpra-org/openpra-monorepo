import { EuiFlexGroup, EuiFlexItem, EuiText, useEuiTheme } from "@elastic/eui";


export default function (){

    const {euiTheme} = useEuiTheme();

    return (
        <EuiFlexGroup style={{backgroundColor: euiTheme.colors.lightShade, width: "500px"}}>
            <EuiFlexItem>
                <EuiText> Parameter </EuiText>
            </EuiFlexItem>
            <EuiFlexItem>
                <EuiText> 5000 </EuiText>
            </EuiFlexItem>
        </EuiFlexGroup>
    )
}