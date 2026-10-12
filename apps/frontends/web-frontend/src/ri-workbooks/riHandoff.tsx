import { type JSX, useEffect, useRef } from "react";
import { type RiskIntegration } from "interfaces-mef-types/ri/risk-integration";
import { ImportanceLevel } from "interfaces-mef-types/core/shared-patterns";
import { rcMetricUnit } from "interfaces-shared-types/rc-workbooks/metrics";
import { WorkbookTextarea } from "../workbooks/commitOnDeactivateFields";
import { HANDOFF_ELEMENT_NAMES } from "interfaces-mef-types/technical-element-handoff";
import { TechnicalElementHandoff, handoffName, recordLabel, type HandoffColumn, type HandoffSectionView, type HandoffSubsectionView } from "../workbooks/workbookHandoff";
import { useRiWorkbook } from "./riWorkbookContext";
import { MEASURE_QUANTITY_LABELS, MEASURE_ROLE_SPECS, RELATIVE_CRITERIA_SPECS } from "./riViewData";
import {
  criteriaSetOf,
  handoffChangeCount,
  handoffEntryOf,
  handoffMessageOf,
  handoffTargets,
  withHandoffEntry,
  withHandoffMessage,
  withHandoffSent,
  withHandoffsUpdated,
  type RiHandoffEntry,
  type RiHandoffGroup,
  type RiHandoffReceiver,
  type RiHandoffTarget,
} from "./riSelectors";
import { contributorKindText, measureReceptorText, measureWindowText } from "./riScreens";

type RiOtherFeedback = NonNullable<NonNullable<RiskIntegration["riskIntegrationFeedbackDispatch"]>["additionalElementFeedback"]>[number];

type RiOtherCode = RiOtherFeedback["elementCode"];

interface FeedbackTableSpec {
  group: RiHandoffGroup;
  key: string;
  name: string;
  labelHead: string;
  sharesHead?: string;
  detailHead: string;
  labelOf: (target: RiHandoffTarget) => string;
}

const LEVEL_TEXT: Record<ImportanceLevel, string> = {
  [ImportanceLevel.HIGH]: "High",
  [ImportanceLevel.MEDIUM]: "Medium",
  [ImportanceLevel.LOW]: "Low",
};

const LEVEL_OPTIONS: ImportanceLevel[] = [ImportanceLevel.HIGH, ImportanceLevel.MEDIUM, ImportanceLevel.LOW];

const OTHER_ELEMENTS: readonly RiOtherCode[] = ["POS", "IE", "ES", "SC", "SY", "HR", "DA"];

const FEEDBACK_TABLES: Record<RiHandoffReceiver, FeedbackTableSpec[]> = {
  ESQ: [
    { group: "family", key: "families", name: "Families", labelHead: "Name", sharesHead: "Share", detailHead: "Recommendation", labelOf: (target) => target.label },
    { group: "contributor", key: "contributors", name: "Contributors", labelHead: "Type", sharesHead: "Share", detailHead: "Recommendation", labelOf: (target) => contributorKindText(target.label) },
  ],
  MS: [
    { group: "category", key: "release-categories", name: "Release categories", labelHead: "Families", sharesHead: "Share", detailHead: "Recommendation", labelOf: (target) => target.label },
    { group: "sourceTerm", key: "source-terms", name: "Source terms", labelHead: "Release category", detailHead: "Key uncertainties", labelOf: (target) => target.label },
  ],
  RC: [
    { group: "measure", key: "measures", name: "Measures", labelHead: "Total", sharesHead: "Largest category", detailHead: "Recommendation", labelOf: (target) => target.label },
  ],
};

function criterionValueText(value: number, unit: string): string {
  if (unit === "%") return `${String(value)}%`;
  return unit.length === 0 ? String(value) : `${String(value)} ${unit}`;
}

function lines(text: string): string[] {
  return text.split("\n").map((line) => line.trim()).filter((line) => line.length > 0);
}

function withEntryEdit(ri: RiskIntegration, target: RiHandoffTarget, next: RiHandoffEntry): RiskIntegration {
  const current = handoffEntryOf(ri, target.group, target.key) ?? { riskSignificance: target.derived, insights: [target.insight] };
  const edited = withHandoffEntry(ri, target.group, target.key, { ...current, riskSignificance: current.riskSignificance ?? target.derived, ...next });
  return withHandoffSent(edited, new Date().toISOString());
}

function ReasonCell({ target }: { target: RiHandoffTarget }): JSX.Element {
  const { ri, editable, mutateRi } = useRiWorkbook();
  return (
    <WorkbookTextarea
      className="posfield__textarea"
      aria-label={`Reason for the level of ${target.key}`}
      rows={1}
      fitContent
      value={handoffEntryOf(ri, target.group, target.key)?.significanceReason ?? ""}
      disabled={!editable}
      onChange={(event) => {
        if (!editable) return;
        const reason = event.target.value;
        mutateRi((draft) => withEntryEdit(draft, target, { significanceReason: reason }));
      }}
    />
  );
}

