import { JSX } from "react";
import { RCIcon } from "./rcIcons";
import { RcProvenanceChip } from "./rcShared";
import { useRcWorkbook } from "./rcWorkbookContext";
import { MethodChips } from "./rcScreens";
import {
  DISPERSION_LADDER,
  DISPERSION_CLASS_LABELS,
  DISPERSION_MODEL_METHOD,
  SAMPLING_LADDER,
  CREDIT_FENCE,
  DEPOSITION_ROWS,
  DEPOSITION_NOTE,
  EXPOSURE_PATHWAY_LABELS,
  EXPOSURE_PATHWAY_NOTES,
  DOSE_SPLITS,
  HE_PARAM_SPLITS,
  HE_AGE_GENDER,
  HE_BASIS,
  COST_CATEGORY_ICONS,
  ECONOMIC_ROW_META,
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
function DispersionScreen(): JSX.Element {
  const { rc } = useRcWorkbook();
  const ad = rc.atmosphericTransportAndDispersion;
  const meanShift = ad.meteorologicalSampling.meanShiftValidation?.meanShiftPercent;

  function depositionCcii(id: string): { on: boolean; detail: string } {
    switch (id) {
      case "dry": return { on: ad.deposition.dryDeposition.included, detail: ad.deposition.dryDeposition.approach === "PER_PARTICLE_SIZE" ? "A dry-deposition velocity per particle size." : "A single dry-deposition velocity." };
      case "wet": return { on: ad.deposition.wetDeposition.included, detail: ad.deposition.wetDeposition.precipitationIntensityDependent === true ? "Precipitation-intensity-dependent washout." : "Washout included." };
      case "depletion": return { on: ad.deposition.sourceDepletion.included, detail: ad.deposition.sourceDepletion.scope === "DRY_AND_WET" ? "Dry and wet depletion of the plume." : "Dry depletion of the plume." };
      default: return { on: ad.deposition.resuspension.included, detail: ad.deposition.resuspension.description ?? "Resuspension of the deposited material." };
    }
  }

  const fenceDetails: Record<string, string> = {
    plumerise: ad.plumeRise.algorithmsDescription ?? "Credited through buoyancy algorithms at CC-II.",
    elevated: ad.elevatedReleaseAlgorithms ?? "Elevated-release algorithms applied with the justified height at CC-II.",
    wake: ad.buildingWakeEffects ?? "Wake effects applied with the actual building dimensions at CC-II.",
  };

  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">The dispersion-model ladder</h3>
          <RcProvenanceChip>RCAD-A1 · A2 · A3</RcProvenanceChip>
        </div>
        <p className="poscard__sub">A straight-line Gaussian plume at CC-I, or a segmented plume with hourly updates on a justified grid at CC-II.</p>
        <div className="rcsplit rcsplit--atmos">
          <div className="rcsplit__col">
            <span className="rcsplit__cc rcsplit__cc--i">CC-I</span>
            <div className="rcsplit__title">{DISPERSION_LADDER.cci.title}</div>
            <p className="rcsplit__desc">{DISPERSION_LADDER.cci.desc}</p>
            <span className="rcsplit__tag"><RCIcon.Wind /> {DISPERSION_LADDER.cci.tag}</span>
          </div>
          <div className="rcsplit__col rcsplit__col--ii">
            <span className="rcsplit__cc rcsplit__cc--ii">CC-II</span>
            <div className="rcsplit__title">{DISPERSION_LADDER.ccii.title}</div>
            <p className="rcsplit__desc">{DISPERSION_LADDER.ccii.desc}</p>
            <span className="rcsplit__tag"><RCIcon.Cloud /> {DISPERSION_LADDER.ccii.tag}</span>
          </div>
        </div>
        <div className="rcdisp" style={{ marginTop: 12 }}>
          <div className="rcdisp__main">
            <div className="rcdisp__model">{ad.dispersionModel.name ?? DISPERSION_CLASS_LABELS[ad.dispersionModel.modelClass]}</div>
            <p className="rcdisp__desc">{ad.dispersionModel.justification} {ad.temporalResolution.description ?? ""} {ad.spatialTreatment.gridDescription !== undefined ? `${ad.spatialTreatment.gridDescription} ${ad.spatialTreatment.gridJustification ?? ""}` : ""}</p>
            <div style={{ marginTop: 8 }}><MethodChips ids={[DISPERSION_MODEL_METHOD[ad.dispersionModel.modelClass] ?? "segmented"]} label="Solved by" /></div>
          </div>
          <span className="rcdisp__class">{DISPERSION_CLASS_LABELS[ad.dispersionModel.modelClass] ?? ad.dispersionModel.modelClass}</span>
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Weather sampling</h3>
          <RcProvenanceChip>RCAD-B2</RcProvenanceChip>
        </div>
        <p className="poscard__sub">Bounding meteorology at CC-I, or sampling the weather year at CC-II, validated to shift the mean by less than ten percent.</p>
        <div className="rcsplit rcsplit--atmos">
          <div className="rcsplit__col">
            <span className="rcsplit__cc rcsplit__cc--i">CC-I</span>
            <div className="rcsplit__title">{SAMPLING_LADDER.cci.title}</div>
            <p className="rcsplit__desc">{SAMPLING_LADDER.cci.desc}</p>
            <span className="rcsplit__tag"><RCIcon.Filter /> {SAMPLING_LADDER.cci.tag}</span>
          </div>
          <div className="rcsplit__col rcsplit__col--ii">
            <span className="rcsplit__cc rcsplit__cc--ii">CC-II</span>
            <div className="rcsplit__title">{SAMPLING_LADDER.ccii.title}</div>
            <p className="rcsplit__desc">{SAMPLING_LADDER.ccii.desc}</p>
            <span className="rcsplit__tag"><RCIcon.Curve /> {SAMPLING_LADDER.ccii.tag}</span>
          </div>
        </div>
        <div className="hrnote" style={{ marginTop: 12 }}>
          <RCIcon.Verified />
          <span>{meanShift !== undefined ? `The weather sample reproduces the full-year mean within ${meanShift} percent, inside the ten percent criterion. ` : ""}{SAMPLING_LADDER.note}</span>
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">The credit fence</h3>
          <RcProvenanceChip>RCAD-C1 · C2 · C3</RcProvenanceChip>
        </div>
        <p className="poscard__sub">Favorable physics that lowers the dose must be earned, forbidden at CC-I and credited through a justified algorithm at CC-II.</p>
        <div className="rccredit">
          {CREDIT_FENCE.map((f) => {
            const Icon = RCIcon[f.icon] ?? RCIcon.NoEntry;
            return (
              <div key={f.id} className="rccredit__row">
                <div className="rccredit__main">
                  <div className="rccredit__name"><Icon /> {f.name}</div>
                  <p className="rccredit__note">{f.note}</p>
                </div>
                <div className="rccredit__side">
                  <span className="rcsplit__cc rcsplit__cc--i">CC-I</span>
                  <span className="rccredit__state rccredit__state--forbidden">{f.cci.text}</span>
                  <span className="rccredit__detail">{f.cci.detail}</span>
                </div>
                <div className="rccredit__side">
                  <span className="rcsplit__cc rcsplit__cc--credit">CC-II</span>
                  <span className="rccredit__state rccredit__state--earned">{f.cciiText}</span>
                  <span className="rccredit__detail">{fenceDetails[f.id]}</span>
                </div>
              </div>
            );
          })}
        </div>
        <div className="hrnote" style={{ marginTop: 12 }}>
          <RCIcon.NoEntry />
          <span>The standard says it in capital letters, DO NOT TAKE CREDIT for plume rise at CC-I, so the buoyancy algorithm earns the credit at CC-II.</span>
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">The deposition matrix</h3>
          <RcProvenanceChip>RCAD-E1 to E7</RcProvenanceChip>
        </div>
        <p className="poscard__sub">The deposition modules are switched off at CC-I and switched on at CC-II, module by module.</p>
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
        <div className="hrnote" style={{ marginTop: 12 }}>
          <RCIcon.NoEntry />
          <span>{DEPOSITION_NOTE}</span>
        </div>
      </div>
    </>
  );
}

