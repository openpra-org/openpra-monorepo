import { WorkbookSectionHeading } from "../workbooks/workbookSectionHeading";
import { JSX, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SCIcon } from "./scIcons";
import {
  SC_PERSONAS,
  CAPABILITY_CATEGORIES,
  type ScPersona,
  type ScStep,
  type Stage,
} from "./scViewData";
import { ccScore, commentsView, filterConformance, groupBySection, stepsFromMef, type CommentView } from "./scSelectors";
import { ScScopeScreen, EndStatesScreen, CriteriaScreen, MissionScreen, BasesScreen, PassiveScreen, ConsistencyScreen, DraftScreen, PlaceholderScreen } from "./scScreens";
import { InternalReviewScreen, ReviewerCommentDock } from "./scReview";
import { ScHandoffScreen } from "./ScHandoff";
import { type ScLinkActions } from "./scLinks";
import { useScWorkbook, type ScWorkbookData } from "./scWorkbookContext";
import { useAuth } from "../auth/AuthContext";
import { WorkbookDemoSignCard } from "../workbooks/workbookDemoSignCard";
import { DockDependsChip } from "../workbooks/workbookInterfaces";
import "../workbooks/css/workbookWorkspace.css";
import "./css/scScreens.css";

interface StepHeader {
  eyebrow: string;
  title: string;
}

function headersFor(stepId: string): StepHeader {
  switch (stepId) {
    case "scope": return { eyebrow: "Step 01", title: "Scope" };
    case "stable": return { eyebrow: "Step 02", title: "End states" };
    case "criteria": return { eyebrow: "Step 03", title: "Success criteria" };
    case "mission": return { eyebrow: "Step 04", title: "Mission times" };
    case "bases": return { eyebrow: "Step 05", title: "Engineering bases" };
    case "passive": return { eyebrow: "Step 06", title: "Passive reliability" };
    case "consistency": return { eyebrow: "Step 07", title: "Consistency" };
    case "handoff": return { eyebrow: "Step 08", title: "Technical Element Handoff" };
    case "draft": return { eyebrow: "Step 09 · Draft", title: "Produce the draft" };
    case "review": return { eyebrow: "Step 10 · Review", title: "Internal technical review" };
    case "approval": return { eyebrow: "Step 11 · Approval", title: "Approval & sign-off" };
    default: return { eyebrow: "", title: "" };
  }
}

interface HeaderMeta {
  projectName: string;
  workbookName: string;
  workbookVersion: string;
}

