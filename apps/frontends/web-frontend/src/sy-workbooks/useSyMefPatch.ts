import { useCallback, useRef } from "react";
import { type SystemsAnalysis } from "interfaces-mef-types/sy/systems-analysis";
import { patchSyWorkbook } from "./syWorkbookApi";

type Mutator = (draft: SystemsAnalysis) => SystemsAnalysis;

interface SyMefPatcher {
  patch: (mutator: Mutator) => Promise<void>;
  patchDebounced: (mutator: Mutator) => void;
}

function useSyMefPatch(
  workbookId: string,
  current: SystemsAnalysis | null,
  onSuccess: (next: SystemsAnalysis) => void,
  onError: (message: string) => void,
): SyMefPatcher {
  const debounceTimer = useRef<number | null>(null);
  const pendingDraft = useRef<SystemsAnalysis | null>(null);

  const patch = useCallback(async (mutator: Mutator): Promise<void> => {
    if (current === null) return;
    const draft = mutator(current);
    try {
      const updated = await patchSyWorkbook(workbookId, draft);
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
      patchSyWorkbook(workbookId, draft)
        .then((res) => onSuccess(res.mef))
        .catch((err: unknown) => onError((err as { message?: string }).message ?? "Save failed"));
    }, 500);
  }, [workbookId, current, onSuccess, onError]);

  return { patch, patchDebounced };
}

export { useSyMefPatch, type SyMefPatcher, type Mutator };
