import { JSX, useState } from "react";
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
import { Badge, Stat } from "./ieShared";
import { useIeWorkbook } from "./ieWorkbookContext";
import { CAPABILITY_CATEGORIES, CATEGORY_COLORS, INITIATOR_CATEGORIES, METHOD_REGISTRY, categoryById, methodSpec, COMPLETENESS_CHECK_META, type CapabilityCategory, type Stage } from "./ieViewData";
import { type CcScore } from "./ieSelectors";

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
  if (h.screeningStatus === "RETAINED") return "Active";
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
  return name.replace(/\s*\([^)]*\)$/, "").trim();
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

function FieldToggle({ source, setSource, linked }: { source: "pos" | "manual"; setSource: (s: "pos" | "manual") => void; linked: boolean }): JSX.Element {
  return (
    <div className="iefield-toggle">
      {linked && (
        <button type="button" className={`iefield-toggle__btn${source === "pos" ? " is-on" : ""}`} onClick={() => setSource("pos")}>
          <IEIcon.Link /> POS
        </button>
      )}
      <button type="button" className={`iefield-toggle__btn${source === "manual" ? " is-on" : ""}`} onClick={() => setSource("manual")}>
        Manual
      </button>
    </div>
  );
}

function ScopeScreen({ ccId, setCcId, stage, setStage, onOpenLink }: ScopeScreenProps): JSX.Element {
  const { ie, posLink } = useIeWorkbook();
  const linked = posLink.linkedPosWorkbookId !== null;
  const cc = CAPABILITY_CATEGORIES.find((c) => c.id === ccId) ?? CAPABILITY_CATEGORIES[0];

  const plantName = ie.metadata.plantIdentity?.name ?? posLink.linkedName ?? "";

  const [plantSource, setPlantSource] = useState<"pos" | "manual">(linked ? "pos" : "manual");
  const [siteConfig, setSiteConfig] = useState<"single" | "multi">("single");
  const [unitCount, setUnitCount] = useState("2");
  const [modesSource, setModesSource] = useState<"pos" | "manual">(linked ? "pos" : "manual");
  const [lpsd, setLpsd] = useState<boolean>(() => posLink.states.some((s) => s.operatingMode !== "POWER"));
  const [hazardsSource, setHazardsSource] = useState<"pos" | "manual">(linked ? "pos" : "manual");
  const [hazards, setHazards] = useState<string[]>(() => {
    const base = ["Internal events"];
    if (ie.includesNonInternalHazardGroups) base.push("Internal fire", "Internal flooding", "Seismic");
    return base;
  });

  const multiUnitText = siteConfig === "single" ? "Not applicable" : "In scope";

  return (
    <>
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

          {/* Plant */}
          <div className="iefield">
            <div className="iefield__labelrow">
              <label className="iefield__label" htmlFor="ie-scope-plant">Plant</label>
              <FieldToggle source={plantSource} setSource={setPlantSource} linked={linked} />
            </div>
            <input
              id="ie-scope-plant"
              className={`iefield__input${plantSource === "pos" ? " iefield__input--locked" : ""}`}
              value={plantSource === "pos" ? plantName : plantName}
              readOnly={plantSource === "pos"}
              onChange={() => {}}
            />
          </div>

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

          {/* Operating modes */}
          <div className="iefield iefield-grid--span2">
            <div className="iefield__labelrow">
              <label className="iefield__label">Operating modes in scope</label>
              <FieldToggle source={modesSource} setSource={setModesSource} linked={linked} />
            </div>
            <div className="iemodes">
              <span className="iemode iemode--baseline" title="At-power operation is always in scope for a Level 1 PRA.">
                <IEIcon.Lock /> At-power <span className="iemode__tag">Baseline</span>
              </span>
              <button
                type="button"
                className={`iemode iemode--toggle ${lpsd ? "is-on" : "is-off"}${modesSource === "pos" ? " iemode--locked" : ""}`}
                disabled={modesSource === "pos"}
                onClick={() => { if (modesSource !== "pos") setLpsd(!lpsd); }}
              >
                {lpsd ? <IEIcon.Check /> : <IEIcon.Plus />}
                Low power &amp; shutdown (LPSD)
                <span className="iemode__state">{lpsd ? "Included" : "Excluded"}</span>
              </button>
            </div>
          </div>

          {/* Multi-unit IE-A16 */}
          <div className="iefield">
            <label className="iefield__label">Multi-unit initiating events (IE-A16)</label>
            <input className="iefield__input iefield__input--locked" value={multiUnitText} readOnly />
          </div>

          {/* Hazard groups */}
          <div className="iefield iefield-grid--span2">
            <div className="iefield__labelrow">
              <label className="iefield__label">Hazard groups in scope</label>
              <FieldToggle source={hazardsSource} setSource={setHazardsSource} linked={linked} />
            </div>
            <div className="posrow posrow--wrap" style={{ gap: 6 }}>
              {hazards.map((h, i) => {
                const isPrimary = i === 0;
                return (
                  <span key={h} className={`poschip${isPrimary ? " poschip--primary" : ""}`}>
                    {h}
                    {hazardsSource === "manual" && !isPrimary && (
                      <button
                        type="button"
                        className="iechip-x"
                        title={`Remove ${h}`}
                        onClick={() => setHazards(hazards.filter((x) => x !== h))}
                      >
                        <IEIcon.Close />
                      </button>
                    )}
                  </span>
                );
              })}
              {hazardsSource === "manual" && (
                <button type="button" className="poschip" onClick={() => setHazards([...hazards, "New hazard group"])}>
                  <IEIcon.Plus /> Add
                </button>
              )}
            </div>
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
                    <div className="iesrc__name"><span className="iesrc__icon"><IEIcon.Radiation /></span>{s.baseName}</div>
                    <div className="iesrc__sub">{s.state}{s.note.length > 0 ? ` · ${s.note}` : ""}</div>
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

function StatesScreen({ onOpenLink }: ScreenProps & { onOpenLink: () => void }): JSX.Element {
  const { ie, posLink } = useIeWorkbook();
  if (posLink.linkedPosWorkbookId === null) {
    return (
      <div className="poscard" style={{ textAlign: "center", padding: 32 }}>
        <div style={{ display: "inline-flex", width: 32, height: 32, color: "var(--color-primary)", marginBottom: 10 }}><IEIcon.Link /></div>
        <h3 className="poscard__title" style={{ marginBottom: 6 }}>No operating states linked yet</h3>
        <p className="possubtle" style={{ maxWidth: 460, margin: "0 auto 16px" }}>
          IE works inside the coordinate system POS already defined. Link a POS workbook to import its operating states and sources.
        </p>
        <button type="button" className="posnav__btn posnav__btn--primary" onClick={onOpenLink}>
          <IEIcon.Download /> Import from a POS workbook
        </button>
      </div>
    );
  }
  const atPower = posLink.states.filter((s) => s.operatingMode === "POWER").length;
  const totalHours = posLink.states.reduce((a, s) => a + s.meanDurationHours, 0);
  return (
    <>
      <div className="ieposlink">
        <span className="ieposlink__icon"><IEIcon.Link /></span>
        <div className="ieposlink__main">
          <div className="ieposlink__title">Linked to <strong>{posLink.linkedName ?? "POS workbook"}</strong></div>
          <div className="ieposlink__sub">{posLink.states.length} operating states imported.</div>
        </div>
        <div className="ieposlink__actions">
          <button type="button" className="posnav__btn posnav__btn--sm" onClick={onOpenLink}><IEIcon.Refresh /> Re-link</button>
        </div>
      </div>
      <div className="posstats">
        <Stat num={posLink.states.length} cap="Operating states" sub="Imported from POS" />
        <Stat num={atPower} cap="States at-power" kind="ok" />
        <Stat num={posLink.states.length - atPower} cap="States at LPSD" sub="Shutdown / refuel" />
        <Stat num="IE-C8" cap="Weighting rule" sub="Fraction-of-time applied" />
      </div>

      {totalHours > 0 && (
        <div className="poscard">
          <div className="poscard__head">
            <h3 className="poscard__title">Time fraction across operating states</h3>
            <span className="possubtle">IE-C8 weighting basis</span>
          </div>
          <div className="ietimebar" role="img" aria-label="Time fraction by operating state">
            {posLink.states.map((s) => {
              const pct = (s.meanDurationHours / totalHours) * 100;
              const atP = s.operatingMode === "POWER";
              return (
                <div key={s.id} className={`ietimebar__seg${atP ? " ietimebar__seg--power" : ""}`}
                  style={{ width: `${pct}%` }} title={`${s.id} · ${pct.toFixed(1)}%`}>
                  {pct > 7 && <span className="ietimebar__seg-label">{pct.toFixed(1)}%</span>}
                </div>
              );
            })}
          </div>
          <div className="ietimebar__legend">
            <span><span className="ietimebar__key ietimebar__key--power" /> At-power</span>
            <span><span className="ietimebar__key" /> Low-power &amp; shutdown</span>
          </div>
        </div>
      )}

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Operating states</h3>
          <span className="possubtle">Linked · edit at source in POS</span>
        </div>
        <table className="postable">
          <thead>
            <tr><th>State</th><th>Mode</th><th>Time fraction</th><th>Mean duration (h)</th><th>Initiators applicable</th></tr>
          </thead>
          <tbody>
            {posLink.states.map((s) => {
              const count = ie.initiators.filter((i) => i.applicableStates.includes(s.id)).length;
              const pct = totalHours > 0 ? ((s.meanDurationHours / totalHours) * 100).toFixed(1) : "—";
              return (
                <tr key={s.id}>
                  <td><div className="postable__name">{s.id}</div><span className="postable__name-sub">{s.name}</span></td>
                  <td className="mono">{s.operatingMode}</td>
                  <td className="mono">{pct} %</td>
                  <td className="mono">{s.meanDurationHours.toLocaleString("en-US")}</td>
                  <td className="mono">{count}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function MethodsScreen(): JSX.Element {
  const { ie } = useIeWorkbook();
  const methodIds = new Set<string>();
  for (const i of ie.initiators) for (const m of i.identificationMethodIds) methodIds.add(m);
  const registryOrder = Object.keys(METHOD_REGISTRY);
  const byMethod = Array.from(methodIds)
    .sort((a, b) => {
      const ia = registryOrder.indexOf(a);
      const ib = registryOrder.indexOf(b);
      if (ia === -1 && ib === -1) return a.localeCompare(b);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    })
    .map((m) => ({
      id: m,
      spec: methodSpec(m),
      count: ie.initiators.filter((i) => i.identificationMethodIds.includes(m)).length,
    }));
  return (
    <>
      <div className="posstats">
        <Stat num={methodIds.size} cap="Methods registered" />
        <Stat num={`${ie.completenessSearch.functionalCategoriesCovered.length} / 7`} cap="Categories covered" kind="ok" />
        <Stat num={ie.initiators.length} cap="Initiators yielded" sub="Before grouping" />
        <Stat num={ie.initiatingEventGroups.length} cap="Groups" />
      </div>
      <div className="poscard">
        <div className="poscard__head"><h3 className="poscard__title">Systematic search methods</h3></div>
        {byMethod.length === 0 ? <p className="posmuted" style={{ margin: 0 }}>No methods recorded yet.</p> : (
          <div className="iemethod-grid">
            {byMethod.map((m) => {
              const Ico = IEIcon[m.spec.icon as keyof typeof IEIcon] ?? IEIcon.Network;
              return (
                <div key={m.id} className="iemethod">
                  <div className="iemethod__head">
                    <span className="iemethod__icon"><Ico /></span>
                    <div className="iemethod__title-block">
                      <div className="iemethod__name">{m.spec.name.length > 0 ? m.spec.name : m.id}</div>
                    </div>
                    {m.spec.statusMessage === undefined
                      ? <Badge kind="ok">Ready</Badge>
                      : <Badge kind="warn">Needs attention</Badge>}
                  </div>
                  {m.spec.scope.length > 0 && <div className="iemethod__scope">{m.spec.scope}</div>}
                  {m.spec.note.length > 0 && <p className="iemethod__note">{m.spec.note}</p>}
                  <div className="iemethod__foot">
                    {m.spec.coverage.length > 0 && <span className="poschip">{m.spec.coverage}</span>}
                    <span className="poscomment__foot-spacer" />
                    <span className="posmono possubtle">{m.count} initiators</span>
                  </div>
                  {m.spec.statusMessage !== undefined && (
                    <div className="iewarn-note"><span className="iewarn-note__icon"><IEIcon.Warn /></span><span>{m.spec.statusMessage}</span></div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

function IdentifyScreen(): JSX.Element {
  const { ie } = useIeWorkbook();
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const initiators = ie.initiators;
  const shown = activeCat !== null ? initiators.filter((i) => i.category === activeCat) : initiators;
  const retained = initiators.filter((i) => i.screeningStatus === "RETAINED").length;
  const merged = initiators.filter((i) => i.screeningStatus === "MERGED").length;
  const screened = initiators.filter((i) => i.screeningStatus === "SCREENED_OUT").length;
  const total = initiators.length;
  const cat = activeCat !== null ? categoryById(activeCat) : undefined;

  return (
    <>
      <div className="posstats">
        <Stat num={total} cap="Initiators identified" sub="Across 7 categories" />
        <Stat num={retained} cap="Retained" kind="ok" />
        <Stat num={merged} cap="Grouped" sub="Bounded by a group" />
        <Stat num={screened} cap="Screened out" sub="With justification" />
      </div>

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
                  <span className="iespectrum__leg-n">{n}</span>
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
  const checks: { label: string; ok: boolean; icon: string; detail: string; meta: string }[] = [
    { label: "All seven functional categories covered", ok: cs.functionalCategoriesCovered.length >= 7, ...COMPLETENESS_CHECK_META[0], meta: COMPLETENESS_CHECK_META[0].meta(cs) },
    { label: "Per-system search performed", ok: cs.perSystemSearchPerformed, ...COMPLETENESS_CHECK_META[1], meta: COMPLETENESS_CHECK_META[1].meta(cs) },
    { label: "Per-support-system search performed", ok: cs.perSupportSystemSearchPerformed, ...COMPLETENESS_CHECK_META[2], meta: COMPLETENESS_CHECK_META[2].meta(cs) },
    { label: "Radioactive-source mechanisms addressed", ok: cs.radioactiveSourceMechanismsAddressed, ...COMPLETENESS_CHECK_META[3], meta: COMPLETENESS_CHECK_META[3].meta(cs) },
    { label: "Multi-reactor / shared-source events addressed", ok: cs.multiReactorEventsAddressed, ...COMPLETENESS_CHECK_META[4], meta: COMPLETENESS_CHECK_META[4].meta(cs) },
  ];
  return (
    <>
      <div className="posstats">
        <Stat num={`${cs.functionalCategoriesCovered.length} / 7`} cap="Functional categories" kind={cs.functionalCategoriesCovered.length >= 7 ? "ok" : "warn"} />
        <Stat num={cs.perSystemSearchPerformed ? "Yes" : "No"} cap="Per-system sweep" />
        <Stat num={cs.perSupportSystemSearchPerformed ? "Yes" : "No"} cap="Support-system sweep" />
        <Stat num={cs.radioactiveSourceMechanismsAddressed ? "Yes" : "No"} cap="Source mechanisms" />
      </div>
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
  const allCombinations = hazards.flatMap((h) => h.potentialCombinations.map((c) => ({ source: h.name, text: c })));
  return (
    <>
      <div className="posstats">
        <Stat num={hazards.length} cap="Hazard analyses" />
        <Stat num={hazards.filter((h) => h.hazardType === "INTERNAL").length} cap="Internal" />
        <Stat num={hazards.filter((h) => h.hazardType === "EXTERNAL").length} cap="External" />
        <Stat num={hazards.reduce((a, h) => a + h.inducedInitiatorIds.length, 0)} cap="Induced initiators" />
      </div>
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
                    <span className="possubtle" style={{ fontSize: 12 }}>Induces {h.inducedInitiatorIds.length > 0 ? h.inducedInitiatorIds.join(", ") : "none"}</span>
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
          <p className="poscard__sub">Hazard combinations must be considered explicitly (IE-A6).</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {allCombinations.map((c, i) => (
              <div key={i} className="iecombo">
                <div className="iecombo__source">{c.source}</div>
                <p className="iecombo__text">{c.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function GroupingScreen(): JSX.Element {
  const { ie } = useIeWorkbook();
  const groups: InitiatingEventGroup[] = ie.initiatingEventGroups;
  const bounded = groups.filter((g) => g.groupingDoesNotMaskRiskSignificantSequences).length;
  return (
    <>
      <div className="posstats">
        <Stat num={groups.length} cap="Initiating-event groups" />
        <Stat num={bounded} cap="Fully bounded" kind="ok" />
        <Stat num={groups.length - bounded} cap="Anti-masking open" kind={groups.length - bounded > 0 ? "warn" : "ok"} />
        <Stat num="CC-II" cap="Grouping rule" />
      </div>

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
  const screenedOut = records.filter((r) => !r.retained).length;
  const blocked = records.filter((r) => r.retained && !r.barrierIntegrityPreconditionMet).length;
  return (
    <>
      <div className="posstats">
        <Stat num={records.length} cap="Events evaluated" />
        <Stat num={screenedOut} cap="Screened out" sub="SCR-justified" />
        <Stat num={blocked} cap="Blocked at barrier gate" kind="block" />
        <Stat num="IE-C9" cap="Screening rule" sub="Barrier gate + SCR" />
      </div>
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
  const weighted = records.filter((r) => r.posTimeFractionApplied).length;
  const ticks = ["1e-6", "1e-5", "1e-4", "1e-3", "1e-2", "1e-1", "1e0"];
  return (
    <>
      <div className="posstats">
        <Stat num={records.length} cap="Quantified events / groups" />
        <Stat num="plant-yr" cap="Frequency basis" sub="IE-C8 · calendar-year" kind="ok" />
        <Stat num={`${weighted} / ${records.length}`} cap="POS-time-fraction applied" />
        <Stat num={ie.initiatingEventGroups.length} cap="Groups quantified" />
      </div>
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
    ["Executive summary", "4"],
    ["Introduction", "5"],
    ["    Purpose & scope", "5"],
    ["    Interfaces (POS upstream · ES / ESQ downstream)", "6"],
    ["    Quality assurance & freeze date", "6"],
    ["Sources of radioactive material", "7"],
    ["Identification of initiating events", "9"],
    ["    Search methods", "9"],
    ["    Challenge categories (IE-A5)", "11"],
    ["    Completeness assessment", "16"],
    ["    Hazard-induced initiators", "18"],
    ["Grouping of initiating events", "21"],
    ["Screening of initiating events", "24"],
    ["Initiating-event frequencies", "27"],
    ["    Quantification approach (per-POS weighting)", "27"],
    ["    Data sources & uncertainty", "30"],
    ["Model uncertainty & assumptions", "33"],
    ["References", "36"],
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
  StatesScreen,
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
