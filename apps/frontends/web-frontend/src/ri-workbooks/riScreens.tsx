import { JSX, useState } from "react";
import { RIIcon } from "./riIcons";
import { Badge, RiProvenanceChip, valText } from "./riShared";
import { useRiWorkbook } from "./riWorkbookContext";
import { WorkbookInterfaceTiles } from "../workbooks/workbookInterfaces";
import {
  APPLICATION_TYPES,
  CAPABILITY_CATEGORIES,
  CONSEQUENCE_MEASURE_META,
  CRITERIA_LEVELS,
  REPORTING_FLOOR_NOTES,
  CALC_APPROACHES,
  FC_META,
  CCDF_NOTE,
  type AppTypeId,
} from "./riViewData";
import { familySignificance } from "./riSelectors";

interface RiDrawerContext {
  kind: "family";
  id: string;
}

type Stage = "pre_operational" | "operational";

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
function ConvergeScreen(): JSX.Element {
  const { ri, editable, mutateRi } = useRiWorkbook();
  const scope = ri.scopeDefinition;
  const ccId = ri.capabilityCategory === "CC-I" ? "cc-i" : "cc-ii";
  const [stage, setStage] = useState<Stage>(ri.plantStage === "OPERATIONAL" ? "operational" : "pre_operational");

  function onScopeChange(value: string): void {
    if (!editable) return;
    mutateRi((draft) => ({ ...draft, praScope: value }));
  }
  function onCcChange(newCcId: string): void {
    if (!editable) return;
    mutateRi((draft) => ({ ...draft, capabilityCategory: newCcId === "cc-i" ? "CC-I" : "CC-II" }));
  }
  function onStageChange(newStage: Stage): void {
    if (!editable) return;
    setStage(newStage);
    mutateRi((draft) => ({ ...draft, plantStage: newStage === "operational" ? "OPERATIONAL" : "PRE_OPERATIONAL" }));
  }

  const cc = CAPABILITY_CATEGORIES.find((c) => c.id === ccId) ?? CAPABILITY_CATEGORIES[0];

  return (
    <>
      <div className="poscard">
        <div className="poscard__head"><h3 className="poscard__title">Interfaces</h3></div>
        <p className="poscard__sub">What flows into Risk Integration and what it feeds. Select an element to see the data exchanged.</p>
        <WorkbookInterfaceTiles element="RI" />
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
          <div className="posfield"><label className="posfield__label">Plant operating states</label><div style={{ fontSize: 12.5 }}>{scope.plantOperatingStateRefs.join(", ")}</div></div>
          <div className="posfield"><label className="posfield__label">Radioactive sources</label><div style={{ fontSize: 12.5 }}>{scope.radioactiveMaterialSources.join(", ")}</div></div>
          <div className="posfield"><label className="posfield__label">Families compiled</label><div className="posmono" style={{ fontWeight: 700 }}>{ri.compiledRiskInputs.length}</div></div>
          <div className="posfield"><label className="posfield__label">Release categories</label><div className="posmono" style={{ fontWeight: 700 }}>{scope.releaseCategoryRefs?.length ?? 0}</div></div>
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head"><h3 className="poscard__title">PRA scope</h3></div>
        <p className="poscard__sub">Describe what this risk integration covers and what it excludes.</p>
        <textarea
          className="posfield__textarea"
          placeholder="State the in-scope consequence measures, hazard groups, and explicit exclusions."
          rows={4}
          value={ri.praScope}
          disabled={!editable}
          onChange={(e) => onScopeChange(e.target.value)}
        />
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Capability category</h3>
          <Badge kind="progress">{cc.tag}</Badge>
        </div>
        <p className="poscard__sub">This sets how detailed the risk integration must be.</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 4 }}>
          {CAPABILITY_CATEGORIES.map((c) => {
            const active = c.id === ccId;
            return (
              <button key={c.id} type="button" className="poscard" onClick={() => onCcChange(c.id)}
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

      <div className="poscard">
        <div className="poscard__head"><h3 className="poscard__title">Plant stage</h3></div>
        <p className="poscard__sub">This sets which requirements apply and where the plant-response data comes from.</p>
        <div className="posrow posrow--wrap" style={{ gap: 12 }}>
          {([
            ["pre_operational", "Pre-operational", "Plant-response data comes from general or design calculations, with gaps from the not-yet-built plant written down as assumptions."],
            ["operational", "Operational", "Real data and procedures from the running plant are available to confirm the integrated risk results."],
          ] as [Stage, string, string][]).map(([val, title, body]) => (
            <label key={val} className="poscard poscard--ghost" style={{ flex: 1, minWidth: 280, cursor: "pointer", borderColor: stage === val ? "var(--color-primary)" : undefined }}>
              <div className="posrow" style={{ alignItems: "flex-start", gap: 12 }}>
                <input type="radio" name="ri-stage" value={val} checked={stage === val} onChange={() => onStageChange(val)} />
                <div>
                  <div style={{ fontWeight: 700, color: "var(--color-text)", fontSize: 14, marginBottom: 4 }}>{title}</div>
                  <div className="possubtle" style={{ fontSize: 12.5 }}>{body}</div>
                </div>
              </div>
            </label>
          ))}
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
