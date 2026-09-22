import { WorkbookSectionHeading } from "../workbooks/workbookSectionHeading";
import { JSX, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { RCIcon } from "./rcIcons";
import {
  CAPABILITY_CATEGORIES,
  type RcPersona,
  type RcStep,
  type SiteBasis,
} from "./rcViewData";
import { ccScore, commentsView, filterConformance, groupBySection, siteFromMef, stepsFromMef, type CommentView } from "./rcSelectors";
import { HandoffScreen, ProtectiveScreen, WeatherScreen, type RcDrawerContext } from "./rcScreens";
import { DispersionScreen, DosimetryScreen, HealthEffectsScreen, EconomicsScreen } from "./rcScreens2";
import { QuantifyScreen, DraftScreen, DrawerContent, PlaceholderScreen } from "./rcScreens3";
import { InternalReviewScreen, ReviewerCommentDock } from "./rcReview";
import { useRcWorkbook, type RcWorkbookData } from "./rcWorkbookContext";
import { useAuth } from "../auth/AuthContext";
import { WorkbookDemoSignCard } from "../workbooks/workbookDemoSignCard";
import { DockDependsChip } from "../workbooks/workbookInterfaces";
import "../workbooks/css/workbookWorkspace.css";
import "./css/rcScreens.css";
import "../welcome/css/newProjectModal.css";

interface StepHeader {
  eyebrow: string;
  title: string;
  sub?: string;
}

function headersFor(stepId: string): StepHeader {
  switch (stepId) {
    case "handoff": return { eyebrow: "Step 01 · RCRE", title: "Scope", sub: "The site fork, the nine inputs per category and the scoping declaration." };
    case "protective": return { eyebrow: "Step 02 · RCPA", title: "Site, Population & Response", sub: "Receptor positions, population groups and response timing." };
    case "weather": return { eyebrow: "Step 03 · RCME", title: "Meteorology", sub: "The representative weather year and its data quality." };
    case "dispersion": return { eyebrow: "Step 04 · RCAD", title: "Atmospheric Dispersion", sub: "The plume model, the weather sampling, the credit fence and the deposition." };
    case "dose": return { eyebrow: "Step 05 · RCDO", title: "Dosimetry", sub: "The exposure pathways and the dose treatment." };
    case "health": return { eyebrow: "Step 06 · RCHE", title: "Health Effects", sub: "The early and latent effects and the recognized risk factors." };
    case "economics": return { eyebrow: "Step 07 · RCEC", title: "Economic Factors", sub: "The cost categories and the regional economic data." };
    case "quantify": return { eyebrow: "Step 08 · RCQ", title: "Quantification", sub: "The codes, the consequence table and the uncertainty funnel." };
    case "draft": return { eyebrow: "Step 09 · Draft", title: "Produce the draft", sub: "Build the RC report, then send it to review." };
    case "review": return { eyebrow: "Step 10 · Review", title: "Internal technical review", sub: "Reviewers comment, the preparer replies, all resolve before approval." };
    case "approval": return { eyebrow: "Step 11 · Approval", title: "Approval & sign-off", sub: "Everyone signs, the approver last." };
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
  persona: RcPersona;
  setPersona: (p: RcPersona) => void;
  workflowState: string;
  showPersonaPicker: boolean;
  availablePersonas: RcPersona[];
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
        <button type="button" className="posw__mobile-toggle" onClick={onToggleRail} aria-label="Open steps"><RCIcon.Layers /> Steps</button>
      )}
      <div className="poshd__crumb">
        <button type="button" onClick={() => navigate(-1)}><RCIcon.ArrowL /></button>
        <button type="button" onClick={() => navigate(-1)}>{headerMeta.projectName}</button>
        <RCIcon.Chevron />
        <span>Radiological Consequence Analysis</span>
        <RCIcon.Chevron />
        <span className="poshd__crumb-current">{headerMeta.workbookName}</span>
        {personaPill !== null ? (
          <span className={`poshd__wfstate ${personaPill.cls}`}>
            <RCIcon.Lock />{personaPill.text}
          </span>
        ) : (
          <span className="poshd__wfstate poshd__wfstate--draft">
            <span className="poshd__wfstate-dot" />{workflowState}
          </span>
        )}
      </div>

      <div className="poshd__spacer" />

      <div className="poshd__actions">
        {showPersonaPicker && availablePersonas.length > 1 && (
          <label className="poshd__perspective">
            <span className="poshd__perspective-label">View as</span>
            <select className="poshd__perspective-select" value={persona} onChange={(e) => setPersona(e.target.value as RcPersona)}>
              {availablePersonas.includes("preparer") && <option value="preparer">Preparer</option>}
              {availablePersonas.includes("reviewer") && <option value="reviewer">Reviewer</option>}
              {availablePersonas.includes("approver") && <option value="approver">Approver</option>}
            </select>
          </label>
        )}
        {onOpenRoles !== undefined && (
          <button type="button" className="posnav__btn posnav__btn--sm" onClick={onOpenRoles}><RCIcon.Settings /> Roles</button>
        )}
        {onLoadExample !== undefined && (
          <button type="button" className="posnav__btn posnav__btn--sm" onClick={onLoadExample}><RCIcon.Sparkle /> Load example</button>
        )}
        {onUnloadExample !== undefined && (
          <button type="button" className="posnav__btn posnav__btn--sm" onClick={onUnloadExample}><RCIcon.Close /> Unload example</button>
        )}
        <span className="poshd__save-pill"><span className="poshd__save-pill-dot" />Autosaved · v{headerMeta.workbookVersion}</span>
        <button type="button" className="posnav__btn" aria-label="History"><RCIcon.History /></button>
        {onToggleDock !== undefined && (
          <button type="button" className="posw__mobile-toggle" onClick={onToggleDock} aria-label="Open conformance"><RCIcon.Eye /> Conformance</button>
        )}
      </div>
    </header>
  );
}

