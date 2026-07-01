import { JSX, useState } from "react";
import { type PlantStage } from "interfaces-mef-types/core/pra-common";
import { RCIcon } from "./rcIcons";
import { Badge, RcProvenanceChip } from "./rcShared";
import { useRcWorkbook } from "./rcWorkbookContext";
import { WorkbookInterfaceTiles } from "../workbooks/workbookInterfaces";
import {
  CAPABILITY_CATEGORIES,
  RC_METHODS,
  SITE_OPTIONS,
  HANDOFF_INPUTS,
  CONSEQUENCE_METRIC_NOTES,
  SCOPING_ASPECTS,
  SCOPE_LEVEL_LABELS,
  PROTECTIVE_ACTION_LABELS,
  INCIDENT_PHASE_LABELS,
  EVAC_DELAY_LABELS,
  EVAC_DELAY_TOTAL,
  EVAC_SPEED_FACTOR_LABELS,
  SITE_DATA_BASIS_LABELS,
  MET_PERIOD_LADDER,
  MET_PARAM_CHIPS,
  type SiteBasis,
} from "./rcViewData";
import { categoryInputById } from "./rcSelectors";

type Stage = "pre_operational" | "operational";

interface RcDrawerContext {
  kind: "family";
  id: string;
}

function MethodChips({ ids, label }: { ids: string[]; label?: string }): JSX.Element | null {
  const ms = ids.map((id) => RC_METHODS[id]).filter((m): m is (typeof RC_METHODS)[string] => m !== undefined);
  if (ms.length === 0) return null;
  return (
    <div className="hrmethods">
      {label !== undefined && <span className="hrmethods__label">{label}</span>}
      {ms.map((m) => (
        <span key={m.id} className="hrmethod-chip" title={`${m.name} · ${m.ref}`}>{m.abbr}</span>
      ))}
    </div>
  );
}

