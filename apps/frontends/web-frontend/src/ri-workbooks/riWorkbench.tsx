import { WorkbookSectionHeading } from "../workbooks/workbookSectionHeading";
import { JSX, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { RIIcon } from "./riIcons";
import {
  RI_PERSONAS,
  CAPABILITY_CATEGORIES,
  type AppTypeId,
  type RiPersona,
  type RiStep,
} from "./riViewData";
import { ccScore, commentsView, filterConformance, groupBySection, appTypeFromMef, stepsFromMef, type CommentView } from "./riSelectors";
import { ApplicationScreen, CategoriesScreen, ContributorsScreen, FcScreen, HandoffsScreen, InputsScreen, IntegratedRiskScreen, UncertaintyStepScreen, type RiDrawerContext } from "./riScreens";
import { DraftScreen, DrawerContent, PlaceholderScreen } from "./riScreens2";
import { InternalReviewScreen, ReviewerCommentDock } from "./riReview";
import { useRiWorkbook, type RiWorkbookData } from "./riWorkbookContext";
import { useAuth } from "../auth/AuthContext";
import { WorkbookDemoSignCard } from "../workbooks/workbookDemoSignCard";
import { DockDependsChip } from "../workbooks/workbookInterfaces";
import "../workbooks/css/workbookWorkspace.css";
import "../welcome/css/newProjectModal.css";
import "./css/riScreens.css";

interface StepHeader {
  area: string;
  title: string;
  sub?: string;
}

function headersFor(stepId: string): StepHeader {
  switch (stepId) {
    case "application": return { area: "HLR-RI-A", title: "Application", sub: "The decision, the criteria set, the measures and the scope." };
    case "inputs": return { area: "HLR-RI-B", title: "Inputs", sub: "The families, sequences and consequences imported from ES, ESQ and RC." };
    case "categories": return { area: "HLR-RI-B", title: "Event Categories", sub: "Each family's AOO, DBE or BDBE category from the Step 01 criteria." };
    case "fc": return { area: "HLR-RI-B", title: "Frequency-Consequence", sub: "Each licensing basis event against the F-C target, with its risk significance and margins." };
    case "integrate": return { area: "HLR-RI-B", title: "Integrated Risk", sub: "The plant's total risk against each cumulative target, where it comes from, and how often each dose is exceeded." };
    case "aggregate": return { area: "HLR-RI-B", title: "Contributors and SSCs", sub: "What drives each total, grouped by SSC, with ESQ's importance measures." };
    case "uncertainty": return { area: "HLR-RI-C", title: "Uncertainty", sub: "The key uncertainties and screened items of every element, the grouping review, the propagated totals and the sensitivity studies." };
    case "feedback": return { area: "HLR-RI-D", title: "Hand-offs", sub: "What RI sends back to ESQ, MS, RC and the elements behind them, and what each has recorded." };
    case "draft": return { area: "Draft", title: "Produce the draft", sub: "Build the RI report, then send it to review." };
    case "review": return { area: "Review", title: "Internal technical review", sub: "Reviewers comment, the preparer replies, all resolve before approval." };
    case "approval": return { area: "Approval", title: "Approval & sign-off", sub: "Everyone signs, the approver last." };
    default: return { area: "", title: "" };
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
  persona: RiPersona;
  setPersona: (p: RiPersona) => void;
  workflowState: string;
  showPersonaPicker: boolean;
  availablePersonas: RiPersona[];
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
        <button type="button" className="posw__mobile-toggle" onClick={onToggleRail} aria-label="Open steps"><RIIcon.Layers /> Steps</button>
      )}
      <div className="poshd__crumb">
        <button type="button" onClick={() => navigate(-1)}><RIIcon.ArrowL /></button>
        <button type="button" onClick={() => navigate(-1)}>{headerMeta.projectName}</button>
        <RIIcon.Chevron />
        <span>Risk Integration</span>
        <RIIcon.Chevron />
        <span className="poshd__crumb-current">{headerMeta.workbookName}</span>
        {personaPill !== null ? (
          <span className={`poshd__wfstate ${personaPill.cls}`} title={RI_PERSONAS[persona].blurb}>
            <RIIcon.Lock />{personaPill.text}
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
            <select className="poshd__perspective-select" value={persona} onChange={(e) => setPersona(e.target.value as RiPersona)}>
              {availablePersonas.includes("preparer") && <option value="preparer">Preparer</option>}
              {availablePersonas.includes("reviewer") && <option value="reviewer">Reviewer</option>}
              {availablePersonas.includes("approver") && <option value="approver">Approver</option>}
            </select>
          </label>
        )}
        {onOpenRoles !== undefined && (
          <button type="button" className="posnav__btn posnav__btn--sm" onClick={onOpenRoles} title="Manage roles"><RIIcon.Settings /> Roles</button>
        )}
        {onLoadExample !== undefined && (
          <button type="button" className="posnav__btn posnav__btn--sm" onClick={onLoadExample} title="Replace contents with a packaged example workbook"><RIIcon.Sparkle /> Load example</button>
        )}
        {onUnloadExample !== undefined && (
          <button type="button" className="posnav__btn posnav__btn--sm" onClick={onUnloadExample} title="Restore the contents that existed before the example was loaded"><RIIcon.Close /> Unload example</button>
        )}
        <span className="poshd__save-pill"><span className="poshd__save-pill-dot" />Autosaved · v{headerMeta.workbookVersion}</span>
        <button type="button" className="posnav__btn" aria-label="History"><RIIcon.History /></button>
        {onToggleDock !== undefined && (
          <button type="button" className="posw__mobile-toggle" onClick={onToggleDock} aria-label="Open conformance"><RIIcon.Eye /> Conformance</button>
        )}
      </div>
    </header>
  );
}

