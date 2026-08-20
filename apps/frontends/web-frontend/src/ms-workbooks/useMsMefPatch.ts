import { useCallback } from "react";
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
  const patch = useCallback(async (mutator: Mutator): Promise<void> => {
    if (current === null) return;
    const draft = mutator(current);
    try {
      const updated = await patchMsWorkbook(workbookId, current, draft);
      onSuccess(updated.mef);
    } catch (err: unknown) {
      onError((err as { message?: string }).message ?? "Save failed");
    }
  }, [workbookId, current, onSuccess, onError]);

  const patchDebounced = useCallback((mutator: Mutator): void => { void patch(mutator); }, [patch]);

  return { patch, patchDebounced };
}

export { useMsMefPatch, type MsMefPatcher, type Mutator };
