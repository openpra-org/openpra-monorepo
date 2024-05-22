import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { createSelectors } from "./createSelectors";
import { internalEventsSlice } from "./internalEvents/internalEventsSlice";
import { InternalEventsActionsType, InternalEventsType } from "./internalEvents/internalEventsTypes";
import { internalHazardsSlice } from "./internalHazards/internalHazardsSlice";
import { InternalHazardsActionsType, InternalHazardsType } from "./internalHazards/internalHazardsType";
import { externalHazardsSlice } from "./externalHazards/externalHazardsSlice";
import { ExternalHazardsActionsType, ExternalHazardsType } from "./externalHazards/externalHazardsType";
import { fullScopeSlice } from "./fullScope/fullScopeSlice";
import { FullScopeActionsType, FullScopeType } from "./fullScope/fullScopeTypes";
import { NestedModelsSlice } from "./NestedModels/NestedModelsSlice";
import { NestedModelActionsType, NestedModelsType } from "./NestedModels/NestedModelsType";

export const SliceResetFns = new Set<() => void>();

export type StoreStateType = InternalEventsType &
  InternalHazardsType &
  ExternalHazardsType &
  FullScopeType &
  NestedModelsType;

export type StoreActionType = InternalEventsActionsType &
  FullScopeActionsType &
  ExternalHazardsActionsType &
  InternalHazardsActionsType &
  NestedModelActionsType;

const ResetAllSlices = (): void => {
  SliceResetFns.forEach((resetFn) => {
    resetFn();
  });
};

const UseGlobalStoreBase = create<StoreStateType & StoreActionType>()(
  devtools(
    (...args) => ({
      ...internalEventsSlice(...args),
      ...internalHazardsSlice(...args),
      ...externalHazardsSlice(...args),
      ...fullScopeSlice(...args),
      ...NestedModelsSlice(...args),
    }),
    {
      enabled: true,
      name: "Zustand Model Store",
    },
  ),
);

const UseGlobalStore = createSelectors(UseGlobalStoreBase);

export { ResetAllSlices, UseGlobalStore };
