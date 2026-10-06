import type {
  EsqCaseLogic,
  EsqSensitivityCase,
  EsqSensitivityWork,
  EsqSolveLogic,
  EventSequenceQuantification,
} from "./event-sequence-quantification";
import { importanceGroupsOf, lawPercentile, sampledInputsOf } from "./esq-measure-inputs";
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

const Z95 = 1.6448536269514722;

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

function applySensitivityCase(source: EventSequenceQuantification, entry: EsqSensitivityCase): EsqAppliedCase {
  const esq: EventSequenceQuantification = structuredClone(source);
  const applied: EsqAppliedCase = { esq, logic: { ...(entry.logic ?? {}) }, overrides: { events: [], ccfGroups: [] }, failedEvents: [], kept: [] };
  const model = esq.model;
  if (model === undefined) return { ...applied, problem: "Import the model in Step 02 first." };
  const fail = (problem: string): EsqAppliedCase => ({ ...applied, problem });
  switch (entry.kind) {
    case "PARAMETER": {
      const parameter = model.parameters.find((candidate) => candidate.id === entry.target);
      if (parameter === undefined) return fail(`The model holds no DA parameter ${entry.target ?? ""}.`);
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
        if (shares && ratio !== undefined && group.totalProbability !== undefined) group.totalProbability = Math.min(1, group.totalProbability * ratio);
      }
      return applied;
    }
    case "CCF_TOTAL": {
      const group = model.ccfGroups.find((candidate) => candidate.id === entry.target);
      if (group === undefined) return fail(`The model holds no common cause group ${entry.target ?? ""}.`);
      const next = changed(group.totalProbability, entry);
      if (next === undefined || !(next >= 0 && next <= 1)) return fail("Give a group total between 0 and 1, or a factor.");
      group.totalProbability = next;
      return applied;
    }
    case "HEP": {
      const human = model.humanEvents.find((candidate) => candidate.id === entry.target);
      if (human === undefined) return fail(`The model holds no human failure event ${entry.target ?? ""}.`);
      const next = changed(human.value, entry);
      if (next === undefined || !(next >= 0 && next <= 1)) return fail("Give a HEP between 0 and 1, or a factor.");
      human.value = next;
      return applied;
    }
    case "EVENT": {
      const event = model.events.find((candidate) => candidate.id === entry.target);
      if (event === undefined) return fail(`The model holds no basic event ${entry.target ?? ""}.`);
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
      const inputs = new Map(sampledInputsOf(esq).map((input) => [input.key, input]));
      for (const human of model.humanEvents) {
        const law = inputs.get(`HFE:${human.id}`)?.law;
        const value = law === undefined ? undefined : lawPercentile(law, Z95);
        if (value === undefined) {
          applied.kept.push(human.id);
          continue;
        }
        human.value = Math.min(1, value);
      }
      for (const recovery of model.recoveries ?? []) {
        const law = inputs.get(`RECOVERY:${recovery.id}`)?.law;
        const value = law === undefined ? undefined : lawPercentile(law, Z95);
        if (value === undefined) {
          applied.kept.push(recovery.id);
          continue;
        }
        recovery.hep = Math.min(1, value);
        const rule = esq.postWork?.recoveries?.find((candidate) => candidate.id === recovery.id);
        if (rule?.typed !== undefined) rule.typed = { ...rule.typed, value: Math.min(1, value) };
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
