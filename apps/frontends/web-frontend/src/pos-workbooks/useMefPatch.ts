import { useCallback, useRef } from "react";
import { type PlantOperatingStatesAnalysis } from "interfaces-mef-types/pos/plant-operating-state-analysis";
import { patchPosWorkbook } from "./posWorkbookApi";

type Mutator = (draft: PlantOperatingStatesAnalysis) => PlantOperatingStatesAnalysis;

interface MefPatcher {
  patch: (mutator: Mutator) => Promise<void>;
  patchDebounced: (mutator: Mutator) => void;
}

function useMefPatch(
  workbookId: string,
  current: PlantOperatingStatesAnalysis | null,
  onSuccess: (next: PlantOperatingStatesAnalysis) => void,
  onError: (message: string) => void,
): MefPatcher {
  const debounceTimer = useRef<number | null>(null);
  const pendingDraft = useRef<PlantOperatingStatesAnalysis | null>(null);

  const patch = useCallback(async (mutator: Mutator): Promise<void> => {
    if (current === null) return;
    const draft = mutator(current);
    try {
      const updated = await patchPosWorkbook(workbookId, draft);
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
      patchPosWorkbook(workbookId, draft)
        .then((res) => onSuccess(res.mef))
        .catch((err: unknown) => onError((err as { message?: string }).message ?? "Save failed"));
    }, 500);
  }, [workbookId, current, onSuccess, onError]);

  return { patch, patchDebounced };
}

export { useMefPatch, type MefPatcher, type Mutator };
