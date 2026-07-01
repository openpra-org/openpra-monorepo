import { useCallback, useRef } from "react";
import { type MechanisticSourceTermAnalysis } from "interfaces-mef-types/ms/mechanistic-source-term-analysis";
import { patchMsWorkbook } from "./msWorkbookApi";

type Mutator = (draft: MechanisticSourceTermAnalysis) => MechanisticSourceTermAnalysis;

interface MsMefPatcher {
  patch: (mutator: Mutator) => Promise<void>;
  patchDebounced: (mutator: Mutator) => void;
}

function useMsMefPatch(
  workbookId: string,
  current: MechanisticSourceTermAnalysis | null,
  onSuccess: (next: MechanisticSourceTermAnalysis) => void,
  onError: (message: string) => void,
): MsMefPatcher {
  const debounceTimer = useRef<number | null>(null);
  const pendingDraft = useRef<MechanisticSourceTermAnalysis | null>(null);

  const patch = useCallback(async (mutator: Mutator): Promise<void> => {
    if (current === null) return;
    const draft = mutator(current);
    try {
      const updated = await patchMsWorkbook(workbookId, draft);
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
      patchMsWorkbook(workbookId, draft)
        .then((res) => onSuccess(res.mef))
        .catch((err: unknown) => onError((err as { message?: string }).message ?? "Save failed"));
    }, 500);
  }, [workbookId, current, onSuccess, onError]);

  return { patch, patchDebounced };
}

export { useMsMefPatch, type MsMefPatcher, type Mutator };
