import { Fragment, JSX, useEffect, useId, useMemo, useState } from "react";
import type { EsqLawSource, EsqSampledInput } from "interfaces-mef-types/esq/esq-measure-inputs";
import type { UncertainParameter } from "interfaces-mef-types/core/uncertainty";
import type { EsqUncertaintyCorrelation, EsqUncertaintyRunResult, EventTreeSamplingMethod } from "interfaces-shared-types/newly-developed-methods/event-tree";
import type { UncertaintySampling } from "interfaces-shared-types/newly-developed-methods/shared";
import { WorkbookSectionHeading } from "../workbooks/workbookSectionHeading";
import { analysisSaveBlock } from "../newly-developed-methods/shared/useAnalysisScope";
import { parametersFor, useExpressionSummaries, useLawSummaries } from "../newly-developed-methods/shared/useUncertainty";
import { expressionText, unitText } from "../newly-developed-methods/shared/uncertainText";
import { useEsqWorkbook } from "./esqWorkbookContext";
import {
  DetailRow,
  DetailToggle,
  EsqProvenanceChip,
  EsqTabs,
  FieldList,
  FindingsTable,
  FormFoot,
  FormRow,
  ModalHead,
  RunState,
  dateText,
  failedTrees,
  pointText,
  rowClass,
  sciText,
  useElementWidth,
  useExpressionPoints,
  useRunner,
  type EsqPointEntry,
} from "./esqShared";
import { Pager, pageOf, type EsqWindowContext } from "./esqModelScreen";
import { missionTimeSourcesOf, parameterLabelOf, parameterTableOf } from "./esqModel";
import { runLogicOf } from "./esqResults";
import {
  DEFAULT_METHOD,
  DEFAULT_SEED,
  DEFAULT_TRIALS,
  INPUT_KIND_LABELS,
  METHOD_LABELS,
  SOURCE_LABELS,
  standardErrors,
  uncertaintyRunProblem,
  uncertaintyViewOf,
  uncertaintyWorkOf,
  withUncertaintyRun,
  type EsqInputRow,
  type EsqUncertaintyView,
  type EsqUncertaintyWindowKind,
} from "./esqUncertainty";
import { getEsqUncertaintyResult, runEsqUncertainty } from "./esqWorkbookApi";

type UncertTab = "inputs" | "correlation" | "runs" | "families" | "checks";

const TAB_HEADS: Record<UncertTab, { title: string; sr: string }> = {
  inputs: { title: "Sampled inputs", sr: "ESQ-A5 · ESQ-E2" },
  correlation: { title: "State-of-knowledge correlation", sr: "ESQ-A5 · ESQ-E2" },
  runs: { title: "Sampling runs", sr: "ESQ-E2" },
  families: { title: "Family distributions", sr: "ESQ-A5 · ESQ-E2" },
  checks: { title: "Uncertainty checks", sr: "ESQ-A5 · ESQ-E2" },
};

const UNCERT_WINDOW_KINDS: ReadonlySet<string> = new Set<EsqUncertaintyWindowKind>(["esqUncertInput"]);

const UNCERT_WINDOW_LABELS: Record<EsqUncertaintyWindowKind, string> = { esqUncertInput: "Sampled input" };

const KIND_FILTERS: readonly ("ALL" | EsqSampledInput["kind"])[] = ["ALL", "PARAMETER", "HFE", "EVENT", "RECOVERY", "CCF_GROUP", "INITIATOR", "SPLIT", "CELL"];

const METHODS: readonly EventTreeSamplingMethod[] = ["LATIN_HYPERCUBE", "MONTE_CARLO"];

function blank(text: string | undefined): boolean {
  return text === undefined || text.trim().length === 0;
}

function valueText(value: number | undefined): string {
  return value === undefined ? "—" : sciText(value);
}

function ratioText(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return "—";
  return `${String(Number(value.toPrecision(3)))}×`;
}

interface EsqMoments {
  mean: number;
  standardDeviation: number | null;
}

