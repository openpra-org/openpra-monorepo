import { Fragment, JSX, useId, useState } from "react";
import type { DataAnalysisParameter } from "interfaces-mef-types/da/data-analysis";
import { WorkbookSectionHeading } from "../workbooks/workbookSectionHeading";
import { DaProvenanceChip, DaTabs, DetailRow, DetailToggle, FieldList, FormFoot, FormRow, ModalHead } from "./daShared";
import { useElementWidth } from "./daDistributionChart";
import { FV_SIGNIFICANT, RAW_SIGNIFICANT, handoffFindings, handoffView, withImportanceFromEsq, type DaHandoffElement, type DaHandoffRow, type DaHandoffStatus } from "./daHandoffs";
import { useDaWorkbook } from "./daWorkbookContext";
import { NEED_PAGE, NeedChecksTable, NeedPager, statText, type DaDrawerContext } from "./daScreens";
import { NumberInput } from "./daSourcesScreen";

type HandoffTab = "summary" | DaHandoffElement | "importance" | "checks";

const ELEMENTS: DaHandoffElement[] = ["SY", "IE", "HRA", "POS", "ESQ"];

const ELEMENT_NAMES: Record<DaHandoffElement, string> = {
  SY: "Systems Analysis",
  IE: "Initiating Events",
  HRA: "Human Reliability",
  POS: "Plant Operating States",
  ESQ: "Event Sequence Quantification",
};

const ELEMENT_CODES: Record<DaHandoffElement, string> = { SY: "SY", IE: "IE", HRA: "HR", POS: "POS", ESQ: "ESQ" };

const STATUS_LABELS: Record<DaHandoffStatus, string> = {
  IN_STEP: "In step",
  CHANGED: "DA value changed",
  TYPED: "Typed there",
  UNITS: "Units differ",
  MISSING: "Missing in DA",
  NOT_IMPORTED: "Not imported",
};

const TAB_HEADS: Record<HandoffTab, { title: string; sr: string }> = {
  summary: { title: "Summary", sr: "DA-D1 · DA-E1" },
  SY: { title: "Systems Analysis", sr: "SY-A · DA-D1" },
  IE: { title: "Initiating Events", sr: "IE-C8 · DA-D1" },
  HRA: { title: "Human Reliability", sr: "HR-G · DA-D1" },
  POS: { title: "Plant Operating States", sr: "DA-C24 · DA-C26" },
  ESQ: { title: "Event Sequence Quantification", sr: "DA-A5 · DA-E2" },
  importance: { title: "Importance", sr: "DA-D1 · DA-D3" },
  checks: { title: "Hand-off checks", sr: "DA-D1 · DA-E1" },
};

const HANDOFF_WINDOW_KINDS: ReadonlySet<string> = new Set(["daImportance"]);

function statusClass(status: DaHandoffStatus): string {
  if (status === "UNITS" || status === "MISSING") return "da-severity da-severity--error";
  if (status === "CHANGED") return "da-severity da-severity--warning";
  return "da-rowtable__text";
}

