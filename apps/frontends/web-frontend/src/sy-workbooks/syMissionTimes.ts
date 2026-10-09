import { useMemo } from "react";
import { expressionReferences, parameterReferenceKey, type UncertainExpression, type UncertainParameter } from "interfaces-mef-types/core/uncertainty";
import { systemFaultTreeBasicEventIds } from "interfaces-mef-types/sy/system-models";
import type { SystemBasicEvent, SystemDefinition, SystemsAnalysis } from "interfaces-mef-types/sy/systems-analysis";
import type { ParameterOption } from "../newly-developed-methods/shared/uncertainEditor";
import { useHoursPoints, type HoursState } from "../sc-workbooks/scMissionTimePoints";
import { scMissionTimeTable, type ScMissionTimes } from "../sc-workbooks/scMissionTimeLinks";
import { useLinkedScSources, type ScMissionTimeSource } from "../sc-workbooks/scMissionTimeSources";
import { syLinkRoots } from "./syLinks";
import { editorOptions, parameterLabel, valueTable, type ParameterTable } from "./syBasicEventValues";
import { useSyWorkbook, type SyControlledParameterOption, type SyLinkedInputs } from "./syWorkbookContext";

type MissionTimeLinks = Pick<SyLinkedInputs, "scMissionTimeOptions" | "scMissionTimeTable">;

interface SyValueSources {
  table: ParameterTable;
  options: ParameterOption[];
  missionTimeOptions: ParameterOption[];
  label: (key: string) => string;
}

const NO_MISSION_TIMES: ReadonlyMap<string, UncertainParameter> = new Map();

function linkedMissionTimeTable(links: MissionTimeLinks | null): ParameterTable {
  return links?.scMissionTimeTable ?? NO_MISSION_TIMES;
}

function syValueSources(parameters: readonly SyControlledParameterOption[], links: MissionTimeLinks | null): SyValueSources {
  const missionTimeOptions = links?.scMissionTimeOptions ?? [];
  const daLabel = parameterLabel(parameters);
  const scLabels = new Map(missionTimeOptions.map((option) => [parameterReferenceKey(option.reference), option.label]));
  return {
    table: valueTable(parameters, linkedMissionTimeTable(links)),
    options: [...editorOptions(parameters), ...missionTimeOptions],
    missionTimeOptions,
    label: (key) => scLabels.get(key) ?? daLabel(key),
  };
}

function linkedMissionTimes(expression: UncertainExpression | undefined, options: readonly ParameterOption[]): ParameterOption[] {
  const keys = new Set(expression === undefined ? [] : expressionReferences(expression).map(parameterReferenceKey));
  return options.filter((option) => keys.has(parameterReferenceKey(option.reference)));
}

function useSyValueSources(): SyValueSources {
  const { controlledParameters, links } = useSyWorkbook();
  return useMemo(() => syValueSources(controlledParameters, links), [controlledParameters, links]);
}

function ownerSystem(sy: Pick<SystemsAnalysis, "systemDefinitions" | "systemLogicModels">, eventId: string): SystemDefinition | undefined {
  const owner = sy.systemLogicModels.find((model) => systemFaultTreeBasicEventIds(model).includes(eventId))?.systemReference;
  return sy.systemDefinitions.find((system) => system.uuid === owner);
}

function modelMissionTime(expression: UncertainExpression | undefined): UncertainExpression | undefined {
  return expression?.node === "MODEL" && expression.model.form === "MISSION" ? expression.model.missionTime : undefined;
}

function basicEventMissionTime(sy: Pick<SystemsAnalysis, "systemDefinitions" | "systemLogicModels">, event: SystemBasicEvent): UncertainExpression | undefined {
  return modelMissionTime(event.expression) ?? ownerSystem(sy, event.uuid)?.missionTime;
}

function useReferencedScSources(sy: SystemsAnalysis | null, parameters: readonly SyControlledParameterOption[], linkedScId: string | undefined, linkedSc: ScMissionTimes | undefined): ScMissionTimeSource[] {
  const roots = useMemo(() => (sy === null ? [] : syLinkRoots(sy)), [sy]);
  const table = useMemo(
    () => valueTable(parameters, linkedScId === undefined || linkedSc === undefined ? NO_MISSION_TIMES : scMissionTimeTable(linkedScId, linkedSc)),
    [parameters, linkedScId, linkedSc],
  );
  return useLinkedScSources(roots, table);
}

function useSystemHours(systems: readonly SystemDefinition[]): Map<string, HoursState> {
  const { table } = useSyValueSources();
  const entries = useMemo(() => systems.flatMap((system) => (system.missionTime === undefined ? [] : [{ key: system.uuid, expression: system.missionTime }])), [systems]);
  return useHoursPoints(entries, table);
}

export { basicEventMissionTime, linkedMissionTimeTable, linkedMissionTimes, ownerSystem, syValueSources, useReferencedScSources, useSyValueSources, useSystemHours, type SyValueSources };
