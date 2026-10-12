import { JSX, useMemo } from "react";
import { holdsEstimate, type DaOutage, type DataAnalysis, type DataAnalysisParameter } from "interfaces-mef-types/da/data-analysis";
import { useUncertaintyVersion } from "../newly-developed-methods/shared/useUncertainty";
import { ASSUMPTION_COLUMNS, assumptionRows, handoffName, joinedOrNone, recordLabel, TechnicalElementHandoff, type HandoffRow, type HandoffSectionView } from "../workbooks/workbookHandoff";
import { useDaWorkbook } from "./daWorkbookContext";
import { ccfLabelOf, ccfVectorLabel, factorsText } from "./daCcf";
import { coincidentParameters } from "./daUnavailability";
import { modelSpecOf } from "./daSelectors";
import { PARAMETER_TYPE_LABELS, SENSITIVITY_KIND_LABELS } from "./daViewData";
import { estimateText, statText, systemOptions } from "./daScreens";

function estimateCell(parameter: DataAnalysisParameter): string {
  if (holdsEstimate(parameter.quantificationModel)) return parameter.estimate === undefined ? "Not estimated" : estimateText(parameter.estimate);
  return parameter.value === undefined ? "Not estimated" : statText(parameter.value);
}

function amount(value: number): number {
  return Number(value.toPrecision(4));
}

function outageRows(da: DataAnalysis): HandoffRow[] {
  const stateNames = new Map((da.dataNeeds?.states ?? []).map((state) => [state.id, state.name]));
  const byState = new Map<string, DaOutage[]>();
  for (const outage of da.outages ?? []) {
    const key = outage.stateId ?? "";
    byState.set(key, [...(byState.get(key) ?? []), outage]);
  }
  return [...byState.entries()].map(([stateId, outages]) => ({
    id: `state-${stateId}`,
    cells: [
      stateId.length === 0 ? "No state" : handoffName(stateId, stateNames.get(stateId) ?? ""),
      outages.map((outage) => recordLabel(outage.id)).join(", "),
      amount(outages.reduce((total, outage) => total + outage.hours * outage.perYear, 0)),
      amount(outages.reduce((total, outage) => total + outage.perYear, 0)),
    ],
  }));
}

function daHandoffSections(da: DataAnalysis): HandoffSectionView[] {
  const systems = new Map(systemOptions(da).map((option) => [option.id, option.name]));
  const sourceNames = new Map((da.sources ?? []).map((source) => [source.id, source.name]));
  const label = ccfLabelOf(da);
  return [
    {
      key: "parameters",
      columns: [{ label: "Parameter" }, { label: "Type" }, { label: "Model" }, { label: "Estimate" }],
      rows: da.parameters.map((parameter) => ({
        id: parameter.uuid,
        cells: [handoffName(parameter.uuid, parameter.name), PARAMETER_TYPE_LABELS[parameter.parameterType], modelSpecOf(parameter.quantificationModel)?.label ?? "Not set", estimateCell(parameter)],
      })),
    },
    {
      key: "failure-modes",
      columns: [{ label: "Kind" }, { label: "Item" }, { label: "Detail" }],
      rows: [
        ...(da.failureModes ?? []).map((mode) => ({ id: `mode-${mode.uuid}`, cells: ["Failure mode", handoffName(mode.uuid, mode.name), mode.category.length > 0 ? mode.category : "None"] })),
        ...da.componentBoundaries.map((boundary) => ({
          id: `boundary-${boundary.uuid}`,
          cells: ["Component boundary", handoffName(boundary.uuid, boundary.name), `${systems.get(boundary.systemId) ?? recordLabel(boundary.systemId)} · ${joinedOrNone(boundary.includedItems)}`],
        })),
      ],
    },
    {
      key: "common-cause",
      columns: [{ label: "Kind" }, { label: "Item" }, { label: "Detail" }],
      rows: [
        ...(da.ccfParameterEstimations ?? []).map((estimate) => ({
          id: `estimate-${estimate.uuid}`,
          cells: ["Estimate", handoffName(estimate.uuid, estimate.name ?? estimate.ccfGroupReference), estimate.factors === undefined ? "Not estimated" : factorsText(estimate.factors, label)],
        })),
        ...(da.ccfVectors ?? []).map((vector) => ({ id: `vector-${vector.id}`, cells: ["Vector", ccfVectorLabel(vector), sourceNames.get(vector.sourceId) ?? recordLabel(vector.sourceId)] })),
        ...(da.ccfFactors ?? []).map((factor) => ({ id: `factor-${factor.id}`, cells: ["Factor", `${sourceNames.get(factor.sourceId) ?? recordLabel(factor.sourceId)} ${factor.rowId}`, estimateText(factor.expression)] })),
      ],
    },
    {
      key: "maintenance",
      columns: [{ label: "Parameter" }, { label: "Equipment" }, { label: "Scope" }, { label: "Estimate" }],
      rows: coincidentParameters(da).map((parameter) => ({
        id: parameter.uuid,
        cells: [handoffName(parameter.uuid, parameter.name), joinedOrNone(parameter.maintenance?.equipment ?? []), parameter.maintenance?.scope === "INTERSYSTEM" ? "Across systems" : "Within one system", estimateCell(parameter)],
      })),
    },
    {
      key: "outages",
      columns: [{ label: "State" }, { label: "Outages" }, { label: "Hours a year", numeric: true }, { label: "Entries a year", numeric: true }],
      rows: outageRows(da),
    },
    {
      key: "uncertainty",
      columns: ASSUMPTION_COLUMNS,
      rows: [
        ...(da.uncertaintyRegister ?? []).map((source) => ({ id: `register-${source.id}`, cells: ["Register entry", `${source.id} · ${source.source}`, source.impact] })),
        ...(da.sensitivityCases ?? []).map((item) => ({ id: `case-${item.id}`, cells: ["Sensitivity case", `${item.id} · ${item.name}`, SENSITIVITY_KIND_LABELS[item.kind]] })),
        ...assumptionRows(undefined, da.preOperationalAssumptions),
      ],
    },
  ];
}

function HandoffScreen(): JSX.Element {
  const { da } = useDaWorkbook();
  useUncertaintyVersion();
  const sections = useMemo(() => daHandoffSections(da), [da]);
  return (
    <div className="da-step">
      <TechnicalElementHandoff element="DA" sections={sections} />
    </div>
  );
}

export { HandoffScreen };
