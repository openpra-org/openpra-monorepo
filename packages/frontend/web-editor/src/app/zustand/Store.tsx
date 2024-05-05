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
import { EventTreeEditorType } from "./EventTreeEditor/eventTreeEditorType"; // Include the EventTreeEditor types
import { eventTreeEditorSlice } from "./EventTreeEditor/eventTreeEditorSlice"; // Include the EventTreeEditor slice

export const SliceResetFns = new Set<() => void>();

export type storeType = InternalEventsType &
  InternalHazardsType &
  ExternalHazardsType &
  FullScopeType &
  EventTreeEditorType;

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
  ...eventTreeEditorSlice(...args),
}));

const UseGlobalStore = createSelectors(UseGlobalStoreBase);

export { ResetAllSlices, UseGlobalStore };
