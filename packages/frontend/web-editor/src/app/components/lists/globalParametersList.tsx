import { EuiFlexGroup } from "@elastic/eui";
import { ParameterItemsList } from "./parameterItemsList";
function GlobalParametersList(): JSX.Element {
  return (
    <EuiFlexGroup>
      <ParameterItemsList></ParameterItemsList>
    </EuiFlexGroup>
  );
}
export { GlobalParametersList };
