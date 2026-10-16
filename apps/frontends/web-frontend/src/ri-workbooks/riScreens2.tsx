import { WorkbookSectionHeading } from "../workbooks/workbookSectionHeading";
import { JSX } from "react";
import { RIIcon } from "./riIcons";
import { useRiWorkbook } from "./riWorkbookContext";
import { generateRiReport } from "./riDocx";
import { RI_TOC, type CapabilityCategory } from "./riViewData";
import { type CcScore } from "./riSelectors";
import { AggregationNoteDrawer, CliffEdgeDrawer, InputConsequenceDrawer, InputContributorDrawer, InputFamilyDrawer, InputGapDrawer, InputImportanceDrawer, InputSequenceDrawer, MeasureDrawer, ScreenedItemDrawer, SensitivityStudyDrawer, SscAssignmentDrawer, UncertaintyAnalysisDrawer, UncertaintySourceDrawer, type RiDrawerContext } from "./riScreens";

function DraftScreen({ cc, scores, onSubmitDraft, canSubmit }: {
  cc: CapabilityCategory;
  scores: CcScore;
  onSubmitDraft: () => void;
  canSubmit: boolean;
}): JSX.Element {
  const { ri } = useRiWorkbook();
  const ready = scores.blocked === 0 && scores.warn === 0;
  const stage = ri.plantStage === "OPERATIONAL" ? "operational" : "pre_operational";
  function downloadJson(): void {
    const blob = new Blob([JSON.stringify(ri, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${ri.name} — RI Analysis.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
  return (
    <div className="posgen">
      <div className="posgen__preview" aria-hidden="true">
        <div className="posgen__preview-eyebrow">Generated preview · Word output</div>
        <h1>{ri.name}</h1>
        <h2>Preliminary Risk Integration</h2>
        <h3>Table of contents</h3>
        <div className="posgen__preview-toc">
          {RI_TOC.map(([tt, p], i) => (
            <div key={i} className="posgen__preview-toc-row"><span>{tt}</span><span>{p}</span></div>
          ))}
        </div>
      </div>

      <div className="posgen__side">
        <div className="posgen__readout">
          <WorkbookSectionHeading title="Conformance check" level={3} className="posgen__readout-h" />
          <div className="posgen__bar"><span className="posgen__bar-label">Capability category</span><span style={{ fontWeight: 700 }}>{cc.name} · {cc.tag}</span></div>
          <div className="posgen__bar"><span className="posgen__bar-label">Plant stage</span><span style={{ fontWeight: 700 }}>{stage === "pre_operational" ? "Pre-operational" : "Operational"}</span></div>
          <div className="posgen__bar"><span className="posgen__bar-label">Items satisfied</span><span className="posmono">{scores.met} / {scores.applicable}</span></div>
          {scores.warn > 0 && <div className="posgen__bar"><span className="posgen__bar-label" style={{ color: "var(--color-warning)" }}>Needs attention</span><span className="posmono">{scores.warn}</span></div>}
          {scores.na > 0 && <div className="posgen__bar"><span className="posgen__bar-label">Not applicable</span><span className="posmono">{scores.na}</span></div>}
        </div>

        <div className="posgen__readout">
          <WorkbookSectionHeading title="Draft submission" level={3} className="posgen__readout-h" />
          <p style={{ margin: "0 0 12px", fontSize: 12.5, color: "var(--color-text-muted)", lineHeight: 1.5 }}>
            {ready
              ? <>All applicable items pass at <strong>{cc.name}</strong>. The draft locks Steps 1 to 6 and moves to <strong>Internal Technical Review</strong>.</>
              : <>{scores.warn} item{scores.warn === 1 ? "" : "s"} need attention. A working draft is fine, but approval waits.</>}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {canSubmit && <button type="button" className="posnav__btn posnav__btn--primary" onClick={onSubmitDraft}><RIIcon.Send /> Submit draft to internal review</button>}
            <button type="button" className="posnav__btn" onClick={() => { void generateRiReport(ri, false); }}><RIIcon.Download /> Download draft (.docx)</button>
            <button type="button" className="posnav__btn" onClick={downloadJson}><RIIcon.Download /> Download JSON</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DrawerContent({ context, onClose, onRetarget }: { context: RiDrawerContext; onClose: () => void; onRetarget: (ctx: RiDrawerContext) => void }): JSX.Element | null {
  if (context.kind === "measure") return <MeasureDrawer index={Number(context.id)} onClose={onClose} />;
  if (context.kind === "inputFamily") return <InputFamilyDrawer id={context.id} onClose={onClose} onRetarget={onRetarget} />;
  if (context.kind === "inputSequence") return <InputSequenceDrawer id={context.id} onClose={onClose} onRetarget={onRetarget} />;
  if (context.kind === "inputContributor") return <InputContributorDrawer id={context.id} onClose={onClose} />;
  if (context.kind === "inputImportance") return <InputImportanceDrawer id={context.id} onClose={onClose} />;
  if (context.kind === "inputGap") return <InputGapDrawer id={context.id} onClose={onClose} />;
  if (context.kind === "inputConsequence") return <InputConsequenceDrawer id={context.id} onClose={onClose} />;
  if (context.kind === "cliffEdge") return <CliffEdgeDrawer id={context.id} onClose={onClose} />;
  if (context.kind === "aggregationNote") return <AggregationNoteDrawer id={context.id} onClose={onClose} />;
  if (context.kind === "sscAssignment") return <SscAssignmentDrawer id={context.id} onClose={onClose} />;
  if (context.kind === "uncertaintySource") return <UncertaintySourceDrawer id={context.id} onClose={onClose} />;
  if (context.kind === "screenedItem") return <ScreenedItemDrawer id={context.id} onClose={onClose} />;
  if (context.kind === "uncertaintyAnalysis") return <UncertaintyAnalysisDrawer id={context.id} onClose={onClose} />;
  if (context.kind === "sensitivityStudy") return <SensitivityStudyDrawer id={context.id} onClose={onClose} />;
  return null;
}

function PlaceholderScreen({ label }: { label: string }): JSX.Element {
  return (
    <div className="poscard">
      <div className="hrempty">
        <div className="hrempty__title">{label}</div>
        <p className="hrempty__hint">This step is part of the Risk Integration workflow.</p>
      </div>
    </div>
  );
}

export { DraftScreen, DrawerContent, PlaceholderScreen };
