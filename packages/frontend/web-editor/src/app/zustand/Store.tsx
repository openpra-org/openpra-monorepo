import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { CreateSelectors } from "./CreateSelectors";
import { InternalEventsSlice } from "./InternalEvents/InternalEventsSlice";
import { InternalEventsActionsType, InternalEventsType } from "./InternalEvents/InternalEventsTypes";
import { InternalHazardsSlice } from "./InternalHazards/InternalHazardsSlice";
import { InternalHazardsActionsType, InternalHazardsType } from "./InternalHazards/InternalHazardsType";
import { ExternalHazardsSlice } from "./ExternalHazards/ExternalHazardsSlice";
import { ExternalHazardsActionsType, ExternalHazardsType } from "./ExternalHazards/ExternalHazardsType";
import { FullScopeSlice } from "./FullScope/FullScopeSlice";
import { FullScopeActionsType, FullScopeType } from "./FullScope/FullScopeTypes";
import { NestedModelsSlice } from "./NestedModels/NestedModelsSlice";
import { NestedModelActionsType, NestedModelsType } from "./NestedModels/NestedModelsType";

export interface CurrentModel {
  id: string;
}

export const SliceResetFns = new Set<() => void>();

export type StoreStateType = InternalEventsType &
  InternalHazardsType &
  ExternalHazardsType &
  FullScopeType &
  NestedModelsType & {
    currentModel: CurrentModel | null;
  };

export type StoreActionType = InternalEventsActionsType &
  FullScopeActionsType &
  ExternalHazardsActionsType &
  InternalHazardsActionsType &
  NestedModelActionsType & {
    setCurrentModel: (model: CurrentModel) => void;
  };

const ResetAllSlices = (): void => {
  SliceResetFns.forEach((resetFn) => {
    resetFn();
  });
};

const UseGlobalStoreBase = create<StoreStateType & StoreActionType>()(
  devtools(
    (...args) => {
      const [set, get, store] = args;
      return {...InternalEventsSlice(...args),
        ...InternalHazardsSlice(...args),
        ...ExternalHazardsSlice(...args),
        ...FullScopeSlice(...args),
        ...NestedModelsSlice(...args),
        currentModel: null,
        setCurrentModel: (model: CurrentModel) => set({ currentModel: model })}
    },
    {
      enabled: true,
      name: "Zustand Model Store",
    },
  ),
);

const UseGlobalStore = CreateSelectors(UseGlobalStoreBase);

export { ResetAllSlices, UseGlobalStore };
