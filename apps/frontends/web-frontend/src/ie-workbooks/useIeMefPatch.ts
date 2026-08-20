import { useCallback } from "react";
import { type InitiatingEventsAnalysis } from "interfaces-mef-types/ie/initiating-event-analysis";
import { patchIeWorkbook } from "./ieWorkbookApi";

type Mutator = (draft: InitiatingEventsAnalysis) => InitiatingEventsAnalysis;

interface IeMefPatcher {
  patch: (mutator: Mutator) => Promise<void>;
  patchDebounced: (mutator: Mutator) => void;
}

function useIeMefPatch(
  workbookId: string,
  current: InitiatingEventsAnalysis | null,
  onSuccess: (next: InitiatingEventsAnalysis) => void,
  onError: (message: string) => void,
): IeMefPatcher {
  const patch = useCallback(async (mutator: Mutator): Promise<void> => {
    if (current === null) return;
    const draft = mutator(current);
    try {
      const updated = await patchIeWorkbook(workbookId, current, draft);
      onSuccess(updated.mef);
    } catch (err: unknown) {
      onError((err as { message?: string }).message ?? "Save failed");
    }
  }, [workbookId, current, onSuccess, onError]);

  const patchDebounced = useCallback((mutator: Mutator): void => { void patch(mutator); }, [patch]);

  return { patch, patchDebounced };
}

export { useIeMefPatch, type IeMefPatcher, type Mutator };
