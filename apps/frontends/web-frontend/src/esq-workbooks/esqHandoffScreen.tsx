import { Fragment, JSX, useId, useMemo, useState } from "react";
import type { EsqHandoffResponse, EsqResponseStatus } from "interfaces-mef-types/esq/event-sequence-quantification";
import { cellValueOfRecord } from "interfaces-mef-types/esq/esq-barrier-inputs";
import { resolvedCombinations } from "interfaces-mef-types/esq/esq-post-inputs";
import { WorkbookCueLabel, WorkbookSectionHeading } from "../workbooks/workbookSectionHeading";
import { WorkbookTextarea } from "../workbooks/commitOnDeactivateFields";
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
  dateText,
  rowClass,
  sciText,
  useElementWidth,
  useRunner,
} from "./esqShared";
import type { EsqWindowContext } from "./esqModelScreen";
import { caseOptions } from "./esqDaLinks";
import { SOURCE_LABELS } from "./esqSolve";
import { fourDigits } from "./esqResults";
import { END_STATE_LABELS } from "./esqViewData";
import {
  OWNER_ELEMENTS,
  RESPONSE_LABELS,
  handoffViewOf,
  handoffWorkOf,
  publishEsq,
  withResponse,
  type EsqHandoffView,
  type EsqHandoffWindowKind,
} from "./esqHandoff";
import { getEsqImportanceResult, getEsqModelRunResult } from "./esqWorkbookApi";

type HandoffTab = "summary" | "ri" | "ms" | "da" | "hrie" | "responses" | "checks";

const TAB_HEADS: Record<HandoffTab, { title: string; sr: string }> = {
  summary: { title: "Family package", sr: "ESQ-F1 · RI-B1" },
  ri: { title: "To risk integration", sr: "RI-B1 · RI-B3 · ESQ-F2" },
  ms: { title: "To mechanistic source terms", sr: "ESQ-F1" },
  da: { title: "To data analysis", sr: "DA-D3" },
  hrie: { title: "To HR and IE", sr: "HR-G1 · IE-C19" },
  responses: { title: "RI feedback and responses", sr: "RI-B3 · ESQ-F1" },
  checks: { title: "Hand-off checks", sr: "ESQ-F1" },
};

const HANDOFF_WINDOW_KINDS: ReadonlySet<string> = new Set<EsqHandoffWindowKind>(["esqHandoffResponse"]);

const HANDOFF_WINDOW_LABELS: Record<EsqHandoffWindowKind, string> = { esqHandoffResponse: "Response to RI" };

const STATUSES: readonly EsqResponseStatus[] = ["PENDING", "IN_PROGRESS", "COMPLETED"];

function blank(text: string | undefined): boolean {
  return text === undefined || text.trim().length === 0;
}

function textValue(text: string | undefined): string {
  return text === undefined || text.trim().length === 0 ? "—" : text.trim();
}

function valueText(value: number | undefined): string {
  return value === undefined ? "—" : sciText(value);
}

function measureText(value: number | undefined): string {
  return value === undefined ? "—" : fourDigits(value);
}

function listText(items: readonly string[]): string {
  return items.length === 0 ? "—" : items.join(", ");
}

function familyLabel(view: EsqHandoffView, familyId: string): string {
  const row = view.families.find((entry) => entry.family.id === familyId);
  return row === undefined || blank(row.family.name) ? familyId : `${familyId} · ${row.family.name}`;
}

