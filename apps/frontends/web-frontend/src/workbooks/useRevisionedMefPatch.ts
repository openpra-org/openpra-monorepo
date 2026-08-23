import { useCallback, useEffect, useRef, useState } from "react";

interface RevisionedWorkbookResponse<TMef> {
  revision: number;
  mef: TMef;
}

type MefMutator<TMef> = (draft: TMef) => TMef;
type RevisionedSaveStatus = "saving" | "saved" | "failed";

interface SaveBatch {
  pending: number;
  failed: boolean;
}

interface RevisionedMefPatcher<TMef> {
  patch: (mutator: MefMutator<TMef>) => Promise<void>;
  saveStatus: RevisionedSaveStatus;
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
  const [saveStatus, setSaveStatus] = useState<RevisionedSaveStatus>("saved");
  const revisionRef = useRef(currentRevision);
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const generationRef = useRef(0);
  const workbookIdRef = useRef(workbookId);
  const batchRef = useRef<SaveBatch>({ pending: 0, failed: false });
  const authoritativeReloadRequiredRef = useRef(false);

  useEffect(() => {
    if (workbookIdRef.current !== workbookId) {
      workbookIdRef.current = workbookId;
      generationRef.current += 1;
      queueRef.current = Promise.resolve();
      batchRef.current = { pending: 0, failed: false };
      authoritativeReloadRequiredRef.current = false;
      setSaveStatus("saved");
    }
    revisionRef.current = currentRevision;
  }, [workbookId, currentRevision]);

  const patch = useCallback(
    (mutator: MefMutator<TMef>): Promise<void> => {
      if (current === null || currentRevision === null) return Promise.resolve();
      const before = current;
      const next = mutator(current);
      const generation = generationRef.current;
      let batch = batchRef.current;
      if (batch.pending === 0) {
        batch = { pending: 0, failed: false };
        batchRef.current = batch;
      }
      batch.pending += 1;
      if (!batch.failed) setSaveStatus("saving");

      const execute = async (): Promise<void> => {
        try {
          if (generation !== generationRef.current) return;
          const expectedRevision = revisionRef.current;
          if (expectedRevision === null) return;
          if (authoritativeReloadRequiredRef.current) {
            try {
              const latest = await getWorkbook(workbookId);
              if (generation !== generationRef.current || workbookIdRef.current !== workbookId) return;
              revisionRef.current = latest.revision;
              authoritativeReloadRequiredRef.current = false;
              generationRef.current += 1;
              batch.failed = true;
              if (batchRef.current === batch) setSaveStatus("failed");
              onResync(latest);
              onError("Workbook reloaded after a save failure. Reapply your changes.");
              return;
            } catch (error: unknown) {
              if (generation !== generationRef.current) return;
              batch.failed = true;
              authoritativeReloadRequiredRef.current = true;
              generationRef.current += 1;
              if (batchRef.current === batch) setSaveStatus("failed");
              onError((error as { message?: string }).message ?? "Save failed");
              return;
            }
          }
          try {
            const updated = await patchWorkbook(workbookId, expectedRevision, before, next);
            if (generation !== generationRef.current) return;
            revisionRef.current = updated.revision;
            authoritativeReloadRequiredRef.current = false;
            onSuccess(updated.revision);
          } catch (error: unknown) {
            if (generation !== generationRef.current) return;
            batch.failed = true;
            if (batchRef.current === batch) setSaveStatus("failed");
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
              authoritativeReloadRequiredRef.current = false;
              onResync(latest);
            } catch {
              authoritativeReloadRequiredRef.current = true;
              // Keep the original save error visible when the resync request also fails.
            } finally {
              if (generationRef.current === recoveryGeneration) {
                // Drop edits made against optimistic state while the authoritative reload was in flight.
                generationRef.current += 1;
              }
            }
          }
        } finally {
          batch.pending = Math.max(0, batch.pending - 1);
          if (batchRef.current === batch) {
            if (batch.failed) setSaveStatus("failed");
            else if (batch.pending === 0) setSaveStatus("saved");
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

  return { patch, saveStatus };
}

export {
  useRevisionedMefPatch,
  type MefMutator,
  type RevisionedMefPatcher,
  type RevisionedSaveStatus,
  type RevisionedWorkbookResponse,
};
