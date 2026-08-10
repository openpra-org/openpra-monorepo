import { type JSX, type ReactNode, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { POSIcon } from "../pos-workbooks/posIcons";
import {
  groupSeismicConformance,
  seismicConformanceItems,
  seismicConformanceScore,
} from "./seismicPraConformance";
import { useSeismicPraWorkbook } from "./seismicPraWorkbookContext";
import {
  AnnualRiskQuantificationScreen,
  ApprovalScreen,
  BaselinePraScreen,
  DraftScreen,
  EvidenceBaseScreen,
  FragilityDevelopmentScreen,
  HumanReliabilityScreen,
  InitialSelScreen,
  PlantResponseModelScreen,
  PlantConfigurationScreen,
  RiskIntegrationBaselineScreen,
  RiskInterpretationScreen,
  ReviewScreen,
  ScopeScreen,
  SelResponseScreen,
  SiteHazardModelScreen,
  type WorkflowActions,
} from "./seismicPraScreens";
import { InfoButton } from "./seismicPraFields";
import { composeWorkbookCue } from "../workbooks/workbookCueContent";
import "../workbooks/css/workbookWorkspace.css";
import "./css/seismicPra.css";

type SeismicPraPersona = "preparer" | "reviewer" | "approver";

interface Step {
  id: string;
  num: string;
  label: string;
  subelement: "INTEGRATED" | "SHA" | "SFR" | "SPR" | "WORKFLOW";
  hlr?: string;
  title: string;
  subtitle: string;
}

const STEPS: Step[] = [
  { id: "scope", num: "01", label: "Analysis basis", subelement: "INTEGRATED", title: "Analysis basis", subtitle: "Use this step to set the starting rules for the Seismic PRA: what is included, which risk results are needed, how earthquake motion will be described, where that motion applies, and what data moves between technical elements." },
  { id: "hazard-basis", num: "02", label: "Evidence base", subelement: "INTEGRATED", title: "Qualified evidence base", subtitle: "Use this step to register the existing PRA models, drawings, calculations, site data, procedures, operating experience, and configuration records that the Seismic PRA will rely on. Record where each item came from, its revision, who owns it, where it applies, and any known gaps before using it." },
  { id: "earth-science", num: "03", label: "Baseline and seismic changes", subelement: "INTEGRATED", title: "Baseline PRA and seismic changes", subtitle: "Use this step to identify the exact baseline PRA version, inspect the imported model scope, decide what is reused or changed for seismic conditions, and resolve the model interfaces needed before detailed seismic work begins." },
  { id: "sources-motion", num: "04", label: "Initial SEL", subelement: "INTEGRATED", title: "Initial SEL and failure consequences", subtitle: "Use this step to identify the SSCs that could affect seismic risk, record why each SSC is included, and connect each credible physical failure to its plant-model consequence." },
  { id: "site-response", num: "05", label: "Site seismic hazard", subelement: "SHA", title: "Site seismic-hazard model", subtitle: "Use this step to define the PSHA process, characterize seismic sources and ground motion, calculate local site effects and hazard results, and disposition secondary seismic hazards." },
  { id: "hazard-results", num: "06", label: "Plant demand", subelement: "SFR", title: "Plant seismic demand", subtitle: "Use this step to turn the site-hazard motion into foundation, floor, cabinet, and component demand for every applicable SEL item." },
  { id: "secondary-hazards", num: "07", label: "Plant configuration", subelement: "SFR", title: "Plant configuration and final SEL", subtitle: "Use this step to confirm the intended or installed plant configuration, anchorage and support load paths, seismic interactions, fire and flood sources, operator access, open vulnerabilities, and final SEL demand and failure-mode alignment." },
  { id: "sel-response", num: "08", label: "SSC screening and fragilities", subelement: "SFR", title: "SSC screening and fragility development", subtitle: "Use this step to screen only technically justified SSCs, identify governing failure mechanisms, calculate retained fragilities, and define the correlation and uncertainty treatments transferred to the plant model." },
  { id: "thresholds", num: "09", label: "Plant-response model", subelement: "SPR", title: "Seismic plant-response model", subtitle: "Use this step to identify seismic initiating events, adapt the baseline PRA logic, add seismic failures and shared dependencies, and map each event sequence to its modeled outcome." },
  { id: "fragility-results", num: "10", label: "Human response", subelement: "SPR", title: "Human response under seismic conditions", subtitle: "Use this step to identify credited human actions, evaluate earthquake-specific performance conditions and timing, and quantify HEP uncertainty, recovery credit, and dependencies." },
  { id: "plant-model", num: "11", label: "Annual risk", subelement: "SPR", title: "Annual seismic-risk quantification", subtitle: "Use this step to integrate the seismic hazard, fragilities, plant-response model, and HEPs; calculate annual family and release-category frequencies; verify numerical convergence; propagate uncertainty; and identify significant cutsets and contributors." },
  { id: "human-reliability", num: "12", label: "Risk interpretation", subelement: "INTEGRATED", title: "Risk interpretation and model refinement", subtitle: "Use this step to identify what drives the annual seismic-risk results, make only targeted technical refinements, requantify the model, and stop when the important results and contributor rankings remain stable." },
  { id: "quantification", num: "13", label: "Risk integration", subelement: "INTEGRATED", title: "Risk integration and baseline package", subtitle: "Use this step to transfer the final seismic results to Risk Integration, prevent overlap with other hazards, record risk-informed actions, verify traceability, and prepare the package that proceeds through drafting, review, and approval." },
  { id: "draft", num: "14", label: "Draft", subelement: "WORKFLOW", title: "Produce the draft", subtitle: "Complete SHA-I, SFR-F, and SPR-F documentation, verify traceability, and generate the controlled Word report for internal technical review." },
  { id: "review", num: "15", label: "Review", subelement: "WORKFLOW", title: "Internal technical review", subtitle: "Review all three subelements, comment against requirements, resolve findings, and request revisions." },
  { id: "approval", num: "16", label: "Approval", subelement: "WORKFLOW", title: "Internal approval", subtitle: "Review the controlled baseline, close comments, and complete role-based signatures." },
];

interface HeaderMeta { projectName: string; workbookName: string; workbookVersion: string }

function Header({ persona, setPersona, availablePersonas, showPersonaPicker, onOpenRoles, onLoadExample, onUnloadExample, headerMeta, onToggleRail, onToggleDock, exampleOptions, selectedExample, onSelectExample }: { persona: SeismicPraPersona; setPersona: (persona: SeismicPraPersona) => void; availablePersonas: SeismicPraPersona[]; showPersonaPicker: boolean; onOpenRoles?: () => void; onLoadExample?: () => void; onUnloadExample?: () => void; headerMeta: HeaderMeta; onToggleRail: () => void; onToggleDock: () => void; exampleOptions?: { id: string; label: string }[]; selectedExample?: string; onSelectExample?: (id: string) => void }): JSX.Element {
  const { mef } = useSeismicPraWorkbook();
  const navigate = useNavigate();
  return <header className="poshd shd">
    <button type="button" className="posw__mobile-toggle" onClick={onToggleRail}>☰ Steps</button>
    <div className="poshd__crumb"><button type="button" onClick={() => navigate(-1)}>←</button><button type="button" onClick={() => navigate(-1)}>{headerMeta.projectName}</button><span>›</span><span>Seismic PRA</span><span>›</span><span className="poshd__crumb-current">{headerMeta.workbookName}</span><span className={`poshd__wfstate ${mef.workflowState === "DRAFT" ? "poshd__wfstate--draft" : "poshd__wfstate--external"}`}><span className="poshd__wfstate-dot" />{mef.workflowState.replace(/_/g, " ")}</span></div>
    <div className="poshd__spacer" />
    <div className="poshd__actions">
      {exampleOptions !== undefined && exampleOptions.length > 1 && onSelectExample !== undefined && <label className="poshd__perspective" title="Switch the worked example"><span className="poshd__perspective-label">Example</span><select className="poshd__perspective-select" value={selectedExample} onChange={(event) => onSelectExample(event.target.value)}>{exampleOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>}
      {showPersonaPicker && availablePersonas.length > 1 && <label className="poshd__perspective"><span className="poshd__perspective-label">View as</span><select className="poshd__perspective-select" value={persona} onChange={(event) => setPersona(event.target.value as SeismicPraPersona)}>{availablePersonas.map((item) => <option value={item} key={item}>{item.charAt(0).toUpperCase() + item.slice(1)}</option>)}</select></label>}
      {onOpenRoles !== undefined && <button type="button" className="posnav__btn posnav__btn--sm" onClick={onOpenRoles} title="Manage roles"><POSIcon.Settings /> Roles</button>}
      {onLoadExample !== undefined && <button type="button" className="posnav__btn posnav__btn--sm" onClick={onLoadExample} title="Replace contents with the Generic HTGR example workbook"><POSIcon.Sparkle /> Load example</button>}
      {onUnloadExample !== undefined && <button type="button" className="posnav__btn posnav__btn--sm" onClick={onUnloadExample} title="Restore the workbook contents that existed before the example was loaded"><POSIcon.Close /> Unload example</button>}
      <span className="poshd__save-pill"><span className="poshd__save-pill-dot" />Autosaved · v{headerMeta.workbookVersion}</span>
      <button type="button" className="posnav__btn" aria-label="History"><POSIcon.History /></button>
      <button type="button" className="posw__mobile-toggle" onClick={onToggleDock} aria-label="Open conformance"><POSIcon.Eye /> Conformance</button>
    </div>
  </header>;
}

function Rail({ current, setCurrent, mobileOpen, persona }: { current: string; setCurrent: (id: string) => void; mobileOpen: boolean; persona: SeismicPraPersona }): JSX.Element {
  const activeIndex = Math.max(0, STEPS.findIndex((step) => step.id === current));
  const visible = persona === "preparer"
    ? STEPS
    : STEPS.filter((step) =>
      step.id !== "draft" || persona === "reviewer");
  return <aside className={`posw__rail srail${mobileOpen ? " posw__rail--mobile-open" : ""}`}>
    <div className="posrail__head"><span className="posrail__eyebrow">{persona === "preparer" ? "Workspace Progress" : `${persona} view`}</span><div className="posrail__progress"><span className="posrail__progress-num">{activeIndex + 1}</span><span className="posrail__progress-total">/ {STEPS.length} steps</span></div><div className="posrail__bar"><div className="posrail__bar-fill" style={{ width: `${((activeIndex + 1) / STEPS.length) * 100}%` }} /></div></div>
    <ul className="posrail__list">{visible.map((step) => <li key={step.id}><button type="button" onClick={() => setCurrent(step.id)} className={`posrail__step${current === step.id ? " posrail__step--active" : ""}`}><span className="posrail__step-num">{step.num}</span><span className="posrail__step-label"><span className={`ssubbadge ssubbadge--${step.subelement.toLowerCase()}`}>{step.subelement === "INTEGRATED" ? "ALL" : step.subelement === "WORKFLOW" ? "WF" : step.subelement}</span><span className="srail__step-name">{step.label}</span>{step.hlr !== undefined && <small className="posrail__step-sub">HLR {step.hlr}</small>}</span></button></li>)}</ul>
    <div className="posrail__footer">
      <button type="button" className="posrail__footer-btn"><POSIcon.Layers /> Show all inputs</button>
      <button type="button" className="posrail__footer-btn"><POSIcon.Settings /> Workbook settings</button>
    </div>
  </aside>;
}

function ConformanceDock({ mobileOpen, onClose }: { mobileOpen: boolean; onClose: () => void }): JSX.Element {
  const { mef } = useSeismicPraWorkbook();
  const items = useMemo(() => seismicConformanceItems(mef), [mef]);
  const sections = useMemo(() => groupSeismicConformance(items), [items]);
  const score = useMemo(() => seismicConformanceScore(items), [items]);
  const dashTotal = 99.9;
  const dash = (score.percent * dashTotal) / 100;

  return <aside className={`posw__dock sdock${mobileOpen ? " posw__dock--mobile-open" : ""}`} aria-label="Conformance checklist">
    <div className="posdock__head">
      <div className="posdock__title-row">
        <h2 className="posdock__title">Conformance</h2>
        <button type="button" className="posdock__close" onClick={onClose} aria-label="Hide checklist"><POSIcon.Close /></button>
      </div>
      <div className="posdock__gauge">
        <div className="posdock__gauge-circle">
          <svg viewBox="0 0 36 36">
            <circle cx="18" cy="18" r="15.9" fill="none" strokeWidth="3.2" className="posdock__gauge-track" />
            <circle cx="18" cy="18" r="15.9" fill="none" strokeWidth="3.2" className="posdock__gauge-fill" strokeDasharray={`${dash} ${dashTotal}`} strokeLinecap="round" transform="rotate(-90, 18, 18)" />
            <text x="18" y="18" className="posdock__gauge-text">{score.percent}%</text>
          </svg>
        </div>
        <div className="posdock__gauge-meta">
          <span className="posdock__gauge-summary">
            {score.met} of {score.applicable} ready
          </span>
          <span className="posdock__gauge-detail">
            {score.warn} attention
            {score.blocked > 0 && <> · {score.blocked} blocked</>}
            {" · "}{score.na} N/A
          </span>
        </div>
      </div>
    </div>
    <div className="posdock__body">
      {sections.map(([sectionName, sectionItems]) => <div key={sectionName}>
        <div className="posdock__section-head">
          {sectionName}
          <span className="posdock__section-head-count">{sectionItems.filter((item) => item.status === "ok").length} / {sectionItems.filter((item) => item.status !== "na").length}</span>
        </div>
        {sectionItems.map((item) => <div key={item.id} className={`posdock__item posdock__item--${item.status}`}>
          <span className="posdock__item-dot" />
          <span className="posdock__item-text">{item.text}</span>
        </div>)}
      </div>)}
    </div>
  </aside>;
}

function Screen({ id, actions, renderApprovalTable, renderSignCard, renderRoster }: { id: string; actions?: WorkflowActions; renderApprovalTable?: () => ReactNode; renderSignCard?: () => ReactNode; renderRoster?: () => ReactNode }): JSX.Element {
  switch (id) {
    case "scope": return <ScopeScreen />;
    case "hazard-basis": return <EvidenceBaseScreen />;
    case "earth-science": return <BaselinePraScreen />;
    case "sources-motion": return <InitialSelScreen />;
    case "site-response": return <SiteHazardModelScreen />;
    case "hazard-results": return <SelResponseScreen />;
    case "secondary-hazards": return <PlantConfigurationScreen />;
    case "sel-response": return <FragilityDevelopmentScreen />;
    case "thresholds": return <PlantResponseModelScreen />;
    case "fragility-results": return <HumanReliabilityScreen />;
    case "plant-model": return <AnnualRiskQuantificationScreen />;
    case "human-reliability": return <RiskInterpretationScreen />;
    case "quantification": return <RiskIntegrationBaselineScreen />;
    case "draft": return <DraftScreen actions={actions} />;
    case "review": return <ReviewScreen actions={actions} renderRoster={renderRoster} />;
    case "approval": return <ApprovalScreen renderApprovalTable={renderApprovalTable} renderSignCard={renderSignCard} />;
    default: return <ScopeScreen />;
  }
}

interface SeismicPraWorkbenchProps {
  persona: SeismicPraPersona;
  setPersona: (persona: SeismicPraPersona) => void;
  availablePersonas?: SeismicPraPersona[];
  showPersonaPicker?: boolean;
  onOpenRoles?: () => void;
  onLoadExample?: () => void;
  onUnloadExample?: () => void;
  headerMeta: HeaderMeta;
  actions?: WorkflowActions;
  renderDocuments?: () => ReactNode;
  renderApprovalTable?: () => ReactNode;
  renderSignCard?: () => ReactNode;
  renderRoster?: () => ReactNode;
  exampleOptions?: { id: string; label: string }[];
  selectedExample?: string;
  onSelectExample?: (id: string) => void;
}

function SeismicPraWorkbench({ persona, setPersona, availablePersonas = ["preparer", "reviewer", "approver"], showPersonaPicker = true, onOpenRoles, onLoadExample, onUnloadExample, headerMeta, actions, renderApprovalTable, renderSignCard, renderRoster, exampleOptions, selectedExample, onSelectExample }: SeismicPraWorkbenchProps): JSX.Element {
  const [stepId, setStepId] = useState(
    persona === "reviewer"
      ? "review"
      : persona === "approver"
        ? "approval"
        : "scope",
  );
  const [railOpen, setRailOpen] = useState(false);
  const [dockOpen, setDockOpen] = useState(true);
  const active = STEPS.find((step) => step.id === stepId) ?? STEPS[0];
  const index = STEPS.indexOf(active);
  const previous = STEPS[index - 1];
  const next = STEPS[index + 1];
  function choose(id: string): void {
    setStepId(id);
    setRailOpen(false);
    window.scrollTo(0, 0);
  }
  return <div className={`posw sw${dockOpen ? "" : " sw--dock-closed"}`}>
    <Header persona={persona} setPersona={setPersona} availablePersonas={availablePersonas} showPersonaPicker={showPersonaPicker} onOpenRoles={onOpenRoles} onLoadExample={onLoadExample} onUnloadExample={onUnloadExample} headerMeta={headerMeta} onToggleRail={() => setRailOpen((value) => !value)} onToggleDock={() => setDockOpen((value) => !value)} exampleOptions={exampleOptions} selectedExample={selectedExample} onSelectExample={onSelectExample} />
    <Rail current={stepId} setCurrent={choose} mobileOpen={railOpen} persona={persona} />
    <main className="posmain smain"><div className="smain__head"><div><div className="smain__title"><h1>{active.title}</h1><InfoButton label={`About ${active.title}`}>{composeWorkbookCue("SEISMIC", active.title, active.subtitle)}</InfoButton></div></div><div className="posmain__actions">{!dockOpen && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => setDockOpen(true)}><POSIcon.Eye /> Show conformance</button>}</div></div><div className="smain__body"><Screen id={stepId} actions={actions} renderApprovalTable={renderApprovalTable} renderSignCard={renderSignCard} renderRoster={renderRoster} /></div><nav className="smain__nav">{previous !== undefined ? <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => choose(previous.id)}><POSIcon.ArrowL /> {previous.label}</button> : <span />}{next !== undefined ? <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={() => choose(next.id)}>Next: {next.label} <POSIcon.ArrowR /></button> : <span />}</nav></main>
    {dockOpen && <ConformanceDock mobileOpen={dockOpen} onClose={() => setDockOpen(false)} />}
  </div>;
}

export { SeismicPraWorkbench, type SeismicPraPersona, type SeismicPraWorkbenchProps };
