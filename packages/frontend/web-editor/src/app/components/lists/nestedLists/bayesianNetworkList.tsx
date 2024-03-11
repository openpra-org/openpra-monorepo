import {
  DeleteBayesianNetwork,
  GetBayesianNetworks,
  PatchBayesianNetworkLabel,
} from "shared-types/src/lib/api/NestedModelApiManager";
import { NestedModelList } from "./templateList/nestedModelList";

function BayesianNetworkList(): JSX.Element {
  return (
    <NestedModelList
      getNestedEndpoint={GetBayesianNetworks}
      deleteNestedEndpoint={DeleteBayesianNetwork}
      patchNestedEndpoint={PatchBayesianNetworkLabel}
      name="bayesian-network"
    />
  );
}
export { BayesianNetworkList };
