import { WorkbookCueLabel, WorkbookSectionHeading } from "../workbooks/workbookSectionHeading";
import { WorkbookInput } from "../workbooks/commitOnDeactivateFields";
import { JSX } from "react";
import { RCIcon } from "./rcIcons";
import { RcProvenanceChip } from "./rcShared";
import { useRcWorkbook } from "./rcWorkbookContext";
import { type RcDrawerContext } from "./rcScreens";
import {
  DISPERSION_CLASS_LABELS,
  CREDIT_FENCE,
  DEPOSITION_ROWS,
  EXPOSURE_PATHWAY_LABELS,
  EXPOSURE_PATHWAY_NOTES,
  DOSE_SPLITS,
  HE_PARAM_SPLITS,
  COST_CATEGORY_ICONS,
  COST_PARAM_ICONS,
} from "./rcViewData";

// ─── A small two-column CC line, reused by the dosimetry and health splits ──
function SplitLines({ cci, ccii }: { cci: string; ccii: string }): JSX.Element {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
        <span className="rcsplit__cc rcsplit__cc--i" style={{ flexShrink: 0 }}>CC-I</span>
        <span style={{ fontSize: 11.5, color: "var(--color-text-muted)", lineHeight: 1.4 }}>{cci}</span>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
        <span className="rcsplit__cc rcsplit__cc--health" style={{ flexShrink: 0 }}>CC-II</span>
        <span style={{ fontSize: 11.5, color: "var(--color-text)", lineHeight: 1.4 }}>{ccii}</span>
      </div>
    </div>
  );
}

