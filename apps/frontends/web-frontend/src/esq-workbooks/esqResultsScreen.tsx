import { Fragment, JSX, useCallback, useEffect, useId, useMemo, useState } from "react";
import type { EsqComparedPlant, EsqConsistencyTopic, EsqImportanceKind, EsqScreenedBound } from "interfaces-mef-types/esq/event-sequence-quantification";
import type { EsqImportanceEventRole, EsqImportanceRunResult, EsqModelRunResult } from "interfaces-shared-types/newly-developed-methods/event-tree";
import { WorkbookSectionHeading } from "../workbooks/workbookSectionHeading";
import { WorkbookInput, WorkbookTextarea } from "../workbooks/commitOnDeactivateFields";
import { analysisSaveBlock } from "../newly-developed-methods/shared/useAnalysisScope";
import { expressionText } from "../newly-developed-methods/shared/uncertainText";
import { parameterLabelOf } from "./esqModel";
import { useEsqWorkbook } from "./esqWorkbookContext";
import {
  CutOffField,
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
  decade,
  exponentOf,
  failedTrees,
  rowClass,
  sciText,
  treeLabel,
  useElementWidth,
  useRunner,
} from "./esqShared";
import { Pager, pageOf, type EsqWindowContext } from "./esqModelScreen";
import { comparisonProblem } from "./esqPost";
import {
  CONSISTENCY_LABELS,
  CONSISTENCY_SRS,
  CONSISTENCY_TOPICS,
  CONTRIBUTOR_LABELS,
  IMPORTANCE_KIND_LABELS,
  SCREENED_TOTAL_PERCENT,
  contributorRows,
  cutSetListRequest,
  cutSetRows,
  daChangedNote,
  fourDigits,
  importanceProblem,
  importanceRecordOf,
  measureRows,
  nextPlantId,
  resultsViewOf,
  reviewOf,
  runLogicOf,
  targetLabel,
  withComparedPlant,
  withComparison,
  withConfirmation,
  withConsistency,
  withCutSetList,
  withCutSetReview,
  withImportance,
  withReconciliation,
  withScreenedBound,
  withThresholds,
  type EsqContributorKind,
  type EsqCutSetRow,
  type EsqResultsView,
  type EsqResultsWindowKind,
} from "./esqResults";
import { getEsqImportanceResult, getEsqModelRunResult, getEsqRunSourceRevision, runEsqImportance, runEsqModel } from "./esqWorkbookApi";
import { esqModelRunId } from "interfaces-mef-types/esq/esq-solve-inputs";

type ResultsTab = "cutsets" | "consistency" | "contributors" | "importance" | "screened" | "checks";

interface Loaded<T> {
  value?: T;
  error?: string;
}

const TAB_HEADS: Record<ResultsTab, { title: string; sr: string }> = {
  cutsets: { title: "Cut set review", sr: "ESQ-D1 · ESQ-D5" },
  consistency: { title: "Consistency", sr: "ESQ-D2 · ESQ-D3 · ESQ-D4" },
  contributors: { title: "Contributors", sr: "ESQ-F1(e) · ESQ-F2" },
  importance: { title: "Importance", sr: "ESQ-D6 · ESQ-D7" },
  screened: { title: "Screened scope", sr: "ESQ-D8" },
  checks: { title: "Results review checks", sr: "ESQ-D1 to D8 · ESQ-F2" },
};

const RESULTS_WINDOW_KINDS: ReadonlySet<string> = new Set<EsqResultsWindowKind>([
  "esqResultsCutSet",
  "esqResultsConsistency",
  "esqResultsComparison",
  "esqResultsTarget",
  "esqResultsThresholds",
  "esqResultsScreened",
  "esqResultsSilent",
]);

const RESULTS_WINDOW_LABELS: Record<EsqResultsWindowKind, string> = {
  esqResultsCutSet: "Cut set review",
  esqResultsConsistency: "Consistency check",
  esqResultsComparison: "Similar plants",
  esqResultsTarget: "Importance note",
  esqResultsThresholds: "Significance thresholds",
  esqResultsScreened: "Screened initiator",
  esqResultsSilent: "Event confirmation",
};

const KIND_FILTERS: readonly ("ALL" | EsqImportanceKind)[] = ["ALL", "PARAMETER", "EVENT", "HFE", "CCF_GROUP", "SYSTEM"];

const CONTRIBUTOR_FILTERS: readonly ("ALL" | EsqContributorKind)[] = ["ALL", "SEQUENCE", "STATE", "INITIATOR", "SOURCE", "PARAMETER", "CCF_GROUP", "HFE", "SYSTEM", "BARRIER", "EVENT"];

const TOTAL = "TOTAL";

const ROLE_LABELS: Record<EsqImportanceEventRole, string> = {
  BASIC: "Basic event",
  CCF_TERM: "Common cause term",
  RECOVERY: "Non-recovery",
  JOINT: "Joint HEP",
  INDEPENDENT_PART: "Independent part of an HFE",
  SPLIT: "Split fraction",
};

function blank(text: string | undefined): boolean {
  return text === undefined || text.trim().length === 0;
}

function textValue(text: string | undefined): string {
  return text === undefined || text.trim().length === 0 ? "—" : text.trim();
}

function valueText(value: number | undefined): string {
  return value === undefined ? "—" : sciText(value);
}

function shareText(fraction: number): string {
  if (!Number.isFinite(fraction)) return "—";
  if (fraction === 0) return "0%";
  return `${String(Number((100 * fraction).toPrecision(3)))}%`;
}

function yesNo(value: boolean | undefined): string {
  return value === undefined ? "—" : value ? "Yes" : "No";
}

function familyLabel(view: EsqResultsView, familyId: string): string {
  const family = view.families.find((candidate) => candidate.id === familyId);
  return family === undefined || blank(family.name) ? familyId : `${familyId} · ${family.name}`;
}

function useLoaded<T>(key: string | undefined, load: (key: string) => Promise<T>): Loaded<T> {
  const [state, setState] = useState<Loaded<T> & { key?: string }>({});
  useEffect(() => {
    if (key === undefined) return undefined;
    let cancelled = false;
    load(key)
      .then((value) => { if (!cancelled) setState({ key, value }); })
      .catch((caught: Error) => { if (!cancelled) setState({ key, error: caught.message }); });
    return () => { cancelled = true; };
  }, [key, load]);
  if (key === undefined || state.key !== key) return {};
  return state.error === undefined ? { value: state.value } : { error: state.error };
}