function StepRail({ stepId, setStepId, persona, visibleSteps, mobileOpen, onClose }: {
  stepId: string;
  setStepId: (id: string) => void;
  persona: RiPersona;
  visibleSteps: RiStep[];
  mobileOpen: boolean;
  onClose: () => void;
}): JSX.Element {
  const idx = Math.max(0, visibleSteps.findIndex((s) => s.id === stepId));
  const pct = ((idx + 1) / visibleSteps.length) * 100;
  const eyebrow = persona === "reviewer" ? "Reviewer view" : persona === "approver" ? "Approver view" : "Workspace progress";
  return (
    <aside className={`posw__rail${mobileOpen ? " posw__rail--mobile-open" : ""}`} aria-label="RI analysis steps">
      <div className="posrail__head">
        <div className="posrail__head-top"><span className="posrail__eyebrow">{eyebrow}</span>
          <button type="button" className="posdock__close" onClick={onClose} aria-label="Hide steps" title="Hide steps"><RIIcon.Close /></button>
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
                <span className="posrail__step-num">{complete ? <RIIcon.Check /> : s.num}</span>
                <span>
                  <span className="posrail__step-label">
                    {s.label}
                    {s.hlr !== undefined && <span className={`rihlr rihlr--${s.hlrTone ?? "a"}`} style={{ marginLeft: 6 }}>{s.hlr}</span>}
                  </span>
                </span>
                <span className="posrail__step-warn" style={{ background: "transparent" }} />
              </button>
            </li>
          );
        })}
      </ul>
      <div className="posrail__footer">
        <button type="button" className="posrail__footer-btn"><RIIcon.Layers /> Show all inputs</button>
        <button type="button" className="posrail__footer-btn"><RIIcon.Settings /> Workbook settings</button>
      </div>
    </aside>
  );
}

const DRAWER_LABELS: Record<RiDrawerContext["kind"], string> = {
  family: "Event sequence family",
  measure: "Consequence measure",
  inputFamily: "Event sequence family",
  inputSequence: "Event sequence",
  inputConsequence: "Consequence result",
  inputContributor: "Contributor",
  inputImportance: "Importance measure",
  inputGap: "Measure without results",
  cliffEdge: "Cliff-edge check",
  aggregationNote: "Detail and conservatism",
  sscAssignment: "Contributor SSC",
  uncertaintySource: "Model uncertainty",
  screenedItem: "Screened item",
  uncertaintyAnalysis: "Uncertainty characterization",
  sensitivityStudy: "Sensitivity study",
  handoff: "Hand-off item",
  calc: "Calculation approach",
  metric: "Risk metric",
  aggregation: "Aggregation review",
  hazardgroup: "Hazard group",
  grouping: "Grouping adequacy",
  contributor: "Risk-significant contributor",
  contribbasis: "Contributor roll-up",
  musource: "Model-uncertainty source",
  screened: "Screened item",
  propagation: "Uncertainty propagation",
  sensitivity: "Sensitivity study",
  dispatch: "Feedback dispatch",
  method: "Integration method",
};

const FORM_MODAL_KINDS: RiDrawerContext["kind"][] = ["measure", "inputFamily", "inputSequence", "inputConsequence", "inputContributor", "inputImportance", "inputGap", "cliffEdge", "aggregationNote", "sscAssignment", "uncertaintySource", "screenedItem", "uncertaintyAnalysis", "sensitivityStudy", "handoff"];

