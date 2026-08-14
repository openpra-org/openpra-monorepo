import { type OtherHazardsPRA } from "interfaces-mef-types/other-hazards/other-hazards-pra";
import { useCallback } from "react";
import { patchOtherHazardsPraWorkbook } from "./otherHazardsPraWorkbookApi";

type Mutator = (mef: OtherHazardsPRA) => OtherHazardsPRA;
export function useOtherHazardsPraMefPatch(workbookId: string, current: OtherHazardsPRA | null, onSuccess: (mef: OtherHazardsPRA) => void, onError: (message: string) => void): { patch: (mutator: Mutator) => Promise<void> } {
  const patch = useCallback(async (mutator: Mutator): Promise<void> => {
    if (current === null) return;
    try { const response = await patchOtherHazardsPraWorkbook(workbookId, current, mutator(current)); onSuccess(response.mef); }
    catch (error: unknown) { onError((error as { message?: string }).message ?? "Save failed"); }
  }, [current, onError, onSuccess, workbookId]);
  return { patch };
}
