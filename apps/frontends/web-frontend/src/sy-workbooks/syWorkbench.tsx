import { AnalysisRunHistory } from "../newly-developed-methods/shared/analysisRunHistory";
import { ANALYSIS_RUN_CHANGED, type AnalysisRunChanged } from "../newly-developed-methods/shared/analysisRunEvents";
import { AnalysisRunDetailsSchema, AnalysisRunProvenanceListSchema } from "interfaces-shared-types/newly-developed-methods/shared";
import { fetchJson } from "../api/client";
import { WorkbookSectionHeading } from "../workbooks/workbookSectionHeading";
import { JSX, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { SYIcon } from "./syIcons";
import {
  SY_PERSONAS,
  CAPABILITY_CATEGORIES,
  type SyPersona,
  type SyStep,
  type Stage,
} from "./syViewData";
import { ccScore, commentsView, filterConformance, groupBySection, stepsFromMef, type CommentView } from "./sySelectors";
import { FailuresScreen, CcfScreen, type SyDrawerContext } from "./syScreens";
import { ScopeScreen } from "./SyScope";
import { ModelsScreen } from "./SySystemModels";
import { DepsScreen, IntegrityScreen, UncertScreen, DraftScreen, DrawerContent, PlaceholderScreen } from "./syScreens2";
import { InternalReviewScreen, ReviewerCommentDock } from "./syReview";
import { useSyWorkbook, type SyWorkbookData } from "./syWorkbookContext";
import { useAuth } from "../auth/AuthContext";
import { WorkbookDemoSignCard } from "../workbooks/workbookDemoSignCard";
import { DockDependsChip } from "../workbooks/workbookInterfaces";
import { WorkbookSaveIndicator } from "../workbooks/workbookSaveIndicator";
import { type RevisionedSaveStatus } from "../workbooks/useRevisionedMefPatch";
import { SyBayesianNetworkWorkspace } from "./syBayesianNetworkWorkspace";
import "../workbooks/css/workbookWorkspace.css";
import "../welcome/css/newProjectModal.css";
import "./css/syScreens.css";
import "./css/syWorkspace.css";

interface StepHeader {
  eyebrow: string;
  title: string;
}

function headersFor(stepId: string): StepHeader {
  switch (stepId) {
    case "scope": return { eyebrow: "Step 01 · SY-A", title: "Scope" };
    case "models": return { eyebrow: "Step 02 · SY-A", title: "System Models" };
    case "failures": return { eyebrow: "Step 03 · SY-A", title: "Failure Modes" };
    case "ccf": return { eyebrow: "Step 04 · SY-B", title: "Common Cause" };
    case "deps": return { eyebrow: "Step 05 · SY-B", title: "Dependencies" };
    case "integrity": return { eyebrow: "Step 06 · SY-A", title: "Model Integrity" };
    case "uncert": return { eyebrow: "Step 07 · SY-A · SY-B", title: "Uncertainty analysis" };
    case "draft": return { eyebrow: "Step 08 · Draft", title: "Produce the draft" };
    case "review": return { eyebrow: "Step 09 · Review", title: "Internal technical review" };
    case "approval": return { eyebrow: "Step 10 · Approval", title: "Approval & sign-off" };
    default: return { eyebrow: "", title: "" };
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
  persona: SyPersona;
  setPersona: (p: SyPersona) => void;
  workflowState: string;
  showPersonaPicker: boolean;
  availablePersonas: SyPersona[];
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
        <button type="button" className="posw__mobile-toggle" onClick={onToggleRail} aria-label="Open steps"><SYIcon.Layers /> Steps</button>
      )}
      <div className="poshd__crumb">
        <button type="button" onClick={() => navigate(-1)}><SYIcon.ArrowL /></button>
        <button type="button" onClick={() => navigate(-1)}>{headerMeta.projectName}</button>
        <SYIcon.Chevron />
        <span>Systems Analysis</span>
        <SYIcon.Chevron />
        <span className="poshd__crumb-current">{headerMeta.workbookName}</span>
        {personaPill !== null ? (
          <span className={`poshd__wfstate ${personaPill.cls}`} title={SY_PERSONAS[persona].blurb}>
            <SYIcon.Lock />{personaPill.text}
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
            <select className="poshd__perspective-select" value={persona} onChange={(e) => setPersona(e.target.value as SyPersona)}>
              {availablePersonas.includes("preparer") && <option value="preparer">Preparer</option>}
              {availablePersonas.includes("reviewer") && <option value="reviewer">Reviewer</option>}
              {availablePersonas.includes("approver") && <option value="approver">Approver</option>}
            </select>
          </label>
        )}
        {onOpenRoles !== undefined && (
          <button type="button" className="posnav__btn posnav__btn--sm" onClick={onOpenRoles} title="Manage roles"><SYIcon.Settings /> Roles</button>
        )}
        {onLoadExample !== undefined && (
          <button type="button" className="posnav__btn posnav__btn--sm" onClick={onLoadExample} title="Replace contents with the Generic-1 example workbook"><SYIcon.Sparkle /> Load example</button>
        )}
        {onUnloadExample !== undefined && (
          <button type="button" className="posnav__btn posnav__btn--sm" onClick={onUnloadExample} title="Restore the contents that existed before the example was loaded"><SYIcon.Close /> Unload example</button>
        )}
        <WorkbookSaveIndicator status={headerMeta.saveStatus} workbookVersion={headerMeta.workbookVersion} />
        <button type="button" className="posnav__btn" aria-label="History"><SYIcon.History /></button>
        {onToggleDock !== undefined && (
          <button type="button" className="posw__mobile-toggle" onClick={onToggleDock} aria-label="Open conformance"><SYIcon.Eye /> Conformance</button>
        )}
      </div>
    </header>
  );
}

