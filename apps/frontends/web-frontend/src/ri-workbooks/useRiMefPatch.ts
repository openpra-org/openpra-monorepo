import { useCallback, useRef } from "react";
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
  const debounceTimer = useRef<number | null>(null);
  const pendingDraft = useRef<RiskIntegration | null>(null);

  const patch = useCallback(async (mutator: Mutator): Promise<void> => {
    if (current === null) return;
    const draft = mutator(current);
    try {
      const updated = await patchRiWorkbook(workbookId, draft);
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
      patchRiWorkbook(workbookId, draft)
        .then((res) => onSuccess(res.mef))
        .catch((err: unknown) => onError((err as { message?: string }).message ?? "Save failed"));
    }, 500);
  }, [workbookId, current, onSuccess, onError]);

  return { patch, patchDebounced };
}

export { useRiMefPatch, type RiMefPatcher, type Mutator };
