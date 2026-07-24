import { type SeismicPRA } from "interfaces-mef-types/seismic/seismic-pra";
import { createContext, type JSX, type ReactNode, useContext, useMemo } from "react";

type SeismicPraMutator = (mef: SeismicPRA) => SeismicPRA;
interface SeismicPraWorkbookContextValue { mef: SeismicPRA; editable: boolean; mutate: (mutator: SeismicPraMutator) => void }

const SeismicPraWorkbookContext = createContext<SeismicPraWorkbookContextValue | null>(null);

function SeismicPraWorkbookProvider({ mef, editable, mutate, children }: { mef: SeismicPRA; editable: boolean; mutate: (mutator: SeismicPraMutator) => void; children: ReactNode }): JSX.Element {
  const value = useMemo(() => ({ mef, editable, mutate }), [mef, editable, mutate]);
  return <SeismicPraWorkbookContext.Provider value={value}>{children}</SeismicPraWorkbookContext.Provider>;
}

function useSeismicPraWorkbook(): SeismicPraWorkbookContextValue {
  const value = useContext(SeismicPraWorkbookContext);
  if (value === null) throw new Error("useSeismicPraWorkbook must be used inside SeismicPraWorkbookProvider");
  return value;
}

export { SeismicPraWorkbookProvider, useSeismicPraWorkbook, type SeismicPraMutator };
