import { produce } from "immer";
import {
  DeleteBayesianNetwork as DeleteBayesianNetworkAPI,
  GetBayesianNetworks,
  PatchBayesianNetworkLabel,
  PostBayesianNetwork,
} from "shared-types/src/lib/api/NestedModelApiManager";
import { NestedModelJSON, NestedModelType } from "shared-types/src/lib/types/modelTypes/innerModels/nestedModel";

import { StoreStateType, UseGlobalStore } from "../../Store";
import { AddToParentModel, GetTypedModelName, RemoveFromParentModel } from "../Helper";

export const SetBayesianNetworks = async (parentId: string): Promise<void> => {
  try {
    const BayesianNetworks = await GetBayesianNetworks(parentId);
    UseGlobalStore.setState(
      produce((state: StoreStateType) => {
        state.NestedModels.parentId = parentId;
        state.NestedModels.SystemAnalysis.BayesianNetworks = BayesianNetworks;
      }),
    );
  } catch (error) {}
};

export const AddBayesianNetwork = async (data: NestedModelJSON): Promise<void> => {
  try {
    const typedModelName: keyof StoreStateType = GetTypedModelName();
    const BayesianNetwork: NestedModelType = await PostBayesianNetwork(data, typedModelName);

    UseGlobalStore.setState(
      produce((state: StoreStateType) => {
        state.NestedModels.SystemAnalysis.BayesianNetworks.push(BayesianNetwork);

        state[typedModelName] = AddToParentModel(state, BayesianNetwork._id, BayesianNetwork.parentIds);
      }),
    );
  } catch (error) {}
};

export const EditBayesianNetwork = async (modelId: string, data: Partial<NestedModelJSON>): Promise<void> => {
  if (!data.label) {
    return;
  }

  try {
    const bnr: NestedModelType = await PatchBayesianNetworkLabel(modelId, data.label);
    UseGlobalStore.setState(
      produce((state: StoreStateType) => {
        state.NestedModels.SystemAnalysis.BayesianNetworks = state.NestedModels.SystemAnalysis.BayesianNetworks.map(
          (bn: NestedModelType) => (bn._id === modelId ? bnr : bn),
        );
      }),
    );
  } catch (error) {}
};

export const DeleteBayesianNetwork = async (id: string): Promise<void> => {
  try {
    const typedModelName: keyof StoreStateType = GetTypedModelName();
    await DeleteBayesianNetworkAPI(id, typedModelName);

    UseGlobalStore.setState(
      produce((state: StoreStateType) => {
        const parentIds =
          state.NestedModels.SystemAnalysis.BayesianNetworks.find((bn) => bn._id === id)?.parentIds ?? [];

        state.NestedModels.SystemAnalysis.BayesianNetworks = state.NestedModels.SystemAnalysis.BayesianNetworks.filter(
          (bn: NestedModelType) => bn._id !== id,
        );

        state[typedModelName] = RemoveFromParentModel(state, id, parentIds);
      }),
    );
  } catch (error) {}
};
