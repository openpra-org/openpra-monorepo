import { useCallback } from "react";
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
  const patch = useCallback(async (mutator: Mutator): Promise<void> => {
    if (current === null) return;
    const draft = mutator(current);
    try {
      const updated = await patchRcWorkbook(workbookId, current, draft);
      onSuccess(updated.mef);
    } catch (err: unknown) {
      onError((err as { message?: string }).message ?? "Save failed");
    }
  }, [workbookId, current, onSuccess, onError]);

  const patchDebounced = useCallback((mutator: Mutator): void => { void patch(mutator); }, [patch]);

  return { patch, patchDebounced };
}

export { useRcMefPatch, type RcMefPatcher, type Mutator };
