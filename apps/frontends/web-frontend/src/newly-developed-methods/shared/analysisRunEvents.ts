export const ANALYSIS_RUN_CHANGED = "openpra:analysis-run-changed";
export interface AnalysisRunChanged {
  host: "sy" | "es" | "esq";
  workbookId: string;
  runIds: string[];
}
export function notifyAnalysisRun(path: string, body?: unknown): void {
  const match = /^\/api\/(sy|es|esq)-workbooks\/([^/]+)\/.*(?:runs)$/.exec(path);
  if (!match || typeof window === "undefined") return;
  const value = body as
    | { batchId?: string; run?: { id?: string }; runs?: Array<{ run?: { id?: string } }> }
    | undefined;
  const ids =
    value?.batchId ? [value.batchId]
    : value?.run?.id ? [value.run.id]
    : (value?.runs?.map((row) => row.run?.id) ?? []);
  window.dispatchEvent(
    new CustomEvent<AnalysisRunChanged>(ANALYSIS_RUN_CHANGED, {
      detail: {
        host: match[1] as AnalysisRunChanged["host"],
        workbookId: decodeURIComponent(match[2]!),
        runIds: ids.filter((id): id is string => typeof id === "string"),
      },
    }),
  );
}
