import { useCallback } from "react";
import { type EventSequenceQuantification } from "interfaces-mef-types/esq/event-sequence-quantification";
import { patchEsqWorkbook } from "./esqWorkbookApi";

type Mutator = (draft: EventSequenceQuantification) => EventSequenceQuantification;

interface EsqMefPatcher {
  patch: (mutator: Mutator) => Promise<void>;
  patchDebounced: (mutator: Mutator) => void;
}

function useEsqMefPatch(
  workbookId: string,
  current: EventSequenceQuantification | null,
  onSuccess: (next: EventSequenceQuantification) => void,
  onError: (message: string) => void,
): EsqMefPatcher {
  const patch = useCallback(async (mutator: Mutator): Promise<void> => {
    if (current === null) return;
    const draft = mutator(current);
    try {
      const updated = await patchEsqWorkbook(workbookId, current, draft);
      onSuccess(updated.mef);
    } catch (err: unknown) {
      onError((err as { message?: string }).message ?? "Save failed");
    }
  }, [workbookId, current, onSuccess, onError]);

  const patchDebounced = useCallback((mutator: Mutator): void => { void patch(mutator); }, [patch]);

  return { patch, patchDebounced };
}

export { useEsqMefPatch, type EsqMefPatcher, type Mutator };
