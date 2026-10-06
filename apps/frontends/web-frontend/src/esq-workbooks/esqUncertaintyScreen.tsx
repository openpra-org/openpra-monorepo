import { Fragment, JSX, useId, useMemo, useState } from "react";
import type { EsqSampledInput } from "interfaces-mef-types/esq/esq-measure-inputs";
import type { EsqUncertaintyCorrelation, EventTreeSamplingMethod } from "interfaces-shared-types/newly-developed-methods/event-tree";
import { WorkbookSectionHeading } from "../workbooks/workbookSectionHeading";
import { WorkbookInput, WorkbookTextarea } from "../workbooks/commitOnDeactivateFields";
import { analysisSaveBlock } from "../newly-developed-methods/shared/useAnalysisScope";
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
  rowClass,
  sciText,
  useElementWidth,
  useRunner,
} from "./esqShared";
import { Pager, pageOf, type EsqWindowContext } from "./esqModelScreen";
import { runLogicOf } from "./esqResults";
import {
  DEFAULT_METHOD,
  DEFAULT_SEED,
  DEFAULT_TRIALS,
  INPUT_KIND_LABELS,
  METHOD_LABELS,
  SOURCE_LABELS,
  lawText,
  standardErrors,
  uncertaintyRunProblem,
  uncertaintyViewOf,
  uncertaintyWorkOf,
  withSpread,
  withUncertaintyRun,
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
  const fieldId = useId();
  const [kind, setKind] = useState<"ALL" | EsqSampledInput["kind"]>("ALL");
  const [page, setPage] = useState(0);
  const [openKey, setOpenKey] = useState("");
  const [wrapRef, wrapWidth] = useElementWidth(0);
  const rows = kind === "ALL" ? view.inputs : view.inputs.filter((row) => row.input.kind === kind);
  const { current, shown } = pageOf(rows, page);
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
        <p className="esq-meta">Each input draws once per trial. Every event bound to the same DA parameter takes that one draw. A typed error factor gives a lognormal whose mean is the point value.</p>
      </div>
      <div className="esq-table-wrap" ref={wrapRef}>
        <table className="postable esq-rowtable" aria-label="Sampled inputs">
          <thead><tr><th className="esq-rowtable__pick">Details</th><th>Input</th><th>Point</th><th>Distribution</th></tr></thead>
          <tbody>
            {shown.map((row) => {
              const input = row.input;
              const open = input.key === openKey;
              return (
                <Fragment key={input.key}>
                  <tr className={rowClass(input.law === undefined, open)} onClick={() => { if (!open) setOpenKey(input.key); }}>
                    <td className="esq-rowtable__pick"><DetailToggle open={open} label={input.label} onToggle={() => setOpenKey(open ? "" : input.key)} /></td>
                    <td className="esq-rowtable__wrap">
                      <button type="button" className="esq-rowtable__name" onClick={(event) => { event.stopPropagation(); openWindow({ kind: "esqUncertInput", id: input.key }); }}>{input.label}</button>
                      {row.significant && <span className="esq-rowtable__tag">Significant</span>}
                    </td>
                    <td className="esq-rowtable__num">{valueText(input.point)}</td>
                    <td className="esq-rowtable__wrap">{input.law === undefined ? "None, fixed at the point" : lawText(input.law)}</td>
                  </tr>
                  {open && (
                    <DetailRow span={4} width={wrapWidth - 18}>
                      <FieldList items={[
                        { label: "Kind", value: INPUT_KIND_LABELS[input.kind] },
                        { label: "Distribution from", value: input.source === undefined ? "—" : SOURCE_LABELS[input.source] ?? input.source },
                        { label: "Mean of the distribution", value: valueText(row.mean) },
                        { label: "Used by", value: `${input.users.length} model items` },
                        { label: "Two shared copies raise the mean", value: ratioText(row.raise) },
                        { label: "Unit", value: input.rate ? "Rate or frequency" : "Probability" },
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
  const sampling = useSampling(view);
  const [page, setPage] = useState(0);
  const run = view.run;
  const independent = view.independent;
  const { current, shown } = pageOf(view.shared, page);
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
                    <td className="esq-rowtable__num">{ratioText(row.raise)}</td>
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

function RunsPanel({ view }: { view: EsqUncertaintyView }): JSX.Element {
  const fieldId = useId();
  const run = view.run;
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
              const errors = standardErrors(stats, run.trials);
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
                        { label: "Standard error of the mean", value: sciText(stats.standardDeviation / Math.sqrt(run.trials)) },
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
  const { esq, editable, mutateEsq } = useEsqWorkbook();
  const fieldId = useId();
  const view = uncertaintyViewOf(esq);
  const row = view?.inputs.find((candidate) => candidate.input.key === id);
  if (row === undefined) return null;
  const input = row.input;
  const spread = uncertaintyWorkOf(esq).spreads?.find((entry) => entry.key === id);
  const typedLaw = input.law === undefined || input.source === "TYPED";
  const dis = !editable;
  const sourceId = `${fieldId}-source`;
  return (
    <>
      <ModalHead cap={`Sampled input · ${INPUT_KIND_LABELS[input.kind]} · ESQ-E2`} title={input.label} onClose={onClose} />
      <div className="modal__body esq-form">
        <FormRow label="Point value"><span className="esq-form__unit">{valueText(input.point)}</span></FormRow>
        <FormRow label="Distribution"><span className="esq-form__unit">{input.law === undefined ? input.missing ?? "None" : `${lawText(input.law)} · ${input.source === undefined ? "" : SOURCE_LABELS[input.source] ?? input.source}`}</span></FormRow>
        {!typedLaw && <FormRow label="Change it"><span className="esq-form__unit">{input.source === "DA" ? "Change the distribution in DA and import again in Step 02." : input.source === "IE" ? "Change the frequency distribution in IE and import again." : "Change it in the step that holds it."}</span></FormRow>}
        {typedLaw && (
          <fieldset className="esq-use">
            <legend className="esq-use__legend">Typed spread</legend>
            <FormRow label="Error factor" htmlFor={`${fieldId}-ef`}>
              <WorkbookInput id={`${fieldId}-ef`} type="number" className="posfield__input esq-form__number" value={spread?.errorFactor ?? ""} disabled={dis || input.point === undefined || !(input.point > 0)} onChange={(event) => {
                if (!editable) return;
                const text = event.target.value.trim();
                const value = Number(text);
                if (text.length === 0) {
                  mutateEsq((draft) => withSpread(draft, id, undefined));
                  return;
                }
                if (Number.isFinite(value) && value >= 1) mutateEsq((draft) => withSpread(draft, id, { key: id, errorFactor: value, source: spread?.source ?? "" }));
              }} />
              <span className="esq-form__unit">95th over median, lognormal with the point value as its mean</span>
            </FormRow>
            {spread !== undefined && (
              <FormRow label="Source" htmlFor={sourceId} top>
                <WorkbookTextarea id={sourceId} className="posfield__textarea" rows={2} fitContent value={spread.source} disabled={dis} onChange={(event) => { if (editable) mutateEsq((draft) => withSpread(draft, id, { ...spread, source: event.target.value })); }} />
              </FormRow>
            )}
          </fieldset>
        )}
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
