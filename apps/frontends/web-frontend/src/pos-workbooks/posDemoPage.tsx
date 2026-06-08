import { JSX, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { type PlantOperatingStatesAnalysis } from "interfaces-mef-types/pos/plant-operating-state-analysis";
import { type PRAConfigurationControl } from "interfaces-mef-types/cross-cutting/pra-configuration-control";
import { type NewlyDevelopedMethod } from "interfaces-mef-types/cross-cutting/newly-developed-methods";
import { fetchJson } from "../api/client";
import { POSIcon } from "./posIcons";
import {
  POS_PROJECT,
  CAPABILITY_CATEGORIES,
  PERSONAS,
  workflowStateDisplay,
  type PosPersona,
  type PosStep,
} from "./posViewData";
import {
  stepIndexById,
  filterConformance,
  groupBySection,
  ccScore,
  stepsFromMef,
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
import { PosWorkbookProvider, type PosWorkbookData } from "./posWorkbookContext";
import { useAuth } from "../auth/AuthContext";
import { WorkbookDemoSignCard } from "../workbooks/workbookDemoSignCard";
import "../workbooks/css/workbookWorkspace.css";

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
      eyebrow: "Step 11 · Review",
      title: "Internal technical review",
      sub: "Reviewers and the approver post comments. The workbook advances to internal approval once every assigned reviewer has signed.",
    };
    case "approval": return {
      eyebrow: "Step 12 · Approval",
      title: "Internal approval",
      sub: isApprover
        ? "All earlier steps are locked. Review the comment record, leave any closing remarks, then sign and approve."
        : "Awaiting the approver's signature. All role-holders see the collected signatures here.",
    };
    default: return { eyebrow: "", title: "" };
  }
}

interface PosExampleResponse {
  slug: string;
  kind: string;
  mef: unknown;
  updatedAt: string;
}

interface PosBundleResponse {
  pos: PosExampleResponse;
  configurationControl: PosExampleResponse;
  newlyDevelopedMethods: PosExampleResponse[];
}

interface HeaderMeta {
  projectName: string;
  workbookName: string;
  workbookVersion: string;
  plantIdentity?: { name: string; type: string; power: string; vendor: string };
}

function WorkspaceHeader({
  stage, setStage, onBack, persona, setPersona, workflowState, showPersonaPicker, availablePersonas, onOpenRoles, onLoadExample, onUnloadExample, headerMeta, onToggleRail, onToggleDock,
}: {
  stage: Stage;
  setStage: (s: Stage) => void;
  onBack: () => void;
  persona: PosPersona;
  setPersona: (p: PosPersona) => void;
  workflowState: string;
  showPersonaPicker: boolean;
  availablePersonas: PosPersona[];
  onOpenRoles?: () => void;
  onLoadExample?: () => void;
  onUnloadExample?: () => void;
  headerMeta: HeaderMeta;
  onToggleRail?: () => void;
  onToggleDock?: () => void;
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
      {onToggleRail !== undefined && (
        <button type="button" className="posw__mobile-toggle" onClick={onToggleRail} aria-label="Open steps">
          <POSIcon.Layers /> Steps
        </button>
      )}
      <div className="poshd__crumb">
        <button type="button" onClick={onBack}><POSIcon.ArrowL /></button>
        <button type="button" onClick={onBack}>{headerMeta.projectName}</button>
        <POSIcon.Chevron />
        <span>Plant Operating States Analysis</span>
        <POSIcon.Chevron />
        <span className="poshd__crumb-current">{headerMeta.workbookName}</span>
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
        {showPersonaPicker && availablePersonas.length > 1 && (
          <label className="poshd__perspective" title="Switch perspective">
            <span className="poshd__perspective-label">View as</span>
            <select
              className="poshd__perspective-select"
              value={persona}
              onChange={(e) => setPersona(e.target.value as PosPersona)}
            >
              {availablePersonas.includes("preparer") && <option value="preparer">Preparer</option>}
              {availablePersonas.includes("reviewer") && <option value="reviewer">Reviewer</option>}
              {availablePersonas.includes("approver") && <option value="approver">Approver</option>}
            </select>
          </label>
        )}
        {onOpenRoles !== undefined && (
          <button type="button" className="posnav__btn posnav__btn--sm" onClick={onOpenRoles} title="Manage roles">
            <POSIcon.Settings /> Roles
          </button>
        )}
        {onLoadExample !== undefined && (
          <button type="button" className="posnav__btn posnav__btn--sm" onClick={onLoadExample} title="Replace contents with the Generic-1 example workbook">
            <POSIcon.Sparkle /> Load example
          </button>
        )}
        {onUnloadExample !== undefined && (
          <button type="button" className="posnav__btn posnav__btn--sm" onClick={onUnloadExample} title="Restore the workbook contents that existed before the example was loaded">
            <POSIcon.Close /> Unload example
          </button>
        )}
        <span className="poshd__save-pill">
          <span className="poshd__save-pill-dot" />
          Autosaved · v{headerMeta.workbookVersion}
        </span>
        <button type="button" className="posnav__btn" aria-label="History">
          <POSIcon.History />
        </button>
        {onToggleDock !== undefined && (
          <button type="button" className="posw__mobile-toggle" onClick={onToggleDock} aria-label="Open conformance">
            <POSIcon.Eye /> Conformance
          </button>
        )}
      </div>
    </header>
  );
}

