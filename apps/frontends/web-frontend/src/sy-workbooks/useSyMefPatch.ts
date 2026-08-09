import { useCallback } from "react";
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
  const patch = useCallback(async (mutator: Mutator): Promise<void> => {
    if (current === null) return;
    const draft = mutator(current);
    try {
      const updated = await patchSyWorkbook(workbookId, current, draft);
      onSuccess(updated.mef);
    } catch (err: unknown) {
      onError((err as { message?: string }).message ?? "Save failed");
    }
  }, [workbookId, current, onSuccess, onError]);

  const patchDebounced = useCallback((mutator: Mutator): void => { void patch(mutator); }, [patch]);

  return { patch, patchDebounced };
}

export { useSyMefPatch, type SyMefPatcher, type Mutator };
