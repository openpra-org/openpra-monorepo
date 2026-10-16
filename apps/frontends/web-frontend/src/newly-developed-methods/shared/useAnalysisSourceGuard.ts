import { useEffect, useRef, useState } from "react";
import { AnalysisRunMetadataSchema, type AnalysisRunMetadata } from "interfaces-shared-types/newly-developed-methods/shared";
import { fetchJson } from "../../api/client";
import { ANALYSIS_RUN_CHANGED, type AnalysisRunChanged } from "./analysisRunEvents";

const CHECK_FAILED = "The sources of these results could not be checked.";
const STALE_FALLBACK = "A source of these results changed.";
const NO_RUNS: readonly string[] = [];

/** Verify all sources of displayed runs after execution, on focus and while visible. */
export function useAnalysisSourceGuard(
  host: AnalysisRunChanged["host"],
  workbookId: string | null,
  revision: number | null = null,
  shownRuns: readonly string[] = NO_RUNS,
) {
  const [sourceEpoch, setEpoch] = useState(0);
  const [sourceWarning, setWarning] = useState<string | null>(null);
  const [sourceChanges, setChanges] = useState<ReadonlyMap<string, string>>(() => new Map());
  const recheck = useRef<() => void>(() => undefined);
  const track = useRef<(runIds: readonly string[]) => void>(() => undefined);
  useEffect(() => {
    setWarning(null);
    setChanges(new Map());
    if (workbookId === null) return;
    const ids = new Set<string>();
    const reported = new Set<string>();
    let disposed = false;
    let generation = 0;
    const check = async () => {
      if (ids.size === 0 || document.visibilityState === "hidden") return;
      const current = ++generation;
      try {
        const rows = await Promise.all(
          [...ids].map((id) =>
            fetchJson<AnalysisRunMetadata>(`/api/${host}-workbooks/${encodeURIComponent(workbookId)}/analysis-runs/${id}`).then(
              (value) => AnalysisRunMetadataSchema.parse(value),
            ),
          ),
        );
        if (disposed || generation !== current) return;
        const stale = rows.flatMap((row) =>
          row.freshness?.status === "STALE" ? [[row.id, row.freshness.change ?? STALE_FALLBACK] as const] : [],
        );
        const [first] = stale;
        if (first === undefined) return;
        stale.forEach(([id]) => {
          ids.delete(id);
          reported.add(id);
        });
        generation++;
        setChanges((previous) => new Map([...previous, ...stale]));
        setWarning(first[1]);
        setEpoch((value) => value + 1);
      } catch {
        if (disposed || generation !== current) return;
        ids.clear();
        generation++;
        setWarning(CHECK_FAILED);
        setEpoch((value) => value + 1);
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
    recheck.current = focus;
    track.current = (runIds) => {
      const fresh = runIds.filter((id) => !ids.has(id) && !reported.has(id));
      if (fresh.length === 0) return;
      fresh.forEach((id) => ids.add(id));
      void check();
    };
    window.addEventListener(ANALYSIS_RUN_CHANGED, changed);
    window.addEventListener("focus", focus);
    document.addEventListener("visibilitychange", focus);
    const timer = window.setInterval(focus, 30000);
    return () => {
      disposed = true;
      generation++;
      recheck.current = () => undefined;
      track.current = () => undefined;
      window.clearInterval(timer);
      window.removeEventListener(ANALYSIS_RUN_CHANGED, changed);
      window.removeEventListener("focus", focus);
      document.removeEventListener("visibilitychange", focus);
    };
  }, [host, workbookId]);
  const shownKey = shownRuns.join(" ");
  useEffect(() => {
    track.current(shownKey.length === 0 ? NO_RUNS : shownKey.split(" "));
  }, [host, shownKey, workbookId]);
  useEffect(() => {
    recheck.current();
  }, [revision]);
  return { sourceEpoch, sourceWarning, sourceChanges };
}