function StepRail({ stepId, setStepId, persona, visibleSteps, mobileOpen, onClose }: {
  stepId: string;
  setStepId: (id: string) => void;
  persona: RcPersona;
  visibleSteps: RcStep[];
  mobileOpen: boolean;
  onClose: () => void;
}): JSX.Element {
  const enabledSteps = visibleSteps.filter((s) => !s.excluded);
  const idx = Math.max(0, enabledSteps.findIndex((s) => s.id === stepId));
  const pct = ((idx + 1) / enabledSteps.length) * 100;
  const eyebrow = persona === "reviewer" ? "Reviewer view" : persona === "approver" ? "Approver view" : "Workspace progress";
  return (
    <aside className={`posw__rail${mobileOpen ? " posw__rail--mobile-open" : ""}`} aria-label="RC analysis steps">
      <div className="posrail__head">
        <div className="posrail__head-top"><span className="posrail__eyebrow">{eyebrow}</span>
          <button type="button" className="posdock__close" onClick={onClose} aria-label="Hide steps" title="Hide steps"><RCIcon.Close /></button>
        </div>
        <div className="posrail__progress">
          <span className="posrail__progress-num">{idx + 1}</span>
          <span className="posrail__progress-total">/ {enabledSteps.length} steps</span>
        </div>
        <div className="posrail__bar"><div className="posrail__bar-fill" style={{ width: `${pct}%` }} /></div>
      </div>
      <ul className="posrail__list">
        {visibleSteps.map((s) => {
          const active = s.id === stepId;
          const excluded = s.excluded === true;
          const complete = !excluded && s.status === "complete";
          const idle = s.status === "idle";
          return (
            <li key={s.id}>
              <button type="button" className={`posrail__step${active ? " posrail__step--active" : ""}${complete ? " posrail__step--complete" : ""}${idle && s.terminal === true ? " posrail__step--idle" : ""}${excluded ? " posrail__step--excluded" : ""}`} disabled={excluded} onClick={() => setStepId(s.id)}>
                <span className="posrail__step-num">{complete ? <RCIcon.Check /> : s.num}</span>
                <span>
                  <span className="posrail__step-label">
                    {s.label}
                    {s.se !== undefined && <span className={`rcse rcse--${s.seTone ?? "primary"}`} style={{ marginLeft: 6 }}>{s.se}</span>}
                  </span>
                  {excluded && <span className="posrail__step-sub">Excluded</span>}
                </span>
                <span className="posrail__step-warn" style={{ background: "transparent" }} />
              </button>
            </li>
          );
        })}
      </ul>
      <div className="posrail__footer">
        <button type="button" className="posrail__footer-btn"><RCIcon.Layers /> Show all inputs</button>
        <button type="button" className="posrail__footer-btn"><RCIcon.Settings /> Workbook settings</button>
      </div>
    </aside>
  );
}

