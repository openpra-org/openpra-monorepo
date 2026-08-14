import { type OtherHazardsPRA } from "interfaces-mef-types/other-hazards/other-hazards-pra";
import { createContext, type JSX, type ReactNode, useContext, useMemo } from "react";

export type OtherHazardsPraMutator = (mef: OtherHazardsPRA) => OtherHazardsPRA;
interface OtherHazardsPraWorkbookContextValue { mef: OtherHazardsPRA; editable: boolean; mutate: (mutator: OtherHazardsPraMutator) => void }
const OtherHazardsPraWorkbookContext = createContext<OtherHazardsPraWorkbookContextValue | null>(null);

export function OtherHazardsPraWorkbookProvider({ mef, editable, mutate, children }: { mef: OtherHazardsPRA; editable: boolean; mutate: (mutator: OtherHazardsPraMutator) => void; children: ReactNode }): JSX.Element {
  const value = useMemo(() => ({ mef, editable, mutate }), [mef, editable, mutate]);
  return <OtherHazardsPraWorkbookContext.Provider value={value}>{children}</OtherHazardsPraWorkbookContext.Provider>;
}

export function useOtherHazardsPraWorkbook(): OtherHazardsPraWorkbookContextValue {
  const value = useContext(OtherHazardsPraWorkbookContext);
  if (value === null) throw new Error("useOtherHazardsPraWorkbook must be used inside OtherHazardsPraWorkbookProvider");
  return value;
}
