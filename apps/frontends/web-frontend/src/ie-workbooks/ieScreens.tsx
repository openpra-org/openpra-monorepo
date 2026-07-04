import { Fragment, JSX, useMemo, useState, useEffect } from "react";
import {
  InitiatingEventCategory,
  type InitiatorDefinition,
  type InitiatingEventGroup,
  type InitiatingEventFrequencyQuantification,
  type FrequencyDataSource,
  type InitiatingEventScreeningRecord,
  type HazardAnalysis,
} from "interfaces-mef-types/ie/initiating-event-analysis";
import { type Frequency, type FrequencyWithDistribution } from "interfaces-mef-types/core/events";
import { ScreeningStatus } from "interfaces-mef-types/core/shared-patterns";
import { IEIcon } from "./ieIcons";
import { Badge } from "./ieShared";
import { useIeWorkbook } from "./ieWorkbookContext";
import { CAPABILITY_CATEGORIES, CATEGORY_COLORS, INITIATOR_CATEGORIES, categoryById, methodSpec, COMPLETENESS_CHECK_META, type CapabilityCategory, type Stage } from "./ieViewData";
import { type CcScore } from "./ieSelectors";
import { FaultTreeEditor } from "../newly-developed-methods/fault-tree/faultTreeEditor";
import { type FtInputNode } from "../newly-developed-methods/fault-tree/faultTreeTypes";
import { mldToFaultTree, hbftToFaultTree } from "./faultTreeAdapters";
import { WorksheetEditor } from "../newly-developed-methods/worksheet/worksheetEditor";
import { PhaEditor } from "../newly-developed-methods/process-hazard-analysis/phaEditor";
import { OperatingExperienceEditor } from "../newly-developed-methods/operating-experience/operatingExperienceEditor";
import { GenericCatalogueEditor } from "../newly-developed-methods/generic-catalogue/genericCatalogueEditor";
import { buildWorksheetModel, buildPhaModel, buildOeModel, buildCatalogueModel } from "./methodEditorAdapters";
import { IeFrequencyQuantificationEditor } from "../newly-developed-methods/ie-frequency-quantification/ieFrequencyQuantificationEditor";
import { generateIeReport, computeIeReportToc } from "./ieDocx";
import { AutoTextarea } from "./ieDrawer";

const EDITOR_METHOD_IDS = new Set(["MLD", "HBFT", "FMEA", "HAZOP", "PHA", "OEREV", "GENLIST"]);

function freqValue(f: Frequency | FrequencyWithDistribution): number {
  return typeof f === "number" ? f : f.value;
}

function fmtFreq(f: Frequency | FrequencyWithDistribution | undefined): string {
  if (f === undefined) return "—";
  const v = freqValue(f);
  if (!isFinite(v) || v <= 0) return "—";
  const exp = Math.floor(Math.log10(v));
  const mantissa = v / Math.pow(10, exp);
  const sign = exp < 0 ? "-" : "+";
  return `${mantissa.toFixed(1)}E${sign}${String(Math.abs(exp)).padStart(2, "0")}`;
}

const LOG_MIN = -6.5;
const LOG_MAX = 0.6;

function freqToPct(v: number): number {
  if (!isFinite(v) || v <= 0) return 0;
  const l = Math.log10(v);
  return Math.max(2, Math.min(100, ((l - LOG_MIN) / (LOG_MAX - LOG_MIN)) * 100));
}

const BASIS_LABEL: Record<string, string> = {
  OPERATING_DATA: "Operating data",
  GENERIC_DATA: "Generic data",
  SIMILAR_PLANT_DATA: "Similar-plant",
  DESIGN_BASED: "Design-based",
  FAULT_TREE: "Fault tree",
};

function nextHazardId(hazards: HazardAnalysis[]): string {
  let max = 0;
  for (const h of hazards) {
    if (h.uuid.startsWith("HAZ-")) {
      const n = Number(h.uuid.slice(4));
      if (!Number.isNaN(n) && n > max) max = n;
    }
  }
  return `HAZ-${max + 1}`;
}

function hazardStatusKind(h: HazardAnalysis): "ok" | "draft" | "warn" {
  if (h.screeningStatus === "SCREENED_OUT") return "draft";
  if (h.screeningStatus === "RETAINED") return "ok";
  return "warn";
}

function hazardStatusLabel(h: HazardAnalysis): string {
  if (h.screeningStatus === "SCREENED_OUT") return "Screened";
  if (h.screeningStatus === "RETAINED") return "Ready";
  return "Draft";
}

function DispositionChip({ status }: { status: string }): JSX.Element {
  if (status === "RETAINED") return <span className="poschip poschip--ok-soft">Retained</span>;
  if (status === "MERGED") return <span className="poschip">Grouped</span>;
  if (status === "SCREENED_OUT") return <span className="poschip poschip--muted">Screened out</span>;
  return <span className="poschip">{status}</span>;
}

interface ScreenProps {
  ccId: string;
  setCcId: (id: string) => void;
  onAction: (msg: string) => void;
}

interface EnrichedSource {
  baseName: string;
  state: string;
  note: string;
  barriers: string[];
  mechCount: number;
}

const SOURCE_ENRICHMENT: Record<string, { state: string; note: string; barriers: string[] }> = {
  "in-core fuel": {
    state: "Operating + decay",
    note: "Mixed-oxide SFR fuel, primary in-vessel inventory.",
    barriers: ["Cladding", "Primary boundary", "Containment"],
  },
  "cover-gas argon": {
    state: "Activated",
    note: "Ex-core activated gas, a non-LWR-specific mobile source.",
    barriers: ["Cover-gas boundary", "Containment"],
  },
  "spent fuel": {
    state: "Decay",
    note: "Tracked during refuelling and storage states (POS-05/06).",
    barriers: ["Cladding", "Storage cover gas"],
  },
};

function sourceBaseName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed.endsWith(")")) return trimmed;
  const open = trimmed.lastIndexOf(" (");
  return open === -1 ? trimmed : trimmed.slice(0, open).trim();
}

function formatSourceLocation(location: string): string {
  if (location === "IN_CORE") return "In-core";
  if (location === "EX_CORE") return "Ex-core";
  return location;
}

function buildEnrichedSources(rawSources: { id: string; name: string; location: string; barriers: string[] }[], initiators: InitiatorDefinition[]): EnrichedSource[] {
  const seen = new Set<string>();
  const out: EnrichedSource[] = [];
  for (const s of rawSources) {
    const base = sourceBaseName(s.name);
    const key = base.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const enrichKey = Object.keys(SOURCE_ENRICHMENT).find((k) => key.includes(k));
    const enrich = enrichKey !== undefined ? SOURCE_ENRICHMENT[enrichKey] : undefined;
    const barriers = enrich?.barriers ?? s.barriers;
    const mechCount = initiators.filter((init) =>
      init.barrierImpacts.some((bi) => barriers.some((b) => b.toLowerCase().includes(bi.barrierId.toLowerCase())))
    ).length;
    out.push({ baseName: base, state: enrich?.state ?? s.location, note: enrich?.note ?? "", barriers, mechCount });
  }
  return out;
}

interface ScopeScreenProps extends ScreenProps {
  stage: Stage;
  setStage: (s: Stage) => void;
  onOpenLink: () => void;
}

interface IfaceLane {
  code: string;
  element: string;
  role: string;
  direction: "in" | "out";
  columns: string[];
  empty: string;
  rows: { id: string; name: string; values: string[] }[];
}

