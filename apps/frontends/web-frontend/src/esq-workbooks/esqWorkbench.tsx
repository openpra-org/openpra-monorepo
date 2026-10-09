import { AnalysisRunHistory } from "../newly-developed-methods/shared/analysisRunHistory";
import { WorkbookSectionHeading } from "../workbooks/workbookSectionHeading";
import { JSX, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ESQIcon } from "./esqIcons";
import {
  ESQ_PERSONAS,
  CAPABILITY_CATEGORIES,
  type EsqPersona,
  type EsqStep,
  type Stage,
} from "./esqViewData";
import { ccScore, commentsView, filterConformance, groupBySection, stepsFromMef, type CommentView } from "./esqSelectors";
import { ScopeScreen } from "./esqScreens";
import { ModelScreen, ModelWindows, MODEL_WINDOW_LABELS, type EsqWindowContext } from "./esqModelScreen";
import { LogicScreen, LogicWindows, LOGIC_WINDOW_KINDS, LOGIC_WINDOW_LABELS } from "./esqLogicScreen";
import { BarrierScreen, BarrierWindows, BARRIER_WINDOW_KINDS, BARRIER_WINDOW_LABELS } from "./esqBarrierScreen";
import { SolveScreen, SolveWindows, SOLVE_WINDOW_KINDS, SOLVE_WINDOW_LABELS } from "./esqSolveScreen";
import { PostScreen, PostWindows, POST_WINDOW_KINDS, POST_WINDOW_LABELS } from "./esqPostScreen";
import { ResultsScreen, ResultsWindows, RESULTS_WINDOW_KINDS, RESULTS_WINDOW_LABELS } from "./esqResultsScreen";
import { UncertScreen, UncertWindows, UNCERT_WINDOW_KINDS, UNCERT_WINDOW_LABELS } from "./esqUncertaintyScreen";
import { SensScreen, SensWindows, SENS_WINDOW_KINDS, SENS_WINDOW_LABELS } from "./esqSensitivityScreen";
import { HandoffScreen, HandoffWindows, HANDOFF_WINDOW_KINDS, HANDOFF_WINDOW_LABELS } from "./esqHandoffScreen";
import { DraftScreen, PlaceholderScreen } from "./esqScreens2";
import { InternalReviewScreen, ReviewerCommentDock } from "./esqReview";
import { useEsqWorkbook, type EsqWorkbookData } from "./esqWorkbookContext";
import { useAuth } from "../auth/AuthContext";
import { WorkbookDemoSignCard } from "../workbooks/workbookDemoSignCard";
import { DockDependsChip } from "../workbooks/workbookInterfaces";
import { WorkbookSaveIndicator } from "../workbooks/workbookSaveIndicator";
import { type RevisionedSaveStatus } from "../workbooks/useRevisionedMefPatch";
import "../workbooks/css/workbookWorkspace.css";
import "../welcome/css/newProjectModal.css";
import "./css/esqScreens.css";

interface StepHeader {
  area: string;
  title: string;
}

function headersFor(stepId: string): StepHeader {
  switch (stepId) {
    case "scope": return { area: "HLR-ESQ-A", title: "Scope" };
    case "model": return { area: "HLR-ESQ-A · C", title: "Model" };
    case "solve": return { area: "HLR-ESQ-A · B", title: "Solve and converge" };
    case "logic": return { area: "HLR-ESQ-B", title: "Logic" };
    case "post": return { area: "HLR-ESQ-A · B · C", title: "Post-processing" };
    case "barriers": return { area: "HLR-ESQ-A · C", title: "Barriers and phenomena" };
    case "results": return { area: "HLR-ESQ-D · F", title: "Results review" };
    case "uncert": return { area: "HLR-ESQ-A · E", title: "Uncertainty" };
    case "sens": return { area: "HLR-ESQ-C · E · F", title: "Sensitivity" };
    case "handoff": return { area: "HLR-ESQ-F", title: "Hand-offs" };
    case "draft": return { area: "Draft", title: "Produce the draft" };
    case "review": return { area: "Review", title: "Internal technical review" };
    case "approval": return { area: "Approval", title: "Approval & sign-off" };
    default: return { area: "", title: "" };
  }
}

