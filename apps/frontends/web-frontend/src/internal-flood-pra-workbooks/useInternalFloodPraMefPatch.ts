import { type InternalFloodPRA } from "interfaces-mef-types/internal-flood/internal-flood-pra";
import { useCallback } from "react";
import { patchInternalFloodPraWorkbook } from "./internalFloodPraWorkbookApi";

type Mutator = (mef: InternalFloodPRA) => InternalFloodPRA;
export function useInternalFloodPraMefPatch(workbookId: string, current: InternalFloodPRA | null, onSuccess: (mef: InternalFloodPRA) => void, onError: (message: string) => void): { patch: (mutator: Mutator) => Promise<void> } {
  const patch = useCallback(async (mutator: Mutator): Promise<void> => {
    if (current === null) return;
    try {
      const response = await patchInternalFloodPraWorkbook(workbookId, current, mutator(current));
      onSuccess(response.mef);
    } catch (error: unknown) {
      onError((error as { message?: string }).message ?? "Save failed");
    }
  }, [current, onError, onSuccess, workbookId]);
  return { patch };
}
