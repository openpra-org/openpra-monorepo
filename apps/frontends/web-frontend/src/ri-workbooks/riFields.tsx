import { WorkbookInput, WorkbookTextarea } from "../workbooks/commitOnDeactivateFields";
import { JSX } from "react";
import { RIIcon } from "./riIcons";

function DrawerHead({ cap, title, sub, onClose }: { cap: string; title: string; sub?: string; onClose: () => void }): JSX.Element {
  return (
    <div className="posdrawer__head">
      <div>
        <div className="posdrawer__cap">{cap}</div>
        <h2 className="posdrawer__title">{title}</h2>
        {sub !== undefined && <p className="posdrawer__sub">{sub}</p>}
      </div>
      <button type="button" className="posdrawer__close" onClick={onClose}><RIIcon.Close /></button>
    </div>
  );
}

function RiTextField({ label, value, onChange, disabled, placeholder }: { label: string; value: string; onChange: (v: string) => void; disabled: boolean; placeholder?: string }): JSX.Element {
  return (
    <div className="posfield">
      <label className="posfield__label">{label}</label>
      <WorkbookInput className="posfield__input" value={value} placeholder={placeholder} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function RiAreaField({ label, value, onChange, disabled, rows = 3 }: { label: string; value: string; onChange: (v: string) => void; disabled: boolean; rows?: number }): JSX.Element {
  return (
    <div className="posfield">
      <label className="posfield__label">{label}</label>
      <WorkbookTextarea className="posfield__textarea" rows={rows} style={{ resize: "vertical" }} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function RiNumberField({ label, value, onChange, disabled }: { label: string; value: number; onChange: (v: number) => void; disabled: boolean }): JSX.Element {
  return (
    <div className="posfield">
      <label className="posfield__label">{label}</label>
      <WorkbookInput className="posfield__input posmono" type="number" step="any" value={value} disabled={disabled} onChange={(e) => { const v = Number(e.target.value); if (!Number.isNaN(v)) onChange(v); }} />
    </div>
  );
}

function RiSelectField({ label, value, options, onChange, disabled }: { label: string; value: string; options: [string, string][]; onChange: (v: string) => void; disabled: boolean }): JSX.Element {
  return (
    <div className="posfield">
      <label className="posfield__label">{label}</label>
      <select className="posfield__select" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );
}

function RiStringList({ label, values, onChange, disabled, placeholder }: { label: string; values: string[]; onChange: (v: string[]) => void; disabled: boolean; placeholder?: string }): JSX.Element {
  return (
    <div className="posfield">
      <label className="posfield__label">{label}</label>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {values.map((v, i) => (
          <div key={i} className="posrow" style={{ gap: 6 }}>
            <WorkbookInput className="posfield__input" style={{ flex: 1 }} value={v} placeholder={placeholder} disabled={disabled} onChange={(e) => onChange(values.map((y, j) => (j === i ? e.target.value : y)))} />
            {!disabled && <button type="button" className="posnav__btn posnav__btn--sm" onClick={() => onChange([...values.slice(0, i), ...values.slice(i + 1)])}>Remove</button>}
          </div>
        ))}
        {!disabled && <button type="button" className="posnav__btn posnav__btn--sm" style={{ alignSelf: "flex-start" }} onClick={() => onChange([...values, ""])}><RIIcon.Plus /> Add</button>}
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
      <div className="essec">Standard requirements</div>
      <div className="posdrawer__srs">{srs.map((s) => <span key={s.sr} className="poschip posmono">{s.sr}</span>)}</div>
    </div>
  );
}

const APP_TYPE_OPTIONS: [string, string][] = [
  ["FIXED_RISK_TARGET", "Fixed risk target"],
  ["BASELINE_RISK", "Baseline risk"],
];

const CRITERIA_SOURCE_OPTIONS: [string, string][] = [
  ["TABLE_1_9_1", "Table 1.9-1"],
  ["TABLE_1_9_2", "Table 1.9-2"],
  ["ALTERNATE", "Justified alternate"],
];

const BASIS_OPTIONS: [string, string][] = [
  ["STANDARD_DEFAULT", "Standard default"],
  ["JUSTIFIED_ALTERNATIVE", "Justified alternative"],
];

const METRIC_OPTIONS: [string, string][] = [
  ["INDIVIDUAL_EARLY_FATALITY_RISK", "Individual early fatality risk"],
  ["INDIVIDUAL_LATENT_CANCER_FATALITY_RISK", "Individual latent cancer fatality risk"],
  ["POPULATION_DOSE", "Population dose"],
  ["LAND_CONTAMINATION_AREA", "Land contamination area"],
  ["ECONOMIC_COST", "Economic cost"],
  ["CUSTOM", "Custom"],
];

const CALC_LEVEL_OPTIONS: [string, string][] = [
  ["MEAN", "Mean"],
  ["POINT_ESTIMATE", "Point estimate"],
];

const USED_OPTIONS: [string, string][] = [
  ["yes", "Used"],
  ["no", "Not used"],
];

const CONFIRMED_OPTIONS: [string, string][] = [
  ["yes", "Confirmed"],
  ["no", "Not confirmed"],
];

const COMPLIANCE_OPTIONS: [string, string][] = [
  ["COMPLIANT", "Compliant"],
  ["NON_COMPLIANT", "Not compliant"],
  ["INDETERMINATE", "Indeterminate"],
];

const CRITERIA_TYPE_OPTIONS: [string, string][] = [
  ["QHO", "Quantitative health objective"],
  ["SAFETY_GOAL", "Safety goal"],
  ["DESIGN_OBJECTIVE", "Design objective"],
  ["OTHER", "Other"],
];

const IMPORTANCE_OPTIONS: [string, string][] = [
  ["HIGH", "High"],
  ["MEDIUM", "Medium"],
  ["LOW", "Low"],
];

const ELEMENT_OPTIONS: [string, string][] = [
  ["plant-operating-states-analysis", "POS · Plant Operating States"],
  ["initiating-event-analysis", "IE · Initiating Events"],
  ["event-sequence-analysis", "ES · Event Sequence Analysis"],
  ["success-criteria-development", "SC · Success Criteria"],
  ["systems-analysis", "SY · Systems Analysis"],
  ["human-reliability-analysis", "HR · Human Reliability"],
  ["data-analysis", "DA · Data Analysis"],
  ["event-sequence-quantification", "ESQ · Event Sequence Quantification"],
  ["mechanistic-source-term-analysis", "MS · Mechanistic Source Term"],
  ["consequence-analysis", "RC · Radiological Consequence"],
];

const CONTRIBUTOR_BUCKET_OPTIONS: [string, string][] = [
  ["significantEventSequenceFamilies", "Event sequence family"],
  ["significantEventSequences", "Event sequence"],
  ["significantInitiatingEvents", "Initiating event"],
  ["significantReleaseCategories", "Release category"],
  ["significantSystems", "System"],
  ["significantComponents", "Component"],
  ["significantBasicEvents", "Basic event"],
  ["significantHumanFailureEvents", "Human failure event"],
  ["significantPlantOperatingStates", "Plant operating state"],
  ["significantHazardGroups", "Hazard group"],
  ["significantRadioactiveSources", "Radioactive source"],
];

const SCREENED_ITEM_TYPE_OPTIONS: [string, string][] = [
  ["HAZARD_GROUP", "Hazard group"],
  ["HAZARD_EVENT", "Hazard event"],
  ["PLANT_OPERATING_STATE", "Plant operating state"],
  ["INITIATING_EVENT", "Initiating event"],
  ["EVENT_SEQUENCE", "Event sequence"],
  ["BASIC_EVENT", "Basic event"],
];

const ELEMENT_CODE_OPTIONS: [string, string][] = [
  ["POS", "POS"],
  ["IE", "IE"],
  ["ES", "ES"],
  ["SC", "SC"],
  ["SY", "SY"],
  ["HR", "HR"],
  ["DA", "DA"],
  ["ESQ", "ESQ"],
  ["MS", "MS"],
  ["RC", "RC"],
];

const CHAR_LEVEL_OPTIONS: [string, string][] = [
  ["PROPAGATED_RISK_SIGNIFICANT", "Propagated, risk-significant sources"],
  ["CHARACTERIZED", "Characterized range"],
];

const EVAL_SCOPE_OPTIONS: [string, string][] = [
  ["COMBINATION", "Combination"],
  ["INDIVIDUAL", "Individual"],
];

const EVAL_TYPE_OPTIONS: [string, string][] = [
  ["QUANTITATIVE", "Quantitative"],
  ["QUALITATIVE", "Qualitative"],
];

const VERIFIED_OPTIONS: [string, string][] = [
  ["yes", "Verified"],
  ["no", "Not verified"],
];

const RECORDED_OPTIONS: [string, string][] = [
  ["yes", "Recorded"],
  ["no", "Not recorded"],
];

const CONSIDERED_OPTIONS: [string, string][] = [
  ["yes", "Considered"],
  ["no", "Not considered"],
];

const PERFORMED_OPTIONS: [string, string][] = [
  ["yes", "Performed"],
  ["no", "Not performed"],
];

const FOUND_OPTIONS: [string, string][] = [
  ["yes", "Artifact found"],
  ["no", "No artifact"],
];

function labelOf(options: [string, string][], value: string): string {
  return options.find(([v]) => v === value)?.[1] ?? value;
}

const THRESHOLD_LEVELS: { key: "eventSequence" | "eventSequenceFamily" | "system" | "component" | "basicEvent" | "humanFailureEvent"; label: string }[] = [
  { key: "eventSequence", label: "Event sequence" },
  { key: "eventSequenceFamily", label: "Event sequence family" },
  { key: "system", label: "Systems" },
  { key: "component", label: "Components" },
  { key: "basicEvent", label: "Basic events" },
  { key: "humanFailureEvent", label: "Human failure events" },
];

export {
  DrawerHead,
  RiTextField,
  RiAreaField,
  RiNumberField,
  RiSelectField,
  RiStringList,
  RemoveBtn,
  SrChips,
  APP_TYPE_OPTIONS,
  CRITERIA_SOURCE_OPTIONS,
  BASIS_OPTIONS,
  METRIC_OPTIONS,
  CRITERIA_TYPE_OPTIONS,
  CALC_LEVEL_OPTIONS,
  USED_OPTIONS,
  CONFIRMED_OPTIONS,
  COMPLIANCE_OPTIONS,
  IMPORTANCE_OPTIONS,
  ELEMENT_OPTIONS,
  CONTRIBUTOR_BUCKET_OPTIONS,
  SCREENED_ITEM_TYPE_OPTIONS,
  ELEMENT_CODE_OPTIONS,
  CHAR_LEVEL_OPTIONS,
  EVAL_SCOPE_OPTIONS,
  EVAL_TYPE_OPTIONS,
  PERFORMED_OPTIONS,
  FOUND_OPTIONS,
  RECORDED_OPTIONS,
  CONSIDERED_OPTIONS,
  VERIFIED_OPTIONS,
  THRESHOLD_LEVELS,
  labelOf,
};