interface HeaderMeta {
  projectName: string;
  workbookName: string;
  workbookVersion: string;
  saveStatus?: RevisionedSaveStatus;
}

function WorkspaceHeader({
  persona, setPersona, workflowState, showPersonaPicker, availablePersonas, onOpenRoles, onLoadExample, onUnloadExample, headerMeta, onToggleRail, onToggleDock,
}: {
  persona: EsqPersona;
  setPersona: (p: EsqPersona) => void;
  workflowState: string;
  showPersonaPicker: boolean;
  availablePersonas: EsqPersona[];
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
        <button type="button" className="posw__mobile-toggle" onClick={onToggleRail} aria-label="Open steps"><ESQIcon.Layers /> Steps</button>
      )}
      <div className="poshd__crumb">
        <button type="button" onClick={() => navigate(-1)}><ESQIcon.ArrowL /></button>
        <button type="button" onClick={() => navigate(-1)}>{headerMeta.projectName}</button>
        <ESQIcon.Chevron />
        <span>Event Sequence Quantification</span>
        <ESQIcon.Chevron />
        <span className="poshd__crumb-current">{headerMeta.workbookName}</span>
        {personaPill !== null ? (
          <span className={`poshd__wfstate ${personaPill.cls}`} title={ESQ_PERSONAS[persona].blurb}>
            <ESQIcon.Lock />{personaPill.text}
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
            <select className="poshd__perspective-select" value={persona} onChange={(e) => setPersona(e.target.value as EsqPersona)}>
              {availablePersonas.includes("preparer") && <option value="preparer">Preparer</option>}
              {availablePersonas.includes("reviewer") && <option value="reviewer">Reviewer</option>}
              {availablePersonas.includes("approver") && <option value="approver">Approver</option>}
            </select>
          </label>
        )}
        {onOpenRoles !== undefined && (
          <button type="button" className="posnav__btn posnav__btn--sm" onClick={onOpenRoles} title="Manage roles"><ESQIcon.Settings /> Roles</button>
        )}
        {onLoadExample !== undefined && (
          <button type="button" className="posnav__btn posnav__btn--sm" onClick={onLoadExample} title="Replace contents with a packaged example workbook"><ESQIcon.Sparkle /> Load example</button>
        )}
        {onUnloadExample !== undefined && (
          <button type="button" className="posnav__btn posnav__btn--sm" onClick={onUnloadExample} title="Restore the contents that existed before the example was loaded"><ESQIcon.Close /> Unload example</button>
        )}
        <WorkbookSaveIndicator status={headerMeta.saveStatus} workbookVersion={headerMeta.workbookVersion} />
        <button type="button" className="posnav__btn" aria-label="History"><ESQIcon.History /></button>
        {onToggleDock !== undefined && (
          <button type="button" className="posw__mobile-toggle" onClick={onToggleDock} aria-label="Open conformance"><ESQIcon.Eye /> Conformance</button>
        )}
      </div>
    </header>
  );
}

