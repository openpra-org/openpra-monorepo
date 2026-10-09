import type { SuccessCriteriaDevelopment } from "interfaces-mef-types/sc/success-criteria-development";
import type { WorkbookParameterReference } from "interfaces-mef-types/modeling/references";
import {
  parameterReferenceKey,
  type UncertainExpression,
  type UncertainParameter,
} from "interfaces-mef-types/core/uncertainty";
import type { ParameterOption } from "../newly-developed-methods/shared/uncertainEditor";

type ScMissionTimes = Pick<SuccessCriteriaDevelopment, "missionTimes" | "componentMissionTimes">;

interface ScMissionTimeEntry {
  reference: WorkbookParameterReference;
  label: string;
  expression: UncertainExpression;
}

function scMissionTimeReference(workbookId: string, entityId: string): WorkbookParameterReference {
  return { referenceType: "WORKBOOK_PARAMETER", workbookId, entityId };
}

function scMissionTimeEntries(workbookId: string, sc: ScMissionTimes): ScMissionTimeEntry[] {
  const sequences = sc.missionTimes.map((missionTime) => ({
    reference: scMissionTimeReference(workbookId, missionTime.uuid),
    label: `${missionTime.uuid} · sequence ${missionTime.eventSequenceReference}`,
    expression: missionTime.missionTime,
  }));
  const components = (sc.componentMissionTimes ?? []).map((missionTime) => ({
    reference: scMissionTimeReference(workbookId, missionTime.uuid),
    label: `${missionTime.uuid} · ${missionTime.componentId}`,
    expression: missionTime.missionTime,
  }));
  return [...sequences, ...components];
}

function scMissionTimeOptions(workbookId: string, sc: ScMissionTimes): ParameterOption[] {
  return scMissionTimeEntries(workbookId, sc).map((entry) => ({ reference: entry.reference, label: entry.label, unit: "HOURS" }));
}

function scMissionTimeTable(workbookId: string, sc: ScMissionTimes): Map<string, UncertainParameter> {
  return new Map(scMissionTimeEntries(workbookId, sc).map((entry) => [
    parameterReferenceKey(entry.reference),
    { reference: entry.reference, expression: entry.expression },
  ]));
}

export {
  scMissionTimeEntries,
  scMissionTimeOptions,
  scMissionTimeReference,
  scMissionTimeTable,
  type ScMissionTimeEntry,
  type ScMissionTimes,
};