function otherFeedbackOf(ri: RiskIntegration, code: RiOtherCode): RiOtherFeedback {
  return ri.riskIntegrationFeedbackDispatch?.additionalElementFeedback?.find((entry) => entry.elementCode === code) ?? { elementCode: code };
}

function emptyOther(entry: RiOtherFeedback): boolean {
  return entry.riskSignificance === undefined
    && (entry.significanceReason ?? "").trim().length === 0
    && (entry.insights ?? []).length === 0
    && (entry.recommendations ?? []).length === 0
    && (entry.generalFeedback ?? "").trim().length === 0;
}

function withOtherFeedback(ri: RiskIntegration, code: RiOtherCode, update: (entry: RiOtherFeedback) => RiOtherFeedback): RiskIntegration {
  const dispatch = ri.riskIntegrationFeedbackDispatch ?? {};
  const next = update(otherFeedbackOf(ri, code));
  const kept = (dispatch.additionalElementFeedback ?? []).filter((entry) => entry.elementCode !== code);
  const list = (emptyOther(next) ? kept : [...kept, next]).sort((left, right) => OTHER_ELEMENTS.indexOf(left.elementCode) - OTHER_ELEMENTS.indexOf(right.elementCode));
  return withHandoffSent({ ...ri, riskIntegrationFeedbackDispatch: { ...dispatch, additionalElementFeedback: list } }, new Date().toISOString());
}

function OtherLevelCell({ code }: { code: RiOtherCode }): JSX.Element {
  const { ri, editable, mutateRi } = useRiWorkbook();
  return (
    <select
      className="posfield__select"
      aria-label={`Level sent to ${code}`}
      value={otherFeedbackOf(ri, code).riskSignificance ?? ""}
      disabled={!editable}
      onChange={(event) => {
        if (!editable) return;
        const level = LEVEL_OPTIONS.find((option) => option === event.target.value);
        mutateRi((draft) => withOtherFeedback(draft, code, (entry) => {
          const { riskSignificance: _old, ...rest } = entry;
          return level === undefined ? rest : { ...rest, riskSignificance: level };
        }));
      }}
    >
      <option value="">Not sent</option>
      {LEVEL_OPTIONS.map((option) => <option key={option} value={option}>{LEVEL_TEXT[option]}</option>)}
    </select>
  );
}

function OtherTextCell({ code, field, label }: { code: RiOtherCode; field: "significanceReason" | "recommendations" | "generalFeedback"; label: string }): JSX.Element {
  const { ri, editable, mutateRi } = useRiWorkbook();
  const entry = otherFeedbackOf(ri, code);
  const value = field === "recommendations" ? (entry.recommendations ?? []).join("\n") : entry[field] ?? "";
  return (
    <WorkbookTextarea
      className="posfield__textarea"
      aria-label={`${label} for ${code}`}
      rows={1}
      fitContent
      value={value}
      disabled={!editable}
      onChange={(event) => {
        if (!editable) return;
        const text = event.target.value;
        mutateRi((draft) => withOtherFeedback(draft, code, (current) => (field === "recommendations" ? { ...current, recommendations: lines(text) } : field === "significanceReason" ? { ...current, significanceReason: text } : { ...current, generalFeedback: text })));
      }}
    />
  );
}

function LevelCell({ target }: { target: RiHandoffTarget }): JSX.Element {
  const { ri, editable, mutateRi } = useRiWorkbook();
  const level = handoffEntryOf(ri, target.group, target.key)?.riskSignificance ?? target.derived;
  return (
    <select
      className="posfield__select"
      aria-label={`Level sent for ${target.key}`}
      value={level}
      disabled={!editable}
      onChange={(event) => {
        const next = LEVEL_OPTIONS.find((option) => option === event.target.value);
        if (editable && next !== undefined) mutateRi((draft) => withEntryEdit(draft, target, { riskSignificance: next }));
      }}
    >
      {LEVEL_OPTIONS.map((option) => <option key={option} value={option}>{LEVEL_TEXT[option]}</option>)}
    </select>
  );
}

function DetailCell({ target, label }: { target: RiHandoffTarget; label: string }): JSX.Element {
  const { ri, editable, mutateRi } = useRiWorkbook();
  const entry = handoffEntryOf(ri, target.group, target.key);
  const values = target.group === "sourceTerm" ? entry?.keyUncertainties ?? [] : entry?.recommendations ?? [];
  return (
    <WorkbookTextarea
      className="posfield__textarea"
      aria-label={`${label} for ${target.key}`}
      rows={1}
      fitContent
      value={values.join("\n")}
      disabled={!editable}
      onChange={(event) => {
        if (!editable) return;
        const list = lines(event.target.value);
        mutateRi((draft) => withEntryEdit(draft, target, target.group === "sourceTerm" ? { keyUncertainties: list } : { recommendations: list }));
      }}
    />
  );
}