function SummaryPanel({ view }: { view: EsqHandoffView }): JSX.Element {
  const { esq, editable, runtime, mutateEsq, upstream, daLinks } = useEsqWorkbook();
  const [openId, setOpenId] = useState("");
  const [wrapRef, wrapWidth] = useElementWidth(0);
  const runner = useRunner();
  const blocked = analysisSaveBlock(runtime);
  const published = view.work.published;
  const shown = view.families.filter((row) => row.value !== undefined || row.family.members.length > 0);

  function publish(): void {
    const workbookId = runtime.workbookId;
    const revision = runtime.revision;
    if (workbookId === null || revision === null) return;
    runner.start(async () => {
      const record = esq.review?.importance;
      const importance = record === undefined ? undefined : await getEsqImportanceResult(workbookId, record.runId);
      const runId = view.run?.runId;
      const summary = runId === undefined ? undefined : await getEsqModelRunResult(workbookId, runId);
      const daCases = caseOptions(daLinks ?? []);
      const at = new Date().toISOString();
      mutateEsq((draft) => publishEsq(draft, {
        upstream,
        daCases,
        at,
        revision,
        ...(importance === undefined ? {} : { importance }),
        ...(summary === undefined ? {} : { summary }),
      }));
    });
  }

  return (
    <div className="esq-run">
      <div className="esq-run__composer" aria-label="Publish controls">
        <div className="esq-run__row">
          <p className="esq-meta">Publishing writes the family frequencies with their percentiles and contributors, the importance measures, the uncertainty register, the cases and the pre-operational assumptions where RI, DA and the other elements read them.</p>
          <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" disabled={runner.running || !editable || blocked !== null || view.run === undefined} onClick={publish}>
            {runner.running ? "Publishing…" : "Publish"}
          </button>
        </div>
      </div>
      {blocked !== null && <p className="esq-run__notice" role="status">{blocked}</p>}
      {runner.error !== null && <p className="esq-run__error" role="alert">{runner.error}</p>}
      <p className="esq-meta">{published === undefined ? "Not published yet." : `Published ${dateText(published.at)} from revision ${published.revision}: ${published.families} families and ${published.measures} importance measures.${view.publishedStale ? " The workbook changed since, so publish again." : ""}`}</p>
      {shown.length === 0 ? (
        <p className="posmuted">No family has a value yet. Solve the model in Step 05.</p>
      ) : (
        <div className="esq-table-wrap" ref={wrapRef}>
          <table className="postable esq-rowtable" aria-label="Family package">
            <thead><tr><th className="esq-rowtable__pick">Details</th><th>Family</th><th>Value of record (/yr)</th><th>Mean (/yr)</th><th>95th (/yr)</th></tr></thead>
            <tbody>
              {shown.map((row) => {
                const open = row.family.id === openId;
                return (
                  <Fragment key={row.family.id}>
                    <tr className={rowClass(row.value === undefined, open)} onClick={() => { if (!open) setOpenId(row.family.id); }}>
                      <td className="esq-rowtable__pick"><DetailToggle open={open} label={row.family.id} onToggle={() => setOpenId(open ? "" : row.family.id)} /></td>
                      <td className="esq-rowtable__text">
                        {familyLabel(view, row.family.id)}
                        {row.family.release && <span className="esq-rowtable__tag">Release</span>}
                      </td>
                      <td className="esq-rowtable__num">{valueText(row.value)}</td>
                      <td className="esq-rowtable__num">{valueText(row.mean)}</td>
                      <td className="esq-rowtable__num">{valueText(row.p95)}</td>
                    </tr>
                    {open && (
                      <DetailRow span={5} width={wrapWidth - 18}>
                        <FieldList items={[
                          { label: "Value from", value: row.source === undefined ? "—" : SOURCE_LABELS[row.source] },
                          { label: "Sent as", value: row.sokc && esq.capabilityCategory !== "CC-I" ? "Mean with shared draws" : "Point value" },
                          { label: "5th percentile", value: valueText(row.p05) },
                          { label: "Median", value: valueText(row.p50) },
                          { label: "End state", value: row.family.endState === undefined ? "—" : END_STATE_LABELS[row.family.endState] ?? row.family.endState },
                          { label: "Release category", value: row.family.releaseCategoryId ?? "—" },
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

function RiPanel({ view }: { view: EsqHandoffView }): JSX.Element {
  const { esq } = useEsqWorkbook();
  const [openId, setOpenId] = useState("");
  const [wrapRef, wrapWidth] = useElementWidth(0);
  const coverage = esq.modelIntegration.scopeCoverage;
  const modules = esq.quantificationPlan?.modulesPerPlant;
  const rows = view.families.filter((row) => row.value !== undefined);
  const published = new Map(esq.familyQuantifications.map((record) => [record.eventSequenceFamilyRef, record]));
  const familyMeasures = new Map((esq.importanceAnalyses ?? []).filter((record) => record.familyRef !== undefined).map((record) => [record.familyRef ?? "", record.measures.length]));
  if (rows.length === 0) return <p className="posmuted">No family has a value yet.</p>;
  return (
    <div className="esq-run">
      <p className="esq-meta">RI keys each family to its ES family and reads the published statistics, contributors and importance. Contributors are named "name (id)" so RI matches them across families.</p>
      <div className="esq-table-wrap" ref={wrapRef}>
        <table className="postable esq-rowtable" aria-label="To risk integration">
          <thead><tr><th className="esq-rowtable__pick">Details</th><th>Family</th><th>Release category</th><th>Contributors</th></tr></thead>
          <tbody>
            {rows.map((row) => {
              const open = row.family.id === openId;
              const record = published.get(row.family.id);
              return (
                <Fragment key={row.family.id}>
                  <tr className={rowClass(record === undefined, open)} onClick={() => { if (!open) setOpenId(row.family.id); }}>
                    <td className="esq-rowtable__pick"><DetailToggle open={open} label={row.family.id} onToggle={() => setOpenId(open ? "" : row.family.id)} /></td>
                    <td className="esq-rowtable__text">{familyLabel(view, row.family.id)}</td>
                    <td className="esq-rowtable__text">{row.family.releaseCategoryId ?? "—"}</td>
                    <td className="esq-rowtable__num">{record?.contributionBreakdown === undefined ? "—" : String(record.contributionBreakdown.length)}</td>
                  </tr>
                  {open && (
                    <DetailRow span={4} width={wrapWidth - 18}>
                      <FieldList items={[
                        { label: "Operating states", value: listText(row.family.stateIds) },
                        { label: "Initiators", value: listText(row.family.initiatorIds) },
                        { label: "Hazard groups", value: listText(coverage.hazardGroups) },
                        { label: "Sources", value: listText(row.family.sourceIds) },
                        { label: "Modules per plant", value: modules === undefined ? "—" : String(modules.value) },
                        { label: "Published mean (/yr)", value: record === undefined ? "Not published" : sciText(typeof record.meanFrequency === "number" ? record.meanFrequency : record.meanFrequency.value) },
                        { label: "Published 5th to 95th", value: record?.percentile05 === undefined || record.percentile95 === undefined ? "—" : `${sciText(record.percentile05)} to ${sciText(record.percentile95)}` },
                        { label: "Importance measures", value: String(familyMeasures.get(row.family.id) ?? 0) },
                        { label: "Converged at (/yr)", value: valueText(row.convergedAt) },
                        { label: "Register entries", value: String(row.register) },
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

function MsPanel({ view }: { view: EsqHandoffView }): JSX.Element {
  const { esq } = useEsqWorkbook();
  const [openId, setOpenId] = useState("");
  const [wrapRef, wrapWidth] = useElementWidth(0);
  const rows = view.families.filter((row) => row.family.release);
  const barriers = new Map((esq.barrierWork?.barriers ?? []).flatMap((barrier) => barrier.modes.map((mode): [string, string] => [`${barrier.barrierId}|${mode.id}`, `${barrier.barrierId} · ${mode.name}`])));
  if (rows.length === 0) return <p className="posmuted">No release family.</p>;
  return (
    <div className="esq-run">
      <p className="esq-meta">MS receives each release family with its release category and the barrier failure modes Step 04 quantified for it. MS does not read ESQ yet, so this list is the record of what it is given.</p>
      <div className="esq-table-wrap" ref={wrapRef}>
        <table className="postable esq-rowtable" aria-label="To mechanistic source terms">
          <thead><tr><th className="esq-rowtable__pick">Details</th><th>Family</th><th>Release category</th><th>Barrier modes</th></tr></thead>
          <tbody>
            {rows.map((row) => {
              const open = row.family.id === openId;
              return (
                <Fragment key={row.family.id}>
                  <tr className={rowClass(row.family.releaseCategoryId === undefined, open)} onClick={() => { if (!open) setOpenId(row.family.id); }}>
                    <td className="esq-rowtable__pick"><DetailToggle open={open} label={row.family.id} onToggle={() => setOpenId(open ? "" : row.family.id)} /></td>
                    <td className="esq-rowtable__text">{familyLabel(view, row.family.id)}</td>
                    <td className="esq-rowtable__text">{row.family.releaseCategoryId ?? "None"}</td>
                    <td className="esq-rowtable__num">{String(row.cells.length)}</td>
                  </tr>
                  {open && (
                    <DetailRow span={4} width={wrapWidth - 18}>
                      <FieldList items={row.cells.length === 0 ? [{ label: "Barrier modes", value: "None quantified for this family" }] : row.cells.map((cell) => ({
                        label: `${cell.id} · ${barriers.get(`${cell.barrierId}|${cell.modeId}`) ?? `${cell.barrierId} · ${cell.modeId}`}`,
                        value: `${valueText(cellValueOfRecord(cell))} · ${cell.variable}${blank(cell.unit) ? "" : ` (${cell.unit})`}`,
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

function DaPanel({ view }: { view: EsqHandoffView }): JSX.Element {
  const { esq } = useEsqWorkbook();
  const overall = (esq.importanceAnalyses ?? []).find((record) => record.scope === "OVERALL");
  const measures = (overall?.measures ?? []).filter((measure) => measure.dataAnalysisParameterRef !== undefined);
  return (
    <div className="esq-run">
      <p className="esq-meta">DA reads the overall importance of each parameter and estimate from the published measures, and the register entries and cases ESQ took from it.</p>
      {measures.length === 0 ? (
        <p className="posmuted">{overall === undefined ? "No importance is published yet. Rank in Step 07 and publish." : "No published measure points at a DA item."}</p>
      ) : (
        <div className="esq-table-wrap">
          <table className="postable esq-rowtable" aria-label="Importance by DA item">
            <thead><tr><th>DA item</th><th>FV</th><th>RAW</th></tr></thead>
            <tbody>
              {measures.map((measure) => (
                <tr key={`${measure.dataAnalysisParameterRef ?? ""}:${measure.entityRef}`}>
                  <td className="esq-rowtable__wrap">{measure.entityRef}</td>
                  <td className="esq-rowtable__num">{measureText(measure.fussellVesely)}</td>
                  <td className="esq-rowtable__num">{measureText(measure.riskAchievementWorth)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <WorkbookCueLabel workbook="ESQ" title="Values ESQ created" className="essec" />
      {view.created.length === 0 ? (
        <p className="posmuted">ESQ typed no value of its own.</p>
      ) : (
        <div className="esq-table-wrap">
          <table className="postable esq-rowtable" aria-label="Values ESQ created">
            <thead><tr><th>Item</th><th>Value</th><th>Where</th><th>Source</th></tr></thead>
            <tbody>
              {view.created.map((entry) => (
                <tr key={entry.key}>
                  <td className="esq-rowtable__wrap">{entry.item}</td>
                  <td className="esq-rowtable__num">{sciText(entry.value)}</td>
                  <td className="esq-rowtable__text">{entry.where}</td>
                  <td className="esq-rowtable__wrap">{textValue(entry.source)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function HrIePanel({ view }: { view: EsqHandoffView }): JSX.Element {
  const { esq } = useEsqWorkbook();
  const overall = (esq.importanceAnalyses ?? []).find((record) => record.scope === "OVERALL");
  const humans = (overall?.measures ?? []).filter((measure) => measure.entityType === "HUMAN_FAILURE_EVENT");
  const joints = resolvedCombinations(esq).filter((entry) => entry.joint !== undefined);
  const release = new Set(view.families.filter((row) => row.family.release).map((row) => row.family.id));
  const initiators = new Map<string, number>();
  for (const record of esq.familyQuantifications) {
    if (!release.has(record.eventSequenceFamilyRef)) continue;
    const mean = typeof record.meanFrequency === "number" ? record.meanFrequency : record.meanFrequency.value;
    for (const part of record.contributionBreakdown ?? []) {
      if (part.contributorType !== "INITIATING_EVENT") continue;
      initiators.set(part.contributorRef, (initiators.get(part.contributorRef) ?? 0) + mean * part.fractionalContribution);
    }
  }
  const total = [...initiators.values()].reduce((sum, value) => sum + value, 0);
  const screened = esq.review?.screened ?? [];
  return (
    <div className="esq-run">
      <p className="esq-meta">HR receives the importance of each human failure event and the joint HEPs ESQ used. IE receives each initiator's share of the release total and the bounds on the screened initiators. Neither reads ESQ yet, so these lists are the record of what they are given.</p>
      <WorkbookCueLabel workbook="ESQ" title="Human failure events" className="essec" />
      {humans.length === 0 ? <p className="posmuted">No published HFE measure.</p> : (
        <div className="esq-table-wrap">
          <table className="postable esq-rowtable" aria-label="HFE importance">
            <thead><tr><th>HFE</th><th>FV</th><th>RAW</th></tr></thead>
            <tbody>
              {humans.map((measure) => (
                <tr key={measure.entityRef}>
                  <td className="esq-rowtable__wrap">{measure.entityRef}</td>
                  <td className="esq-rowtable__num">{measureText(measure.fussellVesely)}</td>
                  <td className="esq-rowtable__num">{measureText(measure.riskAchievementWorth)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {joints.length > 0 && (
        <div className="esq-table-wrap">
          <table className="postable esq-rowtable" aria-label="Joint HEPs used">
            <thead><tr><th>Combination</th><th>Events</th><th>Joint HEP</th></tr></thead>
            <tbody>
              {joints.map((entry) => (
                <tr key={entry.combination.id}>
                  <td className="esq-rowtable__text">{entry.combination.id}</td>
                  <td className="esq-rowtable__wrap">{entry.members.map((member) => member.code).join(" · ")}</td>
                  <td className="esq-rowtable__num">{valueText(entry.joint)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <WorkbookCueLabel workbook="ESQ" title="Initiators" className="essec" />
      {initiators.size === 0 ? <p className="posmuted">No published initiator share. Publish first.</p> : (
        <div className="esq-table-wrap">
          <table className="postable esq-rowtable" aria-label="Initiator shares">
            <thead><tr><th>Initiator</th><th>Release (/yr)</th><th>Share</th></tr></thead>
            <tbody>
              {[...initiators.entries()].sort((a, b) => b[1] - a[1]).map(([name, value]) => (
                <tr key={name}>
                  <td className="esq-rowtable__wrap">{name}</td>
                  <td className="esq-rowtable__num">{sciText(value)}</td>
                  <td className="esq-rowtable__num">{total > 0 ? `${String(Number((100 * value / total).toPrecision(3)))}%` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {screened.length > 0 && <p className="esq-meta">{`${screened.length} screened initiators carry a bound from Step 07.`}</p>}
    </div>
  );
}

function ResponsesPanel({ view, openWindow }: { view: EsqHandoffView; openWindow: (ctx: EsqWindowContext) => void }): JSX.Element {
  const { esq } = useEsqWorkbook();
  if (esq.linkedWorkbooks?.RI === undefined) return <p className="posmuted">RI is not linked. Link it in Step 01 to read its significance back.</p>;
  if (view.feedback.length === 0) return <p className="posmuted">RI has sent no feedback to ESQ yet.</p>;
  return (
    <div className="esq-table-wrap">
      <table className="postable esq-rowtable" aria-label="RI feedback">
        <thead><tr><th>Item</th><th>RI significance</th><th>Response</th><th>Sent to</th></tr></thead>
        <tbody>
          {view.feedback.map((item) => (
            <tr key={item.id}>
              <td className="esq-rowtable__wrap">
                <button type="button" className="esq-rowtable__name" onClick={() => openWindow({ kind: "esqHandoffResponse", id: item.id })}>{item.label}</button>
              </td>
              <td className="esq-rowtable__text">{item.significance === undefined ? "—" : item.significance.charAt(0) + item.significance.slice(1).toLowerCase()}</td>
              <td className="esq-rowtable__text">{item.response === undefined ? "None" : RESPONSE_LABELS[item.response.status]}</td>
              <td className="esq-rowtable__text">{item.response?.sentTo ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function HandoffScreen({ openWindow }: { openWindow: (ctx: EsqWindowContext) => void }): JSX.Element {
  const { esq, upstream } = useEsqWorkbook();
  const view = useMemo(() => handoffViewOf(esq, upstream), [esq, upstream]);
  const [tab, setTab] = useState<HandoffTab>("summary");
  const tabId = useId();
  const count = (n: number): string => (view === undefined ? "" : ` (${n})`);
  const tabs: { id: HandoffTab; label: string }[] = [
    { id: "summary", label: "Summary" },
    { id: "ri", label: "RI" },
    { id: "ms", label: "MS" },
    { id: "da", label: "DA" },
    { id: "hrie", label: "HR and IE" },
    { id: "responses", label: `Responses${count(view?.feedback.length ?? 0)}` },
    { id: "checks", label: `Checks${count(view?.findings.length ?? 0)}` },
  ];
  const head = TAB_HEADS[tab];
  return (
    <div className="esq-step">
      <EsqTabs label="Hand-off sections" tabs={tabs} active={tab} onChange={setTab} idBase={tabId} className="esq-step__tabs" />
      <div role="tabpanel" id={`${tabId}-panel`} aria-labelledby={`${tabId}-${tab}`} tabIndex={0} className="esq-step__panel">
        <div className="poscard">
          <div className="poscard__head">
            <WorkbookSectionHeading workbook="ESQ" title={head.title} level={3} />
            <div className="esq-card-actions">
              <EsqProvenanceChip>{head.sr}</EsqProvenanceChip>
            </div>
          </div>
          {view === undefined ? (
            <p className="posmuted">Nothing is imported yet. Import the model in Step 02.</p>
          ) : tab === "summary" ? (
            <SummaryPanel view={view} />
          ) : tab === "ri" ? (
            <RiPanel view={view} />
          ) : tab === "ms" ? (
            <MsPanel view={view} />
          ) : tab === "da" ? (
            <DaPanel view={view} />
          ) : tab === "hrie" ? (
            <HrIePanel view={view} />
          ) : tab === "responses" ? (
            <ResponsesPanel view={view} openWindow={openWindow} />
          ) : (
            <FindingsTable label="Hand-off checks" findings={view.findings} openWindow={openWindow} />
          )}
        </div>
      </div>
    </div>
  );
}

function ResponseWindow({ id, onClose }: { id: string; onClose: () => void }): JSX.Element | null {
  const { esq, editable, mutateEsq, upstream } = useEsqWorkbook();
  const fieldId = useId();
  const view = handoffViewOf(esq, upstream);
  const item = view?.feedback.find((candidate) => candidate.id === id);
  if (item === undefined) return null;
  const response: EsqHandoffResponse = handoffWorkOf(esq).responses?.find((entry) => entry.id === id) ?? { id, kind: item.kind, ref: item.ref, response: "", status: "PENDING", ...(item.owner === undefined ? {} : { sentTo: item.owner }) };
  const dis = !editable;

  function save(next: EsqHandoffResponse): void {
    if (!editable) return;
    mutateEsq((draft) => withResponse(draft, next, id));
  }

  return (
    <>
      <ModalHead cap={`RI feedback · ${item.kind === "FAMILY" ? "family" : item.kind === "CONTRIBUTOR" ? "contributor" : "general"} · RI-B3`} title={item.label} onClose={onClose} />
      <div className="modal__body esq-form">
        <FormRow label="RI significance"><span className="esq-form__unit">{item.significance === undefined ? "Not rated" : item.significance.toLowerCase()}</span></FormRow>
        <FormRow label="RI's reason"><span className="esq-form__unit">{textValue(item.reason)}</span></FormRow>
        {item.insights.length > 0 && <FormRow label="Insights"><span className="esq-form__unit">{item.insights.join(" ")}</span></FormRow>}
        {item.recommendations.length > 0 && <FormRow label="Recommendations"><span className="esq-form__unit">{item.recommendations.join(" ")}</span></FormRow>}
        <FormRow label="Response" htmlFor={`${fieldId}-response`} top>
          <WorkbookTextarea id={`${fieldId}-response`} className="posfield__textarea" rows={3} fitContent value={response.response} disabled={dis} onChange={(event) => save({ ...response, response: event.target.value })} />
        </FormRow>
        <FormRow label="Status" htmlFor={`${fieldId}-status`}>
          <select id={`${fieldId}-status`} className="posfield__select" value={response.status} disabled={dis} onChange={(event) => {
            const status = STATUSES.find((candidate) => candidate === event.target.value);
            if (status !== undefined) save({ ...response, status });
          }}>
            {STATUSES.map((status) => <option key={status} value={status}>{RESPONSE_LABELS[status]}</option>)}
          </select>
        </FormRow>
        <FormRow label="Sent to" htmlFor={`${fieldId}-owner`}>
          <select id={`${fieldId}-owner`} className="posfield__select" value={response.sentTo ?? ""} disabled={dis} onChange={(event) => {
            const { sentTo: _old, ...rest } = response;
            save(event.target.value.length === 0 ? rest : { ...rest, sentTo: event.target.value });
          }}>
            <option value="">Kept in ESQ</option>
            {OWNER_ELEMENTS.map((element) => <option key={element} value={element}>{element}</option>)}
          </select>
        </FormRow>
      </div>
      <FormFoot onClose={onClose} />
    </>
  );
}

function HandoffWindows({ context, onClose }: { context: EsqWindowContext; onClose: () => void }): JSX.Element | null {
  switch (context.kind) {
    case "esqHandoffResponse": return <ResponseWindow key={context.id} id={context.id} onClose={onClose} />;
    default: return null;
  }
}

export { HandoffScreen, HandoffWindows, HANDOFF_WINDOW_KINDS, HANDOFF_WINDOW_LABELS };
