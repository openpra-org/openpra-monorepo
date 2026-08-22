import { useCallback, useEffect, useRef } from "react";

interface RevisionedWorkbookResponse<TMef> {
  revision: number;
  mef: TMef;
}

type MefMutator<TMef> = (draft: TMef) => TMef;

interface RevisionedMefPatcher<TMef> {
  patch: (mutator: MefMutator<TMef>) => Promise<void>;
  patchDebounced: (mutator: MefMutator<TMef>) => void;
}

function useRevisionedMefPatch<TMef, TResponse extends RevisionedWorkbookResponse<TMef>>(
  workbookId: string,
  current: TMef | null,
  currentRevision: number | null,
  patchWorkbook: (
    workbookId: string,
    expectedRevision: number,
    current: TMef,
    next: TMef,
  ) => Promise<TResponse>,
  getWorkbook: (workbookId: string) => Promise<TResponse>,
  onSuccess: (nextRevision: number) => void,
  onError: (message: string) => void,
  onResync: (latest: TResponse) => void,
): RevisionedMefPatcher<TMef> {
  const revisionRef = useRef(currentRevision);
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const generationRef = useRef(0);
  const workbookIdRef = useRef(workbookId);

  useEffect(() => {
    if (workbookIdRef.current !== workbookId) {
      workbookIdRef.current = workbookId;
      generationRef.current += 1;
      queueRef.current = Promise.resolve();
    }
    revisionRef.current = currentRevision;
  }, [workbookId, currentRevision]);

  const patch = useCallback(
    (mutator: MefMutator<TMef>): Promise<void> => {
      if (current === null || currentRevision === null) return Promise.resolve();
      const before = current;
      const next = mutator(current);
      const generation = generationRef.current;

      const execute = async (): Promise<void> => {
        if (generation !== generationRef.current) return;
        const expectedRevision = revisionRef.current;
        if (expectedRevision === null) return;
        try {
          const updated = await patchWorkbook(workbookId, expectedRevision, before, next);
          if (generation !== generationRef.current) return;
          revisionRef.current = updated.revision;
          onSuccess(updated.revision);
        } catch (error: unknown) {
          if (generation !== generationRef.current) return;
          const recoveryGeneration = generationRef.current + 1;
          generationRef.current = recoveryGeneration;
          onError((error as { message?: string }).message ?? "Save failed");
          try {
            const latest = await getWorkbook(workbookId);
            if (
              generationRef.current !== recoveryGeneration ||
              workbookIdRef.current !== workbookId
            ) {
              return;
            }
            revisionRef.current = latest.revision;
            onResync(latest);
          } catch {
            // Keep the original save error visible when the resync request also fails.
          } finally {
            if (generationRef.current === recoveryGeneration) {
              // Drop edits made against optimistic state while the authoritative reload was in flight.
              generationRef.current += 1;
            }
          }
        }
      };

      const queued = queueRef.current.then(execute);
      queueRef.current = queued.catch(() => undefined);
      return queued;
    },
    [
      workbookId,
      current,
      currentRevision,
      patchWorkbook,
      getWorkbook,
      onSuccess,
      onError,
      onResync,
    ],
  );

  const patchDebounced = useCallback(
    (mutator: MefMutator<TMef>): void => {
      void patch(mutator);
    },
    [patch],
  );

  return { patch, patchDebounced };
}

export {
  useRevisionedMefPatch,
  type MefMutator,
  type RevisionedMefPatcher,
  type RevisionedWorkbookResponse,
};
