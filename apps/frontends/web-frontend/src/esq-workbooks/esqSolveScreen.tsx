import { Fragment, JSX, useEffect, useId, useMemo, useState } from "react";
import type { EsqFamilySolve, EsqModel, EsqSolveRun } from "interfaces-mef-types/esq/event-sequence-quantification";
import type {
  EsqEventTreeRunLogic,
  EsqModelRunResult,
  EsqRunLoopOption,
  EventTreeCutOffBasis,
  EventTreeCutSetQuantifier,
  EventTreeCutSetSettings,
} from "interfaces-shared-types/newly-developed-methods/event-tree";
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
  FormFoot,
  FormRow,
  ModalHead,
  rowClass,
  sciText,
  useElementWidth,
} from "./esqShared";
import { MODEL_AS_SET, runLogicText } from "./esqLogic";
import { END_STATE_LABELS } from "./esqViewData";
import {
  BASIS_LABELS,
  CALCULATION_LABELS,
  QUANTIFIER_LABELS,
  SOURCE_LABELS,
  convergenceOf,
  cutOffsFrom,
  lastChange,
  pctText,
  runConvergenceOf,
  solveViewOf,
  summaryProblem,
  withFamilySolve,
  withRareEventReason,
  withRunOfRecord,
  type EsqConvergence,
  type EsqSolveFamilyView,
  type EsqSolveFinding,
  type EsqSolveView,
  type EsqSolveWindowKind,
} from "./esqSolve";
import { getEsqModelRunResult, listEsqModelRuns, runEsqModel, type EsqModelRunEntry } from "./esqWorkbookApi";
import { EsqEventTreeHclWorkspace } from "./esqEventTreeHclWorkspace";
import { Pager, pageOf, type EsqWindowContext } from "./esqModelScreen";

type SolveTab = "runs" | "families" | "sequences" | "cutsets" | "convergence" | "verification" | "checks";

type RunChoice = "EXACT" | "CUT_SETS" | "HYBRID";

const TAB_HEADS: Record<SolveTab, { title: string; sr: string }> = {
  runs: { title: "Model runs", sr: "ESQ-A4 · ESQ-A6 · ESQ-B4" },
  families: { title: "Family values of record", sr: "ESQ-A4 · ESQ-A5" },
  sequences: { title: "Sequence frequencies", sr: "ESQ-A4" },
  cutsets: { title: "Family cut sets", sr: "ESQ-A6 · ESQ-B2" },
  convergence: { title: "Truncation convergence", sr: "ESQ-B2 · ESQ-B3 · ESQ-N-4" },
  verification: { title: "Verification", sr: "ESQ-B1" },
  checks: { title: "Solve checks", sr: "ESQ-B1 to ESQ-B4 · ESQ-N-5" },
};

const SEVERITY_TEXT: Record<EsqSolveFinding["severity"], string> = { error: "Error", warning: "Warning", note: "Note" };

const SOLVE_WINDOW_KINDS: ReadonlySet<string> = new Set<EsqSolveWindowKind>(["esqSolveFamily", "esqSolveRun"]);

const SOLVE_WINDOW_LABELS: Record<EsqSolveWindowKind, string> = { esqSolveFamily: "Family value", esqSolveRun: "Run of record" };

const RUN_OPTIONS: readonly (readonly [RunChoice, string])[] = [["EXACT", "Exact"], ["CUT_SETS", "Cut sets"], ["HYBRID", "Hybrid"]];

const BASIS_OPTIONS: readonly (readonly [EventTreeCutOffBasis, string])[] = [["FREQUENCY", "Frequency per year"], ["PROBABILITY", "Probability"]];

const QUANTIFIER_OPTIONS: readonly (readonly [EventTreeCutSetQuantifier, string])[] = [["MCUB", "Upper bound"], ["EXACT", "Exact"], ["RARE_EVENT", "Rare event"]];

const LOOP_OPTIONS: readonly (readonly [EsqRunLoopOption, string])[] = [["AS_SET", "As set"], ["TRUE", "All TRUE"], ["FALSE", "All FALSE"]];

const HIGHEST_EXPONENTS = [-1, -2, -3, -4, -5, -6, -7, -8, -9, -10, -11, -12];

const LOWEST_EXPONENTS = [-4, -5, -6, -7, -8, -9, -10, -11, -12, -13, -14, -15, -16, -17, -18, -19, -20];

function decadeText(exponent: number): string {
  return `1E${exponent}`;
}

function valueText(value: number | undefined): string {
  return value === undefined ? "—" : sciText(value);
}

function textValue(text: string | undefined): string {
  return text === undefined || text.trim().length === 0 ? "—" : text.trim();
}

function treeLabel(model: EsqModel, treeId: string): string {
  const tree = model.trees.find((candidate) => candidate.id === treeId);
  if (tree === undefined) return treeId;
  return tree.stateId === undefined ? tree.code : `${tree.code} · ${tree.stateId}`;
}

function sequenceLabel(model: EsqModel, ids: readonly string[]): string {
  return ids.map((id) => model.sequences.find((sequence) => sequence.id === id)?.code ?? id).join(" to ");
}

function eventLabel(summary: EsqModelRunResult, model: EsqModel, id: string): string {
  return summary.eventCodes[id] ?? model.events.find((event) => event.id === id)?.code ?? id;
}

function convergedText(convergence: EsqConvergence | undefined): string {
  if (convergence === undefined) return "—";
  return convergence.convergedAt === undefined ? "Not yet" : sciText(convergence.convergedAt);
}

function difference(compared: number, base: number | undefined): string {
  if (base === undefined || base === 0) return "—";
  const change = (100 * (compared - base)) / base;
  if (change === 0) return "0%";
  return `${change > 0 ? "+" : ""}${Math.abs(change) < 0.01 ? change.toExponential(1).replace("e", "E") : change.toFixed(2)}%`;
}

