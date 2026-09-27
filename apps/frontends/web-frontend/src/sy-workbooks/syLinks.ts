import { type Workbook } from "interfaces-shared-types";
import type { EventSequenceAnalysis } from "interfaces-mef-types/es/event-sequence-analysis";
import type { SuccessCriteriaDevelopment } from "interfaces-mef-types/sc/success-criteria-development";
import type { PlantOperatingStatesAnalysis } from "interfaces-mef-types/pos/plant-operating-state-analysis";
import { listWorkbooks } from "../workbooks/workbookApi";
import { type DaWorkbookResponse } from "../da-workbooks/daWorkbookApi";
import { type HrWorkbookResponse } from "../hr-workbooks/hrWorkbookApi";
import type {
  SyControlledCcfEstimateOption,
  SyControlledCoincidentMaintenanceOption,
  SyControlledFailureModeOption,
  SyControlledHumanFailureOption,
  SyControlledParameterOption,
  SyLinkCode,
  SyLinkedInputs,
} from "./syWorkbookContext";

const SY_LINK_CODES: SyLinkCode[] = ["ES", "SC", "POS", "DA", "HRA"];

const SUPPORTED_PARAMETER_TYPES = new Set(["FREQUENCY", "PROBABILITY", "UNAVAILABILITY", "HUMAN_ERROR_PROBABILITY"]);

type LinkedEntry = Pick<Workbook, "id" | "name">;

interface DaSource {
  entry: LinkedEntry;
  workbook: Pick<DaWorkbookResponse, "mef">;
}

interface HrSource {
  entry: LinkedEntry;
  workbook: Pick<HrWorkbookResponse, "mef">;
}

async function listSyLinkOptions(projectId: string): Promise<Record<SyLinkCode, Workbook[]>> {
  const lists = await Promise.all(SY_LINK_CODES.map(async (code) => {
    try {
      return (await listWorkbooks(projectId, code)).workbooks;
    } catch {
      return [];
    }
  }));
  return { ES: lists[0] ?? [], SC: lists[1] ?? [], POS: lists[2] ?? [], DA: lists[3] ?? [], HRA: lists[4] ?? [] };
}

function workbookName(options: readonly Workbook[], id: string | undefined): string {
  return options.find((option) => option.id === id)?.name ?? "";
}

function esInitiatingEvents(es: EventSequenceAnalysis | undefined): { id: string; name: string }[] {
  if (es === undefined) return [];
  const names = new Map<string, string>();
  (es.eventTrees ?? []).forEach((tree) => {
    if (!names.has(tree.initiatingEventId)) names.set(tree.initiatingEventId, tree.name);
  });
  es.eventSequences.forEach((sequence) => {
    if (!names.has(sequence.initiatingEventId)) names.set(sequence.initiatingEventId, sequence.initiatingEventId);
  });
  const ordered = [...es.scopeDefinition.initiatingEventIds, ...names.keys()];
  return [...new Set(ordered)].map((id) => ({ id, name: names.get(id) ?? id }));
}

function buildLinkedInputs(
  options: Record<SyLinkCode, Workbook[]>,
  ids: Partial<Record<SyLinkCode, string>>,
  es: EventSequenceAnalysis | undefined,
  sc: SuccessCriteriaDevelopment | undefined,
  pos: PlantOperatingStatesAnalysis | undefined,
): SyLinkedInputs | null {
  if (es === undefined && sc === undefined && pos === undefined) return null;
  return {
    esName: workbookName(options.ES, ids.ES),
    scName: workbookName(options.SC, ids.SC),
    posName: workbookName(options.POS, ids.POS),
    esSafetyFunctions: (es?.keySafetyFunctions ?? []).map((sf) => ({
      id: sf.id,
      name: sf.name,
      supportingSystems: sf.supportingSystems,
    })),
    scSystems: (sc?.systemSuccessCriteria ?? []).map((criterion) => ({
      id: criterion.uuid,
      systemId: criterion.systemId,
      name: criterion.description,
      capacities: criterion.requiredCapacities.map((capacity) => `${capacity.parameter}: ${capacity.value}`).join(" · "),
      supports: (criterion.systemDependencies ?? []).map((dependency) => ({ systemId: dependency.dependentSystemId, nature: dependency.dependencyNature })),
    })),
    scMissionTimes: (sc?.missionTimes ?? []).map((missionTime) => ({
      id: missionTime.uuid,
      hours: missionTime.missionTimeHours,
      sequence: missionTime.eventSequenceReference,
      basis: missionTime.basis,
    })),
    esInitiatingEvents: esInitiatingEvents(es),
    posStates: (pos?.plantOperatingStates ?? []).map((state) => ({
      id: state.uuid,
      name: state.name,
      mode: state.operatingMode,
      durationHours: state.meanDurationHours,
    })),
  };
}

