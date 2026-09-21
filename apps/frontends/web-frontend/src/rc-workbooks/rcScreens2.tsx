import { WorkbookCueLabel, WorkbookSectionHeading } from "../workbooks/workbookSectionHeading";
import { WorkbookInput } from "../workbooks/commitOnDeactivateFields";
import { JSX } from "react";
import { RCIcon } from "./rcIcons";
import { RcProvenanceChip } from "./rcShared";
import { useRcWorkbook } from "./rcWorkbookContext";
import { type RcDrawerContext } from "./rcScreens";
import { RcDosePanel } from "./rcDoseInputs";
import { RcTransportPanel } from "./rcTransport";
import {
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
  return <RcTransportPanel openEditor={kind => openDrawer({ kind, id: kind })} />;
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
      <RcDosePanel />
      <div className="poscard">
        <div className="poscard__head">
          <WorkbookSectionHeading workbook="RC" title="Exposure pathways" level={3} />
          <div className="posrow" style={{ gap: 10 }}>
            <RcProvenanceChip>RCDO-A1</RcProvenanceChip>
            {editable && <button type="button" className="posnav__btn posnav__btn--sm posnav__btn--primary" onClick={addPathway}><RCIcon.Plus /> Add pathway</button>}
          </div>
        </div>
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
