import { JSX, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { IEIcon } from "./ieIcons";
import {
  IE_PERSONAS,
  CAPABILITY_CATEGORIES,
  type IePersona,
  type IeStep,
  type Stage,
} from "./ieViewData";
import {
  ccScore,
  commentsView,
  filterConformance,
  groupBySection,
  stepsFromMef,
  type CommentView,
} from "./ieSelectors";
import { DockDependsChip } from "../workbooks/workbookInterfaces";
import {
  ScopeScreen,
  MethodsScreen,
  IdentifyScreen,
  CompletenessScreen,
  HazardsScreen,
  GroupingScreen,
  ScreeningScreen,
  FrequencyScreen,
  DraftScreen,
} from "./ieScreens";
import { InternalReviewScreen, ReviewerCommentDock } from "./ieReview";
import { useIeWorkbook, type IeWorkbookData } from "./ieWorkbookContext";
import { IeDrawer } from "./ieDrawer";
import { useAuth } from "../auth/AuthContext";
import { WorkbookDemoSignCard } from "../workbooks/workbookDemoSignCard";
import "../workbooks/css/workbookWorkspace.css";
import "./css/ieScreens.css";

interface StepHeader {
  eyebrow: string;
  title: string;
  sub?: string;
}

function headersFor(stepId: string): StepHeader {
  switch (stepId) {
    case "scope": return { eyebrow: "Step 01", title: "Scope", sub: "What is in scope, which radioactive sources could be released, and which barriers protect them." };
    case "methods": return { eyebrow: "Step 02", title: "Search methods", sub: "Register the structured, systematic techniques used to find every initiating event (IE-A1)." };
    case "identify": return { eyebrow: "Step 03", title: "Identify initiators", sub: "Identify every challenge category, for every operating state and source (IE-A5)." };
    case "completeness": return { eyebrow: "Step 04", title: "Completeness search", sub: "Per-system and support-system sweeps, source mechanisms, and similar-plant experience." };
    case "hazards": return { eyebrow: "Step 05", title: "Hazard-induced initiators", sub: "Initiators caused by individual internal and external hazards (IE-A5 e/f) or by hazard combinations (IE-A6)." };
    case "grouping": return { eyebrow: "Step 06", title: "Grouping", sub: "Bundle events that share mitigation requirements under a bounding case, without masking any risk-significant sequence (IE-B4)." };
    case "screening": return { eyebrow: "Step 07", title: "Screening", sub: "Eliminate an event only if it does not breach a barrier AND meets an SCR test. The barrier-integrity gate is enforced first (IE-C9)." };
    case "frequency": return { eyebrow: "Step 08", title: "Frequency & quantification", sub: "Annual frequency per event or group, on a plant-calendar-year basis, weighted by the POS time fraction (IE-C8)." };
    case "draft": return { eyebrow: "Step 09 · Draft", title: "Produce the draft", sub: "Generate the IE report from everything entered. Submitting advances the workbook to internal technical review." };
    case "review": return { eyebrow: "Step 10 · Review", title: "Internal technical review", sub: "Reviewers and the approver leave comments and the preparer responds. The workbook advances to Approval once every comment is resolved." };
    case "approval": return { eyebrow: "Step 11 · Approval", title: "Approval & sign-off", sub: "Everyone on the workbook signs. The approver signs last, gated on all comments being resolved." };
    default: return { eyebrow: "", title: "" };
  }
}

interface HeaderMeta {
  projectName: string;
  workbookName: string;
  workbookVersion: string;
  plantIdentity?: { name: string; type: string; power: string; vendor: string };
}

function WorkspaceHeader({
  persona, setPersona, workflowState, showPersonaPicker, availablePersonas, onOpenRoles, onLoadExample, onUnloadExample, headerMeta, onToggleRail, onToggleDock, exampleOptions, selectedExample, onSelectExample,
}: {
  persona: IePersona;
  setPersona: (p: IePersona) => void;
  workflowState: string;
  showPersonaPicker: boolean;
  availablePersonas: IePersona[];
  onOpenRoles?: () => void;
  onLoadExample?: () => void;
  onUnloadExample?: () => void;
  headerMeta: HeaderMeta;
  onToggleRail?: () => void;
  onToggleDock?: () => void;
  exampleOptions?: { id: string; label: string }[];
  selectedExample?: string;
  onSelectExample?: (id: string) => void;
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
        <button type="button" className="posw__mobile-toggle" onClick={onToggleRail} aria-label="Open steps"><IEIcon.Layers /> Steps</button>
      )}
      <div className="poshd__crumb">
        <button type="button" onClick={() => navigate(-1)}><IEIcon.ArrowL /></button>
        <button type="button" onClick={() => navigate(-1)}>{headerMeta.projectName}</button>
        <IEIcon.Chevron />
        <span>Initiating Event Analysis</span>
        <IEIcon.Chevron />
        <span className="poshd__crumb-current">{headerMeta.workbookName}</span>
        {personaPill !== null ? (
          <span className={`poshd__wfstate ${personaPill.cls}`} title={IE_PERSONAS[persona].blurb}>
            <IEIcon.Lock />{personaPill.text}
          </span>
        ) : (
          <span className="poshd__wfstate poshd__wfstate--draft" title={workflowState}>
            <span className="poshd__wfstate-dot" />{workflowState}
          </span>
        )}
      </div>

      <div className="poshd__spacer" />

      {headerMeta.plantIdentity !== undefined && (
        <div className="poshd__identity">
          <div className="poshd__identity-title">{headerMeta.plantIdentity.name}</div>
          <div className="poshd__identity-meta">
            {headerMeta.plantIdentity.type} <span className="poshd__identity-sep">·</span> {headerMeta.plantIdentity.power} <span className="poshd__identity-sep">·</span> {headerMeta.plantIdentity.vendor}
          </div>
        </div>
      )}

      <div className="poshd__spacer" />

      <div className="poshd__actions">
        {exampleOptions !== undefined && exampleOptions.length > 1 && onSelectExample !== undefined && (
          <label className="poshd__perspective" title="Switch the worked example">
            <span className="poshd__perspective-label">Example</span>
            <select className="poshd__perspective-select" value={selectedExample} onChange={(e) => onSelectExample(e.target.value)}>
              {exampleOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>
          </label>
        )}
        {showPersonaPicker && availablePersonas.length > 1 && (
          <label className="poshd__perspective" title="Switch perspective">
            <span className="poshd__perspective-label">View as</span>
            <select className="poshd__perspective-select" value={persona} onChange={(e) => setPersona(e.target.value as IePersona)}>
              {availablePersonas.includes("preparer") && <option value="preparer">Preparer</option>}
              {availablePersonas.includes("reviewer") && <option value="reviewer">Reviewer</option>}
              {availablePersonas.includes("approver") && <option value="approver">Approver</option>}
            </select>
          </label>
        )}
        {onOpenRoles !== undefined && (
          <button type="button" className="posnav__btn posnav__btn--sm" onClick={onOpenRoles} title="Manage roles"><IEIcon.Settings /> Roles</button>
        )}
        {onLoadExample !== undefined && (
          <button type="button" className="posnav__btn posnav__btn--sm" onClick={onLoadExample} title="Replace contents with an example workbook"><IEIcon.Sparkle /> Load example</button>
        )}
        {onUnloadExample !== undefined && (
          <button type="button" className="posnav__btn posnav__btn--sm" onClick={onUnloadExample} title="Restore the workbook contents that existed before the example was loaded"><IEIcon.Close /> Unload example</button>
        )}
        <span className="poshd__save-pill"><span className="poshd__save-pill-dot" />Autosaved · v{headerMeta.workbookVersion}</span>
        <button type="button" className="posnav__btn" aria-label="History"><IEIcon.History /></button>
        {onToggleDock !== undefined && (
          <button type="button" className="posw__mobile-toggle" onClick={onToggleDock} aria-label="Open conformance"><IEIcon.Eye /> Conformance</button>
        )}
      </div>
    </header>
  );
}

