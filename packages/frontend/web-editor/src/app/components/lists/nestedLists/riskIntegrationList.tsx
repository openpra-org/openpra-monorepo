import NestedModelApiManager from "shared-types/src/lib/api/NestedModelApiManager";
import NestedModelList from "./templateList/nestedModelList";

export default function RiskIntegrationList() {
  return (
    <NestedModelList
      getNestedEndpoint={NestedModelApiManager.getRiskIntegration}
      deleteNestedEndpoint={NestedModelApiManager.deleteRiskIntegration}
      patchNestedEndpoint={NestedModelApiManager.patchRiskIntegrationLabel}
      name="risk-integration"
    />
  );
}
