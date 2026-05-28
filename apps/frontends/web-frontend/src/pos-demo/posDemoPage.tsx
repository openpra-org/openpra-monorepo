import { JSX, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDemoIdentity } from "../demo/demoIdentity";
import { POSIcon } from "./posIcons";
import {
  POS_PROJECT,
  CAPABILITY_CATEGORIES,
  PERSONAS,
  workflowStateDisplay,
  type PosPersona,
  type PosStep,
} from "./posViewData";
import { POS_ANALYSIS } from "./posData";
import {
  stepIndexById,
  filterConformance,
  groupBySection,
  ccScore,
  stepsForPersona,
  commentsView,
  nmViewById,
  type Stage,
  type CommentView,
} from "./posSelectors";
import {
  SetupScreen,
  DocumentsScreen,
  EvolutionsScreen,
  StatesScreen,
  InterviewsScreen,
  ScreeningScreen,
  GroupingScreen,
  FrequencyScreen,
  DecayHeatScreen,
  DraftScreen,
  type DrawerContext,
} from "./posScreens";
import { InternalReviewScreen, ReviewerCommentDock } from "./posReview";
import { Drawer } from "./posDrawer";
import { generatePosReport } from "./posDocx";
import "./css/posWorkspace.css";

interface StepHeader {
  eyebrow: string;
  title: string;
  sub?: string;
}

function headersFor(stepId: string, isApprover: boolean): StepHeader {
  switch (stepId) {
    case "setup": return { eyebrow: "Step 01", title: "Set up the workbook", sub: "Identify the plant, the analysis stage, and the capability category the analysis must meet." };
    case "documents": return { eyebrow: "Step 02", title: "Bring your design documents", sub: "Upload anything that describes how the plant is configured and operated." };
    case "evolutions": return { eyebrow: "Step 03", title: "Plant evolutions" };
    case "states": return { eyebrow: "Step 04", title: "Operating states", sub: "Define the slices of each evolution where the plant's response to a given event is essentially uniform." };
    case "interviews": return { eyebrow: "Step 05", title: "Interviews & walkdowns", sub: "Log interviews or walkdowns that informed the operating-state definitions." };
    case "screening": return { eyebrow: "Step 06", title: "Screening", sub: "By default every state is carried forward. Screen one out only with a written justification." };
    case "grouping": return { eyebrow: "Step 07", title: "Grouping", sub: "Combine similar states only when one member's response bounds the rest, without masking any risk-significant contributor." };
    case "frequency": return { eyebrow: "Step 08", title: "Frequencies & duration", sub: "Mean time spent in each state, mean entry frequency, and basis. Pre-operational durations come from the assumed cycle plan." };
    case "decayheat": return { eyebrow: "Step 09", title: "Decay heat", sub: "For every low-power and shutdown state, characterise the decay heat." };
    case "draft": return { eyebrow: "Step 10 · Draft", title: "Produce the draft", sub: "Generate the Word report from everything entered so far. Submitting the draft advances the workbook to internal technical review." };
    case "review": return {
      eyebrow: "Step 11 · Review & Approval",
      title: isApprover ? "Internal approval" : "Internal technical review",
      sub: isApprover
        ? "All steps 1–9 are locked. Review the comment record, leave any closing remarks, then sign and approve."
        : "Address every reviewer comment. The workbook can only be submitted for approval once the reviewer has marked all comments resolved.",
    };
    default: return { eyebrow: "", title: "" };
  }
}

