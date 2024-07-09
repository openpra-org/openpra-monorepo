import { UseGlobalStore } from "../../../zustand/Store";
import { NestedModelListZustand } from "./templateList/nestedModelListZustand";

function BayesianNetworkList(): JSX.Element {
  const BayesianNetwork = UseGlobalStore.use.NestedModels().SystemAnalysis.BayesianNetworks;
  const SetBayesianNetworks = UseGlobalStore.use.SetBayesianNetworks();
  const AddBayesianNetwork = UseGlobalStore.use.AddBayesianNetwork();
  const DeleteBayesianNetwork = UseGlobalStore.use.DeleteBayesianNetwork();
  const EditBayesianNetwork = UseGlobalStore.use.EditBayesianNetwork();

  // TODO: Change this component to use the new one and delete the old component
  return (
    <NestedModelListZustand
      NestedModelList={BayesianNetwork}
      GetNestedModel={SetBayesianNetworks}
      DeleteNestedModel={DeleteBayesianNetwork}
      EditNestedModel={EditBayesianNetwork}
      AddNestedModel={AddBayesianNetwork}
      name="bayesian-network"
    />
  );
}

export { BayesianNetworkList };
