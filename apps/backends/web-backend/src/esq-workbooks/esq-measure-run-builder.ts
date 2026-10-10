import type { EsqTreeRecord, EventSequenceQuantification } from "interfaces-mef-types/esq/event-sequence-quantification";
import {
  ccfInputKey,
  eventInputKey,
  importanceGroupsOf,
  initiatorInputKey,
  type EsqImportanceGroup,
  type EsqSampledInput,
} from "interfaces-mef-types/esq/esq-measure-inputs";
import type {
  EsqEventTreeRunLogic,
  EsqUncertaintyCorrelation,
  EsqUncertaintyUnsampled,
  EventTreeSamplingMethod,
} from "interfaces-shared-types/newly-developed-methods";
import type { EsqCaseOverrides } from "interfaces-mef-types/esq/esq-sensitivity-inputs";
import {
  ccfFactorExpressions,
  expressionReferences,
  mapModelArguments,
  parameterReferenceKey,
  type UncertainExpression,
  type UncertainParameter,
} from "interfaces-mef-types/core/uncertainty";
import type { WorkbookParameterReference } from "interfaces-mef-types/modeling/references";
import type { EsqRunBuild, EsqRunEventValue } from "./esq-model-run-builder";
import type { CatalogueCcfGroup } from "../newly-developed-methods/shared/praxis-snapshot-adapters";

interface EsqImportanceSpecGroup {
  key: string;
  events: string[];
  ccfGroups: string[];
}

interface EsqSampling {
  trials: number;
  seed: number;
  method: EventTreeSamplingMethod;
}

interface EsqSamplingSettings {
  trials: number;
  seed: number;
  method: EventTreeSamplingMethod;
  correlation: EsqUncertaintyCorrelation;
}

interface EsqSamplingUse {
  input: EsqSampledInput;
  events: Set<string>;
}

interface EsqSamplingTally {
  used: Map<string, EsqSamplingUse>;
  unsampled: Map<string, EsqUncertaintyUnsampled>;
}

function importanceGroupsFor(esq: EventSequenceQuantification, logic: EsqEventTreeRunLogic): EsqImportanceGroup[] {
  const groups = importanceGroupsOf(esq);
  if (logic.expandCcf) return groups;
  const members = new Map((esq.model?.ccfGroups ?? []).map((group) => [group.id, group.memberIds]));
  return groups.map((group) => ({
    ...group,
    events: [...new Set([...group.events, ...group.ccfGroups.flatMap((groupId) => members.get(groupId) ?? [])])],
    ccfGroups: [],
  }));
}

function importanceSpecFor(groups: readonly EsqImportanceGroup[], build: EsqRunBuild): EsqImportanceSpecGroup[] {
  const events = new Set(build.values.map((value) => value.id));
  const ccfGroups = new Set(build.ccfGroups.map((group) => group.id));
  return groups.flatMap((group) => {
    const present = group.events.filter((id) => events.has(id));
    const presentGroups = group.ccfGroups.filter((id) => ccfGroups.has(id));
    return present.length === 0 && presentGroups.length === 0 ? [] : [{ key: group.key, events: present, ccfGroups: presentGroups }];
  });
}

function caseOverridesFor(overrides: EsqCaseOverrides | undefined, build: EsqRunBuild): EsqCaseOverrides | undefined {
  if (overrides === undefined) return undefined;
  const events = new Set(build.values.map((value) => value.id));
  const ccfGroups = new Set(build.ccfGroups.map((group) => group.id));
  const present: EsqCaseOverrides = {
    events: overrides.events.filter((item) => events.has(item.id)).map((item) => ({ ...item })),
    ccfGroups: overrides.ccfGroups.filter((item) => ccfGroups.has(item.id)).map((item) => ({ ...item })),
  };
  return present.events.length === 0 && present.ccfGroups.length === 0 ? undefined : present;
}