function WorkspaceHeader({
  stage, setStage, onBack, persona, workflowState,
}: {
  stage: Stage;
  setStage: (s: Stage) => void;
  onBack: () => void;
  persona: PosPersona;
  workflowState: string;
}): JSX.Element {
  const isReviewer = persona === "reviewer";
  const isApprover = persona === "approver";
  const personaPill = isReviewer
    ? { cls: "poshd__wfstate--external", text: "Reviewer · view + comment only" }
    : isApprover
      ? { cls: "poshd__wfstate--approver", text: "Approver · view + comment + sign" }
      : null;
  const wf = workflowStateDisplay(workflowState);
  return (
    <header className={`poshd${isReviewer ? " poshd--external" : ""}${isApprover ? " poshd--approver" : ""}`}>
      <div className="poshd__crumb">
        <button type="button" onClick={onBack}><POSIcon.ArrowL /></button>
        <button type="button" onClick={onBack}>{POS_PROJECT.projectName}</button>
        <POSIcon.Chevron />
        <span>Plant operating states</span>
        <POSIcon.Chevron />
        <span className="poshd__crumb-current">{POS_PROJECT.workbookName}</span>
        {personaPill !== null ? (
          <span className={`poshd__wfstate ${personaPill.cls}`} title={PERSONAS[persona].blurb}>
            <POSIcon.Lock />
            {personaPill.text}
          </span>
        ) : (
          <span className={`poshd__wfstate poshd__wfstate--${wf.tone}`} title={wf.blurb}>
            <span className="poshd__wfstate-dot" />
            {wf.label}
          </span>
        )}
      </div>

      <div className="poshd__spacer" />

      <div className="poshd__identity">
        <div className="poshd__identity-title">{POS_PROJECT.plant.name}</div>
        <div className="poshd__identity-meta">
          {POS_PROJECT.plant.type} <span className="poshd__identity-sep">·</span> {POS_PROJECT.plant.power} <span className="poshd__identity-sep">·</span> {POS_PROJECT.plant.vendor}
        </div>
      </div>

      <div className="poshd__spacer" />

      <div className="poshd__actions">
        <div className="poshd__toggle" role="group" aria-label="Plant stage">
          <button
            type="button"
            className={`poshd__toggle-opt${stage === "pre_operational" ? " poshd__toggle-opt--active" : ""}`}
            onClick={() => setStage("pre_operational")}
            title="Plant not yet operating"
          >
            Pre-operational
          </button>
          <button
            type="button"
            className={`poshd__toggle-opt${stage === "operational" ? " poshd__toggle-opt--active" : ""}`}
            onClick={() => setStage("operational")}
            title="Plant in operation"
          >
            Operational
          </button>
        </div>
        <span className="poshd__save-pill">
          <span className="poshd__save-pill-dot" />
          Autosaved · v{POS_PROJECT.workbookVersion}
        </span>
        <button type="button" className="posnav__btn" aria-label="History">
          <POSIcon.History />
        </button>
      </div>
    </header>
  );
}

function StepRail({
  stepId, setStepId, persona, visibleSteps,
}: {
  stepId: string;
  setStepId: (id: string) => void;
  persona: PosPersona;
  visibleSteps: PosStep[];
}): JSX.Element {
  const idx = Math.max(0, visibleSteps.findIndex((s) => s.id === stepId));
  const pct = ((idx + 1) / visibleSteps.length) * 100;
  const eyebrow = persona === "reviewer" ? "Reviewer view" : persona === "approver" ? "Approver view" : "Workspace progress";
  return (
    <aside className="posw__rail" aria-label="POS analysis steps">
      <div className="posrail__head">
        <span className="posrail__eyebrow">{eyebrow}</span>
        <div className="posrail__progress">
          <span className="posrail__progress-num">{idx + 1}</span>
          <span className="posrail__progress-total">/ {visibleSteps.length} steps</span>
        </div>
        <div className="posrail__bar"><div className="posrail__bar-fill" style={{ width: `${pct}%` }} /></div>
      </div>
      <ul className="posrail__list">
        {visibleSteps.map((s, i) => {
          const active = s.id === stepId;
          const complete = s.status === "complete";
          const idle = s.status === "idle";
          const warn = s.warn === true && !active;
          const prevNum = i > 0 ? parseInt(visibleSteps[i - 1].num, 10) : null;
          const showJump = prevNum !== null && parseInt(s.num, 10) - prevNum > 1;
          return (
            <li key={s.id}>
              {showJump && (
                <div className="posrail__jump" aria-hidden="true">
                  <span className="posrail__jump-label">Step 10 (Draft) is hidden in this view</span>
                </div>
              )}
              <button
                type="button"
                className={`posrail__step${active ? " posrail__step--active" : ""}${complete ? " posrail__step--complete" : ""}${idle ? " posrail__step--idle" : ""}`}
                onClick={() => setStepId(s.id)}
              >
                <span className="posrail__step-num">{complete ? <POSIcon.Check /> : s.num}</span>
                <span>
                  <span className="posrail__step-label">{s.label}</span>
                </span>
                <span className="posrail__step-warn" style={{ background: warn ? "var(--color-warning)" : "transparent" }} />
              </button>
            </li>
          );
        })}
      </ul>
      <div className="posrail__footer">
        <button type="button" className="posrail__footer-btn"><POSIcon.Layers /> Show all inputs</button>
        <button type="button" className="posrail__footer-btn"><POSIcon.Settings /> Workbook settings</button>
      </div>
    </aside>
  );
}

