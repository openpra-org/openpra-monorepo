import { JSX } from "react";
import { RIIcon } from "./riIcons";
import { Badge, RiProvenanceChip, valText } from "./riShared";
import { useRiWorkbook } from "./riWorkbookContext";
import {
  RI_UPSTREAM_LINKS,
  APPLICATION_TYPES,
  SCOPE_POS_TEXT,
  SCOPE_NOTE,
  FAMILY_NAMES,
  CONSEQUENCE_MEASURE_META,
  CRITERIA_LEVELS,
  REPORTING_FLOOR_NOTES,
  CALC_APPROACHES,
  FC_META,
  CCDF_NOTE,
  SIG_LABELS,
  type AppTypeId,
  type LinkSpec,
} from "./riViewData";
import { familySignificance, consequenceOf } from "./riSelectors";

interface RiDrawerContext {
  kind: "family";
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

// ─── Small upstream input card (the two pipelines) ─────────────────────────
function UpstreamCard({ u }: { u: LinkSpec }): JSX.Element {
  const Icon = RIIcon[u.icon] ?? RIIcon.Boxes;
  const statusKind = u.status === "approved" ? "ok" : u.status === "in_review" ? "progress" : "draft";
  const statusLabel = u.status === "approved" ? "Approved" : u.status === "in_review" ? "In review" : "Draft";
  return (
    <div className={`ricard ricard--${u.tone}`}>
      <div className="posrow" style={{ gap: 10, alignItems: "center" }}>
        <span className={`ricard__badge ricard__badge--${u.tone}`}><Icon /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 13 }}>{u.element}</div>
          <div className="possubtle" style={{ fontSize: 11 }}>{u.role}</div>
        </div>
        <Badge kind={statusKind}>{statusLabel}</Badge>
      </div>
      <p className="possubtle" style={{ fontSize: 11.5, lineHeight: 1.45, margin: 0 }}>{u.delivers}</p>
      <div className="posrow" style={{ gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <span className="poschip posmono">{u.code} v{u.version}</span>
        <span className="possubtle" style={{ fontSize: 11 }}>{u.count} · synced {u.synced}</span>
      </div>
    </div>
  );
}

// ─── 01 — Scope & Convergence (RI-B1) ──────────────────────────────────────
function ConvergeScreen({ openDrawer }: { openDrawer: (ctx: RiDrawerContext) => void }): JSX.Element {
  const { ri } = useRiWorkbook();
  const scope = ri.scopeDefinition;
  const latentMetric = ri.integratedRiskResults.metrics[0];
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Upstream inputs</h3>
          <RiProvenanceChip>RI-B1</RiProvenanceChip>
        </div>
        <p className="poscard__sub">RI compiles two pipelines, the family frequencies from ESQ and the family consequences from RC.</p>
        <div className="rigrid--2">
          {RI_UPSTREAM_LINKS.map((u) => <UpstreamCard key={u.id} u={u} />)}
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">The risk equation</h3>
          <RiProvenanceChip>RI-B1 · B2</RiProvenanceChip>
        </div>
        <p className="poscard__sub">The frequency jaw and the consequence jaw finally close, and RI multiplies them into the integrated risk.</p>
        <div className="rieq">
          <div className="rieq__term rieq__term--freq">
            <span className="rieq__cap">Frequency jaw</span>
            <span className="rieq__val">{ri.compiledRiskInputs.length} families</span>
            <span className="rieq__sub">The family frequencies from HLR-ESQ-D.</span>
            <span className="rieq__src">ESQ · RI-B1</span>
          </div>
          <div className="rieq__op">&times;</div>
          <div className="rieq__term rieq__term--cons">
            <span className="rieq__cap">Consequence jaw</span>
            <span className="rieq__val">{scope.releaseCategoryRefs?.length ?? 0} categories</span>
            <span className="rieq__sub">The consequence table from HLR-RCQ-D.</span>
            <span className="rieq__src">RC · RI-B1</span>
          </div>
          <div className="rieq__op">=</div>
          <div className="rieq__term rieq__term--risk">
            <span className="rieq__cap">Integrated risk</span>
            <span className="rieq__val">{valText(latentMetric?.value)}</span>
            <span className="rieq__sub">Per plant-year latent cancer risk.</span>
            <span className="rieq__src">RI-B2</span>
          </div>
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Integration scope</h3>
          <RiProvenanceChip>RI-B1 · B4</RiProvenanceChip>
        </div>
        <p className="poscard__sub">The scope sets what the integration covers, the measures, the states, the hazards and the sources.</p>
        <div className="posfield-grid">
          <div className="posfield">
            <label className="posfield__label">Consequence measures</label>
            <div className="posrow posrow--wrap" style={{ gap: 6 }}>
              {scope.consequenceMeasures.map((m) => <span key={m} className="poschip">{m}</span>)}
            </div>
          </div>
          <div className="posfield">
            <label className="posfield__label">Hazard groups</label>
            <div className="posrow posrow--wrap" style={{ gap: 6 }}>
              {scope.hazardGroups.map((h) => <span key={h} className="poschip">{h}</span>)}
            </div>
          </div>
          <div className="posfield"><label className="posfield__label">Plant operating states</label><div style={{ fontSize: 12.5 }}>{SCOPE_POS_TEXT}</div></div>
          <div className="posfield"><label className="posfield__label">Radioactive sources</label><div style={{ fontSize: 12.5 }}>{scope.radioactiveMaterialSources.join(", ")}</div></div>
          <div className="posfield"><label className="posfield__label">Families compiled</label><div className="posmono" style={{ fontWeight: 700 }}>{ri.compiledRiskInputs.length}</div></div>
          <div className="posfield"><label className="posfield__label">Release categories</label><div className="posmono" style={{ fontWeight: 700 }}>{scope.releaseCategoryRefs?.length ?? 0}</div></div>
        </div>
        <div className="hrnote" style={{ marginTop: 12 }}>
          <RIIcon.Gauge />
          <span>{SCOPE_NOTE}</span>
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Compiled inputs</h3>
          <RiProvenanceChip>RI-B1</RiProvenanceChip>
        </div>
        <p className="poscard__sub">Each family carries a frequency from ESQ and a consequence from the release category that bounds it.</p>
        <div className="rifam">
          {ri.compiledRiskInputs.map((f) => {
            const sig = familySignificance(ri, f.eventSequenceFamilyRef);
            const sigCls = sig === "HIGH" ? "high" : sig === "MEDIUM" ? "medium" : "low";
            const latent = consequenceOf(f, "Latent cancer risk");
            return (
              <div key={f.uuid} className={`rifam__card${sig === "LOW" ? " rifam__card--low" : ""}`} onClick={() => openDrawer({ kind: "family", id: f.eventSequenceFamilyRef })}>
                <div className="rifam__head">
                  <div className="rifam__head-main">
                    <div className="rifam__id posmono">{f.eventSequenceFamilyRef}{f.releaseCategoryRef !== undefined ? ` · bounds ${f.releaseCategoryRef}` : ""}</div>
                    <div className="rifam__name">{FAMILY_NAMES[f.eventSequenceFamilyRef] ?? f.eventSequenceFamilyRef}</div>
                  </div>
                  <span className={`rifam__sig rifam__sig--${sigCls}`}>{SIG_LABELS[sig]}</span>
                </div>
                <div className="rifam__jaws">
                  <div className="rifam__jaw rifam__jaw--freq">
                    <span className="rifam__jaw-k"><RIIcon.Tree /> Frequency</span>
                    <span className="rifam__jaw-v posmono">{valText(f.frequency)}</span>
                    <span className="rifam__jaw-u">per plant-year</span>
                  </div>
                  <div className="rifam__jaw rifam__jaw--cons">
                    <span className="rifam__jaw-k"><RIIcon.Wind /> Consequence</span>
                    <span className="rifam__jaw-v posmono">{valText(latent)}</span>
                    <span className="rifam__jaw-u">latent risk per event</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="hrnote" style={{ marginTop: 12 }}>
          <RIIcon.Sigma />
          <span>The two early-release families drive the total, since they pair a mid frequency with the highest consequence.</span>
        </div>
      </div>
    </>
  );
}

// ─── 02 — Significance Criteria (HLR-RI-A) ─────────────────────────────────
function CriteriaScreen({ appType, setAppType }: { appType: AppTypeId; setAppType: (a: AppTypeId) => void }): JSX.Element {
  const { ri } = useRiWorkbook();
  const activeApp = APPLICATION_TYPES.find((a) => a.id === appType) ?? APPLICATION_TYPES[0];
  const thresholds = ri.reportingThresholds;
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Consequence measures</h3>
          <RiProvenanceChip>RI-A1</RiProvenanceChip>
        </div>
        <p className="poscard__sub">The consequence measures come from the intended applications, and they set the metric vocabulary for the whole consequence side.</p>
        <div className="rimeasure">
          {ri.scopeDefinition.consequenceMeasures.map((m) => {
            const meta = CONSEQUENCE_MEASURE_META[m];
            const Icon = RIIcon[meta?.icon ?? "Activity"] ?? RIIcon.Activity;
            return (
              <div key={m} className="rimeasure__cell">
                <span className="rimeasure__icon"><Icon /></span>
                <div className="rimeasure__main">
                  <div className="rimeasure__name">{m}</div>
                  <div className="rimeasure__note">{meta?.note ?? "A consequence measure from the intended application."}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Application fork</h3>
          <RiProvenanceChip>RI-A2 · A3</RiProvenanceChip>
        </div>
        <p className="poscard__sub">The criteria depend on the application, and only one branch applies, the relative criteria of A2 or the absolute criteria of A3.</p>
        <div className="riapp">
          {APPLICATION_TYPES.map((a) => {
            const Icon = RIIcon[a.icon] ?? RIIcon.Target;
            const active = appType === a.id;
            return (
              <button key={a.id} type="button" className={`riapp__opt${active ? " riapp__opt--active" : ""}`} onClick={() => setAppType(a.id)}>
                <div className="riapp__opt-head">
                  <span className="riapp__opt-icon"><Icon /></span>
                  <div>
                    <div className="riapp__opt-name">{a.name}</div>
                    <div className="riapp__opt-tag">{a.tag} · <span className="riapp__opt-sr">{a.sr}</span></div>
                  </div>
                </div>
                <p className="riapp__opt-desc">{a.desc}</p>
                <span className="riapp__opt-meta">{active ? <><RIIcon.Check /> Active for this workbook</> : <><RIIcon.ArrowR /> Select this application</>}</span>
              </button>
            );
          })}
        </div>
        <div className="hrnote" style={{ marginTop: 12 }}>
          <RIIcon.Filter />
          <span>{activeApp.meta}</span>
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Risk-significance criteria by level</h3>
          <RiProvenanceChip>{activeApp.sr}</RiProvenanceChip>
        </div>
        <p className="poscard__sub">The criteria set the bar every element measures against, from the family down to the basic event.</p>
        <div className="ricrit">
          {CRITERIA_LEVELS.map((c) => (
            <div key={c.id} className="ricrit__row">
              <div className="ricrit__main">
                <div className="ricrit__label">{c.level}</div>
                <div className="ricrit__label-note">{c.note}</div>
              </div>
              <span className="ricrit__val">{appType === "fixed_risk_target" ? c.absolute : c.relative}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Reporting floors</h3>
          <RiProvenanceChip>RI-A4 · A5</RiProvenanceChip>
        </div>
        <p className="poscard__sub">The two floors are honest about the limits, since below them the PRA cannot believe its own numbers.</p>
        <div className="rifloor">
          <div className="rifloor__card">
            <span className="rifloor__cap">Minimum reporting frequency</span>
            <span className="rifloor__val">{valText(thresholds.minimumReportingFrequencyPerPlantYear)} <span className="rifloor__val-unit">per plant-year</span></span>
            <p className="rifloor__note">{REPORTING_FLOOR_NOTES.frequency}</p>
            <span className="rifloor__basis">{thresholds.frequencyBasis === "STANDARD_DEFAULT" ? "Standard default" : thresholds.frequencyJustification ?? "Justified alternative"}</span>
          </div>
          <div className="rifloor__card">
            <span className="rifloor__cap">Minimum reporting consequence</span>
            <span className="rifloor__val">{thresholds.minimumReportingConsequenceDescription}</span>
            <p className="rifloor__note">{REPORTING_FLOOR_NOTES.consequence}</p>
            <span className="rifloor__basis">{thresholds.consequenceBasis === "STANDARD_DEFAULT" ? "Standard default" : thresholds.consequenceJustification ?? "Justified alternative"}</span>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── The frequency-consequence plot (RI-B2 b) ──────────────────────────────
interface FcPoint {
  id: string;
  dose: number;
  freq: number;
  sig: "HIGH" | "MEDIUM" | "LOW";
}

function FCPlot({ points }: { points: FcPoint[] }): JSX.Element {
  const W = 480;
  const H = 360;
  const x0 = 46;
  const x1 = 466;
  const yTop = 16;
  const yBot = 320;
  const { xMin, xMax, yMin, yMax, targetFrom, targetTo } = FC_META;
  const mx = (d: number): number => scaleLog(d, xMin, xMax, x0, x1);
  const my = (f: number): number => scaleLog(f, yMin, yMax, yBot, yTop);
  const xTicks = [-7, -5, -3, -1];
  const yTicks = [-9, -7, -5];
  return (
    <svg className="rifc__svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Frequency-consequence plot">
      {xTicks.map((p) => (<line key={`gx${p}`} className="rifc__grid" x1={mx(Math.pow(10, p))} y1={yTop} x2={mx(Math.pow(10, p))} y2={yBot} />))}
      {yTicks.map((p) => (<line key={`gy${p}`} className="rifc__grid" x1={x0} y1={my(Math.pow(10, p))} x2={x1} y2={my(Math.pow(10, p))} />))}
      <line className="rifc__target" x1={mx(targetFrom.dose)} y1={my(targetFrom.freq)} x2={mx(targetTo.dose)} y2={my(targetTo.freq)} />
      <line className="rifc__axis" x1={x0} y1={yTop} x2={x0} y2={yBot} />
      <line className="rifc__axis" x1={x0} y1={yBot} x2={x1} y2={yBot} />
      {xTicks.map((p) => (<text key={`tx${p}`} className="rifc__lab" x={mx(Math.pow(10, p))} y={yBot + 14} textAnchor="middle">{expTick(p)}</text>))}
      {yTicks.map((p) => (<text key={`ty${p}`} className="rifc__lab" x={x0 - 6} y={my(Math.pow(10, p)) + 3} textAnchor="end">{expTick(p)}</text>))}
      <text className="rifc__axlab" x={(x0 + x1) / 2} y={H - 2} textAnchor="middle">Site-boundary dose (Sv)</text>
      <text className="rifc__axlab" x={-((yTop + yBot) / 2)} y={12} textAnchor="middle" transform="rotate(-90 0 0)">Frequency (per yr)</text>
      <text className="rifc__lab rifc__lab--target" x={mx(targetTo.dose) - 4} y={my(targetTo.freq) - 6} textAnchor="end">F-C target</text>
      {points.map((pt) => {
        const cls = pt.sig === "HIGH" ? "high" : pt.sig === "MEDIUM" ? "medium" : "low";
        return (
          <g key={pt.id}>
            <circle className={`rifc__pt rifc__pt--${cls}`} cx={mx(pt.dose)} cy={my(pt.freq)} r={pt.sig === "HIGH" ? 8 : 6.5} />
            <text className="rifc__lab" x={mx(pt.dose)} y={my(pt.freq) - 11} textAnchor="middle">{pt.id}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── The exceedance-frequency curve (RI-B2 c, CCDF) ────────────────────────
function CCDFCurve({ points }: { points: { dose: number; exceed: number }[] }): JSX.Element {
  const W = 430;
  const H = 250;
  const x0 = 46;
  const x1 = 416;
  const yTop = 16;
  const yBot = 212;
  const xMin = 1e-6;
  const xMax = 1e0;
  const yMin = 1e-9;
  const yMax = 1e-6;
  const mx = (d: number): number => scaleLog(d, xMin, xMax, x0, x1);
  const my = (f: number): number => scaleLog(f, yMin, yMax, yBot, yTop);
  const xTicks = [-6, -4, -2, 0];
  const yTicks = [-9, -8, -7, -6];
  const pts = points.map((p) => `${mx(p.dose)},${my(p.exceed)}`).join(" ");
  return (
    <svg className="riccdf__svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Exceedance-frequency curve">
      {xTicks.map((p) => (<line key={`gx${p}`} className="riccdf__grid" x1={mx(Math.pow(10, p))} y1={yTop} x2={mx(Math.pow(10, p))} y2={yBot} />))}
      {yTicks.map((p) => (<line key={`gy${p}`} className="riccdf__grid" x1={x0} y1={my(Math.pow(10, p))} x2={x1} y2={my(Math.pow(10, p))} />))}
      <polyline className="riccdf__curve" points={pts} />
      <line className="riccdf__axis" x1={x0} y1={yTop} x2={x0} y2={yBot} />
      <line className="riccdf__axis" x1={x0} y1={yBot} x2={x1} y2={yBot} />
      {xTicks.map((p) => (<text key={`tx${p}`} className="rifc__lab" x={mx(Math.pow(10, p))} y={yBot + 14} textAnchor="middle">{expTick(p)}</text>))}
      {yTicks.map((p) => (<text key={`ty${p}`} className="rifc__lab" x={x0 - 6} y={my(Math.pow(10, p)) + 3} textAnchor="end">{expTick(p)}</text>))}
      <text className="riccdf__lab" x={(x0 + x1) / 2} y={H - 2} textAnchor="middle">Site-boundary dose (Sv)</text>
      <text className="riccdf__lab" x={-((yTop + yBot) / 2)} y={12} textAnchor="middle" transform="rotate(-90 0 0)">Exceedance frequency (per yr)</text>
      {points.map((p, i) => (<circle key={i} className="riccdf__pt" cx={mx(p.dose)} cy={my(p.exceed)} r="3.5" />))}
    </svg>
  );
}

// ─── 03 — Integrate & Compute (HLR-RI-B) ───────────────────────────────────
function IntegrateScreen({ ccId }: { ccId: string }): JSX.Element {
  const { ri } = useRiWorkbook();
  const isCcOne = ccId === "cc-i";
  const results = ri.integratedRiskResults;
  const fcPoints: FcPoint[] = (results.frequencyConsequencePlotData ?? []).map((p) => ({
    id: p.eventSequenceRef,
    dose: p.consequence,
    freq: p.frequency,
    sig: familySignificance(ri, p.eventSequenceRef),
  }));
  const ccdfPoints = (results.exceedanceFrequencyCurveData?.[0]?.dataPoints ?? []).map((p) => ({ dose: p.consequenceValue, exceed: p.exceedanceFrequency }));
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Calculation approach</h3>
          <RiProvenanceChip>RI-B2</RiProvenanceChip>
        </div>
        <p className="poscard__sub">The integrated risk is totaled, plotted and, at CC-II, drawn as an exceedance curve, and each approach is one accepted route.</p>
        <div className="riapproach">
          {CALC_APPROACHES.map((a) => {
            const Icon = RIIcon[a.icon] ?? RIIcon.Sigma;
            const on = a.id === "ccdf" ? !isCcOne : true;
            return (
              <span key={a.id} className={`riapproach__chip${on ? " riapproach__chip--on" : ""}`} title={a.note}>
                <Icon /> {a.label} <span className="riapproach__chip-cc">{a.cc}</span>
              </span>
            );
          })}
        </div>
        <div className="hrnote" style={{ marginTop: 12 }}>
          <RIIcon.Sigma />
          <span>{isCcOne ? "At CC-I the risk is calculated with point estimates, and the exceedance curve is not required." : "At CC-II the risk is quantified with means, and the exceedance curve is drawn for the dose metric."}</span>
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Frequency-consequence plot</h3>
          <RiProvenanceChip>RI-B2</RiProvenanceChip>
        </div>
        <p className="poscard__sub">Every family plots its consequence against its frequency, and the target is the diagonal the families are judged against.</p>
        <div className="rifc__legend rifc__legend--top">
          <div className="rifc__legend-item"><span className="rifc__legend-dot rifc__legend-dot--high" /> High significance</div>
          <div className="rifc__legend-item"><span className="rifc__legend-dot rifc__legend-dot--medium" /> Medium significance</div>
          <div className="rifc__legend-item"><span className="rifc__legend-dot rifc__legend-dot--low" /> Low significance</div>
          <div className="rifc__legend-item"><span className="rifc__legend-dot rifc__legend-dot--target" /> Frequency-consequence target</div>
        </div>
        <div className="rifc__center">
          <div className="rifc__plot"><FCPlot points={fcPoints} /></div>
        </div>
        <div className="hrnote" style={{ marginTop: 12 }}>
          <RIIcon.Target />
          <span>{FC_META.note}</span>
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Exceedance-frequency curve</h3>
          <RiProvenanceChip>RI-B2</RiProvenanceChip>
        </div>
        <p className="poscard__sub">{CCDF_NOTE}</p>
        {isCcOne ? (
          <div className="eswarn"><span className="eswarn__icon"><RIIcon.Warn /></span><span>The exceedance-frequency curve is a CC-II approach, so it is not required while the workbook targets CC-I.</span></div>
        ) : (
          <div className="rifc__center"><div className="rifc__plot"><CCDFCurve points={ccdfPoints} /></div></div>
        )}
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Integrated risk</h3>
          <RiProvenanceChip>RI-B2</RiProvenanceChip>
        </div>
        <p className="poscard__sub">The integrated risk is the single number the whole standard has been assembling, judged against the target for the application.</p>
        <div className="risum">
          {results.metrics.map((r) => {
            const limit = r.acceptanceCriteria?.limit;
            const fillPct = limit !== undefined ? Math.min(100, Math.round((r.value / limit) * 100)) : 0;
            const compliant = r.acceptanceCriteria?.complianceStatus === "COMPLIANT";
            return (
              <div key={r.uuid} className="risum__card">
                <span className="risum__cap">{r.name}</span>
                <div className="posrow" style={{ gap: 8, alignItems: "baseline" }}>
                  <span className="risum__val">{valText(r.value)}</span>
                  <span className="risum__unit">{r.units}</span>
                </div>
                <div className="risum__bar">
                  <div className="risum__bar-track"><div className="risum__bar-fill" style={{ width: `${fillPct}%` }} /></div>
                  <span className={`risum__status risum__status--${compliant ? "compliant" : "margin"}`}>{compliant ? "Below target" : "Check margin"}</span>
                </div>
                <p className="possubtle" style={{ fontSize: 11.5, lineHeight: 1.45, margin: "2px 0 0" }}>{r.description} The target is {valText(limit)} {r.units}.</p>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

export { ConvergeScreen, CriteriaScreen, IntegrateScreen, type RiDrawerContext };
