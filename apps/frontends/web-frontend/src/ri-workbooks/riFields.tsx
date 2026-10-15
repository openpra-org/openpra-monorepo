import { WorkbookSectionHeading } from "../workbooks/workbookSectionHeading";
import { JSX } from "react";
import { RIIcon } from "./riIcons";

function DrawerHead({ cap, title, onClose }: { cap: string; title: string; onClose: () => void }): JSX.Element {
  return (
    <div className="modal__head">
      <div>
        <div className="posdrawer__cap">{cap}</div>
        <WorkbookSectionHeading title={title} level={2} className="modal__title" />
      </div>
      <button type="button" className="modal__close" onClick={onClose} aria-label="Close"><RIIcon.Close /></button>
    </div>
  );
}

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

const CONSIDERED_OPTIONS: [string, string][] = [
  ["yes", "Considered"],
  ["no", "Not considered"],
];

function labelOf(options: [string, string][], value: string): string {
  return options.find(([v]) => v === value)?.[1] ?? value;
}

export {
  DrawerHead,
  ELEMENT_OPTIONS,
  SCREENED_ITEM_TYPE_OPTIONS,
  ELEMENT_CODE_OPTIONS,
  CHAR_LEVEL_OPTIONS,
  EVAL_SCOPE_OPTIONS,
  EVAL_TYPE_OPTIONS,
  CONSIDERED_OPTIONS,
  labelOf,
};
