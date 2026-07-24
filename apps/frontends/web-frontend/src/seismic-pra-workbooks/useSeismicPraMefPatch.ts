import { type SeismicPRA } from "interfaces-mef-types/seismic/seismic-pra";
import { useCallback, useRef } from "react";
import { patchSeismicPraWorkbook } from "./seismicPraWorkbookApi";

type Mutator = (mef: SeismicPRA) => SeismicPRA;

function useSeismicPraMefPatch(workbookId: string, current: SeismicPRA | null, onSuccess: (mef: SeismicPRA) => void, onError: (message: string) => void): { patchDebounced: (mutator: Mutator) => void } {
  const timer = useRef<number | null>(null);
  const pending = useRef<SeismicPRA | null>(null);
  const patchDebounced = useCallback((mutator: Mutator): void => {
    if (current === null) return;
    pending.current = mutator(pending.current ?? current);
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const draft = pending.current;
      pending.current = null;
      if (draft === null) return;
      patchSeismicPraWorkbook(workbookId, draft).then((res) => onSuccess(res.mef)).catch((err: unknown) => onError((err as { message?: string }).message ?? "Save failed"));
    }, 500);
  }, [current, onError, onSuccess, workbookId]);
  return { patchDebounced };
}

export { useSeismicPraMefPatch };
