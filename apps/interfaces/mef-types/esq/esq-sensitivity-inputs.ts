import type {
  EsqCaseLogic,
  EsqSensitivityCase,
  EsqSensitivityWork,
  EsqSolveLogic,
  EventSequenceQuantification,
} from "./event-sequence-quantification";
import { hasUncertainty, importanceGroupsOf, parameterUnit } from "./esq-measure-inputs";
import type { UncertainExpression, UncertainUnit } from "../core/uncertainty";
import { holdsEstimate } from "../da/data-analysis";
import { carriesUncertainExpression } from "../sy/systems-analysis";
import { resolvedCombinations } from "./esq-post-inputs";
import { esqStableId, hash32 } from "./esq-run-inputs";
import { solveInputsKey } from "./esq-solve-inputs";

interface EsqCaseOverrides {
  events: { id: string; probability: number }[];
  ccfGroups: { id: string; probability: number }[];
}

interface EsqAppliedCase {
  esq: EventSequenceQuantification;
  logic: EsqCaseLogic;
  overrides: EsqCaseOverrides;
  failedEvents: string[];
  problem?: string;
  kept: string[];
}

function sensitivityWorkOf(esq: EventSequenceQuantification): EsqSensitivityWork {
  return esq.sensitivityWork ?? {};
}

function esqSensitivityRunId(caseId: string): string {
  return esqStableId(`sensitivity-run:${caseId}`);
}

function registerEntryId(origin: string, kind: string, text: string): string {
  return `${origin}:${kind}:${hash32(text, 2166136261).toString(16).padStart(8, "0")}`;
}

function caseOf(esq: EventSequenceQuantification, caseId: string): EsqSensitivityCase | undefined {
  return sensitivityWorkOf(esq).cases?.find((entry) => entry.id === caseId);
}

function caseInputsKey(esq: EventSequenceQuantification, caseId: string): string {
  const entry = caseOf(esq, caseId);
  const definition = entry === undefined ? "" : JSON.stringify([entry.kind, entry.target ?? null, entry.value ?? null, entry.factor ?? null, entry.state ?? null, entry.logic ?? null]);
  const text = `${solveInputsKey(esq)}|${caseId}|${definition}`;
  return `${hash32(text, 2166136261).toString(16).padStart(8, "0")}${hash32(text, 374761393).toString(16).padStart(8, "0")}`;
}

function changed(current: number | undefined, entry: EsqSensitivityCase): number | undefined {
  if (entry.value !== undefined) return entry.value;
  if (entry.factor !== undefined && current !== undefined) return current * entry.factor;
  return undefined;
}

function changedExpression(current: UncertainExpression, unit: UncertainUnit, entry: EsqSensitivityCase): UncertainExpression | undefined {
  if (entry.value !== undefined) return entry.value >= 0 ? { node: "VALUE", value: { unit, law: { family: "POINT", value: entry.value } } } : undefined;
  if (entry.factor !== undefined && entry.factor >= 0) {
    return { node: "OPERATION", operation: "MULTIPLY", operands: [current, { node: "VALUE", value: { unit: "FACTOR", law: { family: "POINT", value: entry.factor } } }] };
  }
  return undefined;
}

function pointOf(value: number): UncertainExpression {
  return { node: "VALUE", value: { unit: "PROBABILITY", law: { family: "POINT", value } } };
}

