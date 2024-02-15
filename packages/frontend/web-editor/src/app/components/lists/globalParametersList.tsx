import { EuiFlexGroup } from "@elastic/eui";
import { ParameterItemsList } from "./parameterItemsList";

//as of right now this just returns the list of parameter items in parameter items
function GlobalParametersList() {
  return (
    <EuiFlexGroup>
      <ParameterItemsList></ParameterItemsList>
    </EuiFlexGroup>
  );
}
export { GlobalParametersList };