function SummaryTable(): JSX.Element {
  const { da, upstream } = useDaWorkbook();
  const view = handoffView(da, upstream);
  const loaded: Record<DaHandoffElement, boolean> = { SY: upstream.sy !== undefined, IE: upstream.ie !== undefined, HRA: upstream.hr !== undefined, POS: upstream.pos !== undefined, ESQ: upstream.esq !== undefined };
  return (
    <div className="da-table-wrap">
      <table className="postable da-rowtable" aria-label="Hand-off summary">
        <thead><tr><th>Workbook</th><th>Imported from DA</th><th>Typed there</th><th>Out of step</th><th>Problems</th></tr></thead>
        <tbody>
          {ELEMENTS.map((element) => {
            const rows = view.rows.filter((row) => row.element === element);
            return (
              <tr key={element}>
                <td className="da-rowtable__text">{ELEMENT_CODES[element]}</td>
                {loaded[element] ? (
                  <>
                    <td className="da-rowtable__num">{rows.filter((row) => row.holder === "DA").length}</td>
                    <td className="da-rowtable__num">{rows.filter((row) => row.holder === "TYPED").length}</td>
                    <td className="da-rowtable__num">{rows.filter((row) => row.status === "CHANGED").length}</td>
                    <td className="da-rowtable__num">{rows.filter((row) => row.status === "UNITS" || row.status === "MISSING").length}</td>
                  </>
                ) : (
                  <td className="da-rowtable__text" colSpan={4}>Not linked in Step 01</td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RowDetail({ row }: { row: DaHandoffRow }): JSX.Element {
  return (
    <FieldList items={[
      { label: "Name", value: row.name },
      { label: "Value from", value: row.holder === "DA" ? `DA ${row.target ?? ""}`.trim() : `Typed in ${ELEMENT_CODES[row.element]}` },
      { label: "DA value", value: row.daValue === undefined ? "—" : `${statText(row.daValue)} ${row.unit}` },
      { label: `${ELEMENT_CODES[row.element]} value`, value: row.consumerValue === undefined ? "—" : `${statText(row.consumerValue)} ${row.unit}` },
      { label: "Status", value: row.detail === undefined ? STATUS_LABELS[row.status] : `${STATUS_LABELS[row.status]}. ${row.detail}` },
    ]} />
  );
}

function ElementTable({ element }: { element: DaHandoffElement }): JSX.Element {
  const { da, upstream } = useDaWorkbook();
  const [page, setPage] = useState(0);
  const [show, setShow] = useState("all");
  const [selected, setSelected] = useState("");
  const filterId = useId();
  const [wrapRef, wrapWidth] = useElementWidth(0);
  const loaded = element === "SY" ? upstream.sy : element === "IE" ? upstream.ie : element === "HRA" ? upstream.hr : element === "POS" ? upstream.pos : upstream.esq;
  if (loaded === undefined) return <p className="posmuted">Link the {ELEMENT_NAMES[element]} workbook in Step 01 to see what it takes from DA.</p>;
  const rows = handoffView(da, upstream).rows.filter((row) => row.element === element).filter((row) => {
    if (show === "all") return true;
    if (show === "DA") return row.holder === "DA";
    if (show === "TYPED") return row.holder === "TYPED";
    return row.status === "CHANGED" || row.status === "UNITS" || row.status === "MISSING";
  });
  const pages = Math.max(1, Math.ceil(rows.length / NEED_PAGE));
  const current = Math.min(page, pages - 1);
  const shown = rows.slice(current * NEED_PAGE, (current + 1) * NEED_PAGE);
  return (
    <>
      <div className="da-needs__bar">
        <label className="posfield__label" htmlFor={filterId}>Show</label>
        <select id={filterId} className="posfield__select" value={show} onChange={(event) => { setShow(event.target.value); setPage(0); }}>
          <option value="all">All items</option>
          <option value="DA">Imported from DA</option>
          <option value="TYPED">Typed there</option>
          <option value="open">Needing action</option>
        </select>
        <NeedPager total={rows.length} page={current} onPage={setPage} />
      </div>
      {rows.length === 0 ? <p className="posmuted">Nothing to show.</p> : (
        <div className="da-table-wrap" ref={wrapRef}>
          <table className="postable da-rowtable" aria-label={ELEMENT_NAMES[element]}>
            <thead><tr><th className="da-rowtable__pick">Details</th><th>Item</th><th>Value from</th><th>Status</th></tr></thead>
            <tbody>
              {shown.map((row) => {
                const key = `${row.element}-${row.id}`;
                const open = key === selected;
                return (
                  <Fragment key={key}>
                    <tr className={open ? "da-rowtable__row--on" : undefined} onClick={() => { if (!open) setSelected(key); }}>
                      <td className="da-rowtable__pick"><DetailToggle open={open} label={row.code} onToggle={() => setSelected(open ? "" : key)} /></td>
                      <td className="da-rowtable__text">{row.code}</td>
                      <td className="da-rowtable__text">{row.holder === "DA" ? "DA" : "Typed"}</td>
                      <td><span className={statusClass(row.status)}>{STATUS_LABELS[row.status]}</span></td>
                    </tr>
                    {open && <DetailRow span={4} width={wrapWidth - 18}><RowDetail row={row} /></DetailRow>}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function ImportanceTable({ openDrawer }: { openDrawer: (ctx: DaDrawerContext) => void }): JSX.Element {
  const { da, upstream } = useDaWorkbook();
  const [selected, setSelected] = useState("");
  const [wrapRef, wrapWidth] = useElementWidth(0);
  const rows = handoffView(da, upstream).importance;
  if (rows.length === 0) return <p className="posmuted">{upstream.esq === undefined ? "Link the ESQ workbook in Step 01 to read back importance." : "ESQ names no DA parameter in its importance results yet."}</p>;
  return (
    <div className="da-table-wrap" ref={wrapRef}>
      <table className="postable da-rowtable" aria-label="Importance">
        <thead><tr><th className="da-rowtable__pick">Details</th><th>Parameter</th><th>FV</th><th>RAW</th><th>Risk significant</th></tr></thead>
        <tbody>
          {rows.map((row) => {
            const open = row.id === selected;
            return (
              <Fragment key={row.id}>
                <tr className={open ? "da-rowtable__row--on" : undefined} onClick={() => { if (!open) setSelected(row.id); }}>
                  <td className="da-rowtable__pick"><DetailToggle open={open} label={row.id} onToggle={() => setSelected(open ? "" : row.id)} /></td>
                  <td><button type="button" className="da-rowtable__name" onClick={(event) => { event.stopPropagation(); openDrawer({ kind: "daImportance", id: row.id }); }}>{row.id}</button></td>
                  <td className="da-rowtable__num">{statText(row.fussellVesely)}</td>
                  <td className="da-rowtable__num">{row.riskAchievementWorth === undefined ? "—" : Number(row.riskAchievementWorth.toPrecision(3))}</td>
                  <td className="da-rowtable__text">{row.esqSignificant === row.daSignificant ? (row.daSignificant ? "Yes" : "No") : <span className="da-severity da-severity--warning">{row.esqSignificant ? "ESQ yes, DA no" : "DA yes, ESQ no"}</span>}</td>
                </tr>
                {open && (
                  <DetailRow span={5} width={wrapWidth - 18}>
                    <FieldList items={[
                      { label: "Name", value: row.name },
                      { label: "ESQ results read", value: row.entries.length === 0 ? "Typed in DA" : row.entries.join(", ") },
                      { label: "Rule", value: `Risk significant when FV is above ${FV_SIGNIFICANT} or RAW above ${RAW_SIGNIFICANT}` },
                      { label: "Data", value: row.generic ? "Generic data only" : "Plant or technology evidence" },
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

function HandoffScreen({ openDrawer }: { openDrawer: (ctx: DaDrawerContext) => void }): JSX.Element {
  const { da, upstream, editable, mutateDa } = useDaWorkbook();
  const [tab, setTab] = useState<HandoffTab>("summary");
  const tabId = useId();
  const findings = handoffFindings(da, upstream);
  const importance = handoffView(da, upstream).importance;
  const tabs: { id: HandoffTab; label: string }[] = [
    { id: "summary", label: "Summary" },
    ...ELEMENTS.map((element) => ({ id: element, label: ELEMENT_CODES[element] })),
    { id: "importance", label: `Importance (${importance.length})` },
    { id: "checks", label: `Checks (${findings.length})` },
  ];
  const head = TAB_HEADS[tab];
  function importSignificance(): void {
    if (!editable) return;
    const now = new Date().toISOString();
    mutateDa((draft) => withImportanceFromEsq(draft, upstream, now));
  }
  return (
    <div className="da-step">
      <DaTabs label="Hand-off sections" tabs={tabs} active={tab} onChange={setTab} idBase={tabId} className="da-step__tabs" />
      <div role="tabpanel" id={`${tabId}-panel`} aria-labelledby={`${tabId}-${tab}`} tabIndex={0} className="da-step__panel">
        <div className="poscard">
          <div className="poscard__head">
            <WorkbookSectionHeading workbook="DA" title={head.title} level={3} />
            <div className="da-card-actions">
              <DaProvenanceChip>{head.sr}</DaProvenanceChip>
              {editable && tab === "importance" && upstream.esq !== undefined && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={importSignificance}>Import risk significance from ESQ</button>}
            </div>
          </div>
          {tab === "summary" && <SummaryTable />}
          {(tab === "SY" || tab === "IE" || tab === "HRA" || tab === "POS" || tab === "ESQ") && <ElementTable key={tab} element={tab} />}
          {tab === "importance" && <ImportanceTable openDrawer={openDrawer} />}
          {tab === "checks" && <NeedChecksTable findings={findings} openDrawer={openDrawer} />}
        </div>
      </div>
    </div>
  );
}

function ImportanceWindow({ id, onClose }: { id: string; onClose: () => void }): JSX.Element | null {
  const { da, editable, mutateDa } = useDaWorkbook();
  const fieldId = useId();
  const parameter = da.parameters.find((candidate) => candidate.uuid === id);
  const estimate = (da.ccfParameterEstimations ?? []).find((candidate) => candidate.uuid === id);
  if (parameter === undefined && estimate === undefined) return null;
  const dis = !editable;
  const importance = parameter?.importance ?? estimate?.importance;
  const significant = (parameter?.isRiskSignificant ?? estimate?.isRiskSignificant) === true;
  function apply(next: { importance?: DataAnalysisParameter["importance"]; isRiskSignificant?: boolean }): void {
    if (!editable) return;
    mutateDa((draft) => ({
      ...draft,
      parameters: draft.parameters.map((candidate) => (candidate.uuid === id ? { ...candidate, ...next } : candidate)),
      ccfParameterEstimations: draft.ccfParameterEstimations?.map((candidate) => (candidate.uuid === id ? { ...candidate, ...next } : candidate)),
    }));
  }
  const typed = importance?.from !== "ESQ";
  return (
    <>
      <ModalHead cap="Importance · DA-D1" title={`${id} · ${parameter?.name ?? estimate?.name ?? ""}`} onClose={onClose} />
      <div className="modal__body da-form">
        <FormRow label="Importance from" htmlFor={`${fieldId}-from`}>
          <select id={`${fieldId}-from`} className="posfield__select" value={typed ? "TYPED" : "ESQ"} disabled={dis} onChange={(event) => apply({ importance: event.target.value === "ESQ" ? { from: "ESQ" } : { from: "TYPED", fussellVesely: importance?.fussellVesely, riskAchievementWorth: importance?.riskAchievementWorth } })}>
            <option value="TYPED">Typed in DA</option>
            <option value="ESQ">Imported from ESQ</option>
          </select>
        </FormRow>
        {typed ? (
          <FormRow label="Measures" htmlFor={`${fieldId}-fv`}>
            <NumberInput label="FV" value={importance?.fussellVesely} disabled={dis} onChange={(fussellVesely) => apply({ importance: { from: "TYPED", fussellVesely, riskAchievementWorth: importance?.riskAchievementWorth } })} />
            <NumberInput label="RAW" value={importance?.riskAchievementWorth} disabled={dis} onChange={(riskAchievementWorth) => apply({ importance: { from: "TYPED", fussellVesely: importance?.fussellVesely, riskAchievementWorth } })} />
            <span className="da-form__unit">Fussell-Vesely and risk achievement worth</span>
          </FormRow>
        ) : <p className="da-needs__meta">The measures follow ESQ's importance results. Import them again in the Importance tab after ESQ changes.</p>}
        <FormRow label="Risk significant" htmlFor={`${fieldId}-risk`}>
          <select id={`${fieldId}-risk`} className="posfield__select" value={significant ? "yes" : "no"} disabled={dis} onChange={(event) => apply({ isRiskSignificant: event.target.value === "yes" })}>
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </select>
        </FormRow>
      </div>
      <FormFoot onClose={onClose} />
    </>
  );
}

function HandoffWindows({ context, onClose }: { context: DaDrawerContext; onClose: () => void }): JSX.Element | null {
  return context.kind === "daImportance" ? <ImportanceWindow id={context.id} onClose={onClose} /> : null;
}

export { HANDOFF_WINDOW_KINDS, HandoffScreen, HandoffWindows };
