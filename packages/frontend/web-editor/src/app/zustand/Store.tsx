import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { createSelectors } from "./createSelectors";
import { internalEventsSlice } from "./internalEvents/internalEventsSlice";
import { InternalEventsType } from "./internalEvents/internalEventsTypes";
import { internalHazardsSlice } from "./internalHazards/internalHazardsSlice";
import { InternalHazardsType } from "./internalHazards/internalHazardsType";
import { externalHazardsSlice } from "./externalHazards/externalHazardsSlice";
import { ExternalHazardsType } from "./externalHazards/externalHazardsType";
import { fullScopeSlice } from "./fullScope/fullScopeSlice";
import { FullScopeType } from "./fullScope/fullScopeTypes";
import { NestedModelsSlice } from "./NestedModels/NestedModelsSlice";
import { NestedModelsTypes } from "./NestedModels/NestedModelsTypes";

export const SliceResetFns = new Set<() => void>();

export type StoreType = InternalEventsType &
  InternalHazardsType &
  ExternalHazardsType &
  FullScopeType &
  NestedModelsTypes;

const ResetAllSlices = (): void => {
  SliceResetFns.forEach((resetFn) => {
    resetFn();
  });
};

const UseGlobalStoreBase = create<StoreType>()(
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