function applySensitivityCase(source: EventSequenceQuantification, entry: EsqSensitivityCase, upper?: ReadonlyMap<string, number>): EsqAppliedCase {
  const esq: EventSequenceQuantification = structuredClone(source);
  const applied: EsqAppliedCase = { esq, logic: { ...(entry.logic ?? {}) }, overrides: { events: [], ccfGroups: [] }, failedEvents: [], kept: [] };
  const model = esq.model;
  if (model === undefined) return { ...applied, problem: "Import the model in Step 02 first." };
  const fail = (problem: string): EsqAppliedCase => ({ ...applied, problem });
  switch (entry.kind) {
    case "PARAMETER": {
      const parameter = model.parameters.find((candidate) => candidate.id === entry.target);
      if (parameter === undefined) return fail(`The model holds no DA parameter ${entry.target ?? ""}.`);
      if (holdsEstimate(parameter.quantificationModel)) {
        if (parameter.estimate === undefined) return fail(`DA gives ${parameter.name} no estimate.`);
        const estimate = changedExpression(parameter.estimate, parameterUnit(parameter), entry);
        if (estimate === undefined) return fail("Give the new value or a factor.");
        parameter.estimate = estimate;
        return applied;
      }
      const next = changed(parameter.value, entry);
      if (next === undefined || !(next >= 0)) return fail("Give the new value or a factor.");
      const ratio = parameter.value !== undefined && parameter.value > 0 ? next / parameter.value : undefined;
      parameter.value = next;
      for (const group of model.ccfGroups) {
        const shares = group.memberIds.every((memberId) => {
          const binding = esq.modelDecisions?.valueBindings?.find((candidate) => candidate.eventId === memberId);
          const record = model.events.find((event) => event.id === memberId);
          return (binding?.holderId ?? record?.holderId) === parameter.id && (binding?.heldBy ?? record?.heldBy) === "DA";
        });
        if (shares && ratio !== undefined && group.total !== undefined) {
          group.total = { node: "OPERATION", operation: "MULTIPLY", operands: [group.total, { node: "VALUE", value: { unit: "FACTOR", law: { family: "POINT", value: ratio } } }] };
        }
      }
      return applied;
    }
    case "CCF_TOTAL": {
      const group = model.ccfGroups.find((candidate) => candidate.id === entry.target);
      if (group === undefined) return fail(`The model holds no common cause group ${entry.target ?? ""}.`);
      if (group.total === undefined) return fail(`SY gives ${group.name} no group total.`);
      if (entry.value !== undefined && !(entry.value >= 0 && entry.value <= 1)) return fail("Give a group total between 0 and 1, or a factor.");
      const total = changedExpression(group.total, "PROBABILITY", entry);
      if (total === undefined) return fail("Give a group total between 0 and 1, or a factor.");
      group.total = total;
      return applied;
    }
    case "HEP": {
      const human = model.humanEvents.find((candidate) => candidate.id === entry.target);
      if (human === undefined) return fail(`The model holds no human failure event ${entry.target ?? ""}.`);
      if (human.hep === undefined) return fail(`HR gives ${human.name} no HEP.`);
      if (entry.value !== undefined && !(entry.value >= 0 && entry.value <= 1)) return fail("Give a HEP between 0 and 1, or a factor.");
      const hep = changedExpression(human.hep, "PROBABILITY", entry);
      if (hep === undefined) return fail("Give a HEP between 0 and 1, or a factor.");
      human.hep = hep;
      return applied;
    }
    case "EVENT": {
      const event = model.events.find((candidate) => candidate.id === entry.target);
      if (event === undefined) return fail(`The model holds no basic event ${entry.target ?? ""}.`);
      if (carriesUncertainExpression(event.failureMode)) {
        if (entry.value === 1) {
          applied.failedEvents.push(event.id);
          return applied;
        }
        if (event.expression === undefined) return fail(`SY gives ${event.code} no value.`);
        if (entry.value !== undefined && !(entry.value >= 0 && entry.value <= 1)) return fail("Give a probability between 0 and 1.");
        const expression = changedExpression(event.expression, "PROBABILITY", entry);
        if (expression === undefined) return fail("Give a probability between 0 and 1, or a factor.");
        event.expression = expression;
        event.heldBy = "TYPED";
        delete event.holderId;
        if (esq.modelDecisions?.valueBindings !== undefined) {
          esq.modelDecisions.valueBindings = esq.modelDecisions.valueBindings.filter((binding) => binding.eventId !== event.id);
        }
        return applied;
      }
      const next = changed(event.valueUnit === "PER_HOUR" ? undefined : event.value, entry);
      if (next === undefined || !(next >= 0 && next <= 1)) return fail("Give a probability between 0 and 1.");
      if (next === 1) applied.failedEvents.push(event.id);
      else applied.overrides.events.push({ id: event.id, probability: next });
      return applied;
    }
    case "GROUP_FAILED": {
      const group = importanceGroupsOf(esq).find((candidate) => candidate.key === entry.target);
      if (group === undefined) return fail(`The model holds no group ${entry.target ?? ""}.`);
      const members = group.ccfGroups.flatMap((id) => model.ccfGroups.find((candidate) => candidate.id === id)?.memberIds ?? []);
      applied.failedEvents.push(...new Set([...group.events, ...members].filter((id) => model.events.some((event) => event.id === id))));
      return applied;
    }
    case "FLAG": {
      const flag = esq.logic?.flags?.find((candidate) => candidate.id === entry.target);
      if (flag === undefined) return fail(`Step 03 holds no flag ${entry.target ?? ""}.`);
      if (entry.state === undefined) return fail("Choose the flag state for the case.");
      flag.state = entry.state;
      return applied;
    }
    case "LOGIC":
      return Object.keys(applied.logic).length === 0 ? fail("Change at least one logic setting.") : applied;
    case "HEP_95TH": {
      const fixedJoints = new Map(resolvedCombinations(esq).flatMap((view) => (view.level !== undefined && (view.source === "HRA" || view.source === "TYPED") ? [[view.combination.id, view.level] as const] : [])));
      const raised = (key: string, law: UncertainExpression | undefined): number | undefined => (law === undefined || !hasUncertainty(law) ? undefined : upper?.get(key));
      for (const human of model.humanEvents) {
        const value = raised(`HFE:${human.id}`, human.hep);
        if (value === undefined) {
          applied.kept.push(human.id);
          continue;
        }
        if (value > 1) return fail(`The 95th percentile of ${human.name} is ${value}, above 1. Narrow its law in HR.`);
        human.hep = pointOf(value);
      }
      for (const rule of esq.postWork?.recoveries ?? []) {
        if (!rule.credited) continue;
        const record = model.recoveries?.find((candidate) => candidate.id === rule.id);
        const law = rule.ofRecord === "TYPED" || record?.hep === undefined ? rule.typed?.expression : record.hep;
        const value = raised(`RECOVERY:${rule.id}`, law);
        if (value === undefined) {
          applied.kept.push(rule.id);
          continue;
        }
        if (value > 1) return fail(`The 95th percentile of the non-recovery ${record?.name ?? rule.manual?.name ?? rule.id} is ${value}, above 1. Narrow its law.`);
        if (record !== undefined) record.hep = pointOf(value);
        if (rule.typed !== undefined) rule.typed = { ...rule.typed, expression: pointOf(value) };
      }
      for (const combination of esq.postWork?.combinations ?? []) {
        const level = fixedJoints.get(combination.id);
        if (level === undefined) continue;
        combination.ofRecord = "THERP";
        combination.level = level;
      }
      return applied;
    }
  }
}

function caseLogic(base: EsqSolveLogic, applied: EsqAppliedCase): EsqSolveLogic {
  return { ...base, ...applied.logic };
}

export { applySensitivityCase, caseInputsKey, caseLogic, caseOf, esqSensitivityRunId, registerEntryId, sensitivityWorkOf };
export type { EsqAppliedCase, EsqCaseOverrides };
