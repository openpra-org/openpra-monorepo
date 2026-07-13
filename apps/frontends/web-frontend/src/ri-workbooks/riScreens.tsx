import { JSX, useState } from "react";
import { type RiskIntegration } from "interfaces-mef-types/ri/risk-integration";
import { RIIcon } from "./riIcons";
import { Badge, RiProvenanceChip, valText } from "./riShared";
import { useRiWorkbook } from "./riWorkbookContext";
import {
  APPLICATION_TYPES,
  CAPABILITY_CATEGORIES,
  PLANT_STAGES,
  type PlantStageId,
  REPORTING_FLOOR_NOTES,
  FC_META,
  CCDF_NOTE,
  type AppTypeId,
} from "./riViewData";
import { riHandoffView, fcPointsView, ccdfPointsView, metricRollup, type FcPointView } from "./riSelectors";

interface RiDrawerContext {
  kind: "family" | "measures" | "criteria" | "floors" | "calc" | "metric" | "aggregation" | "hazardgroup" | "grouping" | "contributor" | "contribbasis" | "musource" | "screened" | "propagation" | "sensitivity" | "dispatch" | "method";
  id: string;
}

// ─── Log-scale helpers for the plots ───────────────────────────────────────
function log10(v: number): number {
  return Math.log(v) / Math.LN10;
}
function scaleLog(v: number, min: number, max: number, lo: number, hi: number): number {
  const t = (log10(v) - log10(min)) / (log10(max) - log10(min));
  return lo + t * (hi - lo);
}
function expTick(p: number): string {
  return `1E${p < 0 ? "" : "+"}${p}`;
}

// ─── 01 — Scope (RI-B1) ────────────────────────────────────────────────────
type RiScope = RiskIntegration["scopeDefinition"];

