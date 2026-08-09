import { type InternalFirePRA } from "interfaces-mef-types/internal-fire/internal-fire-pra";
import { createContext, type JSX, type ReactNode, useContext, useMemo } from "react";

export type InternalFirePraVariant = "htgr" | "sfr";
export type InternalFirePraMutator = (mef: InternalFirePRA) => InternalFirePRA;

interface InternalFirePraWorkbookContextValue {
  mef: InternalFirePRA;
  editable: boolean;
  mutate: (mutator: InternalFirePraMutator) => void;
}

const InternalFirePraWorkbookContext = createContext<InternalFirePraWorkbookContextValue | null>(null);

export function InternalFirePraWorkbookProvider({ mef, editable, mutate, children }: {
  mef: InternalFirePRA;
  editable: boolean;
  mutate: (mutator: InternalFirePraMutator) => void;
  children: ReactNode;
}): JSX.Element {
  const value = useMemo(() => ({ mef, editable, mutate }), [mef, editable, mutate]);
  return <InternalFirePraWorkbookContext.Provider value={value}>{children}</InternalFirePraWorkbookContext.Provider>;
}

export function useInternalFirePraWorkbook(): InternalFirePraWorkbookContextValue {
  const value = useContext(InternalFirePraWorkbookContext);
  if (value === null) throw new Error("useInternalFirePraWorkbook must be used inside InternalFirePraWorkbookProvider");
  return value;
}
