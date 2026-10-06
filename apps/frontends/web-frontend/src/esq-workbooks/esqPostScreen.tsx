import { Fragment, JSX, useId, useMemo, useState } from "react";
import type {
  EsqActionFeasibility,
  EsqCombination,
  EsqModel,
  EsqRecoveryRule,
  EsqSolveRun,
} from "interfaces-mef-types/esq/event-sequence-quantification";
import type { EsqModelRunResult, EsqPostRunPurpose, EsqPostRunResult } from "interfaces-shared-types/newly-developed-methods/event-tree";
import { WorkbookSectionHeading } from "../workbooks/workbookSectionHeading";
import { WorkbookInput, WorkbookTextarea } from "../workbooks/commitOnDeactivateFields";
import { analysisSaveBlock } from "../newly-developed-methods/shared/useAnalysisScope";
import { useEsqWorkbook } from "./esqWorkbookContext";
import {
  ChecksRow,
  CutOffField,
  DetailRow,
  DetailToggle,
  EsqProvenanceChip,
  EsqTabs,
  FieldList,
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
import { MODEL_AS_SET } from "./esqLogic";
import { FEASIBILITY_KEYS, FEASIBILITY_LABELS } from "./esqBarriers";
import {
  DEFAULT_RAISED_HEP,
  DEPENDENCE_LEVELS,
  JOINT_SOURCE_LABELS,
  LEVEL_LABELS,
  comparisonProblem,
  comparisonRequest,
  nextCombinationId,
  nextRecoveryId,
  numberText,
  postRunProblem,
  postViewOf,
  recoveryRuleOf,
  withCombination,
  withCombinationsFor,
  withComparison,
  withDeletions,
  withFloor,
  withRecoveryRule,
  withSearch,
  type EsqPostCombinationView,
  type EsqPostFinding,
  type EsqPostRecoveryView,
  type EsqPostView,
  type EsqPostWindowKind,
} from "./esqPost";
import { getEsqModelRunResult, getEsqPostResult, runEsqModel, runEsqPost } from "./esqWorkbookApi";
import type { EsqWindowContext } from "./esqModelScreen";

type PostTab = "exclusions" | "recovery" | "combinations" | "results" | "checks";

const TAB_HEADS: Record<PostTab, { title: string; sr: string }> = {
  exclusions: { title: "Exclusions and deletions", sr: "ESQ-B7 · ESQ-B8 · ESQ-F1(o)" },
  recovery: { title: "Recovery", sr: "ESQ-A7 · ESQ-C2" },
  combinations: { title: "HFE combinations", sr: "ESQ-C1 · ESQ-C2 · ESQ-N-8" },
  results: { title: "Results with and without the rules", sr: "ESQ-A7 · ESQ-C2" },
  checks: { title: "Post-processing checks", sr: "ESQ-A7 · ESQ-B7 · ESQ-B8 · ESQ-C1 · ESQ-C2" },
};

const SEVERITY_TEXT: Record<EsqPostFinding["severity"], string> = { error: "Error", warning: "Warning", note: "Note" };

const POST_WINDOW_KINDS: ReadonlySet<string> = new Set<EsqPostWindowKind>(["esqPostRecovery", "esqPostCombination", "esqPostFloor"]);

const POST_WINDOW_LABELS: Record<EsqPostWindowKind, string> = { esqPostRecovery: "Recovery", esqPostCombination: "HFE combination", esqPostFloor: "Joint HEP floor" };

const NO_FEASIBILITY: EsqActionFeasibility = { procedure: false, training: false, cues: false, crew: false, time: false, access: false, equipment: false };

function blank(text: string | undefined): boolean {
  return text === undefined || text.trim().length === 0;
}

function textValue(text: string | undefined): string {
  return text === undefined || text.trim().length === 0 ? "—" : text.trim();
}

function valueText(value: number | undefined): string {
  return value === undefined ? "—" : sciText(value);
}

function listValue(items: readonly string[]): string {
  return items.length === 0 ? "—" : items.join(" · ");
}

function scopeText(groupIds: readonly string[], stateIds: readonly string[]): string {
  const parts = [groupIds.join(", "), stateIds.join(", ")].filter((part) => part.length > 0);
  return parts.length === 0 ? "Every tree" : parts.join(" in ");
}

function changeText(value: number | undefined, base: number | undefined): string {
  if (value === undefined || base === undefined || base === 0) return "—";
  const change = (100 * (value - base)) / base;
  if (change === 0) return "0%";
  return `${change > 0 ? "+" : ""}${Math.abs(change) < 0.01 ? change.toExponential(1).replace("e", "E") : change.toFixed(2)}%`;
}

async function postRun(workbookId: string, revision: number, purpose: EsqPostRunPurpose, cutOff: number, raisedHep?: number): Promise<EsqPostRunResult> {
  const response = await runEsqPost(workbookId, revision, MODEL_AS_SET, purpose, cutOff, raisedHep);
  if (response.run.status !== "SUCCEEDED") throw new Error(response.run.failure?.message ?? "The run did not finish.");
  return getEsqPostResult(workbookId, response.run.id);
}

function ExclusionsPanel({ view, openWindow }: { view: EsqPostView; openWindow: (ctx: EsqWindowContext) => void }): JSX.Element {
  const { esq, editable, runtime, mutateEsq } = useEsqWorkbook();
  const fieldId = useId();
  const [exponent, setExponent] = useState(() => exponentOf(view.run));
  const [openId, setOpenId] = useState("");
  const [wrapRef, wrapWidth] = useElementWidth(0);
  const runner = useRunner();
  const blocked = analysisSaveBlock(runtime);
  const deletions = view.work.deletions;
  const checkable = view.exclusions.some((entry) => entry.checkable);

  function check(): void {
    const workbookId = runtime.workbookId;
    const revision = runtime.revision;
    if (workbookId === null || revision === null) return;
    runner.start(async () => {
      const summary = await postRun(workbookId, revision, "DELETIONS", decade(exponent));
      const problem = postRunProblem(summary, esq);
      if (problem !== undefined) {
        runner.fail(problem, failedTrees(summary));
        return;
      }
      mutateEsq((draft) => withDeletions(draft, summary));
    });
  }

  if (view.exclusions.length === 0) return <p className="posmuted">Step 03 holds no exclusion. Add one there for basic events that cannot occur together.</p>;
  return (
    <div className="esq-run">
      <div className="esq-run__composer" aria-label="Deletion check controls">
        <div className="esq-run__row">
          <div className="esq-run__pickers"><CutOffField id={`${fieldId}-cutoff`} value={exponent} onChange={setExponent} /></div>
          <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" disabled={runner.running || !editable || blocked !== null || !checkable} onClick={check}>
            {runner.running ? "Checking…" : "Check deletions"}
          </button>
        </div>
        <p className="esq-meta">PRAXIS solves every event tree with the exclusions off and lists the cut sets that hold each excluded combination.</p>
      </div>
      <RunState runner={runner} model={view.model} blocked={blocked} />
      <p className="esq-meta">{deletions === undefined ? "The deletions are not checked yet." : `Checked ${dateText(deletions.at)} at a cutoff of ${sciText(deletions.cutOff)} per year.${view.deletionsStale ? " The inputs changed since, so check again." : ""}`}</p>
      <div className="esq-table-wrap" ref={wrapRef}>
        <table className="postable esq-rowtable" aria-label="Exclusions and deletions">
          <thead>
            <tr><th className="esq-rowtable__pick">Details</th><th>Exclusion</th><th>Events</th><th>Cut sets</th><th>Frequency (/yr)</th></tr>
          </thead>
          <tbody>
            {view.exclusions.map((entry) => {
              const exclusion = entry.exclusion;
              const open = exclusion.id === openId;
              const finding = entry.finding;
              return (
                <Fragment key={exclusion.id}>
                  <tr className={rowClass(false, open)} onClick={() => { if (!open) setOpenId(exclusion.id); }}>
                    <td className="esq-rowtable__pick"><DetailToggle open={open} label={exclusion.id} onToggle={() => setOpenId(open ? "" : exclusion.id)} /></td>
                    <td className="esq-rowtable__text">
                      <button type="button" className="esq-rowtable__name" onClick={(event) => { event.stopPropagation(); openWindow({ kind: "esqExclusion", id: exclusion.id }); }}>{exclusion.id}</button>
                    </td>
                    <td className="esq-rowtable__wrap">{listValue(entry.codes)}</td>
                    <td className="esq-rowtable__num">{deletions === undefined || !entry.checkable ? "—" : String(finding?.cutSetCount ?? 0)}</td>
                    <td className="esq-rowtable__num">{finding === undefined ? "—" : sciText(finding.nominalFrequency)}</td>
                  </tr>
                  {open && (
                    <DetailRow span={5} width={wrapWidth - 18}>
                      <FieldList items={[
                        { label: "Basis", value: textValue(exclusion.basis) },
                        { label: "Event trees", value: finding === undefined ? "—" : finding.treeIds.map((treeId) => treeLabel(view.model, treeId)).join(", ") },
                        { label: "Checked", value: entry.checkable ? "Yes" : "Needs two or more events" },
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

function creditText(entry: EsqPostRecoveryView): string {
  const recovery = entry.recovery;
  if (!recovery.credited) return "No";
  if (recovery.missing.length > 0) return "Not feasible";
  if (recovery.value === undefined) return "No HEP";
  if (recovery.eventIds.length === 0) return "No event";
  return "Yes";
}

function RecoveryTable({ view, openWindow }: { view: EsqPostView; openWindow: (ctx: EsqWindowContext) => void }): JSX.Element {
  const [openId, setOpenId] = useState("");
  const [wrapRef, wrapWidth] = useElementWidth(0);
  if (view.recoveries.length === 0) return <p className="posmuted">HR lists no recovery action. Add one for a recovery HR does not hold.</p>;
  return (
    <div className="esq-table-wrap" ref={wrapRef}>
      <table className="postable esq-rowtable" aria-label="Recoveries">
        <thead>
          <tr><th className="esq-rowtable__pick">Details</th><th>Recovery</th><th>Recovers</th><th>Non-recovery HEP</th><th>Credited</th></tr>
        </thead>
        <tbody>
          {view.recoveries.map((entry) => {
            const recovery = entry.recovery;
            const open = recovery.id === openId;
            const record = recovery.record;
            return (
              <Fragment key={recovery.id}>
                <tr className={rowClass(!recovery.credited, open)} onClick={() => { if (!open) setOpenId(recovery.id); }}>
                  <td className="esq-rowtable__pick"><DetailToggle open={open} label={recovery.id} onToggle={() => setOpenId(open ? "" : recovery.id)} /></td>
                  <td className="esq-rowtable__text">
                    <button type="button" className="esq-rowtable__name" onClick={(event) => { event.stopPropagation(); openWindow({ kind: "esqPostRecovery", id: recovery.id }); }}>{recovery.id}</button>
                    {recovery.manual && <span className="esq-rowtable__tag">By hand</span>}
                  </td>
                  <td className="esq-rowtable__wrap">{listValue(entry.codes)}</td>
                  <td className="esq-rowtable__num">{valueText(recovery.value)}</td>
                  <td className="esq-rowtable__text">{creditText(entry)}</td>
                </tr>
                {open && (
                  <DetailRow span={5} width={wrapWidth - 18}>
                    <FieldList items={[
                      { label: "Name", value: textValue(recovery.name) },
                      { label: "HR event", value: record === undefined ? "—" : `${record.hfeId}${entry.hfeName === undefined ? "" : ` · ${entry.hfeName}`}` },
                      { label: "Restores", value: textValue(record?.restoredFunction) },
                      { label: "HEP from", value: recovery.source === undefined ? "Not chosen" : recovery.source === "HRA" ? "HR" : "Typed" },
                      { label: "Feasibility not shown", value: recovery.missing.length === 0 ? "None" : recovery.missing.map((key) => FEASIBILITY_LABELS[key]).join(", ") },
                      { label: "HR dependency", value: record?.dependencyId ?? "—" },
                      { label: "Applies to", value: scopeText(recovery.groupIds, recovery.stateIds) },
                      { label: "Basis", value: textValue(recovery.rule?.basis) },
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

function floorText(row: EsqPostCombinationView): string {
  const entry = row.entry;
  if (entry?.floor === undefined) return "None";
  if (entry.floorApplies) return entry.raw !== undefined && entry.raw < entry.floor ? `${sciText(entry.floor)}, raises the joint` : `${sciText(entry.floor)}, applies`;
  return blank(entry.combination.floorWaiver) ? `${sciText(entry.floor)}, not applied to independent events` : `${sciText(entry.floor)}, waived`;
}

function CombinationsPanel({ view, openWindow }: { view: EsqPostView; openWindow: (ctx: EsqWindowContext) => void }): JSX.Element {
  const { esq, editable, runtime, mutateEsq } = useEsqWorkbook();
  const fieldId = useId();
  const [exponent, setExponent] = useState(() => exponentOf(view.run));
  const [raised, setRaised] = useState(DEFAULT_RAISED_HEP);
  const [openKey, setOpenKey] = useState("");
  const [wrapRef, wrapWidth] = useElementWidth(0);
  const runner = useRunner();
  const blocked = analysisSaveBlock(runtime);
  const search = view.work.search;
  const unassessed = view.combinations.filter((row) => row.entry === undefined);
  const raisedProblem = raised > 0 && raised <= 1 ? undefined : "Raise each HEP to a value above 0 and at most 1.";

  function runSearch(): void {
    const workbookId = runtime.workbookId;
    const revision = runtime.revision;
    if (workbookId === null || revision === null || raisedProblem !== undefined) return;
    runner.start(async () => {
      const summary = await postRun(workbookId, revision, "COMBINATIONS", decade(exponent), raised);
      const problem = postRunProblem(summary, esq);
      if (problem !== undefined) {
        runner.fail(problem, failedTrees(summary));
        return;
      }
      mutateEsq((draft) => withSearch(draft, summary));
    });
  }

  function assess(row: EsqPostCombinationView): void {
    if (!editable) return;
    const id = nextCombinationId(esq);
    mutateEsq((draft) => withCombinationsFor(draft, [row.eventIds]));
    openWindow({ kind: "esqPostCombination", id });
  }

  return (
    <div className="esq-run">
      <div className="esq-run__composer" aria-label="HFE search controls">
        <div className="esq-run__row">
          <div className="esq-run__pickers">
            <label className="esq-run__field esq-run__field--small" htmlFor={`${fieldId}-raised`}>
              <span>Raised HEP</span>
              <input id={`${fieldId}-raised`} type="number" min={0} max={1} step={0.1} value={raised} onChange={(event) => setRaised(Number(event.target.value))} />
            </label>
            <CutOffField id={`${fieldId}-cutoff`} value={exponent} onChange={setExponent} />
          </div>
          <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" disabled={runner.running || !editable || blocked !== null || raisedProblem !== undefined} onClick={runSearch}>
            {runner.running ? "Searching…" : "Search"}
          </button>
        </div>
        <p className="esq-meta">{`PRAXIS solves every event tree with each human failure event at ${raised} and lists the cut sets that hold two or more of them (ESQ-N-8). A value below 1 keeps the success terms.`}</p>
      </div>
      {raisedProblem !== undefined && <p className="esq-run__notice" role="status">{raisedProblem}</p>}
      <RunState runner={runner} model={view.model} blocked={blocked} />
      <div className="esq-bar">
        <p className="esq-meta">{search === undefined ? "No search yet." : `Searched ${dateText(search.at)} with each HEP at ${search.raisedHep} and a cutoff of ${sciText(search.cutOff)} per year. ${search.findings.length} combinations found.${view.searchStale ? " The inputs changed since, so search again." : ""}`}</p>
        {editable && unassessed.length > 0 && (
          <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => mutateEsq((draft) => withCombinationsFor(draft, unassessed.map((row) => row.eventIds)))}>{`Assess all ${unassessed.length}`}</button>
        )}
      </div>
      {view.combinations.length === 0 ? (
        <p className="posmuted">No combination yet. Search the cut sets or add one by hand.</p>
      ) : (
        <div className="esq-table-wrap" ref={wrapRef}>
          <table className="postable esq-rowtable" aria-label="HFE combinations">
            <thead>
              <tr><th className="esq-rowtable__pick">Details</th><th>Combination</th><th>Events</th><th>Joint HEP</th><th>From</th><th>Nominal (/yr)</th></tr>
            </thead>
            <tbody>
              {view.combinations.map((row) => {
                const entry = row.entry;
                const open = row.key === openKey;
                const finding = row.finding;
                const label = entry?.combination.id ?? listValue(row.codes);
                return (
                  <Fragment key={row.key}>
                    <tr className={rowClass(false, open)} onClick={() => { if (!open) setOpenKey(row.key); }}>
                      <td className="esq-rowtable__pick"><DetailToggle open={open} label={label} onToggle={() => setOpenKey(open ? "" : row.key)} /></td>
                      <td className="esq-rowtable__text">
                        {entry !== undefined ? (
                          <button type="button" className="esq-rowtable__name" onClick={(event) => { event.stopPropagation(); openWindow({ kind: "esqPostCombination", id: entry.combination.id }); }}>{entry.combination.id}</button>
                        ) : editable ? (
                          <button type="button" className="esq-rowtable__name" aria-label={`Assess ${listValue(row.codes)}`} onClick={(event) => { event.stopPropagation(); assess(row); }}>Assess</button>
                        ) : "—"}
                      </td>
                      <td className="esq-rowtable__wrap">{listValue(row.codes)}</td>
                      <td className="esq-rowtable__num">{valueText(entry?.joint)}</td>
                      <td className="esq-rowtable__text">{entry === undefined ? "Not assessed" : entry.source === undefined ? "Not chosen" : JOINT_SOURCE_LABELS[entry.source]}</td>
                      <td className="esq-rowtable__num">{valueText(finding?.nominalFrequency)}</td>
                    </tr>
                    {open && (
                      <DetailRow span={6} width={wrapWidth - 18}>
                        <FieldList items={[
                          { label: "Members", value: entry === undefined ? listValue(row.codes) : entry.members.map((member) => `${member.code} ${valueText(member.probability)}`).join(", ") },
                          { label: "Independent", value: valueText(entry?.independent) },
                          { label: "HR assessment", value: entry?.hr === undefined ? entry?.suggested === undefined ? "—" : `None matches. ${entry.suggested.id} holds these events.` : `${entry.hr.id} · ${LEVEL_LABELS[entry.hr.level]} · ${sciText(entry.hr.jointHep)}` },
                          { label: "Dependence level", value: entry?.level === undefined ? "—" : LEVEL_LABELS[entry.level] },
                          { label: "THERP joint", value: valueText(entry?.therp) },
                          { label: "Typed joint", value: entry?.combination.typed === undefined ? "—" : `${sciText(entry.combination.typed.joint)} · ${textValue(entry.combination.typed.source)}` },
                          { label: "Floor", value: floorText(row) },
                          { label: "Event trees", value: finding === undefined ? "—" : String(finding.treeIds.length) },
                          { label: "Cut sets", value: finding === undefined ? "—" : String(finding.cutSetCount) },
                          { label: "Applies to", value: entry === undefined ? "—" : scopeText(entry.combination.groupIds, entry.combination.stateIds) },
                          { label: "Basis", value: textValue(entry?.combination.basis) },
                          { label: "Problem", value: textValue(entry?.problem) },
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

function ResultsPanel({ view }: { view: EsqPostView }): JSX.Element {
  const { esq, editable, runtime, mutateEsq } = useEsqWorkbook();
  const runner = useRunner();
  const blocked = analysisSaveBlock(runtime);
  const run = view.run;
  if (run === undefined) return <p className="posmuted">No run of record yet. Run the model in Step 05 with recovery and HFE dependency as set, and use the run.</p>;
  const request = comparisonRequest(run);
  const comparison = view.work.comparison;

  function compare(): void {
    const workbookId = runtime.workbookId;
    const revision = runtime.revision;
    if (workbookId === null || revision === null || request === undefined) return;
    runner.start(async () => {
      const response = await runEsqModel(workbookId, revision, request.logic, request.calculation, request.cutSets);
      if (response.run.status !== "SUCCEEDED") throw new Error(response.run.failure?.message ?? "The run did not finish.");
      const summary: EsqModelRunResult = await getEsqModelRunResult(workbookId, response.run.id);
      const problem = comparisonProblem(summary, esq);
      if (problem !== undefined) {
        runner.fail(problem, failedTrees(summary));
        return;
      }
      mutateEsq((draft) => withComparison(draft, summary));
    });
  }

  return (
    <div className="esq-run">
      <div className="esq-run__composer" aria-label="Comparison controls">
        <div className="esq-run__row">
          <p className="esq-meta">PRAXIS solves the model again with the settings of the run of record, with recovery and HFE dependency off.</p>
          <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" disabled={runner.running || !editable || blocked !== null || request === undefined} onClick={compare}>
            {runner.running ? "Running…" : "Run without the rules"}
          </button>
        </div>
      </div>
      <RunState runner={runner} model={view.model} blocked={blocked} />
      <p className="esq-meta">{comparison === undefined ? "No comparison yet." : `Compared ${dateText(comparison.at)}.${view.comparisonStale ? " The inputs changed since, so run it again." : ""}`}</p>
      {view.results.length === 0 ? (
        <p className="posmuted">The run of record holds no family value.</p>
      ) : (
        <div className="esq-table-wrap">
          <table className="postable esq-rowtable" aria-label="Families with and without the rules">
            <thead><tr><th>Family</th><th>Without the rules (/yr)</th><th>With the rules (/yr)</th><th>Change</th></tr></thead>
            <tbody>
              {view.results.map((row) => (
                <tr key={row.familyId}>
                  <td className="esq-rowtable__text">{blank(row.name) ? row.familyId : `${row.familyId} · ${row.name}`}</td>
                  <td className="esq-rowtable__num">{valueText(row.without)}</td>
                  <td className="esq-rowtable__num">{valueText(row.withRules)}</td>
                  <td className="esq-rowtable__num">{changeText(row.withRules, row.without)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ChecksTable({ findings, openWindow }: { findings: EsqPostFinding[]; openWindow: (ctx: EsqWindowContext) => void }): JSX.Element {
  if (findings.length === 0) return <p className="posmuted">Every check passes.</p>;
  return (
    <div className="esq-table-wrap">
      <table className="postable esq-rowtable" aria-label="Post-processing checks">
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

function PostScreen({ openWindow }: { openWindow: (ctx: EsqWindowContext) => void }): JSX.Element {
  const { esq, editable, mutateEsq } = useEsqWorkbook();
  const view = useMemo(() => postViewOf(esq), [esq]);
  const [tab, setTab] = useState<PostTab>("exclusions");
  const tabId = useId();
  const count = (n: number): string => (view === undefined ? "" : ` (${n})`);
  const tabs: { id: PostTab; label: string }[] = [
    { id: "exclusions", label: `Exclusions${count(view?.exclusions.length ?? 0)}` },
    { id: "recovery", label: `Recovery${count(view?.recoveries.length ?? 0)}` },
    { id: "combinations", label: `HFE combinations${count(view?.combinations.length ?? 0)}` },
    { id: "results", label: "Results" },
    { id: "checks", label: `Checks${count(view?.findings.length ?? 0)}` },
  ];
  const head = TAB_HEADS[tab];

  function addRecovery(): void {
    const id = nextRecoveryId(esq);
    mutateEsq((draft) => withRecoveryRule(draft, id, { id, manual: { name: "" }, eventIds: [], groupIds: [], stateIds: [], credited: false, basis: "" }));
    openWindow({ kind: "esqPostRecovery", id });
  }

  function addCombination(): void {
    const id = nextCombinationId(esq);
    mutateEsq((draft) => withCombination(draft, id, { id, eventIds: [], groupIds: [], stateIds: [], basis: "" }));
    openWindow({ kind: "esqPostCombination", id });
  }

  return (
    <div className="esq-step">
      <EsqTabs label="Post-processing sections" tabs={tabs} active={tab} onChange={setTab} idBase={tabId} className="esq-step__tabs" />
      <div role="tabpanel" id={`${tabId}-panel`} aria-labelledby={`${tabId}-${tab}`} tabIndex={0} className="esq-step__panel">
        <div className="poscard">
          <div className="poscard__head">
            <WorkbookSectionHeading workbook="ESQ" title={head.title} level={3} />
            <div className="esq-card-actions">
              <EsqProvenanceChip>{head.sr}</EsqProvenanceChip>
              {view !== undefined && tab === "recovery" && editable && (
                <button type="button" className="posnav__btn posnav__btn--sm" onClick={addRecovery}>Add recovery</button>
              )}
              {view !== undefined && tab === "combinations" && (
                <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => openWindow({ kind: "esqPostFloor", id: "floor" })}>Joint floor</button>
              )}
              {view !== undefined && tab === "combinations" && editable && (
                <button type="button" className="posnav__btn posnav__btn--sm" onClick={addCombination}>Add combination</button>
              )}
              {view?.run !== undefined && (tab === "results" || tab === "checks") && (
                <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => openWindow({ kind: "esqSolveRun", id: "run" })}>Run of record</button>
              )}
            </div>
          </div>
          {view === undefined ? (
            <p className="posmuted">Nothing is imported yet. Import the model in Step 02.</p>
          ) : tab === "exclusions" ? (
            <ExclusionsPanel view={view} openWindow={openWindow} />
          ) : tab === "recovery" ? (
            <RecoveryTable view={view} openWindow={openWindow} />
          ) : tab === "combinations" ? (
            <CombinationsPanel view={view} openWindow={openWindow} />
          ) : tab === "results" ? (
            <ResultsPanel view={view} />
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

function probabilityFrom(text: string): number | null | undefined {
  const trimmed = text.trim();
  if (trimmed.length === 0) return undefined;
  const value = Number(trimmed);
  return Number.isFinite(value) && value > 0 && value <= 1 ? value : null;
}

function feasibilityOf(keys: readonly string[]): EsqActionFeasibility {
  return { procedure: keys.includes("procedure"), training: keys.includes("training"), cues: keys.includes("cues"), crew: keys.includes("crew"), time: keys.includes("time"), access: keys.includes("access"), equipment: keys.includes("equipment") };
}

function sameFeasibility(left: EsqActionFeasibility, right: EsqActionFeasibility): boolean {
  return FEASIBILITY_KEYS.every((key) => left[key] === right[key]);
}

function RecoveryWindow({ id, onClose }: { id: string; onClose: () => void }): JSX.Element | null {
  const { esq, editable, mutateEsq } = useEsqWorkbook();
  const fieldId = useId();
  const view = postViewOf(esq);
  const entry = view?.recoveries.find((candidate) => candidate.recovery.id === id);
  if (view === undefined || entry === undefined) return null;
  const recovery = entry.recovery;
  const record = recovery.record;
  const rule = recoveryRuleOf(esq, id);
  const dis = !editable;
  const feasibility = recovery.feasibility ?? NO_FEASIBILITY;
  const memberOptions = view.members.filter((option) => view.hfeIds.includes(option.id)).map((option) => ({ value: option.id, label: option.label }));

  function save(next: EsqRecoveryRule): void {
    if (!editable) return;
    mutateEsq((draft) => withRecoveryRule(draft, id, next));
  }

  function withoutKey(key: "eventIds" | "feasibility" | "typed" | "ofRecord"): EsqRecoveryRule {
    const { [key]: _old, ...rest } = rule;
    return rest;
  }

  return (
    <>
      <ModalHead cap={record === undefined ? "Recovery · typed · ESQ-A7" : "Recovery · HR · ESQ-A7"} title={blank(recovery.name) ? id : `${id} · ${recovery.name}`} onClose={onClose} />
      <div className="modal__body esq-form">
        {rule.manual !== undefined && (
          <FormRow label="Name" htmlFor={`${fieldId}-name`}>
            <WorkbookInput id={`${fieldId}-name`} className="posfield__input" value={rule.manual.name} disabled={dis} onChange={(event) => save({ ...rule, manual: { name: event.target.value } })} />
          </FormRow>
        )}
        <FormRow label="Credit" htmlFor={`${fieldId}-credit`}>
          <select id={`${fieldId}-credit`} className="posfield__select" value={recovery.credited ? "yes" : "no"} disabled={dis} onChange={(event) => save({ ...rule, credited: event.target.value === "yes" })}>
            <option value="no">Not credited</option>
            <option value="yes">Credited</option>
          </select>
        </FormRow>
        <ChecksRow label="Recovers" options={memberOptions} selected={recovery.eventIds} disabled={dis} onChange={(eventIds) => save({ ...rule, eventIds })} />
        {editable && record !== undefined && rule.eventIds !== undefined && (
          <div className="esq-form__actions">
            <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => save(withoutKey("eventIds"))}>{`Use the events bound to ${record.hfeId}`}</button>
          </div>
        )}
        <fieldset className="esq-use">
          <legend className="esq-use__legend">Typed value</legend>
          <FormRow label="Non-recovery HEP" htmlFor={`${fieldId}-typed`}>
            <WorkbookInput id={`${fieldId}-typed`} type="number" className="posfield__input esq-form__number" value={rule.typed?.value ?? ""} disabled={dis} onChange={(event) => {
              const value = probabilityFrom(event.target.value);
              if (value === null) return;
              if (value === undefined) {
                const { typed: _typed, ofRecord, ...rest } = rule;
                save(ofRecord === "TYPED" ? rest : { ...rest, ...(ofRecord === undefined ? {} : { ofRecord }) });
                return;
              }
              save({ ...rule, typed: { ...(rule.typed ?? { source: "" }), value } });
            }} />
          </FormRow>
          {rule.typed !== undefined && (
            <>
              <FormRow label="Error factor" htmlFor={`${fieldId}-ef`}>
                <WorkbookInput id={`${fieldId}-ef`} type="number" className="posfield__input esq-form__number" value={rule.typed.errorFactor ?? ""} disabled={dis} onChange={(event) => {
                  if (rule.typed === undefined) return;
                  const text = event.target.value.trim();
                  const value = Number(text);
                  const { errorFactor: _old, ...typed } = rule.typed;
                  if (text.length === 0) save({ ...rule, typed });
                  else if (Number.isFinite(value) && value >= 1) save({ ...rule, typed: { ...typed, errorFactor: value } });
                }} />
              </FormRow>
              <AreaRow label="Source" value={rule.typed.source} disabled={dis} onChange={(source) => { if (rule.typed !== undefined) save({ ...rule, typed: { ...rule.typed, source } }); }} />
            </>
          )}
        </fieldset>
        <FormRow label="Value of record" htmlFor={`${fieldId}-record`}>
          <select id={`${fieldId}-record`} className="posfield__select" value={recovery.source ?? ""} disabled={dis} onChange={(event) => {
            const value = event.target.value;
            save(value === "HRA" || value === "TYPED" ? { ...rule, ofRecord: value } : withoutKey("ofRecord"));
          }}>
            <option value="">Not chosen</option>
            <option value="HRA" disabled={record?.hep === undefined}>{record?.hep === undefined ? "From HR, none given" : `From HR · ${numberText(record.hep)}`}</option>
            <option value="TYPED" disabled={rule.typed === undefined}>{rule.typed === undefined ? "Typed, none entered" : `Typed · ${numberText(rule.typed.value)}`}</option>
          </select>
        </FormRow>
        <ChecksRow label="Feasibility shown" options={FEASIBILITY_KEYS.map((key) => ({ value: key, label: FEASIBILITY_LABELS[key] }))} selected={FEASIBILITY_KEYS.filter((key) => feasibility[key])} disabled={dis} onChange={(keys) => save({ ...rule, feasibility: feasibilityOf(keys) })} />
        {editable && record !== undefined && rule.feasibility !== undefined && !sameFeasibility(rule.feasibility, record.feasibility) && (
          <div className="esq-form__actions">
            <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => save(withoutKey("feasibility"))}>Use HR feasibility</button>
          </div>
        )}
        <ChecksRow label="Initiator groups" options={view.groups.map((group) => ({ value: group, label: group }))} selected={rule.groupIds} disabled={dis} onChange={(groupIds) => save({ ...rule, groupIds })} />
        <ChecksRow label="Operating states" options={view.states.map((state) => ({ value: state, label: state }))} selected={rule.stateIds} disabled={dis} onChange={(stateIds) => save({ ...rule, stateIds })} />
        <AreaRow label="Basis" value={rule.basis} disabled={dis} onChange={(basis) => save({ ...rule, basis })} />
      </div>
      <FormFoot onClose={onClose}>
        {editable && rule.manual !== undefined && (
          <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => { mutateEsq((draft) => withRecoveryRule(draft, id, undefined)); onClose(); }}>Remove recovery</button>
        )}
      </FormFoot>
    </>
  );
}

function CombinationWindow({ id, onClose }: { id: string; onClose: () => void }): JSX.Element | null {
  const { esq, editable, mutateEsq } = useEsqWorkbook();
  const fieldId = useId();
  const view = postViewOf(esq);
  const entry = view?.combinations.find((candidate) => candidate.entry?.combination.id === id)?.entry;
  if (view === undefined || entry === undefined) return null;
  const combination = entry.combination;
  const dis = !editable;
  const dependencies = view.model.dependencies ?? [];
  const inheritedLevel = entry.hr?.level ?? entry.suggested?.level;

  function save(next: EsqCombination): void {
    if (!editable) return;
    mutateEsq((draft) => withCombination(draft, id, next));
  }

  function withoutKey(key: "dependencyId" | "level" | "typed" | "ofRecord" | "floorWaiver"): EsqCombination {
    const { [key]: _old, ...rest } = combination;
    return rest;
  }

  return (
    <>
      <ModalHead cap="HFE combination · HR · ESQ-C2" title={entry.members.length === 0 ? id : `${id} · ${entry.members.map((member) => member.code).join(" · ")}`} onClose={onClose} />
      <div className="modal__body esq-form">
        {combination.eventIds.map((eventId, index) => (
          <FormRow key={`${eventId}:${index}`} label={`Event ${index + 1}`} htmlFor={`${fieldId}-event-${index}`}>
            <select id={`${fieldId}-event-${index}`} className="posfield__select" value={eventId} disabled={dis} onChange={(event) => save({ ...combination, eventIds: combination.eventIds.map((current, position) => (position === index ? event.target.value : current)) })}>
              {!view.members.some((option) => option.id === eventId) && <option value={eventId}>{`${eventId} · not a human failure event`}</option>}
              {view.members.filter((option) => option.id === eventId || !combination.eventIds.includes(option.id)).map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => save({ ...combination, eventIds: combination.eventIds.filter((_, position) => position !== index) })}>Remove</button>}
          </FormRow>
        ))}
        {editable && view.members.some((option) => !combination.eventIds.includes(option.id)) && (
          <button type="button" className="posnav__btn posnav__btn--sm esq-use__remove" onClick={() => {
            const next = view.members.find((option) => !combination.eventIds.includes(option.id));
            if (next !== undefined) save({ ...combination, eventIds: [...combination.eventIds, next.id] });
          }}>Add event</button>
        )}
        <FormRow label="HR assessment" htmlFor={`${fieldId}-hr`}>
          <select id={`${fieldId}-hr`} className="posfield__select" value={combination.dependencyId ?? ""} disabled={dis} onChange={(event) => save(event.target.value.length === 0 ? withoutKey("dependencyId") : { ...combination, dependencyId: event.target.value })}>
            <option value="">{entry.hr !== undefined && combination.dependencyId === undefined ? `Matched · ${entry.hr.id}` : "None"}</option>
            {dependencies.map((record) => <option key={record.id} value={record.id}>{`${record.id} · ${LEVEL_LABELS[record.level]} · ${numberText(record.jointHep)}`}</option>)}
          </select>
        </FormRow>
        <FormRow label="Dependence level" htmlFor={`${fieldId}-level`}>
          <select id={`${fieldId}-level`} className="posfield__select" value={combination.level ?? ""} disabled={dis} onChange={(event) => {
            const level = DEPENDENCE_LEVELS.find((candidate) => candidate === event.target.value);
            save(level === undefined ? withoutKey("level") : { ...combination, level });
          }}>
            <option value="">{inheritedLevel === undefined ? "Not set" : `From HR · ${LEVEL_LABELS[inheritedLevel]}`}</option>
            {DEPENDENCE_LEVELS.map((level) => <option key={level} value={level}>{LEVEL_LABELS[level]}</option>)}
          </select>
        </FormRow>
        <fieldset className="esq-use">
          <legend className="esq-use__legend">Typed value</legend>
          <FormRow label="Joint HEP" htmlFor={`${fieldId}-typed`}>
            <WorkbookInput id={`${fieldId}-typed`} type="number" className="posfield__input esq-form__number" value={combination.typed?.joint ?? ""} disabled={dis} onChange={(event) => {
              const joint = probabilityFrom(event.target.value);
              if (joint === null) return;
              if (joint === undefined) {
                const { typed: _typed, ofRecord, ...rest } = combination;
                save(ofRecord === "TYPED" ? rest : { ...rest, ...(ofRecord === undefined ? {} : { ofRecord }) });
                return;
              }
              save({ ...combination, typed: { joint, source: combination.typed?.source ?? "" } });
            }} />
          </FormRow>
          {combination.typed !== undefined && (
            <AreaRow label="Source" value={combination.typed.source} disabled={dis} onChange={(source) => { if (combination.typed !== undefined) save({ ...combination, typed: { ...combination.typed, source } }); }} />
          )}
        </fieldset>
        <FormRow label="Value of record" htmlFor={`${fieldId}-record`}>
          <select id={`${fieldId}-record`} className="posfield__select" value={entry.source ?? ""} disabled={dis} onChange={(event) => {
            const value = event.target.value;
            save(value === "HRA" || value === "THERP" || value === "TYPED" ? { ...combination, ofRecord: value } : withoutKey("ofRecord"));
          }}>
            <option value="">Not chosen</option>
            <option value="HRA" disabled={entry.hr === undefined}>{entry.hr === undefined ? "HR assessment, none linked" : `HR assessment · ${numberText(entry.hr.jointHep)}`}</option>
            <option value="THERP" disabled={entry.therp === undefined}>{entry.therp === undefined || entry.level === undefined ? "THERP level, none set" : `THERP at ${LEVEL_LABELS[entry.level].toLowerCase()} · ${numberText(entry.therp)}`}</option>
            <option value="TYPED" disabled={entry.typed === undefined}>{entry.typed === undefined ? "Typed, none entered" : `Typed · ${numberText(entry.typed)}`}</option>
          </select>
        </FormRow>
        <AreaRow label="Floor waiver" value={combination.floorWaiver ?? ""} disabled={dis} onChange={(text) => save(text.trim().length === 0 ? withoutKey("floorWaiver") : { ...combination, floorWaiver: text })} />
        <ChecksRow label="Initiator groups" options={view.groups.map((group) => ({ value: group, label: group }))} selected={combination.groupIds} disabled={dis} onChange={(groupIds) => save({ ...combination, groupIds })} />
        <ChecksRow label="Operating states" options={view.states.map((state) => ({ value: state, label: state }))} selected={combination.stateIds} disabled={dis} onChange={(stateIds) => save({ ...combination, stateIds })} />
        <AreaRow label="Basis" value={combination.basis} disabled={dis} onChange={(basis) => save({ ...combination, basis })} />
      </div>
      <FormFoot onClose={onClose}>
        {editable && (
          <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => { mutateEsq((draft) => withCombination(draft, id, undefined)); onClose(); }}>Remove combination</button>
        )}
      </FormFoot>
    </>
  );
}

function FloorWindow({ onClose }: { onClose: () => void }): JSX.Element | null {
  const { esq, editable, mutateEsq } = useEsqWorkbook();
  const fieldId = useId();
  const view = postViewOf(esq);
  if (view === undefined) return null;
  const typed = view.work.floor;
  const record = view.model.jointFloor;
  const dis = !editable;

  function save(next: { value: number; source: string } | undefined): void {
    if (!editable) return;
    mutateEsq((draft) => withFloor(draft, next));
  }

  return (
    <>
      <ModalHead cap="Joint HEP floor · HR · ESQ-C2" title="Joint HEP floor" onClose={onClose} />
      <div className="modal__body esq-form">
        <FormRow label="From HR">
          <span className="esq-form__unit">{record === undefined ? "HR gives no floor." : `${record.id} sets ${numberText(record.value)}. ${record.justification}`.trim()}</span>
        </FormRow>
        <fieldset className="esq-use">
          <legend className="esq-use__legend">Typed value</legend>
          <FormRow label="Floor" htmlFor={`${fieldId}-floor`}>
            <WorkbookInput id={`${fieldId}-floor`} type="number" className="posfield__input esq-form__number" value={typed?.value ?? ""} disabled={dis} onChange={(event) => {
              const value = probabilityFrom(event.target.value);
              if (value === null) return;
              save(value === undefined ? undefined : { value, source: typed?.source ?? "" });
            }} />
          </FormRow>
          {typed !== undefined && (
            <AreaRow label="Source" value={typed.source} disabled={dis} onChange={(source) => save({ ...typed, source })} />
          )}
        </fieldset>
      </div>
      <FormFoot onClose={onClose} />
    </>
  );
}

function PostWindows({ context, onClose }: { context: EsqWindowContext; onClose: () => void }): JSX.Element | null {
  switch (context.kind) {
    case "esqPostRecovery": return <RecoveryWindow key={context.id} id={context.id} onClose={onClose} />;
    case "esqPostCombination": return <CombinationWindow key={context.id} id={context.id} onClose={onClose} />;
    case "esqPostFloor": return <FloorWindow onClose={onClose} />;
    default: return null;
  }
}

export { PostScreen, PostWindows, POST_WINDOW_KINDS, POST_WINDOW_LABELS };