function RiInterfaces(): JSX.Element {
  const { ri } = useRiWorkbook();
  const lanes = riHandoffView(ri);
  const [selectedTe, setSelectedTe] = useState<string | null>(null);
  const selectedLane = lanes.find((l) => l.code === selectedTe);

  return (
    <>
      <div className="poshandoff__grid">
        {lanes.map((lane) => (
          <button
            key={lane.code}
            type="button"
            className={`poshandoff__tile${selectedTe === lane.code ? " poshandoff__tile--active" : ""}`}
            onClick={() => setSelectedTe(selectedTe === lane.code ? null : lane.code)}
          >
            <span className="poshandoff__tile-code">{lane.code}</span>
            <span className="poshandoff__tile-name">{lane.element}</span>
            <span className="poshandoff__tile-role">{lane.role}</span>
          </button>
        ))}
      </div>
      {selectedLane !== undefined && (
        <div style={{ marginTop: 16 }}>
          <div className="possubtle" style={{ fontWeight: 700, color: "var(--color-text)", marginBottom: 8 }}>
            {selectedLane.direction === "out" ? `${selectedLane.element} receives` : `Risk Integration receives from ${selectedLane.element}`}
          </div>
          {selectedLane.rows.length === 0 ? (
            <p className="posmuted" style={{ margin: 0 }}>No families compiled yet.</p>
          ) : (
            <table className="postable postable--mid">
              <thead>
                <tr>{selectedLane.columns.map((c) => <th key={c}>{c}</th>)}</tr>
              </thead>
              <tbody>
                {selectedLane.rows.map((r) => (
                  <tr key={r.id}>
                    <td><div className="postable__name">{r.name}</div></td>
                    {r.values.map((v, idx) => <td key={selectedLane.columns[idx + 1] ?? `c${idx}`} className="mono">{v}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </>
  );
}

function ConvergeScreen(): JSX.Element {
  const { ri, editable, mutateRi } = useRiWorkbook();
  const scope = ri.scopeDefinition;
  const ccId = ri.capabilityCategory === "CC-I" ? "cc-i" : "cc-ii";
  const stage: PlantStageId = ri.plantStage === "OPERATIONAL" ? "operational" : "pre_operational";
  const cc = CAPABILITY_CATEGORIES.find((c) => c.id === ccId) ?? CAPABILITY_CATEGORIES[0];
  const dis = !editable;

  function patchScope(fn: (s: RiScope) => RiScope): void {
    if (!editable) return;
    mutateRi((draft) => ({ ...draft, scopeDefinition: fn(draft.scopeDefinition) }));
  }
  function toList(value: string): string[] {
    return value.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
  }
  function onScopeChange(value: string): void {
    if (!editable) return;
    mutateRi((draft) => ({ ...draft, praScope: value }));
  }
  function onCcChange(newCcId: string): void {
    if (!editable) return;
    mutateRi((draft) => ({ ...draft, capabilityCategory: newCcId === "cc-i" ? "CC-I" : "CC-II" }));
  }
  function onStageChange(newStage: PlantStageId): void {
    if (!editable) return;
    mutateRi((draft) => ({ ...draft, plantStage: newStage === "operational" ? "OPERATIONAL" : "PRE_OPERATIONAL" }));
  }

  return (
    <>
      <div className="poscard">
        <div className="poscard__head"><h3 className="poscard__title">Interfaces</h3></div>
        <p className="poscard__sub">Risk Integration totals the two pipelines and hands the reporting floor back down. Select an element to see the data exchanged.</p>
        <RiInterfaces />
      </div>

      <div className="poscard">
        <div className="poscard__head"><h3 className="poscard__title">PRA scope</h3></div>
        <p className="poscard__sub">Describe what this risk integration covers and what it excludes.</p>
        <textarea
          className="posfield__textarea"
          placeholder="State the in-scope consequence measures, hazard groups, and explicit exclusions."
          rows={4}
          value={ri.praScope}
          disabled={dis}
          onChange={(e) => onScopeChange(e.target.value)}
        />
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Integration scope</h3>
          <RiProvenanceChip>RI-B1 · B4</RiProvenanceChip>
        </div>
        <p className="poscard__sub">What the integration covers. The consequence measures are set with the significance criteria, and the families, release categories and source terms are compiled from the elements above.</p>
        <div className="posfield-grid">
          <div className="posfield posfield-grid--span2">
            <label className="posfield__label">Hazard groups</label>
            <input className="posfield__input" value={scope.hazardGroups.join(", ")} placeholder="e.g. Internal events, Seismic" disabled={dis} onChange={(e) => patchScope((s) => ({ ...s, hazardGroups: toList(e.target.value) }))} />
          </div>
          <div className="posfield posfield-grid--span2">
            <label className="posfield__label">Plant operating states</label>
            <input className="posfield__input" value={scope.plantOperatingStateRefs.join(", ")} placeholder="e.g. POS-01, POS-02" disabled={dis} onChange={(e) => patchScope((s) => ({ ...s, plantOperatingStateRefs: toList(e.target.value) }))} />
          </div>
          <div className="posfield posfield-grid--span2">
            <label className="posfield__label">Radioactive material sources</label>
            <input className="posfield__input" value={scope.radioactiveMaterialSources.join(", ")} placeholder="e.g. In-core metallic driver fuel" disabled={dis} onChange={(e) => patchScope((s) => ({ ...s, radioactiveMaterialSources: toList(e.target.value) }))} />
          </div>
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Capability category</h3>
          <Badge kind="progress">{cc.tag}</Badge>
        </div>
        <p className="poscard__sub">This sets how detailed the risk integration must be.</p>
        <div className="riopt">
          {CAPABILITY_CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              disabled={dis}
              aria-pressed={c.id === ccId}
              className={`riopt__btn${c.id === ccId ? " riopt__btn--active" : ""}`}
              onClick={() => onCcChange(c.id)}
            >
              <span className="riopt__head">
                <span className="riopt__name">{c.name}</span>
                <span className="riopt__tag">{c.tag}</span>
              </span>
              <span className="riopt__desc">{c.description}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head"><h3 className="poscard__title">Plant stage</h3></div>
        <p className="poscard__sub">This sets which requirements apply and where the plant-response data comes from.</p>
        <div className="riopt">
          {PLANT_STAGES.map((s) => (
            <button
              key={s.id}
              type="button"
              disabled={dis}
              aria-pressed={stage === s.id}
              className={`riopt__btn${stage === s.id ? " riopt__btn--active" : ""}`}
              onClick={() => onStageChange(s.id)}
            >
              <span className="riopt__head">
                <span className="riopt__name">{s.name}</span>
              </span>
              <span className="riopt__desc">{s.description}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

// ─── 02 — Significance Criteria (HLR-RI-A) ─────────────────────────────────
const APP_TYPE_LABEL: Record<string, string> = {
  FIXED_RISK_TARGET: "Fixed risk target",
  BASELINE_RISK: "Baseline risk",
};

const CRITERIA_SOURCE_LABEL: Record<string, string> = {
  TABLE_1_9_1: "Table 1.9-1",
  TABLE_1_9_2: "Table 1.9-2",
  ALTERNATE: "Justified alternate",
};

function nextCriteriaId(list: { uuid: string }[]): string {
  const n = list.reduce((m, x) => {
    const v = Number(x.uuid.split("-").pop());
    return Number.isNaN(v) ? m : Math.max(m, v);
  }, 0) + 1;
  return `CRIT-${String(n)}`;
}

function CriteriaScreen({ appType, setAppType, openDrawer }: {
  appType: AppTypeId;
  setAppType: (a: AppTypeId) => void;
  openDrawer: (ctx: RiDrawerContext) => void;
}): JSX.Element {
  const { ri, editable, mutateRi } = useRiWorkbook();
  const thresholds = ri.reportingThresholds;
  const measures = ri.scopeDefinition.consequenceMeasures;
  const criteria = ri.riskSignificanceCriteria;
  const wantType = appType === "baseline_risk" ? "BASELINE_RISK" : "FIXED_RISK_TARGET";

  function onAppChange(next: AppTypeId): void {
    if (!editable) return;
    setAppType(next);
    const want = next === "baseline_risk" ? "BASELINE_RISK" : "FIXED_RISK_TARGET";
    mutateRi((draft) => {
      const idx = draft.riskSignificanceCriteria.findIndex((c) => c.applicationType === want);
      if (idx <= 0) return draft;
      const arr = [...draft.riskSignificanceCriteria];
      const picked = arr[idx];
      arr.splice(idx, 1);
      return { ...draft, riskSignificanceCriteria: [picked, ...arr] };
    });
  }

  function addCriteria(): void {
    if (!editable) return;
    const uuid = nextCriteriaId(criteria);
    mutateRi((draft) => ({
      ...draft,
      riskSignificanceCriteria: [...draft.riskSignificanceCriteria, {
        uuid,
        name: "New criteria",
        applicationType: "BASELINE_RISK" as const,
        criteriaSource: "TABLE_1_9_1" as const,
        criteriaType: "OTHER",
        metricType: "INDIVIDUAL_LATENT_CANCER_FATALITY_RISK",
        justification: "",
        implementsSrs: [{ sr: "RI-A2", hlr: "A" as const }],
      }],
    }));
    openDrawer({ kind: "criteria", id: uuid });
  }

  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Consequence measures</h3>
          <div className="posrow" style={{ gap: 10 }}>
            <RiProvenanceChip>RI-A1</RiProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => openDrawer({ kind: "measures", id: "measures" })}><RIIcon.Settings /> Edit</button>}
          </div>
        </div>
        <p className="poscard__sub">The consequence measures come from the intended applications, and they set the metric vocabulary for the whole consequence side.</p>
        {measures.length === 0 ? (
          <p className="posmuted" style={{ margin: 0 }}>No consequence measures yet.</p>
        ) : (
          <div className="rimeasure">
            {measures.map((m, i) => (
              <div key={i} className="rimeasure__cell">
                <span className="rinum">{i + 1}</span>
                <div className="rimeasure__main">
                  <div className="rimeasure__name">{m.name}</div>
                  {m.description !== undefined && m.description.length > 0 && <div className="rimeasure__note">{m.description}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Application fork</h3>
          <RiProvenanceChip>RI-A2 · A3</RiProvenanceChip>
        </div>
        <p className="poscard__sub">The criteria depend on the application, and only one branch applies, the relative criteria of A2 or the absolute criteria of A3.</p>
        <div className="riapp">
          {APPLICATION_TYPES.map((a) => {
            const on = appType === a.id;
            return (
              <button key={a.id} type="button" disabled={!editable} aria-pressed={on} className={`riapp__opt${on ? " riapp__opt--active" : ""}`} onClick={() => onAppChange(a.id)}>
                <div className="riapp__opt-head">
                  <div>
                    <div className="riapp__opt-name">{a.name}</div>
                    <div className="riapp__opt-tag">{a.tag} · <span className="riapp__opt-sr">{a.sr}</span></div>
                  </div>
                </div>
                <p className="riapp__opt-desc">{a.desc}</p>
                <span className="riapp__opt-meta">{on ? "Active for this workbook" : "Select this application"}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Risk-significance criteria</h3>
          <div className="posrow" style={{ gap: 10 }}>
            <RiProvenanceChip>RI-A2 · A3</RiProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addCriteria}><RIIcon.Plus /> Add criteria</button>}
          </div>
        </div>
        <p className="poscard__sub">The criteria set the bar every element measures against, from the family down to the basic event. Select a row to edit it.</p>
        {criteria.length === 0 ? (
          <p className="posmuted" style={{ margin: 0 }}>No risk-significance criteria yet.</p>
        ) : (
          <table className="postable postable--mid">
            <thead><tr><th>Criteria</th><th>Application</th><th>Source</th><th>Family bar</th><th>Status</th></tr></thead>
            <tbody>
              {criteria.map((c) => {
                const on = c.applicationType === wantType;
                const bar = c.applicationType === "FIXED_RISK_TARGET"
                  ? c.absoluteThresholds?.eventSequenceFamily
                  : c.relativeThresholds?.eventSequenceFamily;
                return (
                  <tr key={c.uuid} className="postable__row--clickable" style={{ cursor: "pointer" }} onClick={() => openDrawer({ kind: "criteria", id: c.uuid })}>
                    <td>
                      <div className="postable__name">{c.name}</div>
                      <span className="possubtle" style={{ fontSize: 12 }}>{c.description ?? ""}</span>
                    </td>
                    <td className="possubtle" style={{ fontSize: 12.5 }}>{APP_TYPE_LABEL[c.applicationType] ?? c.applicationType}</td>
                    <td className="possubtle" style={{ fontSize: 12.5 }}>{CRITERIA_SOURCE_LABEL[c.criteriaSource] ?? c.criteriaSource}</td>
                    <td className="posmono">{bar !== undefined ? valText(bar) : "—"}</td>
                    <td>{on ? <Badge kind="progress">Active</Badge> : <Badge kind="draft">Inactive</Badge>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Reporting floors</h3>
          <div className="posrow" style={{ gap: 10 }}>
            <RiProvenanceChip>RI-A4 · A5</RiProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => openDrawer({ kind: "floors", id: "floors" })}><RIIcon.Settings /> Edit</button>}
          </div>
        </div>
        <p className="poscard__sub">The two floors are honest about the limits, since below them the PRA cannot believe its own numbers.</p>
        <table className="postable postable--mid">
          <thead><tr><th>Floor</th><th>Value</th><th>Basis</th></tr></thead>
          <tbody>
            <tr>
              <td>
                <div className="postable__name">Minimum reporting frequency</div>
                <span className="possubtle" style={{ fontSize: 12 }}>{REPORTING_FLOOR_NOTES.frequency}</span>
              </td>
              <td className="posmono">{valText(thresholds.minimumReportingFrequencyPerPlantYear)} <span className="possubtle">per plant-year</span></td>
              <td className="possubtle" style={{ fontSize: 12.5 }}>
                {thresholds.frequencyBasis === "STANDARD_DEFAULT" ? "Standard default" : "Justified alternative"}
                {thresholds.frequencyBasis === "JUSTIFIED_ALTERNATIVE" && thresholds.frequencyJustification !== undefined && (
                  <div style={{ marginTop: 3 }}>{thresholds.frequencyJustification}</div>
                )}
              </td>
            </tr>
            <tr>
              <td>
                <div className="postable__name">Minimum reporting consequence</div>
                <span className="possubtle" style={{ fontSize: 12 }}>{REPORTING_FLOOR_NOTES.consequence}</span>
              </td>
              <td>{thresholds.minimumReportingConsequenceDescription}</td>
              <td className="possubtle" style={{ fontSize: 12.5 }}>
                {thresholds.consequenceBasis === "STANDARD_DEFAULT" ? "Standard default" : "Justified alternative"}
                {thresholds.consequenceBasis === "JUSTIFIED_ALTERNATIVE" && thresholds.consequenceJustification !== undefined && (
                  <div style={{ marginTop: 3 }}>{thresholds.consequenceJustification}</div>
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}

// ─── Plot axes, derived from the data so nothing can fall outside the box ───
interface Bounds {
  min: number;
  max: number;
  ticks: number[];
}

function decadeBounds(values: number[], extra: number[]): Bounds {
  const all = [...values, ...extra].filter((v) => v > 0 && Number.isFinite(v));
  if (all.length === 0) return { min: 1e-9, max: 1e0, ticks: [-9, -6, -3, 0] };
  const lo = Math.floor(log10(Math.min(...all)));
  const hi = Math.max(lo + 1, Math.ceil(log10(Math.max(...all))));
  const step = hi - lo > 6 ? 2 : 1;
  const ticks: number[] = [];
  for (let e = lo; e <= hi; e += step) ticks.push(e);
  return { min: Math.pow(10, lo), max: Math.pow(10, hi), ticks };
}

// ─── Label placement, so point names never sit on the line or on each other ──
interface LabelBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

type Anchor = "middle" | "start" | "end";

const LABEL_CANDIDATES: { dx: number; dy: number; anchor: Anchor }[] = [
  { dx: 0, dy: -13, anchor: "middle" },
  { dx: 0, dy: 18, anchor: "middle" },
  { dx: 12, dy: 4, anchor: "start" },
  { dx: -12, dy: 4, anchor: "end" },
  { dx: 12, dy: -9, anchor: "start" },
  { dx: -12, dy: -9, anchor: "end" },
  { dx: 12, dy: 16, anchor: "start" },
  { dx: -12, dy: 16, anchor: "end" },
  { dx: 0, dy: -25, anchor: "middle" },
  { dx: 0, dy: 30, anchor: "middle" },
];

function labelBox(x: number, y: number, text: string, anchor: Anchor): LabelBox {
  const w = text.length * 5.4 + 4;
  const h = 11;
  const x1 = anchor === "middle" ? x - w / 2 : anchor === "start" ? x : x - w;
  return { x1, y1: y - h + 2, x2: x1 + w, y2: y + 2 };
}

function boxesHit(a: LabelBox, b: LabelBox): boolean {
  return a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1;
}

interface Frame {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

function insidePlot(b: LabelBox, f: Frame): boolean {
  return b.x1 >= f.left && b.x2 <= f.right && b.y1 >= f.top && b.y2 <= f.bottom;
}

function clampInto(x: number, y: number, text: string, anchor: Anchor, f: Frame): { x: number; y: number } {
  const b = labelBox(x, y, text, anchor);
  let dx = 0;
  let dy = 0;
  if (b.x1 < f.left) dx = f.left - b.x1;
  else if (b.x2 > f.right) dx = f.right - b.x2;
  if (b.y1 < f.top) dy = f.top - b.y1;
  else if (b.y2 > f.bottom) dy = f.bottom - b.y2;
  return { x: x + dx, y: y + dy };
}

interface PlacedLabel {
  id: string;
  text: string;
  x: number;
  y: number;
  anchor: Anchor;
}

function placeLabels(
  items: { id: string; text: string; cx: number; cy: number }[],
  obstacles: LabelBox[],
  frame: Frame,
): PlacedLabel[] {
  const taken: LabelBox[] = [...obstacles];
  const placed: PlacedLabel[] = [];
  for (const it of items) {
    let best: PlacedLabel | undefined;
    for (const cand of LABEL_CANDIDATES) {
      const x = it.cx + cand.dx;
      const y = it.cy + cand.dy;
      const box = labelBox(x, y, it.text, cand.anchor);
      if (!insidePlot(box, frame)) continue;
      if (taken.some((t) => boxesHit(box, t))) continue;
      best = { id: it.id, text: it.text, x, y, anchor: cand.anchor };
      break;
    }
    if (best === undefined) {
      const cand = LABEL_CANDIDATES[0];
      const c = clampInto(it.cx + cand.dx, it.cy + cand.dy, it.text, cand.anchor, frame);
      best = { id: it.id, text: it.text, x: c.x, y: c.y, anchor: cand.anchor };
    }
    taken.push(labelBox(best.x, best.y, best.text, best.anchor));
    placed.push(best);
  }
  return placed;
}

// ─── The frequency-consequence plot (RI-B2 b) ──────────────────────────────
function FCPlot({ points, axisLabel }: { points: FcPointView[]; axisLabel: string }): JSX.Element {
  const W = 480;
  const H = 360;
  const x0 = 46;
  const x1 = 466;
  const yTop = 16;
  const yBot = 320;
  const { targetFrom, targetTo } = FC_META;
  const xb = decadeBounds(points.map((p) => p.consequence), [targetFrom.dose, targetTo.dose]);
  const yb = decadeBounds(points.map((p) => p.freq), [targetFrom.freq, targetTo.freq]);
  const mx = (d: number): number => scaleLog(d, xb.min, xb.max, x0, x1);
  const my = (f: number): number => scaleLog(f, yb.min, yb.max, yBot, yTop);

  const tx1 = mx(targetFrom.dose);
  const ty1 = my(targetFrom.freq);
  const tx2 = mx(targetTo.dose);
  const ty2 = my(targetTo.freq);

  const obstacles: LabelBox[] = [];
  for (let i = 0; i <= 60; i += 1) {
    const t = i / 60;
    const px = tx1 + (tx2 - tx1) * t;
    const py = ty1 + (ty2 - ty1) * t;
    obstacles.push({ x1: px - 4, y1: py - 4, x2: px + 4, y2: py + 4 });
  }
  for (const p of points) {
    const r = p.sig === "HIGH" ? 10 : 8.5;
    obstacles.push({ x1: mx(p.consequence) - r, y1: my(p.freq) - r, x2: mx(p.consequence) + r, y2: my(p.freq) + r });
  }

  const ordered = [...points].sort((a, b) => b.freq - a.freq);
  const labels = placeLabels(
    ordered.map((p) => ({ id: p.id, text: p.name, cx: mx(p.consequence), cy: my(p.freq) })),
    obstacles,
    { left: x0 + 3, right: x1 - 3, top: yTop + 2, bottom: yBot - 3 },
  );

  return (
    <svg className="rifc__svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Frequency-consequence plot">
      {xb.ticks.map((p) => (<line key={`gx${p}`} className="rifc__grid" x1={mx(Math.pow(10, p))} y1={yTop} x2={mx(Math.pow(10, p))} y2={yBot} />))}
      {yb.ticks.map((p) => (<line key={`gy${p}`} className="rifc__grid" x1={x0} y1={my(Math.pow(10, p))} x2={x1} y2={my(Math.pow(10, p))} />))}
      <line className="rifc__target" x1={tx1} y1={ty1} x2={tx2} y2={ty2} />
      <line className="rifc__axis" x1={x0} y1={yTop} x2={x0} y2={yBot} />
      <line className="rifc__axis" x1={x0} y1={yBot} x2={x1} y2={yBot} />
      {xb.ticks.map((p) => (<text key={`tx${p}`} className="rifc__lab" x={mx(Math.pow(10, p))} y={yBot + 14} textAnchor="middle">{expTick(p)}</text>))}
      {yb.ticks.map((p) => (<text key={`ty${p}`} className="rifc__lab" x={x0 - 6} y={my(Math.pow(10, p)) + 3} textAnchor="end">{expTick(p)}</text>))}
      <text className="rifc__axlab" x={(x0 + x1) / 2} y={H - 2} textAnchor="middle">{axisLabel}</text>
      <text className="rifc__axlab" x={-((yTop + yBot) / 2)} y={12} textAnchor="middle" transform="rotate(-90 0 0)">Frequency (per yr)</text>
      {points.map((pt) => {
        const cls = pt.sig === "HIGH" ? "high" : pt.sig === "MEDIUM" ? "medium" : "low";
        return <circle key={pt.id} className={`rifc__pt rifc__pt--${cls}`} cx={mx(pt.consequence)} cy={my(pt.freq)} r={pt.sig === "HIGH" ? 8 : 6.5} />;
      })}
      {labels.map((l) => (
        <text key={l.id} className="rifc__lab" x={l.x} y={l.y} textAnchor={l.anchor}>{l.text}</text>
      ))}
    </svg>
  );
}

// ─── The exceedance-frequency curve (RI-B2 c, CCDF) ────────────────────────
function CCDFCurve({ points, axisLabel }: { points: { dose: number; exceed: number }[]; axisLabel: string }): JSX.Element {
  const W = 430;
  const H = 250;
  const x0 = 52;
  const x1 = 416;
  const yTop = 16;
  const yBot = 212;
  const xb = decadeBounds(points.map((p) => p.dose), []);
  const yb = decadeBounds(points.map((p) => p.exceed), []);
  const mx = (d: number): number => scaleLog(d, xb.min, xb.max, x0, x1);
  const my = (f: number): number => scaleLog(f, yb.min, yb.max, yBot, yTop);
  const pts = points.map((p) => `${mx(p.dose)},${my(p.exceed)}`).join(" ");
  return (
    <svg className="riccdf__svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Exceedance-frequency curve">
      {xb.ticks.map((p) => (<line key={`gx${p}`} className="riccdf__grid" x1={mx(Math.pow(10, p))} y1={yTop} x2={mx(Math.pow(10, p))} y2={yBot} />))}
      {yb.ticks.map((p) => (<line key={`gy${p}`} className="riccdf__grid" x1={x0} y1={my(Math.pow(10, p))} x2={x1} y2={my(Math.pow(10, p))} />))}
      <polyline className="riccdf__curve" points={pts} />
      <line className="riccdf__axis" x1={x0} y1={yTop} x2={x0} y2={yBot} />
      <line className="riccdf__axis" x1={x0} y1={yBot} x2={x1} y2={yBot} />
      {xb.ticks.map((p) => (<text key={`tx${p}`} className="rifc__lab" x={mx(Math.pow(10, p))} y={yBot + 14} textAnchor="middle">{expTick(p)}</text>))}
      {yb.ticks.map((p) => (<text key={`ty${p}`} className="rifc__lab" x={x0 - 6} y={my(Math.pow(10, p)) + 3} textAnchor="end">{expTick(p)}</text>))}
      <text className="riccdf__lab" x={(x0 + x1) / 2} y={H - 2} textAnchor="middle">{axisLabel}</text>
      <text className="riccdf__lab" x={-((yTop + yBot) / 2)} y={12} textAnchor="middle" transform="rotate(-90 0 0)">Exceedance frequency (per yr)</text>
      {points.map((p, i) => (<circle key={i} className="riccdf__pt" cx={mx(p.dose)} cy={my(p.exceed)} r="3.5" />))}
    </svg>
  );
}

// ─── 03 — Integrate & Compute (HLR-RI-B) ───────────────────────────────────
function nextRimId(list: { uuid: string }[]): string {
  const n = list.reduce((m, x) => {
    const v = Number(x.uuid.split("-").pop());
    return Number.isNaN(v) ? m : Math.max(m, v);
  }, 0) + 1;
  return `RIM-${String(n)}`;
}

function nextMetricId(list: { uuid: string }[]): string {
  const n = list.reduce((m, x) => {
    const v = Number(x.uuid.split("-").pop());
    return Number.isNaN(v) ? m : Math.max(m, v);
  }, 0) + 1;
  return `METRIC-${String(n)}`;
}

function IntegrateScreen({ ccId, openDrawer }: { ccId: string; openDrawer: (ctx: RiDrawerContext) => void }): JSX.Element {
  const { ri, editable, mutateRi } = useRiWorkbook();
  const isCcOne = ccId === "cc-i";
  const results = ri.integratedRiskResults;
  const approach = results.calculationApproach;
  const measures = ri.scopeDefinition.consequenceMeasures;
  const plotMeasure = measures[0]?.name ?? "";
  const fcPoints = fcPointsView(ri, plotMeasure);
  const ccdfPoints = ccdfPointsView(ri, plotMeasure);

  const families = ri.compiledRiskInputs.length;
  const approachBlocks: { label: string; detail: string }[] = [];
  if (approach.sumOfProducts === true) {
    approachBlocks.push({
      label: "Sum of products",
      detail: `${results.metrics.length} risk metric${results.metrics.length === 1 ? "" : "s"} totaled across ${families} compiled famil${families === 1 ? "y" : "ies"}.`,
    });
  }
  if (approach.frequencyConsequencePlots === true) {
    approachBlocks.push({
      label: "Frequency-consequence plot",
      detail: `${fcPoints.length} famil${fcPoints.length === 1 ? "y" : "ies"} plotted against the frequency-consequence target.`,
    });
  }
  if (approach.exceedanceFrequencyCurves === true) {
    approachBlocks.push({
      label: "Exceedance-frequency curve",
      detail: isCcOne
        ? "Not required while the workbook targets CC-I."
        : `${ccdfPoints.length} exceedance level${ccdfPoints.length === 1 ? "" : "s"} drawn from the compiled families.`,
    });
  }
  if (approach.alternativeApproach !== undefined && approach.alternativeApproach.length > 0) {
    approachBlocks.push({ label: "Alternative approach", detail: approach.alternativeApproach });
  }

  function addMethod(): void {
    if (!editable) return;
    const uuid = nextRimId(ri.integrationMethods);
    mutateRi((draft) => ({
      ...draft,
      integrationMethods: [...draft.integrationMethods, {
        uuid,
        name: "New integration method",
        description: "",
        scopeJustification: "",
        verificationStatus: { verified: false },
        implementsSrs: [{ sr: "RI-B2", hlr: "B" as const }, { sr: "RI-B7", hlr: "B" as const }],
      }],
    }));
    openDrawer({ kind: "method", id: uuid });
  }

  function addMetric(): void {
    if (!editable) return;
    const uuid = nextMetricId(results.metrics);
    mutateRi((draft) => ({
      ...draft,
      integratedRiskResults: {
        ...draft.integratedRiskResults,
        metrics: [...draft.integratedRiskResults.metrics, {
          uuid,
          name: "New risk metric",
          metricType: "CUSTOM",
          consequenceMeasureRef: measures[0]?.name ?? "",
          value: 0,
          units: "per plant-year",
          implementsSrs: [{ sr: "RI-B2", hlr: "B" as const }],
        }],
      },
    }));
    openDrawer({ kind: "metric", id: uuid });
  }

  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Calculation approach</h3>
          <div className="posrow" style={{ gap: 10 }}>
            <Badge kind="progress">{results.calculationLevel === "MEAN" ? "Mean" : "Point estimate"}</Badge>
            <RiProvenanceChip>RI-B2</RiProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => openDrawer({ kind: "calc", id: "calc" })}><RIIcon.Settings /> Edit</button>}
          </div>
        </div>
        <p className="poscard__sub">The integrated risk is totaled, plotted and, at CC-II, drawn as an exceedance curve. These are the routes this integration takes.</p>
        {approachBlocks.length === 0 ? (
          <p className="posmuted" style={{ margin: 0 }}>No calculation approach recorded yet.</p>
        ) : (
          <div className="rimeasure">
            {approachBlocks.map((a, i) => (
              <div key={a.label} className="rimeasure__cell">
                <span className="rinum">{i + 1}</span>
                <div className="rimeasure__main">
                  <div className="rimeasure__name">{a.label}</div>
                  <div className="rimeasure__note">{a.detail}</div>
                </div>
              </div>
            ))}
          </div>
        )}
        {approach.justification.length > 0 && (
          <p className="possubtle" style={{ fontSize: 12.5, lineHeight: 1.5, margin: "12px 0 0" }}>{approach.justification}</p>
        )}
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Methods and codes</h3>
          <div className="posrow" style={{ gap: 10 }}>
            <RiProvenanceChip>RI-B7</RiProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addMethod}><RIIcon.Plus /> Add method</button>}
          </div>
        </div>
        <p className="poscard__sub">The integration methods and codes are identified with their scope of applicability and their verification. Select a row to edit it.</p>
        {ri.integrationMethods.length === 0 ? (
          <p className="posmuted" style={{ margin: 0 }}>No integration methods recorded yet.</p>
        ) : (
          <table className="postable postable--mid">
            <thead><tr><th>Method</th><th>Scope of applicability</th><th>Verification</th></tr></thead>
            <tbody>
              {ri.integrationMethods.map((m) => (
                <tr key={m.uuid} className="postable__row--clickable" style={{ cursor: "pointer" }} onClick={() => openDrawer({ kind: "method", id: m.uuid })}>
                  <td>
                    <div className="postable__name">{m.name}</div>
                    <span className="possubtle" style={{ fontSize: 12 }}>{m.description ?? ""}</span>
                  </td>
                  <td className="possubtle" style={{ fontSize: 12.5 }}>{m.scopeJustification}</td>
                  <td>{m.verificationStatus?.verified === true ? <Badge kind="ok">Verified</Badge> : <Badge kind="warn">Not verified</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Frequency-consequence plot</h3>
          <RiProvenanceChip>RI-B2</RiProvenanceChip>
        </div>
        <p className="poscard__sub">Every family plots its consequence against its frequency, and the target is the diagonal the families are judged against. Select a family to edit it.</p>
        {fcPoints.length === 0 ? (
          <p className="posmuted" style={{ margin: 0 }}>No families compiled yet.</p>
        ) : (
          <>
            <div className="rifc__legend rifc__legend--top">
              <div className="rifc__legend-item"><span className="rifc__legend-dot rifc__legend-dot--high" /> High significance</div>
              <div className="rifc__legend-item"><span className="rifc__legend-dot rifc__legend-dot--medium" /> Medium significance</div>
              <div className="rifc__legend-item"><span className="rifc__legend-dot rifc__legend-dot--low" /> Low significance</div>
              <div className="rifc__legend-item"><span className="rifc__legend-dot rifc__legend-dot--target" /> Frequency-consequence target</div>
            </div>
            <div className="rifc__center">
              <div className="rifc__plot"><FCPlot points={fcPoints} axisLabel={plotMeasure} /></div>
            </div>
            <table className="postable postable--mid" style={{ marginTop: 14 }}>
              <thead><tr><th>Family</th><th>Frequency</th><th>{plotMeasure}</th><th>Significance</th></tr></thead>
              <tbody>
                {fcPoints.map((p) => (
                  <tr key={p.id} className="postable__row--clickable" style={{ cursor: "pointer" }} onClick={() => openDrawer({ kind: "family", id: p.id })}>
                    <td><div className="postable__name">{p.name}</div></td>
                    <td className="posmono">{valText(p.freq)} <span className="possubtle">per plant-year</span></td>
                    <td className="posmono">{valText(p.consequence)}</td>
                    <td>
                      {p.sig === "HIGH" && <Badge kind="block">High</Badge>}
                      {p.sig === "MEDIUM" && <Badge kind="warn">Medium</Badge>}
                      {p.sig === "LOW" && <Badge kind="draft">Low</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Exceedance-frequency curve</h3>
          <RiProvenanceChip>RI-B2</RiProvenanceChip>
        </div>
        <p className="poscard__sub">The curve is built from the compiled families, giving the frequency of exceeding each level of {plotMeasure.length > 0 ? plotMeasure.toLowerCase() : "the consequence measure"}.</p>
        {isCcOne ? (
          <p className="posmuted" style={{ margin: 0 }}>The exceedance-frequency curve is a CC-II approach, so it is not required while the workbook targets CC-I.</p>
        ) : ccdfPoints.length === 0 ? (
          <p className="posmuted" style={{ margin: 0 }}>No families compiled yet.</p>
        ) : (
          <>
            <div className="rifc__center"><div className="rifc__plot"><CCDFCurve points={ccdfPoints} axisLabel={plotMeasure} /></div></div>
            <table className="postable postable--mid" style={{ marginTop: 14 }}>
              <thead><tr><th>{plotMeasure} at or above</th><th>Exceedance frequency</th></tr></thead>
              <tbody>
                {[...ccdfPoints].reverse().map((p) => (
                  <tr key={p.dose}>
                    <td className="posmono">{valText(p.dose)}</td>
                    <td className="posmono">{valText(p.exceed)} <span className="possubtle">per plant-year</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Integrated risk</h3>
          <div className="posrow" style={{ gap: 10 }}>
            <RiProvenanceChip>RI-B2</RiProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addMetric}><RIIcon.Plus /> Add metric</button>}
          </div>
        </div>
        <p className="poscard__sub">The integrated risk is the single number the whole standard has been assembling, judged against the target for the application. Select a row to edit it.</p>
        {results.metrics.length === 0 ? (
          <p className="posmuted" style={{ margin: 0 }}>No risk metrics yet.</p>
        ) : (
          <>
            <table className="postable postable--mid">
              <thead><tr><th>Metric</th><th>Value</th><th>Target</th><th>Status</th></tr></thead>
              <tbody>
                {results.metrics.map((m) => {
                  const roll = metricRollup(ri, m);
                  return (
                    <tr key={m.uuid} className="postable__row--clickable" style={{ cursor: "pointer" }} onClick={() => openDrawer({ kind: "metric", id: m.uuid })}>
                      <td>
                        <div className="postable__name">{m.name}</div>
                        <span className="possubtle" style={{ fontSize: 12 }}>{m.consequenceMeasureRef !== undefined && m.consequenceMeasureRef.length > 0 ? `Sums ${m.consequenceMeasureRef.toLowerCase()}` : "No consequence measure linked"}</span>
                      </td>
                      <td className="posmono">{valText(m.value)} <span className="possubtle">{m.units}</span></td>
                      <td className="posmono">{roll.limit !== undefined ? valText(roll.limit) : "—"}</td>
                      <td>{roll.limit === undefined ? <Badge kind="draft">Reported</Badge> : roll.compliant ? <Badge kind="ok">Below target</Badge> : <Badge kind="warn">Check margin</Badge>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}
      </div>
    </>
  );
}

export { ConvergeScreen, CriteriaScreen, IntegrateScreen, type RiDrawerContext };
