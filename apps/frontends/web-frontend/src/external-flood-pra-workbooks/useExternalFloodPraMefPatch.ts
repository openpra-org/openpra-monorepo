import { type ExternalFloodPRA } from "interfaces-mef-types/external-flood/external-flood-pra";
import { useCallback } from "react";
import { patchExternalFloodPraWorkbook } from "./externalFloodPraWorkbookApi";

type Mutator = (mef: ExternalFloodPRA) => ExternalFloodPRA;
export function useExternalFloodPraMefPatch(workbookId: string, current: ExternalFloodPRA | null, onSuccess: (mef: ExternalFloodPRA) => void, onError: (message: string) => void): { patch: (mutator: Mutator) => Promise<void> } {
  const patch = useCallback(async (mutator: Mutator): Promise<void> => {
    if (current === null) return;
    try { const response = await patchExternalFloodPraWorkbook(workbookId, current, mutator(current)); onSuccess(response.mef); }
    catch (error: unknown) { onError((error as { message?: string }).message ?? "Save failed"); }
  }, [current, onError, onSuccess, workbookId]);
  return { patch };
}
