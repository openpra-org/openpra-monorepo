import { EuiFlexGroup, EuiFlexItem, EuiText, useEuiTheme } from "@elastic/eui";
import ParameterItem from "../../smallcomponents/listitems/parameterItem";


export default function (){

    const {euiTheme} = useEuiTheme();

    return (
        <EuiFlexGroup style={{}}>
            <ParameterItem></ParameterItem>
        </EuiFlexGroup>
    )
}