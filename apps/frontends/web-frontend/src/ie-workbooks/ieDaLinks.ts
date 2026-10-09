import { useMemo } from "react";
import { type UncertainFrequency } from "interfaces-mef-types/core/events";
import {
  canonicalJson,
  mapModelArguments,
  parameterReferenceKey,
  type UncertainExpression,
  type UncertainParameter,
} from "interfaces-mef-types/core/uncertainty";
import type { DataAnalysis } from "interfaces-mef-types/da/data-analysis";
import type { InitiatingEventGroup, InitiatingEventsAnalysis } from "interfaces-mef-types/ie/initiating-event-analysis";
import type { WorkbookParameterReference } from "interfaces-mef-types/modeling/references";
import { fetchJson } from "../api/client";
import { listWorkbooks } from "../workbooks/workbookApi";
import { DEFAULT_FREQUENCY_BASIS } from "../newly-developed-methods/ie-frequency-quantification/frequencySources";
import { type LinkRoot } from "../newly-developed-methods/shared/uncertaintyLinks";
import { useLinkedScSources, withScSources } from "../sc-workbooks/scMissionTimeSources";

const EXAMPLE_PREFIX = "example-da-";

interface IeDaFrequencyOption {
  workbookId: string;
  workbookName: string;
  parameterId: string;
  parameterName: string;
  estimate: UncertainExpression;
}

interface IeDaSource {
  id: string;
  name: string;
  mef: Pick<DataAnalysis, "name" | "parameters">;
}

type DaParameterTable = ReadonlyMap<string, UncertainParameter>;

function daOptionKey(workbookId: string, parameterId: string): string {
  return JSON.stringify([workbookId, parameterId]);
}

function daReference(option: Pick<IeDaFrequencyOption, "workbookId" | "parameterId">): WorkbookParameterReference {
  return { referenceType: "WORKBOOK_PARAMETER", workbookId: option.workbookId, entityId: option.parameterId };
}

function daParameterKey(option: Pick<IeDaFrequencyOption, "workbookId" | "parameterId">): string {
  return parameterReferenceKey(daReference(option));
}

function daParameterTable(options: readonly IeDaFrequencyOption[]): Map<string, UncertainParameter> {
  return new Map(options.map((option) => [daParameterKey(option), { reference: daReference(option), expression: option.estimate }]));
}

const NO_ROOTS: readonly LinkRoot[] = [];

function useDaFrequencyTable(options: readonly IeDaFrequencyOption[]): Map<string, UncertainParameter> {
  const base = useMemo(() => daParameterTable(options), [options]);
  const sources = useLinkedScSources(NO_ROOTS, base);
  return useMemo(() => (sources.length === 0 ? base : withScSources(base, sources)), [base, sources]);
}

function daParameterLabel(options: readonly IeDaFrequencyOption[]): (key: string) => string {
  const names = new Map(options.map((option) => [daParameterKey(option), `${option.parameterId} in ${option.workbookName}`]));
  return (key) => names.get(key) ?? "an unavailable DA estimate";
}

function daFrequencyOptions(sources: readonly IeDaSource[]): IeDaFrequencyOption[] {
  return sources.flatMap((source) => source.mef.parameters.flatMap((parameter): IeDaFrequencyOption[] => {
    const estimate = parameter.estimate;
    if (parameter.parameterType !== "FREQUENCY" || estimate === undefined) return [];
    if (parameter.valueMode === "LINKED" && parameter.valueLink?.element === "IE") return [];
    return [{
      workbookId: source.id,
      workbookName: source.name.length > 0 ? source.name : source.mef.name,
      parameterId: parameter.uuid,
      parameterName: parameter.name,
      estimate,
    }];
  })).sort((left, right) => [left.workbookName, left.parameterId].join(":").localeCompare([right.workbookName, right.parameterId].join(":"), undefined, { numeric: true }));
}

function linkedDaOption(group: InitiatingEventGroup | undefined, options: readonly IeDaFrequencyOption[]): IeDaFrequencyOption | undefined {
  const source = group?.controlledDataSource;
  if (source === undefined) return undefined;
  return options.find((option) => option.workbookId === source.workbookId && option.parameterId === source.entityId);
}

function linksTo(expression: UncertainExpression, option: IeDaFrequencyOption): boolean {
  return expression.node === "PARAMETER" && parameterReferenceKey(expression.reference) === daParameterKey(option);
}

function heldDiffers(group: InitiatingEventGroup | undefined, option: IeDaFrequencyOption): boolean {
  const held = group?.frequency?.expression;
  if (held === undefined) return true;
  if (linksTo(held, option)) return false;
  return canonicalJson(held) !== canonicalJson(option.estimate);
}

