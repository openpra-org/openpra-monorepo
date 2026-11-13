import { useCallback, useEffect, useRef, useState, type JSX } from "react";
import { z } from "zod";
import type { RcCategoryResult } from "interfaces-mef-types/rc/case-records";
import type {
  RcConsequenceRun,
  RcConsequenceRunDistance,
  RcConsequenceRunFileKind,
  RcConsequenceRunStatus,
  RcConsequenceRunTrialOrder,
} from "interfaces-mef-types/rc/consequence-runs";
import { rcResultNumber, rcResultStatisticsText } from "interfaces-shared-types/rc-workbooks/family-consequences";
import { rcMetricDurationText, rcMetricThresholdText, rcOrdinal } from "interfaces-shared-types/rc-workbooks/metrics";
import { useEditorConfirmation } from "../newly-developed-methods/shared/editorConfirmationDialog";
import { COUNT_VIEW, OPTIONAL_TEXT_VIEW, jsonView, useWorkbookView } from "../workbooks/workbookViewMemory";
import { useRcWorkbook, type RcConsequenceRunActions } from "./rcWorkbookContext";
import "./css/rcConsequenceRuns.css";

interface RcRunFeed {
  runs: RcConsequenceRun[];
  error: string;
  refresh: () => void;
}

interface RunData<T> {
  data?: T;
  error?: string;
  loading: boolean;
}

const ACTIVE_POLL_MS = 2_000;
const IDLE_POLL_MS = 15_000;
const PAGE = 10;
const DISTANCE_LIMIT = 100;
const POINT = "—";

const STATUS_TEXT: Record<RcConsequenceRunStatus, string> = {
  QUEUED: "Queued",
  RUNNING: "Running",
  SUCCEEDED: "Finished",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
};

const ComposerSchema = z.object({
  snapshotId: z.string(),
  metricId: z.string(),
  source: z.enum(["linked", "typed"]),
  typedDistance: z.string(),
  typedDistances: z.string(),
  heightSource: z.enum(["linked", "typed"]),
  typedHeight: z.string(),
});

type Composer = z.infer<typeof ComposerSchema>;

const COMPOSER_VIEW = jsonView<Composer>(ComposerSchema);
const ORDER_VIEW = jsonView<RcConsequenceRunTrialOrder>(z.enum(["trial", "dose"]));
const NEW_COMPOSER: Composer = { snapshotId: "", metricId: "", source: "linked", typedDistance: "", typedDistances: "", heightSource: "linked", typedHeight: "" };

function messageOf(failure: Error | string | null | undefined, fallback: string): string {
  if (failure instanceof Error) return failure.message;
  return typeof failure === "string" && failure !== "" ? failure : fallback;
}

function runActive(run: RcConsequenceRun): boolean {
  return run.status === "QUEUED" || run.status === "RUNNING";
}

function plural(count: number, one: string, many: string): string {
  return `${String(count)} ${count === 1 ? one : many}`;
}

function metresNumber(value: number): string {
  return String(Number(value.toPrecision(8)));
}

function metresText(value: number): string {
  return `${metresNumber(value)} m`;
}

function pageStart(offset: number, total: number): number {
  return Math.min(offset, Math.max(0, Math.floor((total - 1) / PAGE) * PAGE));
}

function doseText(value: number, unit: string): string {
  return `${rcResultNumber(value)} ${unit}`;
}

function receptorText(run: RcConsequenceRun): string {
  return run.distancesMetres.length === 1 ? metresText(run.distancesMetres[0]) : plural(run.distancesMetres.length, "distance", "distances");
}

function timeText(value: string): string {
  return new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
}

function elapsedText(run: RcConsequenceRun, now: number): string {
  const seconds = Math.max(0, Math.round((now - Date.parse(run.startedAt ?? run.requestedAt)) / 1000));
  if (seconds < 60) return `${String(seconds)} s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${String(minutes)} min`;
  return `${String(Math.floor(minutes / 60))} h ${String(minutes % 60)} min`;
}

function runProgressText(run: RcConsequenceRun): string {
  if (!runActive(run)) return "";
  const progress = run.progress;
  const workers = progress?.workers ?? null;
  if (workers === 0) return "Waiting. No PRAETOR worker is connected, so nothing can run until one starts.";
  const crew = workers === null ? "" : ` · ${plural(workers, "worker", "workers")}`;
  if (progress === null || run.status === "QUEUED") {
    const queued = progress?.queuedJobs ?? null;
    return `Waiting for a PRAETOR worker${queued === null || queued === 0 ? "" : ` · ${plural(queued, "job", "jobs")} in the queue`}${crew}`;
  }
  return `Running · ${String(progress.completed)} of ${plural(progress.total, "job", "jobs")} done${crew}`;
}

