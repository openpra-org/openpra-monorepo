import { useCallback } from "react";
import { type RiskIntegration } from "interfaces-mef-types/ri/risk-integration";
import { patchRiWorkbook } from "./riWorkbookApi";

type Mutator = (draft: RiskIntegration) => RiskIntegration;

interface RiMefPatcher {
  patch: (mutator: Mutator) => Promise<void>;
  patchDebounced: (mutator: Mutator) => void;
}

function useRiMefPatch(
  workbookId: string,
  current: RiskIntegration | null,
  onSuccess: (next: RiskIntegration) => void,
  onError: (message: string) => void,
): RiMefPatcher {
  const patch = useCallback(async (mutator: Mutator): Promise<void> => {
    if (current === null) return;
    const draft = mutator(current);
    try {
      const updated = await patchRiWorkbook(workbookId, current, draft);
      onSuccess(updated.mef);
    } catch (err: unknown) {
      onError((err as { message?: string }).message ?? "Save failed");
    }
  }, [workbookId, current, onSuccess, onError]);

  const patchDebounced = useCallback((mutator: Mutator): void => { void patch(mutator); }, [patch]);

  return { patch, patchDebounced };
}

export { useRiMefPatch, type RiMefPatcher, type Mutator };
