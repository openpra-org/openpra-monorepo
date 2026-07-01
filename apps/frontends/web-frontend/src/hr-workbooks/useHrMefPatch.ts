import { useCallback, useRef } from "react";
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
  const debounceTimer = useRef<number | null>(null);
  const pendingDraft = useRef<HumanReliabilityAnalysis | null>(null);

  const patch = useCallback(async (mutator: Mutator): Promise<void> => {
    if (current === null) return;
    const draft = mutator(current);
    try {
      const updated = await patchHrWorkbook(workbookId, draft);
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
      patchHrWorkbook(workbookId, draft)
        .then((res) => onSuccess(res.mef))
        .catch((err: unknown) => onError((err as { message?: string }).message ?? "Save failed"));
    }, 500);
  }, [workbookId, current, onSuccess, onError]);

  return { patch, patchDebounced };
}

export { useHrMefPatch, type HrMefPatcher, type Mutator };
