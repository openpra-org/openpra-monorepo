import { type HazardsScreeningAnalysis } from "interfaces-mef-types/hazards-screening/hazards-screening-analysis";
import { createContext, type JSX, type ReactNode, useContext, useMemo } from "react";

export type HsaVariant = "htgr" | "sfr";
export type HsaMutator = (mef: HazardsScreeningAnalysis) => HazardsScreeningAnalysis;
interface HsaContextValue { mef: HazardsScreeningAnalysis; editable: boolean; mutate: (mutator: HsaMutator) => void }
const HsaContext = createContext<HsaContextValue | null>(null);
export function HsaWorkbookProvider({ mef, editable, mutate, children }: { mef: HazardsScreeningAnalysis; editable: boolean; mutate: (mutator: HsaMutator) => void; children: ReactNode }): JSX.Element {
  const value = useMemo(() => ({ mef, editable, mutate }), [mef, editable, mutate]);
  return <HsaContext.Provider value={value}>{children}</HsaContext.Provider>;
}
export function useHsaWorkbook(): HsaContextValue { const value = useContext(HsaContext); if (value === null) throw new Error("useHsaWorkbook must be used inside HsaWorkbookProvider"); return value; }
