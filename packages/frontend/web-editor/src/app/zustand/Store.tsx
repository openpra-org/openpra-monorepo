import { create } from "zustand";
import { createSelectors } from "./createSelectors";
import { internalEventsSlice } from "./internalEvents/internalEventsSlice";
import { InternalEventsType } from "./internalEvents/internalEventsTypes";
import { InternalHazardsType } from "./internalHazards/internalHazardsType";
import { internalHazardsSlice } from "./internalHazards/internalHazardsSlice";

export const SliceResetFns = new Set<() => void>();

export type storeType = InternalEventsType & InternalHazardsType;

const ResetAllSlices = (): void => {
  SliceResetFns.forEach((resetFn) => {
    resetFn();
  });
};

const UseGlobalStoreBase = create<storeType>()((...args) => ({
  ...internalEventsSlice(...args),
  ...internalHazardsSlice(...args),
}));

const UseGlobalStore = createSelectors(UseGlobalStoreBase);

export { ResetAllSlices, UseGlobalStore };