function StepRail({ stepId, setStepId, persona, visibleSteps, mobileOpen, onClose }: {
  stepId: string;
  setStepId: (id: string) => void;
  persona: EsqPersona;
  visibleSteps: EsqStep[];
  mobileOpen: boolean;
  onClose: () => void;
}): JSX.Element {
  const idx = Math.max(0, visibleSteps.findIndex((s) => s.id === stepId));
  const pct = ((idx + 1) / visibleSteps.length) * 100;
  const eyebrow = persona === "reviewer" ? "Reviewer view" : persona === "approver" ? "Approver view" : "Workspace progress";
  return (
    <aside className={`posw__rail${mobileOpen ? " posw__rail--mobile-open" : ""}`} aria-label="ESQ analysis steps">
      <div className="posrail__head">
        <div className="posrail__head-top">
          <span className="posrail__eyebrow">{eyebrow}</span>
          <button type="button" className="posdock__close" onClick={onClose} aria-label="Hide steps" title="Hide steps"><ESQIcon.Close /></button>
        </div>
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
              <button type="button" className={`posrail__step${active ? " posrail__step--active" : ""}${complete ? " posrail__step--complete" : ""}${idle && s.terminal === true ? " posrail__step--idle" : ""}`} onClick={() => setStepId(s.id)}>
                <span className="posrail__step-num">{complete ? <ESQIcon.Check /> : s.num}</span>
                <span>
                  <span className="posrail__step-label">
                    {s.label}
                    {s.hlr !== undefined && <span className="esqhlr">{s.hlr}</span>}
                  </span>
                </span>
                <span className="posrail__step-warn" style={{ background: "transparent" }} />
              </button>
            </li>
          );
        })}
      </ul>
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
  const { esq } = useEsqWorkbook();
  const cc = CAPABILITY_CATEGORIES.find((c) => c.id === ccId) ?? CAPABILITY_CATEGORIES[0];
  const items = useMemo(() => filterConformance(esq, ccId, stage), [esq, ccId, stage]);
  const sections = useMemo(() => groupBySection(items), [items]);
  const scores = ccScore(esq, ccId, stage);
  const dashTotal = 99.9;
  const dash = (scores.percent * dashTotal) / 100;
  return (
    <aside className={`posw__dock${mobileOpen ? " posw__dock--mobile-open" : ""}`} aria-label="Conformance checklist">
      <div className="posdock__head">
        <div className="posdock__title-row">
          <h2 className="posdock__title">Conformance</h2>
          <button type="button" className="posdock__close" onClick={onClose} aria-label="Hide checklist"><ESQIcon.Close /></button>
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
            <span className="posdock__gauge-summary">{scores.ready} of {scores.total} ready</span>
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
                <span>
                  <span className="posdock__item-text">{it.text}</span>
                  {it.meta !== undefined && <span className="posdock__item-meta">{it.meta}</span>}
                  <DockDependsChip element="ESQ" sr={it.id} />
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </aside>
  );
}

const WINDOW_LABELS: Record<EsqWindowContext["kind"], string> = {
  ...MODEL_WINDOW_LABELS,
  ...LOGIC_WINDOW_LABELS,
  ...BARRIER_WINDOW_LABELS,
  ...SOLVE_WINDOW_LABELS,
  ...POST_WINDOW_LABELS,
  ...RESULTS_WINDOW_LABELS,
  ...UNCERT_WINDOW_LABELS,
  ...SENS_WINDOW_LABELS,
  ...HANDOFF_WINDOW_LABELS,
};

function EsqModal({ context, onClose, onRetarget }: { context: EsqWindowContext; onClose: () => void; onRetarget: (ctx: EsqWindowContext) => void }): JSX.Element {
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.current?.focus();
    return () => { trigger?.focus(); };
  }, []);
  useEffect(() => {
    function onKey(e: KeyboardEvent): void { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);
  return (
    <div className="modal__backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        ref={dialog}
        className="modal esq-form-modal"
        role="dialog"
        aria-modal="true"
        aria-label={WINDOW_LABELS[context.kind]}
        tabIndex={-1}
        onKeyDown={(e) => {
          if (e.key !== "Tab") return;
          const controls = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled):not([type="hidden"]), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]')).filter((el) => el.getClientRects().length > 0);
          const first = controls[0];
          const last = controls[controls.length - 1];
          if (first === undefined || last === undefined) { e.preventDefault(); return; }
          if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { e.preventDefault(); last.focus(); }
          else if (!e.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) { e.preventDefault(); first.focus(); }
        }}
      >
        {LOGIC_WINDOW_KINDS.has(context.kind) ? <LogicWindows context={context} onClose={onClose} />
          : BARRIER_WINDOW_KINDS.has(context.kind) ? <BarrierWindows context={context} onClose={onClose} />
          : SOLVE_WINDOW_KINDS.has(context.kind) ? <SolveWindows context={context} onClose={onClose} />
          : POST_WINDOW_KINDS.has(context.kind) ? <PostWindows context={context} onClose={onClose} />
          : RESULTS_WINDOW_KINDS.has(context.kind) ? <ResultsWindows context={context} onClose={onClose} />
          : UNCERT_WINDOW_KINDS.has(context.kind) ? <UncertWindows context={context} onClose={onClose} />
          : SENS_WINDOW_KINDS.has(context.kind) ? <SensWindows context={context} onClose={onClose} />
          : HANDOFF_WINDOW_KINDS.has(context.kind) ? <HandoffWindows context={context} onClose={onClose} />
          : <ModelWindows context={context} onClose={onClose} onRetarget={onRetarget} />}
      </div>
    </div>
  );
}

