import { Fragment, JSX, useId, useMemo, useState } from "react";
import type {
  EsqCaseKind,
  EsqCaseLogic,
  EsqPreOperationalDecision,
  EsqRegisterDecision,
  EsqRegisterKind,
  EsqSensitivityCase,
  EsqSolveLoopChoice,
  EventSequenceQuantification,
} from "interfaces-mef-types/esq/event-sequence-quantification";
import type { EsqModelRunResult } from "interfaces-shared-types/newly-developed-methods/event-tree";
import { importanceGroupsOf } from "interfaces-mef-types/esq/esq-measure-inputs";
import { WorkbookSectionHeading } from "../workbooks/workbookSectionHeading";
import { WorkbookInput, WorkbookTextarea } from "../workbooks/commitOnDeactivateFields";
import { analysisSaveBlock } from "../newly-developed-methods/shared/useAnalysisScope";
import { expressionText, unitText } from "../newly-developed-methods/shared/uncertainText";
import { useEsqWorkbook } from "./esqWorkbookContext";
import { parameterLabelOf } from "./esqModel";
import {
  ChecksRow,
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
import { caseOptions } from "./esqDaLinks";
import {
  CASE_KINDS,
  CASE_KIND_LABELS,
  ORIGINS,
  REGISTER_KIND_LABELS,
  STATUS_LABELS,
  caseCurrentOf,
  caseRunProblem,
  caseRunRequest,
  nextCaseId,
  nextManualId,
  nextManualPreOpId,
  sensitivityViewOf,
  withCase,
  withCaseRun,
  withDecision,
  withImportedDaCases,
  withManualEntry,
  withManualPreOperational,
  withPreOperational,
  type EsqRegisterOrigin,
  type EsqSensitivityView,
  type EsqSensitivityWindowKind,
} from "./esqSensitivity";
import { getEsqSensitivityResult, runEsqSensitivity } from "./esqWorkbookApi";

type SensTab = "register" | "cases" | "results" | "preop" | "checks";

const TAB_HEADS: Record<SensTab, { title: string; sr: string }> = {
  register: { title: "Uncertainty register", sr: "ESQ-E1 · ESQ-C16 · ESQ-F3" },
  cases: { title: "Sensitivity cases", sr: "ESQ-E1 · ESQ-F3" },
  results: { title: "Case results", sr: "ESQ-E1 · ESQ-F3" },
  preop: { title: "Pre-operational assumptions", sr: "ESQ-C17 · ESQ-F5" },
  checks: { title: "Sensitivity checks", sr: "ESQ-E1 · ESQ-C16 · ESQ-C17 · ESQ-F3 · ESQ-F5" },
};

const SENS_WINDOW_KINDS: ReadonlySet<string> = new Set<EsqSensitivityWindowKind>(["esqSensEntry", "esqSensCase", "esqSensPreOp"]);

const SENS_WINDOW_LABELS: Record<EsqSensitivityWindowKind, string> = { esqSensEntry: "Register entry", esqSensCase: "Sensitivity case", esqSensPreOp: "Pre-operational assumption" };

const LOGIC_KEYS: readonly ("flags" | "exclusions" | "expandCcf" | "recovery" | "dependency")[] = ["flags", "exclusions", "expandCcf", "recovery", "dependency"];

const LOGIC_LABELS: Record<(typeof LOGIC_KEYS)[number], string> = {
  flags: "Flags",
  exclusions: "Exclusions",
  expandCcf: "Common cause expansion",
  recovery: "Recovery",
  dependency: "HFE dependency",
};

const LOOP_CHOICES: readonly EsqSolveLoopChoice[] = ["AS_SET", "TRUE", "FALSE"];

const REGISTER_KINDS: readonly EsqRegisterKind[] = ["SOURCE", "ASSUMPTION", "ALTERNATIVE"];

const STATUSES: readonly ("OPEN" | "IN_PROGRESS" | "CLOSED")[] = ["OPEN", "IN_PROGRESS", "CLOSED"];

function blank(text: string | undefined): boolean {
  return text === undefined || text.trim().length === 0;
}

function textValue(text: string | undefined): string {
  return text === undefined || text.trim().length === 0 ? "—" : text.trim();
}

function valueText(value: number | undefined): string {
  return value === undefined ? "—" : sciText(value);
}

function ratioText(value: number | undefined, base: number | undefined): string {
  if (value === undefined || base === undefined || !(base > 0)) return "—";
  return `${String(Number((value / base).toPrecision(3)))}×`;
}

function familyName(view: EsqSensitivityView, familyId: string): string {
  const family = view.families.find((candidate) => candidate.id === familyId);
  return family === undefined || blank(family.name) ? familyId : `${familyId} · ${family.name}`;
}

function changeText(entry: EsqSensitivityCase): string {
  if (entry.kind === "LOGIC") return Object.entries(entry.logic ?? {}).map(([key, value]) => `${key} ${String(value)}`).join(", ") || "No change";
  if (entry.kind === "FLAG") return entry.state === undefined ? "—" : entry.state ? "TRUE" : "FALSE";
  if (entry.kind === "GROUP_FAILED") return "Set TRUE";
  if (entry.kind === "HEP_95TH") return "95th percentile";
  if (entry.value !== undefined) return `To ${sciText(entry.value)}`;
  if (entry.factor !== undefined) return `Times ${String(Number(entry.factor.toPrecision(4)))}`;
  return "—";
}

function useCaseRunner(view: EsqSensitivityView) {
  const { esq, editable, runtime, mutateEsq } = useEsqWorkbook();
  const runner = useRunner();
  const blocked = analysisSaveBlock(runtime);
  const request = view.run === undefined ? undefined : caseRunRequest(view.run);

  async function runOne(caseId: string): Promise<EsqModelRunResult | undefined> {
    const workbookId = runtime.workbookId;
    const revision = runtime.revision;
    if (workbookId === null || revision === null || request === undefined) return undefined;
    const response = await runEsqSensitivity(workbookId, caseId, revision, request.logic, request.calculation, request.cutSets);
    if (response.run.status !== "SUCCEEDED") throw new Error(response.run.failure?.message ?? "The run did not finish.");
    const summary = await getEsqSensitivityResult(workbookId, caseId, response.run.id);
    const problem = caseRunProblem(summary, esq, caseId);
    if (problem !== undefined) {
      runner.fail(`${caseId}: ${problem}`, failedTrees(summary));
      return undefined;
    }
    return summary;
  }

  return {
    runner,
    blocked,
    disabled: runner.running || !editable || blocked !== null || request === undefined,
    run: (caseIds: readonly string[]) => runner.start(async () => {
      const done: { caseId: string; summary: EsqModelRunResult }[] = [];
      try {
        for (const caseId of caseIds) {
          const summary = await runOne(caseId);
          if (summary === undefined) return;
          done.push({ caseId, summary });
        }
      } finally {
        if (done.length > 0) mutateEsq((draft) => done.reduce((next, item) => withCaseRun(next, item.caseId, item.summary), draft));
      }
    }),
  };
}

function RegisterPanel({ view, openWindow }: { view: EsqSensitivityView; openWindow: (ctx: EsqWindowContext) => void }): JSX.Element {
  const fieldId = useId();
  const [origin, setOrigin] = useState<"ALL" | EsqRegisterOrigin>("ALL");
  const [page, setPage] = useState(0);
  const [openId, setOpenId] = useState("");
  const [wrapRef, wrapWidth] = useElementWidth(0);
  const rows = origin === "ALL" ? view.register : view.register.filter((entry) => entry.origin === origin);
  const { current, shown } = pageOf(rows, page);
  return (
    <div className="esq-run">
      <div className="esq-run__composer">
        <div className="esq-run__row">
          <div className="esq-run__pickers">
            <label className="esq-run__field" htmlFor={`${fieldId}-origin`}>
              <span>Element</span>
              <select id={`${fieldId}-origin`} value={origin} onChange={(event) => { setOrigin(ORIGINS.find((entry) => entry === event.target.value) ?? "ALL"); setPage(0); }}>
                <option value="ALL">Every element</option>
                {ORIGINS.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
              </select>
            </label>
          </div>
          <Pager total={rows.length} page={current} onPage={setPage} />
        </div>
        <p className="esq-meta">The model uncertainty sources, assumptions and alternatives of every linked element, with DA's register and HS's uncertainties. Mark the families each could move and whether it is key.</p>
      </div>
      {rows.length === 0 ? (
        <p className="posmuted">No entry. Link the elements in Step 01, or add an ESQ entry.</p>
      ) : (
        <div className="esq-table-wrap" ref={wrapRef}>
          <table className="postable esq-rowtable" aria-label="Uncertainty register">
            <thead><tr><th className="esq-rowtable__pick">Details</th><th>Entry</th><th>From</th><th>Key</th><th>Cases</th></tr></thead>
            <tbody>
              {shown.map((entry) => {
                const open = entry.id === openId;
                const decision = entry.decision;
                const key = decision?.key ?? entry.upstreamKey;
                return (
                  <Fragment key={entry.id}>
                    <tr className={rowClass(decision === undefined, open)} onClick={() => { if (!open) setOpenId(entry.id); }}>
                      <td className="esq-rowtable__pick"><DetailToggle open={open} label={entry.text} onToggle={() => setOpenId(open ? "" : entry.id)} /></td>
                      <td className="esq-rowtable__wrap">
                        <button type="button" className="esq-rowtable__name" onClick={(event) => { event.stopPropagation(); openWindow({ kind: "esqSensEntry", id: entry.id }); }}>{blank(entry.text) ? entry.id : entry.text}</button>
                      </td>
                      <td className="esq-rowtable__text">{`${entry.origin} · ${REGISTER_KIND_LABELS[entry.kind]}`}</td>
                      <td className="esq-rowtable__text">{key ? "Yes" : "No"}</td>
                      <td className="esq-rowtable__num">{String(decision?.caseIds.length ?? 0)}</td>
                    </tr>
                    {open && (
                      <DetailRow span={5} width={wrapWidth - 18}>
                        <FieldList items={[
                          { label: "Id", value: entry.ref ?? entry.id },
                          { label: entry.kind === "ALTERNATIVE" ? "Why not chosen" : entry.kind === "ASSUMPTION" ? "Basis" : "Impact", value: textValue(entry.impact) },
                          { label: "Families it could move", value: decision === undefined ? "Not screened" : decision.familyIds.length === 0 ? "None" : decision.familyIds.map((id) => familyName(view, id)).join(", ") },
                          { label: "Cases", value: decision === undefined || decision.caseIds.length === 0 ? "None" : decision.caseIds.join(", ") },
                          { label: "Reason", value: textValue(decision?.reason) },
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

function CasesPanel({ view, openWindow }: { view: EsqSensitivityView; openWindow: (ctx: EsqWindowContext) => void }): JSX.Element {
  const [openId, setOpenId] = useState("");
  const [wrapRef, wrapWidth] = useElementWidth(0);
  const runs = useCaseRunner(view);
  const runnable = view.cases.filter((entry) => entry.problem === undefined).map((entry) => entry.entry.id);
  const pending = view.cases.filter((entry) => entry.problem === undefined && (entry.entry.run === undefined || entry.stale)).map((entry) => entry.entry.id);
  return (
    <div className="esq-run">
      <div className="esq-run__composer" aria-label="Case run controls">
        <div className="esq-run__row">
          <p className="esq-meta">{view.run === undefined ? "Run the model in Step 05 first. Each case runs with its settings." : `Each case is a PRAXIS run with the settings of the run of record (${view.run.calculation === "EXACT" ? "exact" : "cut sets"}), compared with that run.`}</p>
          <div className="esq-card-actions">
            <button type="button" className="posnav__btn posnav__btn--sm" disabled={runs.disabled || pending.length === 0} onClick={() => runs.run(pending)}>{`Run ${pending.length} pending`}</button>
            <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" disabled={runs.disabled || runnable.length === 0} onClick={() => runs.run(runnable)}>
              {runs.runner.running ? "Running…" : "Run all"}
            </button>
          </div>
        </div>
      </div>
      <RunState runner={runs.runner} model={view.model} blocked={runs.blocked} />
      {view.cases.length === 0 ? (
        <p className="posmuted">No case yet. Add one, or import the DA cases.</p>
      ) : (
        <div className="esq-table-wrap" ref={wrapRef}>
          <table className="postable esq-rowtable" aria-label="Sensitivity cases">
            <thead><tr><th className="esq-rowtable__pick">Details</th><th>Case</th><th>Change</th><th>Release (/yr)</th><th>Run</th></tr></thead>
            <tbody>
              {view.cases.map((entry) => {
                const item = entry.entry;
                const open = item.id === openId;
                const result = view.results.find((row) => row.caseId === item.id);
                return (
                  <Fragment key={item.id}>
                    <tr className={rowClass(entry.problem !== undefined, open)} onClick={() => { if (!open) setOpenId(item.id); }}>
                      <td className="esq-rowtable__pick"><DetailToggle open={open} label={item.name} onToggle={() => setOpenId(open ? "" : item.id)} /></td>
                      <td className="esq-rowtable__wrap">
                        <button type="button" className="esq-rowtable__name" onClick={(event) => { event.stopPropagation(); openWindow({ kind: "esqSensCase", id: item.id }); }}>{blank(item.name) ? item.id : `${item.id} · ${item.name}`}</button>
                        {item.daCaseRef !== undefined && <span className="esq-rowtable__tag">DA</span>}
                      </td>
                      <td className="esq-rowtable__text">{`${entry.targetLabel} · ${changeText(item)}`}</td>
                      <td className="esq-rowtable__num">{valueText(result?.total)}</td>
                      <td>
                        <button type="button" className="esq-rowtable__name" disabled={runs.disabled || entry.problem !== undefined} onClick={(event) => { event.stopPropagation(); runs.run([item.id]); }}>
                          {item.run === undefined ? "Run" : entry.stale ? "Run again" : "Done"}
                        </button>
                      </td>
                    </tr>
                    {open && (
                      <DetailRow span={5} width={wrapWidth - 18}>
                        <FieldList items={[
                          { label: "Kind", value: CASE_KIND_LABELS[item.kind] },
                          { label: "Basis", value: textValue(item.basis) },
                          { label: "From DA", value: item.daCaseRef === undefined ? "No" : item.daCaseRef.caseId },
                          { label: "Ran", value: item.run === undefined ? "Not yet" : `${dateText(item.run.at)}${entry.stale ? ", older than its inputs" : ""}` },
                          { label: "Release total change", value: ratioText(result?.total, view.baseTotal) },
                          { label: "Problem", value: textValue(entry.problem) },
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

function ResultsPanel({ view }: { view: EsqSensitivityView }): JSX.Element {
  const [openId, setOpenId] = useState("");
  const [wrapRef, wrapWidth] = useElementWidth(0);
  if (view.run === undefined) return <p className="posmuted">No run of record yet. Run the model in Step 05 and use the run.</p>;
  if (view.results.length === 0) return <p className="posmuted">No case has run yet.</p>;
  const rows = [...view.results].sort((a, b) => Math.abs(Math.log((b.total ?? 1) / (view.baseTotal || 1))) - Math.abs(Math.log((a.total ?? 1) / (view.baseTotal || 1))));
  return (
    <div className="esq-run">
      <p className="esq-meta">{`The base is the run of record, ${sciText(view.baseTotal)} per year over the release families. Cases are ranked by how far they move the release total.`}</p>
      <div className="esq-table-wrap" ref={wrapRef}>
        <table className="postable esq-rowtable" aria-label="Case results">
          <thead><tr><th className="esq-rowtable__pick">Details</th><th>Case</th><th>Release (/yr)</th><th>Over base</th></tr></thead>
          <tbody>
            {rows.map((row) => {
              const open = row.caseId === openId;
              return (
                <Fragment key={row.caseId}>
                  <tr className={rowClass(false, open)} onClick={() => { if (!open) setOpenId(row.caseId); }}>
                    <td className="esq-rowtable__pick"><DetailToggle open={open} label={row.name} onToggle={() => setOpenId(open ? "" : row.caseId)} /></td>
                    <td className="esq-rowtable__wrap">{blank(row.name) ? row.caseId : `${row.caseId} · ${row.name}`}</td>
                    <td className="esq-rowtable__num">{valueText(row.total)}</td>
                    <td className="esq-rowtable__num">{ratioText(row.total, view.baseTotal)}</td>
                  </tr>
                  {open && (
                    <DetailRow span={4} width={wrapWidth - 18}>
                      <FieldList items={view.families.filter((family) => view.base.has(family.id) || row.values.has(family.id)).map((family) => ({
                        label: familyName(view, family.id),
                        value: `${valueText(view.base.get(family.id))} to ${valueText(row.values.get(family.id))} (${ratioText(row.values.get(family.id), view.base.get(family.id))})`,
                      }))} />
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

function PreOpPanel({ view, openWindow }: { view: EsqSensitivityView; openWindow: (ctx: EsqWindowContext) => void }): JSX.Element {
  const fieldId = useId();
  const [origin, setOrigin] = useState<"ALL" | EsqRegisterOrigin>("ALL");
  const [page, setPage] = useState(0);
  const [openId, setOpenId] = useState("");
  const [wrapRef, wrapWidth] = useElementWidth(0);
  const rows = origin === "ALL" ? view.preOperational : view.preOperational.filter((entry) => entry.origin === origin);
  const { current, shown } = pageOf(rows, page);
  return (
    <div className="esq-run">
      <div className="esq-run__composer">
        <div className="esq-run__row">
          <div className="esq-run__pickers">
            <label className="esq-run__field" htmlFor={`${fieldId}-origin`}>
              <span>Element</span>
              <select id={`${fieldId}-origin`} value={origin} onChange={(event) => { setOrigin(ORIGINS.find((entry) => entry === event.target.value) ?? "ALL"); setPage(0); }}>
                <option value="ALL">Every element</option>
                {ORIGINS.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
              </select>
            </label>
          </div>
          <Pager total={rows.length} page={current} onPage={setPage} />
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="posmuted">No pre-operational assumption.</p>
      ) : (
        <div className="esq-table-wrap" ref={wrapRef}>
          <table className="postable esq-rowtable" aria-label="Pre-operational assumptions">
            <thead><tr><th className="esq-rowtable__pick">Details</th><th>Assumption</th><th>From</th><th>Status</th></tr></thead>
            <tbody>
              {shown.map((entry) => {
                const open = entry.id === openId;
                const status = entry.decision?.status;
                return (
                  <Fragment key={entry.id}>
                    <tr className={rowClass(status === "CLOSED", open)} onClick={() => { if (!open) setOpenId(entry.id); }}>
                      <td className="esq-rowtable__pick"><DetailToggle open={open} label={entry.text} onToggle={() => setOpenId(open ? "" : entry.id)} /></td>
                      <td className="esq-rowtable__wrap">
                        <button type="button" className="esq-rowtable__name" onClick={(event) => { event.stopPropagation(); openWindow({ kind: "esqSensPreOp", id: entry.id }); }}>{blank(entry.text) ? entry.id : entry.text}</button>
                      </td>
                      <td className="esq-rowtable__text">{entry.origin}</td>
                      <td className="esq-rowtable__text">{status === undefined ? "Not set" : STATUS_LABELS[status]}</td>
                    </tr>
                    {open && (
                      <DetailRow span={4} width={wrapWidth - 18}>
                        <FieldList items={[
                          { label: "Id", value: entry.id },
                          { label: "Limitation", value: textValue(entry.limitation) },
                          { label: "Planned closure", value: textValue(entry.closure) },
                          { label: "Status upstream", value: entry.upstreamStatus === undefined ? "—" : STATUS_LABELS[entry.upstreamStatus] },
                          { label: "Closure in ESQ", value: textValue(entry.decision?.closure) },
                          { label: "Cases", value: entry.decision === undefined || entry.decision.caseIds.length === 0 ? "None" : entry.decision.caseIds.join(", ") },
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

function SensScreen({ openWindow }: { openWindow: (ctx: EsqWindowContext) => void }): JSX.Element {
  const { esq, editable, mutateEsq, upstream, daLinks } = useEsqWorkbook();
  const view = useMemo(() => sensitivityViewOf(esq, upstream), [esq, upstream]);
  const [tab, setTab] = useState<SensTab>("register");
  const tabId = useId();
  const daCases = useMemo(() => caseOptions(daLinks ?? []), [daLinks]);
  const count = (n: number): string => (view === undefined ? "" : ` (${n})`);
  const tabs: { id: SensTab; label: string }[] = [
    { id: "register", label: `Register${count(view?.register.length ?? 0)}` },
    { id: "cases", label: `Cases${count(view?.cases.length ?? 0)}` },
    { id: "results", label: `Results${count(view?.results.length ?? 0)}` },
    { id: "preop", label: `Pre-operational${count(view?.preOperational.length ?? 0)}` },
    { id: "checks", label: `Checks${count(view?.findings.length ?? 0)}` },
  ];
  const head = TAB_HEADS[tab];

  function addEntry(): void {
    const id = nextManualId(esq);
    mutateEsq((draft) => withManualEntry(draft, { id, kind: "SOURCE", text: "", impact: "" }));
    openWindow({ kind: "esqSensEntry", id });
  }

  function addCase(): void {
    const id = nextCaseId(esq);
    mutateEsq((draft) => withCase(draft, id, { id, name: "", kind: "PARAMETER", basis: "" }));
    openWindow({ kind: "esqSensCase", id });
  }

  function addAssumption(): void {
    const id = nextManualPreOpId(esq);
    mutateEsq((draft) => withManualPreOperational(draft, { id, text: "", limitation: "" }));
    openWindow({ kind: "esqSensPreOp", id });
  }

  return (
    <div className="esq-step">
      <EsqTabs label="Sensitivity sections" tabs={tabs} active={tab} onChange={setTab} idBase={tabId} className="esq-step__tabs" />
      <div role="tabpanel" id={`${tabId}-panel`} aria-labelledby={`${tabId}-${tab}`} tabIndex={0} className="esq-step__panel">
        <div className="poscard">
          <div className="poscard__head">
            <WorkbookSectionHeading workbook="ESQ" title={head.title} level={3} />
            <div className="esq-card-actions">
              <EsqProvenanceChip>{head.sr}</EsqProvenanceChip>
              {view !== undefined && tab === "register" && editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={addEntry}>Add entry</button>}
              {view !== undefined && tab === "cases" && editable && daCases.length > 0 && (
                <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => mutateEsq((draft) => withImportedDaCases(draft, daCases))}>Import DA cases</button>
              )}
              {view !== undefined && tab === "cases" && editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={addCase}>Add case</button>}
              {view !== undefined && tab === "preop" && editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={addAssumption}>Add assumption</button>}
            </div>
          </div>
          {view === undefined ? (
            <p className="posmuted">Nothing is imported yet. Import the model in Step 02.</p>
          ) : tab === "register" ? (
            <RegisterPanel view={view} openWindow={openWindow} />
          ) : tab === "cases" ? (
            <CasesPanel view={view} openWindow={openWindow} />
          ) : tab === "results" ? (
            <ResultsPanel view={view} />
          ) : tab === "preop" ? (
            <PreOpPanel view={view} openWindow={openWindow} />
          ) : (
            <FindingsTable label="Sensitivity checks" findings={view.findings} openWindow={openWindow} />
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

function EntryWindow({ id, onClose }: { id: string; onClose: () => void }): JSX.Element | null {
  const { esq, editable, mutateEsq, upstream } = useEsqWorkbook();
  const fieldId = useId();
  const view = sensitivityViewOf(esq, upstream);
  const entry = view?.register.find((candidate) => candidate.id === id);
  if (view === undefined || entry === undefined) return null;
  const decision: EsqRegisterDecision = entry.decision ?? { id, familyIds: [], caseIds: [], reason: "" };
  const manual = esq.sensitivityWork?.manual?.find((item) => item.id === id);
  const dis = !editable;

  function save(next: EsqRegisterDecision): void {
    if (!editable) return;
    mutateEsq((draft) => withDecision(draft, id, next));
  }

  return (
    <>
      <ModalHead cap={`${entry.origin} · ${REGISTER_KIND_LABELS[entry.kind]} · ESQ-E1`} title={entry.ref ?? entry.id} onClose={onClose} />
      <div className="modal__body esq-form">
        {manual !== undefined ? (
          <>
            <FormRow label="Kind" htmlFor={`${fieldId}-kind`}>
              <select id={`${fieldId}-kind`} className="posfield__select" value={manual.kind} disabled={dis} onChange={(event) => {
                const kind = REGISTER_KINDS.find((candidate) => candidate === event.target.value);
                if (kind !== undefined) mutateEsq((draft) => withManualEntry(draft, { ...manual, kind }));
              }}>
                <option value="SOURCE">Uncertainty source</option>
                <option value="ASSUMPTION">Assumption</option>
                <option value="ALTERNATIVE">Alternative</option>
              </select>
            </FormRow>
            <AreaRow label="Text" value={manual.text} disabled={dis} onChange={(text) => mutateEsq((draft) => withManualEntry(draft, { ...manual, text }))} />
            <AreaRow label="Impact" value={manual.impact} disabled={dis} onChange={(impact) => mutateEsq((draft) => withManualEntry(draft, { ...manual, impact }))} />
          </>
        ) : (
          <>
            <FormRow label="Text"><span className="esq-form__unit">{textValue(entry.text)}</span></FormRow>
            <FormRow label={entry.kind === "ALTERNATIVE" ? "Why not chosen" : entry.kind === "ASSUMPTION" ? "Basis" : "Impact"}><span className="esq-form__unit">{textValue(entry.impact)}</span></FormRow>
          </>
        )}
        <FormRow label="Key source" htmlFor={`${fieldId}-key`}>
          <select id={`${fieldId}-key`} className="posfield__select" value={decision.key === undefined ? "" : decision.key ? "yes" : "no"} disabled={dis} onChange={(event) => {
            const value = event.target.value;
            const { key: _old, ...rest } = decision;
            save(value === "" ? rest : { ...rest, key: value === "yes" });
          }}>
            <option value="">{`As ${entry.origin} marks it · ${entry.upstreamKey ? "key" : "not key"}`}</option>
            <option value="yes">Key</option>
            <option value="no">Not key</option>
          </select>
        </FormRow>
        <ChecksRow label="Families it could move" options={view.families.map((family) => ({ value: family.id, label: familyName(view, family.id) }))} selected={decision.familyIds} disabled={dis} onChange={(familyIds) => save({ ...decision, familyIds })} />
        <ChecksRow label="Cases" options={view.cases.map((item) => ({ value: item.entry.id, label: blank(item.entry.name) ? item.entry.id : `${item.entry.id} · ${item.entry.name}` }))} selected={decision.caseIds} disabled={dis} onChange={(caseIds) => save({ ...decision, caseIds })} />
        <AreaRow label="Reason" value={decision.reason} disabled={dis} onChange={(reason) => save({ ...decision, reason })} />
      </div>
      <FormFoot onClose={onClose}>
        {editable && entry.decision !== undefined && manual === undefined && (
          <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => mutateEsq((draft) => withDecision(draft, id, undefined))}>Clear decision</button>
        )}
        {editable && manual !== undefined && (
          <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => { mutateEsq((draft) => withManualEntry(draft, manual, true)); onClose(); }}>Remove entry</button>
        )}
      </FormFoot>
    </>
  );
}

function targetOptions(esq: EventSequenceQuantification, kind: EsqCaseKind): { value: string; label: string }[] {
  const model = esq.model;
  if (model === undefined) return [];
  switch (kind) {
    case "PARAMETER": return model.parameters.map((parameter) => ({ value: parameter.id, label: `${parameter.name} (${parameter.id})` }));
    case "CCF_TOTAL": return model.ccfGroups.map((group) => ({ value: group.id, label: `${group.name} (${group.id})` }));
    case "HEP": return model.humanEvents.map((human) => ({ value: human.id, label: `${human.name} (${human.id})` }));
    case "EVENT": return model.events.map((event) => ({ value: event.id, label: blank(event.name) ? event.code : `${event.code} · ${event.name}` }));
    case "GROUP_FAILED": return importanceGroupsOf(esq).map((group) => ({ value: group.key, label: group.label }));
    case "FLAG": return (esq.logic?.flags ?? []).map((flag) => ({ value: flag.id, label: flag.name }));
    default: return [];
  }
}

function CaseWindow({ id, onClose }: { id: string; onClose: () => void }): JSX.Element | null {
  const { esq, editable, mutateEsq, upstream } = useEsqWorkbook();
  const fieldId = useId();
  const view = sensitivityViewOf(esq, upstream);
  const item = view?.cases.find((candidate) => candidate.entry.id === id);
  if (view === undefined || item === undefined) return null;
  const entry = item.entry;
  const dis = !editable;
  const options = targetOptions(esq, entry.kind);
  const usesValue = entry.kind === "PARAMETER" || entry.kind === "CCF_TOTAL" || entry.kind === "HEP" || entry.kind === "EVENT";
  const now = caseCurrentOf(esq, entry);
  const label = parameterLabelOf(esq);
  const nowText = now === undefined ? undefined : now.expression !== undefined ? expressionText(now.expression, label) : now.value !== undefined ? sciText(now.value) : "No value";

  function save(next: EsqSensitivityCase): void {
    if (!editable) return;
    mutateEsq((draft) => withCase(draft, id, next));
  }

  function without(...keys: ("target" | "value" | "factor" | "state" | "logic")[]): EsqSensitivityCase {
    const next: EsqSensitivityCase = { ...entry };
    for (const key of keys) delete next[key];
    return next;
  }

  function setLogic(key: (typeof LOGIC_KEYS)[number], text: string): void {
    const logic: EsqCaseLogic = { ...(entry.logic ?? {}) };
    if (text === "") delete logic[key];
    else logic[key] = text === "on";
    save({ ...entry, logic });
  }

  return (
    <>
      <ModalHead cap={`Sensitivity case · ${CASE_KIND_LABELS[entry.kind]} · ESQ-E1`} title={blank(entry.name) ? entry.id : `${entry.id} · ${entry.name}`} onClose={onClose} />
      <div className="modal__body esq-form">
        <FormRow label="Name" htmlFor={`${fieldId}-name`}>
          <WorkbookInput id={`${fieldId}-name`} className="posfield__input" value={entry.name} disabled={dis} onChange={(event) => save({ ...entry, name: event.target.value })} />
        </FormRow>
        <FormRow label="Kind" htmlFor={`${fieldId}-kind`}>
          <select id={`${fieldId}-kind`} className="posfield__select" value={entry.kind} disabled={dis} onChange={(event) => {
            const kind = CASE_KINDS.find((candidate) => candidate === event.target.value);
            if (kind !== undefined) save({ ...without("target", "value", "factor", "state", "logic"), kind });
          }}>
            {CASE_KINDS.map((kind) => <option key={kind} value={kind}>{CASE_KIND_LABELS[kind]}</option>)}
          </select>
        </FormRow>
        {entry.kind !== "LOGIC" && entry.kind !== "HEP_95TH" && (
          <FormRow label="Target" htmlFor={`${fieldId}-target`}>
            <select id={`${fieldId}-target`} className="posfield__select" value={entry.target ?? ""} disabled={dis} onChange={(event) => save(event.target.value.length === 0 ? without("target") : { ...entry, target: event.target.value })}>
              <option value="">Choose</option>
              {entry.target !== undefined && !options.some((option) => option.value === entry.target) && <option value={entry.target}>{`${entry.target} · not in the model`}</option>}
              {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </FormRow>
        )}
        {usesValue && (
          <>
            {nowText !== undefined && <FormRow label="Value now"><span className="esq-form__note">{nowText}</span></FormRow>}
            <FormRow label="New value" htmlFor={`${fieldId}-value`}>
              <WorkbookInput id={`${fieldId}-value`} type="number" className="posfield__input esq-form__number" value={entry.value ?? ""} disabled={dis} onChange={(event) => {
                const text = event.target.value.trim();
                const value = Number(text);
                if (text.length === 0) save(without("value"));
                else if (Number.isFinite(value) && value >= 0) save({ ...without("factor"), value });
              }} />
              {now !== undefined && <span className="esq-form__unit">{unitText(now.unit)}</span>}
            </FormRow>
            <FormRow label="Or a factor" htmlFor={`${fieldId}-factor`}>
              <WorkbookInput id={`${fieldId}-factor`} type="number" className="posfield__input esq-form__number" value={entry.factor ?? ""} disabled={dis} onChange={(event) => {
                const text = event.target.value.trim();
                const factor = Number(text);
                if (text.length === 0) save(without("factor"));
                else if (Number.isFinite(factor) && factor > 0) save({ ...without("value"), factor });
              }} />
            </FormRow>
            {now?.expression !== undefined && <p className="esq-meta">A new value replaces the distribution with a point. A factor scales the whole value and keeps its distribution.</p>}
          </>
        )}
        {entry.kind === "FLAG" && (
          <FormRow label="Flag state" htmlFor={`${fieldId}-state`}>
            <select id={`${fieldId}-state`} className="posfield__select" value={entry.state === undefined ? "" : entry.state ? "true" : "false"} disabled={dis} onChange={(event) => save(event.target.value === "" ? without("state") : { ...entry, state: event.target.value === "true" })}>
              <option value="">Choose</option>
              <option value="true">TRUE</option>
              <option value="false">FALSE</option>
            </select>
          </FormRow>
        )}
        {entry.kind === "LOGIC" && (
          <fieldset className="esq-use">
            <legend className="esq-use__legend">Logic in this case</legend>
            {LOGIC_KEYS.map((key) => (
              <FormRow key={key} label={LOGIC_LABELS[key]} htmlFor={`${fieldId}-${key}`}>
                <select id={`${fieldId}-${key}`} className="posfield__select" value={entry.logic?.[key] === undefined ? "" : entry.logic[key] ? "on" : "off"} disabled={dis} onChange={(event) => setLogic(key, event.target.value)}>
                  <option value="">As in the run of record</option>
                  <option value="on">On</option>
                  <option value="off">Off</option>
                </select>
              </FormRow>
            ))}
            <FormRow label="Loop breaks" htmlFor={`${fieldId}-loops`}>
              <select id={`${fieldId}-loops`} className="posfield__select" value={entry.logic?.loopBreaks ?? ""} disabled={dis} onChange={(event) => {
                const choice = LOOP_CHOICES.find((candidate) => candidate === event.target.value);
                const logic: EsqCaseLogic = { ...(entry.logic ?? {}) };
                if (choice === undefined) delete logic.loopBreaks;
                else logic.loopBreaks = choice;
                save({ ...entry, logic });
              }}>
                <option value="">As in the run of record</option>
                <option value="AS_SET">As set in Step 03</option>
                <option value="TRUE">All TRUE</option>
                <option value="FALSE">All FALSE</option>
              </select>
            </FormRow>
          </fieldset>
        )}
        <AreaRow label="Basis" value={entry.basis} disabled={dis} onChange={(basis) => save({ ...entry, basis })} />
        {item.problem !== undefined && <p className="esq-run__notice" role="status">{item.problem}</p>}
      </div>
      <FormFoot onClose={onClose}>
        {editable && (
          <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => { mutateEsq((draft) => withCase(draft, id, undefined)); onClose(); }}>Remove case</button>
        )}
      </FormFoot>
    </>
  );
}

function PreOpWindow({ id, onClose }: { id: string; onClose: () => void }): JSX.Element | null {
  const { esq, editable, mutateEsq, upstream } = useEsqWorkbook();
  const fieldId = useId();
  const view = sensitivityViewOf(esq, upstream);
  const entry = view?.preOperational.find((candidate) => candidate.id === id);
  if (view === undefined || entry === undefined) return null;
  const decision: EsqPreOperationalDecision = entry.decision ?? { id, closure: "", caseIds: [] };
  const manual = esq.sensitivityWork?.manualPreOperational?.find((item) => item.id === id);
  const dis = !editable;

  function save(next: EsqPreOperationalDecision): void {
    if (!editable) return;
    mutateEsq((draft) => withPreOperational(draft, id, next));
  }

  return (
    <>
      <ModalHead cap={`Pre-operational assumption · ${entry.origin} · ESQ-C17`} title={entry.id} onClose={onClose} />
      <div className="modal__body esq-form">
        {manual !== undefined ? (
          <>
            <AreaRow label="Assumption" value={manual.text} disabled={dis} onChange={(text) => mutateEsq((draft) => withManualPreOperational(draft, { ...manual, text }))} />
            <AreaRow label="Limitation" value={manual.limitation} disabled={dis} onChange={(limitation) => mutateEsq((draft) => withManualPreOperational(draft, { ...manual, limitation }))} />
          </>
        ) : (
          <>
            <FormRow label="Assumption"><span className="esq-form__unit">{textValue(entry.text)}</span></FormRow>
            <FormRow label="Limitation"><span className="esq-form__unit">{textValue(entry.limitation)}</span></FormRow>
            <FormRow label="Planned closure"><span className="esq-form__unit">{textValue(entry.closure)}</span></FormRow>
          </>
        )}
        <FormRow label="Status" htmlFor={`${fieldId}-status`}>
          <select id={`${fieldId}-status`} className="posfield__select" value={decision.status ?? ""} disabled={dis} onChange={(event) => {
            const status = STATUSES.find((candidate) => candidate === event.target.value);
            const { status: _old, ...rest } = decision;
            save(status === undefined ? rest : { ...rest, status });
          }}>
            <option value="">Not set</option>
            <option value="OPEN">Open</option>
            <option value="IN_PROGRESS">In progress</option>
            <option value="CLOSED">Closed</option>
          </select>
        </FormRow>
        <AreaRow label="Closure" value={decision.closure} disabled={dis} onChange={(closure) => save({ ...decision, closure })} />
        <ChecksRow label="Cases" options={view.cases.map((item) => ({ value: item.entry.id, label: blank(item.entry.name) ? item.entry.id : `${item.entry.id} · ${item.entry.name}` }))} selected={decision.caseIds} disabled={dis} onChange={(caseIds) => save({ ...decision, caseIds })} />
      </div>
      <FormFoot onClose={onClose}>
        {editable && manual !== undefined && (
          <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => { mutateEsq((draft) => withManualPreOperational(draft, manual, true)); onClose(); }}>Remove assumption</button>
        )}
      </FormFoot>
    </>
  );
}

function SensWindows({ context, onClose }: { context: EsqWindowContext; onClose: () => void }): JSX.Element | null {
  switch (context.kind) {
    case "esqSensEntry": return <EntryWindow key={context.id} id={context.id} onClose={onClose} />;
    case "esqSensCase": return <CaseWindow key={context.id} id={context.id} onClose={onClose} />;
    case "esqSensPreOp": return <PreOpWindow key={context.id} id={context.id} onClose={onClose} />;
    default: return null;
  }
}

export { SensScreen, SensWindows, SENS_WINDOW_KINDS, SENS_WINDOW_LABELS };
