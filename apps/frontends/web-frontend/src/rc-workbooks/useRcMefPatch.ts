import { useCallback, useRef } from "react";
import { createWorkbookPatch } from "interfaces-shared-types/workbooks";
import { type RadiologicalConsequenceAnalysis } from "interfaces-mef-types/rc/radiological-consequence-analysis";
import { patchRcWorkbook } from "./rcWorkbookApi";

type Mutator = (draft: RadiologicalConsequenceAnalysis) => RadiologicalConsequenceAnalysis;

interface RcMefPatcher {
  patch: (mutator: Mutator) => Promise<void>;
  patchDebounced: (mutator: Mutator) => void;
  enqueue: <T>(task: () => Promise<T>) => Promise<T>;
}

function useRcMefPatch(
  workbookId: string,
  current: RadiologicalConsequenceAnalysis | null,
  onSuccess: (next: RadiologicalConsequenceAnalysis) => void,
  onError: (message: string) => void,
): RcMefPatcher {
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const failed = useRef(false);
  const latest = useRef(current);
  latest.current = current;
  const enqueue = useCallback(<T,>(task: () => Promise<T>): Promise<T> => {
    const next = queue.current.then(() => {
      if (failed.current) throw new Error("A workbook save failed. Reload before changing source data");
      return task();
    });
    queue.current = next.catch(() => undefined);
    return next;
  }, []);
  const patch = useCallback(async (mutator: Mutator): Promise<void> => {
    const before = latest.current;
    if (before === null) return;
    const draft = mutator(before);
    latest.current = draft;
    if (!createWorkbookPatch(before, draft).length) return;
    try {
      const updated = await enqueue(() => patchRcWorkbook(workbookId, before, draft));
      onSuccess(updated.mef);
    } catch (err: unknown) {
      failed.current = true;
      onError((err as { message?: string }).message ?? "Save failed");
    }
  }, [workbookId, enqueue, onSuccess, onError]);

  const patchDebounced = useCallback((mutator: Mutator): void => { void patch(mutator); }, [patch]);

  return { patch, patchDebounced, enqueue };
}

export { useRcMefPatch, type RcMefPatcher, type Mutator };