function StepRail({ stepId, setStepId, persona, visibleSteps, mobileOpen }: {
  stepId: string;
  setStepId: (id: string) => void;
  persona: IePersona;
  visibleSteps: IeStep[];
  mobileOpen: boolean;
}): JSX.Element {
  const idx = Math.max(0, visibleSteps.findIndex((s) => s.id === stepId));
  const pct = ((idx + 1) / visibleSteps.length) * 100;
  const eyebrow = persona === "reviewer" ? "Reviewer view" : persona === "approver" ? "Approver view" : "Workspace progress";
  return (
    <aside className={`posw__rail${mobileOpen ? " posw__rail--mobile-open" : ""}`} aria-label="IE analysis steps">
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
                <span className="posrail__step-num">{complete ? <IEIcon.Check /> : s.num}</span>
                <span><span className="posrail__step-label">{s.label}</span></span>
                <span className="posrail__step-warn" style={{ background: "transparent" }} />
              </button>
            </li>
          );
        })}
      </ul>
      <div className="posrail__footer">
        <button type="button" className="posrail__footer-btn"><IEIcon.Layers /> Show all inputs</button>
        <button type="button" className="posrail__footer-btn"><IEIcon.Settings /> Workbook settings</button>
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
  const { ie } = useIeWorkbook();
  const cc = CAPABILITY_CATEGORIES.find((c) => c.id === ccId) ?? CAPABILITY_CATEGORIES[0];
  const items = useMemo(() => filterConformance(ie, ccId, stage), [ie, ccId, stage]);
  const sections = useMemo(() => groupBySection(items), [items]);
  const scores = ccScore(ie, ccId, stage);
  const dashTotal = 99.9;
  const dash = (scores.percent * dashTotal) / 100;
  return (
    <aside className={`posw__dock${mobileOpen ? " posw__dock--mobile-open" : ""}`} aria-label="Conformance checklist">
      <div className="posdock__head">
        <div className="posdock__title-row">
          <h2 className="posdock__title">Conformance</h2>
          <button type="button" className="posdock__close" onClick={onClose} aria-label="Hide checklist"><IEIcon.Close /></button>
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
                <span><span className="posdock__item-text">{it.text}</span><DockDependsChip element="IE" sr={it.id} /></span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </aside>
  );
}

