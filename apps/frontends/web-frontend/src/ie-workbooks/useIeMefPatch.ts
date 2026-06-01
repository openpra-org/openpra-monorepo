import { useCallback, useRef } from "react";
import { type InitiatingEventsAnalysis } from "interfaces-mef-types/ie/initiating-event-analysis";
import { patchIeWorkbook } from "./ieWorkbookApi";

type Mutator = (draft: InitiatingEventsAnalysis) => InitiatingEventsAnalysis;

interface IeMefPatcher {
  patch: (mutator: Mutator) => Promise<void>;
  patchDebounced: (mutator: Mutator) => void;
}

function useIeMefPatch(
  workbookId: string,
  current: InitiatingEventsAnalysis | null,
  onSuccess: (next: InitiatingEventsAnalysis) => void,
  onError: (message: string) => void,
): IeMefPatcher {
  const debounceTimer = useRef<number | null>(null);
  const pendingDraft = useRef<InitiatingEventsAnalysis | null>(null);

  const patch = useCallback(async (mutator: Mutator): Promise<void> => {
    if (current === null) return;
    const draft = mutator(current);
    try {
      const updated = await patchIeWorkbook(workbookId, draft);
      onSuccess(updated.mef);
    } catch (err: unknown) {
      onError((err as { message?: string }).message ?? "Save failed");
    }
  }, [workbookId, current, onSuccess, onError]);

  const patchDebounced = useCallback((mutator: Mutator): void => {
    if (current === null) return;
    pendingDraft.current = mutator(pendingDraft.current ?? current);
    if (debounceTimer.current !== null) window.clearTimeout(debounceTimer.current);
    debounceTimer.current = window.setTimeout(() => {
      const draft = pendingDraft.current;
      pendingDraft.current = null;
      if (draft === null) return;
      patchIeWorkbook(workbookId, draft)
        .then((res) => onSuccess(res.mef))
        .catch((err: unknown) => onError((err as { message?: string }).message ?? "Save failed"));
    }, 500);
  }, [workbookId, current, onSuccess, onError]);

  return { patch, patchDebounced };
}

export { useIeMefPatch, type IeMefPatcher, type Mutator };