function ConformanceDock({
  ccId, stage, onGoToSetup, onClose, onAction,
}: {
  ccId: string;
  stage: Stage;
  onGoToSetup: () => void;
  onClose: () => void;
  onAction: (msg: string) => void;
}): JSX.Element {
  const cc = CAPABILITY_CATEGORIES.find((c) => c.id === ccId) ?? CAPABILITY_CATEGORIES[0];
  const items = useMemo(() => filterConformance(ccId, stage), [ccId, stage]);
  const sections = useMemo(() => groupBySection(items), [items]);
  const scores = ccScore(ccId);
  const dashTotal = 99.9;
  const dash = (scores.percent * dashTotal) / 100;
  return (
    <aside className="posw__dock" aria-label="Conformance checklist">
      <div className="posdock__head">
        <div className="posdock__title-row">
          <h2 className="posdock__title">Conformance</h2>
          <button type="button" className="posdock__close" onClick={onClose} aria-label="Hide checklist"><POSIcon.Close /></button>
        </div>

        <div className="posdock__profile">
          <div className="posdock__profile-display">
            <span className="posdock__profile-name">{cc.name}</span>
            <span className="posdock__profile-tag">{cc.tag}</span>
            <button type="button" className="posdock__profile-change" onClick={onGoToSetup}>Change</button>
          </div>
        </div>

        <div className="posdock__gauge">
          <div className="posdock__gauge-circle">
            <svg viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="15.9" fill="none" strokeWidth="3.2" className="posdock__gauge-track" />
              <circle cx="18" cy="18" r="15.9" fill="none" strokeWidth="3.2" className="posdock__gauge-fill" strokeDasharray={`${dash} ${dashTotal}`} strokeLinecap="round" />
              <text x="18" y="18">{scores.percent}%</text>
            </svg>
          </div>
          <div className="posdock__gauge-meta">
            <span className="posdock__gauge-summary">{scores.met} of {scores.applicable} ready</span>
            <span className="posdock__gauge-detail">
              {scores.warn > 0 && <>{scores.warn} attention </>}
              {scores.blocked > 0 && <>· {scores.blocked} blocked </>}
              {scores.na > 0 && <>· {scores.na} N/A</>}
            </span>
          </div>
        </div>
      </div>

      <div className="posdock__body">
        {sections.map(([sectionName, sectionItems]) => (
          <div key={sectionName}>
            <div className="posdock__section-head">
              {sectionName}
              <span className="posdock__section-head-count">
                {sectionItems.filter((it) => it.status === "ok").length} / {sectionItems.length}
              </span>
            </div>
            {sectionItems.map((it) => {
              const nm = it.linkedNM !== undefined ? nmViewById(it.linkedNM) : undefined;
              return (
                <div key={it.id} className={`posdock__item posdock__item--${it.status}`}>
                  <span className="posdock__item-dot" />
                  <span>
                    <span className="posdock__item-text">{it.text}</span>
                    {it.meta !== undefined && <span className="posdock__item-meta">{it.meta}</span>}
                    {nm !== undefined && (
                      <button
                        type="button"
                        className="posdock__item-link"
                        onClick={() => onAction(`${nm.id} — Newly Developed Method workbook coming soon`)}
                      >
                        <POSIcon.Bolt /> {nm.id}
                      </button>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="posdock__foot">
        <button type="button" className="posnav__btn"><POSIcon.Eye /> Why these items?</button>
      </div>
    </aside>
  );
}

function PosDemoPage(): JSX.Element {
  const navigate = useNavigate();
  const { current } = useDemoIdentity();
  const persona = current.persona;
  const isReviewer = persona === "reviewer";
  const isApprover = persona === "approver";
  const isPreparer = persona === "preparer";

  const visibleSteps = useMemo(() => stepsForPersona(persona), [persona]);

  const initialStep = visibleSteps[0]?.id ?? "setup";
  const [stepId, setStepIdState] = useState<string>(initialStep);
  const [ccId, setCcId] = useState("cc-ii");
  const [stage, setStage] = useState<Stage>("pre_operational");
  const [dockOpen, setDockOpen] = useState(true);
  const [drawer, setDrawer] = useState<DrawerContext | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);

  const [comments, setComments] = useState<CommentView[]>(() => commentsView());
  const [submitted, setSubmitted] = useState(false);
  const [approved, setApproved] = useState(false);
  const [commentDockOpen, setCommentDockOpen] = useState(false);

  useEffect(() => {
    if (visibleSteps.find((s) => s.id === stepId) === undefined) {
      const fallback = visibleSteps[0]?.id ?? "setup";
      setStepIdState(fallback);
    }
  }, [persona, stepId, visibleSteps]);

  function setStepId(id: string): void {
    setStepIdState(id);
  }

  function flash(msg: string): void {
    setToast(msg);
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2200);
  }

  function handleGenerate(final: boolean): void {
    flash(final ? "Generating report…" : "Generating draft report…");
    generatePosReport(final).catch(() => flash("Could not generate the report"));
  }

  function handleSubmitDraft(ready: boolean): void {
    flash(ready ? "Draft submitted to internal review" : "Working draft submitted with open items");
    setStepId("review");
  }

  function handleSubmitToApproval(): void {
    setSubmitted(true);
    flash("Submitted to internal approval");
  }

  function handleSign(): void {
    setApproved(true);
    flash("Workbook approved · locked from edits");
  }

  function toggleResolved(commentId: string): void {
    if (!isReviewer) return;
    setComments((prev) => prev.map((c) => {
      if (c.id !== commentId) return c;
      const becomingResolved = !c.resolved;
      return {
        ...c,
        resolved: becomingResolved,
        resolution: becomingResolved ? (c.resolution ?? "Marked resolved by reviewer.") : c.resolution,
      };
    }));
  }

  const idx = Math.max(0, visibleSteps.findIndex((s) => s.id === stepId));
  const step = visibleSteps[idx] ?? visibleSteps[0];
  const prev = visibleSteps[idx - 1];
  const next = visibleSteps[idx + 1];
  const cc = CAPABILITY_CATEGORIES.find((c) => c.id === ccId) ?? CAPABILITY_CATEGORIES[0];
  const scores = ccScore(ccId);
  const h = headersFor(stepId, isApprover);

  const screenProps = { ccId, setCcId, stage, setStage, openDrawer: setDrawer, onAction: flash };

  function renderScreen(): JSX.Element | null {
    switch (stepId) {
      case "setup": return <SetupScreen {...screenProps} />;
      case "documents": return <DocumentsScreen {...screenProps} />;
      case "evolutions": return <EvolutionsScreen {...screenProps} />;
      case "states": return <StatesScreen {...screenProps} />;
      case "interviews": return <InterviewsScreen {...screenProps} />;
      case "screening": return <ScreeningScreen {...screenProps} />;
      case "grouping": return <GroupingScreen {...screenProps} />;
      case "frequency": return <FrequencyScreen />;
      case "decayheat": return <DecayHeatScreen {...screenProps} />;
      case "draft": return <DraftScreen cc={cc} scores={scores} stage={stage} onGenerate={handleGenerate} onSubmitDraft={handleSubmitDraft} />;
      case "review": return (
        <InternalReviewScreen
          persona={persona}
          cc={cc}
          scores={scores}
          comments={comments}
          submitted={submitted}
          approved={approved}
          onToggleResolved={toggleResolved}
          onSubmitToApproval={handleSubmitToApproval}
          onSign={handleSign}
          onAction={flash}
        />
      );
      default: return null;
    }
  }

  return (
    <div className={`posw${isReviewer ? " posw--external posw--reviewer" : ""}${isApprover ? " posw--approver" : ""}`} data-screen-label={`POS — ${step.label}`}>
      {isReviewer && <div className="poshd__extbar" />}
      {isApprover && <div className="poshd__apprbar" />}
      <WorkspaceHeader stage={stage} setStage={setStage} onBack={() => navigate(-1)} persona={persona} workflowState={POS_ANALYSIS.workflowState} />

      <div className={`posw__shell${dockOpen ? "" : " posw__shell--dock-closed"}`}>
        <StepRail stepId={stepId} setStepId={setStepId} persona={persona} visibleSteps={visibleSteps} />

        <main className="posmain" aria-label="Step content">
          <div className="posmain__head">
            <div className="posmain__title-block">
              <div className="posmain__eyebrow">{h.eyebrow}</div>
              <h1 className="posmain__title">{h.title}</h1>
              {h.sub !== undefined && <p className="posmain__sub">{h.sub}</p>}
            </div>
            <div className="posmain__actions">
              {!dockOpen && (
                <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => setDockOpen(true)}>
                  <POSIcon.Eye /> Show conformance
                </button>
              )}
              {isPreparer && stepId !== "draft" && stepId !== "review" && (
                <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => setStepId("draft")}>
                  Preview draft <POSIcon.Eye />
                </button>
              )}
            </div>
          </div>

          {renderScreen()}

          <div className="posnav">
            <button
              type="button"
              className={`posnav__btn posnav__btn--sm${prev ? "" : " posnav__btn--ghost"}`}
              disabled={prev === undefined}
              onClick={() => { if (prev !== undefined) setStepId(prev.id); }}
            >
              <POSIcon.ArrowL /> {prev ? prev.label : "Start"}
            </button>
            {next ? (
              <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={() => setStepId(next.id)}>
                Next: {next.label} <POSIcon.ArrowR />
              </button>
            ) : isPreparer ? (
              <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={() => flash("Released to external workflows")}>
                <POSIcon.Send /> Released to external workflows
              </button>
            ) : <span />}
          </div>
        </main>

        {dockOpen && (
          <ConformanceDock
            ccId={ccId}
            stage={stage}
            onGoToSetup={() => setStepId("setup")}
            onClose={() => setDockOpen(false)}
            onAction={flash}
          />
        )}
      </div>

      {drawer !== null && <Drawer context={drawer} onClose={() => setDrawer(null)} />}

      {toast !== null && <div className="postoast" role="status">{toast}</div>}

      {isReviewer && (
        <ReviewerCommentDock
          open={commentDockOpen}
          onToggle={() => setCommentDockOpen((v) => !v)}
          onClose={() => setCommentDockOpen(false)}
          stepId={stepId}
          comments={comments}
          onToggleResolved={toggleResolved}
          onAction={flash}
        />
      )}
    </div>
  );
}

export { PosDemoPage };
