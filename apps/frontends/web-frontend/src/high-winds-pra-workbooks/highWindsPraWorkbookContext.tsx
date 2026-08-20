import { type HighWindsPRA } from "interfaces-mef-types/high-winds/high-winds-pra";
import { createContext, type JSX, type ReactNode, useContext, useMemo } from "react";

export type HighWindsPraMutator = (mef: HighWindsPRA) => HighWindsPRA;
interface HighWindsPraWorkbookContextValue { mef: HighWindsPRA; editable: boolean; mutate: (mutator: HighWindsPraMutator) => void }
const HighWindsPraWorkbookContext = createContext<HighWindsPraWorkbookContextValue | null>(null);

export function HighWindsPraWorkbookProvider({ mef, editable, mutate, children }: { mef: HighWindsPRA; editable: boolean; mutate: (mutator: HighWindsPraMutator) => void; children: ReactNode }): JSX.Element {
  const value = useMemo(() => ({ mef, editable, mutate }), [mef, editable, mutate]);
  return <HighWindsPraWorkbookContext.Provider value={value}>{children}</HighWindsPraWorkbookContext.Provider>;
}

export function useHighWindsPraWorkbook(): HighWindsPraWorkbookContextValue {
  const value = useContext(HighWindsPraWorkbookContext);
  if (value === null) throw new Error("useHighWindsPraWorkbook must be used inside HighWindsPraWorkbookProvider");
  return value;
}