function useModelRun(workbookId: string | null, runId: string | undefined): Loaded<EsqModelRunResult> {
  const load = useCallback((key: string) => {
    const [id = "", run = ""] = key.split("|");
    return getEsqModelRunResult(id, run);
  }, []);
  return useLoaded(workbookId === null || runId === undefined ? undefined : `${workbookId}|${runId}`, load);
}

function useImportanceRun(workbookId: string | null, runId: string | undefined): Loaded<EsqImportanceRunResult> {
  const load = useCallback((key: string) => {
    const [id = "", run = ""] = key.split("|");
    return getEsqImportanceResult(id, run);
  }, []);
  return useLoaded(workbookId === null || runId === undefined ? undefined : `${workbookId}|${runId}`, load);
}

function useDaRunRevision(workbookId: string | null, runId: string | undefined, daId: string | undefined): Loaded<number | null> {
  const load = useCallback((key: string) => {
    const [id = "", run = "", da = ""] = key.split("|");
    return getEsqRunSourceRevision(id, esqModelRunId(), run, da);
  }, []);
  return useLoaded(workbookId === null || runId === undefined || daId === undefined ? undefined : `${workbookId}|${runId}|${daId}`, load);
}

function FamilyPicker({ id, view, value, onChange, withTotal }: { id: string; view: EsqResultsView; value: string; onChange: (value: string) => void; withTotal: boolean }): JSX.Element {
  return (
    <label className="esq-run__field" htmlFor={id}>
      <span>Family</span>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
        {withTotal && <option value={TOTAL}>All release families</option>}
        {view.families.map((family) => <option key={family.id} value={family.id}>{familyLabel(view, family.id)}</option>)}
      </select>
    </label>
  );
}