function ConformanceDock({ ccId, site, onGoToHandoff, onClose, mobileOpen }: {
  ccId: string;
  site: SiteBasis;
  onGoToHandoff: () => void;
  onClose: () => void;
  mobileOpen: boolean;
}): JSX.Element {
  const { rc } = useRcWorkbook();
  const cc = CAPABILITY_CATEGORIES.find((c) => c.id === ccId) ?? CAPABILITY_CATEGORIES[0];
  const items = useMemo(() => filterConformance(rc, ccId, site), [rc, ccId, site]);
  const sections = useMemo(() => groupBySection(items), [items]);
  const scores = ccScore(rc, ccId, site);
  const dashTotal = 99.9;
  const dash = (scores.percent * dashTotal) / 100;
  return (
    <aside className={`posw__dock${mobileOpen ? " posw__dock--mobile-open" : ""}`} aria-label="Conformance checklist">
      <div className="posdock__head">
        <div className="posdock__title-row">
          <h2 className="posdock__title">Conformance</h2>
          <button type="button" className="posdock__close" onClick={onClose} aria-label="Hide checklist"><RCIcon.Close /></button>
        </div>
        <div className="posdock__profile">
          <div className="posdock__profile-display">
            <span className="posdock__profile-name">{cc.name}</span>
            <span className="posdock__profile-tag">{cc.tag}</span>
            <button type="button" className="posdock__profile-change" onClick={onGoToHandoff}>Change</button>
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
                  <DockDependsChip element="RC" sr={it.id} />
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </aside>
  );
}

function RcDrawer({ context, onClose }: { context: RcDrawerContext; onClose: () => void }): JSX.Element {
  const modalLabel = ({ category: "Category details", protaction: "Protective action details", cohort: "Cohort details", sourcedoc: "Source document details", phase: "Incident phase details", evacdelay: "Evacuation delay details", protparam: "Protection parameter details", sitedata: "Site details", metbasis: "Meteorology source and period", metquality: "Meteorology quality controls", metdata: "Meteorological data quality", metparams: "Extracted parameters", dispersion: "Dispersion model and sampling", deposition: "Deposition matrix", pathway: "Exposure pathway", dosetreatment: "Dose treatment", healthparams: "Health-effect treatment", riskfactor: "Risk-factor source", costcategory: "Cost category", costparam: "Cost parameter", econreview: "Economic input review", code: "Consequence code", family: "Event sequence family", uncertainty: "Model uncertainty", sensitivity: "Sensitivity study", bounding: "Bounding-site assumption", preop: "Pre-operational assumption", rifeedback: "Risk-integration feedback" } as Record<string, string | undefined>)[context.kind];
  const centered = modalLabel !== undefined;
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!centered) return;
    const trigger = document.activeElement as HTMLElement | null;
    dialog.current?.focus();
    return () => { trigger?.focus(); };
  }, [centered]);
  useEffect(() => {
    function onKey(e: KeyboardEvent): void { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);
  return (
    <div className={centered ? "modal__backdrop" : "posdrawer-backdrop"} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={dialog} className={centered ? `modal ${context.kind === "category" ? "rc-category-modal" : "rc-details-modal"}${context.kind === "dispersion" || context.kind === "deposition" ? " rc-transport-modal" : ""}${context.kind === "pathway" || context.kind === "dosetreatment" ? " rc-dose-modal" : ""}` : "posdrawer"} role="dialog" aria-modal="true" aria-label={modalLabel} tabIndex={centered ? -1 : undefined}
        onKeyDown={e => {
          if (!centered || e.key !== "Tab") return;
          const controls = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled):not([type="hidden"]), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]')).filter(el => el.getClientRects().length > 0);
          const first = controls[0], last = controls[controls.length - 1];
          if (!first) { e.preventDefault(); return; }
          if (e.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) { e.preventDefault(); last.focus(); }
          else if (!e.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) { e.preventDefault(); first.focus(); }
        }}>
        <DrawerContent context={context} onClose={onClose} centered={centered} />
      </div>
    </div>
  );
}