function samplingOf(view: EsqUncertaintyView): UncertaintySampling {
  const run = view.run;
  return { method: run?.method ?? DEFAULT_METHOD, trials: run?.trials ?? DEFAULT_TRIALS, seed: run?.seed ?? DEFAULT_SEED };
}

function useMoments(rows: readonly EsqInputRow[], table: ReadonlyMap<string, UncertainParameter>, sampling: UncertaintySampling): Map<string, EsqMoments> {
  const lawRows = useMemo(() => rows.flatMap((row) => {
    const expression = row.input.expression;
    return row.sampled && expression?.node === "VALUE" ? [{ key: row.input.key, query: { value: expression.value, probabilities: [], curveProbabilities: [] } }] : [];
  }), [rows]);
  const sampledRows = useMemo(() => rows.flatMap((row) => {
    const expression = row.input.expression;
    return row.sampled && expression !== undefined && expression.node !== "VALUE"
      ? [{ key: row.input.key, query: { expression, unit: row.input.unit, probabilities: [], sampling, parameters: parametersFor([expression], table) } }]
      : [];
  }), [rows, table, sampling]);
  const lawQueries = useMemo(() => lawRows.map((entry) => entry.query), [lawRows]);
  const sampledQueries = useMemo(() => sampledRows.map((entry) => entry.query), [sampledRows]);
  const laws = useLawSummaries(lawQueries);
  const sampled = useExpressionSummaries(sampledQueries);
  const moments = new Map<string, EsqMoments>();
  lawRows.forEach((entry, index) => {
    const state = laws[index];
    if (state?.status === "ready") moments.set(entry.key, { mean: state.value.mean, standardDeviation: state.value.standardDeviation });
  });
  sampledRows.forEach((entry, index) => {
    const state = sampled[index];
    const summary = state?.status === "ready" ? state.value.sampled : null;
    if (summary !== null && summary !== undefined) moments.set(entry.key, { mean: summary.mean, standardDeviation: summary.standardDeviation });
  });
  return moments;
}

function raiseOf(moments: EsqMoments | undefined): number | undefined {
  if (moments === undefined || moments.standardDeviation === null || moments.mean === 0) return undefined;
  const variation = moments.standardDeviation / moments.mean;
  return 1 + variation * variation;
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
  STEP_04: "Change it in Step 04.",
  STEP_06: "Change it in Step 06.",
};

function lawCell(row: EsqInputRow, label: (key: string) => string): string {
  const expression = row.input.expression;
  if (expression === undefined) return row.input.missing ?? "None";
  return row.sampled ? expressionText(expression, label) : "None, fixed at the point";
}

