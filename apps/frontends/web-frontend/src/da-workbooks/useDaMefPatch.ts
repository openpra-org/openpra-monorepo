import { useCallback } from "react";
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
  const patch = useCallback(async (mutator: Mutator): Promise<void> => {
    if (current === null) return;
    const draft = mutator(current);
    try {
      const updated = await patchDaWorkbook(workbookId, current, draft);
      onSuccess(updated.mef);
    } catch (err: unknown) {
      onError((err as { message?: string }).message ?? "Save failed");
    }
  }, [workbookId, current, onSuccess, onError]);

  const patchDebounced = useCallback((mutator: Mutator): void => { void patch(mutator); }, [patch]);

  return { patch, patchDebounced };
}

export { useDaMefPatch, type DaMefPatcher, type Mutator };