function RiDrawer({ context, onClose, onRetarget }: { context: RiDrawerContext; onClose: () => void; onRetarget: (ctx: RiDrawerContext) => void }): JSX.Element {
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.current?.focus();
    return () => { trigger?.focus(); };
  }, []);
  useEffect(() => {
    function onKey(e: KeyboardEvent): void {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  return (
    <div className="modal__backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        ref={dialog}
        className={`modal ri-details-modal${FORM_MODAL_KINDS.includes(context.kind) ? " ri-form-modal" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={DRAWER_LABELS[context.kind]}
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
        <DrawerContent context={context} onClose={onClose} onRetarget={onRetarget} />
      </div>
    </div>
  );
}

function ConformanceDock({ ccId, appType, onGoToCriteria, onClose, mobileOpen }: {
  ccId: string;
  appType: AppTypeId;
  onGoToCriteria: () => void;
  onClose: () => void;
  mobileOpen: boolean;
}): JSX.Element {
  const { ri } = useRiWorkbook();
  const cc = CAPABILITY_CATEGORIES.find((c) => c.id === ccId) ?? CAPABILITY_CATEGORIES[0];
  const items = useMemo(() => filterConformance(ri, ccId, appType), [ri, ccId, appType]);
  const sections = useMemo(() => groupBySection(items), [items]);
  const scores = ccScore(ri, ccId, appType);
  const dashTotal = 99.9;
  const dash = (scores.percent * dashTotal) / 100;
  return (
    <aside className={`posw__dock${mobileOpen ? " posw__dock--mobile-open" : ""}`} aria-label="Conformance checklist">
      <div className="posdock__head">
        <div className="posdock__title-row">
          <h2 className="posdock__title">Conformance</h2>
          <button type="button" className="posdock__close" onClick={onClose} aria-label="Hide checklist"><RIIcon.Close /></button>
        </div>
        <div className="posdock__profile">
          <div className="posdock__profile-display">
            <span className="posdock__profile-name">{cc.name}</span>
            <span className="posdock__profile-tag">{cc.tag}</span>
            <button type="button" className="posdock__profile-change" onClick={onGoToCriteria}>Change</button>
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
                  <DockDependsChip element="RI" sr={it.id} />
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </aside>
  );
}

interface RiWorkbenchActions {
  postComment: (text: string, severity: "MAJOR" | "MINOR" | "OBSERVATION", stepId: string) => Promise<void>;
  toggleResolve: (commentId: string, nextResolved: boolean) => Promise<void>;
  submitForReview: () => Promise<void>;
  requestRevision: (note: string) => Promise<void>;
}

const DEFAULT_PERSONAS: RiPersona[] = ["preparer", "reviewer", "approver"];

function RiWorkbench({
  data, persona, setPersona, showPersonaPicker, availablePersonas = DEFAULT_PERSONAS, onOpenRoles, onLoadExample, onUnloadExample, actions, headerMeta, renderApprovalTable, renderSignCard, renderRoster, renderDocuments,
}: {
  data: RiWorkbookData;
  persona: RiPersona;
  setPersona: (p: RiPersona) => void;
  showPersonaPicker: boolean;
  availablePersonas?: RiPersona[];
  onOpenRoles?: () => void;
  onLoadExample?: () => void;
  onUnloadExample?: () => void;
  actions?: RiWorkbenchActions;
  headerMeta: HeaderMeta;
  renderApprovalTable?: () => JSX.Element | null;
  renderSignCard?: () => JSX.Element | null;
  renderRoster?: () => JSX.Element | null;
  renderDocuments?: () => JSX.Element | null;
}): JSX.Element {
  const isReviewer = persona === "reviewer";
  const isApprover = persona === "approver";

  const visibleSteps = useMemo(() => stepsFromMef(data.ri, persona), [data.ri, persona]);
  const mefCcId = data.ri.capabilityCategory === "CC-I" ? "cc-i" : "cc-ii";
  const mefAppType = appTypeFromMef(data.ri);
  const [ccId, setCcId] = useState<string>(mefCcId);
  const [appType, setAppType] = useState<AppTypeId>(mefAppType);
  useEffect(() => { setCcId(mefCcId); }, [mefCcId]);
  useEffect(() => { setAppType(mefAppType); }, [mefAppType]);

  const [drawer, setDrawer] = useState<RiDrawerContext | null>(null);
  const [stepId, setStepIdState] = useState<string>(visibleSteps[0]?.id ?? "application");
  const [dockOpen, setDockOpen] = useState(false);
  const [railOpen, setRailOpen] = useState(true);
  const [railMobileOpen, setRailMobileOpen] = useState(false);
  const [dockMobileOpen, setDockMobileOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);

  useEffect(() => {
    if (visibleSteps.find((s) => s.id === stepId) === undefined) {
      setStepIdState(visibleSteps[0]?.id ?? "application");
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
  const [comments, setComments] = useState<CommentView[]>(() => commentsView(data.ri));
  const [commentDockOpen, setCommentDockOpen] = useState(false);
  const [demoSubmittedLocal, setDemoSubmittedLocal] = useState(false);
  const [demoApprovedLocal, setDemoApprovedLocal] = useState(false);
  const [demoPreparerPhase, setDemoPreparerPhase] = useState(false);
  useEffect(() => { setComments(commentsView(data.ri)); }, [data.ri]);

  const workflowState = data.ri.workflowState;
  const submitted = actions === undefined ? demoSubmittedLocal : (workflowState === "INTERNAL_APPROVAL" || workflowState === "FINAL");
  const approved = actions === undefined ? demoApprovedLocal : workflowState === "FINAL";
  const cc = CAPABILITY_CATEGORIES.find((c) => c.id === ccId) ?? CAPABILITY_CATEGORIES[0];
  const scores = ccScore(data.ri, ccId, appType);
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
      case "application": return <ApplicationScreen appType={appType} setAppType={setAppType} openDrawer={setDrawer} documents={renderDocuments?.() ?? null} />;
      case "inputs": return <InputsScreen openDrawer={setDrawer} />;
      case "categories": return <CategoriesScreen openDrawer={setDrawer} />;
      case "fc": return <FcScreen openDrawer={setDrawer} />;
      case "integrate": return <IntegratedRiskScreen openDrawer={setDrawer} />;
      case "aggregate": return <ContributorsScreen openDrawer={setDrawer} />;
      case "uncertainty": return <UncertaintyStepScreen openDrawer={setDrawer} />;
      case "feedback": return <HandoffsScreen openDrawer={setDrawer} />;
      case "draft": return <DraftScreen cc={cc} scores={scores} onSubmitDraft={() => { handleSubmitToApproval(); setStepId("review"); }} canSubmit={isPreparer} />;
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
    <div className={`posw ri-workspace${isReviewer ? " posw--external posw--reviewer" : ""}${isApprover ? " posw--approver" : ""}`} data-screen-label={`RI — ${step.label}`}>
      {isReviewer && <div className="poshd__extbar" />}
      {isApprover && <div className="poshd__apprbar" />}
      <WorkspaceHeader persona={persona} setPersona={setPersona} workflowState={data.ri.workflowState} showPersonaPicker={showPersonaPicker} availablePersonas={availablePersonas} onOpenRoles={onOpenRoles} onLoadExample={onLoadExample} onUnloadExample={onUnloadExample} headerMeta={headerMeta} onToggleRail={() => setRailMobileOpen((v) => !v)} onToggleDock={() => { setDockOpen(true); setDockMobileOpen((v) => !v); }} />

      <div className={`posw__shell${railOpen ? "" : " posw__shell--rail-closed"}${dockOpen ? "" : " posw__shell--dock-closed"}`}>
        {(railOpen || railMobileOpen) && <StepRail stepId={stepId} setStepId={(id) => { setStepId(id); setRailMobileOpen(false); }} persona={persona} visibleSteps={visibleSteps} mobileOpen={railMobileOpen} onClose={() => { if (railMobileOpen) setRailMobileOpen(false); else setRailOpen(false); }} />}

        <main className="posmain" aria-label="Step content">
          <div className="posmain__head">
            <div className="posmain__title-block">
              <div className="posmain__eyebrow">{h.area.length > 0 ? `Step ${step.num} · ${h.area}` : ""}</div>
              <WorkbookSectionHeading workbook="RI" title={h.title} description={h.sub} level={1} className="posmain__title" />
            </div>
            <div className="posmain__actions">
              {!railOpen && <button type="button" className="posnav__btn posnav__btn--sm ri-show-steps" onClick={() => setRailOpen(true)}><RIIcon.Layers /> Show steps</button>}
              {!dockOpen && (
                <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => { setDockOpen(true); setDockMobileOpen(window.matchMedia("(max-width: 1100px)").matches); }}><RIIcon.Eye /> Show conformance</button>
              )}
            </div>
          </div>

          {renderScreen()}

          <div className="posnav">
            {prev ? (
              <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => setStepId(prev.id)}>
                <RIIcon.ArrowL /> {prev.label}
              </button>
            ) : <span />}
            {next ? (
              <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={() => setStepId(next.id)}>Next: {next.label} <RIIcon.ArrowR /></button>
            ) : <span />}
          </div>
        </main>

        {dockOpen && (
          <ConformanceDock ccId={ccId} appType={appType} onGoToCriteria={() => setStepId("application")} onClose={() => { setDockOpen(false); setDockMobileOpen(false); }} mobileOpen={dockMobileOpen} />
        )}
        {(railMobileOpen || dockMobileOpen) && (
          <div className="posw__mobile-scrim" onClick={() => { setRailMobileOpen(false); setDockMobileOpen(false); }} aria-hidden="true" />
        )}
      </div>

      {drawer !== null && <RiDrawer context={drawer} onClose={() => setDrawer(null)} onRetarget={setDrawer} />}

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

export { RiWorkbench, type HeaderMeta, type RiWorkbenchActions };