function baseKeyOf(esq: EventSequenceQuantification, value: EsqRunEventValue): string | undefined {
  const model = esq.model;
  if (model === undefined) return undefined;
  if (value.role === "RECOVERY") return value.recoveryId === undefined ? undefined : `RECOVERY:${value.recoveryId}`;
  if (value.role === "SPLIT") return value.splitKey;
  if (value.role === "JOINT" || value.role === "INDEPENDENT_PART") return value.baseEventId === undefined ? undefined : eventInputKey(esq, model, value.baseEventId);
  return eventInputKey(esq, model, value.id);
}

function factor(value: number): UncertainExpression {
  return { node: "VALUE", value: { unit: "FACTOR", law: { family: "POINT", value } } };
}

function renamed(expression: UncertainExpression, suffix: string, entries: ReadonlyMap<string, UncertainParameter>, added: Map<string, UncertainParameter>): UncertainExpression {
  switch (expression.node) {
    case "VALUE":
      return expression;
    case "PARAMETER": {
      const source = entries.get(parameterReferenceKey(expression.reference));
      if (source === undefined) return expression;
      const reference: WorkbookParameterReference = { ...expression.reference, entityId: `${expression.reference.entityId}@${suffix}` };
      added.set(parameterReferenceKey(reference), { reference, expression: source.expression });
      return { node: "PARAMETER", reference };
    }
    case "OPERATION":
      return { ...expression, operands: expression.operands.map((operand) => renamed(operand, suffix, entries, added)) };
    case "MODEL":
      return { node: "MODEL", model: mapModelArguments(expression.model, (argument) => renamed(argument, suffix, entries, added)) };
  }
}

