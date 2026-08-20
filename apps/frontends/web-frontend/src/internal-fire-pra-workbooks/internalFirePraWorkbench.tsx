import { INTERNAL_FIRE_STEP_DEFINITIONS } from "interfaces-mef-types/internal-fire/internal-fire-pra";
import { type JSX, type ReactNode, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { POSIcon } from "../pos-workbooks/posIcons";
import { groupInternalFireConformance, internalFireConformanceItems, internalFireConformanceScore } from "./internalFirePraConformance";
import { InfoButton } from "./internalFirePraFields";
import { composeWorkbookCue } from "../workbooks/workbookCueContent";
import { InternalFirePraStepScreen } from "./internalFirePraStepScreen";
import { useInternalFirePraWorkbook } from "./internalFirePraWorkbookContext";
import { ApprovalScreen } from "./steps/approvalScreen";
import { DraftScreen, type InternalFireWorkflowActions } from "./steps/draftScreen";
import { ReviewScreen } from "./steps/reviewScreen";
import "../workbooks/css/workbookWorkspace.css";
import "../internal-flood-pra-workbooks/css/internalFloodPra.css";
import "./css/internalFirePra.css";

export type InternalFirePraPersona = "preparer" | "reviewer" | "approver";
interface HeaderMeta { projectName: string; workbookName: string; workbookVersion: string }
const BADGE: Record<string, string> = { INTEGRATED: "ALL", WORKFLOW: "WF" };

function Header({ persona, setPersona, availablePersonas, showPersonaPicker, onOpenRoles, onLoadExample, onUnloadExample, headerMeta, onToggleRail, onToggleDock, exampleOptions, selectedExample, onSelectExample }: {
  persona: InternalFirePraPersona; setPersona: (persona: InternalFirePraPersona) => void; availablePersonas: InternalFirePraPersona[]; showPersonaPicker: boolean;
  onOpenRoles?: () => void; onLoadExample?: () => void; onUnloadExample?: () => void; headerMeta: HeaderMeta; onToggleRail: () => void; onToggleDock: () => void;
  exampleOptions?: Array<{ id: string; label: string }>; selectedExample?: string; onSelectExample?: (id: string) => void;
}): JSX.Element {
  const { mef } = useInternalFirePraWorkbook();
  const navigate = useNavigate();
  return <header className="poshd flhd firehd"><button type="button" className="posw__mobile-toggle" onClick={onToggleRail}>☰ Steps</button><div className="poshd__crumb"><button type="button" onClick={() => navigate(-1)}>←</button><button type="button" onClick={() => navigate(-1)}>{headerMeta.projectName}</button><span>›</span><span>Internal Fire PRA</span><span>›</span><span className="poshd__crumb-current">{headerMeta.workbookName}</span><span className={`poshd__wfstate ${mef.workflowState === "DRAFT" ? "poshd__wfstate--draft" : "poshd__wfstate--external"}`}><span className="poshd__wfstate-dot" />{mef.workflowState.replace(/_/g, " ")}</span></div><div className="poshd__spacer" /><div className="poshd__actions">{exampleOptions !== undefined && exampleOptions.length > 1 && onSelectExample !== undefined && <label className="poshd__perspective"><span className="poshd__perspective-label">Example</span><select className="poshd__perspective-select" value={selectedExample} onChange={(event) => onSelectExample(event.target.value)}>{exampleOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>}{showPersonaPicker && availablePersonas.length > 1 && <label className="poshd__perspective"><span className="poshd__perspective-label">View as</span><select className="poshd__perspective-select" value={persona} onChange={(event) => setPersona(event.target.value as InternalFirePraPersona)}>{availablePersonas.map((item) => <option value={item} key={item}>{item[0].toUpperCase() + item.slice(1)}</option>)}</select></label>}{onOpenRoles !== undefined && <button type="button" className="posnav__btn posnav__btn--sm" onClick={onOpenRoles}><POSIcon.Settings /> Roles</button>}{onLoadExample !== undefined && <button type="button" className="posnav__btn posnav__btn--sm" onClick={onLoadExample}><POSIcon.Sparkle /> Load example</button>}{onUnloadExample !== undefined && <button type="button" className="posnav__btn posnav__btn--sm" onClick={onUnloadExample}><POSIcon.Close /> Unload example</button>}<span className="poshd__save-pill"><span className="poshd__save-pill-dot" />Autosaved · v{headerMeta.workbookVersion}</span><button type="button" className="posw__mobile-toggle" onClick={onToggleDock}><POSIcon.Eye /> Conformance</button></div></header>;
}

function Rail({ current, choose, mobileOpen, persona }: { current: string; choose: (id: string) => void; mobileOpen: boolean; persona: InternalFirePraPersona }): JSX.Element {
  const activeIndex = Math.max(0, INTERNAL_FIRE_STEP_DEFINITIONS.findIndex((step) => step.id === current));
  const visible = persona === "preparer" ? INTERNAL_FIRE_STEP_DEFINITIONS : INTERNAL_FIRE_STEP_DEFINITIONS.filter((step) => step.id !== "draft" || persona === "reviewer");
  return <aside className={`posw__rail flrail firerail${mobileOpen ? " posw__rail--mobile-open" : ""}`}><div className="posrail__head"><span className="posrail__eyebrow">{persona === "preparer" ? "Workspace Progress" : `${persona} view`}</span><div className="posrail__progress"><span className="posrail__progress-num">{activeIndex + 1}</span><span className="posrail__progress-total">/ {INTERNAL_FIRE_STEP_DEFINITIONS.length} steps</span></div><div className="posrail__bar"><div className="posrail__bar-fill" style={{ width: `${String(((activeIndex + 1) / INTERNAL_FIRE_STEP_DEFINITIONS.length) * 100)}%` }} /></div></div><ul className="posrail__list">{visible.map((step) => <li key={step.id}><button type="button" onClick={() => choose(step.id)} className={`posrail__step${current === step.id ? " posrail__step--active" : ""}`}><span className="posrail__step-num">{step.number}</span><span className="posrail__step-label"><span className={`flsubbadge flsubbadge--${step.subelement.toLowerCase()}`}>{BADGE[step.subelement] ?? step.subelement}</span><span className="flrail__step-name">{step.label}</span></span></button></li>)}</ul></aside>;
}

function ConformanceDock({ mobileOpen, onClose }: { mobileOpen: boolean; onClose: () => void }): JSX.Element {
  const { mef } = useInternalFirePraWorkbook();
  const items = useMemo(() => internalFireConformanceItems(mef), [mef]);
  const groups = useMemo(() => groupInternalFireConformance(items), [items]);
  const score = useMemo(() => internalFireConformanceScore(items), [items]);
  return <aside className={`posw__dock fldock firedock${mobileOpen ? " posw__dock--mobile-open" : ""}`} aria-label="Internal Fire conformance"><div className="posdock__head"><div className="posdock__title-row"><h2 className="posdock__title">Conformance</h2><button type="button" className="posdock__close" onClick={onClose} aria-label="Hide checklist"><POSIcon.Close /></button></div><div className="posdock__gauge"><div className="posdock__gauge-circle"><svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="15.9" fill="none" strokeWidth="3.2" className="posdock__gauge-track" /><circle cx="18" cy="18" r="15.9" fill="none" strokeWidth="3.2" className="posdock__gauge-fill" strokeDasharray={`${String((score.percent * 99.9) / 100)} 99.9`} strokeLinecap="round" transform="rotate(-90, 18, 18)" /><text x="18" y="18" className="posdock__gauge-text">{score.percent}%</text></svg></div><div className="posdock__gauge-meta"><span className="posdock__gauge-summary">{score.met} of {score.applicable} ready</span><span className="posdock__gauge-detail">{score.warn} attention{score.blocked > 0 && <> · {score.blocked} blocked</>} · {score.na} N/A</span></div></div></div><div className="posdock__body">{groups.map(([name, group]) => <div key={name}><div className="posdock__section-head">{name}<span className="posdock__section-head-count">{group.filter((item) => item.status === "ok").length} / {group.filter((item) => item.status !== "na").length}</span></div>{group.map((item) => <div key={item.id} className={`posdock__item posdock__item--${item.status}`}><span className="posdock__item-dot" /><span className="posdock__item-text">{item.text}</span></div>)}</div>)}</div></aside>;
}

function Screen({ id, persona, actions, renderApprovalTable, renderSignCard, renderRoster }: { id: string; persona: InternalFirePraPersona; actions?: InternalFireWorkflowActions; renderApprovalTable?: () => ReactNode; renderSignCard?: () => ReactNode; renderRoster?: () => ReactNode }): JSX.Element {
  if (id === "draft") return <DraftScreen actions={actions} />;
  if (id === "review") return <ReviewScreen persona={persona} actions={actions} renderRoster={renderRoster} />;
  if (id === "approval") return <ApprovalScreen persona={persona} actions={actions} renderApprovalTable={renderApprovalTable} renderSignCard={renderSignCard} />;
  return <InternalFirePraStepScreen stepId={id} />;
}

export interface InternalFirePraWorkbenchProps {
  persona: InternalFirePraPersona; setPersona: (persona: InternalFirePraPersona) => void; availablePersonas?: InternalFirePraPersona[]; showPersonaPicker?: boolean;
  onOpenRoles?: () => void; onLoadExample?: () => void; onUnloadExample?: () => void; headerMeta: HeaderMeta; actions?: InternalFireWorkflowActions;
  renderApprovalTable?: () => ReactNode; renderSignCard?: () => ReactNode; renderRoster?: () => ReactNode;
  exampleOptions?: Array<{ id: string; label: string }>; selectedExample?: string; onSelectExample?: (id: string) => void;
}

export function InternalFirePraWorkbench({ persona, setPersona, availablePersonas = ["preparer", "reviewer", "approver"], showPersonaPicker = true, onOpenRoles, onLoadExample, onUnloadExample, headerMeta, actions, renderApprovalTable, renderSignCard, renderRoster, exampleOptions, selectedExample, onSelectExample }: InternalFirePraWorkbenchProps): JSX.Element {
  const [stepId, setStepId] = useState(persona === "reviewer" ? "review" : persona === "approver" ? "approval" : "analysis-basis");
  const [railOpen, setRailOpen] = useState(false);
  const [dockOpen, setDockOpen] = useState(true);
  useEffect(() => { const resize = (): void => { if (window.innerWidth <= 1100) setDockOpen(false); if (window.innerWidth <= 768) setRailOpen(false); }; resize(); window.addEventListener("resize", resize); return () => window.removeEventListener("resize", resize); }, []);
  const active = INTERNAL_FIRE_STEP_DEFINITIONS.find((step) => step.id === stepId) ?? INTERNAL_FIRE_STEP_DEFINITIONS[0]!;
  const index = INTERNAL_FIRE_STEP_DEFINITIONS.indexOf(active);
  const previous = INTERNAL_FIRE_STEP_DEFINITIONS[index - 1]; const next = INTERNAL_FIRE_STEP_DEFINITIONS[index + 1];
  function choose(id: string): void { setStepId(id); setRailOpen(false); window.scrollTo(0, 0); }
  return <div className={`posw flw firew${dockOpen ? "" : " flw--dock-closed"}`}><Header persona={persona} setPersona={setPersona} availablePersonas={availablePersonas} showPersonaPicker={showPersonaPicker} onOpenRoles={onOpenRoles} onLoadExample={onLoadExample} onUnloadExample={onUnloadExample} headerMeta={headerMeta} onToggleRail={() => setRailOpen((value) => !value)} onToggleDock={() => setDockOpen((value) => !value)} exampleOptions={exampleOptions} selectedExample={selectedExample} onSelectExample={onSelectExample} /><Rail current={stepId} choose={choose} mobileOpen={railOpen} persona={persona} /><main className="posmain flmain firemain"><div className="flmain__head"><div className="flmain__title"><span>Step {active.number} · {BADGE[active.subelement] ?? active.subelement}</span><div className="flmain__title-row"><h1>{active.title}</h1><InfoButton label={`About ${active.title}`}>{composeWorkbookCue("FIRE", active.title, active.subtitle)}</InfoButton></div></div>{!dockOpen && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => setDockOpen(true)}><POSIcon.Eye /> Show conformance</button>}</div><div className="flmain__body"><Screen id={stepId} persona={persona} actions={actions} renderApprovalTable={renderApprovalTable} renderSignCard={renderSignCard} renderRoster={renderRoster} /></div><nav className="flmain__nav">{previous !== undefined ? <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => choose(previous.id)}><POSIcon.ArrowL /> {previous.label}</button> : <span />}{next !== undefined ? <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={() => choose(next.id)}>Next: {next.label} <POSIcon.ArrowR /></button> : <span />}</nav></main>{dockOpen && <ConformanceDock mobileOpen={dockOpen} onClose={() => setDockOpen(false)} />}</div>;
}