function engineText(version: string | null): string {
  if (version === null) return "OpenRC";
  const builds = version.split(", ").map((build) => (build.startsWith("sha256:") ? build.slice(7) : build).slice(0, 12));
  return `OpenRC ${builds.join(", ")}`;
}

function typedDistances(text: string): number[] | null {
  const values = text
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part !== "")
    .map(Number);
  if (values.length === 0 || values.length > DISTANCE_LIMIT) return null;
  if (values.some((value) => !Number.isFinite(value) || value <= 0) || new Set(values).size !== values.length) return null;
  return values;
}

function percentileText(run: RcConsequenceRun, percentile: number, value: number): string {
  return run.trialCount === 1 && percentile !== 50 ? POINT : doseText(value, run.unit);
}

function useRunData<T>(scope: string, key: string, load: () => Promise<T>): RunData<T> {
  const loader = useRef(load);
  loader.current = load;
  const [state, setState] = useState<{ scope: string; key: string; data?: T; error?: string }>({ scope: "", key: "" });
  useEffect(() => {
    let disposed = false;
    if (key === "") return undefined;
    loader
      .current()
      .then((data) => {
        if (!disposed) setState({ scope, key, data });
      })
      .catch((failure: Error) => {
        if (!disposed) setState({ scope, key, error: messageOf(failure, "The run could not be read.") });
      });
    return () => {
      disposed = true;
    };
  }, [scope, key]);
  if (key === "" || state.scope !== scope) return { loading: key !== "" };
  return { data: state.data, error: state.key === key ? state.error : undefined, loading: state.key !== key };
}

function useRcConsequenceRuns(actions: RcConsequenceRunActions | undefined): RcRunFeed {
  const [runs, setRuns] = useState<RcConsequenceRun[]>([]);
  const [error, setError] = useState("");
  const reload = useRef<() => void>(() => undefined);

  useEffect(() => {
    setRuns([]);
    setError("");
    if (actions === undefined) return undefined;
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
      let next: RcConsequenceRun[] | null = null;
      let failure = "";
      try {
        next = await actions.list();
      } catch (caught) {
        failure = caught instanceof Error ? caught.message : "The OpenRC runs could not be loaded.";
      }
      busy = false;
      if (disposed) return;
      setError(failure);
      if (next !== null) setRuns(next);
      if (again) {
        again = false;
        void load();
        return;
      }
      timer = window.setTimeout(() => {
        void load();
      }, next !== null && next.some(runActive) ? ACTIVE_POLL_MS : IDLE_POLL_MS);
    };
    reload.current = () => {
      void load();
    };
    void load();
    return () => {
      disposed = true;
      window.clearTimeout(timer);
      reload.current = () => undefined;
    };
  }, [actions]);

  const refresh = useCallback(() => reload.current(), []);
  return { runs, error, refresh };
}

