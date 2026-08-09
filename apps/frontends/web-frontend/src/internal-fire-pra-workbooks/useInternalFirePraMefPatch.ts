import { type InternalFirePRA } from "interfaces-mef-types/internal-fire/internal-fire-pra";
import { useCallback } from "react";
import { patchInternalFirePraWorkbook } from "./internalFirePraWorkbookApi";

type Mutator = (mef: InternalFirePRA) => InternalFirePRA;
export function useInternalFirePraMefPatch(workbookId: string, current: InternalFirePRA | null, onSuccess: (mef: InternalFirePRA) => void, onError: (message: string) => void): { patch: (mutator: Mutator) => Promise<void> } {
  const patch = useCallback(async (mutator: Mutator): Promise<void> => {
    if (current === null) return;
    try {
      const response = await patchInternalFirePraWorkbook(workbookId, current, mutator(current));
      onSuccess(response.mef);
    } catch (error: unknown) {
      onError((error as { message?: string }).message ?? "Save failed");
    }
  }, [current, onError, onSuccess, workbookId]);
  return { patch };
}
