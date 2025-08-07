import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { TypedModelActionsType, TypedModelStateType } from "./TypedModels/TypedModelTypes";
import { TypedModelsSlice } from "./TypedModels/TypedModelsSlice";
import { CreateSelectors } from "./CreateSelectors";

export const SliceResetFns = new Set<() => void>();

export type StoreStateType = TypedModelStateType;

export type StoreActionType = TypedModelActionsType;

const ResetAllSlices = (): void => {
  SliceResetFns.forEach((resetFn) => {
    resetFn();
  });
};

const UseGlobalStoreBase = create<StoreStateType & StoreActionType>()(
  devtools(
    (...args) => ({
      ...TypedModelsSlice(...args)
    }),
    {
      enabled: true,
      name: "Zustand Model Store",
    },
  ),
);

const UseGlobalStore = CreateSelectors(UseGlobalStoreBase);

export { ResetAllSlices, UseGlobalStore };
