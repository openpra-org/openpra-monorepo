import { useCallback, useRef } from "react";
import { type RadiologicalConsequenceAnalysis } from "interfaces-mef-types/rc/radiological-consequence-analysis";
import { patchRcWorkbook } from "./rcWorkbookApi";

type Mutator = (draft: RadiologicalConsequenceAnalysis) => RadiologicalConsequenceAnalysis;

interface RcMefPatcher {
  patch: (mutator: Mutator) => Promise<void>;
  patchDebounced: (mutator: Mutator) => void;
}

function useRcMefPatch(
  workbookId: string,
  current: RadiologicalConsequenceAnalysis | null,
  onSuccess: (next: RadiologicalConsequenceAnalysis) => void,
  onError: (message: string) => void,
): RcMefPatcher {
  const debounceTimer = useRef<number | null>(null);
  const pendingDraft = useRef<RadiologicalConsequenceAnalysis | null>(null);

  const patch = useCallback(async (mutator: Mutator): Promise<void> => {
    if (current === null) return;
    const draft = mutator(current);
    try {
      const updated = await patchRcWorkbook(workbookId, draft);
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
      patchRcWorkbook(workbookId, draft)
        .then((res) => onSuccess(res.mef))
        .catch((err: unknown) => onError((err as { message?: string }).message ?? "Save failed"));
    }, 500);
  }, [workbookId, current, onSuccess, onError]);

  return { patch, patchDebounced };
}

export { useRcMefPatch, type RcMefPatcher, type Mutator };
