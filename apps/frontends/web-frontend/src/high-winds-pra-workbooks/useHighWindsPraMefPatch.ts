import { type HighWindsPRA } from "interfaces-mef-types/high-winds/high-winds-pra";
import { useCallback } from "react";
import { patchHighWindsPraWorkbook } from "./highWindsPraWorkbookApi";

type Mutator = (mef: HighWindsPRA) => HighWindsPRA;
export function useHighWindsPraMefPatch(workbookId: string, current: HighWindsPRA | null, onSuccess: (mef: HighWindsPRA) => void, onError: (message: string) => void): { patch: (mutator: Mutator) => Promise<void> } {
  const patch = useCallback(async (mutator: Mutator): Promise<void> => {
    if (current === null) return;
    try { const response = await patchHighWindsPraWorkbook(workbookId, current, mutator(current)); onSuccess(response.mef); }
    catch (error: unknown) { onError((error as { message?: string }).message ?? "Save failed"); }
  }, [current, onError, onSuccess, workbookId]);
  return { patch };
}