// ─── 05 — Dosimetry (RCDO) ─────────────────────────────────────────────────
function DosimetryScreen(): JSX.Element {
  const { rc } = useRcWorkbook();
  const dose = rc.dosimetry;
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Exposure pathways</h3>
          <RcProvenanceChip>RCDO-A1</RcProvenanceChip>
        </div>
        <p className="poscard__sub">Five pathways turn concentration into dose, and any exclusion is justified.</p>
        <div className="rcpath">
          {dose.exposurePathways.map((p) => {
            const meta = EXPOSURE_PATHWAY_LABELS[p.pathway];
            const Icon = RCIcon[meta?.icon ?? "Activity"] ?? RCIcon.Activity;
            return (
              <div key={p.pathway} className={`rcpath__card${p.included ? "" : " rcpath__card--out"}`}>
                <span className="rcpath__icon"><Icon /></span>
                <div className="rcpath__main">
                  <div className="rcpath__name">{meta?.name ?? p.pathway}</div>
                  <div className="rcpath__note">{p.included ? EXPOSURE_PATHWAY_NOTES[p.pathway] ?? "" : p.exclusionJustification ?? "Excluded."}</div>
                </div>
                <span className={`rcpath__state rcpath__state--${p.included ? "in" : "out"}`}>{meta?.ccii === true ? "CC-II" : p.included ? "Included" : "Excluded"}</span>
              </div>
            );
          })}
        </div>
        <div className="hrnote" style={{ marginTop: 12 }}>
          <RCIcon.Lungs />
          <span>The skin and the ingestion pathways are off at CC-I and on at CC-II, so the dose set grows with the capability category.</span>
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Dose treatment</h3>
          <RcProvenanceChip>RCDO-A4 · A7 · A8 · B1</RcProvenanceChip>
        </div>
        <p className="poscard__sub">The immersion model, the breathing rates, the ingestion and the dose conversion factors each refine from CC-I to CC-II.</p>
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
        <div className="hrnote" style={{ marginTop: 12 }}>
          <RCIcon.Sigma />
          <span>{dose.dcf.source} The dose conversion factors come from a recognized source either way, with the {dose.dcf.type === "ORGAN_SPECIFIC" ? "organ-specific" : "effective"} set used here.</span>
        </div>
      </div>
    </>
  );
}

