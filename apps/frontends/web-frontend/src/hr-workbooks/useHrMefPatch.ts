import { useCallback } from "react";
import { type HumanReliabilityAnalysis } from "interfaces-mef-types/hr/human-reliability-analysis";
import { patchHrWorkbook } from "./hrWorkbookApi";

type Mutator = (draft: HumanReliabilityAnalysis) => HumanReliabilityAnalysis;

interface HrMefPatcher {
  patch: (mutator: Mutator) => Promise<void>;
  patchDebounced: (mutator: Mutator) => void;
}

function useHrMefPatch(
  workbookId: string,
  current: HumanReliabilityAnalysis | null,
  onSuccess: (next: HumanReliabilityAnalysis) => void,
  onError: (message: string) => void,
): HrMefPatcher {
  const patch = useCallback(async (mutator: Mutator): Promise<void> => {
    if (current === null) return;
    const draft = mutator(current);
    try {
      const updated = await patchHrWorkbook(workbookId, current, draft);
      onSuccess(updated.mef);
    } catch (err: unknown) {
      onError((err as { message?: string }).message ?? "Save failed");
    }
  }, [workbookId, current, onSuccess, onError]);

  const patchDebounced = useCallback((mutator: Mutator): void => { void patch(mutator); }, [patch]);

  return { patch, patchDebounced };
}

export { useHrMefPatch, type HrMefPatcher, type Mutator };
