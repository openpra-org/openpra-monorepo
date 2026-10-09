import { type Workbook } from "interfaces-shared-types";
import type { EventSequenceAnalysis } from "interfaces-mef-types/es/event-sequence-analysis";
import type { SuccessCriteriaDevelopment } from "interfaces-mef-types/sc/success-criteria-development";
import type { PlantOperatingStatesAnalysis } from "interfaces-mef-types/pos/plant-operating-state-analysis";
import { isComponentModel, type DataAnalysis, type ParameterType } from "interfaces-mef-types/da/data-analysis";
import { carriesUncertainExpression, type CommonCauseFailureGroup, type SystemBasicEvent, type SystemsAnalysis } from "interfaces-mef-types/sy/systems-analysis";
import { mapModelArguments, type UncertainExpression } from "interfaces-mef-types/core/uncertainty";
import { listWorkbooks } from "../workbooks/workbookApi";
import { type DaWorkbookResponse } from "../da-workbooks/daWorkbookApi";
import { type HrWorkbookResponse } from "../hr-workbooks/hrWorkbookApi";
import type {
  SyControlledCcfEstimateOption,
  SyControlledCoincidentMaintenanceOption,
  SyControlledComponentBoundaryOption,
  SyControlledFailureModeOption,
  SyControlledHumanFailureOption,
  SyControlledLegacyParameterOption,
  SyControlledParameterOption,
  SyLinkCode,
  SyLinkedInputs,
} from "./syWorkbookContext";
import { componentUnit } from "./syBasicEventValues";
import { scMissionTimeOptions, scMissionTimeTable } from "../sc-workbooks/scMissionTimeLinks";
import { type ScMissionTimeSource } from "../sc-workbooks/scMissionTimeSources";
import { type LinkRoot } from "../newly-developed-methods/shared/uncertaintyLinks";

const SY_LINK_CODES: SyLinkCode[] = ["ES", "SC", "POS", "DA", "HRA"];

const SUPPORTED_PARAMETER_TYPES = new Set(["FREQUENCY", "FAILURE_RATE", "PROBABILITY", "UNAVAILABILITY", "HUMAN_ERROR_PROBABILITY"]);

const RATE_UNITS: Partial<Record<ParameterType, "HOUR" | "YEAR">> = { FAILURE_RATE: "HOUR", FREQUENCY: "YEAR" };

const LINKABLE_PARAMETER_TYPES = new Set(["PROBABILITY", "UNAVAILABILITY", "HUMAN_ERROR_PROBABILITY"]);

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
  scReferenced: readonly ScMissionTimeSource[],
): SyLinkedInputs | null {
  if (es === undefined && sc === undefined && pos === undefined && scReferenced.length === 0) return null;
  const linked = sc === undefined || ids.SC === undefined ? [] : [{ workbookId: ids.SC, sc }];
  const scSources: ScMissionTimeSource[] = [...linked, ...scReferenced.filter((source) => linked.every((entry) => entry.workbookId !== source.workbookId))];
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
    scMissionTimeOptions: scSources.flatMap((source) => scMissionTimeOptions(source.workbookId, source.sc)),
    scMissionTimeTable: new Map(scSources.flatMap((source) => [...scMissionTimeTable(source.workbookId, source.sc)])),
    esInitiatingEvents: esInitiatingEvents(es),
    posStates: (pos?.plantOperatingStates ?? []).map((state) => ({
      id: state.uuid,
      name: state.name,
      mode: state.operatingMode,
      durationHours: state.meanDurationHours,
    })),
  };
}

function failureModeFields(modes: ReadonlyMap<string, string>, failureModeRef: string | undefined): Pick<SyControlledParameterOption, "failureModeId" | "failureModeName"> {
  const name = failureModeRef === undefined ? undefined : modes.get(failureModeRef);
  return failureModeRef === undefined || name === undefined ? {} : { failureModeId: failureModeRef, failureModeName: name };
}

function optionOrder(left: { workbookName: string; parameterName: string }, right: { workbookName: string; parameterName: string }): number {
  return [left.workbookName, left.parameterName].join(":").localeCompare([right.workbookName, right.parameterName].join(":"));
}

