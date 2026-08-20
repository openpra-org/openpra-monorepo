import { type HazardsScreeningAnalysis } from "interfaces-mef-types/hazards-screening/hazards-screening-analysis";
import { useCallback, useRef } from "react";
import { patchHsaWorkbook } from "./hsaWorkbookApi";
type Mutator = (mef: HazardsScreeningAnalysis) => HazardsScreeningAnalysis;
export function useHsaMefPatch(workbookId: string, current: HazardsScreeningAnalysis | null, onSuccess: (mef: HazardsScreeningAnalysis) => void, onError: (message: string) => void): { patch: (mutator: Mutator) => Promise<void> } {
  const currentRef = useRef(current); currentRef.current = current;
  const patch = useCallback(async (mutator: Mutator): Promise<void> => { const snapshot = currentRef.current; if (snapshot === null || workbookId.length === 0) return; try { const response = await patchHsaWorkbook(workbookId, snapshot, mutator(snapshot)); currentRef.current = response.mef; onSuccess(response.mef); } catch (error: unknown) { onError((error as { message?: string }).message ?? "Could not save the Hazards Screening Analysis workbook"); } }, [onError, onSuccess, workbookId]);
  return { patch };
}
