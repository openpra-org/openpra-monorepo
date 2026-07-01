import { useCallback, useRef } from "react";
import { type DataAnalysis } from "interfaces-mef-types/da/data-analysis";
import { patchDaWorkbook } from "./daWorkbookApi";

type Mutator = (draft: DataAnalysis) => DataAnalysis;

interface DaMefPatcher {
  patch: (mutator: Mutator) => Promise<void>;
  patchDebounced: (mutator: Mutator) => void;
}

function useDaMefPatch(
  workbookId: string,
  current: DataAnalysis | null,
  onSuccess: (next: DataAnalysis) => void,
  onError: (message: string) => void,
): DaMefPatcher {
  const debounceTimer = useRef<number | null>(null);
  const pendingDraft = useRef<DataAnalysis | null>(null);

  const patch = useCallback(async (mutator: Mutator): Promise<void> => {
    if (current === null) return;
    const draft = mutator(current);
    try {
      const updated = await patchDaWorkbook(workbookId, draft);
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
      patchDaWorkbook(workbookId, draft)
        .then((res) => onSuccess(res.mef))
        .catch((err: unknown) => onError((err as { message?: string }).message ?? "Save failed"));
    }, 500);
  }, [workbookId, current, onSuccess, onError]);

  return { patch, patchDebounced };
}

export { useDaMefPatch, type DaMefPatcher, type Mutator };
