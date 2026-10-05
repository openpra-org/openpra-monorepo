import { DistributionType, FrequencyUnit, type Frequency, type FrequencyWithDistribution, type ParameterDistribution } from "interfaces-mef-types/core/events";
import type { DataAnalysis } from "interfaces-mef-types/da/data-analysis";
import type { InitiatingEventGroup, InitiatingEventsAnalysis } from "interfaces-mef-types/ie/initiating-event-analysis";
import { fetchJson } from "../api/client";
import { listWorkbooks } from "../workbooks/workbookApi";

const EXAMPLE_PREFIX = "example-da-";

interface IeDaFrequencyOption {
  workbookId: string;
  workbookName: string;
  parameterId: string;
  parameterName: string;
  value: number;
  distribution?: ParameterDistribution;
}

interface IeDaSource {
  id: string;
  name: string;
  mef: Pick<DataAnalysis, "name" | "parameters">;
}

function daOptionKey(workbookId: string, parameterId: string): string {
  return JSON.stringify([workbookId, parameterId]);
}

function daFrequencyOptions(sources: readonly IeDaSource[]): IeDaFrequencyOption[] {
  return sources.flatMap((source) => source.mef.parameters.flatMap((parameter): IeDaFrequencyOption[] => {
    const value = parameter.value;
    if (parameter.parameterType !== "FREQUENCY" || value === undefined || !Number.isFinite(value) || value < 0) return [];
    if (parameter.valueMode === "LINKED" && parameter.valueLink?.element === "IE") return [];
    const distribution = parameter.uncertainty?.distribution;
    return [{
      workbookId: source.id,
      workbookName: source.name.length > 0 ? source.name : source.mef.name,
      parameterId: parameter.uuid,
      parameterName: parameter.name,
      value,
      ...(distribution === undefined ? {} : { distribution }),
    }];
  })).sort((left, right) => [left.workbookName, left.parameterId].join(":").localeCompare([right.workbookName, right.parameterId].join(":"), undefined, { numeric: true }));
}

function linkedDaOption(group: InitiatingEventGroup | undefined, options: readonly IeDaFrequencyOption[]): IeDaFrequencyOption | undefined {
  const source = group?.controlledDataSource;
  if (source === undefined) return undefined;
  return options.find((option) => option.workbookId === source.workbookId && option.parameterId === source.entityId);
}

function heldValue(frequency: Frequency | FrequencyWithDistribution | undefined): number | undefined {
  if (frequency === undefined) return undefined;
  return typeof frequency === "number" ? frequency : frequency.value;
}

function heldDiffers(frequency: Frequency | FrequencyWithDistribution | undefined, value: number): boolean {
  const held = heldValue(frequency);
  return held === undefined || Math.abs(held - value) > 1e-9 * Math.max(Math.abs(held), Math.abs(value));
}

function frequencyFromDa(option: IeDaFrequencyOption, units: FrequencyUnit): FrequencyWithDistribution {
  const distribution = option.distribution;
  const shape = distribution?.type === DistributionType.LOGNORMAL
    ? { type: DistributionType.LOGNORMAL, parameters: [distribution.median, distribution.errorFactor] }
    : distribution?.type === DistributionType.GAMMA
      ? { type: DistributionType.GAMMA, parameters: [distribution.shape, distribution.rate] }
      : undefined;
  return {
    value: option.value,
    units,
    ...(shape === undefined ? {} : { distribution: shape }),
    source: `Imported from DA parameter ${option.parameterId} in ${option.workbookName}.`,
  };
}

function groupUnits(group: InitiatingEventGroup | undefined): FrequencyUnit {
  const frequency = group?.meanFrequency;
  return typeof frequency === "object" ? frequency.units : FrequencyUnit.PER_PLANT_YEAR;
}