function controlledParameterOptions(sources: readonly DaSource[]): SyControlledParameterOption[] {
  return sources.flatMap(({ entry, workbook }) => {
    const modes = new Map((workbook.mef.failureModes ?? []).map((mode) => [mode.uuid, mode.name]));
    return workbook.mef.parameters.flatMap((parameter): SyControlledParameterOption[] => {
    if (
      !SUPPORTED_PARAMETER_TYPES.has(parameter.parameterType) ||
      !Number.isFinite(parameter.value) ||
      parameter.value < 0 ||
      (parameter.parameterType !== "FREQUENCY" && parameter.value > 1)
    ) return [];
    return [{
      workbookId: entry.id,
      workbookName: entry.name,
      parameterId: parameter.uuid,
      parameterName: parameter.name,
      parameterType: parameter.parameterType as SyControlledParameterOption["parameterType"],
      value: parameter.value,
      uncertainty: parameter.uncertainty?.distribution,
      ...(parameter.failureModeRef !== undefined && modes.has(parameter.failureModeRef)
        ? { failureModeId: parameter.failureModeRef, failureModeName: modes.get(parameter.failureModeRef) }
        : {}),
    }];
    });
  }).sort((left, right) => [left.workbookName, left.parameterName].join(":").localeCompare([right.workbookName, right.parameterName].join(":")));
}

function controlledFailureModeOptions(sources: readonly DaSource[]): SyControlledFailureModeOption[] {
  return sources.flatMap(({ entry, workbook }) => (workbook.mef.failureModes ?? []).map((mode) => ({
    workbookId: entry.id,
    workbookName: entry.name,
    failureModeId: mode.uuid,
    name: mode.name,
  }))).sort((left, right) => [left.workbookName, left.name].join(":").localeCompare([right.workbookName, right.name].join(":")));
}

function controlledHumanFailureOptions(sources: readonly HrSource[]): SyControlledHumanFailureOption[] {
  return sources.flatMap(({ entry, workbook }) => {
    const events = new Map(workbook.mef.humanFailureEvents.map((event) => [event.uuid, event]));
    return workbook.mef.hepQuantifications.flatMap((quantification): SyControlledHumanFailureOption[] => {
      const event = events.get(quantification.hfeId);
      const value = quantification.meanHep ?? quantification.pointEstimateHep;
      if (event === undefined || value === undefined || !Number.isFinite(value) || value < 0 || value > 1) return [];
      return [{
        workbookId: entry.id,
        workbookName: entry.name,
        humanFailureEventId: event.uuid,
        humanFailureEventName: event.name,
        hfeTiming: event.hfeTiming,
        quantificationId: quantification.uuid,
        methodology: quantification.methodology,
        value,
        valueKind: quantification.meanHep === undefined ? "POINT_ESTIMATE" : "MEAN",
      }];
    });
  }).sort((left, right) => [left.workbookName, left.humanFailureEventName, left.methodology].join(":").localeCompare([right.workbookName, right.humanFailureEventName, right.methodology].join(":")));
}

function controlledCoincidentMaintenanceOptions(sources: readonly DaSource[]): SyControlledCoincidentMaintenanceOption[] {
  return sources.flatMap(({ entry, workbook }) => (workbook.mef.coincidentMaintenanceRecords ?? []).map((record) => ({
    workbookId: entry.id,
    workbookName: entry.name,
    recordId: record.uuid,
    description: record.plannedActivityDescription,
    equipment: record.redundantEquipmentIds,
    scope: record.scope,
    basis: record.basis,
    ...(record.unavailabilityValue === undefined ? {} : { value: record.unavailabilityValue }),
  }))).sort((left, right) => [left.workbookName, left.recordId].join(":").localeCompare([right.workbookName, right.recordId].join(":")));
}

function controlledCcfEstimateOptions(sources: readonly DaSource[]): SyControlledCcfEstimateOption[] {
  return sources.flatMap(({ entry, workbook }) => (workbook.mef.ccfParameterEstimations ?? []).flatMap((estimate): SyControlledCcfEstimateOption[] => {
    const modelType = estimate.modelType;
    if (modelType === "OTHER_EQUIVALENT") return [];
    const values = Object.values(estimate.parameters);
    if (values.length === 0 || values.some((value) => !Number.isFinite(value) || value < 0 || value > 1)) return [];
    const source = estimate.dataSources?.[0]?.source;
    return [{
      workbookId: entry.id,
      workbookName: entry.name,
      estimateId: estimate.uuid,
      groupReference: estimate.ccfGroupReference,
      modelType,
      parameters: { ...estimate.parameters },
      ...(source === undefined || source.trim().length === 0 ? {} : { source }),
      riskSignificant: estimate.isRiskSignificant === true,
    }];
  })).sort((left, right) => [left.workbookName, left.groupReference, left.estimateId].join(":").localeCompare([right.workbookName, right.groupReference, right.estimateId].join(":")));
}

export {
  SY_LINK_CODES,
  buildLinkedInputs,
  controlledCcfEstimateOptions,
  controlledCoincidentMaintenanceOptions,
  controlledFailureModeOptions,
  controlledHumanFailureOptions,
  controlledParameterOptions,
  listSyLinkOptions,
};