function MessageCell({ receiver }: { receiver: RiHandoffReceiver }): JSX.Element {
  const { ri, editable, mutateRi } = useRiWorkbook();
  return (
    <WorkbookTextarea
      className="posfield__textarea"
      aria-label={`Message to ${receiver}`}
      rows={1}
      fitContent
      value={handoffMessageOf(ri, receiver)}
      disabled={!editable}
      onChange={(event) => {
        if (!editable) return;
        const text = event.target.value;
        mutateRi((draft) => withHandoffSent(withHandoffMessage(draft, receiver, text), new Date().toISOString()));
      }}
    />
  );
}

function feedbackSubsections(ri: RiskIntegration, receiver: RiHandoffReceiver): HandoffSubsectionView[] {
  const targets = handoffTargets(ri);
  return [
    ...FEEDBACK_TABLES[receiver].map((spec) => {
      const columns: HandoffColumn[] = [
        { label: "Item" },
        { label: spec.labelHead },
        ...(spec.sharesHead === undefined ? [] : [{ label: spec.sharesHead }]),
        { label: "Result" },
        { label: "Sent as" },
        { label: "Reason" },
        { label: spec.detailHead },
      ];
      return {
        key: spec.key,
        name: spec.name,
        columns,
        rows: targets.filter((target) => target.group === spec.group).map((target) => ({
          id: target.key,
          cells: [
            recordLabel(target.key, spec.group === "family" ? target.label : undefined),
            spec.labelOf(target),
            ...(spec.sharesHead === undefined ? [] : [target.shares]),
            LEVEL_TEXT[target.derived],
            <LevelCell key="level" target={target} />,
            <ReasonCell key="reason" target={target} />,
            <DetailCell key="detail" target={target} label={spec.detailHead} />,
          ],
        })),
      };
    }),
    {
      key: "message",
      name: "Message",
      columns: [{ label: "To" }, { label: "Message" }],
      rows: [{ id: receiver, cells: [receiver, <MessageCell key="message" receiver={receiver} />] }],
    },
  ];
}

function riHandoffSections(ri: RiskIntegration): HandoffSectionView[] {
  const relative = criteriaSetOf(ri).relative;
  return [
    {
      key: "criteria",
      columns: [{ label: "Criterion" }, { label: "Value", numeric: true }, { label: "Justification" }],
      rows: RELATIVE_CRITERIA_SPECS.map((spec) => ({
        id: spec.key,
        cells: [spec.label, criterionValueText(relative[spec.key].value, spec.unit), relative[spec.key].justification ?? "None"],
      })),
    },
    {
      key: "consequence-measures",
      columns: [{ label: "Measure" }, { label: "Used for" }, { label: "Quantity" }, { label: "Receptors" }, { label: "Exposure window" }, { label: "Unit" }],
      rows: ri.scopeDefinition.consequenceMeasures.map((measure, index) => ({
        id: `measure-${String(index)}`,
        cells: [
          measure.name.trim().length > 0 ? measure.name : "Unnamed measure",
          MEASURE_ROLE_SPECS.find((role) => role.id === measure.role)?.short ?? "Reported only",
          measure.quantity === undefined ? "Not set" : MEASURE_QUANTITY_LABELS[measure.quantity],
          measureReceptorText(measure.receptor),
          measureWindowText(measure.window),
          measure.quantity === undefined ? "Not set" : rcMetricUnit({ quantity: measure.quantity, customUnit: measure.customUnit }),
        ],
      })),
    },
    { key: "feedback-to-esq", subsections: feedbackSubsections(ri, "ESQ") },
    { key: "feedback-to-ms", subsections: feedbackSubsections(ri, "MS") },
    { key: "feedback-to-rc", subsections: feedbackSubsections(ri, "RC") },
    {
      key: "feedback-to-other-elements",
      columns: [{ label: "Element" }, { label: "Level" }, { label: "Reason" }, { label: "Recommendations" }, { label: "Message" }],
      rows: OTHER_ELEMENTS.map((code) => ({
        id: code,
        cells: [
          handoffName(code, HANDOFF_ELEMENT_NAMES[code === "HR" ? "HRA" : code]),
          <OtherLevelCell key="level" code={code} />,
          <OtherTextCell key="reason" code={code} field="significanceReason" label="Reason" />,
          <OtherTextCell key="recommendations" code={code} field="recommendations" label="Recommendations" />,
          <OtherTextCell key="message" code={code} field="generalFeedback" label="Message" />,
        ],
      })),
    },
  ];
}

function RiHandoffScreen(): JSX.Element {
  const { ri, editable, mutateRi } = useRiWorkbook();
  const syncing = useRef(false);
  const changes = ri.inputs === undefined ? 0 : handoffChangeCount(ri);

  useEffect(() => {
    if (!editable || changes === 0) {
      syncing.current = false;
      return;
    }
    if (syncing.current) return;
    syncing.current = true;
    mutateRi((draft) => withHandoffSent(withHandoffsUpdated(draft), new Date().toISOString()));
  }, [editable, changes, mutateRi]);

  return (
    <div className="ri-step">
      <TechnicalElementHandoff element="RI" sections={riHandoffSections(ri)} />
    </div>
  );
}

export { RiHandoffScreen };
