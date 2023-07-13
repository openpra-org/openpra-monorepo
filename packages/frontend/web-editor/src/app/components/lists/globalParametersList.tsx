import { EuiFlexGroup, useEuiTheme } from "@elastic/eui";
import ParameterItems from "../listitems/parameterItems";

//as of right now this just returns the list of parameter items in parameter items
export default function (){

    return (
        <EuiFlexGroup>
            <ParameterItems></ParameterItems>
        </EuiFlexGroup>
    )
}
