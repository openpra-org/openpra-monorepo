import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import type { RevisionedSaveStatus } from "../../workbooks/useRevisionedMefPatch";

function analysisSaveBlock(runtime: {
  workbookId: string | null;
  revision: number | null;
  saveStatus: RevisionedSaveStatus;
}): string | null {
  if (runtime.workbookId === null || runtime.revision === null) return "Save the workbook before running.";
  if (runtime.saveStatus === "saving") return "Saving changes. Run after saving finishes.";
  if (runtime.saveStatus !== "saved") return "Save failed. Reload or save successfully before running.";
  return null;
}

/** Discard displayed and in-flight results when their inputs change. */
function useAnalysisScope(inputKey: string, clearResults: () => void) {
  const scope = useRef({ inputKey, version: 0, mounted: true });
  const clear = useRef(clearResults);
  clear.current = clearResults;
  if (scope.current.inputKey !== inputKey) {
    scope.current.inputKey = inputKey;
    scope.current.version += 1;
  }
  useLayoutEffect(() => { clear.current(); }, [inputKey]);
  useEffect(() => {
    scope.current.mounted = true;
    return () => {
      scope.current.mounted = false;
      scope.current.version += 1;
    };
  }, []);
  const invalidate = useCallback(() => {
    scope.current.version += 1;
    clear.current();
  }, []);
  const capture = useCallback(() => {
    const version = scope.current.version;
    return () => scope.current.mounted && scope.current.version === version;
  }, []);
  return { invalidate, capture };
}

export { analysisSaveBlock, useAnalysisScope };
