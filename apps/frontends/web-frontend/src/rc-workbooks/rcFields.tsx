import { WorkbookCueLabel, WorkbookSectionHeading } from "../workbooks/workbookSectionHeading";
import { WorkbookInput, WorkbookTextarea } from "../workbooks/commitOnDeactivateFields";
import { JSX } from "react";
import { RCIcon } from "./rcIcons";

function DrawerHead({ cap, title, sub, onClose }: { cap: string; title: string; sub?: string; onClose: () => void }): JSX.Element {
  return (
    <div className="posdrawer__head">
      <div>
        <div className="posdrawer__cap">{cap}</div>
        <WorkbookSectionHeading workbook="RC" title={title} cueKey={cap} description={sub} level={2} className="posdrawer__title" />
      </div>
      <button type="button" className="posdrawer__close" onClick={onClose}><RCIcon.Close /></button>
    </div>
  );
}

function RcTextField({ label, value, onChange, disabled }: { label: string; value: string; onChange: (v: string) => void; disabled: boolean }): JSX.Element {
  return (
    <div className="posfield">
      <label className="posfield__label">{label}</label>
      <WorkbookInput className="posfield__input" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function RcAreaField({ label, value, onChange, disabled, rows = 3 }: { label: string; value: string; onChange: (v: string) => void; disabled: boolean; rows?: number }): JSX.Element {
  return (
    <div className="posfield">
      <label className="posfield__label">{label}</label>
      <WorkbookTextarea className="posfield__textarea" rows={rows} style={{ resize: "vertical" }} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function RcNumberField({ label, value, onChange, disabled }: { label: string; value: number; onChange: (v: number) => void; disabled: boolean }): JSX.Element {
  return (
    <div className="posfield">
      <label className="posfield__label">{label}</label>
      <WorkbookInput className="posfield__input posmono" type="number" step="any" value={value} disabled={disabled} onChange={(e) => { const v = Number(e.target.value); if (!Number.isNaN(v)) onChange(v); }} />
    </div>
  );
}

function RcSelectField({ label, value, options, onChange, disabled }: { label: string; value: string; options: [string, string][]; onChange: (v: string) => void; disabled: boolean }): JSX.Element {
  return (
    <div className="posfield">
      <label className="posfield__label">{label}</label>
      <select className="posfield__select" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );
}

function RcStringList({ label, values, onChange, disabled }: { label: string; values: string[]; onChange: (v: string[]) => void; disabled: boolean }): JSX.Element {
  return (
    <div className="posfield">
      <label className="posfield__label">{label}</label>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {values.map((v, i) => (
          <div key={i} className="posrow" style={{ gap: 6 }}>
            <WorkbookInput className="posfield__input" style={{ flex: 1 }} value={v} disabled={disabled} onChange={(e) => onChange(values.map((y, j) => (j === i ? e.target.value : y)))} />
            {!disabled && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => onChange([...values.slice(0, i), ...values.slice(i + 1)])}>Remove</button>}
          </div>
        ))}
        {!disabled && <button type="button" className="posnav__btn posnav__btn--sm" style={{ alignSelf: "flex-start" }} onClick={() => onChange([...values, ""])}><RCIcon.Plus /> Add</button>}
      </div>
    </div>
  );
}

function RemoveBtn({ label, onClick }: { label: string; onClick: () => void }): JSX.Element {
  return <button type="button" className="posnav__btn" style={{ alignSelf: "flex-start" }} onClick={onClick}>{label}</button>;
}

function SrChips({ srs }: { srs: { sr: string }[] }): JSX.Element {
  return (
    <div>
      <WorkbookCueLabel workbook="RC" title="Standard requirements" className="essec" />
      <div className="posdrawer__srs">{srs.map((s) => <span key={s.sr} className="poschip posmono">{s.sr}</span>)}</div>
    </div>
  );
}

const YESNO_OPTIONS: [string, string][] = [["yes", "Yes"], ["no", "No"]];
const SIG_OPTIONS: [string, string][] = [["HIGH", "High"], ["MEDIUM", "Medium"], ["LOW", "Low"]];
const STATUS_OPTIONS: [string, string][] = [["OPEN", "Open"], ["IN_PROGRESS", "In progress"], ["CLOSED", "Closed"]];
const EVAL_TYPE_OPTIONS: [string, string][] = [["QUALITATIVE", "Qualitative"], ["QUANTITATIVE", "Quantitative"]];
const EVAL_SCOPE_OPTIONS: [string, string][] = [["INDIVIDUAL", "Individual"], ["COMBINATION", "Combination"]];
const PROT_ACTION_OPTIONS: [string, string][] = [
  ["EVACUATION", "Evacuation"],
  ["SHELTERING", "Sheltering"],
  ["RELOCATION", "Relocation"],
  ["LAND_INTERDICTION_REMEDIATION", "Land interdiction and remediation"],
  ["FOOD_INTERDICTION_REMEDIATION", "Food interdiction and remediation"],
];
const PHASE_OPTIONS: [string, string][] = [["EARLY", "Early"], ["INTERMEDIATE", "Intermediate"], ["LATE_LONG_TERM", "Late, long term"]];
const COHORT_APPROACH_OPTIONS: [string, string][] = [["SINGLE_COHORT", "Single cohort"], ["MULTIPLE_COHORTS", "Multiple cohorts"]];
const POP_BASIS_OPTIONS: [string, string][] = [["ASSUMED_JUSTIFIED", "Assumed and justified"], ["DEMOGRAPHIC_SOURCES", "Census demographics"]];
const LAND_BASIS_OPTIONS: [string, string][] = [["GENERIC_SIMPLIFIED", "Generic"], ["REGIONAL_SPECIFIC", "Regional"]];
const PLANT_BASIS_OPTIONS: [string, string][] = [["ESTIMATED", "Estimated"], ["ACTUAL", "Actual"]];
const EVAC_COMPONENT_OPTIONS: [string, string][] = [
  ["GENERAL_EMERGENCY_DECLARATION", "General emergency is declared"],
  ["SITE_NOTIFIES_OFFICIALS", "Site notifies the officials"],
  ["OFFICIALS_NOTIFY_PUBLIC", "Officials notify the public"],
  ["PUBLIC_RECEIVES_INSTRUCTIONS", "Public receives the instructions"],
  ["SECURE_PERSONAL_PROPERTY", "People secure personal property"],
  ["LOAD_VEHICLES", "People load vehicles and depart"],
];
const PERIOD_APPROACH_OPTIONS: [string, string][] = [["REPRESENTATIVE_SINGLE_YEAR", "Representative single year"], ["MULTI_YEAR_EVALUATION", "Multi-year evaluation"]];
const STABILITY_OPTIONS: [string, string][] = [["SIMPLIFIED", "Simplified"], ["RECOGNIZED_SOURCE", "Recognized source"]];
const MIXING_SCOPE_OPTIONS: [string, string][] = [["SEASONAL_AFTERNOON", "Seasonal afternoon"], ["SEASONAL_MORNING_AND_AFTERNOON", "Seasonal morning and afternoon"]];
const MODEL_CLASS_OPTIONS: [string, string][] = [["STRAIGHT_LINE_GAUSSIAN", "Straight-line Gaussian"], ["SEGMENTED_PLUME", "Segmented plume"], ["OTHER_VARIABLE_TRAJECTORY", "Other variable trajectory"]];
const TEMPORAL_OPTIONS: [string, string][] = [["STEADY_STATE", "Steady state"], ["HOURLY_UPDATES", "Hourly updates"]];
const SPATIAL_OPTIONS: [string, string][] = [["CENTERLINE", "Centerline"], ["TWO_DIMENSIONAL_GRID", "Two-dimensional grid"]];
const SAMPLING_OPTIONS: [string, string][] = [["BOUNDING_CONDITIONS", "Bounding conditions"], ["STATISTICAL_SAMPLING", "Statistical sampling"]];
const SEGMENTATION_OPTIONS: [string, string][] = [["SINGLE_PLUME", "Single plume"], ["MULTIPLE_PLUMES", "Multiple plumes"]];
const DRY_APPROACH_OPTIONS: [string, string][] = [["SINGLE_VELOCITY", "Single velocity"], ["PER_PARTICLE_SIZE", "Per particle size"]];
const DEPLETION_SCOPE_OPTIONS: [string, string][] = [["DRY_ONLY_JUSTIFIED", "Dry only, justified"], ["DRY_AND_WET", "Dry and wet"]];
const PATHWAY_OPTIONS: [string, string][] = [
  ["CLOUDSHINE", "Cloudshine"],
  ["GROUNDSHINE", "Groundshine"],
  ["SKIN_DEPOSITION", "Skin deposition"],
  ["INHALATION", "Inhalation"],
  ["INGESTION", "Ingestion"],
];
const IMMERSION_OPTIONS: [string, string][] = [["SEMI_INFINITE", "Semi-infinite"], ["FINITE_PLUME_OR_CORRECTED", "Finite plume or corrected"]];
const BREATHING_OPTIONS: [string, string][] = [["GENERIC", "Generic"], ["PER_COHORT_JUSTIFIED", "Per cohort, justified"]];
const INGESTION_OPTIONS: [string, string][] = [["EXCLUDED", "Excluded"], ["GENERIC_INTAKE", "Generic intake"]];
const DCF_TYPE_OPTIONS: [string, string][] = [["EFFECTIVE", "Effective"], ["ORGAN_SPECIFIC", "Organ-specific"]];
const EARLY_EFFECT_OPTIONS: [string, string][] = [["SIMPLIFIED_ORGANS_OR_REDUCED_RADIONUCLIDES", "Simplified organs or reduced radionuclides"], ["ORGAN_SPECIFIC_DOSE_RESPONSE", "Organ-specific dose response"]];
const LATENT_EFFECT_OPTIONS: [string, string][] = [["SIMPLIFIED_TEDE_OR_REDUCED_RADIONUCLIDES", "Simplified TEDE or reduced radionuclides"], ["ORGAN_SPECIFIC_FACTORS", "Organ-specific factors"]];
const ECON_BASIS_OPTIONS: [string, string][] = [["REGIONAL_SITE_APPLICABLE", "Regional, site applicable"], ["GENERIC_JUSTIFIED", "Generic, justified"]];
const UNCERT_LEVEL_OPTIONS: [string, string][] = [["CHARACTERIZED", "Characterized"], ["PROPAGATED_WITH_PHENOMENA_DEPENDENCIES", "Propagated with phenomena dependencies"]];
const RI_FB_STATUS_OPTIONS: [string, string][] = [["PENDING", "Pending"], ["IN_PROGRESS", "In progress"], ["ADDRESSED", "Addressed"], ["DEFERRED", "Deferred"]];
const RI_RESP_STATUS_OPTIONS: [string, string][] = [["PENDING", "Pending"], ["IN_PROGRESS", "In progress"], ["COMPLETED", "Completed"]];
const SUB_ELEMENT_OPTIONS: [string, string][] = [
  ["RCRE", "RCRE"],
  ["RCPA", "RCPA"],
  ["RCME", "RCME"],
  ["RCAD", "RCAD"],
  ["RCDO", "RCDO"],
  ["RCHE", "RCHE"],
  ["RCEC", "RCEC"],
  ["RCQ", "RCQ"],
];

export {
  DrawerHead,
  RcTextField,
  RcAreaField,
  RcNumberField,
  RcSelectField,
  RcStringList,
  RemoveBtn,
  SrChips,
  YESNO_OPTIONS,
  SIG_OPTIONS,
  STATUS_OPTIONS,
  EVAL_TYPE_OPTIONS,
  EVAL_SCOPE_OPTIONS,
  PROT_ACTION_OPTIONS,
  PHASE_OPTIONS,
  COHORT_APPROACH_OPTIONS,
  POP_BASIS_OPTIONS,
  LAND_BASIS_OPTIONS,
  PLANT_BASIS_OPTIONS,
  EVAC_COMPONENT_OPTIONS,
  PERIOD_APPROACH_OPTIONS,
  STABILITY_OPTIONS,
  MIXING_SCOPE_OPTIONS,
  MODEL_CLASS_OPTIONS,
  TEMPORAL_OPTIONS,
  SPATIAL_OPTIONS,
  SAMPLING_OPTIONS,
  SEGMENTATION_OPTIONS,
  DRY_APPROACH_OPTIONS,
  DEPLETION_SCOPE_OPTIONS,
  PATHWAY_OPTIONS,
  IMMERSION_OPTIONS,
  BREATHING_OPTIONS,
  INGESTION_OPTIONS,
  DCF_TYPE_OPTIONS,
  EARLY_EFFECT_OPTIONS,
  LATENT_EFFECT_OPTIONS,
  ECON_BASIS_OPTIONS,
  UNCERT_LEVEL_OPTIONS,
  SUB_ELEMENT_OPTIONS,
  RI_FB_STATUS_OPTIONS,
  RI_RESP_STATUS_OPTIONS,
};