function StepRail({
  stepId, setStepId, persona, visibleSteps, mobileOpen,
}: {
  stepId: string;
  setStepId: (id: string) => void;
  persona: PosPersona;
  visibleSteps: PosStep[];
  mobileOpen: boolean;
}): JSX.Element {
  const idx = Math.max(0, visibleSteps.findIndex((s) => s.id === stepId));
  const pct = ((idx + 1) / visibleSteps.length) * 100;
  const eyebrow = persona === "reviewer" ? "Reviewer view" : persona === "approver" ? "Approver view" : "Workspace progress";
  return (
    <aside className={`posw__rail${mobileOpen ? " posw__rail--mobile-open" : ""}`} aria-label="POS analysis steps">
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
  pos, ccId, stage, onGoToSetup, onClose, onAction, nms, mobileOpen,
}: {
  pos: PlantOperatingStatesAnalysis;
  ccId: string;
  stage: Stage;
  onGoToSetup: () => void;
  onClose: () => void;
  onAction: (msg: string) => void;
  nms: NewlyDevelopedMethod[];
  mobileOpen: boolean;
}): JSX.Element {
  const cc = CAPABILITY_CATEGORIES.find((c) => c.id === ccId) ?? CAPABILITY_CATEGORIES[0];
  const items = useMemo(() => filterConformance(pos, ccId, stage), [pos, ccId, stage]);
  const sections = useMemo(() => groupBySection(items), [items]);
  const scores = ccScore(pos, ccId, stage);
  const dashTotal = 99.9;
  const dash = (scores.percent * dashTotal) / 100;
  return (
    <aside className={`posw__dock${mobileOpen ? " posw__dock--mobile-open" : ""}`} aria-label="Conformance checklist">
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
              <span className="posdock__section-head-count">
                {sectionItems.filter((it) => it.status === "ok").length} / {sectionItems.length}
              </span>
            </div>
            {sectionItems.map((it) => {
              const nm = it.linkedNM !== undefined ? nmViewById(nms, it.linkedNM) : undefined;
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

const DEFAULT_PERSONAS: PosPersona[] = ["preparer", "reviewer", "approver"];

interface PosWorkbenchActions {
  postComment: (text: string, severity: "MAJOR" | "MINOR" | "OBSERVATION", stepId: string) => Promise<void>;
  toggleResolve: (commentId: string, nextResolved: boolean) => Promise<void>;
  submitForReview: () => Promise<void>;
  signReview: () => Promise<void>;
  signApproval: () => Promise<void>;
  requestRevision: (note: string) => Promise<void>;
}

interface PosWorkbenchDocuments {
  list: import("./posWorkbookApi").PosDocumentEntry[];
  canUpload: boolean;
  onUpload: (file: File) => Promise<void>;
  onDelete: (documentId: string) => Promise<void>;
  onDownload: (documentId: string) => Promise<void>;
}

function PosWorkbench({ data, persona, setPersona, showPersonaPicker, availablePersonas = DEFAULT_PERSONAS, onOpenRoles, onLoadExample, onUnloadExample, actions, documents, headerMeta, mefPatch, mefPatchDebounced, renderApprovalTable, renderSignCard, renderRoster }: {
  data: PosWorkbookData;
  persona: PosPersona;
  setPersona: (p: PosPersona) => void;
  showPersonaPicker: boolean;
  availablePersonas?: PosPersona[];
  onOpenRoles?: () => void;
  onLoadExample?: () => void;
  onUnloadExample?: () => void;
  actions?: PosWorkbenchActions;
  documents?: PosWorkbenchDocuments;
  headerMeta: HeaderMeta;
  mefPatch?: import("./useMefPatch").MefPatcher["patch"];
  mefPatchDebounced?: import("./useMefPatch").MefPatcher["patchDebounced"];
  renderApprovalTable?: () => JSX.Element | null;
  renderSignCard?: () => JSX.Element | null;
  renderRoster?: () => JSX.Element | null;
}): JSX.Element {
  const navigate = useNavigate();
  const isReviewer = persona === "reviewer";
  const isApprover = persona === "approver";
  const isPreparer = persona === "preparer";

  const documentCount = documents?.list.length ?? 0;
  const visibleSteps = useMemo(() => stepsFromMef(data.pos, persona, documentCount), [data.pos, persona, documentCount]);

  const mefCcId = data.pos.capabilityCategory === "CC-I" ? "cc-i" : "cc-ii";
  const mefStage: Stage = data.pos.plantStage === "OPERATIONAL" ? "operational" : "pre_operational";
  const [ccId, setCcId] = useState<string>(mefCcId);
  const [stage, setStage] = useState<Stage>(mefStage);

  useEffect(() => { setCcId(mefCcId); }, [mefCcId]);
  useEffect(() => { setStage(mefStage); }, [mefStage]);

  const initialStep = visibleSteps[0]?.id ?? "setup";
  const [stepId, setStepIdState] = useState<string>(initialStep);
  const isMobile = typeof window !== "undefined" && window.matchMedia("(max-width: 768px)").matches;
  const [dockOpen, setDockOpen] = useState(!isMobile);
  const [railMobileOpen, setRailMobileOpen] = useState(false);
  const [dockMobileOpen, setDockMobileOpen] = useState(false);
  const [drawer, setDrawer] = useState<DrawerContext | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);

  const { user: authUser } = useAuth();
  const actingUsername = authUser?.username ?? "";
  const [comments, setComments] = useState<CommentView[]>(() => commentsView(data.pos));
  const [submittedLocal, setSubmittedLocal] = useState(false);
  const [approvedLocal, setApprovedLocal] = useState(false);
  const [demoPreparerPhase, setDemoPreparerPhase] = useState(false);
  const [commentDockOpen, setCommentDockOpen] = useState(false);

  useEffect(() => {
    setComments(commentsView(data.pos));
  }, [data.pos]);

  const workflowState = data.pos.workflowState;
  const submitted = actions === undefined ? submittedLocal : (workflowState === "INTERNAL_APPROVAL" || workflowState === "FINAL");
  const approved = actions === undefined ? approvedLocal : workflowState === "FINAL";

  useEffect(() => {
    if (visibleSteps.find((s) => s.id === stepId) === undefined) {
      const fallback = visibleSteps[0]?.id ?? "setup";
      setStepIdState(fallback);
    }
  }, [persona, stepId, visibleSteps]);

  function setStepId(id: string): void {
    setStepIdState(id);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "auto" });
    }
  }

  function flash(msg: string): void {
    setToast(msg);
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2200);
  }

  function handleGenerate(final: boolean): void {
    flash(final ? "Generating report…" : "Generating draft report…");
    generatePosReport(data.pos, final).catch(() => flash("Could not generate the report"));
  }

  function handleSubmitDraft(ready: boolean): void {
    if (actions === undefined) setSubmittedLocal(true);
    flash(ready ? "Draft submitted to internal review" : "Working draft submitted with open items");
    setStepId("review");
  }

  function handleSubmitToApproval(): void {
    if (actions !== undefined) {
      actions.submitForReview()
        .then(() => flash("Submitted for internal review"))
        .catch((err: unknown) => flash((err as { message?: string }).message ?? "Could not submit"));
      return;
    }
    setSubmittedLocal(true);
    flash("Submitted to internal approval");
  }

  function handleSign(): void {
    if (actions !== undefined) {
      const op = persona === "approver" ? actions.signApproval() : actions.signReview();
      op
        .then(() => flash(persona === "approver" ? "Approval signed" : "Review signed"))
        .catch((err: unknown) => flash((err as { message?: string }).message ?? "Could not sign"));
      return;
    }
    setApprovedLocal(true);
    flash("Workbook approved · locked from edits");
  }

  function toggleResolved(commentId: string): void {
    if (!isReviewer && !isApprover) return;
    if (actions !== undefined) {
      const target = comments.find((c) => c.id === commentId);
      if (target === undefined) return;
      actions.toggleResolve(commentId, !target.resolved)
        .catch((err: unknown) => flash((err as { message?: string }).message ?? "Could not update comment"));
      return;
    }
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

  function handlePostComment(text: string, severity: "MAJOR" | "MINOR" | "OBSERVATION"): void {
    if (actions === undefined) {
      flash("Comment posted (example workbook)");
      return;
    }
    actions.postComment(text, severity, stepId)
      .then(() => flash("Comment posted"))
      .catch((err: unknown) => flash((err as { message?: string }).message ?? "Could not post comment"));
  }

  function handleRequestRevision(): void {
    if (actions === undefined) {
      flash("Revision requested (example workbook)");
      return;
    }
    actions.requestRevision("")
      .then(() => flash("Revision requested"))
      .catch((err: unknown) => flash((err as { message?: string }).message ?? "Could not request revision"));
  }

  const idx = Math.max(0, visibleSteps.findIndex((s) => s.id === stepId));
  const step = visibleSteps[idx] ?? visibleSteps[0];
  const prev = visibleSteps[idx - 1];
  const next = visibleSteps[idx + 1];
  const cc = CAPABILITY_CATEGORIES.find((c) => c.id === ccId) ?? CAPABILITY_CATEGORIES[0];
  const scores = ccScore(data.pos, ccId, stage);
  const h = headersFor(stepId, isApprover);

  const canEdit = isPreparer && (workflowState === "DRAFT" || workflowState === "REVISION_REQUIRED");
  const screenProps = { ccId, setCcId, stage, setStage, openDrawer: setDrawer, onAction: flash, mefPatch, mefPatchDebounced, canEdit };

  function renderScreen(): JSX.Element | null {
    switch (stepId) {
      case "setup": return <SetupScreen {...screenProps} />;
      case "documents": return (
        <DocumentsScreen
          {...screenProps}
          realDocuments={documents?.list}
          canUpload={(documents?.canUpload ?? false) && canEdit}
          onUploadFile={documents?.onUpload}
          onDeleteDocument={documents?.onDelete}
          onDownloadDocument={documents?.onDownload}
        />
      );
      case "evolutions": return <EvolutionsScreen {...screenProps} />;
      case "states": return <StatesScreen {...screenProps} />;
      case "interviews": return <InterviewsScreen {...screenProps} />;
      case "screening": return <ScreeningScreen {...screenProps} />;
      case "grouping": return <GroupingScreen {...screenProps} />;
      case "frequency": return <FrequencyScreen canEdit={canEdit} />;
      case "decayheat": return <DecayHeatScreen {...screenProps} />;
      case "draft": return <DraftScreen cc={cc} scores={scores} stage={stage} onGenerate={handleGenerate} onSubmitDraft={(ready) => {
        if (actions !== undefined) {
          actions.submitForReview()
            .then(() => { flash("Submitted for internal review"); setStepId("review"); })
            .catch((err: unknown) => flash((err as { message?: string }).message ?? "Could not submit for review"));
        } else {
          setSubmittedLocal(true);
          flash(ready ? "Submitted for internal review" : "Working draft submitted for review");
          setStepId("review");
        }
      }} canSubmit={isPreparer && (workflowState === "DRAFT" || workflowState === "REVISION_REQUIRED")} />;
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
          onToggleResolved={toggleResolved}
          onSubmitToApproval={handleSubmitToApproval}
          onSign={handleSign}
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
                onPreparerSigned={() => { setApprovedLocal(true); flash("Workbook approved (example)"); }}
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
    <div className={`posw${isReviewer ? " posw--external posw--reviewer" : ""}${isApprover ? " posw--approver" : ""}`} data-screen-label={`POS — ${step.label}`}>
      {isReviewer && <div className="poshd__extbar" />}
      {isApprover && <div className="poshd__apprbar" />}
      <WorkspaceHeader stage={stage} setStage={setStage} onBack={() => navigate(-1)} persona={persona} setPersona={setPersona} workflowState={data.pos.workflowState} showPersonaPicker={showPersonaPicker} availablePersonas={availablePersonas} onOpenRoles={onOpenRoles} onLoadExample={onLoadExample} onUnloadExample={onUnloadExample} headerMeta={headerMeta} onToggleRail={() => setRailMobileOpen((v) => !v)} onToggleDock={() => { setDockOpen(true); setDockMobileOpen((v) => !v); }} />

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
            ) : isPreparer && approved ? (
              <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={() => flash("Released to external workflows")}>
                <POSIcon.Send /> Released to external workflows
              </button>
            ) : <span />}
          </div>
        </main>

        {dockOpen && (
          <ConformanceDock
            pos={data.pos}
            ccId={ccId}
            stage={stage}
            onGoToSetup={() => setStepId("setup")}
            onClose={() => { setDockOpen(false); setDockMobileOpen(false); }}
            onAction={flash}
            nms={data.nms}
            mobileOpen={dockMobileOpen}
          />
        )}
        {(railMobileOpen || dockMobileOpen) && (
          <div
            className="posw__mobile-scrim"
            onClick={() => { setRailMobileOpen(false); setDockMobileOpen(false); }}
            aria-hidden="true"
          />
        )}
      </div>

      {drawer !== null && <Drawer context={drawer} onClose={() => setDrawer(null)} canEdit={canEdit} />}

      {toast !== null && <div className="postoast" role="status">{toast}</div>}

      {(isReviewer || isApprover) && (
        <ReviewerCommentDock
          open={commentDockOpen}
          onToggle={() => setCommentDockOpen((v) => !v)}
          onClose={() => setCommentDockOpen(false)}
          stepId={stepId}
          comments={comments}
          onToggleResolved={toggleResolved}
          onPostComment={handlePostComment}
          onRequestRevision={handleRequestRevision}
          canRequestRevision={actions !== undefined && (workflowState === "INTERNAL_TECHNICAL_REVIEW" || workflowState === "INTERNAL_APPROVAL")}
          onSignReview={actions !== undefined && isReviewer ? handleSign : undefined}
          canSignReview={actions !== undefined && isReviewer && workflowState === "INTERNAL_TECHNICAL_REVIEW" && comments.filter((c) => c.authorId === actingUsername && !c.resolved).length === 0}
          onAction={flash}
        />
      )}
    </div>
  );
}

