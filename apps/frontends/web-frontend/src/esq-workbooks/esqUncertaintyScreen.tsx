import { Fragment, JSX, useCallback, useEffect, useId, useMemo, useState } from "react";
import { z } from "zod";
import type { EsqModel, EventSequenceQuantification } from "interfaces-mef-types/esq/event-sequence-quantification";
import { esqUncertaintyRunId, uncertaintyInputsKey, type EsqLawSource, type EsqSampledInput } from "interfaces-mef-types/esq/esq-measure-inputs";
import { esqTreeRunId, treesInScope } from "interfaces-mef-types/esq/esq-run-inputs";
import { solveInputsChange } from "interfaces-mef-types/esq/esq-solve-inputs";
import type { UncertainParameter } from "interfaces-mef-types/core/uncertainty";
import type {
  EsqUncertaintyCorrelation,
  EsqUncertaintyGroup,
  EsqUncertaintyRunResult,
  EsqUncertaintySequence,
  EsqUncertaintySeries,
  EventTreeSamplingMethod,
} from "interfaces-shared-types/newly-developed-methods/event-tree";
import type { UncertaintySampling } from "interfaces-shared-types/newly-developed-methods/shared";
import { analysisSaveBlock } from "../newly-developed-methods/shared/useAnalysisScope";
import { AnalysisJobs } from "../newly-developed-methods/shared/analysisJobs";
import { cancelAnalysisRun } from "../newly-developed-methods/shared/analysisRunWait";
import { PagedResults } from "../newly-developed-methods/shared/resultPresentation";
import { parametersFor, useExpressionSummaries, useLawSummaries } from "../newly-developed-methods/shared/useUncertainty";
import { expressionText, unitText } from "../newly-developed-methods/shared/uncertainText";
import { TEXT_VIEW, jsonView, useWorkbookView } from "../workbooks/workbookViewMemory";
import { DialogHead, DialogShell } from "../es-workbooks/EsScope";
import { PAGE, Pager, TabBar, paged } from "../es-workbooks/EsTiming";
import { useEsqWorkbook } from "./esqWorkbookContext";
import {
  ChecksPanel,
  DetailRow,
  FieldList,
  FormFoot,
  FormRow,
  ModalHead,
  pointText,
  rowClass,
  sciText,
  treeLabel,
  useElementWidth,
  useExpressionPoints,
  useRunner,
  type EsqPointEntry,
  type EsqWindowContext,
  type FailedTree,
} from "./esqShared";
import { missionTimeSourcesOf, parameterLabelOf, parameterTableOf } from "./esqModel";
import { runLogicOf } from "./esqResults";
import { END_STATE_LABELS } from "./esqViewData";
import {
  DEFAULT_METHOD,
  DEFAULT_SEED,
  DEFAULT_TRIALS,
  INPUT_KIND_LABELS,
  METHOD_LABELS,
  SOURCE_LABELS,
  uncertaintyCoverage,
  uncertaintyViewOf,
  withUncertaintyRun,
  type EsqInputRow,
  type EsqUncertaintyFinding,
  type EsqUncertaintyView,
  type EsqUncertaintyWindowKind,
} from "./esqUncertainty";
import { getEsqRunWorkbook, getEsqUncertaintyResult, listEsqUncertaintyRuns, runEsqUncertainty, type EsqModelRunEntry } from "./esqWorkbookApi";
import { EsqUncertaintyCard, type EsqUncertaintyDistribution } from "./esqUncertaintyResult";
import { EsqInputPlot, atomCurve, lawCurve, sampleCurve, type EsqInputCurve } from "./esqInputPlot";
import "../es-workbooks/css/esSequences.css";
import "../sy-workbooks/css/syFaultTreeAnalysis.css";
import "./css/esqSolveTabs.css";
import "./css/esqUncertaintyScreen.css";

type UncertTab = "inputs" | "results" | "checks";

type KindFilter = "ALL" | EsqSampledInput["kind"];

type Workflow = "MANUAL" | "BATCH";

type ResultOrder = "TREE" | "HIGH" | "LOW";

type ResultGroup = "NONE" | "FAMILY" | "RELEASE";

interface ComposerSettings {
  correlation: EsqUncertaintyCorrelation;
  method: EventTreeSamplingMethod;
  trials: number;
  seed: number;
  workflow: Workflow;
  treeId: string;
  batchTreeIds: string[] | null;
}

interface ResultSettings {
  treeId: string;
  order: ResultOrder;
  group: ResultGroup;
}

interface ShownRun {
  runs: EsqModelRunEntry[];
  shown?: EsqModelRunEntry;
  result?: EsqUncertaintyRunResult;
  error?: string;
  listError?: string;
  show: (runId: string) => void;
  reload: () => void;
}

interface SequenceRow {
  sequence: EsqUncertaintySequence;
  position: number;
}

interface GroupRow {
  group: EsqUncertaintyGroup;
  label: string;
  position: number;
  rows: SequenceRow[];
}

interface OpenedSeries {
  title: string;
  distribution: EsqUncertaintyDistribution;
}

const UNCERT_TABS: { id: UncertTab; label: string }[] = [
  { id: "inputs", label: "Inputs" },
  { id: "results", label: "Results" },
  { id: "checks", label: "Checks" },
];

const TAB_VIEW = jsonView<UncertTab>(z.enum(["inputs", "results", "checks"]));

const COMPOSER_VIEW = jsonView<ComposerSettings>(z.object({
  correlation: z.enum(["SHARED", "INDEPENDENT"]).default("SHARED"),
  method: z.enum(["LATIN_HYPERCUBE", "MONTE_CARLO"]).default(DEFAULT_METHOD),
  trials: z.number().default(DEFAULT_TRIALS),
  seed: z.number().default(DEFAULT_SEED),
  workflow: z.enum(["MANUAL", "BATCH"]).default("BATCH"),
  treeId: z.string().default(""),
  batchTreeIds: z.array(z.string()).nullable().default(null),
}));

const ALL_TREES = "";

const START_RESULTS: ResultSettings = { treeId: ALL_TREES, order: "TREE", group: "NONE" };

