import { useCallback } from "react";
import { type EventSequenceAnalysis } from "interfaces-mef-types/es/event-sequence-analysis";
import { patchEsWorkbook } from "./esWorkbookApi";

type Mutator = (draft: EventSequenceAnalysis) => EventSequenceAnalysis;

interface EsMefPatcher {
  patch: (mutator: Mutator) => Promise<void>;
  patchDebounced: (mutator: Mutator) => void;
}

function useEsMefPatch(
  workbookId: string,
  current: EventSequenceAnalysis | null,
  onSuccess: (next: EventSequenceAnalysis) => void,
  onError: (message: string) => void,
): EsMefPatcher {
  const patch = useCallback(async (mutator: Mutator): Promise<void> => {
    if (current === null) return;
    const draft = mutator(current);
    try {
      const updated = await patchEsWorkbook(workbookId, current, draft);
      onSuccess(updated.mef);
    } catch (err: unknown) {
      onError((err as { message?: string }).message ?? "Save failed");
    }
  }, [workbookId, current, onSuccess, onError]);

  const patchDebounced = useCallback((mutator: Mutator): void => { void patch(mutator); }, [patch]);

  return { patch, patchDebounced };
}

export { useEsMefPatch, type EsMefPatcher, type Mutator };
