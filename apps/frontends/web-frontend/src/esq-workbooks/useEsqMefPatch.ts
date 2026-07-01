import { useCallback, useRef } from "react";
import { type EventSequenceQuantification } from "interfaces-mef-types/esq/event-sequence-quantification";
import { patchEsqWorkbook } from "./esqWorkbookApi";

type Mutator = (draft: EventSequenceQuantification) => EventSequenceQuantification;

interface EsqMefPatcher {
  patch: (mutator: Mutator) => Promise<void>;
  patchDebounced: (mutator: Mutator) => void;
}

function useEsqMefPatch(
  workbookId: string,
  current: EventSequenceQuantification | null,
  onSuccess: (next: EventSequenceQuantification) => void,
  onError: (message: string) => void,
): EsqMefPatcher {
  const debounceTimer = useRef<number | null>(null);
  const pendingDraft = useRef<EventSequenceQuantification | null>(null);

  const patch = useCallback(async (mutator: Mutator): Promise<void> => {
    if (current === null) return;
    const draft = mutator(current);
    try {
      const updated = await patchEsqWorkbook(workbookId, draft);
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
      patchEsqWorkbook(workbookId, draft)
        .then((res) => onSuccess(res.mef))
        .catch((err: unknown) => onError((err as { message?: string }).message ?? "Save failed"));
    }, 500);
  }, [workbookId, current, onSuccess, onError]);

  return { patch, patchDebounced };
}

export { useEsqMefPatch, type EsqMefPatcher, type Mutator };