const RESULTS_VIEW = jsonView<ResultSettings>(z.object({
  treeId: z.string(),
  order: z.enum(["TREE", "HIGH", "LOW"]),
  group: z.enum(["NONE", "FAMILY", "RELEASE"]),
}));

const KIND_VIEW = jsonView<KindFilter>(z.enum(["ALL", "PARAMETER", "HFE", "EVENT", "RECOVERY", "CCF_GROUP", "INITIATOR", "SPLIT", "CELL"]));

const UNCERT_WINDOW_KINDS: ReadonlySet<string> = new Set<EsqUncertaintyWindowKind>(["esqUncertInput"]);

const UNCERT_WINDOW_LABELS: Record<EsqUncertaintyWindowKind, string> = { esqUncertInput: "Sampled input" };

const KIND_FILTERS: readonly KindFilter[] = ["ALL", "PARAMETER", "HFE", "EVENT", "RECOVERY", "CCF_GROUP", "INITIATOR", "SPLIT", "CELL"];

const METHODS: readonly EventTreeSamplingMethod[] = ["LATIN_HYPERCUBE", "MONTE_CARLO"];

const DRAWS: readonly (readonly [EsqUncertaintyCorrelation, string])[] = [["SHARED", "Shared"], ["INDEPENDENT", "Independent"]];

const WORKFLOWS: readonly (readonly [Workflow, string])[] = [["MANUAL", "Manual"], ["BATCH", "Batch"]];

const RESULT_ORDERS: readonly (readonly [ResultOrder, string])[] = [["TREE", "Tree order"], ["HIGH", "Mean high to low"], ["LOW", "Mean low to high"]];

const RESULT_GROUPS: readonly (readonly [ResultGroup, string])[] = [["NONE", "None"], ["FAMILY", "Family"], ["RELEASE", "Release category"]];

const DRAW_TEXT: Record<EsqUncertaintyCorrelation, string> = { SHARED: "shared draws", INDEPENDENT: "independent draws" };

const STAT_HEADS: readonly string[] = ["Point", "Mean", "5th", "Median", "95th"];

const STATUS_TEXT: Record<string, string> = { QUEUED: "queued until it starts", RUNNING: "running", FAILED: "failed", CANCELLED: "cancelled" };

const LIST_POLL_MS = 3000;

function blank(text: string | undefined): boolean {
  return text === undefined || text.trim().length === 0;
}

function optionOf<T extends string>(options: readonly (readonly [T, string])[], value: string): T | undefined {
  return options.find(([option]) => option === value)?.[0];
}

type PlotState =
  | { status: "none" }
  | { status: "pending" }
  | { status: "ready"; curve: EsqInputCurve }
  | { status: "failed"; error: string };

const SUMMARY_PROBABILITIES: readonly number[] = [0.05, 0.5, 0.95];

const CURVE_PROBABILITIES: readonly number[] = Array.from({ length: 199 }, (_, index) => (index + 1) / 200);

function samplingOf(view: EsqUncertaintyView): UncertaintySampling {
  const run = view.run;
  return { method: run?.method ?? DEFAULT_METHOD, trials: run?.trials ?? DEFAULT_TRIALS, seed: run?.seed ?? DEFAULT_SEED };
}

function startComposer(view: EsqUncertaintyView): ComposerSettings {
  const run = view.run;
  return { correlation: "SHARED", method: run?.method ?? DEFAULT_METHOD, trials: run?.trials ?? DEFAULT_TRIALS, seed: run?.seed ?? DEFAULT_SEED, workflow: "BATCH", treeId: "", batchTreeIds: null };
}

function useInputPlot(row: EsqInputRow | undefined, table: ReadonlyMap<string, UncertainParameter>, sampling: UncertaintySampling, points: ReturnType<typeof useExpressionPoints>): PlotState {
  const expression = row?.input.expression;
  const sampled = row?.sampled === true;
  const unit = row?.input.unit;
  const lawQueries = useMemo(() => (sampled && expression?.node === "VALUE" ? [{ value: expression.value, probabilities: SUMMARY_PROBABILITIES, curveProbabilities: CURVE_PROBABILITIES }] : []), [sampled, expression]);
  const expressionQueries = useMemo(() => (sampled && unit !== undefined && expression !== undefined && expression.node !== "VALUE"
    ? [{ expression, unit, probabilities: SUMMARY_PROBABILITIES, sampling, parameters: parametersFor([expression], table) }]
    : []), [sampled, unit, expression, sampling, table]);
  const laws = useLawSummaries(lawQueries);
  const summaries = useExpressionSummaries(expressionQueries);
  if (row === undefined || expression === undefined) return { status: "none" };
  if (!sampled) {
    const state = points.get(row.input.key);
    if (state === undefined || state.status === "pending") return { status: "pending" };
    if (state.status === "failed") return { status: "failed", error: state.error };
    return { status: "ready", curve: atomCurve(state.value.point) };
  }
  if (expression.node === "VALUE") {
    const state = laws[0];
    if (state === undefined || state.status === "pending") return { status: "pending" };
    if (state.status === "failed") return { status: "failed", error: state.error };
    const curve = lawCurve(state.value);
    return curve === undefined ? { status: "failed", error: "The law gave no curve to draw." } : { status: "ready", curve };
  }
  const state = summaries[0];
  if (state === undefined || state.status === "pending") return { status: "pending" };
  if (state.status === "failed") return { status: "failed", error: state.error };
  const summary = state.value.sampled;
  const curve = summary === null ? atomCurve(state.value.point) : sampleCurve(summary);
  return curve === undefined ? { status: "failed", error: "The sampling gave no values to draw." } : { status: "ready", curve };
}

function inputPointEntries(rows: readonly EsqInputRow[]): EsqPointEntry[] {
  return rows.flatMap((row) => (row.input.expression !== undefined ? [{ key: row.input.key, expression: row.input.expression, unit: row.input.unit }] : []));
}

function inputPoint(row: EsqInputRow, points: ReturnType<typeof useExpressionPoints>): string {
  return pointText(points.get(row.input.key));
}

