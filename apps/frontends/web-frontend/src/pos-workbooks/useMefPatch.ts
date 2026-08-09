import { useCallback } from "react";
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
  const patch = useCallback(async (mutator: Mutator): Promise<void> => {
    if (current === null) return;
    const draft = mutator(current);
    try {
      const updated = await patchPosWorkbook(workbookId, current, draft);
      onSuccess(updated.mef);
    } catch (err: unknown) {
      onError((err as { message?: string }).message ?? "Save failed");
    }
  }, [workbookId, current, onSuccess, onError]);

  const patchDebounced = useCallback((mutator: Mutator): void => { void patch(mutator); }, [patch]);

  return { patch, patchDebounced };
}

export { useMefPatch, type MefPatcher, type Mutator };