function RcRunJobs({ feed }: { feed: RcRunFeed }): JSX.Element | null {
  const { consequenceRuns: actions, editable } = useRcWorkbook();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [stopping, setStopping] = useState<ReadonlySet<string>>(new Set());
  const root = useRef<HTMLDivElement>(null);
  const { requestConfirmation, confirmationDialog } = useEditorConfirmation();
  const jobs = feed.runs.filter(runActive);

  useEffect(() => {
    setNow(Date.now());
  }, [feed.runs]);

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

  if (actions === undefined) return null;
  const runner = actions;

  async function stop(run: RcConsequenceRun): Promise<void> {
    setStopping((current) => new Set([...current, run.id]));
    try {
      await runner.cancel(run.id);
      setError("");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "The run could not be cancelled.");
    } finally {
      setStopping((current) => new Set([...current].filter((id) => id !== run.id)));
      feed.refresh();
    }
  }

  function confirmStop(run: RcConsequenceRun): void {
    requestConfirmation(
      { title: "Stop this run?", message: `${run.label} of ${run.metricName} stops on its PRAETOR worker.`, confirmLabel: "Stop run", tone: "danger" },
      () => {
        void stop(run);
      },
    );
  }

  const running = jobs.filter((run) => run.status === "RUNNING").length;
  const queued = jobs.length - running;
  const summary =
    jobs.length === 0
      ? "No jobs running"
      : [running > 0 ? `${String(running)} running` : "", queued > 0 ? `${String(queued)} queued` : ""].filter((part) => part !== "").join(" · ");

  return (
    <div ref={root} className="rc-run-jobs">
      <button
        type="button"
        className={`rc-run-jobs__button${jobs.length > 0 ? " is-active" : ""}`}
        aria-expanded={open && jobs.length > 0}
        aria-haspopup="dialog"
        disabled={jobs.length === 0}
        onClick={() => {
          setOpen((value) => !value);
          feed.refresh();
        }}
      >
        <span className="rc-run-jobs__dot" aria-hidden="true" />
        <span>{summary}</span>
      </button>
      {open && jobs.length > 0 && (
        <div className="rc-run-jobs__panel" role="dialog" aria-label="Running jobs">
          <ul className="rc-run-jobs__list">
            {jobs.map((run) => (
              <li key={run.id} className="rc-run-jobs__job">
                <div className="rc-run-jobs__job-text">
                  <strong title={`${run.label} · ${run.categoryId} · ${run.metricName}`}>{`${run.label} · ${run.categoryId} · ${run.metricName}`}</strong>
                  <span>{`${runProgressText(run)} · ${elapsedText(run, now)}`}</span>
                </div>
                {editable && (
                  <button
                    type="button"
                    className="posnav__btn posnav__btn--sm"
                    aria-label={`Cancel ${run.label}`}
                    disabled={stopping.has(run.id)}
                    onClick={() => confirmStop(run)}
                  >
                    {stopping.has(run.id) ? "Cancelling…" : "Cancel"}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {error !== "" && (
        <p className="rc-run-jobs__error" role="alert">
          {error}
        </p>
      )}
      {confirmationDialog}
    </div>
  );
}

function RunPager({ label, total, offset, size, onChange }: { label: string; total: number; offset: number; size: number; onChange: (offset: number) => void }): JSX.Element | null {
  if (total <= size) return null;
  const pages = Math.ceil(total / size);
  const page = Math.floor(offset / size);
  const last = (pages - 1) * size;
  return (
    <nav className="rc-runs__pager" aria-label={`${label} pagination`}>
      <span aria-live="polite">{`${String(offset + 1)} to ${String(Math.min(offset + size, total))} of ${String(total)}`}</span>
      <button type="button" className="posnav__btn posnav__btn--sm" disabled={page === 0} onClick={() => onChange(0)}>
        First
      </button>
      <button type="button" className="posnav__btn posnav__btn--sm" disabled={page === 0} onClick={() => onChange(offset - size)}>
        Previous
      </button>
      <span>{`Page ${String(page + 1)} of ${String(pages)}`}</span>
      <button type="button" className="posnav__btn posnav__btn--sm" disabled={page >= pages - 1} onClick={() => onChange(offset + size)}>
        Next
      </button>
      <button type="button" className="posnav__btn posnav__btn--sm" disabled={page >= pages - 1} onClick={() => onChange(last)}>
        Last
      </button>
    </nav>
  );
}

function RunFile({ run, kind, actions }: { run: RcConsequenceRun; kind: RcConsequenceRunFileKind; actions: RcConsequenceRunActions }): JSX.Element {
  const [offset, setOffset] = useState(0);
  const page = useRunData(`${run.id}/${kind}`, `${run.id}/${kind}/${String(offset)}`, () => actions.readFile(run.id, kind, offset));
  return (
    <div className="rc-runs__file">
      {page.error !== undefined && (
        <p className="q-error" role="alert">
          {page.error}
        </p>
      )}
      {page.data !== undefined && (
        <>
          <pre className="q-file-content" aria-label={kind === "input" ? "Engine input" : "Engine output"}>
            {page.data.text}
          </pre>
          <RunPager label={kind === "input" ? "Engine input" : "Engine output"} total={page.data.total} offset={page.data.offset} size={page.data.size} onChange={setOffset} />
        </>
      )}
    </div>
  );
}

function RunTrials({ run, distanceIndex, actions }: { run: RcConsequenceRun; distanceIndex: number; actions: RcConsequenceRunActions }): JSX.Element {
  const [order, setOrder] = useWorkbookView<RcConsequenceRunTrialOrder>("rc.runs.order", "trial", ORDER_VIEW);
  const [offset, setOffset] = useWorkbookView<number>(`rc.runs.trials.${run.id}.${String(distanceIndex)}.${order}`, 0, COUNT_VIEW, false);
  const page = useRunData(`${run.id}/${String(distanceIndex)}`, `${run.id}/${String(distanceIndex)}/${order}/${String(offset)}`, () =>
    actions.readTrials(run.id, distanceIndex, offset, order),
  );
  return (
    <div className="rc-runs__block">
      <div className="rc-runs__bar">
        <h4>Dose by weather trial</h4>
        {run.trialCount > 1 && (
          <label className="rc-runs__inline">
            Order
            <select className="posfield__select" aria-label="Trial order" value={order} onChange={(event) => setOrder(event.target.value === "dose" ? "dose" : "trial")}>
              <option value="trial">Weather trial</option>
              <option value="dose">Highest dose first</option>
            </select>
          </label>
        )}
      </div>
      {page.error !== undefined && (
        <p className="q-error" role="alert">
          {page.error}
        </p>
      )}
      {page.data !== undefined && (
        <>
          <table className="rc-runs__table rc-runs__trials" aria-label="Dose by weather trial">
            <thead>
              <tr>
                <th scope="col">Trial</th>
                <th scope="col">Stability</th>
                <th scope="col">Wind (m/s)</th>
                <th scope="col">Toward (°)</th>
                <th scope="col">Mixing height (m)</th>
                <th scope="col">Dose ({run.unit})</th>
                <th scope="col">χ/Q (s/m³)</th>
              </tr>
            </thead>
            <tbody>
              {page.data.rows.map((row) => (
                <tr key={row.trialId}>
                  <td>{row.trialId}</td>
                  <td>{row.stabilityClass}</td>
                  <td>{rcResultNumber(row.windSpeedMetresPerSecond)}</td>
                  <td>{rcResultNumber(row.windTowardDegrees)}</td>
                  <td>{rcResultNumber(row.mixingHeightMetres)}</td>
                  <td>{rcResultNumber(row.doseSv)}</td>
                  <td>{row.dispersionSecondsPerCubicMetre === null ? POINT : rcResultNumber(row.dispersionSecondsPerCubicMetre)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <RunPager label="Weather trials" total={page.data.total} offset={page.data.offset} size={page.data.size} onChange={setOffset} />
        </>
      )}
    </div>
  );
}

function RunNuclides({ run, row }: { run: RcConsequenceRun; row: RcConsequenceRunDistance }): JSX.Element | null {
  const [offset, setOffset] = useWorkbookView<number>(`rc.runs.nuclides.${run.id}.${String(row.distanceMetres)}`, 0, COUNT_VIEW, false);
  const doses = row.nuclideDoses;
  if (doses === undefined || doses.length === 0) return null;
  const total = doses.reduce((sum, entry) => sum + entry.doseSv, 0);
  const start = pageStart(offset, doses.length);
  return (
    <div className="rc-runs__block">
      <div className="rc-runs__bar">
        <h4>Dose by nuclide</h4>
      </div>
      <table className="rc-runs__table" aria-label="Dose by nuclide">
        <thead>
          <tr>
            <th scope="col">Nuclide</th>
            <th scope="col">Dose ({run.unit})</th>
            <th scope="col">Share (%)</th>
          </tr>
        </thead>
        <tbody>
          {doses.slice(start, start + PAGE).map((entry) => (
            <tr key={entry.nuclide}>
              <td>{entry.nuclide}</td>
              <td>{rcResultNumber(entry.doseSv)}</td>
              <td>{total > 0 ? rcResultNumber((100 * entry.doseSv) / total) : POINT}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <RunPager label="Nuclides" total={doses.length} offset={start} size={PAGE} onChange={setOffset} />
    </div>
  );
}

function RunProfile({ run, distances }: { run: RcConsequenceRun; distances: RcConsequenceRunDistance[] }): JSX.Element {
  const [offset, setOffset] = useWorkbookView<number>(`rc.runs.profile.${run.id}`, 0, COUNT_VIEW, false);
  const wanted = run.statistics;
  const start = pageStart(offset, distances.length);
  return (
    <div className="rc-runs__block">
      <div className="rc-runs__bar">
        <h4>Dose by distance</h4>
      </div>
      <table className="rc-runs__table" aria-label="Dose by distance">
        <thead>
          <tr>
            <th scope="col">Distance</th>
            {wanted.mean && <th scope="col">Mean ({run.unit})</th>}
            {wanted.percentiles.map((percentile) => (
              <th scope="col" key={percentile}>{`${rcOrdinal(percentile)} percentile (${run.unit})`}</th>
            ))}
            {wanted.exceedanceThresholds.map((threshold) => (
              <th scope="col" key={threshold}>{`Chance of exceeding ${rcResultNumber(threshold)} ${run.unit}`}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {distances.slice(start, start + PAGE).map((entry) => (
            <tr key={entry.distanceMetres}>
              <td>{metresText(entry.distanceMetres)}</td>
              {wanted.mean && <td>{entry.statistics.mean === undefined ? POINT : rcResultNumber(entry.statistics.mean)}</td>}
              {entry.statistics.percentiles.map((value) => (
                <td key={value.percentile}>{run.trialCount === 1 && value.percentile !== 50 ? POINT : rcResultNumber(value.value)}</td>
              ))}
              {entry.statistics.exceedances.map((value) => (
                <td key={value.threshold}>{rcResultNumber(value.probability)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <RunPager label="Dose by distance" total={distances.length} offset={start} size={PAGE} onChange={setOffset} />
    </div>
  );
}

function RcResultProfile({ result }: { result: RcCategoryResult }): JSX.Element | null {
  const [offset, setOffset] = useWorkbookView<number>(`rc.results.profile.${result.id}`, 0, COUNT_VIEW, false);
  const profile = result.profile;
  if (profile === undefined || profile.length === 0) return null;
  const point = result.calculation?.trialCount === 1;
  const start = pageStart(offset, profile.length);
  return (
    <>
      <div className="q-table-wrap">
        <table aria-label={`Dose by distance of ${result.reference}`}>
          <thead>
            <tr>
              <th>Distance (m)</th>
              <th>Statistics</th>
            </tr>
          </thead>
          <tbody>
            {profile.slice(start, start + PAGE).map((row) => (
              <tr key={row.distanceMetres}>
                <td>{metresNumber(row.distanceMetres)}</td>
                <td>{rcResultStatisticsText(row.statistics, result.unit, point)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <RunPager label={`Dose by distance of ${result.reference}`} total={profile.length} offset={start} size={PAGE} onChange={setOffset} />
    </>
  );
}

function RunResult({ run, actions, distanceIndex, onDistance }: { run: RcConsequenceRun; actions: RcConsequenceRunActions; distanceIndex: number; onDistance: (index: number) => void }): JSX.Element {
  const details = useRunData(run.id, `${run.id}/${run.status}`, () => actions.read(run.id));
  const result = details.data?.result ?? null;
  if (details.error !== undefined) {
    return (
      <p className="q-error" role="alert">
        {details.error}
      </p>
    );
  }
  if (result === null) return <></>;
  const row = result.distances[Math.min(distanceIndex, result.distances.length - 1)];
  const profile = run.receptorKind === "DISTANCE_PROFILE";
  const missing = result.missingDoseCoefficients ?? [];
  return (
    <>
      {profile && <RunProfile run={run} distances={result.distances} />}
      <div className="rc-runs__block">
        <div className="rc-runs__bar">
          <h4>{profile ? "Dose at one distance" : "Dose at the receptor"}</h4>
          {profile && (
            <label className="rc-runs__inline">
              Receptor distance
              <select className="posfield__select" aria-label="Receptor distance of the run" value={String(Math.min(distanceIndex, result.distances.length - 1))} onChange={(event) => onDistance(Number(event.target.value))}>
                {result.distances.map((entry, index) => (
                  <option key={entry.distanceMetres} value={String(index)}>
                    {metresText(entry.distanceMetres)}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <dl className="rc-runs__values" aria-label="Run statistics">
          <div>
            <dt>Receptor distance</dt>
            <dd>{metresText(row.distanceMetres)}</dd>
          </div>
          <div>
            <dt>Receptor height</dt>
            <dd>{metresText(run.heightMetres)}</dd>
          </div>
          <div>
            <dt>Exposure window</dt>
            <dd>{rcMetricDurationText(run.windowSeconds)}</dd>
          </div>
          <div>
            <dt>Weather trials</dt>
            <dd>{run.trialCount}</dd>
          </div>
          {row.statistics.mean !== undefined && (
            <div>
              <dt>Mean</dt>
              <dd>{doseText(row.statistics.mean, run.unit)}</dd>
            </div>
          )}
          {row.statistics.percentiles.map((value) => (
            <div key={value.percentile}>
              <dt>{`${rcOrdinal(value.percentile)} percentile`}</dt>
              <dd>{percentileText(run, value.percentile, value.value)}</dd>
            </div>
          ))}
          {row.statistics.exceedances.map((value) => (
            <div key={value.threshold}>
              <dt>{`Chance of exceeding ${rcMetricThresholdText({ quantity: "INDIVIDUAL_DOSE" }, value.threshold)}`}</dt>
              <dd>{rcResultNumber(value.probability)}</dd>
            </div>
          ))}
          {run.trialCount > 1 && (
            <div>
              <dt>Lowest and highest dose</dt>
              <dd>{`${rcResultNumber(row.minimumSv)} to ${doseText(row.maximumSv, run.unit)}`}</dd>
            </div>
          )}
          {row.groundDepositionBqPerSquareMetre !== undefined && (
            <div>
              <dt>Ground deposition</dt>
              <dd>{`${rcResultNumber(row.groundDepositionBqPerSquareMetre)} Bq/m²`}</dd>
            </div>
          )}
          {missing.length > 0 && (
            <div>
              <dt>No dose coefficients for</dt>
              <dd>{missing.join(", ")}</dd>
            </div>
          )}
        </dl>
      </div>
      <RunTrials run={run} distanceIndex={Math.min(distanceIndex, result.distances.length - 1)} actions={actions} />
      <RunNuclides run={run} row={row} />
    </>
  );
}

function RcConsequenceRunsTab({ categoryId, feed }: { categoryId: string; feed: RcRunFeed }): JSX.Element {
  const { rc, editable, consequenceRuns: actions } = useRcWorkbook();
  const records = rc.consequenceQuantification.caseRecords;
  const snapshots = (records?.snapshots ?? []).filter((snapshot) => snapshot.categoryId === categoryId);
  const [composer, setComposer] = useWorkbookView<Composer>(`rc.runs.composer.${categoryId}`, NEW_COMPOSER, COMPOSER_VIEW);
  const [picked, setPicked] = useWorkbookView<string | null>(`rc.runs.picked.${categoryId}`, null, OPTIONAL_TEXT_VIEW);
  const [listOffset, setListOffset] = useWorkbookView<number>(`rc.runs.list.${categoryId}`, 0, COUNT_VIEW, false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [file, setFile] = useState<RcConsequenceRunFileKind | "">("");

  const snapshotId = snapshots.some((snapshot) => snapshot.id === composer.snapshotId) ? composer.snapshotId : (snapshots[snapshots.length - 1]?.id ?? "");
  const setup = useRunData("setup", actions === undefined ? "" : snapshotId, async () => {
    if (actions === undefined) throw new Error("OpenRC runs are not available here.");
    return actions.setup(snapshotId);
  });
  const metrics = setup.data?.snapshotId === snapshotId ? setup.data.metrics : [];
  const metric = metrics.find((entry) => entry.id === composer.metricId && entry.runnable) ?? metrics.find((entry) => entry.runnable);
  const boundary = rc.releaseCategoryToConsequence.siteInformation.isBounding
    ? rc.releaseCategoryToConsequence.siteInformation.boundingSite.characteristics.siteBoundaryDistance
    : undefined;
  const siteDistances = setup.data?.snapshotId === snapshotId ? setup.data.distancesMetres : [];
  const single = metric?.receptorKind !== "DISTANCE_PROFILE";
  const linked = single
    ? boundary !== undefined && Number.isFinite(boundary) && boundary > 0
      ? [boundary]
      : []
    : siteDistances.length <= DISTANCE_LIMIT
      ? siteDistances
      : [];
  const source = linked.length > 0 ? composer.source : "typed";
  const typedText = single ? composer.typedDistance : composer.typedDistances;
  const typed = typedDistances(typedText);
  const distances = source === "linked" ? linked : typed !== null && (!single || typed.length === 1) ? typed : [];
  const siteHeight = setup.data?.snapshotId === snapshotId ? setup.data.heightMetres : null;
  const heightSource = siteHeight === null ? "typed" : composer.heightSource;
  const heightText = composer.typedHeight;
  const height = heightSource === "linked" && siteHeight !== null ? siteHeight : heightText.trim() === "" ? Number.NaN : Number(heightText);
  const heightValid = Number.isFinite(height) && height >= 0;
  const distanceFlag = source === "typed" && typedText.trim() !== "" && distances.length === 0 ? (single && typed !== null ? "One distance only" : "Positive numbers only") : "";
  const canRun = editable && actions !== undefined && !busy && metric !== undefined && distances.length > 0 && heightValid;

  const rows = feed.runs.filter((run) => run.categoryId === categoryId);
  const run = rows.find((entry) => entry.id === picked) ?? rows[0];
  const [distanceIndex, setDistanceIndex] = useWorkbookView<number>(`rc.runs.distance.${run?.id ?? "none"}`, 0, COUNT_VIEW);
  const shownIndex = run === undefined ? 0 : Math.min(distanceIndex, run.distancesMetres.length - 1);
  const listStart = pageStart(listOffset, rows.length);
  const recorded = run !== undefined && (records?.results ?? []).some((result) => result.calculation?.runId === run.id);
  const snapshotKept = run !== undefined && (records?.snapshots ?? []).some((snapshot) => snapshot.id === run.snapshotId);

  useEffect(() => {
    setFile("");
    setError("");
    setNotice("");
  }, [run?.id]);

  function change(patch: Partial<Composer>): void {
    setComposer((current) => ({ ...current, ...patch }));
    setError("");
    setNotice("");
  }

  async function work(task: () => Promise<void>): Promise<void> {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await task();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "The request did not finish.");
    } finally {
      setBusy(false);
      feed.refresh();
    }
  }

  function start(): void {
    if (actions === undefined || metric === undefined || !canRun) return;
    void work(async () => {
      const started = await actions.start({ snapshotId, metricId: metric.id, distancesMetres: distances, heightMetres: height });
      setPicked(started.id);
      setListOffset(0);
    });
  }

  return (
    <div className="rc-runs">
      <form
        className="rc-runs__composer"
        aria-label="OpenRC run"
        onSubmit={(event) => {
          event.preventDefault();
          start();
        }}
      >
        <label>
          Input snapshot
          <select className="posfield__select" aria-label="Run input snapshot" value={snapshotId} disabled={busy || snapshots.length === 0} onChange={(event) => change({ snapshotId: event.target.value })}>
            {snapshots.length === 0 && <option value="">No input snapshot</option>}
            {snapshots.map((snapshot) => (
              <option key={snapshot.id} value={snapshot.id}>
                {`${snapshot.label} · ${plural(snapshot.metrics?.length ?? 0, "metric", "metrics")} · ${plural(snapshot.reviewItems, "review item", "review items")}`}
              </option>
            ))}
          </select>
        </label>
        <label>
          Consequence metric
          <select className="posfield__select" aria-label="Run consequence metric" value={metric?.id ?? ""} disabled={busy || metrics.length === 0} onChange={(event) => change({ metricId: event.target.value })}>
            {metric === undefined && <option value="">{setup.loading || snapshotId === "" ? "" : "No metric OpenRC can run"}</option>}
            {metrics.map((entry) => (
              <option key={entry.id} value={entry.id} disabled={!entry.runnable}>
                {entry.runnable ? entry.name : `${entry.name} (not in OpenRC)`}
              </option>
            ))}
          </select>
        </label>
        <label>
          {single ? "Receptor distance" : "Receptor distances"}
          <select className="posfield__select" aria-label="Receptor distance source" value={source} disabled={busy || metric === undefined} onChange={(event) => change({ source: event.target.value === "linked" ? "linked" : "typed" })}>
            {linked.length > 0 && <option value="linked">{single ? `Site boundary distance, ${metresText(linked[0])}` : `Step 02 evaluation distances, ${plural(linked.length, "distance", "distances")}`}</option>}
            <option value="typed">{single ? "Typed distance" : "Typed distances"}</option>
          </select>
        </label>
        {source === "typed" && (
          <label>
            {single ? "Distance (m)" : "Distances (m), separated by commas"}
            <input
              className="posfield__input"
              aria-label={single ? "Typed receptor distance" : "Typed receptor distances"}
              aria-invalid={distanceFlag !== ""}
              value={typedText}
              disabled={busy || metric === undefined}
              onChange={(event) => change(single ? { typedDistance: event.target.value } : { typedDistances: event.target.value })}
            />
            {distanceFlag !== "" && <span className="rc-runs__flag">{distanceFlag}</span>}
          </label>
        )}
        <label>
          Receptor height
          <select className="posfield__select" aria-label="Receptor height source" value={heightSource} disabled={busy || metric === undefined} onChange={(event) => change({ heightSource: event.target.value === "linked" ? "linked" : "typed" })}>
            {siteHeight !== null && <option value="linked">{`Step 02 receptor height, ${metresText(siteHeight)}`}</option>}
            <option value="typed">Typed height</option>
          </select>
        </label>
        {heightSource === "typed" && (
          <label>
            Height (m)
            <input
              className="posfield__input"
              aria-label="Typed receptor height"
              aria-invalid={heightText.trim() !== "" && !heightValid}
              value={heightText}
              disabled={busy || metric === undefined}
              onChange={(event) => change({ typedHeight: event.target.value })}
            />
            {heightText.trim() !== "" && !heightValid && <span className="rc-runs__flag">Zero or more</span>}
          </label>
        )}
        {editable && (
          <button type="submit" className="posnav__btn posnav__btn--sm posnav__btn--primary" disabled={!canRun}>
            {busy ? "Starting…" : "Run OpenRC"}
          </button>
        )}
      </form>
      {setup.error !== undefined && (
        <p className="q-error" role="alert">
          {setup.error}
        </p>
      )}
      {feed.error !== "" && (
        <p className="q-error" role="alert">
          {feed.error}
        </p>
      )}
      {rows.length > 0 && (
        <>
          <table className="rc-runs__table rc-runs__list" aria-label="OpenRC runs">
            <thead>
              <tr>
                <th scope="col">Run</th>
                <th scope="col">Metric</th>
                <th scope="col">Receptor</th>
                <th scope="col">Trials</th>
                <th scope="col">Started</th>
                <th scope="col">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(listStart, listStart + PAGE).map((entry) => (
                <tr key={entry.id} className={entry.id === run?.id ? "is-picked" : undefined} onClick={() => setPicked(entry.id)}>
                  <td>
                    <button type="button" className="rc-runs__pick" aria-pressed={entry.id === run?.id} onClick={() => setPicked(entry.id)}>
                      {entry.label}
                    </button>
                  </td>
                  <td>{entry.metricName}</td>
                  <td>{receptorText(entry)}</td>
                  <td>{entry.trialCount}</td>
                  <td>{timeText(entry.requestedAt)}</td>
                  <td>
                    {(records?.results ?? []).some((result) => result.calculation?.runId === entry.id) ? `${STATUS_TEXT[entry.status]}, recorded` : STATUS_TEXT[entry.status]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <RunPager label="OpenRC runs" total={rows.length} offset={listStart} size={PAGE} onChange={setListOffset} />
        </>
      )}
      {run !== undefined && actions !== undefined && (
        <section className="rc-runs__run" aria-label={`${run.label} of ${run.metricName}`}>
          <div className="rc-runs__head">
            <h3>{`${run.label} · ${run.metricName}`}</h3>
            <div className="q-actions">
              {editable && run.status === "SUCCEEDED" && (
                <button
                  type="button"
                  className="posnav__btn posnav__btn--sm posnav__btn--primary"
                  disabled={busy || recorded || !snapshotKept}
                  onClick={() =>
                    void work(async () => {
                      await actions.record(records?.revision ?? 0, run.id, shownIndex);
                      setNotice(`${run.label} is recorded as the category result.`);
                    })
                  }
                >
                  {recorded
                    ? "Recorded as category result"
                    : run.receptorKind === "DISTANCE_PROFILE"
                      ? `Record as category result at ${metresText(run.distancesMetres[shownIndex])}`
                      : "Record as category result"}
                </button>
              )}
              {editable && runActive(run) && (
                <button type="button" className="posnav__btn posnav__btn--sm" disabled={busy} onClick={() => void work(async () => { await actions.cancel(run.id); })}>
                  Cancel run
                </button>
              )}
              {editable && !runActive(run) && (
                <button type="button" className="posnav__btn posnav__btn--sm" disabled={busy} onClick={() => void work(async () => { await actions.remove(run.id); setPicked(null); })}>
                  Remove run
                </button>
              )}
            </div>
          </div>
          <p className="rc-runs__meta">
            {[
              `${run.snapshotLabel} · ${run.categoryId}`,
              `${receptorText(run)} at ${metresText(run.heightMetres)} height`,
              plural(run.jobCount, "job", "jobs"),
              `started by ${run.requestedBy}, ${timeText(run.requestedAt)}`,
              ...(run.completedAt === null ? [] : [`ended ${timeText(run.completedAt)}`]),
              ...(run.status === "SUCCEEDED" ? [engineText(run.engineVersion)] : []),
            ].join(" · ")}
          </p>
          {runActive(run) && (
            <p className="rc-runs__status" role="status">
              {runProgressText(run)}
            </p>
          )}
          {run.failure !== null && (
            <p className="q-error" role="alert">
              {run.failure.message}
            </p>
          )}
          {run.status === "SUCCEEDED" && <RunResult run={run} actions={actions} distanceIndex={shownIndex} onDistance={setDistanceIndex} />}
          {run.notes.length > 0 && (
            <div className="rc-runs__block">
              <div className="rc-runs__bar">
                <h4>How OpenRC treats this case</h4>
              </div>
              <ul className="rc-runs__notes">
                {run.notes.map((note) => (
                  <li key={note.code}>{note.message}.</li>
                ))}
              </ul>
            </div>
          )}
          <div className="q-actions rc-runs__files">
            <button type="button" className="posnav__btn posnav__btn--sm" aria-expanded={file === "input"} onClick={() => setFile(file === "input" ? "" : "input")}>
              {file === "input" ? "Hide engine input" : "View engine input"}
            </button>
            {run.status === "SUCCEEDED" && (
              <button type="button" className="posnav__btn posnav__btn--sm" aria-expanded={file === "output"} onClick={() => setFile(file === "output" ? "" : "output")}>
                {file === "output" ? "Hide engine output" : "View engine output"}
              </button>
            )}
          </div>
          {file !== "" && <RunFile key={`${run.id}/${file}`} run={run} kind={file} actions={actions} />}
        </section>
      )}
      {error !== "" && (
        <p className="q-error" role="alert">
          {error}
        </p>
      )}
      {notice !== "" && (
        <p className="q-note" role="status">
          {notice}
        </p>
      )}
    </div>
  );
}

export { RcConsequenceRunsTab, RcResultProfile, RcRunJobs, useRcConsequenceRuns };
export type { RcRunFeed };
