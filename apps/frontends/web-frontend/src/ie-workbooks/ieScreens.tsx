import { JSX, useMemo, useState } from "react";
import {
  InitiatingEventCategory,
  type InitiatorDefinition,
  type InitiatingEventGroup,
  type InitiatingEventFrequencyQuantification,
  type InitiatingEventScreeningRecord,
  type HazardAnalysis,
} from "interfaces-mef-types/ie/initiating-event-analysis";
import { type Frequency, type FrequencyWithDistribution } from "interfaces-mef-types/core/events";
import { IEIcon } from "./ieIcons";
import { Badge } from "./ieShared";
import { useIeWorkbook } from "./ieWorkbookContext";
import { CAPABILITY_CATEGORIES, CATEGORY_COLORS, INITIATOR_CATEGORIES, categoryById, methodSpec, COMPLETENESS_CHECK_META, type CapabilityCategory, type Stage } from "./ieViewData";
import { type CcScore } from "./ieSelectors";
import { FaultTreeEditor } from "../newly-developed-methods/fault-tree/faultTreeEditor";
import { type FtInputNode } from "../newly-developed-methods/fault-tree/faultTreeTypes";
import { mldToFaultTree, hbftToFaultTree } from "./faultTreeAdapters";

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

function hazardIcon(h: HazardAnalysis): keyof typeof IEIcon {
  const text = (h.subcategory ?? h.name).toLowerCase();
  if (text.includes("fire")) return "Flame";
  if (text.includes("flood")) return "Wave";
  if (text.includes("seismic") || text.includes("quake") || text.includes("earthquake")) return "Quake";
  if (h.hazardType === "EXTERNAL") return "Quake";
  return "Flame";
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

function riskFromBarrier(barrier: string | undefined): { label: string; warn: boolean } {
  if (barrier === "BREACHED" || barrier === "BYPASSED") return { label: "High", warn: true };
  if (barrier === "DEGRADED") return { label: "Medium", warn: false };
  return { label: "Low", warn: false };
}

function CatIcon({ catId, size = 14 }: { catId: string; size?: number }): JSX.Element {
  const cat = categoryById(catId);
  const Ico = (cat !== undefined && IEIcon[cat.icon as keyof typeof IEIcon] !== undefined) ? IEIcon[cat.icon as keyof typeof IEIcon] : IEIcon.Bolt;
  return (
    <span style={{ display: "inline-flex", width: size, height: size, color: CATEGORY_COLORS[catId] }}>
      <Ico />
    </span>
  );
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
  const { ie, posLink } = useIeWorkbook();
  const linked = posLink.linkedPosWorkbookId !== null;
  const cc = CAPABILITY_CATEGORIES.find((c) => c.id === ccId) ?? CAPABILITY_CATEGORIES[0];

  const [siteConfig, setSiteConfig] = useState<"single" | "multi">("single");
  const [unitCount, setUnitCount] = useState("2");
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
            <select id="ie-scope-site" className="iefield__select" value={siteConfig} onChange={(e) => setSiteConfig(e.target.value as "single" | "multi")}>
              <option value="single">Single-unit site</option>
              <option value="multi">Multi-unit site</option>
            </select>
          </div>

          {/* Units at site */}
          <div className="iefield">
            <label className="iefield__label" htmlFor="ie-scope-units">Units at site</label>
            {siteConfig === "single"
              ? <input id="ie-scope-units" className="iefield__input iefield__input--locked" value="1" readOnly />
              : <input id="ie-scope-units" className="iefield__input" type="number" min="2" max="6" value={unitCount} onChange={(e) => setUnitCount(e.target.value)} />}
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
                <th><div className="iesrc-th">Source <span className="ieprov ieprov--sm"><IEIcon.Link /> POS-A3</span></div></th>
                <th><div className="iesrc-th">Barriers <span className="ieprov ieprov--sm"><IEIcon.Link /> POS-A3</span></div></th>
                <th><div className="iesrc-th">Escape mechanisms <span className="ieprov ieprov--ie ieprov--sm"><IEIcon.Bolt /> IE-A2</span></div></th>
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
  return (
    <>
      <div className="poscard">
        <div className="poscard__head"><h3 className="poscard__title">Systematic search methods</h3></div>
        {methods.length === 0 ? <p className="posmuted" style={{ margin: 0 }}>No methods recorded yet.</p> : (
          <div className="iemethod-grid">
            {methods.map((m) => {
              const Ico = IEIcon[methodSpec(m.id).icon as keyof typeof IEIcon] ?? IEIcon.Network;
              const count = ie.initiators.filter((i) => i.identificationMethodIds.includes(m.id)).length;
              const hasEditor = m.id === "MLD" || m.id === "HBFT";
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
            <FaultTreeEditor key={openMethod.id} nodes={ftNodes} flavor={openMethod.id === "HBFT" ? "heat" : "logic"} />
          </div>
        </div>
      )}
    </>
  );
}

function IdentifyScreen(): JSX.Element {
  const { ie } = useIeWorkbook();
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const initiators = ie.initiators;
  const shown = activeCat !== null ? initiators.filter((i) => i.category === activeCat) : initiators;
  const total = initiators.length;
  const cat = activeCat !== null ? categoryById(activeCat) : undefined;

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
            <CatIcon catId={cat.id} size={18} />
            <div><strong>{cat.label}</strong> <span className="possubtle">— {cat.blurb}</span></div>
          </div>
        )}
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">{cat !== undefined ? cat.label : "All initiators"}<span className="possubtle" style={{ fontWeight: 400 }}> · {shown.length}</span></h3>
          {activeCat !== null && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => setActiveCat(null)}>Clear filter</button>}
        </div>
        {shown.length === 0 ? <p className="posmuted" style={{ margin: 0 }}>No initiators identified yet.</p> : (
          <table className="postable">
            <thead><tr><th>Initiator</th><th>Category</th><th>States</th><th>Barrier</th><th>Disposition</th></tr></thead>
            <tbody>
              {shown.map((i) => {
                const c = categoryById(i.category);
                const barrier = i.barrierImpacts[0]?.state ?? "—";
                return (
                  <tr key={i.uuid}>
                    <td>
                      <div className="postable__name">{i.uuid} · {i.name}</div>
                      {i.subcategory !== undefined && <span className="postable__name-sub">{i.subcategory}</span>}
                      {(i.preOperationalAssumptions ?? []).length > 0 && <span className="poschip" style={{ marginLeft: 6, fontSize: 11, background: "rgba(184,106,0,0.1)", color: "var(--color-warning)" }}><IEIcon.Warn /> Pre-op</span>}
                    </td>
                    <td><span className="iecat-tag"><CatIcon catId={i.category} size={13} /> {c?.label ?? i.category}</span></td>
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

function CompletenessScreen(): JSX.Element {
  const { ie } = useIeWorkbook();
  const cs = ie.completenessSearch;
  const hazardsInScope = ie.includesNonInternalHazardGroups;
  const categoryTarget = hazardsInScope ? 7 : 5;
  const checks: { label: string; ok: boolean; icon: string; detail: string; meta: string }[] = [
    { label: hazardsInScope ? "All seven functional categories covered" : "All in-scope functional categories covered", ok: cs.functionalCategoriesCovered.length >= categoryTarget, icon: COMPLETENESS_CHECK_META[0].icon, detail: hazardsInScope ? COMPLETENESS_CHECK_META[0].detail : "Transient · RCB breach · interfacing · special · human-failure. Internal and external hazards are out of scope, carried by the separate hazard analyses.", meta: `${cs.functionalCategoriesCovered.length} / ${categoryTarget}` },
    { label: "Per-system search performed", ok: cs.perSystemSearchPerformed, ...COMPLETENESS_CHECK_META[1], meta: COMPLETENESS_CHECK_META[1].meta(cs) },
    { label: "Per-support-system search performed", ok: cs.perSupportSystemSearchPerformed, ...COMPLETENESS_CHECK_META[2], meta: COMPLETENESS_CHECK_META[2].meta(cs) },
    { label: "Radioactive-source mechanisms addressed", ok: cs.radioactiveSourceMechanismsAddressed, ...COMPLETENESS_CHECK_META[3], meta: COMPLETENESS_CHECK_META[3].meta(cs) },
    { label: "Multi-reactor / shared-source events addressed", ok: cs.multiReactorEventsAddressed, ...COMPLETENESS_CHECK_META[4], meta: COMPLETENESS_CHECK_META[4].meta(cs) },
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
            const Ico = IEIcon[c.icon as keyof typeof IEIcon] ?? IEIcon.Check;
            return (
              <div key={i} className={`iecheck iecheck--${c.ok ? "ok" : "warn"}`}>
                <span className="iecheck__icon"><Ico /></span>
                <div className="iecheck__main">
                  <div className="iecheck__label">{c.label}</div>
                  {c.detail.length > 0 && <div className="iecheck__detail">{c.detail}</div>}
                </div>
                <div className="iecheck__right">
                  {c.meta.length > 0 && <span className="iecheck__meta">{c.meta}</span>}
                  {c.ok
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
                  <td className="iecov__rowh"><CatIcon catId={cat.id} size={13} /> <span>{cat.label}</span></td>
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
  const { ie } = useIeWorkbook();
  const hazards: HazardAnalysis[] = ie.hazardAnalyses ?? [];
  const allCombinations = hazards.flatMap((h) =>
    h.potentialCombinations.map((text) => ({ sourceHazard: h, text }))
  );
  return (
    <>
      <div className="poscard">
        <div className="poscard__head"><h3 className="poscard__title">Hazard analyses</h3><span className="possubtle">IE-A5(e/f)</span></div>
        <p className="poscard__sub">Hazard-induced frequencies are developed in the hazard PRA elements and imported here (IE-N-12).</p>
        {hazards.length === 0 ? <p className="posmuted" style={{ margin: 0 }}>No hazard analyses recorded yet.</p> : (
          <div className="iehazard-grid">
            {hazards.map((h) => {
              const iconName = hazardIcon(h);
              const Ico = IEIcon[iconName] ?? IEIcon.Flame;
              const statusKind = hazardStatusKind(h);
              const statusLabel = hazardStatusLabel(h);
              return (
                <div key={h.uuid} className="iehazard">
                  <div className="iehazard__head">
                    <span className="iehazard__icon"><Ico /></span>
                    <div>
                      <div className="iehazard__name">{h.name}</div>
                      <div className="iehazard__type">{h.hazardType === "INTERNAL" ? "Internal hazard" : "External hazard"}{h.subcategory.length > 0 ? ` · ${h.subcategory}` : ""}</div>
                    </div>
                    <Badge kind={statusKind}>{statusLabel}</Badge>
                  </div>
                  <p className="iehazard__basis">{h.screeningBasis}</p>
                  <div className="iehazard__foot">
                    {h.inducedInitiatorIds.length > 0 ? (
                      <div className="posrow posrow--wrap" style={{ gap: 4 }}>
                        <span className="possubtle" style={{ fontSize: 11.5 }}>Induces</span>
                        {h.inducedInitiatorIds.map((id) => (
                          <span key={id} className="poschip poschip--method" style={{ fontSize: 11 }}><IEIcon.Bolt /> {id}</span>
                        ))}
                      </div>
                    ) : (
                      <span className="possubtle" style={{ fontSize: 12 }}>No induced initiators</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {allCombinations.length > 0 && (
        <div className="poscard">
          <div className="poscard__head">
            <h3 className="poscard__title">Hazard combinations</h3>
            <Badge kind="warn">IE-A6</Badge>
          </div>
          <p className="poscard__sub">Hazard combinations must be considered explicitly (IE-A6), a frequent completeness gap.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {allCombinations.map((c, i) => {
              const srcIcon = hazardIcon(c.sourceHazard);
              const SrcIco = IEIcon[srcIcon] ?? IEIcon.Flame;
              const [comboName, ...basisParts] = c.text.split("\n");
              const comboBasis = basisParts.join(" ");
              return (
                <div key={i} className="iecombo">
                  <div className="iecombo__chain">
                    <span className="iecombo__node">
                      <span className="iecombo__node-icon"><SrcIco /></span>
                      {c.sourceHazard.name}
                    </span>
                  </div>
                  <div className="iecombo__body">
                    <div className="iecombo__name">{comboName}</div>
                    {comboBasis.length > 0 && <p className="iecombo__basis">{comboBasis}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}

function GroupingScreen(): JSX.Element {
  const { ie } = useIeWorkbook();
  const groups: InitiatingEventGroup[] = ie.initiatingEventGroups;
  return (
    <>
      <div className="poscard poscard--ghost">
        <div className="posrow" style={{ gap: 12, alignItems: "flex-start" }}>
          <span style={{ display: "inline-flex", width: 20, height: 20, color: "var(--color-text-muted)", flexShrink: 0, marginTop: 1 }}><IEIcon.Branch /></span>
          <p style={{ margin: 0, fontSize: 13, color: "var(--color-text-muted)", lineHeight: 1.55 }}>
            Group events only when they are alike in plant response, success criteria, and timing — or bounded by the worst case. Never group to hide risk-significant sequences.
          </p>
        </div>
      </div>

      {groups.length === 0 ? <div className="poscard"><p className="posmuted" style={{ margin: 0 }}>No groups defined yet.</p></div> : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 14 }}>
          {groups.map((g) => {
            const boundingInit = ie.initiators.find((i) => i.uuid === g.boundingInitiatorId);
            return (
              <div key={g.uuid} className="poscard">
                <div className="poscard__head">
                  <div>
                    <div className="posrow" style={{ gap: 10 }}>
                      <span className="posmono possubtle">{g.uuid}</span>
                      <h3 className="poscard__title" style={{ fontSize: 16 }}>{g.name}</h3>
                      {g.groupingDoesNotMaskRiskSignificantSequences ? <Badge kind="ok">Bounded</Badge> : <Badge kind="warn">Anti-masking open</Badge>}
                    </div>
                    <div className="possubtle" style={{ marginTop: 6 }}>{g.memberInitiatorIds.length} members · Mean {fmtFreq(g.meanFrequency)} per plant-yr</div>
                  </div>
                </div>
                <div className="iegroup__members">
                  {g.memberInitiatorIds.map((m) => {
                    const init = ie.initiators.find((i) => i.uuid === m);
                    const isBounding = m === g.boundingInitiatorId;
                    return (
                      <span key={m} className={`iegroup__member${isBounding ? " iegroup__member--bounding" : ""}`} title={init?.name ?? m}>
                        {isBounding && <span className="iegroup__member-crown"><IEIcon.Target /></span>}
                        {init !== undefined && <CatIcon catId={init.category} size={13} />}
                        <span className="iegroup__member-id">{m}</span>
                      </span>
                    );
                  })}
                </div>
                <div style={{ fontSize: 13.5, color: "var(--color-text)", lineHeight: 1.55, margin: "12px 0 10px" }}>{g.groupingBasis}</div>
                <div className="iegroup__checks">
                  <span className={`iegroup__check${g.comparableImpactAcrossMembers ? " iegroup__check--ok" : ""}`}>
                    {g.comparableImpactAcrossMembers ? <IEIcon.Check /> : <IEIcon.Warn />} Comparable impact across members
                  </span>
                  <span className={`iegroup__check${g.groupingDoesNotMaskRiskSignificantSequences ? " iegroup__check--ok" : " iegroup__check--warn"}`}>
                    {g.groupingDoesNotMaskRiskSignificantSequences ? <IEIcon.Check /> : <IEIcon.Warn />} Does not mask risk-significant sequences
                  </span>
                  <span className="iegroup__check">
                    <IEIcon.Target /> Bounded by {boundingInit?.name ?? g.boundingInitiatorId}
                  </span>
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
  const { ie } = useIeWorkbook();
  const records: InitiatingEventScreeningRecord[] = ie.screeningRecords;
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
        <div className="poscard__head"><h3 className="poscard__title">Screening decisions</h3></div>
        {records.length === 0 ? <p className="posmuted" style={{ margin: 0 }}>No screening records yet.</p> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {records.map((rec, i) => {
              const target = ie.initiators.find((x) => x.uuid === rec.initiatorOrGroupId);
              const barrier = target?.barrierImpacts[0]?.state;
              const risk = riskFromBarrier(barrier);
              return (
                <div key={i} className={`iescreen${!rec.barrierIntegrityPreconditionMet ? " iescreen--blocked" : ""}`}>
                  <div className="iescreen__head">
                    <div className="posrow" style={{ gap: 10 }}>
                      <span className="posmono possubtle">{rec.initiatorOrGroupId}</span>
                      <span className="possubtle">{target?.name ?? ""}</span>
                    </div>
                    {rec.retained ? <Badge kind="block">Retained (gate failed)</Badge> : <Badge kind="draft">Screened out</Badge>}
                  </div>
                  <div className="iescreen__gate">
                    <span className={`iescreen__pre${rec.barrierIntegrityPreconditionMet ? " iescreen__pre--ok" : " iescreen__pre--fail"}`}>
                      {rec.barrierIntegrityPreconditionMet ? <IEIcon.Check /> : <IEIcon.Close />} Barrier intact
                    </span>
                    {rec.criterion !== undefined ? <span className="poschip poschip--primary">{rec.criterion}</span> : <span className="poschip poschip--warn">No SCR, barrier gate blocks screening</span>}
                    <span className={`poschip${risk.warn ? " poschip--warn" : ""}`}>Risk: {risk.label}</span>
                  </div>
                  <p className="iescreen__just">{rec.justification}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

function FrequencyScreen(): JSX.Element {
  const { ie } = useIeWorkbook();
  const records: InitiatingEventFrequencyQuantification[] = ie.quantifications;
  const ranked = [...records].sort((a, b) => freqValue(b.meanFrequency) - freqValue(a.meanFrequency));
  const labelFor = (id: string): string => {
    const grp = ie.initiatingEventGroups.find((g) => g.uuid === id);
    if (grp !== undefined) return grp.name;
    const init = ie.initiators.find((i) => i.uuid === id);
    return init?.name ?? id;
  };
  const isPreop = (id: string): boolean => {
    const init = ie.initiators.find((i) => i.uuid === id);
    return (init?.preOperationalAssumptions ?? []).length > 0;
  };
  const ticks = ["1e-6", "1e-5", "1e-4", "1e-3", "1e-2", "1e-1", "1e0"];
  return (
    <>
      <div className="poscard">
        <div className="poscard__head"><h3 className="poscard__title">Annual frequencies</h3></div>
        {records.length === 0 ? <p className="posmuted" style={{ margin: 0 }}>No quantifications yet.</p> : (
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
        )}
      </div>
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
  const ready = scores.blocked === 0;
  const TOC_ITEMS: [string, string][] = [
    ["Executive summary", "5"],
    ["Introduction", "6"],
    ["    Purpose", "6"],
    ["    Scope", "6"],
    ["    Relationship to other documents", "6"],
    ["    Document layout", "6"],
    ["    Quality assurance", "6"],
    ["    Freeze date", "6"],
    ["Assumptions & limitations", "7"],
    ["IE analysis methodologies", "8"],
    ["    Plant evolution & operating states", "8"],
    ["    IE selection approach", "8"],
    ["        Master logic diagram", "8"],
    ["        Plant heat balance fault tree", "8"],
    ["        Further checks for completeness", "8"],
    ["    Common-cause initiating events", "8"],
    ["    IE identification", "8"],
    ["        Master logic diagram", "8"],
    ["        Plant heat balance fault tree", "8"],
    ["        Failure modes & effects analysis", "8"],
    ["        Further checks for completeness", "8"],
    ["Operating modes & states selected", "9"],
    ["Screening & grouping of initiating events", "10"],
    ["    Screening of initiating events", "10"],
    ["    Grouping of initiating events", "10"],
    ["Initiating event definition", "11"],
    ["Initiating event quantification", "12"],
    ["    Frequency quantification methodology", "12"],
    ["    Uncertainty quantification methodology", "12"],
    ["    Initiating-event frequency sources", "12"],
    ["Initiating event groups & frequencies", "13"],
    ["References", "14"],
  ];
  return (
    <div className="posgen">
      <div className="posgen__preview" aria-hidden="true">
        <div className="posgen__preview-eyebrow">Generated preview · Word output</div>
        <h1>IE Workbook</h1>
        <h2>Preliminary Initiating Event Analysis</h2>
        <h3>Table of contents</h3>
        <div className="posgen__preview-toc">
          {TOC_ITEMS.map(([t, p], i) => (
            <div key={i} className="posgen__preview-toc-row"><span>{t}</span><span>{p}</span></div>
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
          </div>
        </div>
        <div className="posgen__readout">
          <h3 className="posgen__readout-h">Downstream interfaces</h3>
          <p style={{ margin: "0 0 10px", fontSize: 12.5, color: "var(--color-text-muted)", lineHeight: 1.5 }}>This IE list feeds the next elements directly.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span className="poschip poschip--method"><IEIcon.ArrowR /> Event Sequence Analysis (ES)</span>
            <span className="poschip poschip--method"><IEIcon.ArrowR /> Event Sequence Quantification (ESQ)</span>
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
