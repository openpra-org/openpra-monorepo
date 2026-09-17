import { useEffect, useState } from "react";
import { AnalysisRunMetadataSchema } from "interfaces-shared-types/newly-developed-methods/shared";
import { fetchJson } from "../../api/client";
import { ANALYSIS_RUN_CHANGED, type AnalysisRunChanged } from "./analysisRunEvents";

/** Verify all sources of displayed runs after execution, on focus and while visible. */
export function useAnalysisSourceGuard(host: AnalysisRunChanged["host"], workbookId: string | null) {
  const [sourceEpoch, setEpoch] = useState(0);
  const [sourceWarning, setWarning] = useState<string | null>(null);
  useEffect(() => {
    setWarning(null);
    if (workbookId === null) return;
    const ids = new Set<string>();
    let disposed = false;
    let generation = 0;
    const invalidate = (message: string, current: number) => {
      if (disposed || generation !== current) return;
      ids.clear();
      generation++;
      setWarning(message);
      setEpoch((value) => value + 1);
    };
    const check = async () => {
      if (ids.size === 0 || document.visibilityState === "hidden") return;
      const current = ++generation;
      try {
        const rows = await Promise.all(
          [...ids].map((id) =>
            fetchJson<unknown>(`/api/${host}-workbooks/${encodeURIComponent(workbookId)}/analysis-runs/${id}`).then(
              (value) => AnalysisRunMetadataSchema.parse(value),
            ),
          ),
        );
        if (rows.some((row) => row.freshness?.status !== "CURRENT"))
          invalidate("A source workbook changed or is missing. Run again after reviewing the sources.", current);
      } catch {
        invalidate(
          "Source access or revisions could not be verified. Previous results are no longer current.",
          current,
        );
      }
    };
    const changed = (event: Event) => {
      const value = (event as CustomEvent<AnalysisRunChanged>).detail;
      if (value.host !== host || value.workbookId !== workbookId) return;
      value.runIds.forEach((id) => ids.add(id));
      if (value.runIds.length > 0) setWarning(null);
      void check();
    };
    const focus = () => {
      void check();
    };
    window.addEventListener(ANALYSIS_RUN_CHANGED, changed);
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", focus);
    const timer = window.setInterval(focus, 30000);
    return () => {
      disposed = true;
      generation++;
      window.clearInterval(timer);
      window.removeEventListener(ANALYSIS_RUN_CHANGED, changed);
      window.removeEventListener("focus", focus);
      document.removeEventListener("visibilitychange", focus);
    };
  }, [host, workbookId]);
  return { sourceEpoch, sourceWarning };
}