interface EsqWorkbenchActions {
  postComment: (text: string, severity: "MAJOR" | "MINOR" | "OBSERVATION", stepId: string) => Promise<void>;
  toggleResolve: (commentId: string, nextResolved: boolean) => Promise<void>;
  submitForReview: () => Promise<void>;
  requestRevision: (note: string) => Promise<void>;
}

const DEFAULT_PERSONAS: EsqPersona[] = ["preparer", "reviewer", "approver"];

function EsqWorkbench({
  data, persona, setPersona, showPersonaPicker, availablePersonas = DEFAULT_PERSONAS, onOpenRoles, onLoadExample, onUnloadExample, onStageChange, actions, headerMeta, renderApprovalTable, renderSignCard, renderRoster, renderDocuments,
}: {
  data: EsqWorkbookData;
  persona: EsqPersona;
  setPersona: (p: EsqPersona) => void;
  showPersonaPicker: boolean;
  availablePersonas?: EsqPersona[];
  onOpenRoles?: () => void;
  onLoadExample?: () => void;
  onUnloadExample?: () => void;
  onStageChange?: (s: Stage) => void;
  actions?: EsqWorkbenchActions;
  headerMeta: HeaderMeta;
  renderApprovalTable?: () => JSX.Element | null;
  renderSignCard?: () => JSX.Element | null;
  renderRoster?: () => JSX.Element | null;
  renderDocuments?: () => JSX.Element | null;
}): JSX.Element {
  const isReviewer = persona === "reviewer";
  const isApprover = persona === "approver";

  const { upstream } = useEsqWorkbook();
  const visibleSteps = useMemo(() => stepsFromMef(data.esq, persona, upstream), [data.esq, persona, upstream]);
  const [searchParams] = useSearchParams();
  const requestedStepId = searchParams.get("step");
  const requestedNetworkId = searchParams.get("network");
  const requestedSourceWorkbookId = searchParams.get("sourceWorkbook");
  const mefCcId = data.esq.capabilityCategory === "CC-I" ? "cc-i" : "cc-ii";
  const mefStage: Stage = data.esq.plantStage === "OPERATIONAL" ? "operational" : "pre_operational";
  const [ccId, setCcId] = useState<string>(mefCcId);
  const [stage, setStageState] = useState<Stage>(mefStage);
  useEffect(() => { setCcId(mefCcId); }, [mefCcId]);
  useEffect(() => { setStageState(mefStage); }, [mefStage]);

  function setStage(s: Stage): void {
    setStageState(s);
    onStageChange?.(s);
  }

  const [stepId, setStepIdState] = useState<string>(() =>
    visibleSteps.some((candidate) => candidate.id === requestedStepId)
      ? requestedStepId!
      : visibleSteps[0]?.id ?? "scope");
  const [dockOpen, setDockOpen] = useState(false);
  const [railOpen, setRailOpen] = useState(true);
  const [railMobileOpen, setRailMobileOpen] = useState(false);
  const [dockMobileOpen, setDockMobileOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [windowCtx, setWindowCtx] = useState<EsqWindowContext | null>(null);
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
    toastTimer.current = window.setTimeout(() => setToast(null), Math.max(2200, msg.split(" ").length * 300));
  }

  const { user: authUser } = useAuth();
  const actingUsername = authUser?.username ?? "";
  const isPreparer = persona === "preparer";
  const [comments, setComments] = useState<CommentView[]>(() => commentsView(data.esq));
  const [commentDockOpen, setCommentDockOpen] = useState(false);
  const [demoSubmittedLocal, setDemoSubmittedLocal] = useState(false);
  const [demoApprovedLocal, setDemoApprovedLocal] = useState(false);
  const [demoPreparerPhase, setDemoPreparerPhase] = useState(false);
  useEffect(() => { setComments(commentsView(data.esq)); }, [data.esq]);

  const workflowState = data.esq.workflowState;
  const submitted = actions === undefined ? demoSubmittedLocal : (workflowState === "INTERNAL_APPROVAL" || workflowState === "FINAL");
  const approved = actions === undefined ? demoApprovedLocal : workflowState === "FINAL";
  const cc = CAPABILITY_CATEGORIES.find((c) => c.id === ccId) ?? CAPABILITY_CATEGORIES[0];
  const scores = ccScore(data.esq, ccId, stage);
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
      case "scope": return <ScopeScreen ccId={ccId} setCcId={setCcId} stage={stage} setStage={setStage} documents={renderDocuments?.() ?? null} />;
      case "model": return <ModelScreen openWindow={setWindowCtx} />;
      case "solve": return <SolveScreen openWindow={setWindowCtx} />;
      case "logic": return <LogicScreen openWindow={setWindowCtx} initialNetworkId={requestedNetworkId} initialSourceWorkbookId={requestedSourceWorkbookId} />;
      case "post": return <PostScreen openWindow={setWindowCtx} />;
      case "barriers": return <BarrierScreen openWindow={setWindowCtx} />;
      case "results": return <ResultsScreen openWindow={setWindowCtx} />;
      case "uncert": return <UncertScreen openWindow={setWindowCtx} />;
      case "sens": return <SensScreen openWindow={setWindowCtx} />;
      case "handoff": return <HandoffScreen openWindow={setWindowCtx} />;
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
    <div className={`posw esq-workspace${isReviewer ? " posw--external posw--reviewer" : ""}${isApprover ? " posw--approver" : ""}`} data-screen-label={`ESQ · ${step.label}`}>
      {isReviewer && <div className="poshd__extbar" />}
      {isApprover && <div className="poshd__apprbar" />}
      <WorkspaceHeader persona={persona} setPersona={setPersona} workflowState={data.esq.workflowState} showPersonaPicker={showPersonaPicker} availablePersonas={availablePersonas} onOpenRoles={onOpenRoles} onLoadExample={onLoadExample} onUnloadExample={onUnloadExample} headerMeta={headerMeta} onToggleRail={() => setRailMobileOpen((v) => !v)} onToggleDock={() => { setDockOpen(true); setDockMobileOpen((v) => !v); }} />

      <div className={`posw__shell${railOpen ? "" : " posw__shell--rail-closed"}${dockOpen ? "" : " posw__shell--dock-closed"}`}>
        {(railOpen || railMobileOpen) && <StepRail stepId={stepId} setStepId={(id) => { setStepId(id); setRailMobileOpen(false); }} persona={persona} visibleSteps={visibleSteps} mobileOpen={railMobileOpen} onClose={() => { if (railMobileOpen) setRailMobileOpen(false); else setRailOpen(false); }} />}

        <main className="posmain" aria-label="Step content">
          <div className="posmain__head">
            <div className="posmain__title-block">
              <div className="posmain__eyebrow">{h.area.length > 0 ? `Step ${step.num} · ${h.area}` : ""}</div>
              <WorkbookSectionHeading workbook="ESQ" title={h.title} level={1} className="posmain__title" />
            </div>
            <div className="posmain__actions">
              {!railOpen && <button type="button" className="posnav__btn posnav__btn--sm esq-show-steps" onClick={() => setRailOpen(true)}><ESQIcon.Layers /> Show steps</button>}
              {!dockOpen && (
                <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => { setDockOpen(true); setDockMobileOpen(window.matchMedia("(max-width: 1100px)").matches); }}><ESQIcon.Eye /> Show conformance</button>
              )}
            </div>
          </div>

          {renderScreen()}
          {["logic", "barriers", "solve", "post", "results", "uncert", "sens"].includes(stepId) && <EsqAnalysisHistory />}

          <div className="posnav">
            {prev ? (
              <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => setStepId(prev.id)}>
                <ESQIcon.ArrowL /> {prev.label}
              </button>
            ) : <span />}
            {next ? (
              <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={() => setStepId(next.id)}>Next: {next.label} <ESQIcon.ArrowR /></button>
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

      {windowCtx !== null && <EsqModal context={windowCtx} onClose={() => setWindowCtx(null)} onRetarget={setWindowCtx} />}
      {toast !== null && <div className="postoast esq-toast" role="status">{toast}</div>}

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

export { EsqWorkbench, type HeaderMeta, type EsqWorkbenchActions };

function EsqAnalysisHistory() {
  const {runtime} = useEsqWorkbook();
  return <AnalysisRunHistory host="esq" workbookId={runtime.workbookId}/>;
}