function Picker<T extends string>({ legend, name, value, options, onChange }: { legend: string; name: string; value: T; options: readonly (readonly [T, string])[]; onChange: (value: T) => void }): JSX.Element {
  return (
    <fieldset className="esq-run__picker">
      <legend>{legend}</legend>
      <div role="radiogroup" aria-label={legend}>
        {options.map(([option, label]) => (
          <label key={option} className={value === option ? "is-selected" : ""}>
            <input type="radio" name={name} value={option} checked={value === option} onChange={() => onChange(option)} />
            <span>{label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function useRunSummary(workbookId: string | null, runId: string | undefined): { summary?: EsqModelRunResult; error?: string } {
  const [state, setState] = useState<{ runId: string; summary?: EsqModelRunResult; error?: string } | null>(null);
  useEffect(() => {
    if (workbookId === null || runId === undefined) {
      setState(null);
      return;
    }
    let cancelled = false;
    getEsqModelRunResult(workbookId, runId)
      .then((summary) => { if (!cancelled) setState({ runId, summary }); })
      .catch((caught: Error) => { if (!cancelled) setState({ runId, error: caught.message }); });
    return () => { cancelled = true; };
  }, [workbookId, runId]);
  if (state === null || state.runId !== runId) return {};
  return state;
}

function runLabel(run: EsqModelRunEntry): string {
  const when = `${new Date(run.requestedAt).toLocaleString()} · revision ${run.revision}`;
  return run.status === "SUCCEEDED" ? when : `${when} · ${run.status.toLowerCase()}`;
}

interface ShownRun {
  runs: EsqModelRunEntry[];
  loading: boolean;
  shown?: EsqModelRunEntry;
  summary?: EsqModelRunResult;
  error?: string;
  listError?: string;
  show: (runId: string) => void;
  reload: () => void;
}

function recordEntry(record: EsqSolveRun): EsqModelRunEntry {
  return { id: record.runId, requestedAt: record.at, revision: record.revision, status: "SUCCEEDED" };
}

function useShownRun(workbookId: string | null, record: EsqSolveRun | undefined): ShownRun {
  const [listed, setListed] = useState<EsqModelRunEntry[]>([]);
  const [listLoaded, setListLoaded] = useState(false);
  const [chosenId, setChosenId] = useState("");
  const [listError, setListError] = useState<string | undefined>(undefined);
  const [reloads, setReloads] = useState(0);

  useEffect(() => {
    if (workbookId === null) {
      setListed([]);
      return;
    }
    let cancelled = false;
    listEsqModelRuns(workbookId)
      .then((loaded) => {
        if (cancelled) return;
        setListed(loaded);
        setListError(undefined);
        setListLoaded(true);
      })
      .catch((caught: Error) => {
        if (cancelled) return;
        setListError(caught.message);
        setListLoaded(true);
      });
    return () => { cancelled = true; };
  }, [workbookId, reloads]);

  const loading = workbookId !== null && !listLoaded;
  const runs = loading ? [] : record === undefined || listed.some((run) => run.id === record.runId) ? listed : [...listed, recordEntry(record)];
  const shown = runs.find((run) => run.id === chosenId) ?? runs[0];
  const { summary, error } = useRunSummary(workbookId, shown?.status === "SUCCEEDED" ? shown.id : undefined);
  const out: ShownRun = { runs, loading, show: setChosenId, reload: () => setReloads((n) => n + 1) };
  if (shown !== undefined) out.shown = shown;
  if (summary !== undefined) out.summary = summary;
  if (error !== undefined) out.error = error;
  if (listError !== undefined) out.listError = listError;
  return out;
}

function RunPicker({ view, shownRun }: { view: EsqSolveView; shownRun: ShownRun }): JSX.Element | null {
  const { esq, editable, mutateEsq } = useEsqWorkbook();
  const fieldId = useId();
  const { runs, shown, summary } = shownRun;
  if (runs.length === 0 || shown === undefined) return null;
  const recordId = view.run?.runId;
  const problem = summary === undefined ? undefined : summaryProblem(summary, esq);
  const recorded = summary !== undefined && recordId === summary.runId;

  function keepAsRecord(): void {
    if (!editable || summary === undefined || problem !== undefined) return;
    mutateEsq((draft) => withRunOfRecord(draft, summary));
  }

  return (
    <>
      <div className="esq-bar">
        <label className="posfield__label" htmlFor={`${fieldId}-shown`}>Result</label>
        <select id={`${fieldId}-shown`} className="posfield__select" value={shown.id} onChange={(event) => shownRun.show(event.target.value)}>
          {runs.map((candidate) => <option key={candidate.id} value={candidate.id}>{`${runLabel(candidate)}${candidate.id === recordId ? " · of record" : ""}`}</option>)}
        </select>
        {editable && summary !== undefined && (
          <button type="button" className="posnav__btn posnav__btn--sm" disabled={recorded || problem !== undefined} onClick={keepAsRecord}>{recorded ? "Values of record" : "Use as values of record"}</button>
        )}
      </div>
      {problem !== undefined && !recorded && <p className="esq-run__notice" role="status">{problem}</p>}
    </>
  );
}

function ShownRunBody({ shownRun, empty, children }: { shownRun: ShownRun; empty: string; children: (summary: EsqModelRunResult) => JSX.Element }): JSX.Element {
  const { runtime } = useEsqWorkbook();
  const { shown, summary, error } = shownRun;
  if (shown === undefined) return <p className="posmuted">{runtime.workbookId === null ? "Runs are kept with a saved workbook." : shownRun.loading ? "Loading the runs…" : empty}</p>;
  if (shown.status !== "SUCCEEDED") return <p className="esq-run__error" role="alert">{shown.failure ?? "This run did not finish."}</p>;
  if (error !== undefined) return <p className="esq-run__error" role="alert">{error}</p>;
  if (summary === undefined) return <p className="posmuted">Loading the run…</p>;
  return children(summary);
}

function settingsText(summary: EsqModelRunResult): string {
  const settings = summary.cutSets;
  if (settings === null) return `${CALCULATION_LABELS[summary.calculation]} · ${runLogicText(summary.logic)}`;
  const first = settings.cutOffs[0];
  const last = settings.cutOffs[settings.cutOffs.length - 1];
  const range = first === undefined || last === undefined ? "" : ` · cutoffs ${sciText(first)} to ${sciText(last)}${settings.basis === "FREQUENCY" ? " per year" : ""}`;
  return `${CALCULATION_LABELS[summary.calculation]} · ${QUANTIFIER_LABELS[settings.quantifier].toLowerCase()}${range} · ${runLogicText(summary.logic)}`;
}

function RunSummary({ summary, view }: { summary: EsqModelRunResult; view: EsqSolveView }): JSX.Element {
  const failed = summary.trees.filter((tree) => tree.status === "FAILED");
  const solved = summary.trees.length - failed.length;
  const endStates = summary.endStates.map((entry) => `${END_STATE_LABELS[entry.endState] ?? entry.endState} ${sciText(entry.annualFrequency)}`);
  const stepPercent = view.stepPercent;
  const names = new Map(view.families.map((family) => [family.id, family.name]));
  return (
    <>
      <p className="esq-meta">{`Solved ${solved} of ${summary.trees.length} event trees. ${settingsText(summary)}.${endStates.length === 0 ? "" : ` ${endStates.join(" · ")} per year.`}`}</p>
      {failed.length > 0 && (
        <table className="postable esq-rowtable" aria-label="Failed event trees">
          <thead><tr><th>Event tree</th><th>Why it failed</th></tr></thead>
          <tbody>
            {failed.map((tree) => (
              <tr key={tree.treeId}>
                <td className="esq-rowtable__text">{treeLabel(view.model, tree.treeId)}</td>
                <td className="esq-rowtable__wrap">{tree.failure ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <table className="postable esq-rowtable esq-run__families" aria-label="Family frequencies of this run">
        <thead>
          <tr><th>Family</th><th>Frequency (/yr)</th><th>Sequences</th>{summary.calculation === "CUT_SETS" && <><th>Cut sets</th><th>Converged at</th></>}</tr>
        </thead>
        <tbody>
          {summary.families.map((family) => {
            const convergence = summary.calculation === "CUT_SETS" ? convergedText(convergenceOf(family.sweep, stepPercent)) : undefined;
            return (
              <tr key={family.familyId}>
                <td className="esq-rowtable__text">{names.get(family.familyId) === undefined || names.get(family.familyId) === "" ? family.familyId : `${family.familyId} · ${names.get(family.familyId)}`}</td>
                <td className="esq-rowtable__num">{sciText(family.annualFrequency)}</td>
                <td className="esq-rowtable__num">{family.sequenceCount}</td>
                {summary.calculation === "CUT_SETS" && <><td className="esq-rowtable__num">{family.cutSetCount ?? "—"}</td><td className="esq-rowtable__num">{convergence}</td></>}
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}

function RunsPanel({ view, shownRun }: { view: EsqSolveView; shownRun: ShownRun }): JSX.Element {
  const { editable, runtime } = useEsqWorkbook();
  const fieldId = useId();
  const [choice, setChoice] = useState<RunChoice>("CUT_SETS");
  const [logic, setLogic] = useState<EsqEventTreeRunLogic>(MODEL_AS_SET);
  const [basis, setBasis] = useState<EventTreeCutOffBasis>("FREQUENCY");
  const [quantifier, setQuantifier] = useState<EventTreeCutSetQuantifier>("MCUB");
  const [highest, setHighest] = useState(-6);
  const [lowest, setLowest] = useState(-14);
  const [keep, setKeep] = useState(100);
  const [limitOrder, setLimitOrder] = useState<number | undefined>(undefined);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const saveBlockedReason = analysisSaveBlock(runtime);
  const workbookId = runtime.workbookId;
  const settingsProblem = choice !== "CUT_SETS" ? undefined
    : lowest >= highest ? "The lowest cutoff must be below the highest."
    : !(keep >= 1 && keep <= 1000) ? "Keep between 1 and 1000 cut sets."
    : undefined;

  function run(): void {
    if (workbookId === null || runtime.revision === null || choice === "HYBRID" || settingsProblem !== undefined) return;
    const cutSets: EventTreeCutSetSettings | undefined = choice === "CUT_SETS"
      ? { basis, cutOffs: cutOffsFrom(highest, lowest), quantifier, keep, ...(limitOrder === undefined ? {} : { limitOrder }) }
      : undefined;
    setRunning(true);
    setError(null);
    runEsqModel(workbookId, runtime.revision, logic, choice, cutSets)
      .then((response) => {
        shownRun.show(response.run.id);
        shownRun.reload();
      })
      .catch((caught: Error) => setError(caught.message))
      .finally(() => setRunning(false));
  }

  const listError = shownRun.runs.length === 0 ? shownRun.listError : undefined;

  return (
    <div className="esq-run">
      <div className="esq-run__composer" aria-label="Model run controls">
        <div className="esq-run__row">
          <Picker legend="Calculation" name={`${fieldId}-calculation`} value={choice} options={RUN_OPTIONS} onChange={setChoice} />
          {choice !== "HYBRID" && (
            <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" disabled={running || !editable || saveBlockedReason !== null || settingsProblem !== undefined} onClick={run}>
              {running ? "Running…" : "Run model"}
            </button>
          )}
        </div>
        {choice !== "HYBRID" && (
          <div className="esq-run__pickers">
            <Picker legend="Flags" name={`${fieldId}-flags`} value={logic.flags ? "on" : "off"} options={[["on", "As set"], ["off", "Off"]]} onChange={(value) => setLogic({ ...logic, flags: value === "on" })} />
            <Picker legend="Loop breaks" name={`${fieldId}-loops`} value={logic.loopBreaks} options={LOOP_OPTIONS} onChange={(loopBreaks) => setLogic({ ...logic, loopBreaks })} />
            <Picker legend="Exclusions" name={`${fieldId}-exclusions`} value={logic.exclusions ? "on" : "off"} options={[["on", "As set"], ["off", "Off"]]} onChange={(value) => setLogic({ ...logic, exclusions: value === "on" })} />
            <Picker legend="Common cause" name={`${fieldId}-ccf`} value={logic.expandCcf ? "on" : "off"} options={[["on", "Expanded"], ["off", "Off"]]} onChange={(value) => setLogic({ ...logic, expandCcf: value === "on" })} />
            <Picker legend="Recovery" name={`${fieldId}-recovery`} value={logic.recovery === false ? "off" : "on"} options={[["on", "As set"], ["off", "Off"]]} onChange={(value) => setLogic({ ...logic, recovery: value === "on" })} />
            <Picker legend="HFE dependency" name={`${fieldId}-dependency`} value={logic.dependency === false ? "off" : "on"} options={[["on", "As set"], ["off", "Off"]]} onChange={(value) => setLogic({ ...logic, dependency: value === "on" })} />
          </div>
        )}
        {choice === "CUT_SETS" && (
          <div className="esq-run__pickers">
            <Picker legend="Cutoff on" name={`${fieldId}-basis`} value={basis} options={BASIS_OPTIONS} onChange={setBasis} />
            <Picker legend="Quantifier" name={`${fieldId}-quantifier`} value={quantifier} options={QUANTIFIER_OPTIONS} onChange={setQuantifier} />
            <label className="esq-run__field esq-run__field--small" htmlFor={`${fieldId}-highest`}>
              <span>Highest cutoff</span>
              <select id={`${fieldId}-highest`} value={highest} onChange={(event) => setHighest(Number(event.target.value))}>
                {HIGHEST_EXPONENTS.map((exponent) => <option key={exponent} value={exponent}>{decadeText(exponent)}</option>)}
              </select>
            </label>
            <label className="esq-run__field esq-run__field--small" htmlFor={`${fieldId}-lowest`}>
              <span>Lowest cutoff</span>
              <select id={`${fieldId}-lowest`} value={lowest} onChange={(event) => setLowest(Number(event.target.value))}>
                {LOWEST_EXPONENTS.map((exponent) => <option key={exponent} value={exponent}>{decadeText(exponent)}</option>)}
              </select>
            </label>
            <label className="esq-run__field esq-run__field--small" htmlFor={`${fieldId}-keep`}>
              <span>Cut sets kept</span>
              <input id={`${fieldId}-keep`} type="number" min={1} max={1000} step={1} value={keep} onChange={(event) => setKeep(Math.round(Number(event.target.value)))} />
            </label>
            <label className="esq-run__field esq-run__field--small" htmlFor={`${fieldId}-order`}>
              <span>Order limit</span>
              <input id={`${fieldId}-order`} type="number" min={1} step={1} value={limitOrder ?? ""} placeholder="None" onChange={(event) => {
                const value = Math.round(Number(event.target.value));
                setLimitOrder(event.target.value.trim().length === 0 || !(value >= 1) ? undefined : value);
              }} />
            </label>
          </div>
        )}
        {choice === "CUT_SETS" && settingsProblem === undefined && (
          <p className="esq-meta">{`The run lowers the cutoff one decade at a time from ${decadeText(highest)} to ${decadeText(lowest)}${basis === "FREQUENCY" ? " per year" : ""}, ${highest - lowest + 1} cutoffs from one generation of the cut sets.`}</p>
        )}
      </div>
      {choice === "HYBRID" ? (
        <EsqEventTreeHclWorkspace mode="RUNS" />
      ) : (
        <>
          {settingsProblem !== undefined && <p className="esq-run__notice" role="status">{settingsProblem}</p>}
          {saveBlockedReason !== null && <p className="esq-run__notice" role="status">{saveBlockedReason}</p>}
          {error !== null && <p className="esq-run__error" role="alert">{error}</p>}
          {listError !== undefined && <p className="esq-run__error" role="alert">{listError}</p>}
          <RunPicker view={view} shownRun={shownRun} />
          <div className="esq-table-wrap">
            <ShownRunBody shownRun={shownRun} empty="No model run yet.">
              {(summary) => <RunSummary summary={summary} view={view} />}
            </ShownRunBody>
          </div>
        </>
      )}
    </div>
  );
}

function FamiliesTable({ view, openWindow }: { view: EsqSolveView; openWindow: (ctx: EsqWindowContext) => void }): JSX.Element {
  const [openId, setOpenId] = useState("");
  const [wrapRef, wrapWidth] = useElementWidth(0);
  if (view.families.length === 0) return <p className="posmuted">The Step 02 import holds no family.</p>;
  return (
    <div className="esq-table-wrap" ref={wrapRef}>
      <table className="postable esq-rowtable" aria-label="Family values of record">
        <thead>
          <tr><th className="esq-rowtable__pick">Details</th><th>Family</th><th>Value (/yr)</th><th>From</th><th>Sequences</th></tr>
        </thead>
        <tbody>
          {view.families.map((family) => {
            const open = family.id === openId;
            const solve = family.solve;
            return (
              <Fragment key={family.id}>
                <tr className={rowClass(!family.needsValue, open)} onClick={() => { if (!open) setOpenId(family.id); }}>
                  <td className="esq-rowtable__pick"><DetailToggle open={open} label={family.id} onToggle={() => setOpenId(open ? "" : family.id)} /></td>
                  <td className="esq-rowtable__text">
                    <button type="button" className="esq-rowtable__name" onClick={(event) => { event.stopPropagation(); openWindow({ kind: "esqSolveFamily", id: family.id }); }}>{family.id}</button>
                    {family.family.manual && <span className="esq-rowtable__tag">By hand</span>}
                  </td>
                  <td className="esq-rowtable__num">{valueText(family.value)}</td>
                  <td className="esq-rowtable__text">{family.source === undefined ? "Not chosen" : SOURCE_LABELS[family.source]}</td>
                  <td className="esq-rowtable__num">{family.family.members.length}</td>
                </tr>
                {open && (
                  <DetailRow span={5} width={wrapWidth - 18}>
                    <FieldList items={[
                      { label: "Name", value: textValue(family.name) },
                      { label: "End state", value: family.family.endState === undefined ? "—" : END_STATE_LABELS[family.family.endState] ?? family.family.endState },
                      { label: "Release category", value: family.family.releaseCategoryId ?? "—" },
                      { label: "PRAXIS run", value: valueText(solve?.run?.annualFrequency) },
                      { label: "Typed", value: solve?.typed === undefined ? "—" : `${sciText(solve.typed.annualFrequency)} · ${textValue(solve.typed.source)}` },
                      { label: "Imported", value: valueText(solve?.imported?.annualFrequency) },
                      { label: "ES estimate", value: valueText(family.esFrequency) },
                      { label: "By state", value: family.states.length === 0 ? "—" : family.states.map((state) => `${state.stateId} ${sciText(state.annualFrequency)}`).join(", ") },
                      { label: "Reason", value: textValue(solve?.reason) },
                    ]} />
                  </DetailRow>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

interface RunFilters {
  family: string;
  state: string;
  cutSetFamily: string;
}

function SequencesPanel({ view, summary, filters, onFilters }: { view: EsqSolveView; summary: EsqModelRunResult; filters: RunFilters; onFilters: (next: RunFilters) => void }): JSX.Element {
  const { family, state } = filters;
  const [page, setPage] = useState(0);
  const [openKey, setOpenKey] = useState("");
  const [wrapRef, wrapWidth] = useElementWidth(0);
  const filterId = useId();
  const stateOf = useMemo(() => new Map(view.model.trees.map((tree) => [tree.id, tree.stateId])), [view.model]);
  const initiatorOf = useMemo(() => new Map(summary.trees.map((tree) => [tree.treeId, tree.initiatorFrequency])), [summary]);
  const states = [...new Set(summary.sequences.flatMap((sequence) => {
    const stateId = stateOf.get(sequence.treeId);
    return stateId === undefined ? [] : [stateId];
  }))].sort();
  const families = [...new Set(summary.sequences.flatMap((sequence) => (sequence.familyId === null ? [] : [sequence.familyId])))].sort();
  const rows = summary.sequences
    .map((sequence, index) => ({ sequence, key: `${sequence.treeId}:${sequence.sequenceIds.join(">")}:${index}` }))
    .filter(({ sequence }) => (family === "" || sequence.familyId === family) && (state === "" || stateOf.get(sequence.treeId) === state));
  const { current, shown } = pageOf(rows, page);
  return (
    <>
      <div className="esq-bar">
        <label className="posfield__label" htmlFor={`${filterId}-family`}>Family</label>
        <select id={`${filterId}-family`} className="posfield__select" value={family} onChange={(event) => { onFilters({ ...filters, family: event.target.value }); setPage(0); }}>
          <option value="">All families</option>
          {families.map((id) => <option key={id} value={id}>{id}</option>)}
        </select>
        <label className="posfield__label" htmlFor={`${filterId}-state`}>State</label>
        <select id={`${filterId}-state`} className="posfield__select" value={state} onChange={(event) => { onFilters({ ...filters, state: event.target.value }); setPage(0); }}>
          <option value="">All states</option>
          {states.map((id) => <option key={id} value={id}>{id}</option>)}
        </select>
        <Pager total={rows.length} page={current} onPage={setPage} />
      </div>
      <div className="esq-table-wrap" ref={wrapRef}>
        <table className="postable esq-rowtable" aria-label="Sequence frequencies">
          <thead>
            <tr><th className="esq-rowtable__pick">Details</th><th>Sequence</th><th>Tree</th><th>Family</th><th>Frequency (/yr)</th></tr>
          </thead>
          <tbody>
            {shown.map(({ sequence, key }) => {
              const open = key === openKey;
              const code = sequenceLabel(view.model, sequence.sequenceIds);
              return (
                <Fragment key={key}>
                  <tr className={rowClass(sequence.annualFrequency === 0, open)} onClick={() => { if (!open) setOpenKey(key); }}>
                    <td className="esq-rowtable__pick"><DetailToggle open={open} label={code} onToggle={() => setOpenKey(open ? "" : key)} /></td>
                    <td className="esq-rowtable__text">{code}</td>
                    <td className="esq-rowtable__text">{treeLabel(view.model, sequence.treeId)}</td>
                    <td className="esq-rowtable__text">{sequence.familyId ?? "—"}</td>
                    <td className="esq-rowtable__num">{sciText(sequence.annualFrequency)}</td>
                  </tr>
                  {open && (
                    <DetailRow span={5} width={wrapWidth - 18}>
                      <FieldList items={[
                        { label: "Given the initiator", value: sciText(sequence.conditionalProbability) },
                        { label: "Initiator in state (/yr)", value: valueText(initiatorOf.get(sequence.treeId) ?? undefined) },
                        { label: "End state", value: sequence.endState === null ? "—" : END_STATE_LABELS[sequence.endState] ?? sequence.endState },
                        { label: "Cut sets kept", value: sequence.cutSetCount === null ? "—" : String(sequence.cutSetCount) },
                      ]} />
                    </DetailRow>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function CutSetsPanel({ view, summary, filters, onFilters }: { view: EsqSolveView; summary: EsqModelRunResult; filters: RunFilters; onFilters: (next: RunFilters) => void }): JSX.Element {
  const fieldId = useId();
  const [page, setPage] = useState(0);
  if (summary.calculation !== "CUT_SETS") return <p className="posmuted">This run is exact, so it has no cut sets. Pick or make a cut set run to see them.</p>;
  const family = summary.families.find((candidate) => candidate.familyId === filters.cutSetFamily) ?? summary.families[0];
  if (family === undefined) return <p className="posmuted">This run holds no family.</p>;
  const { current, shown } = pageOf(family.cutSets, page);
  return (
    <>
      <div className="esq-bar">
        <label className="posfield__label" htmlFor={`${fieldId}-family`}>Family</label>
        <select id={`${fieldId}-family`} className="posfield__select" value={family.familyId} onChange={(event) => { onFilters({ ...filters, cutSetFamily: event.target.value }); setPage(0); }}>
          {summary.families.map((candidate) => <option key={candidate.familyId} value={candidate.familyId}>{candidate.familyId}</option>)}
        </select>
        <Pager total={family.cutSets.length} page={current} onPage={setPage} />
      </div>
      <p className="esq-meta">{`${family.cutSetCount ?? 0} cut sets above the lowest cutoff. The table lists the largest ${family.cutSets.length}.`}</p>
      <div className="esq-table-wrap">
        <table className="postable esq-rowtable" aria-label="Family cut sets">
          <thead><tr><th>Rank</th><th>Cut set</th><th>Tree</th><th>Frequency (/yr)</th><th>Share</th></tr></thead>
          <tbody>
            {shown.map((cutSet, index) => {
              const rank = current * 50 + index + 1;
              return (
                <tr key={`${cutSet.treeId}:${cutSet.basicEventIds.join("+")}:${rank}`}>
                  <td className="esq-rowtable__num">{rank}</td>
                  <td className="esq-rowtable__wrap">{cutSet.basicEventIds.length === 0 ? "Initiator alone" : cutSet.basicEventIds.map((id) => eventLabel(summary, view.model, id)).join(" · ")}</td>
                  <td className="esq-rowtable__text">{treeLabel(view.model, cutSet.treeId)}</td>
                  <td className="esq-rowtable__num">{sciText(cutSet.annualFrequency)}</td>
                  <td className="esq-rowtable__num">{family.annualFrequency > 0 ? pctText((100 * cutSet.annualFrequency) / family.annualFrequency) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function SweepTable({ label, sweep, convergence }: { label: string; sweep: { cutOff: number; count: number; annualFrequency: number }[]; convergence: EsqConvergence }): JSX.Element {
  return (
    <table className="postable esq-rowtable esq-solve__sweep" aria-label={label}>
      <thead><tr><th>Cutoff</th><th>Cut sets</th><th>Frequency (/yr)</th><th>Change</th></tr></thead>
      <tbody>
        {sweep.map((point, index) => (
          <tr key={point.cutOff} className={point.cutOff === convergence.convergedAt ? "esq-rowtable__row--on" : undefined}>
            <td className="esq-rowtable__num">{sciText(point.cutOff)}</td>
            <td className="esq-rowtable__num">{point.count}</td>
            <td className="esq-rowtable__num">{sciText(point.annualFrequency)}</td>
            <td className="esq-rowtable__num">{pctText(convergence.changes[index])}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ConvergencePanel({ view, summary, openWindow }: { view: EsqSolveView; summary: EsqModelRunResult; openWindow: (ctx: EsqWindowContext) => void }): JSX.Element {
  const [openId, setOpenId] = useState("");
  const [wrapRef, wrapWidth] = useElementWidth(0);
  if (summary.calculation !== "CUT_SETS") return <p className="posmuted">This run is exact, so no cutoff applies. A cut set run shows the sweep.</p>;
  const swept = runConvergenceOf(summary, view);
  if (swept.length === 0) return <p className="posmuted">This run holds no family sweep.</p>;
  return (
    <>
      <p className="esq-meta">{`A family converges where a one-decade step changes it less than the step before and by less than ${view.stepPercent}% (ESQ-N-4, set in Step 01).`}</p>
      <div className="esq-table-wrap" ref={wrapRef}>
        <table className="postable esq-rowtable" aria-label="Convergence by family">
          <thead>
            <tr><th className="esq-rowtable__pick">Details</th><th>Family</th><th>Converged at</th><th>Last change</th><th>States converged</th></tr>
          </thead>
          <tbody>
            {swept.map((family) => {
              const open = family.id === openId;
              const states = family.states.filter((state) => state.annualFrequency > 0);
              const statesDone = states.filter((state) => state.convergence.convergedAt !== undefined).length;
              return (
                <Fragment key={family.id}>
                  <tr className={rowClass(false, open)} onClick={() => { if (!open) setOpenId(family.id); }}>
                    <td className="esq-rowtable__pick"><DetailToggle open={open} label={family.id} onToggle={() => setOpenId(open ? "" : family.id)} /></td>
                    <td className="esq-rowtable__text">
                      <button type="button" className="esq-rowtable__name" onClick={(event) => { event.stopPropagation(); openWindow({ kind: "esqSolveFamily", id: family.id }); }}>{family.id}</button>
                    </td>
                    <td className="esq-rowtable__num">{convergedText(family.convergence)}</td>
                    <td className="esq-rowtable__num">{pctText(lastChange(family.convergence))}</td>
                    <td className="esq-rowtable__num">{states.length === 0 ? "—" : `${statesDone} of ${states.length}`}</td>
                  </tr>
                  {open && (
                    <DetailRow span={5} width={wrapWidth - 18}>
                      <SweepTable label={`${family.id} sweep`} sweep={family.sweep} convergence={family.convergence} />
                      {states.length > 0 && (
                        <table className="postable esq-rowtable esq-solve__sweep" aria-label={`${family.id} by operating state`}>
                          <thead><tr><th>State</th><th>Frequency (/yr)</th><th>Converged at</th><th>Last change</th></tr></thead>
                          <tbody>
                            {states.map((state) => (
                              <tr key={state.stateId}>
                                <td className="esq-rowtable__text">{state.name === state.stateId ? state.stateId : `${state.stateId} · ${state.name}`}</td>
                                <td className="esq-rowtable__num">{sciText(state.annualFrequency)}</td>
                                <td className="esq-rowtable__num">{convergedText(state.convergence)}</td>
                                <td className="esq-rowtable__num">{pctText(lastChange(state.convergence))}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </DetailRow>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function VerificationTable({ view, openWindow }: { view: EsqSolveView; openWindow: (ctx: EsqWindowContext) => void }): JSX.Element {
  const rows = view.families.flatMap((family) => {
    const solve = family.solve;
    const out: { key: string; family: EsqSolveFamilyView; value: number; from: string }[] = [];
    if (solve?.typed !== undefined) out.push({ key: `${family.id}:typed`, family, value: solve.typed.annualFrequency, from: textValue(solve.typed.source) });
    if (solve?.imported !== undefined) out.push({ key: `${family.id}:imported`, family, value: solve.imported.annualFrequency, from: "ES workbook" });
    return out;
  });
  if (rows.length === 0) return <p className="posmuted">No family has a typed or imported value yet. Open a family to add one beside its PRAXIS value.</p>;
  return (
    <div className="esq-table-wrap">
      <table className="postable esq-rowtable" aria-label="Verification">
        <thead><tr><th>Family</th><th>PRAXIS (/yr)</th><th>Compared (/yr)</th><th>From</th><th>Difference</th></tr></thead>
        <tbody>
          {rows.map((row) => {
            const base = row.family.solve?.run?.annualFrequency;
            return (
              <tr key={row.key}>
                <td className="esq-rowtable__text">
                  <button type="button" className="esq-rowtable__name" onClick={() => openWindow({ kind: "esqSolveFamily", id: row.family.id })}>{row.family.id}</button>
                </td>
                <td className="esq-rowtable__num">{valueText(base)}</td>
                <td className="esq-rowtable__num">{sciText(row.value)}</td>
                <td className="esq-rowtable__wrap">{row.from}</td>
                <td className="esq-rowtable__num">{difference(row.value, base)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ChecksTable({ findings, openWindow }: { findings: EsqSolveFinding[]; openWindow: (ctx: EsqWindowContext) => void }): JSX.Element {
  if (findings.length === 0) return <p className="posmuted">Every check passes.</p>;
  return (
    <div className="esq-table-wrap">
      <table className="postable esq-rowtable" aria-label="Solve checks">
        <thead><tr><th>Severity</th><th>Check</th><th>Item</th><th>Detail</th></tr></thead>
        <tbody>
          {findings.map((finding, index) => {
            const target = finding.target;
            return (
              <tr key={`${finding.check}:${finding.item}:${index}`}>
                <td className={`esq-severity esq-severity--${finding.severity}`}>{SEVERITY_TEXT[finding.severity]}</td>
                <td>{finding.check}</td>
                <td className="esq-rowtable__text">
                  {target === undefined ? finding.item : (
                    <button type="button" className="esq-rowtable__name" onClick={() => openWindow({ kind: target.kind, id: target.id })}>{finding.item}</button>
                  )}
                </td>
                <td className="esq-rowtable__wrap">{finding.detail}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ShownRunTab({ view, shownRun, tab, openWindow }: { view: EsqSolveView; shownRun: ShownRun; tab: "sequences" | "cutsets" | "convergence"; openWindow: (ctx: EsqWindowContext) => void }): JSX.Element {
  const [filters, setFilters] = useState<RunFilters>({ family: "", state: "", cutSetFamily: "" });
  return (
    <>
      <RunPicker view={view} shownRun={shownRun} />
      <ShownRunBody shownRun={shownRun} empty="No model run yet. Run the model in the Runs tab.">
        {(summary) => (tab === "sequences" ? <SequencesPanel view={view} summary={summary} filters={filters} onFilters={setFilters} />
          : tab === "cutsets" ? <CutSetsPanel view={view} summary={summary} filters={filters} onFilters={setFilters} />
          : <ConvergencePanel view={view} summary={summary} openWindow={openWindow} />)}
      </ShownRunBody>
    </>
  );
}

function SolveScreen({ openWindow }: { openWindow: (ctx: EsqWindowContext) => void }): JSX.Element {
  const { esq, upstream, runtime } = useEsqWorkbook();
  const view = useMemo(() => solveViewOf(esq, upstream.es), [esq, upstream.es]);
  const shownRun = useShownRun(view === undefined ? null : runtime.workbookId, view?.run);
  const [tab, setTab] = useState<SolveTab>("runs");
  const tabId = useId();
  const count = (n: number): string => (view === undefined ? "" : ` (${n})`);
  const tabs: { id: SolveTab; label: string }[] = [
    { id: "runs", label: "Runs" },
    { id: "families", label: `Families${count(view?.families.length ?? 0)}` },
    { id: "sequences", label: "Sequences" },
    { id: "cutsets", label: "Cut sets" },
    { id: "convergence", label: "Convergence" },
    { id: "verification", label: "Verification" },
    { id: "checks", label: `Checks${count(view?.findings.length ?? 0)}` },
  ];
  const head = TAB_HEADS[tab];
  return (
    <div className="esq-step">
      <EsqTabs label="Solve sections" tabs={tabs} active={tab} onChange={setTab} idBase={tabId} className="esq-step__tabs" />
      <div role="tabpanel" id={`${tabId}-panel`} aria-labelledby={`${tabId}-${tab}`} tabIndex={0} className="esq-step__panel">
        <div className="poscard">
          <div className="poscard__head">
            <WorkbookSectionHeading workbook="ESQ" title={head.title} level={3} />
            <div className="esq-card-actions">
              <EsqProvenanceChip>{head.sr}</EsqProvenanceChip>
              {view?.run !== undefined && tab === "checks" && (
                <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => openWindow({ kind: "esqSolveRun", id: "run" })}>Run of record</button>
              )}
            </div>
          </div>
          {view === undefined ? (
            <p className="posmuted">Nothing is imported yet. Import the model in Step 02.</p>
          ) : tab === "runs" ? (
            <RunsPanel view={view} shownRun={shownRun} />
          ) : tab === "families" ? (
            <FamiliesTable view={view} openWindow={openWindow} />
          ) : tab === "sequences" || tab === "cutsets" || tab === "convergence" ? (
            <ShownRunTab view={view} shownRun={shownRun} tab={tab} openWindow={openWindow} />
          ) : tab === "verification" ? (
            <VerificationTable view={view} openWindow={openWindow} />
          ) : (
            <ChecksTable findings={view.findings} openWindow={openWindow} />
          )}
        </div>
      </div>
    </div>
  );
}

function AreaRow({ label, value, disabled, onChange }: { label: string; value: string; disabled: boolean; onChange: (value: string) => void }): JSX.Element {
  const id = useId();
  return (
    <FormRow label={label} htmlFor={id} top>
      <WorkbookTextarea id={id} className="posfield__textarea" rows={2} fitContent value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} />
    </FormRow>
  );
}

function SolveFamilyWindow({ id, onClose }: { id: string; onClose: () => void }): JSX.Element | null {
  const { esq, editable, mutateEsq, upstream } = useEsqWorkbook();
  const fieldId = useId();
  const view = solveViewOf(esq, upstream.es);
  const family = view?.families.find((candidate) => candidate.id === id);
  if (view === undefined || family === undefined) return null;
  const solve: EsqFamilySolve = family.solve ?? { familyId: id };
  const dis = !editable;
  const esWorkbookId = esq.linkedWorkbooks?.ES;
  const esFrequency = family.esFrequency;

  function save(next: EsqFamilySolve): void {
    if (!editable) return;
    mutateEsq((draft) => withFamilySolve(draft, id, next));
  }

  function withoutRecord(entry: EsqFamilySolve, source: EsqFamilySolve["ofRecord"]): EsqFamilySolve {
    if (entry.ofRecord !== source) return entry;
    const { ofRecord: _old, ...rest } = entry;
    return rest;
  }

  return (
    <>
      <ModalHead cap="Family value · ESQ-A4 · ESQ-B1" title={family.name.length === 0 ? id : `${id} · ${family.name}`} onClose={onClose} />
      <div className="modal__body esq-form">
        <fieldset className="esq-use">
          <legend className="esq-use__legend">Typed value</legend>
          <FormRow label="Frequency" htmlFor={`${fieldId}-typed`}>
            <WorkbookInput id={`${fieldId}-typed`} type="number" className="posfield__input esq-form__number" value={solve.typed?.annualFrequency ?? ""} disabled={dis} onChange={(event) => {
              const text = event.target.value.trim();
              const value = Number(text);
              if (text.length === 0) {
                const { typed: _old, ...rest } = withoutRecord(solve, "TYPED");
                save(rest);
                return;
              }
              if (Number.isFinite(value) && value >= 0) save({ ...solve, typed: { annualFrequency: value, source: solve.typed?.source ?? "" } });
            }} />
            <span className="esq-form__unit">/yr</span>
          </FormRow>
          {solve.typed !== undefined && (
            <AreaRow label="Source" value={solve.typed.source} disabled={dis} onChange={(source) => { if (solve.typed !== undefined) save({ ...solve, typed: { ...solve.typed, source } }); }} />
          )}
        </fieldset>
        <fieldset className="esq-use">
          <legend className="esq-use__legend">Imported value</legend>
          <FormRow label="From ES">
            <span className="esq-form__unit">{solve.imported === undefined ? (esFrequency === undefined ? "The linked ES workbook gives no frequency for this family." : `ES gives ${sciText(esFrequency)} per year.`) : `${sciText(solve.imported.annualFrequency)} per year, imported ${new Date(solve.imported.at).toLocaleDateString()}.`}</span>
          </FormRow>
          {editable && (
            <div className="esq-form__actions">
              <button type="button" className="posnav__btn posnav__btn--sm" disabled={esFrequency === undefined || esWorkbookId === undefined} onClick={() => {
                if (esFrequency === undefined || esWorkbookId === undefined) return;
                save({ ...solve, imported: { annualFrequency: esFrequency, element: "ES", workbookId: esWorkbookId, at: new Date().toISOString() } });
              }}>{solve.imported === undefined ? "Import from ES" : "Import again"}</button>
              {solve.imported !== undefined && (
                <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => {
                  const { imported: _old, ...rest } = withoutRecord(solve, "IMPORTED");
                  save(rest);
                }}>Remove imported value</button>
              )}
            </div>
          )}
        </fieldset>
        <FormRow label="Value of record" htmlFor={`${fieldId}-record`}>
          <select id={`${fieldId}-record`} className="posfield__select" value={solve.ofRecord ?? ""} disabled={dis} onChange={(event) => {
            const value = event.target.value;
            const { ofRecord: _old, ...rest } = solve;
            save(value === "RUN" || value === "TYPED" || value === "IMPORTED" ? { ...rest, ofRecord: value } : rest);
          }}>
            <option value="">Not chosen</option>
            <option value="RUN" disabled={solve.run === undefined}>{solve.run === undefined ? "PRAXIS run, none kept yet" : `PRAXIS run · ${sciText(solve.run.annualFrequency)}`}</option>
            <option value="TYPED" disabled={solve.typed === undefined}>{solve.typed === undefined ? "Typed, none entered" : `Typed · ${sciText(solve.typed.annualFrequency)}`}</option>
            <option value="IMPORTED" disabled={solve.imported === undefined}>{solve.imported === undefined ? "Imported, none yet" : `Imported from ES · ${sciText(solve.imported.annualFrequency)}`}</option>
          </select>
        </FormRow>
        <AreaRow label="Reason" value={solve.reason ?? ""} disabled={dis} onChange={(reason) => {
          const { reason: _old, ...rest } = solve;
          save(reason.trim().length === 0 ? rest : { ...rest, reason });
        }} />
      </div>
      <FormFoot onClose={onClose} />
    </>
  );
}

function SolveRunWindow({ onClose }: { onClose: () => void }): JSX.Element | null {
  const { esq, editable, mutateEsq, upstream } = useEsqWorkbook();
  const view = solveViewOf(esq, upstream.es);
  if (view === undefined) return null;
  const run = view.run;
  const cutOffs = run?.cutOffs ?? [];
  const first = cutOffs[0];
  const last = cutOffs[cutOffs.length - 1];
  return (
    <>
      <ModalHead cap="Run of record · ESQ-B3 · ESQ-B4 · ESQ-N-5" title={run === undefined ? "No run of record" : `Run of ${new Date(run.at).toLocaleString()}`} onClose={onClose} />
      <div className="modal__body esq-form">
        {run === undefined ? (
          <p className="posmuted">Run the model in the Runs tab and use the run as the values of record.</p>
        ) : (
          <>
            <FieldList items={[
              { label: "Status", value: view.stale ? "Older than its inputs. Run again." : "Current" },
              { label: "Workbook revision", value: String(run.revision) },
              { label: "Calculation", value: run.quantifier === undefined ? CALCULATION_LABELS[run.calculation] : `${CALCULATION_LABELS[run.calculation]} · ${QUANTIFIER_LABELS[run.quantifier].toLowerCase()}` },
              { label: "Cutoffs", value: first === undefined || last === undefined ? "None" : `${sciText(first)} to ${sciText(last)} · ${run.basis === undefined ? "" : BASIS_LABELS[run.basis].toLowerCase()}` },
              { label: "Order limit", value: run.limitOrder === undefined ? "None" : String(run.limitOrder) },
              { label: "Logic", value: runLogicText(run.logic) },
              { label: "Largest sequence probability", value: valueText(run.peakProbability) },
            ]} />
            {run.quantifier === "RARE_EVENT" && (
              <AreaRow label="Rare event reason" value={view.work.rareEventReason ?? ""} disabled={!editable} onChange={(reason) => mutateEsq((draft) => withRareEventReason(draft, reason))} />
            )}
          </>
        )}
      </div>
      <FormFoot onClose={onClose} />
    </>
  );
}

function SolveWindows({ context, onClose }: { context: EsqWindowContext; onClose: () => void }): JSX.Element | null {
  switch (context.kind) {
    case "esqSolveFamily": return <SolveFamilyWindow id={context.id} onClose={onClose} />;
    case "esqSolveRun": return <SolveRunWindow onClose={onClose} />;
    default: return null;
  }
}

export { SolveScreen, SolveWindows, SOLVE_WINDOW_KINDS, SOLVE_WINDOW_LABELS };
