import NestedModelApiManager from "shared-types/src/lib/api/NestedModelApiManager";
import NestedModelList from "./templateList/nestedModelList";

export default function BayesianNetworkList() {
  return (
    <NestedModelList
      getNestedEndpoint={NestedModelApiManager.getBayesianNetworks}
      deleteNestedEndpoint={NestedModelApiManager.deleteBayesianNetwork}
      patchNestedEndpoint={NestedModelApiManager.patchBayesianNetworkLabel}
      name="bayesian-network"
    />
  );
}
