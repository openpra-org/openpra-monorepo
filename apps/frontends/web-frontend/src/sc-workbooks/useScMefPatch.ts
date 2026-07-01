import { useCallback, useRef } from "react";
import { type SuccessCriteriaDevelopment } from "interfaces-mef-types/sc/success-criteria-development";
import { patchScWorkbook } from "./scWorkbookApi";

type Mutator = (draft: SuccessCriteriaDevelopment) => SuccessCriteriaDevelopment;

interface ScMefPatcher {
  patch: (mutator: Mutator) => Promise<void>;
  patchDebounced: (mutator: Mutator) => void;
}

function useScMefPatch(
  workbookId: string,
  current: SuccessCriteriaDevelopment | null,
  onSuccess: (next: SuccessCriteriaDevelopment) => void,
  onError: (message: string) => void,
): ScMefPatcher {
  const debounceTimer = useRef<number | null>(null);
  const pendingDraft = useRef<SuccessCriteriaDevelopment | null>(null);

  const patch = useCallback(async (mutator: Mutator): Promise<void> => {
    if (current === null) return;
    const draft = mutator(current);
    try {
      const updated = await patchScWorkbook(workbookId, draft);
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
      patchScWorkbook(workbookId, draft)
        .then((res) => onSuccess(res.mef))
        .catch((err: unknown) => onError((err as { message?: string }).message ?? "Save failed"));
    }, 500);
  }, [workbookId, current, onSuccess, onError]);

  return { patch, patchDebounced };
}

export { useScMefPatch, type ScMefPatcher, type Mutator };