function PosDemoPage(): JSX.Element {
  const [data, setData] = useState<PosWorkbookData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [persona, setPersona] = useState<PosPersona>("preparer");

  useEffect(() => {
    let cancelled = false;
    fetchJson<PosBundleResponse>("/api/example-workbooks/pos-bundle")
      .then((res) => {
        if (cancelled) return;
        setData({
          pos: res.pos.mef as PlantOperatingStatesAnalysis,
          cc: res.configurationControl.mef as PRAConfigurationControl,
          nms: res.newlyDevelopedMethods.map((nm) => nm.mef as NewlyDevelopedMethod),
        });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError((err as { message?: string }).message ?? "Could not load the example workbook");
      });
    return () => { cancelled = true; };
  }, []);

  if (error !== null) {
    return <div className="posw"><main className="posmain"><p className="pws-status pws-status--error">{error}</p></main></div>;
  }
  if (data === null) {
    return <div className="posw"><main className="posmain"><p className="pws-status">Loading example workbook…</p></main></div>;
  }

  return (
    <PosWorkbookProvider data={data}>
      <PosWorkbench
        data={data}
        persona={persona}
        setPersona={setPersona}
        showPersonaPicker={true}
        headerMeta={{
          projectName: POS_PROJECT.projectName,
          workbookName: POS_PROJECT.workbookName,
          workbookVersion: String(POS_PROJECT.workbookVersion),
          plantIdentity: POS_PROJECT.plant,
        }}
      />
    </PosWorkbookProvider>
  );
}

export { PosDemoPage, PosWorkbench };