const CHANGE_TEXT: Record<EsqLawSource, string> = {
  DA: "Give the estimate a law in DA. Each run reads it from DA.",
  SY: "Give the value a law in SY and import again in Step 02.",
  HR: "Give the HEP a law in HR and import again in Step 02.",
  IE: "Change the frequency distribution in IE and import again.",
  STEP_02: "Change it in Step 02.",
  STEP_03: "Change it in Step 03.",
  STEP_04: "Change it in Step 04.",
};

function lawCell(row: EsqInputRow, label: (key: string) => string): string {
  const expression = row.input.expression;
  if (expression === undefined) return row.input.missing ?? "None";
  return row.sampled ? expressionText(expression, label) : "None, fixed at the point";
}

function sharedText(row: EsqInputRow): string {
  const count = row.input.users.length;
  return count > 1 ? `${count} items` : "Not shared";
}

function familyName(view: EsqUncertaintyView, familyId: string): string {
  const row = view.families.find((family) => family.familyId === familyId);
  return row === undefined || blank(row.name) ? familyId : `${familyId} · ${row.name}`;
}

function groupLabel(view: EsqUncertaintyView, group: EsqUncertaintyGroup): string {
  if (group.kind === "FAMILY") return group.key === "" ? "Not in a family" : familyName(view, group.key);
  if (group.kind === "RELEASE_CATEGORY") return group.key === "" ? "No release category" : group.key;
  return "Release total";
}

function sequenceName(model: EsqModel, ids: readonly string[]): string {
  return ids.map((id) => model.sequences.find((sequence) => sequence.id === id)?.code ?? id).join(" to ");
}

function composerSummary(view: EsqUncertaintyView): string {
  const total = view.inputs.length;
  const sampled = view.inputs.filter((row) => row.sampled).length;
  const inputs = `${sampled} of ${total} ${total === 1 ? "input" : "inputs"} ${sampled === 1 ? "has" : "have"} a distribution`;
  return `${inputs} · ${view.solveRun === undefined ? "Step 05 has no run of record" : "Uses the logic of the Step 05 run of record"}`;
}

function settingsProblem(settings: ComposerSettings): string | undefined {
  if (!(Number.isInteger(settings.trials) && settings.trials >= 100 && settings.trials <= 20_000)) return "Run between 100 and 20,000 trials.";
  if (!(Number.isInteger(settings.seed) && settings.seed >= 0 && settings.seed <= 2_147_483_647)) return "Use a whole-number seed from 0 to 2147483647.";
  return undefined;
}

function jobLabel(model: EsqModel, modelId: string): string | undefined {
  if (modelId === esqUncertaintyRunId()) return "Event trees";
  const tree = model.trees.find((candidate) => esqTreeRunId(candidate.id) === modelId);
  return tree === undefined ? undefined : treeLabel(model, tree.id);
}

function runLabel(run: EsqModelRunEntry): string {
  const when = new Date(run.requestedAt).toLocaleString(undefined, { dateStyle: "short", timeStyle: "short" });
  const base = `${when} · revision ${String(run.revision)}`;
  return run.status === "SUCCEEDED" ? base : `${base} · ${STATUS_TEXT[run.status] ?? run.status.toLowerCase()}`;
}

function ordered<T extends { position: number }>(items: readonly T[], order: ResultOrder, mean: (item: T) => number): T[] {
  const rank = (left: T, right: T): number => (order === "HIGH" ? mean(right) - mean(left) : order === "LOW" ? mean(left) - mean(right) : 0);
  return [...items].sort((left, right) => rank(left, right) || left.position - right.position);
}

function distributionOf(label: string, series: EsqUncertaintySeries, trials: number, values?: readonly number[]): EsqUncertaintyDistribution {
  const distribution: EsqUncertaintyDistribution = {
    label,
    point: series.point,
    mean: series.mean,
    p05: series.p05,
    p50: series.p50,
    p95: series.p95,
    histogram: series.histogram,
    quantiles: series.quantiles,
    trials,
  };
  if (values !== undefined) distribution.values = values;
  return distribution;
}

function useShownRun(workbookId: string | null, recordId: string | undefined): ShownRun {
  const [listed, setListed] = useState<EsqModelRunEntry[]>([]);
  const [chosenId, setChosenId] = useWorkbookView("uncertainty.run", "", TEXT_VIEW);
  const [listError, setListError] = useState<string | undefined>(undefined);
  const [reloads, setReloads] = useState(0);
  const [loaded, setLoaded] = useState<{ runId: string; result?: EsqUncertaintyRunResult; error?: string } | null>(null);
  const reload = useCallback(() => setReloads((count) => count + 1), []);

  useEffect(() => {
    if (workbookId === null) {
      setListed([]);
      return undefined;
    }
    let cancelled = false;
    listEsqUncertaintyRuns(workbookId)
      .then((runs) => {
        if (cancelled) return;
        setListed(runs);
        setListError(undefined);
      })
      .catch((caught: Error) => { if (!cancelled) setListError(caught.message); });
    return () => { cancelled = true; };
  }, [workbookId, reloads]);

  const active = listed.some((run) => run.status === "QUEUED" || run.status === "RUNNING");

  useEffect(() => {
    if (!active) return undefined;
    const timer = window.setInterval(reload, LIST_POLL_MS);
    return () => window.clearInterval(timer);
  }, [active, reload]);

  const shown = listed.find((run) => run.id === chosenId) ?? listed.find((run) => run.id === recordId) ?? listed[0];
  const shownId = shown?.status === "SUCCEEDED" ? shown.id : undefined;

  useEffect(() => {
    if (workbookId === null || shownId === undefined) return undefined;
    let cancelled = false;
    getEsqUncertaintyResult(workbookId, shownId)
      .then((result) => { if (!cancelled) setLoaded({ runId: shownId, result }); })
      .catch((caught: Error) => { if (!cancelled) setLoaded({ runId: shownId, error: caught.message }); });
    return () => { cancelled = true; };
  }, [workbookId, shownId]);

  const out: ShownRun = { runs: listed, show: setChosenId, reload };
  if (shown !== undefined) out.shown = shown;
  if (loaded !== null && loaded.runId === shownId) {
    if (loaded.result !== undefined) out.result = loaded.result;
    if (loaded.error !== undefined) out.error = loaded.error;
  }
  if (listError !== undefined) out.listError = listError;
  return out;
}