interface RcWorkbenchActions {
  postComment: (text: string, severity: "MAJOR" | "MINOR" | "OBSERVATION", stepId: string) => Promise<void>;
  toggleResolve: (commentId: string, nextResolved: boolean) => Promise<void>;
  submitForReview: () => Promise<void>;
  requestRevision: (note: string) => Promise<void>;
}

const DEFAULT_PERSONAS: RcPersona[] = ["preparer", "reviewer", "approver"];

function RcWorkbench({
  data, persona, setPersona, showPersonaPicker, availablePersonas = DEFAULT_PERSONAS, onOpenRoles, onLoadExample, onUnloadExample, actions, headerMeta, renderApprovalTable, renderSignCard, renderRoster, renderDocuments,
}: {
  data: RcWorkbookData;
  persona: RcPersona;
  setPersona: (p: RcPersona) => void;
  showPersonaPicker: boolean;
  availablePersonas?: RcPersona[];
  onOpenRoles?: () => void;
  onLoadExample?: () => void;
  onUnloadExample?: () => void;
  actions?: RcWorkbenchActions;
  headerMeta: HeaderMeta;
  renderApprovalTable?: () => JSX.Element | null;
  renderSignCard?: () => JSX.Element | null;
  renderRoster?: () => JSX.Element | null;
  renderDocuments?: () => JSX.Element | null;
}): JSX.Element {
  const isReviewer = persona === "reviewer";
  const isApprover = persona === "approver";

  const visibleSteps = useMemo(() => stepsFromMef(data.rc, persona), [data.rc, persona]);
  const enabledSteps = useMemo(() => visibleSteps.filter((step) => !step.excluded), [visibleSteps]);
  const mefCcId = data.rc.capabilityCategory === "CC-I" ? "cc-i" : "cc-ii";
  const mefSite = siteFromMef(data.rc);
  const [ccId, setCcId] = useState<string>(mefCcId);
  const [site, setSite] = useState<SiteBasis>(mefSite);
  useEffect(() => { setCcId(mefCcId); }, [mefCcId]);
  useEffect(() => { setSite(mefSite); }, [mefSite]);

  const [selectedStepId, setStepIdState] = useState<string>(enabledSteps[0]?.id ?? "handoff");
  const stepId = enabledSteps.some((step) => step.id === selectedStepId) ? selectedStepId : enabledSteps[0]?.id ?? "handoff";
  const [initialSiteTab, setInitialSiteTab] = useState<"location" | "receptors">("receptors");
  const isNarrow = typeof window !== "undefined" && window.matchMedia("(max-width: 1100px)").matches;
  const [dockOpen, setDockOpen] = useState(!isNarrow);
  const [railOpen, setRailOpen] = useState(true);
  const [railMobileOpen, setRailMobileOpen] = useState(false);
  const [dockMobileOpen, setDockMobileOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<RcDrawerContext | null>(null);
  const toastTimer = useRef<number | null>(null);

  useEffect(() => {
    if (selectedStepId !== stepId) setStepIdState(stepId);
  }, [selectedStepId, stepId]);

  function setStepId(id: string): void {
    if (!enabledSteps.some((step) => step.id === id)) return;
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
  const [comments, setComments] = useState<CommentView[]>(() => commentsView(data.rc));
  const [commentDockOpen, setCommentDockOpen] = useState(false);
  const [demoSubmittedLocal, setDemoSubmittedLocal] = useState(false);
  const [demoApprovedLocal, setDemoApprovedLocal] = useState(false);
  const [demoPreparerPhase, setDemoPreparerPhase] = useState(false);
  useEffect(() => { setComments(commentsView(data.rc)); }, [data.rc]);

  const workflowState = data.rc.workflowState;
  const submitted = actions === undefined ? demoSubmittedLocal : (workflowState === "INTERNAL_APPROVAL" || workflowState === "FINAL");
  const approved = actions === undefined ? demoApprovedLocal : workflowState === "FINAL";
  const cc = CAPABILITY_CATEGORIES.find((c) => c.id === ccId) ?? CAPABILITY_CATEGORIES[0];
  const scores = ccScore(data.rc, ccId, site);
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

  const idx = Math.max(0, enabledSteps.findIndex((s) => s.id === stepId));
  const step = enabledSteps[idx] ?? enabledSteps[0];
  const prev = enabledSteps[idx - 1];
  const next = enabledSteps[idx + 1];
  const h = headersFor(stepId);

  function renderScreen(): JSX.Element {
    switch (stepId) {
      case "handoff":
        return (
          <>
            <HandoffScreen ccId={ccId} setCcId={setCcId} site={site} setSite={setSite} openDrawer={setDrawer} />
            {renderDocuments?.()}
          </>
        );
      case "protective": return <ProtectiveScreen openDrawer={setDrawer} initialSiteTab={initialSiteTab} />;
      case "weather": return <WeatherScreen openDrawer={setDrawer} onReviewSite={() => { setInitialSiteTab("location"); setStepId("protective"); }} />;
      case "dispersion": return <DispersionScreen openDrawer={setDrawer} />;
      case "dose": return <DosimetryScreen openDrawer={setDrawer} />;
      case "health": return <HealthEffectsScreen openDrawer={setDrawer} />;
      case "economics": return <EconomicsScreen openDrawer={setDrawer} />;
      case "quantify": return <QuantifyScreen openDrawer={setDrawer} onOpenStep={setStepId} />;
      case "draft": return <DraftScreen cc={cc} scores={scores} site={site} onSubmitDraft={() => { handleSubmitToApproval(); setStepId("review"); }} canSubmit={isPreparer} />;
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
    <div className={`posw rc-workspace${isReviewer ? " posw--external posw--reviewer" : ""}${isApprover ? " posw--approver" : ""}`} data-screen-label={`RC — ${step.label}`}>
      {isReviewer && <div className="poshd__extbar" />}
      {isApprover && <div className="poshd__apprbar" />}
      <WorkspaceHeader persona={persona} setPersona={setPersona} workflowState={data.rc.workflowState} showPersonaPicker={showPersonaPicker} availablePersonas={availablePersonas} onOpenRoles={onOpenRoles} onLoadExample={onLoadExample} onUnloadExample={onUnloadExample} headerMeta={headerMeta} onToggleRail={() => setRailMobileOpen((v) => !v)} onToggleDock={() => { setDockOpen(true); setDockMobileOpen((v) => !v); }} />

      <div className={`posw__shell${railOpen ? "" : " posw__shell--rail-closed"}${dockOpen ? "" : " posw__shell--dock-closed"}`}>
        {(railOpen || railMobileOpen) && <StepRail stepId={stepId} setStepId={(id) => { setStepId(id); setRailMobileOpen(false); }} persona={persona} visibleSteps={visibleSteps} mobileOpen={railMobileOpen} onClose={() => { if (railMobileOpen) setRailMobileOpen(false); else setRailOpen(false); }} />}

        <main className="posmain" aria-label="Step content">
          <div className="posmain__head">
            <div className="posmain__title-block">
              <div className="posmain__eyebrow">{h.eyebrow}</div>
              <WorkbookSectionHeading workbook="RC" title={h.title} description={h.sub} level={1} className="posmain__title" />
            </div>
            <div className="posmain__actions">
              {!railOpen && <button type="button" className="posnav__btn posnav__btn--sm rc-show-steps" onClick={() => setRailOpen(true)}><RCIcon.Layers /> Show steps</button>}
              {!dockOpen && (
                <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => { setDockOpen(true); setDockMobileOpen(window.matchMedia("(max-width: 1100px)").matches); }}><RCIcon.Eye /> Show conformance</button>
              )}
            </div>
          </div>

          {renderScreen()}

          <div className="posnav">
            {prev ? (
              <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => setStepId(prev.id)}>
                <RCIcon.ArrowL /> {prev.label}
              </button>
            ) : <span />}
            {next ? (
              <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={() => setStepId(next.id)}>Next: {next.label} <RCIcon.ArrowR /></button>
            ) : <span />}
          </div>
        </main>

        {dockOpen && (
          <ConformanceDock ccId={ccId} site={site} onGoToHandoff={() => setStepId("handoff")} onClose={() => { setDockOpen(false); setDockMobileOpen(false); }} mobileOpen={dockMobileOpen} />
        )}
        {(railMobileOpen || dockMobileOpen) && (
          <div className="posw__mobile-scrim" onClick={() => { setRailMobileOpen(false); setDockMobileOpen(false); }} aria-hidden="true" />
        )}
      </div>

      {drawer !== null && <RcDrawer context={drawer} onClose={() => setDrawer(null)} />}
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

export { RcWorkbench, type HeaderMeta, type RcWorkbenchActions };
