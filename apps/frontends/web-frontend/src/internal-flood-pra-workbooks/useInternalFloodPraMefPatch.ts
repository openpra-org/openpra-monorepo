import { type InternalFloodPRA } from "interfaces-mef-types/internal-flood/internal-flood-pra";
import { useCallback, useRef } from "react";
import { patchInternalFloodPraWorkbook } from "./internalFloodPraWorkbookApi";

type Mutator = (mef: InternalFloodPRA) => InternalFloodPRA;
export function useInternalFloodPraMefPatch(workbookId: string, current: InternalFloodPRA | null, onSuccess: (mef: InternalFloodPRA) => void, onError: (message: string) => void): { patchDebounced: (mutator: Mutator) => void } {
  const timer = useRef<number | null>(null); const pending = useRef<InternalFloodPRA | null>(null);
  const patchDebounced = useCallback((mutator: Mutator): void => {
    if (current === null) return;
    pending.current = mutator(pending.current ?? current);
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => { const draft = pending.current; pending.current = null; if (draft === null) return; patchInternalFloodPraWorkbook(workbookId, draft).then((response) => onSuccess(response.mef)).catch((error: unknown) => onError((error as { message?: string }).message ?? "Save failed")); }, 500);
  }, [current, onError, onSuccess, workbookId]);
  return { patchDebounced };
}