function inlined(expression: UncertainExpression, table: DaParameterTable, seen: ReadonlySet<string> = new Set()): UncertainExpression {
  switch (expression.node) {
    case "VALUE":
      return expression;
    case "PARAMETER": {
      const key = parameterReferenceKey(expression.reference);
      const parameter = table.get(key);
      return parameter === undefined || seen.has(key) ? expression : inlined(parameter.expression, table, new Set([...seen, key]));
    }
    case "OPERATION":
      return { node: "OPERATION", operation: expression.operation, operands: expression.operands.map((operand) => inlined(operand, table, seen)) };
    case "MODEL":
      return { node: "MODEL", model: mapModelArguments(expression.model, (argument) => inlined(argument, table, seen)) };
  }
}

function groupBasis(group: InitiatingEventGroup): UncertainFrequency["basis"] {
  return group.frequency?.basis ?? DEFAULT_FREQUENCY_BASIS;
}

function withGroupFrequency(ie: InitiatingEventsAnalysis, groupId: string, frequency: UncertainFrequency | undefined, link: WorkbookParameterReference | undefined): InitiatingEventsAnalysis {
  return {
    ...ie,
    initiatingEventGroups: ie.initiatingEventGroups.map((candidate) => {
      if (candidate.uuid !== groupId) return candidate;
      const { controlledDataSource: _link, frequency: _frequency, ...rest } = candidate;
      return { ...rest, ...(frequency === undefined ? {} : { frequency }), ...(link === undefined ? {} : { controlledDataSource: link }) };
    }),
    quantifications: frequency === undefined
      ? ie.quantifications
      : ie.quantifications.map((quantification) => (quantification.initiatorOrGroupId === groupId ? { ...quantification, frequency } : quantification)),
  };
}

function withImportedFrequency(ie: InitiatingEventsAnalysis, groupId: string, option: IeDaFrequencyOption | undefined, options: readonly IeDaFrequencyOption[]): InitiatingEventsAnalysis {
  const group = ie.initiatingEventGroups.find((candidate) => candidate.uuid === groupId);
  if (group === undefined) return ie;
  if (option !== undefined) {
    const link = daReference(option);
    return withGroupFrequency(ie, groupId, { expression: { node: "PARAMETER", reference: link }, basis: groupBasis(group) }, link);
  }
  const held = group.frequency;
  const released = held === undefined ? undefined : { ...held, expression: inlined(held.expression, daParameterTable(options)) };
  return withGroupFrequency(ie, groupId, released, undefined);
}

function withTypedGroupFrequency(ie: InitiatingEventsAnalysis, targetId: string): InitiatingEventsAnalysis {
  const quantification = ie.quantifications.find((candidate) => candidate.initiatorOrGroupId === targetId);
  const group = ie.initiatingEventGroups.find((candidate) => candidate.uuid === targetId);
  if (quantification === undefined || group === undefined || group.controlledDataSource !== undefined) return ie;
  const frequency = quantification.frequency;
  return {
    ...ie,
    initiatingEventGroups: ie.initiatingEventGroups.map((candidate) => {
      if (candidate.uuid !== targetId) return candidate;
      const { frequency: _held, ...rest } = candidate;
      return frequency === undefined ? rest : { ...rest, frequency };
    }),
  };
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

async function loadDaFrequencies(projectId: string, linkedWorkbookIds: readonly string[]): Promise<IeDaFrequencyOption[]> {
  let listed: { id: string; name: string }[] = [];
  try {
    listed = (await listWorkbooks(projectId, "DA")).workbooks.map((workbook) => ({ id: workbook.id, name: workbook.name }));
  } catch {
    listed = [];
  }
  const known = new Set(listed.map((entry) => entry.id));
  const examples = [...new Set(linkedWorkbookIds)]
    .filter((id) => id.startsWith(EXAMPLE_PREFIX) && !known.has(id))
    .map((id) => ({ id, name: "" }));
  const sources = await Promise.all([...listed, ...examples].map((entry) => loadDaSource(entry.id, entry.name)));
  return daFrequencyOptions(sources.flat());
}

function loadIeDaFrequencies(projectId: string, ie: InitiatingEventsAnalysis): Promise<IeDaFrequencyOption[]> {
  return loadDaFrequencies(projectId, ie.initiatingEventGroups.flatMap((group) => group.controlledDataSource?.workbookId ?? []));
}

export {
  EXAMPLE_PREFIX,
  daFrequencyOptions,
  daOptionKey,
  daParameterKey,
  daParameterLabel,
  daParameterTable,
  daReference,
  useDaFrequencyTable,
  heldDiffers,
  linkedDaOption,
  loadDaFrequencies,
  loadIeDaFrequencies,
  withImportedFrequency,
  withTypedGroupFrequency,
  type IeDaFrequencyOption,
  type IeDaSource,
};