function WorkspaceHeader({
  persona, setPersona, workflowState, showPersonaPicker, availablePersonas, onOpenRoles, onLoadExample, onUnloadExample, headerMeta, onToggleRail, onToggleDock,
}: {
  persona: ScPersona;
  setPersona: (p: ScPersona) => void;
  workflowState: string;
  showPersonaPicker: boolean;
  availablePersonas: ScPersona[];
  onOpenRoles?: () => void;
  onLoadExample?: () => void;
  onUnloadExample?: () => void;
  headerMeta: HeaderMeta;
  onToggleRail?: () => void;
  onToggleDock?: () => void;
}): JSX.Element {
  const navigate = useNavigate();
  const isReviewer = persona === "reviewer";
  const isApprover = persona === "approver";
  const personaPill = isReviewer
    ? { cls: "poshd__wfstate--external", text: "Reviewer · view + comment only" }
    : isApprover
      ? { cls: "poshd__wfstate--approver", text: "Approver · view + comment + sign" }
      : null;
  return (
    <header className={`poshd${isReviewer ? " poshd--external" : ""}${isApprover ? " poshd--approver" : ""}`}>
      {onToggleRail !== undefined && (
        <button type="button" className="posw__mobile-toggle" onClick={onToggleRail} aria-label="Open steps"><SCIcon.Layers /> Steps</button>
      )}
      <div className="poshd__crumb">
        <button type="button" onClick={() => navigate(-1)}><SCIcon.ArrowL /></button>
        <button type="button" onClick={() => navigate(-1)}>{headerMeta.projectName}</button>
        <SCIcon.Chevron />
        <span>Success Criteria Development</span>
        <SCIcon.Chevron />
        <span className="poshd__crumb-current">{headerMeta.workbookName}</span>
        {personaPill !== null ? (
          <span className={`poshd__wfstate ${personaPill.cls}`} title={SC_PERSONAS[persona].blurb}>
            <SCIcon.Lock />{personaPill.text}
          </span>
        ) : (
          <span className="poshd__wfstate poshd__wfstate--draft" title={workflowState}>
            <span className="poshd__wfstate-dot" />{workflowState}
          </span>
        )}
      </div>

      <div className="poshd__spacer" />

      <div className="poshd__actions">
        {showPersonaPicker && availablePersonas.length > 1 && (
          <label className="poshd__perspective" title="Switch perspective">
            <span className="poshd__perspective-label">View as</span>
            <select className="poshd__perspective-select" value={persona} onChange={(e) => setPersona(e.target.value as ScPersona)}>
              {availablePersonas.includes("preparer") && <option value="preparer">Preparer</option>}
              {availablePersonas.includes("reviewer") && <option value="reviewer">Reviewer</option>}
              {availablePersonas.includes("approver") && <option value="approver">Approver</option>}
            </select>
          </label>
        )}
        {onOpenRoles !== undefined && (
          <button type="button" className="posnav__btn posnav__btn--sm" onClick={onOpenRoles} title="Manage roles"><SCIcon.Settings /> Roles</button>
        )}
        {onLoadExample !== undefined && (
          <button type="button" className="posnav__btn posnav__btn--sm" onClick={onLoadExample} title="Replace contents with an example workbook"><SCIcon.Sparkle /> Load example</button>
        )}
        {onUnloadExample !== undefined && (
          <button type="button" className="posnav__btn posnav__btn--sm" onClick={onUnloadExample} title="Restore the contents that existed before the example was loaded"><SCIcon.Close /> Unload example</button>
        )}
        <span className="poshd__save-pill"><span className="poshd__save-pill-dot" />Autosaved · v{headerMeta.workbookVersion}</span>
        <button type="button" className="posnav__btn" aria-label="History"><SCIcon.History /></button>
        {onToggleDock !== undefined && (
          <button type="button" className="posw__mobile-toggle" onClick={onToggleDock} aria-label="Open conformance"><SCIcon.Eye /> Conformance</button>
        )}
      </div>
    </header>
  );
}

function StepRail({ stepId, setStepId, persona, visibleSteps, mobileOpen }: {
  stepId: string;
  setStepId: (id: string) => void;
  persona: ScPersona;
  visibleSteps: ScStep[];
  mobileOpen: boolean;
}): JSX.Element {
  const idx = Math.max(0, visibleSteps.findIndex((s) => s.id === stepId));
  const pct = ((idx + 1) / visibleSteps.length) * 100;
  const eyebrow = persona === "reviewer" ? "Reviewer view" : persona === "approver" ? "Approver view" : "Workspace progress";
  return (
    <aside className={`posw__rail${mobileOpen ? " posw__rail--mobile-open" : ""}`} aria-label="SC analysis steps">
      <div className="posrail__head">
        <span className="posrail__eyebrow">{eyebrow}</span>
        <div className="posrail__progress">
          <span className="posrail__progress-num">{idx + 1}</span>
          <span className="posrail__progress-total">/ {visibleSteps.length} steps</span>
        </div>
        <div className="posrail__bar"><div className="posrail__bar-fill" style={{ width: `${pct}%` }} /></div>
      </div>
      <ul className="posrail__list">
        {visibleSteps.map((s) => {
          const active = s.id === stepId;
          const complete = s.status === "complete";
          const idle = s.status === "idle";
          return (
            <li key={s.id}>
              <button type="button" className={`posrail__step${active ? " posrail__step--active" : ""}${complete ? " posrail__step--complete" : ""}${idle ? " posrail__step--idle" : ""}`} onClick={() => setStepId(s.id)}>
                <span className="posrail__step-num">{complete ? <SCIcon.Check /> : s.num}</span>
                <span><span className="posrail__step-label">{s.label}</span></span>
                <span className="posrail__step-warn" style={{ background: "transparent" }} />
              </button>
            </li>
          );
        })}
      </ul>
      <div className="posrail__footer">
        <button type="button" className="posrail__footer-btn"><SCIcon.Layers /> Show all inputs</button>
        <button type="button" className="posrail__footer-btn"><SCIcon.Settings /> Workbook settings</button>
      </div>
    </aside>
  );
}