// ─── 04 — Atmospheric Dispersion (RCAD) ────────────────────────────────────
function DispersionScreen({ openDrawer }: { openDrawer: (ctx: RcDrawerContext) => void }): JSX.Element {
  const { rc, editable } = useRcWorkbook();
  const ad = rc.atmosphericTransportAndDispersion;

  function depositionCcii(id: string): { on: boolean; detail: string } {
    switch (id) {
      case "dry": return { on: ad.deposition.dryDeposition.included, detail: ad.deposition.dryDeposition.approach === "PER_PARTICLE_SIZE" ? "A dry-deposition velocity per particle size." : "A single dry-deposition velocity." };
      case "wet": return { on: ad.deposition.wetDeposition.included, detail: ad.deposition.wetDeposition.precipitationIntensityDependent === true ? "Precipitation-intensity-dependent washout." : "Washout included." };
      case "depletion": return { on: ad.deposition.sourceDepletion.included, detail: ad.deposition.sourceDepletion.scope === "DRY_AND_WET" ? "Dry and wet depletion of the plume." : "Dry depletion of the plume." };
      default: return { on: ad.deposition.resuspension.included, detail: ad.deposition.resuspension.description ?? "Resuspension of the deposited material." };
    }
  }

  const fenceState: Record<string, { on: boolean; detail: string }> = {
    plumerise: { on: ad.plumeRise.credited, detail: ad.plumeRise.algorithmsDescription ?? "Credited through buoyancy algorithms." },
    elevated: { on: (ad.elevatedReleaseAlgorithms ?? "").length > 0, detail: ad.elevatedReleaseAlgorithms ?? "Elevated-release algorithms applied with the justified height." },
    wake: { on: (ad.buildingWakeEffects ?? "").length > 0, detail: ad.buildingWakeEffects ?? "Wake effects applied with the actual building dimensions." },
  };

  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="RC" title="The dispersion model" level={3} />
          <div className="posrow" style={{ gap: 10 }}>
            <RcProvenanceChip>RCAD-A1 · A2 · A3</RcProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => openDrawer({ kind: "dispersion", id: "dispersion" })}><RCIcon.Settings /> Edit</button>}
          </div>
        </div>
        <p className="poscard__sub">The model class, the temporal resolution, the spatial treatment and the weather sampling. Select edit to change them.</p>
        <div className="rcdisp">
          <div className="rcdisp__main">
            <div className="rcdisp__model">{ad.dispersionModel.name ?? DISPERSION_CLASS_LABELS[ad.dispersionModel.modelClass]}</div>
            <p className="rcdisp__desc">{ad.dispersionModel.justification} {ad.temporalResolution.description ?? ""} {ad.spatialTreatment.gridDescription !== undefined ? `${ad.spatialTreatment.gridDescription} ${ad.spatialTreatment.gridJustification ?? ""}` : ""}</p>
          </div>
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="RC" title="The credit fence" level={3} />
          <div className="posrow" style={{ gap: 10 }}>
            <RcProvenanceChip>RCAD-C1 · C2 · C3</RcProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => openDrawer({ kind: "dispersion", id: "dispersion" })}><RCIcon.Settings /> Edit</button>}
          </div>
        </div>
        <p className="poscard__sub">Favorable physics that lowers the dose must be earned, forbidden at CC-I and credited through a justified algorithm at CC-II.</p>
        <div className="rccredit">
          {CREDIT_FENCE.map((f) => {
            const Icon = RCIcon[f.icon] ?? RCIcon.NoEntry;
            const st = fenceState[f.id];
            return (
              <div key={f.id} className="rccredit__row">
                <div className="rccredit__main">
                  <div className="rccredit__name"><Icon /> {f.name}</div>
                  <p className="rccredit__note">{f.note}</p>
                </div>
                <div className="rccredit__side">
                  <span className="rcsplit__cc rcsplit__cc--i">CC-I</span>
                  <span className="rccredit__detail">{f.cci.detail}</span>
                </div>
                <div className="rccredit__side">
                  <span className="rcsplit__cc rcsplit__cc--credit">CC-II</span>
                  <span className="rccredit__detail">{st.detail}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="RC" title="The deposition matrix" level={3} />
          <div className="posrow" style={{ gap: 10 }}>
            <RcProvenanceChip>RCAD-E1 to E7</RcProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => openDrawer({ kind: "deposition", id: "deposition" })}><RCIcon.Settings /> Edit</button>}
          </div>
        </div>
        <p className="poscard__sub">The deposition modules are switched off at CC-I and switched on at CC-II, module by module. Select edit to change the CC-II state and the velocities.</p>
        <div className="rcdepo">
          <div className="rcdepo__row rcdepo__row--head">
            <div className="rcdepo__cell"><span className="rcdepo__process">Deposition process</span></div>
            <div className="rcdepo__cell"><span className="rcdepo__head-cc">CC-I</span></div>
            <div className="rcdepo__cell"><span className="rcdepo__head-cc">CC-II</span></div>
          </div>
          {DEPOSITION_ROWS.map((d) => {
            const ccii = depositionCcii(d.id);
            return (
              <div key={d.id} className="rcdepo__row">
                <div className="rcdepo__cell">
                  <span className="rcdepo__process">{d.process}</span>
                  <span className="rcdepo__process-note">{d.note}</span>
                </div>
                <div className="rcdepo__cell">
                  <span className={`rcdepo__state rcdepo__state--${d.cci.on ? "on" : "off"}`}>
                    {d.cci.on ? <RCIcon.Check /> : <RCIcon.Close />} {d.cci.on ? "On" : "Off"}
                  </span>
                  <span className="rcdepo__state-detail">{d.cci.detail}</span>
                </div>
                <div className="rcdepo__cell">
                  <span className={`rcdepo__state rcdepo__state--${ccii.on ? "on" : "off"}`}>
                    {ccii.on ? <RCIcon.Check /> : <RCIcon.Close />} {ccii.on ? "On" : "Off"}
                  </span>
                  <span className="rcdepo__state-detail">{ccii.detail}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ─── 05 — Dosimetry (RCDO) ─────────────────────────────────────────────────
function DosimetryScreen({ openDrawer }: { openDrawer: (ctx: RcDrawerContext) => void }): JSX.Element {
  const { rc, editable, mutateRc } = useRcWorkbook();
  const dose = rc.dosimetry;
  function addPathway(): void {
    mutateRc((draft) => ({ ...draft, dosimetry: { ...draft.dosimetry, exposurePathways: [...draft.dosimetry.exposurePathways, { pathway: "INGESTION", included: true }] } }));
    openDrawer({ kind: "pathway", id: String(dose.exposurePathways.length) });
  }
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="RC" title="Exposure pathways" level={3} />
          <div className="posrow" style={{ gap: 10 }}>
            <RcProvenanceChip>RCDO-A1</RcProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addPathway}><RCIcon.Plus /> Add pathway</button>}
          </div>
        </div>
        <p className="poscard__sub">Five pathways turn concentration into dose, and any exclusion is justified. Select a pathway to edit it.</p>
        <div className="rcpath">
          {dose.exposurePathways.map((p, i) => {
            const meta = EXPOSURE_PATHWAY_LABELS[p.pathway];
            const Icon = RCIcon[meta?.icon ?? "Activity"] ?? RCIcon.Activity;
            return (
              <button key={i} type="button" className={`rcpath__card${p.included ? "" : " rcpath__card--out"}`} style={{ cursor: "pointer", textAlign: "left", border: "none", width: "100%" }} onClick={() => openDrawer({ kind: "pathway", id: String(i) })}>
                <span className="rcpath__icon"><Icon /></span>
                <div className="rcpath__main">
                  <div className="rcpath__name">{meta?.name ?? p.pathway}</div>
                  <div className="rcpath__note">{p.included ? EXPOSURE_PATHWAY_NOTES[p.pathway] ?? "" : p.exclusionJustification ?? "Excluded."}</div>
                </div>
                <span className={`rcpath__state rcpath__state--${p.included ? "in" : "out"}`}>{p.included ? "Included" : "Excluded"}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="RC" title="Dose treatment" level={3} />
          <div className="posrow" style={{ gap: 10 }}>
            <RcProvenanceChip>RCDO-A4 · A7 · A8 · B1</RcProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => openDrawer({ kind: "dosetreatment", id: "dose" })}><RCIcon.Settings /> Edit</button>}
          </div>
        </div>
        <p className="poscard__sub">The immersion model, the breathing rates, the ingestion and the dose conversion factors each refine from CC-I to CC-II. Select edit to change them.</p>
        <div className="rcgrid--2">
          {DOSE_SPLITS.map((s) => {
            const Icon = RCIcon[s.icon] ?? RCIcon.Sigma;
            return (
              <div key={s.id} className="rccard rccard--health">
                <div className="posrow" style={{ gap: 8, alignItems: "center" }}>
                  <span style={{ color: "var(--rc-health-ink)" }}><Icon /></span>
                  <span style={{ fontWeight: 700, fontSize: 12.5 }}>{s.title}</span>
                </div>
                <SplitLines cci={s.cci} ccii={s.ccii} />
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ─── 06 — Health Effects (RCHE) ────────────────────────────────────────────
function HealthEffectsScreen({ openDrawer }: { openDrawer: (ctx: RcDrawerContext) => void }): JSX.Element {
  const { rc, editable, mutateRc } = useRcWorkbook();
  const he = rc.healthEffects;
  function setEarly(next: string[]): void {
    mutateRc((draft) => ({ ...draft, healthEffects: { ...draft.healthEffects, earlyHealthEffects: next } }));
  }
  function setLatent(next: string[]): void {
    mutateRc((draft) => ({ ...draft, healthEffects: { ...draft.healthEffects, latentHealthEffects: next } }));
  }
  function addRiskFactor(): void {
    mutateRc((draft) => ({ ...draft, healthEffects: { ...draft.healthEffects, riskFactorSources: [...draft.healthEffects.riskFactorSources, { source: "New risk-factor source", recognizedBody: "" }] } }));
    openDrawer({ kind: "riskfactor", id: String(he.riskFactorSources.length) });
  }
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="RC" title="Health effects" level={3} />
          <RcProvenanceChip>RCHE-A1</RcProvenanceChip>
        </div>
        <p className="poscard__sub">The early effects and the latent effects to evaluate are identified, since they need different parameters.</p>
        <div className="rche">
          <div className="rche__col">
            <div className="rche__col-head">
              <div>
                <WorkbookCueLabel workbook="RC" title="Early effects" className="rche__col-title" />
                <div className="rche__col-when">Hours to weeks, from a high acute dose</div>
              </div>
            </div>
            <div className="posfield">
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {he.earlyHealthEffects.map((e, i) => (
                  <div key={i} className="posrow" style={{ gap: 6 }}>
                    <WorkbookInput className="posfield__input" style={{ flex: 1 }} value={e} disabled={!editable} onChange={(ev) => setEarly(he.earlyHealthEffects.map((y, j) => (j === i ? ev.target.value : y)))} />
                    {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => setEarly([...he.earlyHealthEffects.slice(0, i), ...he.earlyHealthEffects.slice(i + 1)])}>Remove</button>}
                  </div>
                ))}
                {editable && <button type="button" className="posnav__btn posnav__btn--sm" style={{ alignSelf: "flex-start" }} onClick={() => setEarly([...he.earlyHealthEffects, "New early effect"])}><RCIcon.Plus /> Add effect</button>}
              </div>
            </div>
          </div>
          <div className="rche__col rche__col--latent">
            <div className="rche__col-head">
              <div>
                <WorkbookCueLabel workbook="RC" title="Latent effects" className="rche__col-title" />
                <div className="rche__col-when">Years to decades, from any dose</div>
              </div>
            </div>
            <div className="posfield">
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {he.latentHealthEffects.map((e, i) => (
                  <div key={i} className="posrow" style={{ gap: 6 }}>
                    <WorkbookInput className="posfield__input" style={{ flex: 1 }} value={e} disabled={!editable} onChange={(ev) => setLatent(he.latentHealthEffects.map((y, j) => (j === i ? ev.target.value : y)))} />
                    {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => setLatent([...he.latentHealthEffects.slice(0, i), ...he.latentHealthEffects.slice(i + 1)])}>Remove</button>}
                  </div>
                ))}
                {editable && <button type="button" className="posnav__btn posnav__btn--sm" style={{ alignSelf: "flex-start" }} onClick={() => setLatent([...he.latentHealthEffects, "New latent effect"])}><RCIcon.Plus /> Add effect</button>}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="RC" title="Effect parameters" level={3} />
          <div className="posrow" style={{ gap: 10 }}>
            <RcProvenanceChip>RCHE-A2 · A3</RcProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => openDrawer({ kind: "healthparams", id: "he" })}><RCIcon.Settings /> Edit</button>}
          </div>
        </div>
        <p className="poscard__sub">Simplified parameters at CC-I, or organ-specific dose-response with the dose-rate effectiveness at CC-II.</p>
        <div className="rcgrid--2">
          {HE_PARAM_SPLITS.map((s) => (
            <div key={s.id} className="rccard rccard--health">
              <span style={{ fontWeight: 700, fontSize: 12.5 }}>{s.title}</span>
              <SplitLines cci={s.cci} ccii={s.ccii} />
            </div>
          ))}
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="RC" title="Risk-factor sources" level={3} />
          <div className="posrow" style={{ gap: 10 }}>
            <RcProvenanceChip>RCHE-B1</RcProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addRiskFactor}><RCIcon.Plus /> Add source</button>}
          </div>
        </div>
        <p className="poscard__sub">Every risk factor is anchored to an internationally recognized body, not a local derivation. Select a source to edit it.</p>
        <div className="rcgrid--2">
          {he.riskFactorSources.map((r, i) => (
            <button key={i} type="button" className="rccard rccard--health" style={{ cursor: "pointer", textAlign: "left", border: "none", width: "100%" }} onClick={() => openDrawer({ kind: "riskfactor", id: String(i) })}>
              <div className="posrow" style={{ gap: 8, alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontWeight: 700, fontSize: 12.5 }}>{r.source}</span>
                <span className="rcse rcse--health">{r.recognizedBody}</span>
              </div>
              <p className="possubtle" style={{ fontSize: 11.5, lineHeight: 1.45, margin: 0 }}>{r.version !== undefined ? `Version ${r.version}, ` : ""}a recognized risk-factor source.</p>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

// ─── 07 — Economic Factors (RCEC) ──────────────────────────────────────────
function EconomicsScreen({ openDrawer }: { openDrawer: (ctx: RcDrawerContext) => void }): JSX.Element {
  const { rc, editable, mutateRc } = useRcWorkbook();
  const ec = rc.economicFactors;
  function addCategory(): void {
    mutateRc((draft) => ({ ...draft, economicFactors: { ...draft.economicFactors, costCategories: [...draft.economicFactors.costCategories, { category: "New cost category", parameterDefinitions: [""] }] } }));
    openDrawer({ kind: "costcategory", id: String(ec.costCategories.length) });
  }
  function addParam(): void {
    mutateRc((draft) => ({ ...draft, economicFactors: { ...draft.economicFactors, costParameterEstimates: [...draft.economicFactors.costParameterEstimates, { parameter: "New parameter", dataBasis: "GENERIC_JUSTIFIED", source: "" }] } }));
    openDrawer({ kind: "costparam", id: String(ec.costParameterEstimates.length) });
  }
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="RC" title="Cost categories" level={3} />
          <div className="posrow" style={{ gap: 10 }}>
            <RcProvenanceChip>RCEC-A1</RcProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addCategory}><RCIcon.Plus /> Add category</button>}
          </div>
        </div>
        <p className="poscard__sub">The off-site cost is split into categories, since the standard refuses to let the societal-cost number be folklore. Select a category to edit it.</p>
        <div className="rccost">
          {ec.costCategories.map((c, i) => {
            const Icon = RCIcon[COST_CATEGORY_ICONS[c.category] ?? "Dollar"] ?? RCIcon.Dollar;
            return (
              <button key={i} type="button" className="rccost__cell" style={{ cursor: "pointer", textAlign: "left", border: "none", width: "100%" }} onClick={() => openDrawer({ kind: "costcategory", id: String(i) })}>
                <span className="rccost__icon"><Icon /></span>
                <div className="rccost__main">
                  <div className="rccost__name">{c.category}</div>
                  <div className="rccost__note">{c.parameterDefinitions[0] ?? ""}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="RC" title="Economic data" level={3} />
          <div className="posrow" style={{ gap: 10 }}>
            <RcProvenanceChip>RCEC-B1 to B7</RcProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addParam}><RCIcon.Plus /> Add parameter</button>}
          </div>
        </div>
        <p className="poscard__sub">The cost parameters use regional data, from recognized sources, adjusted to a common year. Select a row to edit it.</p>
        <div className="rcbasis">
          {ec.costParameterEstimates.map((e, i) => {
            const Icon = RCIcon[COST_PARAM_ICONS[e.parameter] ?? "Dollar"] ?? RCIcon.Dollar;
            const regional = e.dataBasis === "REGIONAL_SITE_APPLICABLE";
            return (
              <button key={i} type="button" className="rcbasis__row" style={{ cursor: "pointer", textAlign: "left", border: "none", width: "100%" }} onClick={() => openDrawer({ kind: "costparam", id: String(i) })}>
                <span className="rcbasis__icon"><Icon /></span>
                <div className="rcbasis__main">
                  <div className="rcbasis__name">{e.parameter}</div>
                  <div className="rcbasis__note">{e.timeFrameAdjustment ?? e.source}</div>
                </div>
                <span className={`rcbasis__tag rcbasis__tag--${regional ? "rich" : "simple"}`}>{regional ? "Regional" : "Generic"}</span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

export { DispersionScreen, DosimetryScreen, HealthEffectsScreen, EconomicsScreen };
