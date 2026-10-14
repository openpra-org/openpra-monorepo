import { useEffect, useRef, useState, type JSX } from "react";
import type { AnalysisRunJob, AnalysisRunMetadata, MethodType } from "interfaces-shared-types/newly-developed-methods";
import { ANALYSIS_RUN_CHANGED, type AnalysisRunChanged } from "./analysisRunEvents";
import { cancelAnalysisRun, listAnalysisJobs, runProgressText, type AnalysisHost } from "./analysisRunWait";
import { useEditorConfirmation } from "./editorConfirmationDialog";
import "./css/analysisJobs.css";

interface AnalysisJobsProps {
  host: AnalysisHost;
  workbookId: string | null;
  modelLabel?: (modelId: string) => string | undefined;
}

const ACTIVE_POLL_MS = 2_000;
const IDLE_POLL_MS = 15_000;

const METHOD_TEXT: Readonly<Record<MethodType, string>> = {
  FAULT_TREE: "Fault tree",
  BAYESIAN_NETWORK: "Bayesian network",
  EVENT_TREE: "Event tree",
  HYBRID_CAUSAL_LOGIC: "HCL",
  LOAD_CAPACITY: "Load capacity",
};

const CALCULATION_TEXT: ReadonlyMap<string, string> = new Map([
  ["PROBABILITY", "Probability"],
  ["CUT_SETS", "Cut sets"],
  ["PROBABILITY_AND_CUT_SETS", "Probability + cut sets"],
  ["IMPORTANCE", "Importance"],
  ["UNCERTAINTY", "Uncertainty"],
  ["SIL", "SIL"],
]);

function calculationText(value: string | null): string | undefined {
  if (value === null) return undefined;
  const known = CALCULATION_TEXT.get(value);
  if (known !== undefined) return known;
  const spaced = value.split("_").join(" ").toLowerCase();
  return `${spaced.charAt(0).toUpperCase()}${spaced.slice(1)}`;
}

function elapsedText(run: AnalysisRunMetadata, now: number): string {
  const seconds = Math.max(0, Math.round((now - Date.parse(run.startedAt ?? run.requestedAt)) / 1000));
  if (seconds < 60) return `${String(seconds)} s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${String(minutes)} min`;
  return `${String(Math.floor(minutes / 60))} h ${String(minutes % 60)} min`;
}

function AnalysisJobs({ host, workbookId, modelLabel }: AnalysisJobsProps): JSX.Element | null {
  const [jobs, setJobs] = useState<AnalysisRunJob[]>([]);
  const [checkedAt, setCheckedAt] = useState(() => Date.now());
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stopping, setStopping] = useState<ReadonlySet<string>>(new Set());
  const refresh = useRef<() => void>(() => undefined);
  const root = useRef<HTMLDivElement>(null);
  const { requestConfirmation, confirmationDialog } = useEditorConfirmation();

  useEffect(() => {
    setJobs([]);
    setOpen(false);
    if (workbookId === null) return undefined;
    let disposed = false;
    let busy = false;
    let again = false;
    let timer: number | undefined;
    const load = async (): Promise<void> => {
      if (busy) {
        again = true;
        return;
      }
      busy = true;
      window.clearTimeout(timer);
      const list = await listAnalysisJobs(host, workbookId).catch(() => null);
      busy = false;
      if (disposed) return;
      if (list !== null) {
        setJobs(list.jobs);
        setCheckedAt(Date.now());
        if (list.jobs.length === 0) setOpen(false);
      }
      if (again) {
        again = false;
        void load();
        return;
      }
      timer = window.setTimeout(() => { void load(); }, list !== null && list.jobs.length > 0 ? ACTIVE_POLL_MS : IDLE_POLL_MS);
    };
    const changed = (event: Event): void => {
      const value = (event as CustomEvent<AnalysisRunChanged>).detail;
      if (value.host === host && value.workbookId === workbookId) void load();
    };
    refresh.current = () => { void load(); };
    window.addEventListener(ANALYSIS_RUN_CHANGED, changed);
    void load();
    return () => {
      disposed = true;
      window.clearTimeout(timer);
      window.removeEventListener(ANALYSIS_RUN_CHANGED, changed);
      refresh.current = () => undefined;
    };
  }, [host, workbookId]);

  useEffect(() => {
    if (!open) return undefined;
    const outside = (event: PointerEvent): void => {
      if (event.target instanceof Node && root.current !== null && !root.current.contains(event.target)) setOpen(false);
    };
    const escape = (event: KeyboardEvent): void => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", outside);
    window.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("pointerdown", outside);
      window.removeEventListener("keydown", escape);
    };
  }, [open]);

  if (workbookId === null) return null;
  const scopeId = workbookId;

  function labelOf(job: AnalysisRunJob): string {
    const calculation = calculationText(job.calculationType);
    const subject = modelLabel?.(job.run.owner.modelId) ?? METHOD_TEXT[job.run.methodType];
    return calculation === undefined ? subject : `${subject} · ${calculation}`;
  }

  async function stop(job: AnalysisRunJob): Promise<void> {
    setStopping((current) => new Set([...current, job.run.id]));
    try {
      await cancelAnalysisRun(host, scopeId, job.run.id);
      setError(null);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "The job could not be cancelled.");
    } finally {
      setStopping((current) => new Set([...current].filter((id) => id !== job.run.id)));
      refresh.current();
    }
  }

  function confirmStop(job: AnalysisRunJob): void {
    requestConfirmation({
      title: "Stop this job?",
      message: `${labelOf(job)} stops on its PRAETOR worker.`,
      confirmLabel: "Stop job",
      tone: "danger",
    }, () => { void stop(job); });
  }

  const running = jobs.filter((job) => job.run.status === "RUNNING").length;
  const queued = jobs.length - running;
  const summary = jobs.length === 0
    ? "No jobs running"
    : [running > 0 ? `${String(running)} running` : "", queued > 0 ? `${String(queued)} queued` : ""].filter((part) => part !== "").join(" · ");

  return (
    <div ref={root} className="analysis-jobs">
      <button
        type="button"
        className={`analysis-jobs__button${jobs.length > 0 ? " is-active" : ""}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        disabled={jobs.length === 0}
        onClick={() => {
          setOpen((value) => !value);
          refresh.current();
        }}
      >
        <span className="analysis-jobs__dot" aria-hidden="true" />
        <span>{summary}</span>
      </button>
      {open && jobs.length > 0 && (
        <div className="analysis-jobs__panel" role="dialog" aria-label="Running jobs">
          <ul className="analysis-jobs__list">
            {jobs.map((job) => (
              <li key={job.run.id} className="analysis-jobs__job">
                <div className="analysis-jobs__job-text">
                  <strong title={labelOf(job)}>{labelOf(job)}</strong>
                  <span>{`${runProgressText(job.run)} · ${elapsedText(job.run, checkedAt)}`}</span>
                </div>
                <button
                  type="button"
                  className="posnav__btn posnav__btn--sm"
                  aria-label={`Cancel ${labelOf(job)}`}
                  disabled={stopping.has(job.run.id)}
                  onClick={() => confirmStop(job)}
                >
                  {stopping.has(job.run.id) ? "Cancelling…" : "Cancel"}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {error !== null && <p className="analysis-jobs__error" role="alert">{error}</p>}
      {confirmationDialog}
    </div>
  );
}

export { AnalysisJobs };
