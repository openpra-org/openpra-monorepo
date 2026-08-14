import { type ExternalFloodPRA } from "interfaces-mef-types/external-flood/external-flood-pra";
import { createContext, type JSX, type ReactNode, useContext, useMemo } from "react";

export type ExternalFloodPraMutator = (mef: ExternalFloodPRA) => ExternalFloodPRA;
interface ExternalFloodPraWorkbookContextValue { mef: ExternalFloodPRA; editable: boolean; mutate: (mutator: ExternalFloodPraMutator) => void }
const ExternalFloodPraWorkbookContext = createContext<ExternalFloodPraWorkbookContextValue | null>(null);

export function ExternalFloodPraWorkbookProvider({ mef, editable, mutate, children }: { mef: ExternalFloodPRA; editable: boolean; mutate: (mutator: ExternalFloodPraMutator) => void; children: ReactNode }): JSX.Element {
  const value = useMemo(() => ({ mef, editable, mutate }), [mef, editable, mutate]);
  return <ExternalFloodPraWorkbookContext.Provider value={value}>{children}</ExternalFloodPraWorkbookContext.Provider>;
}

export function useExternalFloodPraWorkbook(): ExternalFloodPraWorkbookContextValue {
  const value = useContext(ExternalFloodPraWorkbookContext);
  if (value === null) throw new Error("useExternalFloodPraWorkbook must be used inside ExternalFloodPraWorkbookProvider");
  return value;
}
