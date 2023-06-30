import { EuiFlexGroup, EuiFlexItem, EuiText, useEuiTheme } from "@elastic/eui";
import ParameterItem from "../../smallcomponents/listitems/parameterItems";

//as of right now this just returns the list of parameter items in parameter items
export default function (){

    const {euiTheme} = useEuiTheme();

    return (
        <EuiFlexGroup style={{}}>
            <ParameterItem></ParameterItem>
        </EuiFlexGroup>
    )
}