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

/**
 * Registry of per-slice reset callbacks used to clear slice state.
 *
 * @remarks
 * Each slice can push a reset function to this set so {@link ResetAllSlices}
 * can clear the entire store deterministically.
 */
export const SliceResetFns = new Set<() => void>();

/**
 * Combined Zustand state across all slices.
 */
export type StoreStateType = InternalEventsType &
  InternalHazardsType &
  ExternalHazardsType &
  FullScopeType &
  NestedModelsType;

/**
 * Combined action surface across all slices.
 */
export type StoreActionType = InternalEventsActionsType &
  FullScopeActionsType &
  ExternalHazardsActionsType &
  InternalHazardsActionsType &
  NestedModelActionsType;

/**
 * Invoke all registered slice reset functions to restore initial state.
 */
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

/**
 * Global store accessor with derived selector hooks at `use.*`.
 *
 * @example
 * const count = UseGlobalStore.use.counter();
 */
const UseGlobalStore = CreateSelectors(UseGlobalStoreBase);

export { ResetAllSlices, UseGlobalStore };