function asGroupFrequency(frequency: Frequency | FrequencyWithDistribution, group: InitiatingEventGroup): FrequencyWithDistribution {
  return typeof frequency === "object" ? frequency : { value: frequency, units: groupUnits(group) };
}

function withImportedFrequency(ie: InitiatingEventsAnalysis, groupId: string, option: IeDaFrequencyOption | undefined): InitiatingEventsAnalysis {
  const group = ie.initiatingEventGroups.find((candidate) => candidate.uuid === groupId);
  if (group === undefined) return ie;
  if (option === undefined) {
    return { ...ie, initiatingEventGroups: ie.initiatingEventGroups.map((candidate) => (candidate.uuid === groupId ? { ...candidate, controlledDataSource: undefined } : candidate)) };
  }
  const frequency = frequencyFromDa(option, groupUnits(group));
  return {
    ...ie,
    initiatingEventGroups: ie.initiatingEventGroups.map((candidate) => (candidate.uuid === groupId
      ? { ...candidate, meanFrequency: frequency, controlledDataSource: { referenceType: "WORKBOOK_PARAMETER" as const, workbookId: option.workbookId, entityId: option.parameterId } }
      : candidate)),
    quantifications: ie.quantifications.map((quantification) => (quantification.initiatorOrGroupId === groupId ? { ...quantification, meanFrequency: frequency } : quantification)),
  };
}

function withTypedGroupFrequency(ie: InitiatingEventsAnalysis, targetId: string): InitiatingEventsAnalysis {
  const quantification = ie.quantifications.find((candidate) => candidate.initiatorOrGroupId === targetId);
  const group = ie.initiatingEventGroups.find((candidate) => candidate.uuid === targetId);
  if (quantification === undefined || group === undefined || group.controlledDataSource !== undefined) return ie;
  const frequency = asGroupFrequency(quantification.meanFrequency, group);
  return { ...ie, initiatingEventGroups: ie.initiatingEventGroups.map((candidate) => (candidate.uuid === targetId ? { ...candidate, meanFrequency: frequency } : candidate)) };
}

async function loadDaSource(id: string, name: string): Promise<IeDaSource[]> {
  try {
    if (id.startsWith(EXAMPLE_PREFIX)) {
      const bundle = await fetchJson<{ da: { mef: DataAnalysis } }>(`/api/example-workbooks/da-bundle?example=${encodeURIComponent(id.slice(EXAMPLE_PREFIX.length))}`);
      return [{ id, name, mef: bundle.da.mef }];
    }
    const workbook = await fetchJson<{ mef: DataAnalysis }>(`/api/da-workbooks/${encodeURIComponent(id)}`);
    return [{ id, name, mef: workbook.mef }];
  } catch {
    return [];
  }
}

async function loadIeDaFrequencies(projectId: string, ie: InitiatingEventsAnalysis): Promise<IeDaFrequencyOption[]> {
  let listed: { id: string; name: string }[] = [];
  try {
    listed = (await listWorkbooks(projectId, "DA")).workbooks.map((workbook) => ({ id: workbook.id, name: workbook.name }));
  } catch {
    listed = [];
  }
  const known = new Set(listed.map((entry) => entry.id));
  const examples = [...new Set(ie.initiatingEventGroups.flatMap((group) => group.controlledDataSource?.workbookId ?? []))]
    .filter((id) => id.startsWith(EXAMPLE_PREFIX) && !known.has(id))
    .map((id) => ({ id, name: "" }));
  const sources = await Promise.all([...listed, ...examples].map((entry) => loadDaSource(entry.id, entry.name)));
  return daFrequencyOptions(sources.flat());
}

export {
  EXAMPLE_PREFIX,
  daFrequencyOptions,
  daOptionKey,
  frequencyFromDa,
  heldDiffers,
  heldValue,
  linkedDaOption,
  loadIeDaFrequencies,
  withImportedFrequency,
  withTypedGroupFrequency,
  type IeDaFrequencyOption,
  type IeDaSource,
};
