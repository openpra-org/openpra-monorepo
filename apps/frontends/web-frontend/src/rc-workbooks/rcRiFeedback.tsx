import { type JSX } from "react";
import type { RadiologicalConsequenceAnalysis } from "interfaces-mef-types/rc/radiological-consequence-analysis";
import type { RiskIntegration } from "interfaces-mef-types/ri/risk-integration";
import { WorkbookSectionHeading } from "../workbooks/workbookSectionHeading";
import { RCIcon } from "./rcIcons";
import { RcProvenanceChip } from "./rcShared";
import { useRcWorkbook } from "./rcWorkbookContext";
import type { RcDrawerContext } from "./rcScreens";

type RcRiFeedback = NonNullable<RadiologicalConsequenceAnalysis["riskIntegrationFeedback"]>;
type RcMetricFeedback = NonNullable<RcRiFeedback["metricFeedback"]>[number];

const LEVEL_TEXT: Record<string, string> = { HIGH: "High", MEDIUM: "Medium", LOW: "Low" };

function rcRiSent(ri: RiskIntegration | undefined): NonNullable<NonNullable<RiskIntegration["riskIntegrationFeedbackDispatch"]>["radiologicalConsequenceFeedback"]> | undefined {
  return ri?.riskIntegrationFeedbackDispatch?.radiologicalConsequenceFeedback;
}

function recordedFromRi(current: RcRiFeedback | undefined, ri: RiskIntegration): RcRiFeedback {
  const dispatch = ri.riskIntegrationFeedbackDispatch;
  const sent = dispatch?.radiologicalConsequenceFeedback;
  const record: RcRiFeedback = {
    ...current,
    analysisRef: ri.uuid,
    metricFeedback: (sent?.metricFeedback ?? []).map((row): RcMetricFeedback => ({
      metric: row.metric,
      ...(row.riskSignificance === undefined ? {} : { riskSignificance: row.riskSignificance }),
      ...(row.insights === undefined ? {} : { insights: row.insights }),
      ...(row.recommendations === undefined ? {} : { recommendations: row.recommendations }),
    })),
  };
  if (dispatch?.dispatchDate !== undefined && dispatch.dispatchDate.length > 0) record.feedbackDate = dispatch.dispatchDate;
  if (sent?.generalFeedback !== undefined && sent.generalFeedback.length > 0) record.generalFeedback = sent.generalFeedback;
  return record;
}

function sentNote(linked: boolean, ri: RiskIntegration | undefined): string {
  if (!linked) return "Link an RI workbook in Step 01 to read its feedback.";
  if (ri === undefined) return "The linked RI workbook is not read yet.";
  const count = (rcRiSent(ri)?.metricFeedback ?? []).length;
  if (count === 0) return "The linked RI workbook sends no feedback to RC.";
  const sentOn = ri.riskIntegrationFeedbackDispatch?.dispatchDate;
  return `RI sends ${String(count)} ${count === 1 ? "measure" : "measures"}${sentOn === undefined || sentOn.length === 0 ? "" : `, sent ${new Date(sentOn).toLocaleDateString()}`}.`;
}

function RcRiFeedbackCard({ openDrawer }: { openDrawer: (ctx: RcDrawerContext) => void }): JSX.Element {
  const { rc, editable, mutateRc, links } = useRcWorkbook();
  const rif = rc.riskIntegrationFeedback;
  const ri = rc.linkedWorkbooks?.RI === undefined ? undefined : links.ri;
  const sent = rcRiSent(ri);
  const sentRows = sent?.metricFeedback ?? [];
  const message = sent?.generalFeedback ?? "";

  function addRif(): void {
    mutateRc((d) => ({ ...d, riskIntegrationFeedback: { analysisRef: "", feedbackDate: "", metricFeedback: [], releaseCategoryFeedback: [], generalFeedback: "", response: { description: "", changes: [], status: "IN_PROGRESS" } } }));
    openDrawer({ kind: "rifeedback", id: "rif" });
  }
  function recordedText(metric: string, level: string | undefined): string {
    const recorded = (rif?.metricFeedback ?? []).find((row) => row.metric === metric);
    if (recorded === undefined) return "Not recorded";
    return recorded.riskSignificance === level ? "Same" : "Differs";
  }

  return (
    <div className="poscard">
      <div className="poscard__head">
        <WorkbookSectionHeading workbook="RC" title="Risk-integration feedback" level={3} />
        <div className="posrow rc-rifeedback__actions">
          <RcProvenanceChip>RCQ-B3 · RI-C1</RcProvenanceChip>
          {editable && ri !== undefined && sentRows.length > 0 && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => mutateRc((d) => ({ ...d, riskIntegrationFeedback: recordedFromRi(d.riskIntegrationFeedback, ri) }))}>{rif === undefined ? "Record RI feedback" : "Update from RI"}</button>}
          {editable && rif !== undefined && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => openDrawer({ kind: "rifeedback", id: "rif" })}><RCIcon.Settings /> Edit</button>}
          {editable && rif === undefined && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addRif}><RCIcon.Plus /> Add feedback</button>}
        </div>
      </div>
      <h4 className="rcscope__title">Sent by RI</h4>
      <p className="rc-step08-empty">{sentNote(rc.linkedWorkbooks?.RI !== undefined, ri)}</p>
      {message.length > 0 && <p className="possubtle rc-rifeedback__text">{message}</p>}
      {sentRows.length > 0 && (
        <div className="rc-link-table rc-rifeedback__table">
          <table className="postable postable--mid" aria-label="Feedback sent by RI">
            <thead><tr><th>Measure</th><th>RI level</th><th>Recommendations</th><th>RC record</th></tr></thead>
            <tbody>
              {sentRows.map((row) => (
                <tr key={row.metric}>
                  <td><div className="postable__name">{row.metric}</div></td>
                  <td>{row.riskSignificance === undefined ? "None" : LEVEL_TEXT[row.riskSignificance] ?? row.riskSignificance}</td>
                  <td>{(row.recommendations ?? []).length === 0 ? "None" : (row.recommendations ?? []).join(" ")}</td>
                  <td>{recordedText(row.metric, row.riskSignificance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <h4 className="rcscope__title rc-rifeedback__record">RC record</h4>
      {rif === undefined ? (
        <p className="rc-step08-empty">No feedback recorded yet.</p>
      ) : (
        <div className="rc-rifeedback__summary">
          <div><span className="possubtle rc-rifeedback__label">Analysis: </span><span className="posmono">{rif.analysisRef}</span></div>
          {(rif.generalFeedback ?? "").length > 0 && <p className="possubtle rc-rifeedback__text">{rif.generalFeedback}</p>}
          {rif.response !== undefined && <p className="possubtle rc-rifeedback__text"><strong>Response:</strong> {rif.response.description}</p>}
          <div className="posrow posrow--wrap rc-rifeedback__chips">
            <span className="poschip">{(rif.releaseCategoryFeedback ?? []).length} category items</span>
            <span className="poschip">{(rif.metricFeedback ?? []).length} metric items</span>
          </div>
        </div>
      )}
    </div>
  );
}

export { RcRiFeedbackCard };
