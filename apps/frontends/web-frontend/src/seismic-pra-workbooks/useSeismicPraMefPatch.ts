import { type SeismicPRA } from "interfaces-mef-types/seismic/seismic-pra";
import { useCallback } from "react";
import { patchSeismicPraWorkbook } from "./seismicPraWorkbookApi";

type Mutator = (mef: SeismicPRA) => SeismicPRA;

function useSeismicPraMefPatch(workbookId: string, current: SeismicPRA | null, onSuccess: (mef: SeismicPRA) => void, onError: (message: string) => void): { patch: (mutator: Mutator) => Promise<void> } {
  const patch = useCallback(async (mutator: Mutator): Promise<void> => {
    if (current === null) return;
    try {
      const response = await patchSeismicPraWorkbook(workbookId, current, mutator(current));
      onSuccess(response.mef);
    } catch (error: unknown) {
      onError((error as { message?: string }).message ?? "Save failed");
    }
  }, [current, onError, onSuccess, workbookId]);
  return { patch };
}

export { useSeismicPraMefPatch };
