import { GetCurrentModelType } from "shared-types/src/lib/api/TypedModelApiManager";
import { produce } from "immer";
import { typedModelType } from "packages/shared-types/src/lib/types/modelTypes/largeModels/typedModel";
import { GetCurrentNestedModelType } from "shared-types/src/lib/api/NestedModelApiManager";
import { StoreStateType } from "../Store";

export type TypedModelNames = "InternalEvents" | "InternalHazards" | "ExternalHazards" | "FullScope";
export type NestedModelNames = "initiatingEvents";

export const GetTypedModelName = (): TypedModelNames => {
  const typedModel = GetCurrentModelType();

  switch (typedModel) {
    case "internal-events":
      return "InternalEvents";
    case "internal-hazards":
      return "InternalHazards";
    case "external-hazards":
      return "ExternalHazards";
    case "full-scope":
      return "FullScope";
  }

  return "InternalEvents";
};

export const GetNestedModelName = (): NestedModelNames => {
  const nestedModel = GetCurrentNestedModelType();

  switch (nestedModel) {
    case "initiating-events":
      return "initiatingEvents";
  }

  return "initiatingEvents";
};

export const AddToParentModel = (state: StoreStateType, nestedModelId: string, parentIds: string[]) => {
  const typedModelName: keyof StoreStateType = GetTypedModelName();
  const nestedModelName: keyof typedModelType = GetNestedModelName();

  return state[typedModelName].map(
    produce((tm: typedModelType) => {
      if (parentIds.includes(tm._id)) {
        tm[nestedModelName].push(nestedModelId);
      }
    }),
  );
};

export const RemoveFromParentModel = (state: StoreStateType, nestedModelId: string, parentIds: string[]) => {
  const typedModelName: keyof StoreStateType = GetTypedModelName();
  const nestedModelName: keyof typedModelType = GetNestedModelName();

  return state[typedModelName].map(
    produce((tm: typedModelType) => {
      if (parentIds.includes(tm._id)) {
        tm[nestedModelName] = tm[nestedModelName].filter((ie: string) => ie !== nestedModelId);
      }
    }),
  );
};
