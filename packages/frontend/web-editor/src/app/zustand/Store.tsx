import { create } from "zustand";
import { devtools } from "zustand/middleware";

import { CreateSelectors } from "./CreateSelectors";
import { ExternalHazardsSlice } from "./ExternalHazards/ExternalHazardsSlice";
import { ExternalHazardsActionsType, ExternalHazardsType } from "./ExternalHazards/ExternalHazardsType";
import { FullScopeSlice } from "./FullScope/FullScopeSlice";
import { FullScopeActionsType, FullScopeType } from "./FullScope/FullScopeTypes";
import { InternalEventsSlice } from "./InternalEvents/InternalEventsSlice";
import { InternalEventsActionsType, InternalEventsType } from "./InternalEvents/InternalEventsTypes";
import { InternalHazardsSlice } from "./InternalHazards/InternalHazardsSlice";
import { InternalHazardsActionsType, InternalHazardsType } from "./InternalHazards/InternalHazardsType";
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
      ...InternalEventsSlice(...args),
      ...InternalHazardsSlice(...args),
      ...ExternalHazardsSlice(...args),
      ...FullScopeSlice(...args),
      ...NestedModelsSlice(...args),
    }),
    {
      enabled: true,
      name: "Zustand Model Store",
    },
  ),
);

const UseGlobalStore = CreateSelectors(UseGlobalStoreBase);

export { ResetAllSlices, UseGlobalStore };