interface IeWorkbenchActions {
  postComment: (text: string, severity: "MAJOR" | "MINOR" | "OBSERVATION", stepId: string) => Promise<void>;
  toggleResolve: (commentId: string, nextResolved: boolean) => Promise<void>;
  submitForReview: () => Promise<void>;
  requestRevision: (note: string) => Promise<void>;
}

const DEFAULT_PERSONAS: IePersona[] = ["preparer", "reviewer", "approver"];

function IeWorkbench({
  data, persona, setPersona, showPersonaPicker, availablePersonas = DEFAULT_PERSONAS, onOpenRoles, onLoadExample, onUnloadExample, onOpenPosLink, onStageChange, actions, headerMeta, renderApprovalTable, renderSignCard, renderRoster, exampleOptions, selectedExample, onSelectExample,
}: {
  data: IeWorkbookData;
  persona: IePersona;
  setPersona: (p: IePersona) => void;
  showPersonaPicker: boolean;
  availablePersonas?: IePersona[];
  onOpenRoles?: () => void;
  onLoadExample?: () => void;
  onUnloadExample?: () => void;
  onOpenPosLink?: () => void;
  onStageChange?: (s: Stage) => void;
  actions?: IeWorkbenchActions;
  headerMeta: HeaderMeta;
  renderApprovalTable?: () => JSX.Element | null;
  renderSignCard?: () => JSX.Element | null;
  renderRoster?: () => JSX.Element | null;
  exampleOptions?: { id: string; label: string }[];
  selectedExample?: string;
  onSelectExample?: (id: string) => void;
}): JSX.Element {
  const isReviewer = persona === "reviewer";
  const isApprover = persona === "approver";
  const isPreparer = persona === "preparer";

  const { drawer, openDrawer } = useIeWorkbook();
  const closeDrawer = useCallback(() => openDrawer(null), [openDrawer]);
  const visibleSteps = useMemo(() => stepsFromMef(data.ie, persona), [data.ie, persona]);
  const mefCcId = data.ie.capabilityCategory === "CC-I" ? "cc-i" : "cc-ii";
  const mefStage: Stage = data.ie.plantStage === "OPERATIONAL" ? "operational" : "pre_operational";
  const [ccId, setCcId] = useState<string>(mefCcId);
  const [stage, setStageState] = useState<Stage>(mefStage);
  useEffect(() => { setCcId(mefCcId); }, [mefCcId]);
  useEffect(() => { setStageState(mefStage); }, [mefStage]);

  function setStage(s: Stage): void {
    setStageState(s);
    onStageChange?.(s);
  }

  const [stepId, setStepIdState] = useState<string>(visibleSteps[0]?.id ?? "scope");
  const isNarrow = typeof window !== "undefined" && window.matchMedia("(max-width: 1100px)").matches;
  const [dockOpen, setDockOpen] = useState(!isNarrow);
  const [railMobileOpen, setRailMobileOpen] = useState(false);
  const [dockMobileOpen, setDockMobileOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);

  const { user: authUser } = useAuth();
  const actingUsername = authUser?.username ?? "";
  const [comments, setComments] = useState<CommentView[]>(() => commentsView(data.ie));
  const [commentDockOpen, setCommentDockOpen] = useState(false);
  const [demoSubmittedLocal, setDemoSubmittedLocal] = useState(false);
  const [demoApprovedLocal, setDemoApprovedLocal] = useState(false);
  const [demoPreparerPhase, setDemoPreparerPhase] = useState(false);

  useEffect(() => { setComments(commentsView(data.ie)); }, [data.ie]);

  const workflowState = data.ie.workflowState;
  const submitted = actions === undefined ? demoSubmittedLocal : (workflowState === "INTERNAL_APPROVAL" || workflowState === "FINAL");
  const approved = actions === undefined ? demoApprovedLocal : workflowState === "FINAL";

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
  const cc = CAPABILITY_CATEGORIES.find((c) => c.id === ccId) ?? CAPABILITY_CATEGORIES[0];
  const scores = ccScore(data.ie, ccId, stage);
  const h = headersFor(stepId);

  const openCount = comments.filter((c) => !c.resolved).length;
  const resolvedCount = comments.filter((c) => c.resolved).length;
  const screenProps = { ccId, setCcId, onAction: flash };

  function renderScreen(): JSX.Element | null {
    switch (stepId) {
      case "scope": return <ScopeScreen {...screenProps} stage={stage} setStage={setStage} onOpenLink={() => onOpenPosLink?.()} />;
      case "methods": return <MethodsScreen />;
      case "identify": return <IdentifyScreen />;
      case "completeness": return <CompletenessScreen />;
      case "hazards": return <HazardsScreen />;
      case "grouping": return <GroupingScreen />;
      case "screening": return <ScreeningScreen />;
      case "frequency": return <FrequencyScreen />;
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
      default: return null;
    }
  }

  return (
    <div className={`posw${isReviewer ? " posw--external posw--reviewer" : ""}${isApprover ? " posw--approver" : ""}`} data-screen-label={`IE — ${step.label}`}>
      {drawer !== null && <IeDrawer context={drawer} onClose={closeDrawer} />}
      {isReviewer && <div className="poshd__extbar" />}
      {isApprover && <div className="poshd__apprbar" />}
      <WorkspaceHeader persona={persona} setPersona={setPersona} workflowState={workflowState} showPersonaPicker={showPersonaPicker} availablePersonas={availablePersonas} onOpenRoles={onOpenRoles} onLoadExample={onLoadExample} onUnloadExample={onUnloadExample} headerMeta={headerMeta} onToggleRail={() => setRailMobileOpen((v) => !v)} onToggleDock={() => { setDockOpen(true); setDockMobileOpen((v) => !v); }} exampleOptions={exampleOptions} selectedExample={selectedExample} onSelectExample={onSelectExample} />

      <div className={`posw__shell${dockOpen ? "" : " posw__shell--dock-closed"}`}>
        <StepRail stepId={stepId} setStepId={(id) => { setStepId(id); setRailMobileOpen(false); }} persona={persona} visibleSteps={visibleSteps} mobileOpen={railMobileOpen} />

        <main className="posmain" aria-label="Step content">
          <div className="posmain__head">
            <div className="posmain__title-block">
              <div className="posmain__eyebrow">{h.eyebrow}</div>
              <h1 className="posmain__title">{h.title}</h1>
              {h.sub !== undefined && <p className="posmain__sub">{h.sub}</p>}
            </div>
            <div className="posmain__actions">
              {!dockOpen && (
                <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => { setDockOpen(true); setDockMobileOpen(true); }}><IEIcon.Eye /> Show conformance</button>
              )}
              {isPreparer && stepId !== "draft" && stepId !== "review" && (
                <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => setStepId("draft")}>Preview draft <IEIcon.Eye /></button>
              )}
            </div>
          </div>

          {renderScreen()}

          <div className="posnav">
            {prev ? (
              <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => setStepId(prev.id)}>
                <IEIcon.ArrowL /> {prev.label}
              </button>
            ) : <span />}
            {next ? (
              <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={() => setStepId(next.id)}>Next: {next.label} <IEIcon.ArrowR /></button>
            ) : isPreparer && approved ? (
              <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={() => flash("Released to external workflows")}><IEIcon.Send /> Released to external workflows</button>
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

export { IeWorkbench, type IeWorkbenchActions, type HeaderMeta };