function controlledParameterOptions(sources: readonly DaSource[]): SyControlledParameterOption[] {
  return sources.flatMap(({ entry, workbook }) => {
    const modes = new Map((workbook.mef.failureModes ?? []).map((mode) => [mode.uuid, mode.name]));
    return workbook.mef.parameters.flatMap((parameter): SyControlledParameterOption[] => {
      const model = parameter.quantificationModel;
      const estimate = parameter.estimate;
      if (model === undefined || !isComponentModel(model) || estimate === undefined) return [];
      return [{
        workbookId: entry.id,
        workbookName: entry.name,
        parameterId: parameter.uuid,
        parameterName: parameter.name,
        estimate,
        unit: componentUnit(model),
        ...failureModeFields(modes, parameter.failureModeRef),
        ...(parameter.componentBoundaryRef === undefined ? {} : { componentBoundaryId: parameter.componentBoundaryRef }),
      }];
    });
  }).sort(optionOrder);
}

function controlledLegacyParameterOptions(sources: readonly DaSource[]): SyControlledLegacyParameterOption[] {
  return sources.flatMap(({ entry, workbook }) => workbook.mef.parameters.flatMap((parameter): SyControlledLegacyParameterOption[] => {
    const value = parameter.value;
    const rateUnit = RATE_UNITS[parameter.parameterType];
    if (
      isComponentModel(parameter.quantificationModel) ||
      value === undefined ||
      !SUPPORTED_PARAMETER_TYPES.has(parameter.parameterType) ||
      !Number.isFinite(value) ||
      value < 0 ||
      (rateUnit === undefined && value > 1)
    ) return [];
    return [{
      workbookId: entry.id,
      workbookName: entry.name,
      parameterId: parameter.uuid,
      parameterName: parameter.name,
      parameterType: parameter.parameterType as SyControlledLegacyParameterOption["parameterType"],
      value,
      ...(rateUnit === undefined ? {} : { rateUnit }),
    }];
  })).sort(optionOrder);
}

function sameHeldValue(held: number | undefined, value: number): boolean {
  return held !== undefined && Math.abs(held - value) <= 1e-9 * Math.max(Math.abs(held), Math.abs(value));
}

function heldValueDiffers(event: SystemBasicEvent, value: number, rateUnit?: "HOUR" | "YEAR"): boolean {
  const basis = event.quantificationBasis;
  if (basis?.kind === "FAILURE_RATE") return rateUnit !== undefined && (!sameHeldValue(basis.failureRate.value, value) || basis.failureRate.unit !== rateUnit);
  return rateUnit === undefined && !sameHeldValue(event.probability, value);
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
  return sources.flatMap(({ entry, workbook }) => workbook.mef.parameters.filter((parameter) => parameter.quantificationModel === "UNAVAILABILITY" && parameter.maintenance?.kind === "COINCIDENT").map((parameter): SyControlledCoincidentMaintenanceOption => ({
    workbookId: entry.id,
    workbookName: entry.name,
    recordId: parameter.uuid,
    description: parameter.description ?? parameter.name,
    equipment: [...(parameter.maintenance?.equipment ?? [])],
    scope: parameter.maintenance?.scope ?? "INTRASYSTEM",
    basis: parameter.maintenance?.method === "RECORDS" ? "ACTUAL_PLANT_EXPERIENCE" : "PREOP_ASSUMPTION",
    ...(parameter.value === undefined ? {} : { value: parameter.value }),
  }))).sort((left, right) => [left.workbookName, left.recordId].join(":").localeCompare([right.workbookName, right.recordId].join(":")));
}

function controlledComponentBoundaryOptions(sources: readonly DaSource[]): SyControlledComponentBoundaryOption[] {
  return sources.flatMap(({ entry, workbook }) => workbook.mef.componentBoundaries.map((boundary) => ({
    workbookId: entry.id,
    workbookName: entry.name,
    boundaryId: boundary.uuid,
    name: boundary.name,
    systemId: boundary.systemId,
    description: boundary.description,
    includedItems: [...boundary.includedItems],
    excludedItems: [...(boundary.excludedItems ?? [])],
    boundaryBasis: boundary.boundaryBasis,
  }))).sort((left, right) => [left.workbookName, left.name].join(":").localeCompare([right.workbookName, right.name].join(":")));
}

type ExampleAnalysis = Pick<SystemsAnalysis, "systemBasicEvents">;

type DaParameter = DataAnalysis["parameters"][number];