function sampledBuild(input: {
  esq: EventSequenceQuantification;
  build: EsqRunBuild;
  root: EsqTreeRecord;
  logic: EsqEventTreeRunLogic;
  settings: EsqSamplingSettings;
  inputs: ReadonlyMap<string, EsqSampledInput>;
  tally: EsqSamplingTally;
}): { build: EsqRunBuild; sampling: EsqSampling } {
  const { esq, build, settings, inputs, tally } = input;
  const model = esq.model;
  const independent = settings.correlation === "INDEPENDENT";
  const entries = new Map([...build.faultTrees.flatMap((tree) => tree.basicEventCatalogue.uncertaintyParameters), ...build.initiatorTables.uncertaintyParameters, ...build.sharedParameters].map((parameter) => [parameterReferenceKey(parameter.reference), parameter] as const));
  const added = new Map<string, UncertainParameter>();
  const note = (baseKey: string, user: string): EsqSampledInput | undefined => {
    const known = inputs.get(baseKey);
    if (known === undefined) {
      tally.unsampled.set(baseKey, { id: baseKey, label: baseKey, reason: "The value has no input record. It stays at its point value." });
      return undefined;
    }
    if (!known.uncertain) {
      tally.unsampled.set(baseKey, { id: baseKey, label: known.label, reason: known.missing ?? "No distribution." });
      return undefined;
    }
    const use = tally.used.get(baseKey) ?? { input: known, events: new Set<string>() };
    use.events.add(user);
    tally.used.set(baseKey, use);
    return known;
  };
  const expanded = new Set(input.logic.expandCcf
    ? build.ccfGroups.flatMap((group) => model?.ccfGroups.find((record) => record.id === group.id)?.memberIds ?? [])
    : []);
  const replaced = new Map<string, UncertainExpression>();
  const valueOf = new Map(build.values.map((value) => [value.id, value]));
  for (const tree of build.faultTrees) {
    for (const event of tree.basicEventCatalogue.basicEvents) {
      const value = valueOf.get(event.id);
      if (value === undefined || replaced.has(event.id)) continue;
      if (value.role === "BASIC" && expanded.has(value.id)) continue;
      const baseKey = baseKeyOf(esq, value);
      if (baseKey === undefined || note(baseKey, value.id) === undefined) continue;
      if ((value.role === "JOINT" || value.role === "INDEPENDENT_PART") && value.ratio !== undefined && value.baseExpression !== undefined) {
        const base = independent ? renamed(value.baseExpression, event.id, entries, added) : value.baseExpression;
        replaced.set(event.id, { node: "OPERATION", operation: "MULTIPLY", operands: [base, factor(value.ratio)] });
        continue;
      }
      if (independent) replaced.set(event.id, renamed(event.expression, event.id, entries, added));
    }
  }
  const totals = new Map<string, UncertainExpression>();
  if (input.logic.expandCcf && model !== undefined) {
    for (const group of build.ccfGroups) {
      const baseKey = ccfInputKey(esq, model, group.id);
      if (note(baseKey, `ccf:${group.id}`) === undefined) continue;
      const total = group.total;
      if (independent && total !== undefined) totals.set(group.id, renamed(total, `ccf:${group.id}`, entries, added));
    }
  }
  const sampling: EsqSampling = { trials: settings.trials, seed: settings.seed, method: settings.method };
  const initiator = note(initiatorInputKey(esq, input.root.initiatorId), `initiator:${input.root.initiatorId}`);
  const frequency = initiator !== undefined && independent ? renamed(build.frequency, `initiator:${input.root.initiatorId}`, entries, added) : build.frequency;
  const eventTreeSnapshots = build.eventTreeSnapshots.map((snapshot) => ({ ...snapshot, initiatingEventFrequency: { expression: frequency } }));
  const withTotal = (group: CatalogueCcfGroup): CatalogueCcfGroup => {
    const total = totals.get(group.id);
    return total === undefined ? group : { ...group, total };
  };
  const ccfGroups = build.ccfGroups.map(withTotal);
  const faultTrees = build.faultTrees.map((tree) => ({
    ...tree,
    basicEventCatalogue: {
      ...tree.basicEventCatalogue,
      basicEvents: tree.basicEventCatalogue.basicEvents.map((event) => ({ ...event, expression: replaced.get(event.id) ?? event.expression })),
      commonCauseFailureGroups: tree.basicEventCatalogue.commonCauseFailureGroups.map(withTotal),
      uncertaintyParameters: [...tree.basicEventCatalogue.uncertaintyParameters, ...build.sharedParameters, ...added.values()].filter((parameter, index, all) => all.findIndex((other) => parameterReferenceKey(other.reference) === parameterReferenceKey(parameter.reference)) === index),
    },
  }));
  const known = new Map([...faultTrees.flatMap((tree) => tree.basicEventCatalogue.uncertaintyParameters), ...build.initiatorTables.uncertaintyParameters, ...added.values()].map((parameter) => [parameterReferenceKey(parameter.reference), parameter] as const));
  const reachable = (expressions: readonly UncertainExpression[]): Set<string> => {
    const found = new Set<string>();
    const pending = expressions.flatMap(expressionReferences).map(parameterReferenceKey);
    for (let key = pending.pop(); key !== undefined; key = pending.pop()) {
      if (found.has(key)) continue;
      found.add(key);
      const parameter = known.get(key);
      if (parameter !== undefined) pending.push(...expressionReferences(parameter.expression).map(parameterReferenceKey));
    }
    return found;
  };
  const kept = reachable([
    ...faultTrees.flatMap((tree) => [
      ...tree.basicEventCatalogue.basicEvents.map((event) => event.expression),
      ...tree.basicEventCatalogue.commonCauseFailureGroups.flatMap((group) => [...(group.total === undefined ? [] : [group.total]), ...ccfFactorExpressions(group.factors)]),
    ]),
    frequency,
  ]);
  const initiatorKeys = reachable([frequency]);
  return {
    build: {
      ...build,
      frequency,
      eventTreeSnapshots,
      initiatorTables: { ...build.initiatorTables, uncertaintyParameters: [...known.values()].filter((parameter) => initiatorKeys.has(parameterReferenceKey(parameter.reference))) },
      ccfGroups,
      faultTrees: faultTrees.map((tree) => ({
        ...tree,
        basicEventCatalogue: {
          ...tree.basicEventCatalogue,
          uncertaintyParameters: tree.basicEventCatalogue.uncertaintyParameters.filter((parameter) => kept.has(parameterReferenceKey(parameter.reference))),
        },
      })),
    },
    sampling,
  };
}

export {
  caseOverridesFor,
  importanceGroupsFor,
  importanceSpecFor,
  sampledBuild,
  type EsqImportanceSpecGroup,
  type EsqSampling,
  type EsqSamplingSettings,
  type EsqSamplingTally,
  type EsqSamplingUse,
};
