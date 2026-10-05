import { stringifyJson } from "interfaces-shared-types/json";
import { WorkbookSectionHeading } from "../workbooks/workbookSectionHeading";
import { JSX } from "react";
import { DAIcon } from "./daIcons";
import { useDaWorkbook } from "./daWorkbookContext";
import { generateDaReport } from "./daDocx";
import {
  DA_TOC,
  type Stage,
  type CapabilityCategory,
} from "./daViewData";
import { type CcScore } from "./daSelectors";

// ─── 10 — Draft ────────────────────────────────────────────────────────────
function DraftScreen({ cc, scores, stage, onSubmitDraft, canSubmit }: { cc: CapabilityCategory; scores: CcScore; stage: Stage; onSubmitDraft: () => void; canSubmit: boolean }): JSX.Element {
  const { da } = useDaWorkbook();
  const ready = scores.blocked === 0 && scores.warn === 0;
  function downloadJson(): void {
    const blob = new Blob([stringifyJson(da, 2)!], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${da.name} — DA Analysis.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
  return (
    <div className="posgen">
      <div className="posgen__preview" aria-hidden="true">
        <div className="posgen__preview-eyebrow">Generated preview · Word output</div>
        <h1>{da.name}</h1>
        <h2>Preliminary Data Analysis</h2>
        <h3>Table of contents</h3>
        <div className="posgen__preview-toc">
          {DA_TOC.map(([tt, p], i) => (
            <div key={i} className="posgen__preview-toc-row"><span>{tt}</span><span>{p}</span></div>
          ))}
        </div>
      </div>

      <div className="posgen__side">
        <div className="posgen__readout">
          <WorkbookSectionHeading workbook="DA" title="Conformance check" level={3} className="posgen__readout-h" />
          <div className="posgen__bar"><span className="posgen__bar-label">Capability category</span><span style={{ fontWeight: 700 }}>{cc.name} · {cc.tag}</span></div>
          <div className="posgen__bar"><span className="posgen__bar-label">Plant stage</span><span style={{ fontWeight: 700 }}>{stage === "pre_operational" ? "Pre-operational" : "Operational"}</span></div>
          <div className="posgen__bar"><span className="posgen__bar-label">Items satisfied</span><span className="posmono">{scores.met} / {scores.applicable}</span></div>
          {scores.warn > 0 && <div className="posgen__bar"><span className="posgen__bar-label" style={{ color: "var(--color-warning)" }}>Needs attention</span><span className="posmono">{scores.warn}</span></div>}
          {scores.blocked > 0 && <div className="posgen__bar"><span className="posgen__bar-label" style={{ color: "#b73b3b" }}>Blocked</span><span className="posmono">{scores.blocked}</span></div>}
          {scores.na > 0 && <div className="posgen__bar"><span className="posgen__bar-label">Not applicable, stage</span><span className="posmono">{scores.na}</span></div>}
        </div>

        <div className="posgen__readout">
          <WorkbookSectionHeading workbook="DA" title="Hand-off to internal review" level={3} className="posgen__readout-h" />
          <p style={{ margin: "0 0 12px", fontSize: 12.5, color: "var(--color-text-muted)", lineHeight: 1.5 }}>
            {ready
              ? <>All applicable items pass at <strong>{cc.name}</strong>. The draft locks Steps 1 to 10 and moves to <strong>Internal Technical Review</strong>.</>
              : <>{scores.warn} item{scores.warn === 1 ? "" : "s"} need attention. A working draft is fine, but approval waits.</>}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {canSubmit && <button type="button" className="posnav__btn posnav__btn--primary" onClick={onSubmitDraft}><DAIcon.Send /> Submit draft to internal review</button>}
            <button type="button" className="posnav__btn" onClick={() => { void generateDaReport(da, false); }}><DAIcon.Download /> Download draft (.docx)</button>
            <button type="button" className="posnav__btn" onClick={downloadJson}><DAIcon.Download /> Download JSON</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PlaceholderScreen({ label }: { label: string }): JSX.Element {
  return (
    <div className="poscard">
      <div className="hrempty">
        <div className="hrempty__title">{label}</div>
        <p className="hrempty__hint">This step is part of the Data Analysis workflow.</p>
      </div>
    </div>
  );
}

export { DraftScreen, PlaceholderScreen };
