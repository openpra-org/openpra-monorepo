import { create } from "zustand";
import { createSelectors } from "./createSelectors";
import { internalEventsSlice } from "./internalEvents/internalEventsSlice";
import { InternalEventsType } from "./internalEvents/internalEventsTypes";
import { InternalHazardsType } from "./internalHazards/internalHazardsType";
import { internalHazardsSlice } from "./internalHazards/internalHazardsSlice";
import { ExternalHazardsType } from "./externalHazards/externalHazardsType";
import { externalHazardsSlice } from "./externalHazards/externalHazardsSlice";
import { FullScopeType } from "./fullScope/fullScopeTypes";
import { fullScopeSlice } from "./fullScope/fullScopeSlice";

export const SliceResetFns = new Set<() => void>();

export type storeType = InternalEventsType &
  InternalHazardsType &
  ExternalHazardsType &
  FullScopeType;

const ResetAllSlices = (): void => {
  SliceResetFns.forEach((resetFn) => {
    resetFn();
  });
};

const UseGlobalStoreBase = create<storeType>()((...args) => ({
  ...internalEventsSlice(...args),
  ...internalHazardsSlice(...args),
  ...externalHazardsSlice(...args),
  ...fullScopeSlice(...args),
}));

const UseGlobalStore = createSelectors(UseGlobalStoreBase);

export { ResetAllSlices, UseGlobalStore };