function useRunChange(workbookId: string | null, runId: string | undefined, stale: boolean): string | undefined {
  const { esq } = useEsqWorkbook();
  const [saved, setSaved] = useState<{ runId: string; mef: EventSequenceQuantification } | null>(null);
  useEffect(() => {
    if (workbookId === null || runId === undefined || !stale) return undefined;
    let cancelled = false;
    getEsqRunWorkbook(workbookId, runId)
      .then((mef) => { if (!cancelled) setSaved({ runId, mef }); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [workbookId, runId, stale]);
  return useMemo(() => (stale && saved !== null && saved.runId === runId ? solveInputsChange(saved.mef, esq) : undefined), [stale, saved, runId, esq]);
}

function FailedTrees({ trees, model }: { trees: readonly FailedTree[]; model: EsqModel }): JSX.Element | null {
  if (trees.length === 0) return null;
  return (
    <table className="postable postable--mid es-records esq-results" aria-label="Failed event trees">
      <thead><tr><th scope="col">Event tree</th><th scope="col">Why it failed</th></tr></thead>
      <tbody>
        {trees.map((tree) => (
          <tr key={tree.treeId}>
            <td>{treeLabel(model, tree.treeId)}</td>
            <td>{tree.failure ?? "No reason given"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function UncertaintyComposer({ view, shownRun, openWindow }: { view: EsqUncertaintyView; shownRun: ShownRun; openWindow: (ctx: EsqWindowContext) => void }): JSX.Element {
  const { esq, editable, runtime } = useEsqWorkbook();
  const fieldId = useId();
  const runner = useRunner();
  const blocked = analysisSaveBlock(runtime);
  const model = view.model;
  const roots = useMemo(() => treesInScope(esq, model).filter((tree) => !tree.transferEntry).map((tree) => ({ id: tree.id, label: treeLabel(model, tree.id) })), [esq, model]);
  const [settings, setSettings] = useWorkbookView<ComposerSettings>("uncertainty.composer", startComposer(view), COMPOSER_VIEW);
  const rootIds = roots.map((tree) => tree.id);
  const manualTreeId = roots.find((tree) => tree.id === settings.treeId)?.id ?? roots[0]?.id;
  const chosen = settings.batchTreeIds;
  const batch = settings.workflow === "BATCH";
  const treeIds = batch ? (chosen === null ? rootIds : rootIds.filter((treeId) => chosen.includes(treeId))) : manualTreeId === undefined ? [] : [manualTreeId];
  const everyTree = treeIds.length === rootIds.length;
  const problem = settingsProblem(settings);
  const sampled = view.inputs.some((row) => row.sampled);
  const solveRun = view.solveRun;
  const live = runner.live;
  const shown = shownRun.shown;
  const activeId = live !== null && (live.status === "QUEUED" || live.status === "RUNNING") ? live.id
    : shown !== undefined && (shown.status === "QUEUED" || shown.status === "RUNNING") ? shown.id
    : undefined;
  const ready = !runner.running && editable && blocked === null && solveRun !== undefined && problem === undefined && sampled && treeIds.length > 0;

  function set(patch: Partial<ComposerSettings>): void {
    setSettings((current) => ({ ...current, ...patch }));
  }

  function toggleTree(treeId: string): void {
    setSettings((current) => {
      const base = current.batchTreeIds ?? rootIds;
      return { ...current, batchTreeIds: base.includes(treeId) ? base.filter((id) => id !== treeId) : [...base, treeId] };
    });
  }

  function run(): void {
    const workbookId = runtime.workbookId;
    const revision = runtime.revision;
    if (workbookId === null || revision === null || solveRun === undefined || !ready) return;
    const picked = everyTree ? undefined : [...treeIds];
    let announced = false;
    runner.start(async () => {
      const response = await runEsqUncertainty(workbookId, revision, runLogicOf(solveRun), settings, (progress) => {
        runner.progress(progress);
        if (announced) return;
        announced = true;
        shownRun.show(progress.id);
        shownRun.reload();
      }, picked);
      shownRun.show(response.run.id);
      shownRun.reload();
      if (response.run.status !== "SUCCEEDED") await runner.failRun(workbookId, response.run, model);
    });
  }

  function stop(): void {
    const workbookId = runtime.workbookId;
    if (workbookId === null || activeId === undefined) return;
    cancelAnalysisRun("esq", workbookId, activeId)
      .then(() => shownRun.reload())
      .catch((caught: Error) => runner.fail(caught.message, []));
  }

  return (
    <section className="syft-analysis" aria-label="Uncertainty analysis">
      <div className="syft-analysis__heading">
        <h3>Uncertainty analysis</h3>
        <AnalysisJobs host="esq" workbookId={runtime.workbookId} modelLabel={(modelId) => jobLabel(model, modelId)} />
      </div>
      <div className={`syft-analysis__composer syft-analysis__composer--${settings.workflow.toLowerCase()} esq-composer`} aria-label="Uncertainty analysis controls">
        <div className="syft-analysis__run-composer">
          {batch ? (
            <>
              <fieldset className="syft-analysis__batch-models">
                <legend>Event trees</legend>
                {roots.map((tree) => (
                  <label key={tree.id}>
                    <input type="checkbox" checked={treeIds.includes(tree.id)} onChange={() => toggleTree(tree.id)} />
                    <span>{tree.label}</span>
                  </label>
                ))}
              </fieldset>
              <span className="syft-analysis__selection-summary">{`${treeIds.length} ${treeIds.length === 1 ? "event tree" : "event trees"} selected`}</span>
            </>
          ) : (
            <div className="syft-analysis__run-fields">
              <label className="syft-analysis__run-field">
                <span>Event tree</span>
                <select aria-label="Uncertainty event tree" value={manualTreeId ?? ""} disabled={roots.length === 0} onChange={(event) => set({ treeId: event.target.value })}>
                  {roots.map((tree) => <option key={tree.id} value={tree.id}>{tree.label}</option>)}
                </select>
              </label>
            </div>
          )}
        </div>

        <fieldset className="syft-analysis__calculation-picker">
          <legend>Draws</legend>
          <div role="radiogroup" aria-label="Uncertainty draws">
            {DRAWS.map(([value, label]) => (
              <label key={value} className={settings.correlation === value ? "is-selected" : ""}>
                <input type="radio" name={`${fieldId}-draws`} value={value} checked={settings.correlation === value} onChange={() => set({ correlation: value })} />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="syft-analysis__workflow-picker">
          <legend>Workflow</legend>
          <div role="radiogroup" aria-label="Uncertainty workflow">
            {WORKFLOWS.map(([value, label]) => (
              <label key={value} className={settings.workflow === value ? "is-selected" : ""}>
                <input type="radio" name={`${fieldId}-workflow`} value={value} checked={settings.workflow === value} onChange={() => set({ workflow: value })} />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="syft-analysis__run-composer">
          <div className="syft-analysis__setup-row">
            <span className="syft-analysis__selection-summary">{composerSummary(view)}</span>
            {solveRun !== undefined && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => openWindow({ kind: "esqSolveRun", id: "run" })}>Step 05 run of record</button>}
          </div>
          <div className="syft-analysis__execution-row">
            <div className="syft-analysis__run-fields">
              <label className="syft-analysis__run-field">
                <span>Sampling</span>
                <select aria-label="Uncertainty sampling method" value={settings.method} onChange={(event) => {
                  const method = METHODS.find((entry) => entry === event.target.value);
                  if (method !== undefined) set({ method });
                }}>
                  {METHODS.map((entry) => <option key={entry} value={entry}>{METHOD_LABELS[entry]}</option>)}
                </select>
              </label>
            </div>
            {editable && (
              <div className="esq-run-actions">
                {activeId !== undefined && <button type="button" className="posnav__btn posnav__btn--sm" onClick={stop}>Stop</button>}
                <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" disabled={!ready} onClick={run}>
                  {runner.running ? "Running…" : `Run uncertainty${batch ? " batch" : ""}`}
                </button>
              </div>
            )}
          </div>
          <div className="syft-analysis__advanced-panel" aria-label="Uncertainty analysis settings">
            <div className="syft-analysis__advanced">
              <label>
                <span>Trials</span>
                <input aria-label="Uncertainty trials" type="number" min={100} max={20000} step={100} aria-invalid={!(Number.isInteger(settings.trials) && settings.trials >= 100 && settings.trials <= 20_000)} value={settings.trials} onChange={(event) => set({ trials: Math.round(Number(event.target.value)) })} />
              </label>
              <label>
                <span>Seed</span>
                <input aria-label="Uncertainty seed" type="number" min={0} step={1} aria-invalid={!(Number.isInteger(settings.seed) && settings.seed >= 0 && settings.seed <= 2_147_483_647)} value={settings.seed} onChange={(event) => set({ seed: Math.round(Number(event.target.value)) })} />
              </label>
            </div>
          </div>
        </div>
      </div>
      {solveRun?.hcl !== undefined && <p className="syft-analysis__notice">The sampling leaves out the dependency network of the run of record.</p>}
      {blocked !== null && <p className="syft-analysis__notice" role="status">{blocked}</p>}
      {problem !== undefined && <p className="syft-analysis__notice" role="status">{problem}</p>}
      {runner.error !== null && <p className="syft-analysis__error" role="alert">{runner.error}</p>}
      <FailedTrees trees={runner.failed} model={model} />
    </section>
  );
}

function InputsPanel({ view, openWindow }: { view: EsqUncertaintyView; openWindow: (ctx: EsqWindowContext) => void }): JSX.Element {
  const { esq, upstream } = useEsqWorkbook();
  const fieldId = useId();
  const [kind, setKind] = useWorkbookView<KindFilter>("uncertainty.inputs.kind", "ALL", KIND_VIEW);
  const [page, setPage] = useState(0);
  const [openKey, setOpenKey] = useState("");
  const [wrapRef, wrapWidth] = useElementWidth(0);
  const table = useMemo(() => parameterTableOf(esq, missionTimeSourcesOf(esq, upstream)), [esq, upstream]);
  const label = useMemo(() => parameterLabelOf(esq, missionTimeSourcesOf(esq, upstream)), [esq, upstream]);
  const sampling = useMemo(() => samplingOf(view), [view]);
  const rows = useMemo(() => (kind === "ALL" ? view.inputs : view.inputs.filter((row) => row.input.kind === kind)), [view.inputs, kind]);
  const pages = paged(rows.length, page);
  const shown = useMemo(() => rows.slice(pages.start, pages.start + PAGE), [rows, pages.start]);
  const entries = useMemo(() => inputPointEntries(shown), [shown]);
  const points = useExpressionPoints(entries, table);
  const plot = useInputPlot(shown.find((row) => row.input.key === openKey), table, sampling, points);
  return (
    <>
      <div className="es-records__bar">
        <div className="es-records__filters">
          <div className="es-records__filter">
            <label className="posfield__label" htmlFor={`${fieldId}-kind`}>Input</label>
            <select id={`${fieldId}-kind`} className="posfield__select" value={kind} onChange={(event) => { setKind(KIND_FILTERS.find((entry) => entry === event.target.value) ?? "ALL"); setPage(0); }}>
              {KIND_FILTERS.map((entry) => <option key={entry} value={entry}>{entry === "ALL" ? "Every input" : INPUT_KIND_LABELS[entry]}</option>)}
            </select>
          </div>
        </div>
        <Pager rows={pages} noun="input" onPage={setPage} />
      </div>
      <div className="esq-table-wrap" ref={wrapRef}>
        {rows.length > 0 && (
          <table className="postable esq-rowtable" aria-label="Sampled inputs">
            <thead><tr><th className="esq-rowtable__pick">Plot</th><th>Input</th><th>Point</th><th>Distribution</th><th>Shared by</th></tr></thead>
            <tbody>
              {shown.map((row) => {
                const input = row.input;
                const open = input.key === openKey;
                const plotted = input.expression !== undefined;
                return (
                  <Fragment key={input.key}>
                    <tr className={rowClass(!row.sampled, open)} onClick={() => { if (!open && plotted) setOpenKey(input.key); }}>
                      <td className="esq-rowtable__pick">
                        <button type="button" className="esq-rowtable__plot" aria-expanded={open} aria-label={open ? `Hide the plot of ${input.label}` : `Plot ${input.label}`} disabled={!plotted} onClick={(event) => { event.stopPropagation(); setOpenKey(open ? "" : input.key); }}>
                          {open ? "Hide" : "Plot"}
                        </button>
                      </td>
                      <td className="esq-rowtable__wrap">
                        <button type="button" className="esq-rowtable__name" onClick={(event) => { event.stopPropagation(); openWindow({ kind: "esqUncertInput", id: input.key }); }}>{input.label}</button>
                        {row.significant && <span className="esq-rowtable__tag">Significant</span>}
                      </td>
                      <td className="esq-rowtable__num">{inputPoint(row, points)}</td>
                      <td className="esq-rowtable__wrap">{lawCell(row, label)}</td>
                      <td className="esq-rowtable__text">{sharedText(row)}</td>
                    </tr>
                    {open && (
                      <DetailRow span={5} width={wrapWidth - 18}>
                        {plot.status === "ready" && <EsqInputPlot curve={plot.curve} label={input.label} unit={unitText(input.unit)} />}
                        {plot.status === "pending" && <p className="esq-input-plot__status" role="status">Loading the plot</p>}
                        {plot.status === "failed" && <p className="esq-run__error" role="alert">{`The plot could not be drawn. ${plot.error}`}</p>}
                        <FieldList items={[
                          { label: "Kind", value: INPUT_KIND_LABELS[input.kind] },
                          { label: "Distribution from", value: input.source === undefined ? "—" : SOURCE_LABELS[input.source] ?? input.source },
                        ]} />
                      </DetailRow>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function StatCells({ series }: { series: EsqUncertaintySeries }): JSX.Element {
  return (
    <>
      <td className="posmono">{sciText(series.point)}</td>
      <td className="posmono">{sciText(series.mean)}</td>
      <td className="posmono">{sciText(series.p05)}</td>
      <td className="posmono">{sciText(series.p50)}</td>
      <td className="posmono">{sciText(series.p95)}</td>
    </>
  );
}

function StatHeads({ name, actions }: { name: string; actions: boolean }): JSX.Element {
  return (
    <thead>
      <tr>
        <th scope="col" rowSpan={2}>{name}</th>
        <th scope="colgroup" colSpan={STAT_HEADS.length} className="esq-uncert__span">Frequency (/yr)</th>
        {actions && <th scope="col" rowSpan={2} className="es-records__act" aria-label="Actions" />}
      </tr>
      <tr>{STAT_HEADS.map((head) => <th key={head} scope="col">{head}</th>)}</tr>
    </thead>
  );
}

function SequenceTable({ rows, label, model, all, onOpen }: { rows: readonly SequenceRow[]; label: string; model: EsqModel; all: boolean; onOpen: (row: SequenceRow) => void }): JSX.Element {
  return (
    <table className="postable postable--mid es-records esq-results" aria-label={label}>
      <StatHeads name="Sequence" actions={false} />
      <tbody>
        {rows.map((row) => {
          const sequence = row.sequence;
          const name = sequenceName(model, sequence.sequenceIds);
          const endState = sequence.endState === null ? "" : END_STATE_LABELS[sequence.endState] ?? sequence.endState;
          const note = [endState, all ? treeLabel(model, sequence.treeId) : "", sequence.paths > 1 ? `${sequence.paths} paths` : ""].filter((part) => part.length > 0).join(" · ");
          return (
            <tr key={row.position}>
              <td>
                <button type="button" className="es-records__link" aria-label={`Distribution of ${name}`} onClick={() => onOpen(row)}>{name}</button>
                {note.length > 0 && <span className="postable__name-sub">{note}</span>}
              </td>
              <StatCells series={sequence} />
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function GroupTable({ entries, total, noun, model, all, order, resetKey, onGroup, onTotal, onSequence }: {
  entries: readonly GroupRow[];
  total: EsqUncertaintyGroup | undefined;
  noun: string;
  model: EsqModel;
  all: boolean;
  order: ResultOrder;
  resetKey: string;
  onGroup: (entry: GroupRow) => void;
  onTotal: (total: EsqUncertaintyGroup) => void;
  onSequence: (row: SequenceRow) => void;
}): JSX.Element {
  const [open, setOpen] = useState<readonly string[]>([]);
  const label = `${noun} results`;

  function toggle(key: string): void {
    setOpen((current) => (current.includes(key) ? current.filter((entry) => entry !== key) : [...current, key]));
  }

  return (
    <PagedResults items={entries} label={label} resetKey={resetKey}>
      {(page) => (
        <table className="postable postable--mid es-records esq-results" aria-label={label}>
          <StatHeads name={noun} actions />
          <tbody>
            {page.map((entry) => {
              const key = entry.group.key;
              const expanded = open.includes(key);
              return (
                <Fragment key={key}>
                  <tr>
                    <td><button type="button" className="es-records__link" aria-label={`Distribution of ${entry.label}`} onClick={() => onGroup(entry)}>{entry.label}</button></td>
                    <StatCells series={entry.group} />
                    <td className="es-records__act">
                      <button type="button" className="posnav__btn posnav__btn--sm" aria-expanded={expanded} aria-label={`${expanded ? "Hide" : "Show"} the sequences of ${entry.label}`} onClick={() => toggle(key)}>{expanded ? "Hide" : "Show"}</button>
                    </td>
                  </tr>
                  {expanded && (
                    <tr className="esq-tree-results__members">
                      <td colSpan={STAT_HEADS.length + 2}>
                        <PagedResults items={ordered(entry.rows, order, (row) => row.sequence.mean)} label={`Sequences of ${entry.label}`} resetKey={resetKey}>
                          {(members) => <SequenceTable rows={members} label={`Sequences of ${entry.label}`} model={model} all={all} onOpen={onSequence} />}
                        </PagedResults>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
          {total !== undefined && (
            <tfoot>
              <tr>
                <td><button type="button" className="es-records__link" aria-label="Distribution of the release total" onClick={() => onTotal(total)}>Release total</button></td>
                <StatCells series={total} />
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      )}
    </PagedResults>
  );
}

function UncertaintyResults({ view, result }: { view: EsqUncertaintyView; result: EsqUncertaintyRunResult }): JSX.Element {
  const fieldId = useId();
  const [settings, setSettings] = useWorkbookView<ResultSettings>("uncertainty.results", START_RESULTS, RESULTS_VIEW);
  const [opened, setOpened] = useState<OpenedSeries | null>(null);
  const model = view.model;
  const sequences = useMemo(() => result.sequences ?? [], [result]);
  const groups = useMemo(() => result.groups ?? [], [result]);
  const trees = result.trees.filter((tree) => tree.status === "SUCCEEDED");
  const options = [
    ...(trees.length > 1 ? [{ id: ALL_TREES, label: "All event trees in the run" }] : []),
    ...trees.map((tree) => ({ id: tree.treeId, label: treeLabel(model, tree.treeId) })),
  ];
  const treeId = options.some((option) => option.id === settings.treeId) ? settings.treeId : options[0]?.id ?? ALL_TREES;
  const all = treeId === ALL_TREES;
  const scope = all ? null : treeId;
  const rows: SequenceRow[] = sequences.flatMap((sequence, position) => (all || sequence.treeId === treeId ? [{ sequence, position }] : []));
  const kind = settings.group === "FAMILY" ? "FAMILY" : "RELEASE_CATEGORY";
  const entries: GroupRow[] = settings.group === "NONE" ? [] : ordered(
    groups.filter((group) => group.treeId === scope && group.kind === kind).map((group): GroupRow => {
      const members = rows.filter((row) => ((kind === "FAMILY" ? row.sequence.familyId : row.sequence.releaseCategoryId) ?? "") === group.key);
      return { group, label: groupLabel(view, group), position: members[0]?.position ?? rows.length, rows: members };
    }),
    settings.order,
    (entry) => entry.group.mean,
  );
  const total = settings.group === "NONE" ? undefined : groups.find((group) => group.treeId === scope && group.kind === "RELEASE_TOTAL");
  const resetKey = `${result.runId}:${treeId}:${settings.order}:${settings.group}`;
  const where = all ? "" : ` · ${treeLabel(model, treeId)}`;
  const details = `Per reactor-year · ${result.trials.toLocaleString()} ${METHOD_LABELS[result.method]} trials · seed ${result.seed} · ${DRAW_TEXT[result.correlation]}`;

  function set(patch: Partial<ResultSettings>): void {
    setSettings((current) => ({ ...current, ...patch }));
  }

  function openSequence(row: SequenceRow): void {
    const title = `${sequenceName(model, row.sequence.sequenceIds)} · ${treeLabel(model, row.sequence.treeId)}`;
    setOpened({ title, distribution: distributionOf(title, row.sequence, result.trials) });
  }

  function openGroup(entry: GroupRow): void {
    const title = `${entry.label}${where}`;
    const values = all && entry.group.kind === "FAMILY" ? result.families.find((family) => family.familyId === entry.group.key)?.values : undefined;
    setOpened({ title, distribution: distributionOf(title, entry.group, result.trials, values) });
  }

  function openTotal(group: EsqUncertaintyGroup): void {
    const title = `Release total${where}`;
    const values = all ? result.total?.values : undefined;
    setOpened({ title, distribution: distributionOf(title, group, result.trials, values) });
  }

  return (
    <div className="esq-tree-results">
      <div className="es-records__bar">
        <div className="es-records__filters">
          <div className="es-records__filter">
            <label className="posfield__label" htmlFor={`${fieldId}-tree`}>Event tree</label>
            <select id={`${fieldId}-tree`} className="posfield__select" value={treeId} onChange={(event) => set({ treeId: event.target.value })}>
              {options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
          </div>
          <div className="es-records__filter">
            <label className="posfield__label" htmlFor={`${fieldId}-order`}>Order</label>
            <select id={`${fieldId}-order`} className="posfield__select" value={settings.order} onChange={(event) => {
              const order = optionOf(RESULT_ORDERS, event.target.value);
              if (order !== undefined) set({ order });
            }}>
              {RESULT_ORDERS.map(([option, text]) => <option key={option} value={option}>{text}</option>)}
            </select>
          </div>
          <div className="es-records__filter">
            <label className="posfield__label" htmlFor={`${fieldId}-group`}>Group by</label>
            <select id={`${fieldId}-group`} className="posfield__select" value={settings.group} onChange={(event) => {
              const group = optionOf(RESULT_GROUPS, event.target.value);
              if (group !== undefined) set({ group });
            }}>
              {RESULT_GROUPS.map(([option, text]) => <option key={option} value={option}>{text}</option>)}
            </select>
          </div>
        </div>
      </div>
      {settings.group === "NONE" && rows.length > 0 && (
        <PagedResults items={ordered(rows, settings.order, (row) => row.sequence.mean)} label="Sequences" resetKey={resetKey}>
          {(page) => <SequenceTable rows={page} label="Sequences" model={model} all={all} onOpen={openSequence} />}
        </PagedResults>
      )}
      {settings.group !== "NONE" && entries.length > 0 && (
        <GroupTable
          key={resetKey}
          entries={entries}
          total={total}
          noun={settings.group === "FAMILY" ? "Family" : "Release category"}
          model={model}
          all={all}
          order={settings.order}
          resetKey={resetKey}
          onGroup={openGroup}
          onTotal={openTotal}
          onSequence={openSequence}
        />
      )}
      {opened !== null && (
        <DialogShell label="Uncertainty result" onClose={() => setOpened(null)} fit>
          <DialogHead cap="Uncertainty · ESQ-E2" title={opened.title} onClose={() => setOpened(null)} />
          <div className="modal__body esq-dialog-body">
            <EsqUncertaintyCard distribution={opened.distribution} details={details} />
          </div>
        </DialogShell>
      )}
    </div>
  );
}

function RunHead({ view, shownRun, blocked }: { view: EsqUncertaintyView; shownRun: ShownRun; blocked: boolean }): JSX.Element | null {
  const { esq, editable, mutateEsq } = useEsqWorkbook();
  const id = useId();
  const { runs, shown, result } = shownRun;
  if (shown === undefined) return null;
  const recordId = view.run?.runId;
  const recorded = result !== undefined && result.runId === recordId;
  const coverage = result === undefined ? undefined : uncertaintyCoverage(result, esq);
  const partial = coverage !== undefined && coverage.covered < coverage.total;
  return (
    <div className="es-seq-card__picker">
      <label className="posfield__label" htmlFor={id}>Run</label>
      <div className="es-seq-card__pick-row">
        <select id={id} className="posfield__select" value={shown.id} onChange={(event) => shownRun.show(event.target.value)}>
          {runs.map((run) => <option key={run.id} value={run.id}>{`${runLabel(run)}${run.id === recordId ? " · of record" : ""}`}</option>)}
        </select>
        {editable && result !== undefined && result.correlation === "SHARED" && (
          <button
            type="button"
            className="posnav__btn posnav__btn--sm"
            disabled={recorded || blocked || partial}
            title={partial && coverage !== undefined ? `This run covers ${coverage.covered} of ${coverage.total} event trees.` : undefined}
            onClick={() => mutateEsq((draft) => withUncertaintyRun(draft, result))}
          >
            {recorded ? "Values of record" : "Use as values of record"}
          </button>
        )}
      </div>
    </div>
  );
}

function ResultsPanel({ view, shownRun }: { view: EsqUncertaintyView; shownRun: ShownRun }): JSX.Element | null {
  const { esq, runtime } = useEsqWorkbook();
  const { shown, result } = shownRun;
  const stale = result !== undefined && result.inputs !== uncertaintyInputsKey(esq);
  const change = useRunChange(runtime.workbookId, result?.runId, stale);
  const failed = result === undefined ? 0 : result.trees.filter((tree) => tree.status === "FAILED").length;
  const problem = result === undefined ? undefined : failed > 0 ? `${failed} of ${result.trees.length} event trees failed in this run.` : change;
  if (shownRun.listError !== undefined && shown === undefined) return <p className="es-scope-error" role="alert">{shownRun.listError}</p>;
  return (
    <div className="esq-solve-stack">
      <RunHead view={view} shownRun={shownRun} blocked={failed > 0 || stale} />
      {shown?.status === "FAILED" && <p className="es-scope-error" role="alert">{shown.failure ?? "The run did not finish and gave no reason."}</p>}
      {shownRun.error !== undefined && <p className="es-scope-error" role="alert">{shownRun.error}</p>}
      {problem !== undefined && <p className="es-scope-error" role="status">{problem}</p>}
      {result !== undefined && (result.sequences === undefined
        ? <p className="es-scope-error" role="status">This run was made before per-tree results and holds family totals only.</p>
        : <UncertaintyResults key={result.runId} view={view} result={result} />)}
    </div>
  );
}

function UncertScreen({ openWindow }: { openWindow: (ctx: EsqWindowContext) => void }): JSX.Element {
  const { esq, runtime } = useEsqWorkbook();
  const view = useMemo(() => uncertaintyViewOf(esq), [esq]);
  const [tab, setTab] = useWorkbookView<UncertTab>("uncertainty.tab", "inputs", TAB_VIEW);
  const shownRun = useShownRun(view === undefined ? null : runtime.workbookId, view?.run?.runId);

  function openFinding(finding: EsqUncertaintyFinding): void {
    const target = finding.target;
    if (target !== undefined) openWindow({ kind: target.kind, id: target.id });
  }

  function renderPanel(): JSX.Element | null {
    if (view === undefined) return null;
    switch (tab) {
      case "inputs": return <InputsPanel view={view} openWindow={openWindow} />;
      case "results": return <ResultsPanel view={view} shownRun={shownRun} />;
      case "checks": return <ChecksPanel findings={view.findings} opens={(finding) => finding.target !== undefined} onOpen={openFinding} />;
    }
  }

  return (
    <div className="poscard es-seq-card esq-uncert">
      {view !== undefined && <UncertaintyComposer view={view} shownRun={shownRun} openWindow={openWindow} />}
      <TabBar tabs={UNCERT_TABS} tab={tab} label="Uncertainty sections" findings={view?.findings.length ?? 0} onTab={setTab} />
      <div className="es-seq-card__panel">{renderPanel()}</div>
    </div>
  );
}

function InputWindow({ id, onClose }: { id: string; onClose: () => void }): JSX.Element | null {
  const { esq, upstream } = useEsqWorkbook();
  const view = useMemo(() => uncertaintyViewOf(esq), [esq]);
  const table = useMemo(() => parameterTableOf(esq, missionTimeSourcesOf(esq, upstream)), [esq, upstream]);
  const label = useMemo(() => parameterLabelOf(esq, missionTimeSourcesOf(esq, upstream)), [esq, upstream]);
  const row = view?.inputs.find((candidate) => candidate.input.key === id);
  const entries = useMemo(() => (row === undefined ? [] : inputPointEntries([row])), [row]);
  const points = useExpressionPoints(entries, table);
  if (row === undefined) return null;
  const input = row.input;
  const from = input.source === undefined ? "" : ` · ${SOURCE_LABELS[input.source] ?? input.source}`;
  const lawLine = input.expression === undefined ? input.missing ?? "None" : `${expressionText(input.expression, label)}${from}`;
  return (
    <>
      <ModalHead cap={`Sampled input · ${INPUT_KIND_LABELS[input.kind]} · ESQ-E2`} title={input.label} onClose={onClose} />
      <div className="modal__body esq-form">
        <FormRow label="Point value"><span className="esq-form__unit">{`${inputPoint(row, points)} · ${unitText(input.unit)}`}</span></FormRow>
        <FormRow label="Distribution"><span className="esq-form__note">{lawLine}</span></FormRow>
        <FormRow label="Change it"><span className="esq-form__note">{input.source === undefined ? "Change it in the step that holds it." : CHANGE_TEXT[input.source]}</span></FormRow>
      </div>
      <FormFoot onClose={onClose} />
    </>
  );
}

function UncertWindows({ context, onClose }: { context: EsqWindowContext; onClose: () => void }): JSX.Element | null {
  switch (context.kind) {
    case "esqUncertInput": return <InputWindow key={context.id} id={context.id} onClose={onClose} />;
    default: return null;
  }
}

export { UncertScreen, UncertWindows, UNCERT_WINDOW_KINDS, UNCERT_WINDOW_LABELS };
