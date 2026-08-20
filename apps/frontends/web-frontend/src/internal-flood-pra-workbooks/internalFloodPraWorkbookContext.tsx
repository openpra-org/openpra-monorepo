import { type InternalFloodPRA } from "interfaces-mef-types/internal-flood/internal-flood-pra";
import { createContext, type JSX, type ReactNode, useContext, useMemo } from "react";

export type InternalFloodPraVariant = "htgr" | "sfr";
export type InternalFloodPraMutator = (mef: InternalFloodPRA) => InternalFloodPRA;

interface InternalFloodPraWorkbookContextValue {
  mef: InternalFloodPRA;
  editable: boolean;
  mutate: (mutator: InternalFloodPraMutator) => void;
}

const InternalFloodPraWorkbookContext = createContext<InternalFloodPraWorkbookContextValue | null>(null);

export function InternalFloodPraWorkbookProvider({ mef, editable, mutate, children }: {
  mef: InternalFloodPRA;
  editable: boolean;
  mutate: (mutator: InternalFloodPraMutator) => void;
  children: ReactNode;
}): JSX.Element {
  const value = useMemo(() => ({ mef, editable, mutate }), [mef, editable, mutate]);
  return <InternalFloodPraWorkbookContext.Provider value={value}>{children}</InternalFloodPraWorkbookContext.Provider>;
}

export function useInternalFloodPraWorkbook(): InternalFloodPraWorkbookContextValue {
  const value = useContext(InternalFloodPraWorkbookContext);
  if (value === null) throw new Error("useInternalFloodPraWorkbook must be used inside InternalFloodPraWorkbookProvider");
  return value;
}
