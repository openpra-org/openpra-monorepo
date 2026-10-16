import { fetchJson, postJson } from "../../api/client";
import {
  AnalysisRunJobListSchema,
  AnalysisRunMetadataSchema,
  type AnalysisRunJobList,
  type AnalysisRunMetadata,
  type AnalysisRunProgress,
} from "interfaces-shared-types/newly-developed-methods";
import { HclSampleVectorsSchema, type HclSampleVector } from "interfaces-shared-types/newly-developed-methods/hybrid-causal-logic";

type AnalysisHost = "sy" | "es" | "esq";
type RunProgressListener = (run: AnalysisRunMetadata) => void;

const FIRST_PAUSE_MS = 400;
const LONGEST_PAUSE_MS = 3_000;

function pause(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function runActive(run: AnalysisRunMetadata): boolean {
  return run.status === "QUEUED" || run.status === "RUNNING";
}

function runPath(host: AnalysisHost, workbookId: string, runId: string): string {
  return `/api/${host}-workbooks/${encodeURIComponent(workbookId)}/analysis-runs/${encodeURIComponent(runId)}`;
}

async function getAnalysisRun(host: AnalysisHost, workbookId: string, runId: string): Promise<AnalysisRunMetadata> {
  return AnalysisRunMetadataSchema.parse(await fetchJson<AnalysisRunMetadata>(runPath(host, workbookId, runId)));
}

async function awaitAnalysisRun(
  host: AnalysisHost,
  workbookId: string,
  run: AnalysisRunMetadata,
  onProgress?: RunProgressListener,
): Promise<AnalysisRunMetadata> {
  let current = run;
  let wait = FIRST_PAUSE_MS;
  onProgress?.(current);
  while (runActive(current)) {
    await pause(wait);
    wait = Math.min(LONGEST_PAUSE_MS, Math.round(wait * 1.5));
    current = await getAnalysisRun(host, workbookId, current.id);
    onProgress?.(current);
  }
  return current;
}

async function finishedRun<T extends { run: AnalysisRunMetadata }>(
  host: AnalysisHost,
  workbookId: string,
  started: Promise<T>,
  onProgress?: RunProgressListener,
): Promise<T> {
  const response = await started;
  return { ...response, run: await awaitAnalysisRun(host, workbookId, response.run, onProgress) };
}

async function cancelAnalysisRun(host: AnalysisHost, workbookId: string, runId: string): Promise<AnalysisRunMetadata> {
  return AnalysisRunMetadataSchema.parse(await postJson<AnalysisRunMetadata>(`${runPath(host, workbookId, runId)}/cancel`, {}));
}

async function listAnalysisJobs(host: AnalysisHost, workbookId: string): Promise<AnalysisRunJobList> {
  return AnalysisRunJobListSchema.parse(await fetchJson<AnalysisRunJobList>(`/api/${host}-workbooks/${encodeURIComponent(workbookId)}/analysis-jobs`));
}

async function getAnalysisRunSamples(host: AnalysisHost, workbookId: string, runId: string): Promise<HclSampleVector[]> {
  return HclSampleVectorsSchema.parse(await fetchJson<HclSampleVector[]>(`${runPath(host, workbookId, runId)}/samples`));
}

function plural(count: number, one: string, many: string): string {
  return `${String(count)} ${count === 1 ? one : many}`;
}

function runProgressText(run: { status: string; progress?: AnalysisRunProgress }): string {
  if (run.status !== "QUEUED" && run.status !== "RUNNING") return "";
  const progress = run.progress;
  const workers = progress?.workers ?? null;
  if (workers === 0) return "Waiting. No PRAETOR worker is connected, so nothing can run until one starts.";
  const crew = workers === null ? "" : ` · ${plural(workers, "worker", "workers")}`;
  if (progress === undefined || run.status === "QUEUED" || progress.stage === "QUEUED") {
    const queued = progress?.queuedJobs ?? null;
    return `Waiting for a PRAETOR worker${queued === null || queued === 0 ? "" : ` · ${plural(queued, "job", "jobs")} in the queue`}${crew}`;
  }
  if (progress.unit === "EVENT_TREE") return `Running · ${String(progress.completed)} of ${plural(progress.total, "event tree", "event trees")} done${crew}`;
  return `Running in PRAXIS${crew}`;
}

export { awaitAnalysisRun, cancelAnalysisRun, finishedRun, getAnalysisRun, getAnalysisRunSamples, listAnalysisJobs, runActive, runProgressText };
export type { AnalysisHost, RunProgressListener };