function relinkedExpression(expression: UncertainExpression, parameters: ReadonlyMap<string, DaParameter>, workbookId: string): UncertainExpression {
  switch (expression.node) {
    case "VALUE":
      return expression;
    case "PARAMETER":
      return parameters.has(expression.reference.entityId) ? { node: "PARAMETER", reference: { ...expression.reference, workbookId } } : expression;
    case "OPERATION":
      return { ...expression, operands: expression.operands.map((operand) => relinkedExpression(operand, parameters, workbookId)) };
    case "MODEL":
      return { node: "MODEL", model: mapModelArguments(expression.model, (argument) => relinkedExpression(argument, parameters, workbookId)) };
  }
}

function linkHumanExampleEvent(event: SystemBasicEvent, workbookId: string, parameter: DaParameter | undefined): SystemBasicEvent {
  const value = parameter?.value;
  if (
    parameter === undefined ||
    event.controlledDataSource?.referenceType !== undefined ||
    isComponentModel(parameter.quantificationModel) ||
    !LINKABLE_PARAMETER_TYPES.has(parameter.parameterType) ||
    value === undefined ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > 1
  ) return event;
  return {
    ...event,
    probability: value,
    controlledDataSource: { referenceType: "WORKBOOK_PARAMETER" as const, workbookId, entityId: parameter.uuid },
    dataAnalysisBasicEventRef: undefined,
  };
}

function linkComponentExampleEvent(event: SystemBasicEvent, workbookId: string, parameters: ReadonlyMap<string, DaParameter>): SystemBasicEvent {
  const expression = event.expression;
  return expression === undefined ? event : { ...event, expression: relinkedExpression(expression, parameters, workbookId) };
}

function linkExampleEvents(sy: ExampleAnalysis, workbookId: string, dataAnalysis: Pick<DataAnalysis, "parameters">): SystemBasicEvent[] {
  const parameters = new Map(dataAnalysis.parameters.map((parameter) => [parameter.uuid, parameter]));
  return sy.systemBasicEvents.map((event) => {
    if (carriesUncertainExpression(event.failureMode)) return linkComponentExampleEvent(event, workbookId, parameters);
    const reference = event.dataAnalysisBasicEventRef;
    return linkHumanExampleEvent(event, workbookId, typeof reference === "string" ? parameters.get(reference) : undefined);
  });
}

function linkExampleGroups(sy: Pick<SystemsAnalysis, "commonCauseFailureGroups">, workbookId: string, dataAnalysis: Pick<DataAnalysis, "parameters">): CommonCauseFailureGroup[] {
  const parameters = new Map(dataAnalysis.parameters.map((parameter) => [parameter.uuid, parameter]));
  return sy.commonCauseFailureGroups.map((group) => ({ ...group, total: relinkedExpression(group.total, parameters, workbookId) }));
}

type MissionTimeHolders = Pick<SystemsAnalysis, "systemDefinitions" | "systemBasicEvents" | "commonCauseFailureGroups">;

function syLinkRoots(sy: MissionTimeHolders): LinkRoot[] {
  return [
    ...sy.systemDefinitions.flatMap((system) => (system.missionTime === undefined ? [] : [{ expression: system.missionTime, missionTime: true }])),
    ...sy.systemBasicEvents.flatMap((event) => (event.expression === undefined ? [] : [{ expression: event.expression, missionTime: false }])),
    ...sy.commonCauseFailureGroups.map((group) => ({ expression: group.total, missionTime: false })),
  ];
}

function controlledCcfEstimateOptions(sources: readonly DaSource[]): SyControlledCcfEstimateOption[] {
  return sources.flatMap(({ entry, workbook }) => (workbook.mef.ccfParameterEstimations ?? []).flatMap((estimate): SyControlledCcfEstimateOption[] => {
    const factors = estimate.factors;
    if (factors === undefined) return [];
    const source = estimate.dataSources?.[0]?.source;
    return [{
      workbookId: entry.id,
      workbookName: entry.name,
      estimateId: estimate.uuid,
      groupReference: estimate.ccfGroupReference,
      factors,
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
  controlledComponentBoundaryOptions,
  controlledFailureModeOptions,
  controlledHumanFailureOptions,
  controlledLegacyParameterOptions,
  controlledParameterOptions,
  heldValueDiffers,
  linkExampleEvents,
  linkExampleGroups,
  listSyLinkOptions,
  syLinkRoots,
};