function countText(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function familyName(view: EsqUncertaintyView, familyId: string): string {
  const row = view.families.find((family) => family.familyId === familyId);
  return row === undefined || blank(row.name) ? familyId : `${familyId} · ${row.name}`;
}

interface SamplingSettings {
  trials: number;
  seed: number;
  method: EventTreeSamplingMethod;
}

function settingsProblem(settings: SamplingSettings): string | undefined {
  if (!(Number.isInteger(settings.trials) && settings.trials >= 100 && settings.trials <= 20_000)) return "Run between 100 and 20,000 trials.";
  if (!(Number.isInteger(settings.seed) && settings.seed >= 0 && settings.seed <= 2_147_483_647)) return "Use a whole-number seed from 0 to 2147483647.";
  return undefined;
}

function useSampling(view: EsqUncertaintyView) {
  const { esq, editable, runtime, mutateEsq } = useEsqWorkbook();
  const runner = useRunner();
  const blocked = analysisSaveBlock(runtime);
  const solveRun = view.solveRun;

  function sample(settings: SamplingSettings, correlation: EsqUncertaintyCorrelation): void {
    const workbookId = runtime.workbookId;
    const revision = runtime.revision;
    if (workbookId === null || revision === null || solveRun === undefined || settingsProblem(settings) !== undefined) return;
    runner.start(async () => {
      const response = await runEsqUncertainty(workbookId, revision, runLogicOf(solveRun), { ...settings, correlation });
      if (response.run.status !== "SUCCEEDED") throw new Error(response.run.failure?.message ?? "The run did not finish.");
      const result = await getEsqUncertaintyResult(workbookId, response.run.id);
      const problem = uncertaintyRunProblem(result, esq);
      if (problem !== undefined) {
        runner.fail(problem, failedTrees(result));
        return;
      }
      mutateEsq((draft) => withUncertaintyRun(draft, result));
    });
  }

  return { runner, blocked, sample, disabled: runner.running || !editable || blocked !== null || solveRun === undefined };
}

function InputsPanel({ view, openWindow }: { view: EsqUncertaintyView; openWindow: (ctx: EsqWindowContext) => void }): JSX.Element {
  const { esq, upstream } = useEsqWorkbook();
  const fieldId = useId();
  const [kind, setKind] = useState<"ALL" | EsqSampledInput["kind"]>("ALL");
  const [page, setPage] = useState(0);
  const [openKey, setOpenKey] = useState("");
  const [wrapRef, wrapWidth] = useElementWidth(0);
  const table = useMemo(() => parameterTableOf(esq, missionTimeSourcesOf(esq, upstream)), [esq, upstream]);
  const label = useMemo(() => parameterLabelOf(esq, missionTimeSourcesOf(esq, upstream)), [esq, upstream]);
  const sampling = useMemo(() => samplingOf(view), [view]);
  const rows = useMemo(() => (kind === "ALL" ? view.inputs : view.inputs.filter((row) => row.input.kind === kind)), [view.inputs, kind]);
  const { current, shown } = useMemo(() => pageOf(rows, page), [rows, page]);
  const entries = useMemo(() => inputPointEntries(shown), [shown]);
  const points = useExpressionPoints(entries, table);
  const opened = useMemo(() => view.inputs.filter((row) => row.input.key === openKey), [view.inputs, openKey]);
  const moments = useMoments(opened, table, sampling);
  if (view.inputs.length === 0) return <p className="posmuted">The imported model holds no value to sample.</p>;
  return (
    <div className="esq-run">
      <div className="esq-run__composer">
        <div className="esq-run__row">
          <div className="esq-run__pickers">
            <label className="esq-run__field" htmlFor={`${fieldId}-kind`}>
              <span>Input</span>
              <select id={`${fieldId}-kind`} value={kind} onChange={(event) => { setKind(KIND_FILTERS.find((entry) => entry === event.target.value) ?? "ALL"); setPage(0); }}>
                {KIND_FILTERS.map((entry) => <option key={entry} value={entry}>{entry === "ALL" ? "Every input" : INPUT_KIND_LABELS[entry]}</option>)}
              </select>
            </label>
          </div>
          <Pager total={rows.length} page={current} onPage={setPage} />
        </div>
        <p className="esq-meta">Each input draws once per trial. Every event bound to the same DA parameter or HR event takes that one draw. Each law comes from where the value is held.</p>
      </div>
      <div className="esq-table-wrap" ref={wrapRef}>
        <table className="postable esq-rowtable" aria-label="Sampled inputs">
          <thead><tr><th className="esq-rowtable__pick">Details</th><th>Input</th><th>Point</th><th>Distribution</th></tr></thead>
          <tbody>
            {shown.map((row) => {
              const input = row.input;
              const open = input.key === openKey;
              const moment = moments.get(input.key);
              return (
                <Fragment key={input.key}>
                  <tr className={rowClass(!row.sampled, open)} onClick={() => { if (!open) setOpenKey(input.key); }}>
                    <td className="esq-rowtable__pick"><DetailToggle open={open} label={input.label} onToggle={() => setOpenKey(open ? "" : input.key)} /></td>
                    <td className="esq-rowtable__wrap">
                      <button type="button" className="esq-rowtable__name" onClick={(event) => { event.stopPropagation(); openWindow({ kind: "esqUncertInput", id: input.key }); }}>{input.label}</button>
                      {row.significant && <span className="esq-rowtable__tag">Significant</span>}
                    </td>
                    <td className="esq-rowtable__num">{inputPoint(row, points)}</td>
                    <td className="esq-rowtable__wrap">{lawCell(row, label)}</td>
                  </tr>
                  {open && (
                    <DetailRow span={4} width={wrapWidth - 18}>
                      <FieldList items={[
                        { label: "Kind", value: INPUT_KIND_LABELS[input.kind] },
                        { label: "Value", value: input.expression === undefined ? "—" : expressionText(input.expression, label) },
                        { label: "Distribution from", value: input.source === undefined ? "—" : SOURCE_LABELS[input.source] ?? input.source },
                        { label: "Mean of the distribution", value: row.sampled ? valueText(moment?.mean) : "—" },
                        { label: "Used by", value: `${input.users.length} model items` },
                        { label: "Two shared copies raise the mean", value: ratioText(raiseOf(moment)) },
                        { label: "Unit", value: unitText(input.unit) },
                        { label: "Missing", value: input.missing ?? "—" },
                      ]} />
                    </DetailRow>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CorrelationPanel({ view }: { view: EsqUncertaintyView }): JSX.Element {
  const { esq, upstream } = useEsqWorkbook();
  const sampling = useSampling(view);
  const [page, setPage] = useState(0);
  const run = view.run;
  const independent = view.independent;
  const table = useMemo(() => parameterTableOf(esq, missionTimeSourcesOf(esq, upstream)), [esq, upstream]);
  const settings = useMemo(() => samplingOf(view), [view]);
  const { current, shown } = useMemo(() => pageOf(view.shared, page), [view.shared, page]);
  const moments = useMoments(shown, table, settings);
  const compared = view.families.filter((family) => family.stats !== undefined && family.independent !== undefined);
  return (
    <div className="esq-run">
      <p className="esq-meta">A cut set that holds n events sharing one draw has the mean E[λ]ⁿ·exp(n(n−1)σ²/2) for a lognormal, not E[λ]ⁿ. Sharing the draw is the state-of-knowledge correlation.</p>
      {view.shared.length === 0 ? (
        <p className="posmuted">No sampled input is used by more than one model item.</p>
      ) : (
        <>
          <div className="esq-bar">
            <p className="esq-meta">{`${view.shared.length} inputs are shared by several model items.`}</p>
            <Pager total={view.shared.length} page={current} onPage={setPage} />
          </div>
          <div className="esq-table-wrap">
            <table className="postable esq-rowtable" aria-label="Shared inputs">
              <thead><tr><th>Input</th><th>Items</th><th>Two copies raise</th></tr></thead>
              <tbody>
                {shown.map((row) => (
                  <tr key={row.input.key}>
                    <td className="esq-rowtable__wrap">{row.input.label}</td>
                    <td className="esq-rowtable__num">{String(row.input.users.length)}</td>
                    <td className="esq-rowtable__num">{ratioText(raiseOf(moments.get(row.input.key)))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <div className="esq-run__composer" aria-label="Comparison controls">
        <div className="esq-run__row">
          <p className="esq-meta">{run === undefined ? "Run the shared sampling in the Runs tab first." : `PRAXIS repeats the run of record sampling with ${run.trials} trials, seed ${run.seed} and ${METHOD_LABELS[run.method].toLowerCase()} sampling, but each event draws on its own.`}</p>
          <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" disabled={sampling.disabled || run === undefined} onClick={() => { if (run !== undefined) sampling.sample({ trials: run.trials, seed: run.seed, method: run.method }, "INDEPENDENT"); }}>
            {sampling.runner.running ? "Running…" : "Run without sharing"}
          </button>
        </div>
      </div>
      <RunState runner={sampling.runner} model={view.model} blocked={sampling.blocked} />
      {independent !== undefined && <p className="esq-meta">{`Compared ${dateText(independent.at)}.${view.independentStale ? " The inputs changed since, so run it again." : ""}`}</p>}
      {compared.length > 0 && (
        <div className="esq-table-wrap">
          <table className="postable esq-rowtable" aria-label="Shared and independent means">
            <thead><tr><th>Family</th><th>Shared mean (/yr)</th><th>Independent mean (/yr)</th><th>Ratio</th></tr></thead>
            <tbody>
              {compared.map((family) => (
                <tr key={family.familyId}>
                  <td className="esq-rowtable__text">{familyName(view, family.familyId)}</td>
                  <td className="esq-rowtable__num">{valueText(family.stats?.mean)}</td>
                  <td className="esq-rowtable__num">{valueText(family.independent?.mean)}</td>
                  <td className="esq-rowtable__num">{ratioText(family.stats !== undefined && family.independent !== undefined && family.independent.mean > 0 ? family.stats.mean / family.independent.mean : undefined)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function useUncertaintyResult(workbookId: string | null, runId: string | undefined): { result?: EsqUncertaintyRunResult; error?: string } {
  const [state, setState] = useState<{ runId: string; result?: EsqUncertaintyRunResult; error?: string } | null>(null);
  useEffect(() => {
    if (workbookId === null || runId === undefined) {
      setState(null);
      return;
    }
    let cancelled = false;
    getEsqUncertaintyResult(workbookId, runId)
      .then((result) => { if (!cancelled) setState({ runId, result }); })
      .catch((caught: Error) => { if (!cancelled) setState({ runId, error: caught.message }); });
    return () => { cancelled = true; };
  }, [workbookId, runId]);
  if (state === null || state.runId !== runId) return {};
  return state;
}

function KeysTable({ result }: { result: EsqUncertaintyRunResult }): JSX.Element {
  const { esq } = useEsqWorkbook();
  const [page, setPage] = useState(0);
  const label = useMemo(() => parameterLabelOf(esq), [esq]);
  const { current, shown } = pageOf(result.keys, page);
  return (
    <>
      <div className="esq-bar">
        <p className="esq-meta">{`${countText(result.keys.length, "input")} drew in this run.${result.unsampled.length === 0 ? "" : ` ${countText(result.unsampled.length, "input")} stayed at their point values.`}`}</p>
        <Pager total={result.keys.length} page={current} onPage={setPage} />
      </div>
      {result.keys.length > 0 && (
        <div className="esq-table-wrap">
          <table className="postable esq-rowtable" aria-label="Sampled keys">
            <thead><tr><th>Input</th><th>Draws from</th><th>Items</th></tr></thead>
            <tbody>
              {shown.map((key) => (
                <tr key={key.key}>
                  <td className="esq-rowtable__text">{key.label}</td>
                  <td className="esq-rowtable__wrap">{`${expressionText(key.expression, label)} · ${unitText(key.unit)}`}</td>
                  <td className="esq-rowtable__num">{String(key.events)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function RunsPanel({ view }: { view: EsqUncertaintyView }): JSX.Element {
  const { runtime } = useEsqWorkbook();
  const fieldId = useId();
  const run = view.run;
  const loaded = useUncertaintyResult(runtime.workbookId, run?.runId);
  const [trials, setTrials] = useState(run?.trials ?? DEFAULT_TRIALS);
  const [seed, setSeed] = useState(run?.seed ?? DEFAULT_SEED);
  const [method, setMethod] = useState<EventTreeSamplingMethod>(run?.method ?? DEFAULT_METHOD);
  const sampling = useSampling(view);
  const problem = settingsProblem({ trials, seed, method });
  if (view.solveRun === undefined) return <p className="posmuted">No run of record yet. Run the model in Step 05 and use the run. The sampling uses its logic.</p>;
  return (
    <div className="esq-run">
      <div className="esq-run__composer" aria-label="Sampling controls">
        <div className="esq-run__row">
          <div className="esq-run__pickers">
            <label className="esq-run__field esq-run__field--small" htmlFor={`${fieldId}-trials`}>
              <span>Trials</span>
              <input id={`${fieldId}-trials`} type="number" min={100} max={20000} step={100} value={trials} onChange={(event) => setTrials(Math.round(Number(event.target.value)))} />
            </label>
            <label className="esq-run__field esq-run__field--small" htmlFor={`${fieldId}-seed`}>
              <span>Seed</span>
              <input id={`${fieldId}-seed`} type="number" min={0} step={1} value={seed} onChange={(event) => setSeed(Math.round(Number(event.target.value)))} />
            </label>
            <label className="esq-run__field" htmlFor={`${fieldId}-method`}>
              <span>Sampling</span>
              <select id={`${fieldId}-method`} value={method} onChange={(event) => setMethod(METHODS.find((entry) => entry === event.target.value) ?? DEFAULT_METHOD)}>
                {METHODS.map((entry) => <option key={entry} value={entry}>{METHOD_LABELS[entry]}</option>)}
              </select>
            </label>
          </div>
          <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" disabled={sampling.disabled || problem !== undefined} onClick={() => sampling.sample({ trials, seed, method }, "SHARED")}>
            {sampling.runner.running ? "Sampling…" : "Sample"}
          </button>
        </div>
        <p className="esq-meta">PRAXIS draws every input once per trial, quantifies each sequence diagram of the run of record with the drawn values and sums each family trial by trial. The same seed gives the same trials.</p>
      </div>
      {problem !== undefined && <p className="esq-run__notice" role="status">{problem}</p>}
      <RunState runner={sampling.runner} model={view.model} blocked={sampling.blocked} />
      {run === undefined ? (
        <p className="posmuted">Not sampled yet.</p>
      ) : (
        <FieldList items={[
          { label: "Sampled", value: dateText(run.at) },
          { label: "Trials", value: String(run.trials) },
          { label: "Seed", value: String(run.seed) },
          { label: "Sampling", value: METHOD_LABELS[run.method] },
          { label: "Draws", value: run.correlation === "SHARED" ? "Shared by input" : "Independent" },
          { label: "Up to date", value: view.runStale ? "No, the inputs changed" : "Yes" },
        ]} />
      )}
      {loaded.error !== undefined && <p className="esq-run__error" role="alert">{`The sampled inputs did not load. ${loaded.error}`}</p>}
      {loaded.result !== undefined && <KeysTable result={loaded.result} />}
    </div>
  );
}

function FamiliesPanel({ view }: { view: EsqUncertaintyView }): JSX.Element {
  const [openId, setOpenId] = useState("");
  const [wrapRef, wrapWidth] = useElementWidth(0);
  const run = view.run;
  if (run === undefined) return <p className="posmuted">Not sampled yet. Sample in the Runs tab.</p>;
  const rows = view.families.filter((family) => family.stats !== undefined);
  const total = run.total;
  return (
    <div className="esq-run">
      <p className="esq-meta">{`Per plant-year, from ${run.trials} trials. The release total sums the release families trial by trial. Percentiles are never added across families.`}</p>
      <div className="esq-table-wrap" ref={wrapRef}>
        <table className="postable esq-rowtable" aria-label="Family distributions">
          <thead><tr><th className="esq-rowtable__pick">Details</th><th>Family</th><th>Mean</th><th>5th</th><th>Median</th><th>95th</th></tr></thead>
          <tbody>
            {rows.map((family) => {
              const stats = family.stats;
              if (stats === undefined) return null;
              const open = family.familyId === openId;
              const errors = standardErrors(stats);
              return (
                <Fragment key={family.familyId}>
                  <tr className={rowClass(false, open)} onClick={() => { if (!open) setOpenId(family.familyId); }}>
                    <td className="esq-rowtable__pick"><DetailToggle open={open} label={family.familyId} onToggle={() => setOpenId(open ? "" : family.familyId)} /></td>
                    <td className="esq-rowtable__text">
                      {familyName(view, family.familyId)}
                      {family.release && <span className="esq-rowtable__tag">Release</span>}
                    </td>
                    <td className="esq-rowtable__num">{sciText(stats.mean)}</td>
                    <td className="esq-rowtable__num">{sciText(stats.p05)}</td>
                    <td className="esq-rowtable__num">{sciText(stats.p50)}</td>
                    <td className="esq-rowtable__num">{sciText(stats.p95)}</td>
                  </tr>
                  {open && (
                    <DetailRow span={6} width={wrapWidth - 18}>
                      <FieldList items={[
                        { label: "Point value", value: sciText(stats.point) },
                        { label: "Mean over the point", value: ratioText(stats.point > 0 ? stats.mean / stats.point : undefined) },
                        { label: "Standard deviation", value: sciText(stats.standardDeviation) },
                        { label: "Standard error of the mean", value: sciText(stats.standardError) },
                        { label: "Mean minus point, in standard errors", value: errors === undefined ? "—" : String(Number(errors.toPrecision(3))) },
                        { label: "95th over 5th", value: ratioText(stats.p05 > 0 ? stats.p95 / stats.p05 : undefined) },
                        { label: "Independent draws mean", value: valueText(family.independent?.mean) },
                      ]} />
                    </DetailRow>
                  )}
                </Fragment>
              );
            })}
          </tbody>
          {total !== undefined && (
            <tfoot>
              <tr>
                <td />
                <td className="esq-rowtable__text">Release total</td>
                <td className="esq-rowtable__num">{sciText(total.mean)}</td>
                <td className="esq-rowtable__num">{sciText(total.p05)}</td>
                <td className="esq-rowtable__num">{sciText(total.p50)}</td>
                <td className="esq-rowtable__num">{sciText(total.p95)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

function UncertScreen({ openWindow }: { openWindow: (ctx: EsqWindowContext) => void }): JSX.Element {
  const { esq } = useEsqWorkbook();
  const view = useMemo(() => uncertaintyViewOf(esq), [esq]);
  const [tab, setTab] = useState<UncertTab>("inputs");
  const tabId = useId();
  const count = (n: number): string => (view === undefined ? "" : ` (${n})`);
  const tabs: { id: UncertTab; label: string }[] = [
    { id: "inputs", label: `Inputs${count(view?.inputs.length ?? 0)}` },
    { id: "correlation", label: `Correlation${count(view?.shared.length ?? 0)}` },
    { id: "runs", label: "Runs" },
    { id: "families", label: `Families${count(view?.families.filter((family) => family.stats !== undefined).length ?? 0)}` },
    { id: "checks", label: `Checks${count(view?.findings.length ?? 0)}` },
  ];
  const head = TAB_HEADS[tab];
  return (
    <div className="esq-step">
      <EsqTabs label="Uncertainty sections" tabs={tabs} active={tab} onChange={setTab} idBase={tabId} className="esq-step__tabs" />
      <div role="tabpanel" id={`${tabId}-panel`} aria-labelledby={`${tabId}-${tab}`} tabIndex={0} className="esq-step__panel">
        <div className="poscard">
          <div className="poscard__head">
            <WorkbookSectionHeading workbook="ESQ" title={head.title} level={3} />
            <div className="esq-card-actions">
              <EsqProvenanceChip>{head.sr}</EsqProvenanceChip>
              {view?.solveRun !== undefined && (tab === "runs" || tab === "checks") && (
                <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => openWindow({ kind: "esqSolveRun", id: "run" })}>Run of record</button>
              )}
            </div>
          </div>
          {view === undefined ? (
            <p className="posmuted">Nothing is imported yet. Import the model in Step 02.</p>
          ) : tab === "inputs" ? (
            <InputsPanel view={view} openWindow={openWindow} />
          ) : tab === "correlation" ? (
            <CorrelationPanel view={view} />
          ) : tab === "runs" ? (
            <RunsPanel view={view} />
          ) : tab === "families" ? (
            <FamiliesPanel view={view} />
          ) : (
            <FindingsTable label="Uncertainty checks" findings={view.findings} openWindow={openWindow} />
          )}
        </div>
      </div>
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
