import {
  DeleteRiskIntegration,
  GetRiskIntegration,
  PatchRiskIntegrationLabel,
} from "shared-types/src/lib/api/NestedModelApiManager";
import { NestedModelList } from "./templateList/nestedModelList";

function RiskIntegrationList(): JSX.Element {
  return (
    <NestedModelList
      getNestedEndpoint={GetRiskIntegration}
      deleteNestedEndpoint={DeleteRiskIntegration}
      patchNestedEndpoint={PatchRiskIntegrationLabel}
      name="risk-integration"
    />
  );
}

export { RiskIntegrationList };