function CutSetsPanel({ view, openWindow }: { view: EsqResultsView; openWindow: (ctx: EsqWindowContext) => void }): JSX.Element {
  const { esq, editable, runtime, mutateEsq } = useEsqWorkbook();
  const fieldId = useId();
  const [exponent, setExponent] = useState(() => exponentOf(view.run));
  const valued = view.families.filter((family) => (view.values.get(family.id) ?? 0) > 0);
  const [familyId, setFamilyId] = useState(() => (valued.find((family) => family.release) ?? valued[0])?.id ?? "");
  const [openKey, setOpenKey] = useState("");
  const [page, setPage] = useState(0);
  const [wrapRef, wrapWidth] = useElementWidth(0);
  const runner = useRunner();
  const blocked = analysisSaveBlock(runtime);
  const loaded = useModelRun(runtime.workbookId, view.cutSetRunId);
  const run = view.run;
  if (run === undefined) return <p className="posmuted">No run of record yet. Run the model in Step 05 and use the run.</p>;
  const summary = loaded.value;
  const codes = new Map(view.model.events.map((event) => [event.id, event.code]));
  const codeOf = (id: string): string => summary?.eventCodes[id] ?? codes.get(id) ?? id;
  const rows: EsqCutSetRow[] = summary === undefined ? [] : cutSetRows(summary, familyId, view.values.get(familyId) ?? 0, view.work, view.thresholds, codeOf);
  const { current, shown } = pageOf(rows, page);
  const list = view.work.cutSetList;
  const exact = run.calculation === "EXACT";

  function listCutSets(): void {
    const workbookId = runtime.workbookId;
    const revision = runtime.revision;
    if (workbookId === null || revision === null || run === undefined) return;
    const cutOff = decade(exponent);
    runner.start(async () => {
      const response = await runEsqModel(workbookId, revision, runLogicOf(run), "CUT_SETS", cutSetListRequest(run, cutOff));
      if (response.run.status !== "SUCCEEDED") throw new Error(response.run.failure?.message ?? "The run did not finish.");
      const result = await getEsqModelRunResult(workbookId, response.run.id);
      const problem = comparisonProblem(result, esq);
      if (problem !== undefined) {
        runner.fail(problem, failedTrees(result));
        return;
      }
      mutateEsq((draft) => withCutSetList(draft, result, cutOff));
    });
  }

  function review(row: EsqCutSetRow): void {
    if (row.review === undefined) {
      if (!editable) return;
      mutateEsq((draft) => withCutSetReview(draft, row, {}));
    }
    openWindow({ kind: "esqResultsCutSet", id: row.key });
  }

  return (
    <div className="esq-run">
      {exact && (
        <div className="esq-run__composer" aria-label="Cut set list controls">
          <div className="esq-run__row">
            <div className="esq-run__pickers"><CutOffField id={`${fieldId}-cutoff`} value={exponent} onChange={setExponent} /></div>
            <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" disabled={runner.running || !editable || blocked !== null} onClick={listCutSets}>
              {runner.running ? "Listing…" : "List cut sets"}
            </button>
          </div>
          <p className="esq-meta">The run of record is exact. PRAXIS lists the minimal cut sets of each family with the same logic and the upper bound, keeping the largest 100.</p>
        </div>
      )}
      <RunState runner={runner} model={view.model} blocked={blocked} />
      <p className="esq-meta">
        {!exact ? "Cut sets of the run of record." : list === undefined ? "No cut sets listed yet." : `Listed ${dateText(list.at)} at a cutoff of ${sciText(list.cutOff)} per year.${view.cutSetListStale ? " The inputs changed since, so list again." : ""}`}
        {` A cut set is significant when it gives ${view.thresholds.individualPercent}% of its family or more, or falls within the first ${view.thresholds.aggregatePercent}%.`}
      </p>
      {loaded.error !== undefined && <p className="esq-run__error" role="alert">{loaded.error}</p>}
      {view.cutSetRunId !== undefined && (
        <div className="esq-run__composer">
          <div className="esq-run__row">
            <div className="esq-run__pickers">
              <label className="esq-run__field" htmlFor={`${fieldId}-family`}>
                <span>Family</span>
                <select id={`${fieldId}-family`} value={familyId} onChange={(event) => { setFamilyId(event.target.value); setPage(0); setOpenKey(""); }}>
                  {valued.map((family) => <option key={family.id} value={family.id}>{familyLabel(view, family.id)}</option>)}
                </select>
              </label>
            </div>
            <Pager total={rows.length} page={current} onPage={setPage} />
          </div>
        </div>
      )}
      {view.cutSetRunId !== undefined && summary === undefined && loaded.error === undefined && <p className="posmuted">Loading the cut sets…</p>}
      {summary !== undefined && rows.length === 0 && <p className="posmuted">This family has no cut set above the cutoff.</p>}
      {rows.length > 0 && (
        <div className="esq-table-wrap" ref={wrapRef}>
          <table className="postable esq-rowtable" aria-label="Cut sets">
            <thead><tr><th className="esq-rowtable__pick">Details</th><th>Cut set</th><th>Frequency (/yr)</th><th>Share</th><th>Review</th></tr></thead>
            <tbody>
              {shown.map((row) => {
                const open = row.key === openKey;
                const verdict = row.review?.verdict;
                return (
                  <Fragment key={row.key}>
                    <tr className={rowClass(false, open)} onClick={() => { if (!open) setOpenKey(row.key); }}>
                      <td className="esq-rowtable__pick"><DetailToggle open={open} label={row.codes.join(" · ")} onToggle={() => setOpenKey(open ? "" : row.key)} /></td>
                      <td className="esq-rowtable__wrap">
                        {row.codes.join(" · ")}
                        {row.significant && <span className="esq-rowtable__tag">Significant</span>}
                      </td>
                      <td className="esq-rowtable__num">{sciText(row.annualFrequency)}</td>
                      <td className="esq-rowtable__num">{shareText(row.share)}</td>
                      <td className="esq-rowtable__text">
                        <button type="button" className="esq-rowtable__name" disabled={row.review === undefined && !editable} onClick={(event) => { event.stopPropagation(); review(row); }}>
                          {verdict === "CORRECT" ? "Correct" : verdict === "ISSUE" ? "Issue" : row.review === undefined ? "Review" : "Open"}
                        </button>
                      </td>
                    </tr>
                    {open && (
                      <DetailRow span={5} width={wrapWidth - 18}>
                        <FieldList items={[
                          { label: "Event tree", value: treeLabel(view.model, row.treeId) },
                          { label: "Cumulative share", value: shareText(row.cumulative) },
                          { label: "Significant", value: yesNo(row.significant) },
                          { label: "Note", value: textValue(row.review?.note) },
                        ]} />
                      </DetailRow>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ConsistencyPanel({ view, openWindow }: { view: EsqResultsView; openWindow: (ctx: EsqWindowContext) => void }): JSX.Element {
  const comparison = view.work.comparison;
  return (
    <div className="esq-run">
      <div className="esq-table-wrap">
        <table className="postable esq-rowtable" aria-label="Consistency checks">
          <thead><tr><th>Checked against</th><th>Result</th><th>Note</th></tr></thead>
          <tbody>
            {view.consistency.map((row) => (
              <tr key={row.topic}>
                <td className="esq-rowtable__text">
                  <button type="button" className="esq-rowtable__name" onClick={() => openWindow({ kind: "esqResultsConsistency", id: row.topic })}>{CONSISTENCY_LABELS[row.topic]}</button>
                  <span className="esq-rowtable__tag">{CONSISTENCY_SRS[row.topic]}</span>
                </td>
                <td className="esq-rowtable__text">{row.entry?.consistent === undefined ? "Not checked" : row.entry.consistent ? "Consistent" : "Inconsistent"}</td>
                <td className="esq-rowtable__wrap">{textValue(row.entry?.note)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="esq-bar">
        <p className="esq-meta">{comparison === undefined ? "Similar plants are not addressed yet (ESQ-D4)." : comparison.possible ? `${comparison.plants.length} similar plants compared.` : `No comparison is possible. ${textValue(comparison.reason)}`}</p>
        <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => openWindow({ kind: "esqResultsComparison", id: "comparison" })}>Similar plants</button>
      </div>
      {comparison?.possible === true && comparison.plants.length > 0 && (
        <div className="esq-table-wrap">
          <table className="postable esq-rowtable" aria-label="Similar plants">
            <thead><tr><th>Plant</th><th>Family</th><th>Value (/yr)</th><th>Difference</th></tr></thead>
            <tbody>
              {comparison.plants.map((plant) => (
                <tr key={plant.id}>
                  <td className="esq-rowtable__text">{blank(plant.name) ? plant.id : plant.name}</td>
                  <td className="esq-rowtable__text">{plant.familyId === undefined ? "—" : familyLabel(view, plant.familyId)}</td>
                  <td className="esq-rowtable__num">{valueText(plant.value)}</td>
                  <td className="esq-rowtable__wrap">{textValue(plant.note)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ContributorsPanel({ view }: { view: EsqResultsView }): JSX.Element {
  const { esq, runtime } = useEsqWorkbook();
  const fieldId = useId();
  const [familyId, setFamilyId] = useState(TOTAL);
  const [kind, setKind] = useState<"ALL" | EsqContributorKind>("ALL");
  const [page, setPage] = useState(0);
  const summary = useModelRun(runtime.workbookId, view.run?.runId);
  const importance = useImportanceRun(runtime.workbookId, view.importance?.runId);
  const releaseIds = view.releaseIds;
  const ids = useMemo(() => (familyId === TOTAL ? releaseIds : [familyId]), [familyId, releaseIds]);
  const rows = useMemo(() => contributorRows({
    esq,
    familyIds: ids,
    ...(summary.value === undefined ? {} : { summary: summary.value }),
    ...(importance.value === undefined ? {} : { importance: importance.value }),
  }), [esq, ids, summary.value, importance.value]);
  if (view.run === undefined) return <p className="posmuted">No run of record yet. Run the model in Step 05 and use the run.</p>;
  const filtered = kind === "ALL" ? rows : rows.filter((row) => row.kind === kind);
  const { current, shown } = pageOf(filtered, page);
  const total = ids.reduce((sum, id) => sum + (view.values.get(id) ?? 0), 0);
  return (
    <div className="esq-run">
      <div className="esq-run__composer">
        <div className="esq-run__row">
          <div className="esq-run__pickers">
            <FamilyPicker id={`${fieldId}-family`} view={view} value={familyId} onChange={(value) => { setFamilyId(value); setPage(0); }} withTotal />
            <label className="esq-run__field" htmlFor={`${fieldId}-kind`}>
              <span>Contributor</span>
              <select id={`${fieldId}-kind`} value={kind} onChange={(event) => { setKind(CONTRIBUTOR_FILTERS.find((entry) => entry === event.target.value) ?? "ALL"); setPage(0); }}>
                {CONTRIBUTOR_FILTERS.map((entry) => <option key={entry} value={entry}>{entry === "ALL" ? "Every kind" : CONTRIBUTOR_LABELS[entry]}</option>)}
              </select>
            </label>
          </div>
          <Pager total={filtered.length} page={current} onPage={setPage} />
        </div>
        <p className="esq-meta">{`Sequences, states, initiators and sources split ${sciText(total)} per year from the run of record. Events and groups take their Fussell-Vesely share from the importance run, so they overlap.`}</p>
      </div>
      {summary.error !== undefined && <p className="esq-run__error" role="alert">{summary.error}</p>}
      {view.importance === undefined && <p className="esq-run__notice" role="status">Rank the importance to add events, parameters, groups and barrier failure modes.</p>}
      {filtered.length === 0 ? (
        <p className="posmuted">{summary.value === undefined && summary.error === undefined ? "Loading the run of record…" : "No contributor of this kind."}</p>
      ) : (
        <div className="esq-table-wrap">
          <table className="postable esq-rowtable" aria-label="Contributors">
            <thead><tr><th>Contributor</th><th>Kind</th><th>Frequency (/yr)</th><th>Share</th></tr></thead>
            <tbody>
              {shown.map((row) => (
                <tr key={row.key}>
                  <td className="esq-rowtable__wrap">{row.label}</td>
                  <td className="esq-rowtable__text">{CONTRIBUTOR_LABELS[row.kind]}</td>
                  <td className="esq-rowtable__num">{sciText(row.annualFrequency)}</td>
                  <td className="esq-rowtable__num">{shareText(row.fraction)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ImportancePanel({ view, openWindow }: { view: EsqResultsView; openWindow: (ctx: EsqWindowContext) => void }): JSX.Element {
  const { esq, editable, runtime, mutateEsq } = useEsqWorkbook();
  const fieldId = useId();
  const [familyId, setFamilyId] = useState(TOTAL);
  const [kind, setKind] = useState<"ALL" | EsqImportanceKind>("ALL");
  const [onlySignificant, setOnlySignificant] = useState(false);
  const [openId, setOpenId] = useState("");
  const [page, setPage] = useState(0);
  const [wrapRef, wrapWidth] = useElementWidth(0);
  const runner = useRunner();
  const blocked = analysisSaveBlock(runtime);
  const record = view.importance;
  const loaded = useImportanceRun(runtime.workbookId, record?.runId);
  const result = loaded.value;
  const releaseIds = view.releaseIds;
  const thresholds = view.thresholds;
  const rows = useMemo(() => (result === undefined ? [] : measureRows(result, familyId === TOTAL ? releaseIds : [familyId], thresholds)), [result, familyId, releaseIds, thresholds]);
  const notes = new Map((view.work.reconciliations ?? []).map((entry) => [entry.targetId, entry.note]));
  const run = view.run;
  if (run === undefined) return <p className="posmuted">No run of record yet. Run the model in Step 05 and use the run.</p>;
  const filtered = rows.filter((row) => (kind === "ALL" || row.target.kind === kind) && (!onlySignificant || row.significant));
  const { current, shown } = pageOf(filtered, page);

  function rank(): void {
    const workbookId = runtime.workbookId;
    const revision = runtime.revision;
    if (workbookId === null || revision === null || run === undefined) return;
    runner.start(async () => {
      const response = await runEsqImportance(workbookId, revision, runLogicOf(run));
      if (response.run.status !== "SUCCEEDED") throw new Error(response.run.failure?.message ?? "The run did not finish.");
      const ranked = await getEsqImportanceResult(workbookId, response.run.id);
      const problem = importanceProblem(ranked, esq);
      if (problem !== undefined) {
        runner.fail(problem, failedTrees(ranked));
        return;
      }
      mutateEsq((draft) => withImportance(draft, importanceRecordOf(ranked, draft, view.thresholds)));
    });
  }

  function apply(): void {
    if (result === undefined || !editable) return;
    mutateEsq((draft) => withImportance(draft, importanceRecordOf(result, draft, view.thresholds)));
  }

  return (
    <div className="esq-run">
      <div className="esq-run__composer" aria-label="Importance controls">
        <div className="esq-run__row">
          <p className="esq-meta">PRAXIS sets each event and each group to failure and to success on the exact diagrams of the run of record, with its logic.</p>
          <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" disabled={runner.running || !editable || blocked !== null} onClick={rank}>
            {runner.running ? "Ranking…" : "Rank"}
          </button>
        </div>
      </div>
      <RunState runner={runner} model={view.model} blocked={blocked} />
      <div className="esq-bar">
        <p className="esq-meta">
          {record === undefined ? "Not ranked yet." : `Ranked ${dateText(record.at)}. ${record.significant.length} items are significant.${view.importanceStale ? " The inputs changed since, so rank again." : ""}`}
          {` Flags at FV above ${fourDigits(view.thresholds.fussellVesely)} or RAW above ${fourDigits(view.thresholds.riskAchievementWorth)}, from ${view.thresholds.source}.`}
        </p>
        {view.thresholdsChanged && editable && result !== undefined && <button type="button" className="posnav__btn posnav__btn--sm" onClick={apply}>Apply thresholds</button>}
      </div>
      {loaded.error !== undefined && <p className="esq-run__error" role="alert">{loaded.error}</p>}
      {record !== undefined && (
        <div className="esq-run__composer">
          <div className="esq-run__row">
            <div className="esq-run__pickers">
              <FamilyPicker id={`${fieldId}-family`} view={view} value={familyId} onChange={(value) => { setFamilyId(value); setPage(0); setOpenId(""); }} withTotal />
              <label className="esq-run__field" htmlFor={`${fieldId}-kind`}>
                <span>Item</span>
                <select id={`${fieldId}-kind`} value={kind} onChange={(event) => { setKind(KIND_FILTERS.find((entry) => entry === event.target.value) ?? "ALL"); setPage(0); }}>
                  {KIND_FILTERS.map((entry) => <option key={entry} value={entry}>{entry === "ALL" ? "Every item" : IMPORTANCE_KIND_LABELS[entry]}</option>)}
                </select>
              </label>
              <label className="esq-form__check" htmlFor={`${fieldId}-significant`}>
                <input id={`${fieldId}-significant`} type="checkbox" checked={onlySignificant} onChange={(event) => { setOnlySignificant(event.target.checked); setPage(0); }} />
                Significant only
              </label>
            </div>
            <Pager total={filtered.length} page={current} onPage={setPage} />
          </div>
        </div>
      )}
      {record !== undefined && result === undefined && loaded.error === undefined && <p className="posmuted">Loading the ranking…</p>}
      {filtered.length > 0 && (
        <div className="esq-table-wrap" ref={wrapRef}>
          <table className="postable esq-rowtable" aria-label="Importance measures">
            <thead><tr><th className="esq-rowtable__pick">Details</th><th>Item</th><th>FV</th><th>RAW</th><th>Significant</th></tr></thead>
            <tbody>
              {shown.map((row) => {
                const target = row.target;
                const open = target.id === openId;
                return (
                  <Fragment key={target.id}>
                    <tr className={rowClass(!row.significant, open)} onClick={() => { if (!open) setOpenId(target.id); }}>
                      <td className="esq-rowtable__pick"><DetailToggle open={open} label={target.label} onToggle={() => setOpenId(open ? "" : target.id)} /></td>
                      <td className="esq-rowtable__wrap">
                        <button type="button" className="esq-rowtable__name" onClick={(event) => { event.stopPropagation(); openWindow({ kind: "esqResultsTarget", id: target.id }); }}>{target.label}</button>
                        <span className="esq-rowtable__tag">{IMPORTANCE_KIND_LABELS[target.kind]}</span>
                      </td>
                      <td className="esq-rowtable__num">{fourDigits(row.fussellVesely)}</td>
                      <td className="esq-rowtable__num">{fourDigits(row.riskAchievementWorth)}</td>
                      <td className="esq-rowtable__text">{yesNo(row.significant)}</td>
                    </tr>
                    {open && (
                      <DetailRow span={5} width={wrapWidth - 18}>
                        <FieldList items={[
                          { label: "Probability", value: target.probability === null ? "—" : sciText(target.probability) },
                          { label: "Role", value: target.role === null ? "Group" : ROLE_LABELS[target.role] },
                          { label: "RRW", value: fourDigits(row.riskReductionWorth) },
                          { label: "Birnbaum (/yr)", value: sciText(row.birnbaum) },
                          { label: "Family at failure (/yr)", value: sciText(row.base + row.increase) },
                          { label: "Family at success (/yr)", value: sciText(row.base - row.decrease) },
                          { label: "Note", value: textValue(notes.get(target.id)) },
                        ]} />
                      </DetailRow>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ScreenedPanel({ view, openWindow }: { view: EsqResultsView; openWindow: (ctx: EsqWindowContext) => void }): JSX.Element {
  const [openId, setOpenId] = useState("");
  const [wrapRef, wrapWidth] = useElementWidth(0);
  if (view.screened.length === 0) return <p className="posmuted">IE screens out no initiator and Step 01 excludes no initiator group, so nothing needs a bound.</p>;
  return (
    <div className="esq-run">
      <p className="esq-meta">{`SCR-1 holds when the bounding family frequency is below the reporting floor of ${sciText(view.floor)} per year. SCR-2 holds when it is below ${view.thresholds.individualPercent}% of the family it would join. Together the screened initiators must stay below ${SCREENED_TOTAL_PERCENT}% of the release total.`}</p>
      <div className="esq-table-wrap" ref={wrapRef}>
        <table className="postable esq-rowtable" aria-label="Screened initiators">
          <thead><tr><th className="esq-rowtable__pick">Details</th><th>Initiator</th><th>Bound (/yr)</th><th>SCR-1</th><th>SCR-2</th></tr></thead>
          <tbody>
            {view.screened.map((row) => {
              const open = row.groupId === openId;
              return (
                <Fragment key={row.groupId}>
                  <tr className={rowClass(false, open)} onClick={() => { if (!open) setOpenId(row.groupId); }}>
                    <td className="esq-rowtable__pick"><DetailToggle open={open} label={row.name} onToggle={() => setOpenId(open ? "" : row.groupId)} /></td>
                    <td className="esq-rowtable__wrap">
                      <button type="button" className="esq-rowtable__name" onClick={(event) => { event.stopPropagation(); openWindow({ kind: "esqResultsScreened", id: row.groupId }); }}>{row.name}</button>
                      <span className="esq-rowtable__tag">{row.origin === "IE" ? "IE" : "Step 01"}</span>
                    </td>
                    <td className="esq-rowtable__num">{valueText(row.bounding)}</td>
                    <td className="esq-rowtable__text">{yesNo(row.scr1)}</td>
                    <td className="esq-rowtable__text">{yesNo(row.scr2)}</td>
                  </tr>
                  {open && (
                    <DetailRow span={5} width={wrapWidth - 18}>
                      <FieldList items={[
                        { label: "Id", value: row.groupId },
                        { label: "Screened by", value: row.origin === "IE" ? `IE${row.criterion === undefined ? "" : ` under ${row.criterion}`}` : "Step 01 scope" },
                        { label: "Basis given", value: textValue(row.ieBasis) },
                        { label: "Frequency (/yr)", value: valueText(row.frequency) },
                        { label: "Conditional bound", value: valueText(row.bound?.conditional) },
                        { label: "Family joined", value: row.bound?.familyId === undefined ? "Release total" : familyLabel(view, row.bound.familyId) },
                        { label: "Family value (/yr)", value: valueText(row.familyValue) },
                        { label: "Basis", value: textValue(row.bound?.basis) },
                      ]} />
                    </DetailRow>
                  )}
                </Fragment>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td />
              <td className="esq-rowtable__text">All screened together</td>
              <td className="esq-rowtable__num">{sciText(view.screenedTotal)}</td>
              <td colSpan={2} className="esq-rowtable__text">{view.total > 0 ? `${shareText(view.screenedTotal / view.total)} of the release total` : "—"}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function ResultsScreen({ openWindow }: { openWindow: (ctx: EsqWindowContext) => void }): JSX.Element {
  const { esq, upstream, runtime } = useEsqWorkbook();
  const view = useMemo(() => resultsViewOf(esq, upstream.ri, upstream.ie), [esq, upstream.ri, upstream.ie]);
  const daUsed = useDaRunRevision(runtime.workbookId, view?.run?.runId, esq.linkedWorkbooks?.DA);
  const daNote = daChangedNote(daUsed.value, upstream.daRevision);
  const [tab, setTab] = useState<ResultsTab>("cutsets");
  const tabId = useId();
  const count = (n: number): string => (view === undefined ? "" : ` (${n})`);
  const tabs: { id: ResultsTab; label: string }[] = [
    { id: "cutsets", label: `Cut sets${count(view?.work.cutSetReviews?.filter((entry) => entry.verdict !== undefined).length ?? 0)}` },
    { id: "consistency", label: "Consistency" },
    { id: "contributors", label: "Contributors" },
    { id: "importance", label: `Importance${count(view?.importance?.significant.length ?? 0)}` },
    { id: "screened", label: `Screened scope${count(view?.screened.length ?? 0)}` },
    { id: "checks", label: `Checks${count(view?.findings.length ?? 0)}` },
  ];
  const head = TAB_HEADS[tab];
  return (
    <div className="esq-step">
      <EsqTabs label="Results review sections" tabs={tabs} active={tab} onChange={setTab} idBase={tabId} className="esq-step__tabs" />
      <div role="tabpanel" id={`${tabId}-panel`} aria-labelledby={`${tabId}-${tab}`} tabIndex={0} className="esq-step__panel">
        <div className="poscard">
          <div className="poscard__head">
            <WorkbookSectionHeading workbook="ESQ" title={head.title} level={3} />
            <div className="esq-card-actions">
              <EsqProvenanceChip>{head.sr}</EsqProvenanceChip>
              {view !== undefined && tab === "importance" && (
                <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => openWindow({ kind: "esqResultsThresholds", id: "thresholds" })}>Thresholds</button>
              )}
              {view?.run !== undefined && (tab === "contributors" || tab === "checks") && (
                <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => openWindow({ kind: "esqSolveRun", id: "run" })}>Run of record</button>
              )}
            </div>
          </div>
          {daNote !== undefined && <p className="esq-meta" role="status">{daNote}</p>}
          {view === undefined ? (
            <p className="posmuted">Nothing is imported yet. Import the model in Step 02.</p>
          ) : tab === "cutsets" ? (
            <CutSetsPanel view={view} openWindow={openWindow} />
          ) : tab === "consistency" ? (
            <ConsistencyPanel view={view} openWindow={openWindow} />
          ) : tab === "contributors" ? (
            <ContributorsPanel view={view} />
          ) : tab === "importance" ? (
            <ImportancePanel view={view} openWindow={openWindow} />
          ) : tab === "screened" ? (
            <ScreenedPanel view={view} openWindow={openWindow} />
          ) : (
            <FindingsTable label="Results review checks" findings={view.findings} openWindow={openWindow} />
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

function numberFrom(text: string): number | null | undefined {
  const trimmed = text.trim();
  if (trimmed.length === 0) return undefined;
  const value = Number(trimmed);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function CutSetWindow({ id, onClose }: { id: string; onClose: () => void }): JSX.Element | null {
  const { esq, editable, mutateEsq } = useEsqWorkbook();
  const fieldId = useId();
  const review = reviewOf(esq).cutSetReviews?.find((entry) => entry.key === id);
  if (review === undefined) return null;
  const codes = new Map((esq.model?.events ?? []).map((event) => [event.id, event.code]));
  const row: EsqCutSetRow = { key: review.key, familyId: review.familyId, treeId: review.treeId, eventIds: review.eventIds, codes: review.eventIds.map((eventId) => codes.get(eventId) ?? eventId), annualFrequency: review.annualFrequency, share: 0, cumulative: 0, significant: review.significant };
  const dis = !editable;

  function save(change: { verdict?: "CORRECT" | "ISSUE"; note?: string }): void {
    if (!editable) return;
    mutateEsq((draft) => withCutSetReview(draft, row, change));
  }

  return (
    <>
      <ModalHead cap={`Cut set review · ${review.significant ? "significant · ESQ-D1" : "non-significant · ESQ-D5"}`} title={row.codes.join(" · ")} onClose={onClose} />
      <div className="modal__body esq-form">
        <FormRow label="Family"><span className="esq-form__unit">{review.familyId}</span></FormRow>
        <FormRow label="Event tree"><span className="esq-form__unit">{esq.model === undefined ? review.treeId : treeLabel(esq.model, review.treeId)}</span></FormRow>
        <FormRow label="Frequency"><span className="esq-form__unit">{`${sciText(review.annualFrequency)} per year`}</span></FormRow>
        <FormRow label="Logic" htmlFor={`${fieldId}-verdict`}>
          <select id={`${fieldId}-verdict`} className="posfield__select" value={review.verdict ?? ""} disabled={dis} onChange={(event) => {
            const value = event.target.value;
            save(value === "CORRECT" || value === "ISSUE" ? { verdict: value } : { verdict: undefined });
          }}>
            <option value="">Not reviewed</option>
            <option value="CORRECT">{review.significant ? "Correct" : "Correct and physically meaningful"}</option>
            <option value="ISSUE">Wrong, needs a fix</option>
          </select>
        </FormRow>
        <AreaRow label="Note" value={review.note} disabled={dis} onChange={(note) => save({ note })} />
      </div>
      <FormFoot onClose={onClose}>
        {editable && (
          <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => {
            mutateEsq((draft) => ({ ...draft, review: { ...reviewOf(draft), cutSetReviews: (reviewOf(draft).cutSetReviews ?? []).filter((entry) => entry.key !== id) } }));
            onClose();
          }}>Remove review</button>
        )}
      </FormFoot>
    </>
  );
}

function ConsistencyWindow({ topic, onClose }: { topic: EsqConsistencyTopic; onClose: () => void }): JSX.Element {
  const { esq, editable, mutateEsq } = useEsqWorkbook();
  const fieldId = useId();
  const entry = reviewOf(esq).consistency?.find((item) => item.topic === topic) ?? { topic, note: "" };
  const dis = !editable;

  function save(next: typeof entry): void {
    if (!editable) return;
    mutateEsq((draft) => withConsistency(draft, topic, next.consistent === undefined && next.note.trim().length === 0 ? undefined : next));
  }

  return (
    <>
      <ModalHead cap={`Consistency · ${CONSISTENCY_SRS[topic]}`} title={CONSISTENCY_LABELS[topic]} onClose={onClose} />
      <div className="modal__body esq-form">
        <FormRow label="Result" htmlFor={`${fieldId}-result`}>
          <select id={`${fieldId}-result`} className="posfield__select" value={entry.consistent === undefined ? "" : entry.consistent ? "yes" : "no"} disabled={dis} onChange={(event) => {
            const value = event.target.value;
            const { consistent: _old, ...rest } = entry;
            save(value === "" ? rest : { ...rest, consistent: value === "yes" });
          }}>
            <option value="">Not checked</option>
            <option value="yes">Consistent</option>
            <option value="no">Inconsistent</option>
          </select>
        </FormRow>
        <AreaRow label="What was compared" value={entry.note} disabled={dis} onChange={(note) => save({ ...entry, note })} />
      </div>
      <FormFoot onClose={onClose} />
    </>
  );
}

function ComparisonWindow({ onClose }: { onClose: () => void }): JSX.Element {
  const { esq, editable, mutateEsq } = useEsqWorkbook();
  const fieldId = useId();
  const comparison = reviewOf(esq).comparison ?? { possible: false, reason: "", plants: [] };
  const families = esq.model?.families ?? [];
  const dis = !editable;

  function savePlant(plant: EsqComparedPlant): void {
    if (!editable) return;
    mutateEsq((draft) => withComparedPlant(draft, plant));
  }

  return (
    <>
      <ModalHead cap="Similar plants · ESQ-D4 · ESQ-N-16" title="Comparison with similar plants" onClose={onClose} />
      <div className="modal__body esq-form">
        <FormRow label="Comparison" htmlFor={`${fieldId}-possible`}>
          <select id={`${fieldId}-possible`} className="posfield__select" value={comparison.possible ? "yes" : "no"} disabled={dis} onChange={(event) => mutateEsq((draft) => withComparison(draft, { ...comparison, possible: event.target.value === "yes" }))}>
            <option value="no">Not possible</option>
            <option value="yes">Possible</option>
          </select>
        </FormRow>
        {!comparison.possible && (
          <AreaRow label="Why not" value={comparison.reason} disabled={dis} onChange={(reason) => mutateEsq((draft) => withComparison(draft, { ...comparison, reason }))} />
        )}
        {comparison.possible && comparison.plants.map((plant, index) => (
          <fieldset key={plant.id} className="esq-use">
            <legend className="esq-use__legend">{`Plant ${index + 1}`}</legend>
            <FormRow label="Name" htmlFor={`${fieldId}-${plant.id}-name`}>
              <WorkbookInput id={`${fieldId}-${plant.id}-name`} className="posfield__input" value={plant.name} disabled={dis} onChange={(event) => savePlant({ ...plant, name: event.target.value })} />
            </FormRow>
            <FormRow label="Source" htmlFor={`${fieldId}-${plant.id}-source`}>
              <WorkbookInput id={`${fieldId}-${plant.id}-source`} className="posfield__input" value={plant.source} disabled={dis} onChange={(event) => savePlant({ ...plant, source: event.target.value })} />
            </FormRow>
            <FormRow label="Family" htmlFor={`${fieldId}-${plant.id}-family`}>
              <select id={`${fieldId}-${plant.id}-family`} className="posfield__select" value={plant.familyId ?? ""} disabled={dis} onChange={(event) => {
                const { familyId: _old, ...rest } = plant;
                savePlant(event.target.value.length === 0 ? rest : { ...rest, familyId: event.target.value });
              }}>
                <option value="">Release total</option>
                {families.map((family) => <option key={family.id} value={family.id}>{blank(family.name) ? family.id : `${family.id} · ${family.name}`}</option>)}
              </select>
            </FormRow>
            <FormRow label="Value (/yr)" htmlFor={`${fieldId}-${plant.id}-value`}>
              <WorkbookInput id={`${fieldId}-${plant.id}-value`} type="number" className="posfield__input esq-form__number" value={plant.value ?? ""} disabled={dis} onChange={(event) => {
                const value = numberFrom(event.target.value);
                if (value === null) return;
                const { value: _old, ...rest } = plant;
                savePlant(value === undefined ? rest : { ...rest, value });
              }} />
            </FormRow>
            <AreaRow label="Differences and causes" value={plant.note} disabled={dis} onChange={(note) => savePlant({ ...plant, note })} />
            {editable && <button type="button" className="posnav__btn posnav__btn--sm esq-use__remove" onClick={() => mutateEsq((draft) => withComparedPlant(draft, plant, true))}>Remove plant</button>}
          </fieldset>
        ))}
        {comparison.possible && editable && (
          <button type="button" className="posnav__btn posnav__btn--sm esq-use__remove" onClick={() => mutateEsq((draft) => withComparedPlant(draft, { id: nextPlantId(draft), name: "", source: "", note: "" }))}>Add plant</button>
        )}
      </div>
      <FormFoot onClose={onClose} />
    </>
  );
}

function TargetWindow({ id, onClose }: { id: string; onClose: () => void }): JSX.Element {
  const { esq, editable, mutateEsq } = useEsqWorkbook();
  const note = reviewOf(esq).reconciliations?.find((entry) => entry.targetId === id)?.note ?? "";
  const significant = reviewOf(esq).importance?.significant.find((entry) => entry.id === id);
  return (
    <>
      <ModalHead cap={`Importance · ${significant === undefined ? "not significant" : "significant"} · ESQ-D7`} title={targetLabel(esq, id)} onClose={onClose} />
      <div className="modal__body esq-form">
        {significant !== undefined && (
          <FormRow label="Largest measures"><span className="esq-form__unit">{`FV ${fourDigits(significant.fussellVesely)} · RAW ${fourDigits(significant.riskAchievementWorth)}`}</span></FormRow>
        )}
        <AreaRow label="Expected, or how it is reconciled" value={note} disabled={!editable} onChange={(text) => { if (editable) mutateEsq((draft) => withReconciliation(draft, id, text)); }} />
      </div>
      <FormFoot onClose={onClose} />
    </>
  );
}

function ThresholdsWindow({ onClose }: { onClose: () => void }): JSX.Element {
  const { esq, editable, mutateEsq, upstream } = useEsqWorkbook();
  const fieldId = useId();
  const typed = reviewOf(esq).thresholds;
  const relative = upstream.ri?.criteriaSet?.relative;
  const dis = !editable;
  const current = typed ?? { fussellVesely: relative?.fussellVesely.value ?? 0.005, riskAchievementWorth: relative?.riskAchievementWorth.value ?? 2, source: "" };

  function save(next: typeof current): void {
    if (!editable) return;
    mutateEsq((draft) => withThresholds(draft, next));
  }

  return (
    <>
      <ModalHead cap="Significance · RI criteria · ESQ-D6" title="Significance thresholds" onClose={onClose} />
      <div className="modal__body esq-form">
        <FormRow label="From RI"><span className="esq-form__unit">{relative === undefined ? "RI is not linked. The published NEI 18-04 Rev. 1 values apply: FV 0.005 and RAW 2." : `FV ${fourDigits(relative.fussellVesely.value)} and RAW ${fourDigits(relative.riskAchievementWorth.value)}.`}</span></FormRow>
        <fieldset className="esq-use">
          <legend className="esq-use__legend">Typed values</legend>
          <FormRow label="FV above" htmlFor={`${fieldId}-fv`}>
            <WorkbookInput id={`${fieldId}-fv`} type="number" className="posfield__input esq-form__number" value={typed?.fussellVesely ?? ""} disabled={dis} onChange={(event) => {
              const value = numberFrom(event.target.value);
              if (value === null || value === undefined || value >= 1) return;
              save({ ...current, fussellVesely: value });
            }} />
          </FormRow>
          <FormRow label="RAW above" htmlFor={`${fieldId}-raw`}>
            <WorkbookInput id={`${fieldId}-raw`} type="number" className="posfield__input esq-form__number" value={typed?.riskAchievementWorth ?? ""} disabled={dis} onChange={(event) => {
              const value = numberFrom(event.target.value);
              if (value === null || value === undefined || value < 1) return;
              save({ ...current, riskAchievementWorth: value });
            }} />
          </FormRow>
          {typed !== undefined && <AreaRow label="Source" value={typed.source} disabled={dis} onChange={(source) => save({ ...current, source })} />}
        </fieldset>
      </div>
      <FormFoot onClose={onClose}>
        {editable && typed !== undefined && (
          <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => mutateEsq((draft) => withThresholds(draft, undefined))}>Use the RI values</button>
        )}
      </FormFoot>
    </>
  );
}

function ScreenedWindow({ id, onClose }: { id: string; onClose: () => void }): JSX.Element | null {
  const { esq, editable, mutateEsq, upstream } = useEsqWorkbook();
  const fieldId = useId();
  const view = resultsViewOf(esq, upstream.ri, upstream.ie);
  const row = view?.screened.find((candidate) => candidate.groupId === id);
  if (view === undefined || row === undefined) return null;
  const bound: EsqScreenedBound = row.bound ?? { groupId: id, basis: "" };
  const dis = !editable;

  function save(next: EsqScreenedBound): void {
    if (!editable) return;
    mutateEsq((draft) => withScreenedBound(draft, id, next));
  }

  function without(key: "familyId" | "frequency" | "conditional"): EsqScreenedBound {
    const { [key]: _old, ...rest } = bound;
    return rest;
  }

  return (
    <>
      <ModalHead cap={`Screened initiator · ${row.origin === "IE" ? "IE" : "Step 01"} · ESQ-D8`} title={`${row.name} (${row.groupId})`} onClose={onClose} />
      <div className="modal__body esq-form">
        <FormRow label="Screening basis"><span className="esq-form__unit">{textValue(row.ieBasis)}</span></FormRow>
        <FormRow label="Frequency (/yr)" htmlFor={`${fieldId}-frequency`}>
          <WorkbookInput id={`${fieldId}-frequency`} type="number" className="posfield__input esq-form__number" value={bound.frequency ?? ""} disabled={dis} onChange={(event) => {
            const value = numberFrom(event.target.value);
            if (value === null) return;
            save(value === undefined ? without("frequency") : { ...bound, frequency: value });
          }} />
          <span className="esq-form__unit">{row.ieFrequency !== undefined ? `IE gives ${sciText(row.ieFrequency)}` : row.ieExpression !== undefined ? `IE gives ${expressionText(row.ieExpression, parameterLabelOf(esq))}` : "IE gives none"}</span>
        </FormRow>
        <FormRow label="Conditional bound" htmlFor={`${fieldId}-conditional`}>
          <WorkbookInput id={`${fieldId}-conditional`} type="number" className="posfield__input esq-form__number" value={bound.conditional ?? ""} disabled={dis} onChange={(event) => {
            const value = numberFrom(event.target.value);
            if (value === null || (value !== undefined && value > 1)) return;
            save(value === undefined ? without("conditional") : { ...bound, conditional: value });
          }} />
        </FormRow>
        <FormRow label="Family it would join" htmlFor={`${fieldId}-family`}>
          <select id={`${fieldId}-family`} className="posfield__select" value={bound.familyId ?? ""} disabled={dis} onChange={(event) => save(event.target.value.length === 0 ? without("familyId") : { ...bound, familyId: event.target.value })}>
            <option value="">Release total</option>
            {view.families.map((family) => <option key={family.id} value={family.id}>{familyLabel(view, family.id)}</option>)}
          </select>
        </FormRow>
        <AreaRow label="Basis" value={bound.basis} disabled={dis} onChange={(basis) => save({ ...bound, basis })} />
      </div>
      <FormFoot onClose={onClose}>
        {editable && row.bound !== undefined && (
          <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => { mutateEsq((draft) => withScreenedBound(draft, id, undefined)); onClose(); }}>Clear bound</button>
        )}
      </FormFoot>
    </>
  );
}

function SilentWindow({ id, onClose }: { id: string; onClose: () => void }): JSX.Element {
  const { esq, editable, mutateEsq } = useEsqWorkbook();
  const event = esq.model?.events.find((candidate) => candidate.id === id);
  const reason = reviewOf(esq).confirmations?.find((entry) => entry.eventId === id)?.reason ?? "";
  return (
    <>
      <ModalHead cap="Never in a retained cut set · ESQ-D5" title={event === undefined ? id : `${event.code}${blank(event.name) ? "" : ` · ${event.name}`}`} onClose={onClose} />
      <div className="modal__body esq-form">
        <FormRow label="System"><span className="esq-form__unit">{textValue(event?.systemName)}</span></FormRow>
        <AreaRow label="Why its absence is correct" value={reason} disabled={!editable} onChange={(text) => { if (editable) mutateEsq((draft) => withConfirmation(draft, id, text)); }} />
      </div>
      <FormFoot onClose={onClose} />
    </>
  );
}

function ResultsWindows({ context, onClose }: { context: EsqWindowContext; onClose: () => void }): JSX.Element | null {
  switch (context.kind) {
    case "esqResultsCutSet": return <CutSetWindow key={context.id} id={context.id} onClose={onClose} />;
    case "esqResultsConsistency": {
      const topic = CONSISTENCY_TOPICS.find((entry) => entry === context.id);
      return topic === undefined ? null : <ConsistencyWindow key={topic} topic={topic} onClose={onClose} />;
    }
    case "esqResultsComparison": return <ComparisonWindow onClose={onClose} />;
    case "esqResultsTarget": return <TargetWindow key={context.id} id={context.id} onClose={onClose} />;
    case "esqResultsThresholds": return <ThresholdsWindow onClose={onClose} />;
    case "esqResultsScreened": return <ScreenedWindow key={context.id} id={context.id} onClose={onClose} />;
    case "esqResultsSilent": return <SilentWindow key={context.id} id={context.id} onClose={onClose} />;
    default: return null;
  }
}

export { ResultsScreen, ResultsWindows, RESULTS_WINDOW_KINDS, RESULTS_WINDOW_LABELS };
