import { ApiManager } from "shared-types/src/lib/api/ApiManager";
import {
  GetTypedModels,
  PostTypedModel,
  PatchTypedModel,
  DeleteTypedModel as DeleteTypedModelAPI,
} from "shared-types/src/openpra-mef-lib/api/TypedModelAPIManager";
import { StoreStateType, UseGlobalStore } from "../Store";
import {
  TypedModelDeleteRequest,
  TypedModelGetRequest,
  TypedModelName,
  TypedModelPatchRequest,
  TypedModelPostRequest,
} from "packages/shared-types/src/openpra-mef-types/api/TypedModelRequest";
import { TypedModel } from "packages/shared-types/src/openpra-mef-types/modelTypes/largeModels/TypedModel";
import { Label } from "packages/shared-types/src/openpra-mef-types/modelTypes/Label";

export const SetTypedModels = async (typedModelName: TypedModelName): Promise<void> => {
  try {
    const typedModelReq: TypedModelGetRequest = {
      typedModelName,
      userId: ApiManager.getCurrentUser().user_id || 0,
    };

    console.log(typedModelReq.userId);

    const typedModelsList: TypedModel[] = await GetTypedModels(typedModelReq);
    console.log(typedModelsList);
    UseGlobalStore.setState({
      typedModelName,
      typedModels: typedModelsList,
    });
  } catch (error) {}
};

export const AddTypedModel = async (typedModelName: TypedModelName, label: Label): Promise<void> => {
  try {
    const typedModelReq: TypedModelPostRequest = {
      typedModelName,
      label,
      users: [ApiManager.getCurrentUser().user_id || 0],
    };

    const typedModel: TypedModel = await PostTypedModel(typedModelReq);
    UseGlobalStore.setState((state: StoreStateType) => ({
      typedModels: [...state.typedModels, typedModel],
    }));
  } catch (error) {}
};

export const EditTypedModel = async (
  modelId: string,
  typedModelName: TypedModelName,
  typedModel: Partial<TypedModel>,
): Promise<void> => {
  try {
    const typedModelReq: TypedModelPatchRequest = {
      typedModelName,
      typedModel,
      userId: ApiManager.getCurrentUser().user_id || 0,
    };

    const typedModelEdited: TypedModel = await PatchTypedModel(modelId, typedModelReq);
    UseGlobalStore.setState((state: StoreStateType) => ({
      typedModels: state.typedModels.map((tm: TypedModel) => {
        if (tm._id === modelId) {
          return typedModelEdited;
        } else {
          return tm;
        }
      }),
    }));
  } catch (error) {}
};

export const DeleteTypedModel = async (modelId: string, typedModelName: TypedModelName): Promise<void> => {
  try {
    const typedModelReq: TypedModelDeleteRequest = {
      typedModelName,
      userId: ApiManager.getCurrentUser().user_id || 0,
    };

    await DeleteTypedModelAPI(modelId, typedModelReq);

    UseGlobalStore.setState((state: StoreStateType) => ({
      typedModels: state.typedModels.filter((tm: TypedModel) => tm._id !== modelId),
    }));
  } catch (error) {}
};