function StepRail({ stepId, setStepId, persona, visibleSteps, mobileOpen, onClose }: {
  stepId: string;
  setStepId: (id: string) => void;
  persona: SyPersona;
  visibleSteps: SyStep[];
  mobileOpen: boolean;
  onClose: () => void;
}): JSX.Element {
  const idx = Math.max(0, visibleSteps.findIndex((s) => s.id === stepId));
  const pct = ((idx + 1) / visibleSteps.length) * 100;
  const eyebrow = persona === "reviewer" ? "Reviewer view" : persona === "approver" ? "Approver view" : "Workspace progress";
  return (
    <aside className={`posw__rail${mobileOpen ? " posw__rail--mobile-open" : ""}`} aria-label="SY analysis steps">
      <div className="posrail__head">
        <div className="posrail__head-top">
          <span className="posrail__eyebrow">{eyebrow}</span>
          <button type="button" className="posdock__close" onClick={onClose} aria-label="Hide steps" title="Hide steps"><SYIcon.Close /></button>
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
              <button type="button" className={`posrail__step${active ? " posrail__step--active" : ""}${complete ? " posrail__step--complete" : ""}${idle ? " posrail__step--idle" : ""}`} onClick={() => setStepId(s.id)}>
                <span className="posrail__step-num">{complete ? <SYIcon.Check /> : s.num}</span>
                <span>
                  <span className="posrail__step-label">
                    {s.label}
                    {s.badges.map((badge) => <span key={badge} className="syse">{badge}</span>)}
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
  const { sy } = useSyWorkbook();
  const cc = CAPABILITY_CATEGORIES.find((c) => c.id === ccId) ?? CAPABILITY_CATEGORIES[0];
  const items = useMemo(() => filterConformance(sy, ccId, stage), [sy, ccId, stage]);
  const sections = useMemo(() => groupBySection(items), [items]);
  const scores = ccScore(sy, ccId, stage);
  const dashTotal = 99.9;
  const dash = (scores.percent * dashTotal) / 100;
  return (
    <aside className={`posw__dock${mobileOpen ? " posw__dock--mobile-open" : ""}`} aria-label="Conformance checklist">
      <div className="posdock__head">
        <div className="posdock__title-row">
          <h2 className="posdock__title">Conformance</h2>
          <button type="button" className="posdock__close" onClick={onClose} aria-label="Hide checklist"><SYIcon.Close /></button>
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
                  <DockDependsChip element="SY" sr={it.id} />
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </aside>
  );
}

const DIALOG_LABELS: Record<SyDrawerContext["kind"], string> = {
  system: "System details",
  sysdef: "System definition",
  variant: "Success criterion by operating state",
  alignment: "Alignment details",
  boundary: "Model boundary",
  states: "Operating states",
  operations: "Operation and maintenance",
  ccf: "Common cause group details",
  hfe: "Human failure event details",
  screening: "Screening details",
  exclusion: "Exclusion details",
  unavail: "Simultaneous unavailability details",
  ssc: "Support success criterion details",
  spc: "Spatial coupling details",
  inv: "Depletable inventory details",
  dic: "Digital I&C details",
  loop: "Logic loop details",
  confirm: "Confirmation record details",
  oc: "Capacity limit details",
  unc: "Model uncertainty details",
  assum: "Pre-operational assumption details",
  sens: "Sensitivity study details",
  be: "Basic event details",
  house: "House event details",
  diagram: "Diagram",
};

function SyDrawer({ context, onClose }: { context: SyDrawerContext; onClose: () => void }): JSX.Element {
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const trigger = document.activeElement;
    dialog.current?.focus();
    return () => { if (trigger instanceof HTMLElement) trigger.focus(); };
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
        className={`modal sy-details-modal${context.kind === "diagram" ? " sy-details-modal--wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={DIALOG_LABELS[context.kind]}
        tabIndex={-1}
        onKeyDown={(e) => {
          if (e.key !== "Tab") return;
          const controls = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled):not([type="hidden"]), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]'))
            .filter((element) => element.getClientRects().length > 0);
          const first = controls[0];
          const last = controls[controls.length - 1];
          if (first === undefined || last === undefined) { e.preventDefault(); return; }
          if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { e.preventDefault(); last.focus(); }
          else if (!e.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) { e.preventDefault(); first.focus(); }
        }}
      >
        <DrawerContent context={context} onClose={onClose} />
      </div>
    </div>
  );
}

interface SyWorkbenchActions {
  postComment: (text: string, severity: "MAJOR" | "MINOR" | "OBSERVATION", stepId: string) => Promise<void>;
  toggleResolve: (commentId: string, nextResolved: boolean) => Promise<void>;
  submitForReview: () => Promise<void>;
  requestRevision: (note: string) => Promise<void>;
}

const DEFAULT_PERSONAS: SyPersona[] = ["preparer", "reviewer", "approver"];

function SyWorkbench({
  data, persona, setPersona, showPersonaPicker, availablePersonas = DEFAULT_PERSONAS, onOpenRoles, onLoadExample, onUnloadExample, onStageChange, actions, headerMeta, renderApprovalTable, renderSignCard, renderRoster, renderDocuments,
}: {
  data: SyWorkbookData;
  persona: SyPersona;
  setPersona: (p: SyPersona) => void;
  showPersonaPicker: boolean;
  availablePersonas?: SyPersona[];
  onOpenRoles?: () => void;
  onLoadExample?: () => void;
  onUnloadExample?: () => void;
  onStageChange?: (s: Stage) => void;
  actions?: SyWorkbenchActions;
  headerMeta: HeaderMeta;
  renderApprovalTable?: () => JSX.Element | null;
  renderSignCard?: () => JSX.Element | null;
  renderRoster?: () => JSX.Element | null;
  renderDocuments?: () => JSX.Element | null;
}): JSX.Element {
  const { editable, mutateSy, runtime } = useSyWorkbook();
  const isReviewer = persona === "reviewer";
  const isApprover = persona === "approver";

  const [currentUncertaintyModelIds, setCurrentUncertaintyModelIds] = useState<ReadonlySet<string>>(() => new Set());
  useEffect(() => {
    const workbookId = runtime.workbookId;
    const revision = runtime.revision;
    if (workbookId === null || revision === null) { setCurrentUncertaintyModelIds(new Set()); return; }
    let cancelled = false;
    async function refresh(): Promise<void> {
      try {
        const base = `/api/sy-workbooks/${encodeURIComponent(workbookId!)}/analysis-runs`;
        const found = new Set<string>();
        let cursor: string | undefined;
        for (let page = 0; page < 10; page++) {
          const list = AnalysisRunProvenanceListSchema.parse(await fetchJson<unknown>(base + (cursor === undefined ? "" : `?cursor=${encodeURIComponent(cursor)}`)));
          const candidates = list.runs.filter(({ run }) => run.methodType === "FAULT_TREE" && run.status === "SUCCEEDED"
            && run.owner.workbookRevision === revision && run.freshness?.status === "CURRENT" && !found.has(run.owner.modelId));
          for (const candidate of candidates) {
            const details = AnalysisRunDetailsSchema.parse(await fetchJson<unknown>(`${base}/${candidate.run.id}/details`));
            if (details.request["calculationType"] === "UNCERTAINTY" && details.request["uncertaintyInputSource"] === "DA") found.add(candidate.run.owner.modelId);
          }
          if (list.nextCursor === undefined || list.nextCursor === null) break;
          cursor = list.nextCursor;
        }
        if (!cancelled) setCurrentUncertaintyModelIds(found);
      } catch { if (!cancelled) setCurrentUncertaintyModelIds(new Set()); }
    }
    void refresh();
    const changed = (event: Event): void => {
      const detail = (event as CustomEvent<AnalysisRunChanged>).detail;
      if (detail.host === "sy" && detail.workbookId === workbookId) void refresh();
    };
    window.addEventListener(ANALYSIS_RUN_CHANGED, changed);
    return () => { cancelled = true; window.removeEventListener(ANALYSIS_RUN_CHANGED, changed); };
  }, [runtime.workbookId, runtime.revision]);
  const visibleSteps = useMemo(() => stepsFromMef(data.sy, persona,
    runtime.saveStatus === "saved" ? currentUncertaintyModelIds : new Set()),
  [data.sy, persona, currentUncertaintyModelIds, runtime.saveStatus]);
  const [searchParams] = useSearchParams();
  const requestedStepId = searchParams.get("step");
  const requestedNetworkId = searchParams.get("network");
  const requestedEsqWorkbookId = searchParams.get("esqWorkbook");
  const mefCcId = data.sy.capabilityCategory === "CC-I" ? "cc-i" : "cc-ii";
  const mefStage: Stage = data.sy.plantStage === "OPERATIONAL" ? "operational" : "pre_operational";
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
  const [sysId, setSysId] = useState<string>(data.sy.systemDefinitions[0]?.uuid ?? "SYS-DRACS");
  const isNarrow = typeof window !== "undefined" && window.matchMedia("(max-width: 1100px)").matches;
  const [dockOpen, setDockOpen] = useState(!isNarrow);
  const [railOpen, setRailOpen] = useState(true);
  const [railMobileOpen, setRailMobileOpen] = useState(false);
  const [dockMobileOpen, setDockMobileOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<SyDrawerContext | null>(null);
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
  const [comments, setComments] = useState<CommentView[]>(() => commentsView(data.sy));
  const [commentDockOpen, setCommentDockOpen] = useState(false);
  const [demoSubmittedLocal, setDemoSubmittedLocal] = useState(false);
  const [demoApprovedLocal, setDemoApprovedLocal] = useState(false);
  const [demoPreparerPhase, setDemoPreparerPhase] = useState(false);
  useEffect(() => { setComments(commentsView(data.sy)); }, [data.sy]);

  const workflowState = data.sy.workflowState;
  const submitted = actions === undefined ? demoSubmittedLocal : (workflowState === "INTERNAL_APPROVAL" || workflowState === "FINAL");
  const approved = actions === undefined ? demoApprovedLocal : workflowState === "FINAL";
  const cc = CAPABILITY_CATEGORIES.find((c) => c.id === ccId) ?? CAPABILITY_CATEGORIES[0];
  const scores = ccScore(data.sy, ccId, stage);
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
            <ScopeScreen ccId={ccId} setCcId={setCcId} onAction={flash} stage={stage} setStage={setStage} openDrawer={setDrawer} />
            {renderDocuments?.()}
          </>
        );
      case "models": return <ModelsScreen sysId={sysId} setSysId={setSysId} openDrawer={setDrawer} onOpenScope={() => setStepId("scope")} />;
      case "failures": return <FailuresScreen openDrawer={setDrawer} />;
      case "ccf": return <CcfScreen openDrawer={setDrawer} />;
      case "deps": return <><SyBayesianNetworkWorkspace initialModelId={requestedNetworkId} initialEsqWorkbookId={requestedEsqWorkbookId} /><DepsScreen openDrawer={setDrawer} /></>;
      case "integrity": return <IntegrityScreen stage={stage} openDrawer={setDrawer} />;
      case "uncert": return <UncertScreen openDrawer={setDrawer} />;
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
    <div className={`posw sy-workspace${isReviewer ? " posw--external posw--reviewer" : ""}${isApprover ? " posw--approver" : ""}`} data-screen-label={`SY — ${step.label}`}>
      {isReviewer && <div className="poshd__extbar" />}
      {isApprover && <div className="poshd__apprbar" />}
      <WorkspaceHeader persona={persona} setPersona={setPersona} workflowState={data.sy.workflowState} showPersonaPicker={showPersonaPicker} availablePersonas={availablePersonas} onOpenRoles={onOpenRoles} onLoadExample={onLoadExample} onUnloadExample={onUnloadExample} headerMeta={headerMeta} onToggleRail={() => setRailMobileOpen((v) => !v)} onToggleDock={() => { setDockOpen(true); setDockMobileOpen((v) => !v); }} />

      <div className={`posw__shell${railOpen ? "" : " posw__shell--rail-closed"}${dockOpen ? "" : " posw__shell--dock-closed"}`}>
        {(railOpen || railMobileOpen) && (
          <StepRail
            stepId={stepId}
            setStepId={(id) => { setStepId(id); setRailMobileOpen(false); }}
            persona={persona}
            visibleSteps={visibleSteps}
            mobileOpen={railMobileOpen}
            onClose={() => { if (railMobileOpen) setRailMobileOpen(false); else setRailOpen(false); }}
          />
        )}

        <main className="posmain" aria-label="Step content">
          <div className="posmain__head">
            <div className="posmain__title-block">
              <div className="posmain__eyebrow">{h.eyebrow}</div>
              <WorkbookSectionHeading workbook="SY" title={h.title} level={1} className="posmain__title" />
            </div>
            <div className="posmain__actions">
              {!railOpen && <button type="button" className="posnav__btn posnav__btn--sm sy-show-steps" onClick={() => setRailOpen(true)}><SYIcon.Layers /> Show steps</button>}
              {!dockOpen && (
                <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => { setDockOpen(true); setDockMobileOpen(window.matchMedia("(max-width: 1100px)").matches); }}><SYIcon.Eye /> Show conformance</button>
              )}
            </div>
          </div>

          {renderScreen()}
          {["ccf", "deps"].includes(stepId) && <SyAnalysisHistory />}

          <div className="posnav">
            {prev ? (
              <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => setStepId(prev.id)}>
                <SYIcon.ArrowL /> {prev.label}
              </button>
            ) : <span />}
            {next ? (
              <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={() => setStepId(next.id)}>Next: {next.label} <SYIcon.ArrowR /></button>
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

      {drawer !== null && <SyDrawer context={drawer} onClose={() => setDrawer(null)} />}
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

export { SyWorkbench, type HeaderMeta, type SyWorkbenchActions };

function SyAnalysisHistory() {
  const {runtime} = useSyWorkbook();
  return <AnalysisRunHistory host="sy" workbookId={runtime.workbookId}/>;
}