function ConformanceDock({ ccId, stage, onGoToScope, onClose, mobileOpen }: {
  ccId: string;
  stage: Stage;
  onGoToScope: () => void;
  onClose: () => void;
  mobileOpen: boolean;
}): JSX.Element {
  const { sc } = useScWorkbook();
  const cc = CAPABILITY_CATEGORIES.find((c) => c.id === ccId) ?? CAPABILITY_CATEGORIES[0];
  const items = useMemo(() => filterConformance(sc, ccId, stage), [sc, ccId, stage]);
  const sections = useMemo(() => groupBySection(items), [items]);
  const scores = ccScore(sc, ccId, stage);
  const dashTotal = 99.9;
  const dash = (scores.percent * dashTotal) / 100;
  return (
    <aside className={`posw__dock${mobileOpen ? " posw__dock--mobile-open" : ""}`} aria-label="Conformance checklist">
      <div className="posdock__head">
        <div className="posdock__title-row">
          <h2 className="posdock__title">Conformance</h2>
          <button type="button" className="posdock__close" onClick={onClose} aria-label="Hide checklist"><SCIcon.Close /></button>
        </div>
        <div className="posdock__profile">
          <div className="posdock__profile-display">
            <span className="posdock__profile-name">{cc.name}</span>
            <span className="posdock__profile-tag">{cc.tag}</span>
            <button type="button" className="posdock__profile-change" onClick={onGoToScope}>Change</button>
          </div>
        </div>
        <div className="posdock__gauge">
          <div className="posdock__gauge-circle">
            <svg viewBox="0 0 36 36">
              <circle cx="18" cy="18" r="15.9" fill="none" strokeWidth="3.2" className="posdock__gauge-track" />
              <circle cx="18" cy="18" r="15.9" fill="none" strokeWidth="3.2" className="posdock__gauge-fill" strokeDasharray={`${dash} ${dashTotal}`} strokeLinecap="round" transform="rotate(-90, 18, 18)" />
              <text x="18" y="18" className="posdock__gauge-text">{scores.percent}%</text>
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
              <span className="posdock__section-head-count">{sectionItems.filter((it) => it.status === "ok").length} / {sectionItems.length}</span>
            </div>
            {sectionItems.map((it) => (
              <div key={it.id} className={`posdock__item posdock__item--${it.status}`}>
                <span className="posdock__item-dot" />
                <span><span className="posdock__item-text">{it.text}</span><DockDependsChip element="SC" sr={it.id} /></span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </aside>
  );
}

interface ScWorkbenchActions {
  postComment: (text: string, severity: "MAJOR" | "MINOR" | "OBSERVATION", stepId: string) => Promise<void>;
  toggleResolve: (commentId: string, nextResolved: boolean) => Promise<void>;
  submitForReview: () => Promise<void>;
  requestRevision: (note: string) => Promise<void>;
}

const DEFAULT_PERSONAS: ScPersona[] = ["preparer", "reviewer", "approver"];

function ScWorkbench({
  data, persona, setPersona, showPersonaPicker, availablePersonas = DEFAULT_PERSONAS, onOpenRoles, linkActions, onLoadExample, onUnloadExample, onStageChange, actions, headerMeta, renderApprovalTable, renderSignCard, renderRoster, renderDocuments,
}: {
  data: ScWorkbookData;
  persona: ScPersona;
  setPersona: (p: ScPersona) => void;
  showPersonaPicker: boolean;
  availablePersonas?: ScPersona[];
  onOpenRoles?: () => void;
  linkActions?: ScLinkActions;
  onLoadExample?: () => void;
  onUnloadExample?: () => void;
  onStageChange?: (s: Stage) => void;
  actions?: ScWorkbenchActions;
  headerMeta: HeaderMeta;
  renderApprovalTable?: () => JSX.Element | null;
  renderSignCard?: () => JSX.Element | null;
  renderRoster?: () => JSX.Element | null;
  renderDocuments?: () => JSX.Element | null;
}): JSX.Element {
  const isReviewer = persona === "reviewer";
  const isApprover = persona === "approver";

  const visibleSteps = useMemo(() => stepsFromMef(data.sc, persona), [data.sc, persona]);
  const mefCcId = data.sc.capabilityCategory === "CC-I" ? "cc-i" : "cc-ii";
  const mefStage: Stage = data.sc.plantStage === "OPERATIONAL" ? "operational" : "pre_operational";
  const [ccId, setCcId] = useState<string>(mefCcId);
  const [stage, setStageState] = useState<Stage>(mefStage);
  useEffect(() => { setCcId(mefCcId); }, [mefCcId]);
  useEffect(() => { setStageState(mefStage); }, [mefStage]);

  function setStage(s: Stage): void {
    setStageState(s);
    onStageChange?.(s);
  }

  const [stepId, setStepIdState] = useState<string>(visibleSteps[0]?.id ?? "scope");
  const [dockOpen, setDockOpen] = useState(false);
  const [railMobileOpen, setRailMobileOpen] = useState(false);
  const [dockMobileOpen, setDockMobileOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);

  useEffect(() => {
    if (visibleSteps.find((s) => s.id === stepId) === undefined) {
      setStepIdState(visibleSteps[0]?.id ?? "scope");
    }
  }, [persona, stepId, visibleSteps]);

  function setStepId(id: string): void {
    setStepIdState(id);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "auto" });
  }

  function flash(msg: string): void {
    setToast(msg);
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2200);
  }

  const { user: authUser } = useAuth();
  const actingUsername = authUser?.username ?? "";
  const isPreparer = persona === "preparer";
  const [comments, setComments] = useState<CommentView[]>(() => commentsView(data.sc));
  const [commentDockOpen, setCommentDockOpen] = useState(false);
  const [demoSubmittedLocal, setDemoSubmittedLocal] = useState(false);
  const [demoApprovedLocal, setDemoApprovedLocal] = useState(false);
  const [demoPreparerPhase, setDemoPreparerPhase] = useState(false);
  useEffect(() => { setComments(commentsView(data.sc)); }, [data.sc]);

  const workflowState = data.sc.workflowState;
  const submitted = actions === undefined ? demoSubmittedLocal : (workflowState === "INTERNAL_APPROVAL" || workflowState === "FINAL");
  const approved = actions === undefined ? demoApprovedLocal : workflowState === "FINAL";
  const cc = CAPABILITY_CATEGORIES.find((c) => c.id === ccId) ?? CAPABILITY_CATEGORIES[0];
  const scores = ccScore(data.sc, ccId, stage);
  const openCount = comments.filter((c) => !c.resolved).length;
  const resolvedCount = comments.filter((c) => c.resolved).length;

  function handleSubmitToApproval(): void {
    if (actions === undefined) { setDemoSubmittedLocal(true); flash("Submitted for internal review (example)"); return; }
    actions.submitForReview().then(() => flash("Submitted for internal review")).catch((err: unknown) => flash((err as { message?: string }).message ?? "Could not submit"));
  }
  function toggleResolved(commentId: string): void {
    if (!isReviewer && !isApprover) return;
    if (actions === undefined) { flash("Comment updated (example workbook)"); return; }
    const target = comments.find((c) => c.id === commentId);
    if (target === undefined) return;
    actions.toggleResolve(commentId, !target.resolved).catch((err: unknown) => flash((err as { message?: string }).message ?? "Could not update comment"));
  }
  function handlePostComment(text: string, severity: "MAJOR" | "MINOR" | "OBSERVATION"): void {
    if (actions === undefined) { flash("Comment posted (example workbook)"); return; }
    actions.postComment(text, severity, stepId).then(() => flash("Comment posted")).catch((err: unknown) => flash((err as { message?: string }).message ?? "Could not post comment"));
  }
  function handleRequestRevision(): void {
    if (actions === undefined) { flash("Revision requested (example workbook)"); return; }
    actions.requestRevision("").then(() => flash("Revision requested")).catch((err: unknown) => flash((err as { message?: string }).message ?? "Could not request revision"));
  }

  const idx = Math.max(0, visibleSteps.findIndex((s) => s.id === stepId));
  const step = visibleSteps[idx] ?? visibleSteps[0];
  const prev = visibleSteps[idx - 1];
  const next = visibleSteps[idx + 1];
  const h = headersFor(stepId);

  function renderScreen(): JSX.Element {
    switch (stepId) {
      case "scope":
        return (
          <>
            <ScScopeScreen ccId={ccId} setCcId={setCcId} onAction={flash} stage={stage} setStage={setStage} linkActions={linkActions} />
            {renderDocuments?.()}
          </>
        );
      case "stable": return <EndStatesScreen />;
      case "criteria": return <CriteriaScreen />;
      case "mission": return <MissionScreen />;
      case "bases": return <BasesScreen />;
      case "passive": return <PassiveScreen />;
      case "consistency": return <ConsistencyScreen />;
      case "handoff": return <ScHandoffScreen />;
      case "draft": return <DraftScreen cc={cc} scores={scores} stage={stage} onSubmitDraft={() => { handleSubmitToApproval(); setStepId("review"); }} canSubmit={isPreparer} />;
      case "review":
      case "approval": return (
        <InternalReviewScreen
          step={stepId === "approval" ? "approval" : "review"}
          persona={persona}
          cc={cc}
          scores={scores}
          comments={comments}
          submitted={submitted}
          approved={approved}
          actingUsername={actingUsername}
          onSubmitToApproval={handleSubmitToApproval}
          onAction={flash}
          rosterSlot={stepId === "review" ? renderRoster?.() : undefined}
          signCardSlot={stepId === "approval" ? (
            actions === undefined ? (
              <WorkbookDemoSignCard
                persona={persona}
                myOpenComments={comments.filter((c) => c.authorId === actingUsername && !c.resolved).length}
                submitted={submitted}
                preparerPhase={demoPreparerPhase}
                onReviewerApproverSigned={() => setDemoPreparerPhase(true)}
                onPreparerSigned={() => { setDemoApprovedLocal(true); flash("Workbook approved (example)"); }}
              />
            ) : renderSignCard?.()
          ) : undefined}
          approvalTableSlot={stepId === "approval" ? renderApprovalTable?.() : undefined}
        />
      );
      default: return <PlaceholderScreen label={step.label} />;
    }
  }

  return (
    <div className={`posw${isReviewer ? " posw--external posw--reviewer" : ""}${isApprover ? " posw--approver" : ""}`} data-screen-label={`SC — ${step.label}`}>
      {isReviewer && <div className="poshd__extbar" />}
      {isApprover && <div className="poshd__apprbar" />}
      <WorkspaceHeader persona={persona} setPersona={setPersona} workflowState={data.sc.workflowState} showPersonaPicker={showPersonaPicker} availablePersonas={availablePersonas} onOpenRoles={onOpenRoles} onLoadExample={onLoadExample} onUnloadExample={onUnloadExample} headerMeta={headerMeta} onToggleRail={() => setRailMobileOpen((v) => !v)} onToggleDock={() => { setDockOpen(true); setDockMobileOpen((v) => !v); }} />

      <div className={`posw__shell${dockOpen ? "" : " posw__shell--dock-closed"}`}>
        <StepRail stepId={stepId} setStepId={(id) => { setStepId(id); setRailMobileOpen(false); }} persona={persona} visibleSteps={visibleSteps} mobileOpen={railMobileOpen} />

        <main className="posmain" aria-label="Step content">
          <div className="posmain__head">
            <div className="posmain__title-block">
              <div className="posmain__eyebrow">{h.eyebrow}</div>
              <WorkbookSectionHeading title={h.title} level={1} className="posmain__title" />
            </div>
            <div className="posmain__actions">
              {!dockOpen && (
                <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => { setDockOpen(true); setDockMobileOpen(true); }}><SCIcon.Eye /> Show conformance</button>
              )}
            </div>
          </div>

          {renderScreen()}

          <div className="posnav">
            {prev ? (
              <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => setStepId(prev.id)}>
                <SCIcon.ArrowL /> {prev.label}
              </button>
            ) : <span />}
            {next ? (
              <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={() => setStepId(next.id)}>Next: {next.label} <SCIcon.ArrowR /></button>
            ) : <span />}
          </div>
        </main>

        {dockOpen && (
          <ConformanceDock ccId={ccId} stage={stage} onGoToScope={() => setStepId("scope")} onClose={() => { setDockOpen(false); setDockMobileOpen(false); }} mobileOpen={dockMobileOpen} />
        )}
        {(railMobileOpen || dockMobileOpen) && (
          <div className="posw__mobile-scrim" onClick={() => { setRailMobileOpen(false); setDockMobileOpen(false); }} aria-hidden="true" />
        )}
      </div>

      {toast !== null && <div className="postoast" role="status">{toast}</div>}

      {(isReviewer || isApprover) && (
        <ReviewerCommentDock
          open={commentDockOpen}
          onToggle={() => setCommentDockOpen((v) => !v)}
          onClose={() => setCommentDockOpen(false)}
          comments={comments}
          onToggleResolved={toggleResolved}
          onPostComment={handlePostComment}
          onRequestRevision={handleRequestRevision}
          canRequestRevision={actions !== undefined && (workflowState === "INTERNAL_TECHNICAL_REVIEW" || workflowState === "INTERNAL_APPROVAL")}
          persona={persona}
          openCount={openCount}
          resolvedCount={resolvedCount}
        />
      )}
    </div>
  );
}

export { ScWorkbench, type HeaderMeta, type ScWorkbenchActions };
