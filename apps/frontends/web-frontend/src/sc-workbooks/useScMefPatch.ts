import { useCallback } from "react";
import { type SuccessCriteriaDevelopment } from "interfaces-mef-types/sc/success-criteria-development";
import { patchScWorkbook } from "./scWorkbookApi";

type Mutator = (draft: SuccessCriteriaDevelopment) => SuccessCriteriaDevelopment;

interface ScMefPatcher {
  patch: (mutator: Mutator) => Promise<void>;
  patchDebounced: (mutator: Mutator) => void;
}

function useScMefPatch(
  workbookId: string,
  current: SuccessCriteriaDevelopment | null,
  onSuccess: (next: SuccessCriteriaDevelopment) => void,
  onError: (message: string) => void,
): ScMefPatcher {
  const patch = useCallback(async (mutator: Mutator): Promise<void> => {
    if (current === null) return;
    const draft = mutator(current);
    try {
      const updated = await patchScWorkbook(workbookId, current, draft);
      onSuccess(updated.mef);
    } catch (err: unknown) {
      onError((err as { message?: string }).message ?? "Save failed");
    }
  }, [workbookId, current, onSuccess, onError]);

  const patchDebounced = useCallback((mutator: Mutator): void => { void patch(mutator); }, [patch]);

  return { patch, patchDebounced };
}

export { useScMefPatch, type ScMefPatcher, type Mutator };
