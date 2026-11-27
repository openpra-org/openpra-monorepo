import { type JSX } from "react";
import type { RcLinkedRiAnalysis } from "interfaces-shared-types/rc-workbooks/linked-data";
import { WorkbookSectionHeading } from "../workbooks/workbookSectionHeading";
import { RCIcon } from "./rcIcons";
import { RcProvenanceChip } from "./rcShared";
import { useRcWorkbook } from "./rcWorkbookContext";
import type { RcDrawerContext } from "./rcScreens";

const LEVEL_TEXT: Record<string, string> = { HIGH: "High", MEDIUM: "Medium", LOW: "Low" };

function rcRiSent(ri: RcLinkedRiAnalysis | undefined): NonNullable<NonNullable<RcLinkedRiAnalysis["riskIntegrationFeedbackDispatch"]>["radiologicalConsequenceFeedback"]> | undefined {
  return ri?.riskIntegrationFeedbackDispatch?.radiologicalConsequenceFeedback;
}

function sentNote(linked: boolean, ri: RcLinkedRiAnalysis | undefined): string {
  if (!linked) return "Link an RI workbook in Step 01 to read its feedback.";
  if (ri === undefined) return "The linked RI workbook is not read yet.";
  const count = (rcRiSent(ri)?.metricFeedback ?? []).length;
  if (count === 0) return "The linked RI workbook sends no feedback to RC.";
  const sentOn = ri.riskIntegrationFeedbackDispatch?.dispatchDate;
  return `RI sends ${String(count)} ${count === 1 ? "measure" : "measures"}${sentOn === undefined || sentOn.length === 0 ? "" : `, sent ${new Date(sentOn).toLocaleDateString()}`}.`;
}

function RcRiFeedbackCard({ openDrawer }: { openDrawer: (ctx: RcDrawerContext) => void }): JSX.Element {
  const { rc, editable, mutateRc, linked } = useRcWorkbook();
  const rif = rc.riskIntegrationFeedback;
  const linkedToRi = (rc.linkedWorkbooks?.RI ?? "").length > 0;
  const ri = linked.ri?.analysis;
  const sent = rcRiSent(ri);
  const sentRows = sent?.metricFeedback ?? [];
  const message = sent?.generalFeedback ?? "";
  const categoryItems = (rif?.releaseCategoryFeedback ?? []).length;

  function addRif(): void {
    mutateRc((d) => ({ ...d, riskIntegrationFeedback: { analysisRef: "", feedbackDate: "", metricFeedback: [], releaseCategoryFeedback: [], generalFeedback: "", response: { description: "", changes: [], status: "IN_PROGRESS" } } }));
    openDrawer({ kind: "rifeedback", id: "rif" });
  }

  return (
    <div className="poscard">
      <div className="poscard__head">
        <WorkbookSectionHeading title="Risk-integration feedback" level={3} />
        <div className="posrow rc-rifeedback__actions">
          <RcProvenanceChip>RCQ-B3 · RI-C1</RcProvenanceChip>
          {editable && (rif !== undefined || ri !== undefined) && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => openDrawer({ kind: "rifeedback", id: "rif" })}><RCIcon.Settings /> Edit</button>}
          {editable && rif === undefined && !linkedToRi && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addRif}><RCIcon.Plus /> Add feedback</button>}
        </div>
      </div>
      <h4 className="rcscope__title">Sent by RI</h4>
      <p className="rc-step08-empty">{sentNote(linkedToRi, ri)}</p>
      {message.length > 0 && <p className="possubtle rc-rifeedback__text">{message}</p>}
      {sentRows.length > 0 && (
        <div className="rc-link-table rc-rifeedback__table">
          <table className="postable postable--mid" aria-label="Feedback sent by RI">
            <thead><tr><th>Measure</th><th>RI level</th><th>Recommendations</th></tr></thead>
            <tbody>
              {sentRows.map((row) => (
                <tr key={row.metric}>
                  <td><div className="postable__name">{row.metric}</div></td>
                  <td>{row.riskSignificance === undefined ? "None" : LEVEL_TEXT[row.riskSignificance] ?? row.riskSignificance}</td>
                  <td>{(row.recommendations ?? []).length === 0 ? "None" : (row.recommendations ?? []).join(" ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <h4 className="rcscope__title rc-rifeedback__record">RC record</h4>
      {rif === undefined || (ri !== undefined && categoryItems === 0 && rif.response === undefined) ? (
        <p className="rc-step08-empty">{ri === undefined ? "No feedback recorded yet." : "No response recorded yet."}</p>
      ) : (
        <div className="rc-rifeedback__summary">
          {ri === undefined && <div><span className="possubtle rc-rifeedback__label">Analysis: </span><span className="posmono">{rif.analysisRef}</span></div>}
          {ri === undefined && (rif.generalFeedback ?? "").length > 0 && <p className="possubtle rc-rifeedback__text">{rif.generalFeedback}</p>}
          {rif.response !== undefined && <p className="possubtle rc-rifeedback__text"><strong>Response:</strong> {rif.response.description}</p>}
          <div className="posrow posrow--wrap rc-rifeedback__chips">
            <span className="poschip">{categoryItems} category items</span>
            {ri === undefined && <span className="poschip">{(rif.metricFeedback ?? []).length} metric items</span>}
          </div>
        </div>
      )}
    </div>
  );
}

export { RcRiFeedbackCard };