function ScopeScreen({ ccId, setCcId, stage, setStage, onOpenLink }: ScopeScreenProps): JSX.Element {
  const { ie, posLink, editable, mutateIe } = useIeWorkbook();
  const linked = posLink.linkedPosWorkbookId !== null;
  const cc = CAPABILITY_CATEGORIES.find((c) => c.id === ccId) ?? CAPABILITY_CATEGORIES[0];

  const numberOfModules = ie.metadata.plantIdentity?.numberOfModules ?? 1;
  const siteConfig: "single" | "multi" = numberOfModules > 1 ? "multi" : "single";
  const setModules = (n: number): void => {
    mutateIe((draft) => {
      const pi = draft.metadata.plantIdentity;
      if (pi === undefined) return draft;
      return { ...draft, metadata: { ...draft.metadata, plantIdentity: { ...pi, numberOfModules: n } } };
    });
  };
  const [selectedTe, setSelectedTe] = useState<string | null>(null);

  const multiUnitText = siteConfig === "single" ? "Not applicable" : "In scope";
  const totalStateHours = posLink.states.reduce((acc, s) => acc + s.meanDurationHours, 0);

  const ifaceLanes = useMemo<IfaceLane[]>(() => {
    const fmtDur = (h: number): string => (h >= 8760 ? `${(h / 8760).toFixed(1)} yr` : `${Math.round(h)} h`);
    const qBasis = new Map(ie.quantifications.map((q) => [q.initiatorOrGroupId, q.basis]));
    const groups = ie.initiatingEventGroups;
    const seenSource = new Set<string>();
    const uniqueSources = posLink.sources.filter((s) => {
      const key = sourceBaseName(s.name).toLowerCase();
      if (seenSource.has(key)) return false;
      seenSource.add(key);
      return true;
    });
    return [
      {
        code: "POS", element: "Plant Operating States", role: "Operating states", direction: "in",
        columns: ["State", "Mode", "Entry frequency", "Duration", "Time fraction", "Initiators applicable"], empty: "No linked POS workbook.",
        rows: posLink.states.map((s) => ({
          id: s.id,
          name: s.name,
          values: [
            s.operatingMode,
            s.meanEntryFrequency === 0 && s.operatingMode === "POWER" ? "Base state" : fmtFreq(s.meanEntryFrequency),
            fmtDur(s.meanDurationHours),
            totalStateHours > 0 ? `${((s.meanDurationHours / totalStateHours) * 100).toFixed(1)} %` : "—",
            String(ie.initiators.filter((i) => i.applicableStates.includes(s.id)).length),
          ],
        })),
      },
      {
        code: "MS", element: "Mechanistic Source Term", role: "Sources & barriers", direction: "in",
        columns: ["Source", "Location", "Barriers"], empty: "No linked sources.",
        rows: uniqueSources.map((s) => ({ id: s.id, name: sourceBaseName(s.name), values: [formatSourceLocation(s.location), s.barriers.join(" · ")] })),
      },
      {
        code: "ES", element: "Event Sequence Analysis", role: "Initiating events", direction: "out",
        columns: ["Group", "Members", "Bounding", "States"], empty: "No initiating-event groups yet.",
        rows: groups.map((g) => ({ id: g.uuid, name: g.name, values: [String(g.memberInitiatorIds.length), g.boundingInitiatorId, String(g.applicableStates.length)] })),
      },
      {
        code: "ESQ", element: "Event Sequence Quantification", role: "Frequencies", direction: "out",
        columns: ["Group", "Mean (per plant-yr)", "Risk"], empty: "No quantifications yet.",
        rows: groups.map((g) => ({ id: g.uuid, name: g.name, values: [fmtFreq(g.meanFrequency), g.riskImportance ?? "—"] })),
      },
      {
        code: "HR", element: "Human Reliability", role: "Support fault trees", direction: "out",
        columns: ["Group", "Members", "Bounding"], empty: "No fault-tree groups.",
        rows: groups.filter((g) => qBasis.get(g.uuid) === "FAULT_TREE").map((g) => ({ id: g.uuid, name: g.name, values: [String(g.memberInitiatorIds.length), g.boundingInitiatorId] })),
      },
      {
        code: "SC", element: "Success Criteria", role: "Challenges", direction: "out",
        columns: ["Group", "Challenged safety functions"], empty: "No groups yet.",
        rows: groups.map((g) => ({ id: g.uuid, name: g.name, values: [g.challengedSafetyFunctions.join(" · ")] })),
      },
    ];
  }, [ie, posLink, totalStateHours]);
  const selectedIfaceLane = ifaceLanes.find((l) => l.code === selectedTe);

  return (
    <>
      {/* ── Interfaces ── */}
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Interfaces</h3>
        </div>
        <p className="poscard__sub">What flows into the initiating-event analysis, and what it feeds. Select an element to see the data exchanged.</p>
        <div className="poshandoff__grid">
          {ifaceLanes.map((lane) => (
            <button
              key={lane.code}
              type="button"
              className={`poshandoff__tile${selectedTe === lane.code ? " poshandoff__tile--active" : ""}`}
              onClick={() => setSelectedTe(selectedTe === lane.code ? null : lane.code)}
            >
              <span className="poshandoff__tile-code">{lane.code}</span>
              <span className="poshandoff__tile-name">{lane.element}</span>
              <span className="poshandoff__tile-role">{lane.direction === "in" ? "Provides · " : "Consumes · "}{lane.role}</span>
            </button>
          ))}
        </div>
        {selectedIfaceLane !== undefined && (
          <div style={{ marginTop: 16 }}>
            <div className="possubtle" style={{ fontWeight: 700, color: "var(--color-text)", marginBottom: 8 }}>
              {selectedIfaceLane.direction === "in"
                ? `Initiating Events receives ${selectedIfaceLane.role.toLowerCase()} from ${selectedIfaceLane.element}`
                : `${selectedIfaceLane.element} receives ${selectedIfaceLane.role.toLowerCase()} from Initiating Events`}
            </div>
            {selectedIfaceLane.code === "POS" && totalStateHours > 0 && (
              <>
                <div className="ietimebar" role="img" aria-label="Time fraction by operating state" style={{ marginBottom: 10 }}>
                  {posLink.states.map((s) => {
                    const pct = (s.meanDurationHours / totalStateHours) * 100;
                    const atP = s.operatingMode === "POWER";
                    return (
                      <div key={s.id} className={`ietimebar__seg${atP ? " ietimebar__seg--power" : ""}`} style={{ width: `${pct}%` }} title={`${s.id} · ${pct.toFixed(1)}%`}>
                        {pct > 7 && <span className="ietimebar__seg-label">{pct.toFixed(1)}%</span>}
                      </div>
                    );
                  })}
                </div>
                <div className="ietimebar__legend" style={{ marginBottom: 14 }}>
                  <span><span className="ietimebar__key ietimebar__key--power" /> At-power</span>
                  <span><span className="ietimebar__key" /> Low-power &amp; shutdown</span>
                </div>
              </>
            )}
            {selectedIfaceLane.rows.length === 0 ? (
              <p className="posmuted" style={{ margin: 0 }}>{selectedIfaceLane.empty}</p>
            ) : (
              <table className="postable postable--mid">
                <thead>
                  <tr>{selectedIfaceLane.columns.map((c) => <th key={c}>{c}</th>)}</tr>
                </thead>
                <tbody>
                  {selectedIfaceLane.rows.map((r) => (
                    <tr key={r.id}>
                      <td><div className="postable__name">{r.name}</div></td>
                      {r.values.map((v, idx) => <td key={selectedIfaceLane.columns[idx + 1] ?? `c${idx}`} className="mono">{v}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* ── Scope card ── */}
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Scope of this Initiating Event Analysis</h3>
          {linked ? <Badge kind="ok">Synced from POS</Badge> : <Badge kind="warn">Not linked to POS</Badge>}
        </div>
        <p className="poscard__sub">
          {linked
            ? "Fields marked POS are inherited from the linked workbook. Switch to Manual to override."
            : "No POS workbook linked yet. Fill fields manually, or link a POS workbook to inherit plant data."}
        </p>
        <div className="iefield-grid iefield-grid--3">

          {/* Site configuration */}
          <div className="iefield">
            <label className="iefield__label" htmlFor="ie-scope-site">Site configuration</label>
            <select id="ie-scope-site" className="iefield__select" value={siteConfig} disabled={!editable} onChange={(e) => setModules(e.target.value === "multi" ? Math.max(2, numberOfModules) : 1)}>
              <option value="single">Single-unit site</option>
              <option value="multi">Multi-unit site</option>
            </select>
          </div>

          {/* Units at site */}
          <div className="iefield">
            <label className="iefield__label" htmlFor="ie-scope-units">Units at site</label>
            {siteConfig === "single"
              ? <input id="ie-scope-units" className="iefield__input iefield__input--locked" value="1" readOnly />
              : <input id="ie-scope-units" className="iefield__input" type="number" min="2" max="6" value={numberOfModules} disabled={!editable} onChange={(e) => { const n = Number(e.target.value); if (Number.isFinite(n) && n >= 2) setModules(Math.min(6, Math.round(n))); }} />}
          </div>

          {/* Multi-unit IE-A16 */}
          <div className="iefield">
            <label className="iefield__label">Multi-unit initiating events (IE-A16)</label>
            <input className="iefield__input iefield__input--locked" value={multiUnitText} readOnly />
          </div>

        </div>

        {!linked && (
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--color-border)", display: "flex", alignItems: "center", gap: 12 }}>
            <p className="possubtle" style={{ margin: 0, fontSize: 12.5 }}>Link a POS workbook to inherit plant identity, operating states, and radioactive sources.</p>
            <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={onOpenLink}>
              <IEIcon.Link /> Link POS workbook
            </button>
          </div>
        )}
      </div>

      {/* ── Sources of radioactive material ── */}
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Sources of radioactive material</h3>
          {!linked && (
            <button type="button" className="posnav__btn posnav__btn--sm" onClick={onOpenLink}>
              <IEIcon.Download /> Import sources from POS
            </button>
          )}
        </div>
        <p className="poscard__sub">For every radioactive source, IE identifies the mechanisms by which an initiating event could mobilise it past its barriers.</p>
        {posLink.sources.length === 0 ? (
          <p className="posmuted" style={{ margin: 0 }}>No sources yet. Link a POS workbook or add sources manually.</p>
        ) : (
          <table className="postable iesrc-table">
            <thead>
              <tr>
                <th><div className="iesrc-th">Source <span className="ieprov ieprov--sm">POS-A3</span></div></th>
                <th><div className="iesrc-th">Barriers <span className="ieprov ieprov--sm">POS-A3</span></div></th>
                <th><div className="iesrc-th">Escape mechanisms <span className="ieprov ieprov--ie ieprov--sm">IE-A2</span></div></th>
              </tr>
            </thead>
            <tbody>
              {buildEnrichedSources(posLink.sources, ie.initiators).map((s) => (
                <tr key={s.baseName}>
                  <td>
                    <div className="postable__name">{s.baseName}</div>
                  </td>
                  <td><div className="iesrc__chips">{s.barriers.map((b, i) => <span key={i} className="poschip">{b}</span>)}</div></td>
                  <td>
                    {s.mechCount > 0
                      ? <><span className="iesrc__mech-n">{s.mechCount}</span> <span className="iesrc__mech-cap">identified</span></>
                      : <span className="possubtle">None identified</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Capability category ── */}
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Capability category</h3>
          <Badge kind="progress">{cc.tag}</Badge>
        </div>
        <p className="poscard__sub">Sets how rigorous the search, grouping, and quantification must be.</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 4 }}>
          {CAPABILITY_CATEGORIES.map((c) => {
            const active = c.id === ccId;
            return (
              <button key={c.id} type="button" className="poscard" onClick={() => setCcId(c.id)}
                style={{ textAlign: "left", cursor: "pointer", borderColor: active ? "var(--color-primary)" : undefined, boxShadow: active ? "0 0 0 3px var(--color-primary-focus)" : undefined, padding: 14 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontFamily: "'Literata', serif", fontWeight: 700, fontSize: 16, color: "var(--color-text)" }}>{c.name}</span>
                  <span className="possubtle" style={{ fontSize: 12 }}>{c.tag}</span>
                </div>
                <div className="possubtle">{c.description}</div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Plant stage ── */}
      <div className="poscard">
        <div className="poscard__head"><h3 className="poscard__title">Plant stage</h3></div>
        <div className="posrow posrow--wrap" style={{ gap: 12 }}>
          {([
            ["pre_operational", "Pre-operational", "Frequencies from generic, design-based, and similar-plant sources (IE-C2). No plant-specific operating history yet."],
            ["operational", "Operational", "Plant-specific initiating-event history available; Bayesian-updated frequencies applicable (IE-C1/C6)."],
          ] as [Stage, string, string][]).map(([val, title, body]) => (
            <label
              key={val}
              className="poscard poscard--ghost"
              style={{ flex: 1, minWidth: 260, cursor: "pointer", borderColor: stage === val ? "var(--color-primary)" : undefined, boxShadow: stage === val ? "0 0 0 3px var(--color-primary-focus)" : undefined }}
            >
              <div className="posrow" style={{ alignItems: "flex-start", gap: 12 }}>
                <input type="radio" name="ie-plant-stage" value={val} checked={stage === val} onChange={() => setStage(val)} />
                <div>
                  <div style={{ fontWeight: 700, color: "var(--color-text)", fontSize: 14, marginBottom: 4 }}>{title}</div>
                  <div className="possubtle" style={{ fontSize: 12.5, lineHeight: 1.5 }}>{body}</div>
                </div>
              </div>
            </label>
          ))}
        </div>
      </div>
    </>
  );
}

const METHOD_ROLE_LABEL: Record<string, string> = {
  DEDUCTIVE: "Top-down",
  INDUCTIVE: "Bottom-up",
  EXPERIENCE: "Experience",
  CATALOGUE: "Catalogue",
};

function MethodsScreen(): JSX.Element {
  const { ie } = useIeWorkbook();
  const methods = ie.searchMethods ?? [];
  const [openMethodId, setOpenMethodId] = useState<string | null>(null);
  const [treeTitleOverride, setTreeTitleOverride] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const openMethod = methods.find((m) => m.id === openMethodId) ?? null;
  const openEditor = (id: string): void => { setOpenMethodId(id); setTreeTitleOverride(null); setEditingTitle(false); };
  const treeTitle = treeTitleOverride ?? (openMethod !== null ? `${ie.name} — ${openMethod.id}` : "");
  const ftNodes = useMemo<FtInputNode[]>(() => {
    if (openMethod === null) return [];
    if (openMethod.id === "MLD") {
      const mld = (ie.masterLogicDiagrams ?? [])[0];
      return mld !== undefined ? mldToFaultTree(mld) : [];
    }
    if (openMethod.id === "HBFT") return hbftToFaultTree(ie.heatBalanceFaultTrees ?? []);
    return [];
  }, [openMethod, ie.masterLogicDiagrams, ie.heatBalanceFaultTrees]);
  const worksheetModel = useMemo(
    () => buildWorksheetModel((ie.failureModesAnalyses ?? [])[0], (ie.hazardOperabilityStudies ?? [])[0]),
    [ie.failureModesAnalyses, ie.hazardOperabilityStudies],
  );
  const phaModel = useMemo(() => {
    const pha = (ie.processHazardAnalyses ?? [])[0];
    return pha !== undefined ? buildPhaModel(pha, ie.failureModesAnalyses ?? [], ie.hazardOperabilityStudies ?? []) : null;
  }, [ie.processHazardAnalyses, ie.failureModesAnalyses, ie.hazardOperabilityStudies]);
  const oeModel = useMemo(() => {
    const oe = (ie.operatingExperienceReviews ?? [])[0];
    return oe !== undefined ? buildOeModel(oe) : null;
  }, [ie.operatingExperienceReviews]);
  const catModel = useMemo(() => {
    const cat = (ie.genericInitiatorCatalogues ?? [])[0];
    return cat !== undefined ? buildCatalogueModel(cat) : null;
  }, [ie.genericInitiatorCatalogues]);
  useEffect(() => {
    if (openMethod === null) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [openMethod]);
  const renderEditor = (): JSX.Element | null => {
    if (openMethod === null) return null;
    switch (openMethod.id) {
      case "MLD":
      case "HBFT":
        return <FaultTreeEditor key={openMethod.id} nodes={ftNodes} flavor={openMethod.id === "HBFT" ? "heat" : "logic"} />;
      case "FMEA":
      case "HAZOP":
        return <WorksheetEditor key={openMethod.id} model={worksheetModel} mode={openMethod.id === "HAZOP" ? "hazop" : "fmea"} />;
      case "PHA":
        return phaModel !== null ? <PhaEditor model={phaModel} /> : <div className="iee-empty">No process-hazard-analysis record yet.</div>;
      case "OEREV":
        return oeModel !== null ? <OperatingExperienceEditor model={oeModel} /> : <div className="iee-empty">No operating-experience review recorded yet.</div>;
      case "GENLIST":
        return catModel !== null ? <GenericCatalogueEditor model={catModel} /> : <div className="iee-empty">No generic catalogue recorded yet.</div>;
      default:
        return null;
    }
  };
  return (
    <>
      <div className="poscard">
        <div className="poscard__head"><h3 className="poscard__title">Systematic search methods</h3></div>
        {methods.length === 0 ? <p className="posmuted" style={{ margin: 0 }}>No methods recorded yet.</p> : (
          <div className="iemethod-grid">
            {methods.map((m) => {
              const Ico = IEIcon[methodSpec(m.id).icon as keyof typeof IEIcon] ?? IEIcon.Network;
              const count = ie.initiators.filter((i) => i.identificationMethodIds.includes(m.id)).length;
              const hasEditor = EDITOR_METHOD_IDS.has(m.id);
              return (
                <div key={m.id} className="iemethod">
                  <div className="iemethod__head">
                    <span className="iemethod__icon"><Ico /></span>
                    <div className="iemethod__title-block">
                      <div className="iemethod__name">{m.name}</div>
                    </div>
                    <Badge kind="ok">{METHOD_ROLE_LABEL[m.role] ?? m.role}</Badge>
                  </div>
                  <div className="iemethod__foot">
                    <div className="iemethod__cats">
                      {m.coverageCategories.map((c) => (
                        <span key={c} className="poschip">{categoryById(c)?.label ?? c}</span>
                      ))}
                    </div>
                    <span className="posmono possubtle iemethod__count">{count} initiators</span>
                  </div>
                  {hasEditor && (
                    <div className="iemethod__open-row">
                      <button type="button" className="iemethod__open" onClick={() => openEditor(m.id)}>
                        Open {m.id} <span className="iemethod__open-arrow">→</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
      {openMethod !== null && (
        <div className="ftspace">
          <div className="ftspace__head">
            <button type="button" className="ftspace__back" onClick={() => setOpenMethodId(null)}>
              <span className="ftspace__back-arrow">←</span> Back to workbook
            </button>
            <div className="ftspace__titlewrap">
              {editingTitle ? (
                <input
                  className="ftspace__title-input"
                  value={treeTitle}
                  onChange={(e) => setTreeTitleOverride(e.target.value)}
                  onBlur={() => setEditingTitle(false)}
                  onKeyDown={(e) => { if (e.key === "Enter") setEditingTitle(false); }}
                  autoFocus
                />
              ) : (
                <>
                  <span className="ftspace__title">{treeTitle}</span>
                  <button type="button" className="ftspace__title-edit" aria-label="Rename fault tree" onClick={() => setEditingTitle(true)}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
                  </button>
                </>
              )}
            </div>
          </div>
          <div className="ftspace__body">
            {renderEditor()}
          </div>
        </div>
      )}
    </>
  );
}

function nextInitiatorId(initiators: InitiatorDefinition[]): string {
  let max = 0;
  for (const i of initiators) {
    if (i.uuid.startsWith("IE-")) {
      const n = Number(i.uuid.slice(3));
      if (!Number.isNaN(n) && n > max) max = n;
    }
  }
  return `IE-${String(max + 1).padStart(2, "0")}`;
}

function IdentifyScreen(): JSX.Element {
  const { ie, editable, mutateIe, openDrawer } = useIeWorkbook();
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const initiators = ie.initiators;
  const shown = activeCat !== null ? initiators.filter((i) => i.category === activeCat) : initiators;
  const total = initiators.length;
  const cat = activeCat !== null ? categoryById(activeCat) : undefined;

  const addInitiator = (): void => {
    const category = (activeCat as InitiatingEventCategory | null) ?? InitiatingEventCategory.TRANSIENT;
    const created: InitiatorDefinition = {
      uuid: nextInitiatorId(initiators),
      name: "New initiator",
      eventType: "INITIATING",
      frequency: 0,
      category,
      applicableStates: [],
      identificationMethodIds: [],
      identificationBasis: [],
      tripParameters: [],
      mitigatingSystems: [],
      barrierImpacts: [],
      challengedSafetyFunctions: [],
      screeningStatus: ScreeningStatus.RETAINED,
      implementsSrs: [],
    };
    mutateIe((draft) => ({ ...draft, initiators: [...draft.initiators, created] }));
    openDrawer({ kind: "initiator", id: created.uuid });
  };

  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Challenge spectrum (IE-A5)</h3>
          <span className="possubtle">Click a category to filter</span>
        </div>
        <p className="poscard__sub">Every challenge category must be considered (IE-A5).</p>
        <div className="iespectrum">
          <div className="iespectrum__bar" role="img" aria-label="Initiating-event challenge spectrum">
            {INITIATOR_CATEGORIES.map((c) => {
              const n = initiators.filter((i) => i.category === c.id).length;
              if (n === 0 || total === 0) return null;
              const isActive = activeCat === c.id;
              return (
                <button key={c.id} type="button"
                  className={`iespectrum__seg${activeCat !== null && !isActive ? " iespectrum__seg--dim" : ""}`}
                  style={{ width: `${(n / total) * 100}%`, background: CATEGORY_COLORS[c.id] }}
                  onClick={() => setActiveCat(isActive ? null : c.id)}
                  title={`${c.label} · ${n}`}>
                  <span className="iespectrum__seg-n">{n}</span>
                </button>
              );
            })}
          </div>
          <div className="iespectrum__legend">
            {INITIATOR_CATEGORIES.map((c) => {
              const n = initiators.filter((i) => i.category === c.id).length;
              const isActive = activeCat === c.id;
              return (
                <button key={c.id} type="button" className={`iespectrum__leg${isActive ? " iespectrum__leg--active" : ""}`} onClick={() => setActiveCat(isActive ? null : c.id)}>
                  <span className="iespectrum__leg-key" style={{ background: CATEGORY_COLORS[c.id] }} />
                  <span className="iespectrum__leg-label">{c.label}</span>
                </button>
              );
            })}
          </div>
        </div>
        {cat !== undefined && (
          <div className="iecat-blurb">
            <div><strong>{cat.label}</strong> <span className="possubtle">— {cat.blurb}</span></div>
          </div>
        )}
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">{cat !== undefined ? cat.label : "All initiators"}<span className="possubtle" style={{ fontWeight: 400 }}> · {shown.length}</span></h3>
          <div className="ieident__head-actions">
            {activeCat !== null && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => setActiveCat(null)}>Clear filter</button>}
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addInitiator}>+ Add initiator</button>}
          </div>
        </div>
        {shown.length === 0 ? <p className="posmuted" style={{ margin: 0 }}>No initiators identified yet.{editable ? " Use Add initiator to start the challenge spectrum." : ""}</p> : (
          <table className="postable">
            <thead><tr><th>Initiator</th><th>Category</th><th>States</th><th>Barrier</th><th>Disposition</th></tr></thead>
            <tbody>
              {shown.map((i) => {
                const c = categoryById(i.category);
                const barrier = i.barrierImpacts[0]?.state ?? "—";
                return (
                  <tr key={i.uuid} className="postable__row--clickable" onClick={() => openDrawer({ kind: "initiator", id: i.uuid })}>
                    <td>
                      <div className="postable__name">
                        <span className="ieident__id">{i.uuid}</span>
                        <span> · {i.name}</span>
                      </div>
                      {(i.preOperationalAssumptions ?? []).length > 0 && <span className="poschip" style={{ marginLeft: 6, fontSize: 11, background: "rgba(184,106,0,0.1)", color: "var(--color-warning)" }}><IEIcon.Warn /> Pre-op</span>}
                    </td>
                    <td><span className="iecat-tag">{c?.label ?? i.category}</span></td>
                    <td className="mono">{i.applicableStates.length}</td>
                    <td><span className={`poschip${barrier === "INTACT" ? "" : " poschip--warn"}`}>{barrier}</span></td>
                    <td><DispositionChip status={i.screeningStatus} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

type CompletenessToggleField =
  | "perSystemSearchPerformed"
  | "perSupportSystemSearchPerformed"
  | "radioactiveSourceMechanismsAddressed"
  | "multiReactorEventsAddressed";

function CompletenessScreen(): JSX.Element {
  const { ie, editable, mutateIe } = useIeWorkbook();
  const cs = ie.completenessSearch;
  const hazardsInScope = ie.includesNonInternalHazardGroups;
  const categoryTarget = hazardsInScope ? 7 : 5;
  const inScopeCategoryIds = INITIATOR_CATEGORIES
    .map((c) => c.id)
    .filter((id) => hazardsInScope || (id !== InitiatingEventCategory.INTERNAL_HAZARD && id !== InitiatingEventCategory.EXTERNAL_HAZARD));
  const coveredCount = inScopeCategoryIds.filter((id) => ie.initiators.some((i) => i.category === id)).length;
  const toggleCheck = (field: CompletenessToggleField): void => {
    mutateIe((draft) => ({ ...draft, completenessSearch: { ...draft.completenessSearch, [field]: !draft.completenessSearch[field] } }));
  };
  const checks: { label: string; ok: boolean; icon: string; detail: string; meta: string; field?: CompletenessToggleField }[] = [
    { label: hazardsInScope ? "All seven functional categories covered" : "All in-scope functional categories covered", ok: coveredCount >= categoryTarget, icon: COMPLETENESS_CHECK_META[0].icon, detail: hazardsInScope ? COMPLETENESS_CHECK_META[0].detail : "Transient · RCB breach · interfacing · special · human-failure. Internal and external hazards are out of scope, carried by the separate hazard analyses.", meta: `${coveredCount} / ${categoryTarget}` },
    { label: "Per-system search performed", ok: cs.perSystemSearchPerformed, ...COMPLETENESS_CHECK_META[1], meta: COMPLETENESS_CHECK_META[1].meta(cs), field: "perSystemSearchPerformed" },
    { label: "Per-support-system search performed", ok: cs.perSupportSystemSearchPerformed, ...COMPLETENESS_CHECK_META[2], meta: COMPLETENESS_CHECK_META[2].meta(cs), field: "perSupportSystemSearchPerformed" },
    { label: "Radioactive-source mechanisms addressed", ok: cs.radioactiveSourceMechanismsAddressed, ...COMPLETENESS_CHECK_META[3], meta: COMPLETENESS_CHECK_META[3].meta(cs), field: "radioactiveSourceMechanismsAddressed" },
    { label: "Multi-reactor / shared-source events addressed", ok: cs.multiReactorEventsAddressed, ...COMPLETENESS_CHECK_META[4], meta: COMPLETENESS_CHECK_META[4].meta(cs), field: "multiReactorEventsAddressed" },
  ];
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Completeness checks</h3>
        </div>
        <p className="poscard__sub">Audits that the forward search was exhaustive, each check mapped to an SR.</p>
        <div className="iecheck-list">
          {checks.map((c, i) => {
            const field = c.field;
            return (
              <div key={i} className={`iecheck iecheck--${c.ok ? "ok" : "warn"}`}>
                <span className="iecheck__num">{i + 1}</span>
                <div className="iecheck__main">
                  <div className="iecheck__label">{c.label}</div>
                  {c.detail.length > 0 && <div className="iecheck__detail">{c.detail}</div>}
                </div>
                <div className="iecheck__right">
                  {c.meta.length > 0 && <span className="iecheck__meta">{c.meta}</span>}
                  {editable && field !== undefined
                    ? <button type="button" className={`iecheck__toggle iecheck__toggle--${c.ok ? "ok" : "warn"}`} onClick={() => toggleCheck(field)} aria-pressed={c.ok} title={c.ok ? "Confirmed · click to clear" : "Not confirmed · click to confirm"}>{c.ok ? <IEIcon.Check /> : <IEIcon.Warn />}</button>
                    : c.ok
                      ? <span className="iecheck__dot iecheck__dot--ok"><IEIcon.Check /></span>
                      : <span className="iecheck__dot iecheck__dot--warn"><IEIcon.Warn /></span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head"><h3 className="poscard__title">Coverage matrix: category × state</h3><span className="possubtle">A dot marks an initiator in that category and state</span></div>
        <div className="iecov">
          <table className="iecov__table">
            <thead>
              <tr><th className="iecov__corner" rowSpan={2}>Category</th><th className="iecov__grouph" colSpan={ie.applicablePlantOperatingStates.length}>Operating state (POS)</th></tr>
              <tr>{ie.applicablePlantOperatingStates.map((s) => <th key={s} className="iecov__colh"><span>{s.replace("POS-", "")}</span></th>)}</tr>
            </thead>
            <tbody>
              {INITIATOR_CATEGORIES.map((cat) => (
                <tr key={cat.id}>
                  <td className="iecov__rowh"><span>{cat.label}</span></td>
                  {ie.applicablePlantOperatingStates.map((s) => {
                    const hit = ie.initiators.some((i) => i.category === cat.id && i.applicableStates.includes(s));
                    return <td key={s} className="iecov__cell">{hit && <span className="iecov__dot" style={{ background: CATEGORY_COLORS[cat.id] }} />}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

function HazardsScreen(): JSX.Element {
  const { ie, editable, mutateIe, openDrawer } = useIeWorkbook();
  const hazards: HazardAnalysis[] = ie.hazardAnalyses ?? [];

  const addHazard = (): void => {
    const created: HazardAnalysis = {
      uuid: nextHazardId(hazards),
      name: "New hazard",
      description: "",
      hazardType: "INTERNAL",
      subcategory: "",
      severityLevels: [],
      affectedAreas: [],
      radionuclideBarrierIds: [],
      inducingMechanisms: [],
      inducedInitiatorIds: [],
      potentialCombinations: [],
      analysisMethods: [],
      screeningStatus: ScreeningStatus.RETAINED,
      screeningBasis: "",
      implementsSrs: [],
    };
    mutateIe((draft) => ({ ...draft, hazardAnalyses: [...(draft.hazardAnalyses ?? []), created] }));
    openDrawer({ kind: "hazard", id: created.uuid });
  };
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Hazard analyses</h3>
          <div className="ieident__head-actions">
            <span className="possubtle">IE-A5(e/f) · IE-A6</span>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addHazard}>+ Add hazard</button>}
          </div>
        </div>
        <p className="poscard__sub">Hazard-induced frequencies are developed in the hazard PRA elements and imported here (IE-N-12). Hazard combinations are recorded per hazard (IE-A6).</p>
        {hazards.length === 0 ? <p className="posmuted" style={{ margin: 0 }}>No hazard analyses recorded yet.{editable ? " Use Add hazard to start." : ""}</p> : (
          <table className="postable ietbl">
            <thead><tr>
              <th style={{ width: "22%" }}>Hazard</th><th style={{ width: "10%" }}>Type</th><th style={{ width: "16%" }}>Subcategory</th><th style={{ width: "12%" }}>Screening</th><th>Induces</th><th style={{ width: "12%" }}>Combinations</th>
            </tr></thead>
            <tbody>
              {hazards.map((h) => (
                <tr key={h.uuid} className="postable__row--clickable" onClick={() => openDrawer({ kind: "hazard", id: h.uuid })}>
                  <td><span className="ietbl__text">{h.name}</span></td>
                  <td><span className="ietbl__text">{h.hazardType === "INTERNAL" ? "Internal" : "External"}</span></td>
                  <td><span className="ietbl__text">{h.subcategory}</span></td>
                  <td><Badge kind={hazardStatusKind(h)}>{hazardStatusLabel(h)}</Badge></td>
                  <td><span className="ietbl__chips">{h.inducedInitiatorIds.map((id) => <span key={id} className="poschip">{id}</span>)}</span></td>
                  <td className="mono">{h.potentialCombinations.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

function nextGroupId(groups: InitiatingEventGroup[]): string {
  let max = 0;
  for (const g of groups) {
    if (g.uuid.startsWith("IEG-")) {
      const n = Number(g.uuid.slice(4));
      if (!Number.isNaN(n) && n > max) max = n;
    }
  }
  return `IEG-${String(max + 1).padStart(2, "0")}`;
}

function GroupingScreen(): JSX.Element {
  const { ie, editable, mutateIe, openDrawer } = useIeWorkbook();
  const groups: InitiatingEventGroup[] = ie.initiatingEventGroups;
  const initiators = ie.initiators;

  const addGroup = (): void => {
    const created: InitiatingEventGroup = {
      uuid: nextGroupId(groups),
      name: "New group",
      description: "",
      memberInitiatorIds: [],
      groupingBasis: "",
      boundingInitiatorId: "",
      similarMitigationRequirements: [],
      groupingDoesNotMaskRiskSignificantSequences: false,
      comparableImpactAcrossMembers: false,
      challengedSafetyFunctions: [],
      applicableStates: [],
      implementsSrs: [],
    };
    mutateIe((draft) => ({ ...draft, initiatingEventGroups: [...draft.initiatingEventGroups, created] }));
    openDrawer({ kind: "group", id: created.uuid });
  };

  return (
    <>
      {editable && <div className="iegroup__toolbar"><button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addGroup}>+ Add group</button></div>}

      {groups.length === 0 ? <div className="poscard"><p className="posmuted" style={{ margin: 0 }}>No groups defined yet.{editable ? " Use Add group to create one." : ""}</p></div> : (
        <div className="iegroup__list">
          {groups.map((g) => {
            const boundingInit = initiators.find((i) => i.uuid === g.boundingInitiatorId);
            return (
              <div key={g.uuid} className="poscard">
                <div className="iegroup__head">
                  <span className="posmono possubtle">{g.uuid}</span>
                  <span className="iegroup__name-text">{g.name}</span>
                  {g.groupingDoesNotMaskRiskSignificantSequences ? <Badge kind="ok">Bounded</Badge> : <Badge kind="warn">Anti-masking open</Badge>}
                  <button type="button" className="posnav__btn posnav__btn--sm" style={{ marginLeft: "auto" }} onClick={() => openDrawer({ kind: "group", id: g.uuid })}>{editable ? "Edit" : "View"}</button>
                </div>
                <div className="iegroup__members" style={{ marginTop: 8 }}>
                  {g.memberInitiatorIds.length === 0 && <span className="possubtle" style={{ fontSize: 12 }}>No members yet</span>}
                  {g.memberInitiatorIds.map((m) => {
                    const init = initiators.find((i) => i.uuid === m);
                    const isBounding = m === g.boundingInitiatorId;
                    return (
                      <span key={m} className={`iegroup__member${isBounding ? " iegroup__member--bounding" : ""}`} title={init?.name ?? m}>
                        <span className="iegroup__member-id">{m}</span>
                      </span>
                    );
                  })}
                </div>
                <div className="possubtle" style={{ fontSize: 12.5, marginTop: 8 }}>
                  {g.boundingInitiatorId.length > 0 ? `Bounding case: ${g.boundingInitiatorId}${boundingInit !== undefined ? ` · ${boundingInit.name}` : ""}` : "No bounding case selected"}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

function ScreeningScreen(): JSX.Element {
  const { ie, editable, mutateIe } = useIeWorkbook();
  const records: InitiatingEventScreeningRecord[] = ie.screeningRecords;
  const groups = ie.initiatingEventGroups;
  const initiators = ie.initiators;
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (id: string): void => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const recordedIds = new Set(records.map((r) => r.initiatorOrGroupId));
  const availableTargets = [
    ...groups.filter((g) => !recordedIds.has(g.uuid)).map((g) => ({ id: g.uuid, label: `${g.uuid} · ${g.name}` })),
    ...initiators.filter((i) => !recordedIds.has(i.uuid)).map((i) => ({ id: i.uuid, label: `${i.uuid} · ${i.name}` })),
  ];

  const targetName = (id: string): string => {
    const g = groups.find((x) => x.uuid === id);
    if (g !== undefined) return g.name;
    return initiators.find((x) => x.uuid === id)?.name ?? "";
  };
  const patchRecord = (id: string, patch: Partial<InitiatingEventScreeningRecord>): void => {
    mutateIe((draft) => ({ ...draft, screeningRecords: draft.screeningRecords.map((r) => (r.initiatorOrGroupId === id ? { ...r, ...patch } : r)) }));
  };
  const changeTarget = (oldId: string, newId: string): void => {
    if (newId === oldId || newId === "") return;
    mutateIe((draft) => {
      if (draft.screeningRecords.some((r) => r.initiatorOrGroupId === newId)) return draft;
      return { ...draft, screeningRecords: draft.screeningRecords.map((r) => (r.initiatorOrGroupId === oldId ? { ...r, initiatorOrGroupId: newId } : r)) };
    });
  };
  const addRecord = (): void => {
    const used = new Set(records.map((r) => r.initiatorOrGroupId));
    const firstFree = [...groups.map((g) => g.uuid), ...initiators.map((i) => i.uuid)].find((id) => !used.has(id));
    if (firstFree === undefined) return;
    const created: InitiatingEventScreeningRecord = {
      initiatorOrGroupId: firstFree,
      retained: true,
      barrierIntegrityPreconditionMet: false,
      justification: "",
      implementsSrs: [],
    };
    mutateIe((draft) => (draft.screeningRecords.some((r) => r.initiatorOrGroupId === firstFree) ? draft : { ...draft, screeningRecords: [...draft.screeningRecords, created] }));
    setExpanded((prev) => new Set(prev).add(firstFree));
  };
  const deleteRecord = (id: string): void => {
    mutateIe((draft) => ({ ...draft, screeningRecords: draft.screeningRecords.filter((r) => r.initiatorOrGroupId !== id) }));
  };

  return (
    <>
      <div className="poscard">
        <div className="poscard__head"><h3 className="poscard__title">The screening gate</h3></div>
        <div className="iegate">
          <div className="iegate__stage"><div className="iegate__stage-num">1</div><div className="iegate__stage-body"><div className="iegate__stage-title">Barrier-integrity precondition (IE-C9a)</div><div className="iegate__stage-sub">Does the event avoid any failure or bypass of a radionuclide transport barrier?</div></div></div>
          <div className="iegate__arrow"><IEIcon.ArrowR /></div>
          <div className="iegate__stage"><div className="iegate__stage-num">2</div><div className="iegate__stage-body"><div className="iegate__stage-title">SCR test (IE-C9b)</div><div className="iegate__stage-sub">Either same impact as a much-higher-frequency event (SCR-1/2), or detected &amp; corrected before a complicated shutdown (SCR-3).</div></div></div>
          <div className="iegate__arrow"><IEIcon.ArrowR /></div>
          <div className="iegate__result"><span className="iegate__result-icon"><IEIcon.Check /></span><span>Eligible to screen</span></div>
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Screening decisions</h3>
          {editable && availableTargets.length > 0 && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addRecord}>+ Add record</button>}
        </div>
        {records.length === 0 ? (
          <p className="posmuted" style={{ margin: 0 }}>No screening decisions recorded yet.{editable ? (availableTargets.length > 0 ? " Use Add record to start." : " Identify initiators (Step 3) or groups (Step 6) first.") : ""}</p>
        ) : (
          <table className="postable postable--expandable postable--mid">
            <thead><tr><th style={{ width: 28 }} /><th>Target</th><th>Disposition</th><th>SCR criterion</th><th>Barrier precondition</th></tr></thead>
            <tbody>
              {records.map((rec) => {
                const id = rec.initiatorOrGroupId;
                const isOpen = expanded.has(id);
                return (
                  <Fragment key={id}>
                    <tr className="postable__row--clickable" onClick={() => toggle(id)}>
                      <td><span className={`postable__expand${isOpen ? " postable__expand--open" : ""}`}><IEIcon.Chevron /></span></td>
                      <td>
                        <div className="postable__name"><span className="posmono">{id}</span></div>
                        <span className="postable__name-sub">{targetName(id)}</span>
                      </td>
                      <td>{rec.retained ? <Badge kind="block">Retained</Badge> : <Badge kind="draft">Screened out</Badge>}</td>
                      <td className="mono">{rec.criterion ?? "—"}</td>
                      <td>{rec.barrierIntegrityPreconditionMet ? <Badge kind="ok">Met</Badge> : <Badge kind="warn">Not met</Badge>}</td>
                    </tr>
                    {isOpen && (
                      <tr className="postable__expand-row">
                        <td />
                        <td colSpan={4}>
                          <fieldset disabled={!editable} className="postable__expand-body iefreq__fieldset">
                            <div className="posfield-grid">
                              <div className="posfield">
                                <label className="posfield__label">Target</label>
                                <select className="posfield__input" value={id} onChange={(e) => changeTarget(id, e.target.value)}>
                                  {[{ id, label: `${id} · ${targetName(id)}` }, ...availableTargets].map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                                </select>
                              </div>
                              <div className="posfield">
                                <label className="posfield__label">Disposition</label>
                                <select className="posfield__input" value={rec.retained ? "retained" : "screened"} onChange={(e) => patchRecord(id, { retained: e.target.value === "retained" })}>
                                  <option value="retained">Retained, kept in the analysis</option>
                                  <option value="screened">Screened out</option>
                                </select>
                              </div>
                              <div className="posfield">
                                <label className="posfield__label">SCR criterion (IE-C9b)</label>
                                <select className="posfield__input" value={rec.criterion ?? ""} onChange={(e) => patchRecord(id, { criterion: e.target.value === "" ? undefined : (e.target.value as "SCR-1" | "SCR-2" | "SCR-3") })}>
                                  <option value="">No SCR criterion</option>
                                  <option value="SCR-1">SCR-1</option>
                                  <option value="SCR-2">SCR-2</option>
                                  <option value="SCR-3">SCR-3</option>
                                </select>
                              </div>
                              <div className="posfield">
                                <label className="posfield__label">Barrier precondition (IE-C9a)</label>
                                <button type="button" className={`iegroup__check${rec.barrierIntegrityPreconditionMet ? " iegroup__check--ok" : " iegroup__check--warn"}`} disabled={!editable} onClick={() => patchRecord(id, { barrierIntegrityPreconditionMet: !rec.barrierIntegrityPreconditionMet })}>
                                  {rec.barrierIntegrityPreconditionMet ? <IEIcon.Check /> : <IEIcon.Warn />} {rec.barrierIntegrityPreconditionMet ? "Precondition met" : "Precondition not met"}
                                </button>
                              </div>
                              <div className="posfield posfield-grid--span2">
                                <label className="posfield__label">Justification</label>
                                <AutoTextarea value={rec.justification} placeholder="Why this target screens the way it does." onChange={(v) => patchRecord(id, { justification: v })} />
                              </div>
                            </div>
                            {editable && <div style={{ marginTop: 10 }}><button type="button" className="posnav__btn posnav__btn--sm" onClick={() => deleteRecord(id)}><IEIcon.Close /> Delete record</button></div>}
                          </fieldset>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

type FreqBasis = InitiatingEventFrequencyQuantification["basis"];

const FREQ_BASIS_OPTIONS: { value: FreqBasis; label: string }[] = [
  { value: "OPERATING_DATA", label: "Operating data" },
  { value: "GENERIC_DATA", label: "Generic data" },
  { value: "SIMILAR_PLANT_DATA", label: "Similar-plant data" },
  { value: "DESIGN_BASED", label: "Design-based" },
  { value: "FAULT_TREE", label: "Fault tree" },
];

function FreqInput({ value, onChange }: { value: number; onChange: (v: number) => void }): JSX.Element {
  const [text, setText] = useState<string>(value > 0 ? String(value) : "");
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setText(value > 0 ? String(value) : "");
  }, [value, focused]);
  return (
    <input
      className="iefreq__input"
      type="text"
      inputMode="decimal"
      value={text}
      placeholder="e.g. 3e-2"
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={(e) => {
        const t = e.target.value;
        setText(t);
        const n = Number(t);
        if (t.trim() !== "" && isFinite(n) && n >= 0) onChange(n);
      }}
    />
  );
}

function FrequencyScreen(): JSX.Element {
  const { ie, editable, mutateIe } = useIeWorkbook();
  const records: InitiatingEventFrequencyQuantification[] = ie.quantifications;
  const groups = ie.initiatingEventGroups;
  const initiators = ie.initiators;
  const ranked = [...records].sort((a, b) => freqValue(b.meanFrequency) - freqValue(a.meanFrequency));
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggle = (id: string): void => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const recordedIds = new Set(records.map((r) => r.initiatorOrGroupId));
  const availableTargets = [
    ...groups.filter((g) => !recordedIds.has(g.uuid)).map((g) => ({ id: g.uuid, label: `${g.uuid} · ${g.name}` })),
    ...initiators.filter((i) => !recordedIds.has(i.uuid)).map((i) => ({ id: i.uuid, label: `${i.uuid} · ${i.name}` })),
  ];
  const labelFor = (id: string): string => {
    const grp = groups.find((g) => g.uuid === id);
    if (grp !== undefined) return grp.name;
    return initiators.find((i) => i.uuid === id)?.name ?? id;
  };
  const isPreop = (id: string): boolean => {
    const init = initiators.find((i) => i.uuid === id);
    return (init?.preOperationalAssumptions ?? []).length > 0;
  };

  const patchQuant = (id: string, patch: Partial<InitiatingEventFrequencyQuantification>): void => {
    mutateIe((draft) => ({ ...draft, quantifications: draft.quantifications.map((q) => (q.initiatorOrGroupId === id ? { ...q, ...patch } : q)) }));
  };
  const patchMean = (id: string, n: number): void => {
    mutateIe((draft) => ({ ...draft, quantifications: draft.quantifications.map((q) => {
      if (q.initiatorOrGroupId !== id) return q;
      const mf = typeof q.meanFrequency === "object" ? { ...q.meanFrequency, value: n } : n;
      return { ...q, meanFrequency: mf };
    }) }));
  };
  const changeTarget = (oldId: string, newId: string): void => {
    if (newId === oldId || newId === "") return;
    mutateIe((draft) => {
      if (draft.quantifications.some((q) => q.initiatorOrGroupId === newId)) return draft;
      return { ...draft, quantifications: draft.quantifications.map((q) => (q.initiatorOrGroupId === oldId ? { ...q, initiatorOrGroupId: newId } : q)) };
    });
  };
  const addQuant = (): void => {
    const used = new Set(records.map((q) => q.initiatorOrGroupId));
    const firstFree = [...groups.map((g) => g.uuid), ...initiators.map((i) => i.uuid)].find((id) => !used.has(id));
    if (firstFree === undefined) return;
    const created: InitiatingEventFrequencyQuantification = {
      initiatorOrGroupId: firstFree,
      meanFrequency: 0,
      basis: "GENERIC_DATA",
      plantCalendarYearBasis: false,
      posTimeFractionApplied: false,
      dataSourceJustification: "",
      recoveryActionsIncluded: false,
      implementsSrs: [],
    };
    mutateIe((draft) => (draft.quantifications.some((q) => q.initiatorOrGroupId === firstFree) ? draft : { ...draft, quantifications: [...draft.quantifications, created] }));
    setExpanded((prev) => new Set(prev).add(firstFree));
  };
  const deleteQuant = (id: string): void => {
    mutateIe((draft) => ({ ...draft, quantifications: draft.quantifications.filter((q) => q.initiatorOrGroupId !== id) }));
  };

  const numberOfModules = ie.metadata.plantIdentity?.numberOfModules ?? 1;
  const [openQuantId, setOpenQuantId] = useState<string | null>(null);
  const setQuantSources = (id: string, nextSources: FrequencyDataSource[], nextPrimary: string | undefined, rolled: number | null): void => {
    mutateIe((draft) => ({ ...draft, quantifications: draft.quantifications.map((q) => {
      if (q.initiatorOrGroupId !== id) return q;
      const primary = nextSources.find((s) => s.uuid === nextPrimary);
      const updated: InitiatingEventFrequencyQuantification = {
        ...q,
        dataSources: nextSources,
        primaryDataSourceId: nextPrimary,
        basis: primary !== undefined ? primary.basis : q.basis,
      };
      if (rolled !== null && rolled > 0) {
        updated.meanFrequency = typeof q.meanFrequency === "object" ? { ...q.meanFrequency, value: rolled } : rolled;
      }
      return updated;
    }) }));
  };
  const openQuant = openQuantId !== null ? records.find((q) => q.initiatorOrGroupId === openQuantId) : undefined;
  useEffect(() => {
    if (openQuantId === null) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [openQuantId]);

  const ticks = ["1e-6", "1e-5", "1e-4", "1e-3", "1e-2", "1e-1", "1e0"];
  return (
    <>
      {records.length > 0 && (
        <div className="poscard">
          <div className="poscard__head"><h3 className="poscard__title">Annual frequencies</h3></div>
          <div className="iefreq">
            <div className="iefreq__axis">
              {ticks.map((t) => <span key={t} className="iefreq__tick" style={{ left: `${freqToPct(parseFloat(t))}%` }}>{fmtFreq(parseFloat(t))}</span>)}
            </div>
            {ranked.map((r) => {
              const mean = freqValue(r.meanFrequency);
              const high = r.basis === "FAULT_TREE" || mean >= 1;
              const preop = isPreop(r.initiatorOrGroupId);
              return (
                <div key={r.initiatorOrGroupId} className="iefreq__row">
                  <div className="iefreq__label">
                    <span className="iefreq__label-id">{r.initiatorOrGroupId}</span>
                    <span className="iefreq__label-name">{labelFor(r.initiatorOrGroupId)}</span>
                    {preop && <span className="poschip" style={{ fontSize: 10, padding: "1px 6px", background: "rgba(184,106,0,0.1)", color: "var(--color-warning)" }}><IEIcon.Warn /> Pre-op</span>}
                  </div>
                  <div className="iefreq__track">
                    <div className={`iefreq__fill${high ? " iefreq__fill--high" : ""}`} style={{ width: `${freqToPct(mean)}%` }} />
                    <span className="iefreq__val">{fmtFreq(r.meanFrequency)}<span className="iefreq__unit"> per plant-yr</span></span>
                  </div>
                  <div className="iefreq__meta">
                    <span className="poschip">{BASIS_LABEL[r.basis] ?? r.basis}</span>
                    {r.posTimeFractionApplied
                      ? <span className="iefreq__flag iefreq__flag--ok"><IEIcon.Clock /> weighted</span>
                      : <span className="iefreq__flag"><IEIcon.Quake /> hazard curve</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Quantifications</h3>
          {editable && availableTargets.length > 0 && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addQuant}>+ Add quantification</button>}
        </div>
        {records.length === 0 ? (
          <p className="posmuted" style={{ margin: 0 }}>No quantifications yet.{editable ? (availableTargets.length > 0 ? " Use Add quantification to start." : " Identify initiators (Step 3) or groups (Step 6) first.") : ""}</p>
        ) : (
          <table className="postable postable--expandable postable--mid">
            <thead><tr><th style={{ width: 28 }} /><th>Target</th><th>Mean (per plant-yr)</th><th>Basis</th><th>Sources</th></tr></thead>
            <tbody>
              {ranked.map((q) => {
                const id = q.initiatorOrGroupId;
                const isOpen = expanded.has(id);
                return (
                  <Fragment key={id}>
                    <tr className="postable__row--clickable" onClick={() => toggle(id)}>
                      <td><span className={`postable__expand${isOpen ? " postable__expand--open" : ""}`}><IEIcon.Chevron /></span></td>
                      <td>
                        <div className="postable__name"><span className="posmono">{id}</span></div>
                        <span className="postable__name-sub">{labelFor(id)}{isPreop(id) ? " · pre-op" : ""}</span>
                      </td>
                      <td className="mono">{fmtFreq(q.meanFrequency)}</td>
                      <td><span className="poschip">{BASIS_LABEL[q.basis] ?? q.basis}</span></td>
                      <td className="mono">{(q.dataSources ?? []).length}</td>
                    </tr>
                    {isOpen && (
                      <tr className="postable__expand-row">
                        <td />
                        <td colSpan={4}>
                          <fieldset disabled={!editable} className="postable__expand-body iefreq__fieldset">
                            <div className="posfield-grid">
                              <div className="posfield">
                                <label className="posfield__label">Target</label>
                                <select className="posfield__input" value={id} onChange={(e) => changeTarget(id, e.target.value)}>
                                  {[{ id, label: `${id} · ${labelFor(id)}` }, ...availableTargets].map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                                </select>
                              </div>
                              <div className="posfield">
                                <label className="posfield__label">Mean frequency (per plant-yr)</label>
                                <div className="iefreq__entry">
                                  <FreqInput value={freqValue(q.meanFrequency)} onChange={(n) => patchMean(id, n)} />
                                  <span className="iefreq__entry-unit">per plant-yr</span>
                                </div>
                              </div>
                              <div className="posfield">
                                <label className="posfield__label">Basis</label>
                                <select className="posfield__input" value={q.basis} onChange={(e) => patchQuant(id, { basis: e.target.value as FreqBasis })}>
                                  {FREQ_BASIS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                                </select>
                              </div>
                              <div className="posfield">
                                <label className="posfield__label">Data sources</label>
                                <div className="iefreq__sources">
                                  <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => setOpenQuantId(id)}>Open quantifier →</button>
                                  <span className="possubtle">{(q.dataSources ?? []).length} source{(q.dataSources ?? []).length === 1 ? "" : "s"}</span>
                                </div>
                              </div>
                              <div className="posfield posfield-grid--span2">
                                <label className="posfield__label">Flags</label>
                                <div className="posrow posrow--wrap" style={{ gap: 6 }}>
                                  <button type="button" className={`iegroup__check${q.posTimeFractionApplied ? " iegroup__check--ok" : " iegroup__check--warn"}`} disabled={!editable} onClick={() => patchQuant(id, { posTimeFractionApplied: !q.posTimeFractionApplied })}>{q.posTimeFractionApplied ? <IEIcon.Check /> : <IEIcon.Warn />} POS time-fraction weighting</button>
                                  <button type="button" className={`iegroup__check${q.plantCalendarYearBasis ? " iegroup__check--ok" : " iegroup__check--warn"}`} disabled={!editable} onClick={() => patchQuant(id, { plantCalendarYearBasis: !q.plantCalendarYearBasis })}>{q.plantCalendarYearBasis ? <IEIcon.Check /> : <IEIcon.Warn />} Plant calendar-year basis</button>
                                  <button type="button" className={`iegroup__check${q.recoveryActionsIncluded ? " iegroup__check--ok" : " iegroup__check--warn"}`} disabled={!editable} onClick={() => patchQuant(id, { recoveryActionsIncluded: !q.recoveryActionsIncluded })}>{q.recoveryActionsIncluded ? <IEIcon.Check /> : <IEIcon.Warn />} Recovery actions included</button>
                                </div>
                              </div>
                              <div className="posfield posfield-grid--span2">
                                <label className="posfield__label">Data-source justification</label>
                                <AutoTextarea value={q.dataSourceJustification} placeholder="How the frequency was derived and from what data." onChange={(v) => patchQuant(id, { dataSourceJustification: v })} />
                              </div>
                            </div>
                            {editable && <div className="iefreq__danger"><button type="button" className="posnav__btn posnav__btn--sm" onClick={() => deleteQuant(id)}><IEIcon.Close /> Delete quantification</button></div>}
                          </fieldset>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {openQuant !== undefined && (
        <div className="ftspace">
          <div className="ftspace__head">
            <button type="button" className="ftspace__back" onClick={() => setOpenQuantId(null)}>
              <span className="ftspace__back-arrow">←</span> Back to workbook
            </button>
            <div className="ftspace__titlewrap">
              <span className="ftspace__title">Frequency quantification: {openQuant.initiatorOrGroupId} · {labelFor(openQuant.initiatorOrGroupId)}</span>
            </div>
          </div>
          <div className="ftspace__body">
            <IeFrequencyQuantificationEditor
              key={openQuant.initiatorOrGroupId}
              sources={openQuant.dataSources ?? []}
              primaryId={openQuant.primaryDataSourceId}
              numberOfModules={numberOfModules}
              editable={editable}
              onChange={(ns, np, rolled) => setQuantSources(openQuant.initiatorOrGroupId, ns, np, rolled)}
            />
          </div>
        </div>
      )}
    </>
  );
}

function DraftScreen({ cc, scores, stage, onSubmitDraft, canSubmit }: {
  cc: CapabilityCategory;
  scores: CcScore;
  stage: string;
  onSubmitDraft: (ready: boolean) => void;
  canSubmit: boolean;
}): JSX.Element {
  const { ie } = useIeWorkbook();
  const ready = scores.blocked === 0;
  const toc = computeIeReportToc(ie);
  function downloadJson(): void {
    const blob = new Blob([JSON.stringify(ie, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${ie.name} — IE Analysis.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
  return (
    <div className="posgen">
      <div className="posgen__preview" aria-hidden="true">
        <div className="posgen__preview-eyebrow">Generated preview · Word output</div>
        <h1>{ie.name}</h1>
        <h2>Preliminary Initiating Event Analysis</h2>
        <h3>Table of contents</h3>
        <div className="posgen__preview-toc">
          {toc.map((entry) => (
            <div key={entry.title} className="posgen__preview-toc-row">
              <span style={{ paddingLeft: entry.indent === 1 ? 24 : 0 }}>{entry.title}</span>
              <span>{entry.page}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="posgen__side">
        <div className="posgen__readout">
          <h3 className="posgen__readout-h">Conformance check</h3>
          <div className="posgen__bar"><span className="posgen__bar-label">Capability category</span><span style={{ fontWeight: 700 }}>{cc.name} · {cc.tag}</span></div>
          <div className="posgen__bar"><span className="posgen__bar-label">Plant stage</span><span style={{ fontWeight: 700 }}>{stage === "pre_operational" ? "Pre-operational" : "Operational"}</span></div>
          <div className="posgen__bar"><span className="posgen__bar-label">Items satisfied</span><span className="posmono">{scores.met} / {scores.applicable}</span></div>
          {scores.warn > 0 && <div className="posgen__bar"><span className="posgen__bar-label" style={{ color: "var(--color-warning)" }}>Needs attention</span><span className="posmono">{scores.warn}</span></div>}
          {scores.blocked > 0 && <div className="posgen__bar"><span className="posgen__bar-label" style={{ color: "#b73b3b" }}>Blocked</span><span className="posmono">{scores.blocked}</span></div>}
        </div>
        <div className="posgen__readout">
          <h3 className="posgen__readout-h">Hand-off to internal review</h3>
          <p style={{ margin: "0 0 12px", fontSize: 12.5, color: "var(--color-text-muted)", lineHeight: 1.5 }}>
            {ready
              ? <>All items pass at <strong>{cc.name}</strong>. Producing the draft locks Steps 1–9 and advances the workbook to <strong>Internal Technical Review</strong>.</>
              : <>{scores.warn} item{scores.warn === 1 ? "" : "s"} need{scores.warn === 1 ? "s" : ""} attention. You may produce a working draft, but approval is gated until they are resolved.</>}
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {canSubmit && (
              <button type="button" className="posnav__btn posnav__btn--primary" onClick={() => onSubmitDraft(ready)}>
                <IEIcon.Send /> {ready ? "Submit draft to internal review" : "Submit working draft to review"}
              </button>
            )}
            <button type="button" className="posnav__btn" onClick={() => { void generateIeReport(ie, ready); }}>
              <IEIcon.Download /> Download draft (.docx)
            </button>
            <button type="button" className="posnav__btn" onClick={downloadJson}>
              <IEIcon.Download /> Download JSON
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export {
  ScopeScreen,
  MethodsScreen,
  IdentifyScreen,
  CompletenessScreen,
  HazardsScreen,
  GroupingScreen,
  ScreeningScreen,
  FrequencyScreen,
  DraftScreen,
  type ScreenProps,
};