// ─── 01 — Scope & Handoff (RCRE) ───────────────────────────────────────────
function HandoffScreen({ ccId, setCcId, site, setSite }: {
  ccId: string;
  setCcId: (id: string) => void;
  site: SiteBasis;
  setSite: (s: SiteBasis) => void;
}): JSX.Element {
  const { rc, editable, mutateRc } = useRcWorkbook();
  const cc = CAPABILITY_CATEGORIES.find((c) => c.id === ccId) ?? CAPABILITY_CATEGORIES[0];
  const inputs = rc.releaseCategoryToConsequence.releaseCategoryInputs;
  const [catId, setCatId] = useState<string>(inputs.find((c) => c.releaseCategory === "RC-3")?.releaseCategory ?? inputs[0]?.releaseCategory ?? "");
  const cat = categoryInputById(rc, catId);
  const stage: Stage = rc.plantStage === "OPERATIONAL" ? "operational" : "pre_operational";

  function onScopeChange(value: string): void {
    if (!editable) return;
    mutateRc((draft) => ({ ...draft, praScope: value }));
  }
  function onCcChange(newCcId: string): void {
    if (!editable) return;
    setCcId(newCcId);
    mutateRc((draft) => ({ ...draft, capabilityCategory: newCcId === "cc-i" ? "CC-I" : "CC-II" }));
  }
  function onStageChange(newStage: Stage): void {
    if (!editable) return;
    const plantStage: PlantStage = newStage === "operational" ? "OPERATIONAL" : "PRE_OPERATIONAL";
    mutateRc((draft) => ({ ...draft, plantStage }));
  }

  function inputValue(id: string): string {
    if (cat === undefined) return "n/a";
    const ch = cat.releaseCharacteristics;
    switch (id) {
      case "plumes": return ch.numberOfPlumes !== undefined ? `${ch.numberOfPlumes} plume${ch.numberOfPlumes === 1 ? "" : "s"}, ${ch.releasePhaseTimings !== undefined && ch.releasePhaseTimings.length > 1 ? `${ch.releasePhaseTimings.length} phases` : "one phase"}` : "n/a";
      case "fractions": return ch.radionuclideGroupFractions !== undefined && ch.radionuclideGroupFractions.length > 0 ? ch.radionuclideGroupFractions.map((g) => `${g.group} ${g.fraction.toExponential(1).replace("e", "E")}`).join(", ") : "n/a";
      case "isotopes": return ch.importantRadionuclides?.join(", ") ?? "n/a";
      case "timing": return ch.releasePhaseTimings !== undefined && ch.releasePhaseTimings.length > 0 ? ch.releasePhaseTimings.map((t) => `${t.startTime} to ${t.startTime + t.duration} ${t.timeUnit ?? "h"}`).join(", ") : "n/a";
      case "warning": return ch.warningTimeDescription ?? (ch.warningTime !== undefined ? `About ${ch.warningTime} hours` : "n/a");
      case "energy": return ch.releaseEnergyDescription ?? (ch.releaseEnergy !== undefined ? `${ch.releaseEnergy} MW thermal` : "n/a");
      case "height": return ch.releaseHeightDescription ?? (ch.releaseHeight !== undefined ? `${ch.releaseHeight} m` : "n/a");
      case "particle": return ch.releasedParticleSizeDescription ?? "n/a";
      case "uncert": return ch.releaseUncertainties ?? "n/a";
      default: return "n/a";
    }
  }

  return (
    <>
      <div className="poscard">
        <div className="poscard__head"><h3 className="poscard__title">Interfaces</h3></div>
        <p className="poscard__sub">What flows into Radiological Consequence and what it feeds. Select an element to see the data exchanged.</p>
        <WorkbookInterfaceTiles element="RC" />
      </div>

      <div className="poscard">
        <div className="poscard__head"><h3 className="poscard__title">PRA scope</h3></div>
        <p className="poscard__sub">Describe what this radiological-consequence analysis covers and what it excludes.</p>
        <textarea
          className="posfield__textarea"
          placeholder="State the in-scope release categories, the consequence metrics, and explicit exclusions."
          rows={4}
          value={rc.praScope}
          disabled={!editable}
          onChange={(e) => onScopeChange(e.target.value)}
        />
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Capability category</h3>
          <Badge kind="progress">{cc.tag}</Badge>
        </div>
        <p className="poscard__sub">Simplified modules with a collapsed population, or resolved population with the physics modules switched on and the uncertainty propagated.</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 4 }}>
          {CAPABILITY_CATEGORIES.map((c) => {
            const active = c.id === ccId;
            return (
              <button key={c.id} type="button" className="poscard" onClick={() => onCcChange(c.id)}
                style={{ textAlign: "left", cursor: "pointer", borderColor: active ? "var(--color-primary)" : undefined, boxShadow: active ? "0 0 0 3px var(--color-primary-focus)" : undefined, padding: 14 }}>
                <div className="posrow" style={{ justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{c.name}</span>
                  <Badge kind={active ? "progress" : undefined}>{c.tag}</Badge>
                </div>
                <p className="possubtle" style={{ fontSize: 12, lineHeight: 1.5, margin: 0 }}>{c.description}</p>
              </button>
            );
          })}
        </div>
        <div className="hrnote" style={{ marginTop: 12 }}>
          <RCIcon.NoEntry />
          <span>The CC-I simplifications are not uniformly conservative, so the conservatism direction is demonstrated aspect by aspect.</span>
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">The site fork</h3>
          <RcProvenanceChip>RCRE-A1</RcProvenanceChip>
        </div>
        <p className="poscard__sub">The site fork is the site itself, an identified site or a justified bounding site.</p>
        <div className="rcsite">
          {SITE_OPTIONS.map((o) => {
            const Icon = RCIcon[o.icon] ?? RCIcon.Pin;
            const active = o.id === site;
            return (
              <button key={o.id} type="button" className={`rcsite__opt${active ? " rcsite__opt--active" : ""}`} onClick={() => setSite(o.id)}>
                <div className="rcsite__opt-head">
                  <span className="rcsite__opt-icon"><Icon /></span>
                  <div>
                    <div className="rcsite__opt-name">{o.name}</div>
                    <div className="rcsite__opt-tag">{o.tag}</div>
                  </div>
                </div>
                <p className="rcsite__opt-desc">{o.desc}</p>
                <span className="rcsite__opt-meta"><RCIcon.Tag /> {o.meta}</span>
              </button>
            );
          })}
        </div>
        {rc.releaseCategoryToConsequence.siteInformation.isBounding && (
          <div className="hrnote" style={{ marginTop: 12 }}>
            <RCIcon.Globe />
            <span>{rc.releaseCategoryToConsequence.siteInformation.boundingSite.description} {rc.releaseCategoryToConsequence.siteInformation.boundingSite.boundingJustification}</span>
          </div>
        )}
      </div>

      <div className="poscard">
        <div className="poscard__head"><h3 className="poscard__title">Plant stage</h3></div>
        <p className="poscard__sub">This sets which requirements apply and where the plant-response data comes from.</p>
        <div className="posrow posrow--wrap" style={{ gap: 12 }}>
          {([
            ["pre_operational", "Pre-operational", "Plant-response data comes from general or design calculations, with gaps from the not-yet-built plant written down as assumptions."],
            ["operational", "Operational", "Real data and procedures from the running plant are available to confirm the consequence analysis."],
          ] as [Stage, string, string][]).map(([val, title, body]) => (
            <label key={val} className="poscard poscard--ghost" style={{ flex: 1, minWidth: 280, cursor: "pointer", borderColor: stage === val ? "var(--color-primary)" : undefined }}>
              <div className="posrow" style={{ alignItems: "flex-start", gap: 12 }}>
                <input type="radio" name="rc-stage" value={val} checked={stage === val} onChange={() => onStageChange(val)} />
                <div>
                  <div style={{ fontWeight: 700, color: "var(--color-text)", fontSize: 14, marginBottom: 4 }}>{title}</div>
                  <div className="possubtle" style={{ fontSize: 12.5 }}>{body}</div>
                </div>
              </div>
            </label>
          ))}
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Handoff inputs</h3>
          <RcProvenanceChip>RCRE-A2</RcProvenanceChip>
        </div>
        <p className="poscard__sub">RC extracts nine inputs per release category from the source-term table, the consumer side of the source-term attribute list.</p>
        <div className="posrow posrow--wrap" style={{ gap: 6, marginBottom: 10 }}>
          {inputs.map((r) => (
            <button key={r.releaseCategory} type="button" className={`poschip${r.releaseCategory === catId ? " poschip--primary" : ""}`} onClick={() => setCatId(r.releaseCategory)}>
              {r.releaseCategory}{r.sourceTermDefinitionRef !== undefined ? ` · ${r.sourceTermDefinitionRef}` : ""}
            </button>
          ))}
        </div>
        <div className="rcinput">
          {HANDOFF_INPUTS.map((h) => {
            const Icon = RCIcon[h.icon] ?? RCIcon.Tag;
            return (
              <div key={h.id} className="rcinput__cell">
                <span className="rcinput__icon"><Icon /></span>
                <div className="rcinput__main">
                  <div className="rcinput__label">{h.label}</div>
                  <div className="rcinput__note posmono">{inputValue(h.id)}</div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="hrnote" style={{ marginTop: 12 }}>
          <RCIcon.Boxes />
          <span>Each input traces to the source-term table for {catId.length > 0 ? catId : "the category"}, and the review against the input list is recorded under RCRE-A3.</span>
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Consequence metric</h3>
          <RcProvenanceChip>RCRE-B1</RcProvenanceChip>
        </div>
        <p className="poscard__sub">The metric set comes from the intended application, the consequence axis of the frequency-consequence target.</p>
        <div className="rcgrid">
          {rc.scope.consequenceMetrics.map((m) => (
            <div key={m} className="rccard rccard--credit">
              <div className="posrow" style={{ gap: 8, alignItems: "center" }}>
                <span style={{ color: "var(--rc-credit-ink)" }}><RCIcon.Target /></span>
                <span style={{ fontWeight: 700, fontSize: 12.5 }}>{m}</span>
              </div>
              <p className="possubtle" style={{ fontSize: 11.5, lineHeight: 1.45, margin: 0 }}>{CONSEQUENCE_METRIC_NOTES[m] ?? "A consequence metric from the intended application."}</p>
            </div>
          ))}
        </div>
        <div className="hrnote" style={{ marginTop: 12 }}>
          <RCIcon.Gauge />
          <span>{rc.scope.metricSelectionApplicationBasis ?? "The metric set comes from the intended application."} RI later pairs the result with the ESQ frequency.</span>
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Scoping declaration</h3>
          <RcProvenanceChip>RCRE-B2</RcProvenanceChip>
        </div>
        <p className="poscard__sub">RCRE-B2 declares, aspect by aspect, the degree to which each downstream sub-element is evaluated.</p>
        <div className="rcscope">
          {SCOPING_ASPECTS.map((s) => (
            <div key={s.se} className="rcscope__row">
              <span className="rcscope__aspect"><RCIcon.Layers /> {s.aspect} <span className="rcse rcse--primary">{s.se}</span></span>
              <span className="rcscope__degree">{rc.scope[s.degreeKey]}</span>
              <span className={`rcscope__level rcscope__level--${s.level}`}>{SCOPE_LEVEL_LABELS[s.level]}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

// ─── 02 — Protective Actions & Site (RCPA) ─────────────────────────────────
function ProtectiveScreen(): JSX.Element {
  const { rc } = useRcWorkbook();
  const pa = rc.protectiveActionParameters;
  const cohorts = pa.cohortModeling.cohorts ?? [];
  const speedFlags = pa.evacuationSpeed;
  const hazard = pa.hazardGroupAdjustments?.[0];

  const siteRows = [
    { id: "pop", name: "Population distribution", icon: "Users", note: [pa.populationDistribution.description, pa.populationDistribution.justification].filter(Boolean).join(" "), basis: pa.populationDistribution.basis },
    { id: "land", name: "Land use", icon: "Leaf", note: pa.landUseData.description, basis: pa.landUseData.basis },
    { id: "bldg", name: "Building dimensions and stack heights", icon: "Home", note: pa.plantPhysicalCharacteristics.description, basis: pa.plantPhysicalCharacteristics.basis },
  ];

  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Protective actions</h3>
          <RcProvenanceChip>RCPA-A1</RcProvenanceChip>
        </div>
        <p className="poscard__sub">The protective actions that reduce the dose are listed, each included with a one-line basis.</p>
        <div className="rcpa">
          {pa.protectiveActionsIncluded.map((a) => {
            const meta = PROTECTIVE_ACTION_LABELS[a.action];
            const Icon = RCIcon[meta?.icon ?? "Shield"] ?? RCIcon.Shield;
            return (
              <div key={a.action} className={`rcpa__cell${a.included ? "" : " rcpa__cell--out"}`}>
                <span className="rcpa__icon"><Icon /></span>
                <div className="rcpa__main">
                  <div className="rcpa__name">{meta?.name ?? a.action}</div>
                  <div className="rcpa__note">{a.applicabilityJustification ?? "n/a"}</div>
                </div>
                <span className={`rcpa__state rcpa__state--${a.included ? "in" : "out"}`}>{a.included ? <RCIcon.Check /> : <RCIcon.Close />}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Incident phases</h3>
          <RcProvenanceChip>RCPA-A2</RcProvenanceChip>
        </div>
        <p className="poscard__sub">The actions are structured by incident phase, since the decision basis shifts from plant status to measurements over time.</p>
        <div className="rcphase">
          {pa.incidentPhasesModeled.map((p) => {
            const meta = INCIDENT_PHASE_LABELS[p.phase];
            return (
              <div key={p.phase} className="rcphase__col">
                <div className="rcphase__col-head">
                  <span className="rcphase__dot" />
                  <div>
                    <div className="rcphase__name">{meta?.name ?? p.phase}</div>
                    <div className="rcphase__window posmono">{meta?.window ?? ""}</div>
                  </div>
                </div>
                <p className="rcphase__desc">{p.criteriaDescription}</p>
              </div>
            );
          })}
        </div>
        <div className="rcbasis" style={{ marginTop: 12 }}>
          {pa.sourceDocuments.map((d) => (
            <div key={d.document} className="rcbasis__row">
              <span className="rcbasis__icon"><RCIcon.Doc /></span>
              <div className="rcbasis__main">
                <div className="rcbasis__name">{d.document}</div>
                <div className="rcbasis__note">{d.usage}</div>
              </div>
              <span className="rcbasis__tag rcbasis__tag--rich">Source</span>
            </div>
          ))}
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Cohort modeling</h3>
          <RcProvenanceChip>RCPA-A4 · A5</RcProvenanceChip>
        </div>
        <p className="poscard__sub">One cohort at CC-I or multiple cohorts at CC-II, separating the compliers from the non-compliers.</p>
        <div className="rccohort">
          {cohorts.map((c, i) => {
            const refuse = c.name.toLowerCase().includes("non-compliant");
            const pct = c.description.includes("95") ? "95%" : c.description.includes(" 5 ") || c.description.includes("5 percent") ? "5%" : "";
            return (
              <div key={i} className={`rccohort__card${refuse ? " rccohort__card--refuse" : ""}`}>
                <div className="rccohort__head">
                  <span className="rccohort__pct posmono">{pct}</span>
                  <span className="rccohort__name">{c.name}</span>
                </div>
                <p className="rccohort__desc">{c.description}</p>
                {c.complianceAssumption !== undefined && <p className="rccohort__assume">{c.complianceAssumption}</p>}
              </div>
            );
          })}
        </div>
        {pa.complianceAssumptions[0] !== undefined && (
          <div className="hrnote" style={{ marginTop: 12 }}>
            <RCIcon.Users />
            <span>{pa.complianceAssumptions[0].description} {pa.complianceAssumptions[0].basis}</span>
          </div>
        )}
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Evacuation delay chain</h3>
          <RcProvenanceChip>RCPA-A9</RcProvenanceChip>
        </div>
        <p className="poscard__sub">The evacuation delay is a six-link chain from the emergency declaration to the moment people depart.</p>
        <div className="rcdelay">
          {(pa.evacuationDelayComponents ?? []).map((l, i) => (
            <div key={l.component} className="rcdelay__link">
              <span className="rcdelay__num posmono">{i + 1}</span>
              <span className="rcdelay__label">{EVAC_DELAY_LABELS[l.component] ?? l.component}</span>
              <span className="rcdelay__est">{l.estimate}</span>
            </div>
          ))}
        </div>
        <div className="hrnote" style={{ marginTop: 12 }}>
          <RCIcon.Clock />
          <span>{EVAC_DELAY_TOTAL} {speedFlags?.basis ?? ""}</span>
        </div>
        {speedFlags !== undefined && (
          <div className="rcparam" style={{ marginTop: 12 }}>
            {EVAC_SPEED_FACTOR_LABELS.filter(([key]) => speedFlags[key]).map(([key, label]) => (
              <span key={key} className="rcparam__chip rcparam__chip--site">
                <RCIcon.Car /> {label}
              </span>
            ))}
          </div>
        )}
        {hazard !== undefined && (
          <div className="eswarn" style={{ marginTop: 12 }}>
            <span className="eswarn__icon"><RCIcon.Warn /></span>
            <span>{hazard.adjustmentDescription}</span>
          </div>
        )}
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Site data</h3>
          <RcProvenanceChip>RCPA-B1 · B2 · B3</RcProvenanceChip>
        </div>
        <p className="poscard__sub">The population, the land use and the building data are assumed and justified for the bounding site, or sourced for the identified site.</p>
        <div className="rcbasis">
          {siteRows.map((d) => {
            const Icon = RCIcon[d.icon] ?? RCIcon.Map;
            const basis = SITE_DATA_BASIS_LABELS[d.basis] ?? { label: d.basis, kind: "simple" as const };
            return (
              <div key={d.id} className="rcbasis__row">
                <span className="rcbasis__icon"><Icon /></span>
                <div className="rcbasis__main">
                  <div className="rcbasis__name">{d.name}</div>
                  <div className="rcbasis__note">{d.note}</div>
                </div>
                <span className={`rcbasis__tag rcbasis__tag--${basis.kind}`}>{basis.label}</span>
              </div>
            );
          })}
        </div>
        <div className="hrnote" style={{ marginTop: 12 }}>
          <RCIcon.Globe />
          <span>For the bounding site the population and the land use are bounding assumptions, logged for closure at site selection.</span>
        </div>
      </div>
    </>
  );
}

// ─── 03 — Meteorology (RCME) ───────────────────────────────────────────────
function WeatherScreen(): JSX.Element {
  const { rc } = useRcWorkbook();
  const met = rc.meteorologicalData;
  const recovery = met.dataRecovery.combinedRecoveryPercent;
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Meteorological data quality</h3>
          <RcProvenanceChip>RCME-A1 to A4</RcProvenanceChip>
        </div>
        <p className="poscard__sub">Hourly site data is compiled, justified as representative, at a data recovery of ninety percent or more.</p>
        <div className="rcmet">
          <div className="rcmet__gauge">
            <span className="rcmet__gauge-num posmono">{recovery !== undefined ? `${recovery}%` : "n/a"}</span>
            <span className="rcmet__gauge-cap">data recovery, above the ninety percent floor</span>
          </div>
          <div className="rcmet__rows">
            <div className="rcmet__row"><span className="rcmet__k"><RCIcon.Radio /> Source</span><span className="rcmet__v">{met.dataSource}</span></div>
            <div className="rcmet__row"><span className="rcmet__k"><RCIcon.Map /> Representativeness</span><span className="rcmet__v">{met.spatialRepresentativenessJustification}</span></div>
            <div className="rcmet__row"><span className="rcmet__k"><RCIcon.Refresh /> Substitution</span><span className="rcmet__v">{met.dataRecovery.substitutionTechniques ?? "n/a"}</span></div>
            <div className="rcmet__row"><span className="rcmet__k"><RCIcon.Person /> Review</span><span className="rcmet__v">{[met.dataRecovery.meteorologistReview?.reviewerQualification, met.dataRecovery.meteorologistReview?.considerations].filter(Boolean).join(" ") || "n/a"}</span></div>
            <div className="rcmet__row"><span className="rcmet__k"><RCIcon.Settings /> Instruments</span><span className="rcmet__v">{met.instrumentationQuality?.description ?? "n/a"}</span></div>
          </div>
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">The period-selection ladder</h3>
          <RcProvenanceChip>RCME-A2</RcProvenanceChip>
        </div>
        <p className="poscard__sub">A representative single year at CC-I, or a multi-year evaluation to select the representative year at CC-II.</p>
        <div className="rcsplit rcsplit--atmos">
          <div className="rcsplit__col">
            <span className="rcsplit__cc rcsplit__cc--i">CC-I</span>
            <div className="rcsplit__title">{MET_PERIOD_LADDER.cci.title}</div>
            <p className="rcsplit__desc">{MET_PERIOD_LADDER.cci.desc}</p>
            <span className="rcsplit__tag"><RCIcon.Calendar /> {MET_PERIOD_LADDER.cci.tag}</span>
          </div>
          <div className="rcsplit__col rcsplit__col--ii">
            <span className="rcsplit__cc rcsplit__cc--ii">CC-II</span>
            <div className="rcsplit__title">{MET_PERIOD_LADDER.ccii.title}</div>
            <p className="rcsplit__desc">{MET_PERIOD_LADDER.ccii.desc}</p>
            <span className="rcsplit__tag"><RCIcon.Calendar /> {MET_PERIOD_LADDER.ccii.tag}</span>
          </div>
        </div>
        <div className="hrnote" style={{ marginTop: 12 }}>
          <RCIcon.Sparkle />
          <span>{met.periodSelection.periodDescription} {MET_PERIOD_LADDER.note}</span>
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Extracted parameters</h3>
          <RcProvenanceChip>RCME-A5 to A7</RcProvenanceChip>
        </div>
        <p className="poscard__sub">The wind, the stability class and the mixing height are extracted, with the precipitation added at CC-II.</p>
        <div className="rcparam">
          {MET_PARAM_CHIPS.map((p) => {
            const Icon = RCIcon[p.icon] ?? RCIcon.Wind;
            return (
              <span key={p.id} className="rcparam__chip">
                <Icon /> {p.label}{p.ccii === true ? " · CC-II" : ""}
              </span>
            );
          })}
        </div>
        <div className="hrnote" style={{ marginTop: 12 }}>
          <RCIcon.Layers />
          <span>{met.stabilityClassificationMethod.description}</span>
        </div>
      </div>
    </>
  );
}

export { HandoffScreen, ProtectiveScreen, WeatherScreen, MethodChips, type RcDrawerContext };