// ─── 06 — Health Effects (RCHE) ────────────────────────────────────────────
function HealthEffectsScreen(): JSX.Element {
  const { rc } = useRcWorkbook();
  const he = rc.healthEffects;
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Health effects</h3>
          <RcProvenanceChip>RCHE-A1</RcProvenanceChip>
        </div>
        <p className="poscard__sub">The early effects and the latent effects to evaluate are identified, since they need different parameters.</p>
        <div className="rche">
          <div className="rche__col">
            <div className="rche__col-head">
              <span className="rche__col-icon"><RCIcon.Pulse /></span>
              <div>
                <div className="rche__col-title">Early effects</div>
                <div className="rche__col-when">Hours to weeks, from a high acute dose</div>
              </div>
            </div>
            <div className="rche__list">
              {he.earlyHealthEffects.map((e) => <div key={e} className="rche__item"><RCIcon.Check /> {e}</div>)}
            </div>
          </div>
          <div className="rche__col rche__col--latent">
            <div className="rche__col-head">
              <span className="rche__col-icon"><RCIcon.Heart /></span>
              <div>
                <div className="rche__col-title">Latent effects</div>
                <div className="rche__col-when">Years to decades, from any dose</div>
              </div>
            </div>
            <div className="rche__list">
              {he.latentHealthEffects.map((e) => <div key={e} className="rche__item"><RCIcon.Check /> {e}</div>)}
            </div>
          </div>
        </div>
        <div className="hrnote" style={{ marginTop: 12 }}>
          <RCIcon.Users />
          <span>{HE_AGE_GENDER}</span>
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Effect parameters</h3>
          <RcProvenanceChip>RCHE-A2 · A3</RcProvenanceChip>
        </div>
        <p className="poscard__sub">Simplified parameters at CC-I, or organ-specific dose-response with the dose-rate effectiveness at CC-II.</p>
        <div className="rcgrid--2">
          {HE_PARAM_SPLITS.map((s) => {
            const Icon = RCIcon[s.icon] ?? RCIcon.Heart;
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

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Risk-factor sources</h3>
          <RcProvenanceChip>RCHE-B1</RcProvenanceChip>
        </div>
        <p className="poscard__sub">Every risk factor is anchored to an internationally recognized body, not a local derivation.</p>
        <div className="rcgrid--2">
          {he.riskFactorSources.map((r) => (
            <div key={r.source} className="rccard rccard--health">
              <div className="posrow" style={{ gap: 8, alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontWeight: 700, fontSize: 12.5 }}>{r.source}</span>
                <span className="rcse rcse--health">{r.recognizedBody}</span>
              </div>
              <p className="possubtle" style={{ fontSize: 11.5, lineHeight: 1.45, margin: 0 }}>{r.version !== undefined ? `Version ${r.version}, ` : ""}a recognized risk-factor source.</p>
            </div>
          ))}
        </div>
        <div className="hrnote" style={{ marginTop: 12 }}>
          <RCIcon.Verified />
          <span>{HE_BASIS}</span>
        </div>
      </div>
    </>
  );
}

// ─── 07 — Economic Factors (RCEC) ──────────────────────────────────────────
function EconomicsScreen(): JSX.Element {
  const { rc } = useRcWorkbook();
  const ec = rc.economicFactors;
  return (
    <>
      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Cost categories</h3>
          <RcProvenanceChip>RCEC-A1</RcProvenanceChip>
        </div>
        <p className="poscard__sub">The off-site cost is split into categories, since the standard refuses to let the societal-cost number be folklore.</p>
        <div className="rccost">
          {ec.costCategories.map((c) => {
            const Icon = RCIcon[COST_CATEGORY_ICONS[c.category] ?? "Dollar"] ?? RCIcon.Dollar;
            return (
              <div key={c.category} className="rccost__cell">
                <span className="rccost__icon"><Icon /></span>
                <div className="rccost__main">
                  <div className="rccost__name">{c.category}</div>
                  <div className="rccost__note">{c.parameterDefinitions[0] ?? ""}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="poscard">
        <div className="poscard__head">
          <h3 className="poscard__title">Economic data</h3>
          <RcProvenanceChip>RCEC-B1 to B7</RcProvenanceChip>
        </div>
        <p className="poscard__sub">The cost parameters use regional data, from recognized sources, adjusted to a common year.</p>
        <div className="rcbasis">
          {ec.costParameterEstimates.map((e) => {
            const meta = ECONOMIC_ROW_META[e.parameter] ?? { icon: "Dollar", tag: "Regional", kind: "rich" as const };
            const Icon = RCIcon[meta.icon] ?? RCIcon.Dollar;
            return (
              <div key={e.parameter} className="rcbasis__row">
                <span className="rcbasis__icon"><Icon /></span>
                <div className="rcbasis__main">
                  <div className="rcbasis__name">{e.parameter}</div>
                  <div className="rcbasis__note">{e.timeFrameAdjustment ?? e.source}</div>
                </div>
                <span className={`rcbasis__tag rcbasis__tag--${meta.kind}`}>{meta.tag}</span>
              </div>
            );
          })}
        </div>
        {ec.costParameterEstimates[0]?.justification !== undefined && (
          <div className="hrnote" style={{ marginTop: 12 }}>
            <RCIcon.Globe />
            <span>{ec.costParameterEstimates[0].justification}</span>
          </div>
        )}
      </div>
    </>
  );
}

export { DispersionScreen, DosimetryScreen, HealthEffectsScreen, EconomicsScreen };
