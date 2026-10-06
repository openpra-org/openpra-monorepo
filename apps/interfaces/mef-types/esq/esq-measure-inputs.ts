import { DistributionType, type ParameterDistribution } from "../core/events";
import type {
  EsqCcfRecord,
  EsqModel,
  EsqSpread,
  EsqSplitFractionTarget,
  EventSequenceQuantification,
} from "./event-sequence-quantification";
import { cellOf } from "./esq-barrier-inputs";
import { esqIndependentEventId, resolvedRecoveries } from "./esq-post-inputs";
import { esqStableId, functionLinkOf, groupFrequency, hash32, resolveLink, sameItem, treesInScope } from "./esq-run-inputs";
import { solveInputsKey } from "./esq-solve-inputs";

type EsqSamplingLaw =
  | { type: "POINT"; value: number }
  | { type: "LOGNORMAL"; median: number; errorFactor: number }
  | { type: "NORMAL"; mean: number; standardDeviation: number }
  | { type: "GAMMA"; shape: number; rate: number }
  | { type: "BETA"; alpha: number; beta: number }
  | { type: "UNIFORM"; lower: number; upper: number }
  | { type: "EXPONENTIAL"; rate: number };

type EsqImportanceGroupKind = "PARAMETER" | "HFE" | "CCF_GROUP" | "SYSTEM";

interface EsqImportanceGroup {
  key: string;
  kind: EsqImportanceGroupKind;
  ref: string;
  label: string;
  events: string[];
  ccfGroups: string[];
}

type EsqSampledInputKind = "PARAMETER" | "HFE" | "EVENT" | "RECOVERY" | "CCF_GROUP" | "INITIATOR" | "SPLIT" | "CELL";

type EsqLawSource = "DA" | "IE" | "STEP_02" | "STEP_04" | "STEP_06" | "TYPED";

interface EsqSampledInput {
  key: string;
  kind: EsqSampledInputKind;
  ref: string;
  label: string;
  point?: number;
  rate: boolean;
  law?: EsqSamplingLaw;
  source?: EsqLawSource;
  missing?: string;
  users: string[];
}

interface EsqHolder {
  heldBy: "DA" | "HRA" | "TYPED";
  holderId?: string;
}

const Z95 = 1.6448536269514722;

const PROBABILITY_TYPES = new Set(["PROBABILITY", "UNAVAILABILITY", "HUMAN_ERROR_PROBABILITY"]);

const RATE_TYPES = new Set(["FAILURE_RATE", "FREQUENCY"]);

function finitePositive(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value) && value > 0;
}

function lognormalAroundMean(mean: number, errorFactor: number): EsqSamplingLaw {
  const sigma = Math.log(errorFactor) / Z95;
  return { type: "LOGNORMAL", median: mean / Math.exp((sigma * sigma) / 2), errorFactor };
}

function lawMean(law: EsqSamplingLaw): number {
  switch (law.type) {
    case "POINT": return law.value;
    case "LOGNORMAL": {
      const sigma = Math.log(law.errorFactor) / Z95;
      return law.median * Math.exp((sigma * sigma) / 2);
    }
    case "NORMAL": return law.mean;
    case "GAMMA": return law.shape / law.rate;
    case "BETA": return law.alpha / (law.alpha + law.beta);
    case "UNIFORM": return (law.lower + law.upper) / 2;
    case "EXPONENTIAL": return 1 / law.rate;
  }
}

function lawFromDistribution(distribution: ParameterDistribution | undefined): EsqSamplingLaw | undefined {
  if (distribution === undefined) return undefined;
  switch (distribution.type) {
    case DistributionType.LOGNORMAL:
      return finitePositive(distribution.median) && Number.isFinite(distribution.errorFactor) && distribution.errorFactor >= 1 ? { type: "LOGNORMAL", median: distribution.median, errorFactor: distribution.errorFactor } : undefined;
    case DistributionType.BETA:
      return finitePositive(distribution.alpha) && finitePositive(distribution.betaParam) ? { type: "BETA", alpha: distribution.alpha, beta: distribution.betaParam } : undefined;
    case DistributionType.GAMMA:
      return finitePositive(distribution.shape) && finitePositive(distribution.rate) ? { type: "GAMMA", shape: distribution.shape, rate: distribution.rate } : undefined;
    case DistributionType.NORMAL:
      return Number.isFinite(distribution.mean) && Number.isFinite(distribution.stdDev) && distribution.stdDev >= 0 ? { type: "NORMAL", mean: distribution.mean, standardDeviation: distribution.stdDev } : undefined;
    case DistributionType.UNIFORM:
      return Number.isFinite(distribution.lower) && Number.isFinite(distribution.upper) && distribution.lower < distribution.upper ? { type: "UNIFORM", lower: distribution.lower, upper: distribution.upper } : undefined;
    case DistributionType.EXPONENTIAL:
      return finitePositive(distribution.failureRate) ? { type: "EXPONENTIAL", rate: distribution.failureRate } : undefined;
    default:
      return undefined;
  }
}

function lawPercentile(law: EsqSamplingLaw, z: number): number | undefined {
  if (law.type === "POINT") return law.value;
  if (law.type === "LOGNORMAL") return law.median * Math.exp((z * Math.log(law.errorFactor)) / Z95);
  if (law.type === "NORMAL") return law.mean + z * law.standardDeviation;
  return undefined;
}

function holderOf(esq: EventSequenceQuantification, model: EsqModel, eventId: string): EsqHolder {
  const binding = esq.modelDecisions?.valueBindings?.find((entry) => entry.eventId === eventId);
  if (binding !== undefined) return { heldBy: binding.heldBy, holderId: binding.holderId };
  const record = model.events.find((event) => event.id === eventId);
  const holder: EsqHolder = { heldBy: record?.heldBy ?? "TYPED" };
  if (record?.holderId !== undefined) holder.holderId = record.holderId;
  return holder;
}

function spreadOf(esq: EventSequenceQuantification, key: string): EsqSpread | undefined {
  return esq.uncertaintyWork?.spreads?.find((entry) => entry.key === key);
}

function ccfParameterOf(esq: EventSequenceQuantification, model: EsqModel, group: EsqCcfRecord): string | undefined {
  const parameters = new Set(group.memberIds.map((memberId) => {
    const holder = holderOf(esq, model, memberId);
    return holder.heldBy === "DA" ? holder.holderId ?? "" : "";
  }));
  if (parameters.size !== 1) return undefined;
  const [only] = [...parameters];
  return only === undefined || only.length === 0 ? undefined : only;
}

function eventInputKey(esq: EventSequenceQuantification, model: EsqModel, eventId: string): string {
  const holder = holderOf(esq, model, eventId);
  if (holder.heldBy === "DA" && holder.holderId !== undefined) return `PARAMETER:${holder.holderId}`;
  if (holder.heldBy === "HRA" && holder.holderId !== undefined) return `HFE:${holder.holderId}`;
  return `EVENT:${eventId}`;
}

function ccfInputKey(esq: EventSequenceQuantification, model: EsqModel, groupId: string): string {
  const group = model.ccfGroups.find((entry) => entry.id === groupId);
  const parameter = group === undefined ? undefined : ccfParameterOf(esq, model, group);
  return parameter === undefined ? `CCF_GROUP:${groupId}` : `PARAMETER:${parameter}`;
}

function initiatorInputKey(esq: EventSequenceQuantification, groupId: string): string {
  const choice = esq.modelDecisions?.initiatorChoices?.find((entry) => sameItem(entry.groupId, groupId));
  if (choice?.source === "DA" && choice.parameterId !== undefined) return `PARAMETER:${choice.parameterId}`;
  return `INITIATOR:${groupId}`;
}

function splitInputKey(functionId: string, target: EsqSplitFractionTarget): string {
  if (target.cellId !== undefined) return `CELL:${target.cellId}`;
  if (target.parameterId !== undefined) return `PARAMETER:${target.parameterId}`;
  return `SPLIT:${functionId}:${String(target.value ?? "")}`;
}

function withSpread(esq: EventSequenceQuantification, input: EsqSampledInput, missing: string): EsqSampledInput {
  if (input.law !== undefined) return input;
  const spread = spreadOf(esq, input.key);
  if (spread !== undefined && finitePositive(input.point) && Number.isFinite(spread.errorFactor) && spread.errorFactor >= 1) {
    return { ...input, law: lognormalAroundMean(input.point, spread.errorFactor), source: "TYPED" };
  }
  return { ...input, missing };
}

function sampledInputsOf(esq: EventSequenceQuantification): EsqSampledInput[] {
  const model = esq.model;
  if (model === undefined) return [];
  const inputs = new Map<string, EsqSampledInput>();
  const use = (input: EsqSampledInput, user: string): void => {
    const known = inputs.get(input.key);
    if (known !== undefined) {
      if (!known.users.includes(user)) known.users.push(user);
      return;
    }
    inputs.set(input.key, { ...input, users: [user] });
  };
  const parameterInput = (parameterId: string): EsqSampledInput => {
    const parameter = model.parameters.find((entry) => entry.id === parameterId);
    const input: EsqSampledInput = {
      key: `PARAMETER:${parameterId}`,
      kind: "PARAMETER",
      ref: parameterId,
      label: parameter === undefined ? parameterId : `${parameter.name} (${parameterId})`,
      rate: parameter !== undefined && RATE_TYPES.has(parameter.parameterType),
      users: [],
    };
    if (parameter?.value !== undefined) input.point = parameter.value;
    const law = lawFromDistribution(parameter?.distribution);
    if (law !== undefined) {
      input.law = law;
      input.source = "DA";
    }
    return withSpread(esq, input, "DA gives no distribution. Type an error factor or add one in DA.");
  };
  for (const event of model.events) {
    const holder = holderOf(esq, model, event.id);
    const user = `event:${event.id}`;
    if (holder.heldBy === "DA" && holder.holderId !== undefined) {
      use(parameterInput(holder.holderId), user);
      continue;
    }
    if (holder.heldBy === "HRA" && holder.holderId !== undefined) {
      const human = model.humanEvents.find((entry) => entry.id === holder.holderId);
      const input: EsqSampledInput = { key: `HFE:${holder.holderId}`, kind: "HFE", ref: holder.holderId, label: human === undefined ? holder.holderId : `${human.name} (${holder.holderId})`, rate: false, users: [] };
      if (human?.value !== undefined) input.point = human.value;
      use(withSpread(esq, input, "HR gives no distribution. Type an error factor."), user);
      continue;
    }
    const input: EsqSampledInput = { key: `EVENT:${event.id}`, kind: "EVENT", ref: event.id, label: event.name.length > 0 ? `${event.code} · ${event.name}` : event.code, rate: event.valueUnit === "PER_HOUR", users: [] };
    if (event.value !== undefined) input.point = event.value;
    use(withSpread(esq, input, "SY types this value without a distribution. Type an error factor."), user);
  }
  for (const group of model.ccfGroups) {
    const parameter = ccfParameterOf(esq, model, group);
    if (parameter !== undefined) {
      use(parameterInput(parameter), `ccf:${group.id}`);
      continue;
    }
    const input: EsqSampledInput = { key: `CCF_GROUP:${group.id}`, kind: "CCF_GROUP", ref: group.id, label: `${group.name} (${group.id})`, rate: false, users: [] };
    if (group.totalProbability !== undefined) input.point = group.totalProbability;
    use(withSpread(esq, input, "The members take their values from different sources. Type an error factor for the group total."), `ccf:${group.id}`);
  }
  for (const recovery of resolvedRecoveries(esq)) {
    if (!recovery.credited) continue;
    const input: EsqSampledInput = { key: `RECOVERY:${recovery.id}`, kind: "RECOVERY", ref: recovery.id, label: `NR-${recovery.id}${recovery.name.length > 0 ? ` · ${recovery.name}` : ""}`, rate: false, users: [] };
    if (recovery.value !== undefined) input.point = recovery.value;
    const typed = recovery.rule?.typed;
    if (recovery.source === "TYPED" && typed?.errorFactor !== undefined && typed.errorFactor >= 1 && finitePositive(typed.value)) {
      input.law = lognormalAroundMean(typed.value, typed.errorFactor);
      input.source = "STEP_06";
    }
    use(withSpread(esq, input, "HR gives no distribution for this recovery. Type an error factor."), `recovery:${recovery.id}`);
  }
  const roots = treesInScope(esq, model).filter((tree) => !tree.transferEntry);
  for (const groupId of [...new Set(roots.map((tree) => tree.initiatorId))]) {
    const key = initiatorInputKey(esq, groupId);
    if (key.startsWith("PARAMETER:")) {
      use(parameterInput(key.slice("PARAMETER:".length)), `initiator:${groupId}`);
      continue;
    }
    const view = groupFrequency(esq, model, groupId, roots);
    const record = model.initiators.find((entry) => sameItem(entry.id, groupId));
    const input: EsqSampledInput = { key, kind: "INITIATOR", ref: groupId, label: `${record?.name ?? groupId} (${groupId})`, rate: true, users: [] };
    if (view.rawMean !== undefined) input.point = view.rawMean;
    if (view.source === "IE" && finitePositive(record?.medianFrequency) && record?.errorFactor !== undefined && record.errorFactor >= 1) {
      input.law = { type: "LOGNORMAL", median: record.medianFrequency, errorFactor: record.errorFactor };
      input.source = "IE";
    } else if (view.source === "TYPED" && finitePositive(view.rawMean) && view.errorFactor !== undefined && view.errorFactor >= 1) {
      input.law = lognormalAroundMean(view.rawMean, view.errorFactor);
      input.source = "STEP_02";
    }
    use(withSpread(esq, input, "The initiator frequency has no distribution. Type an error factor."), `initiator:${groupId}`);
  }
  for (const record of model.functions) {
    for (const tree of roots) {
      const target = resolveLink(record, functionLinkOf(esq, record.id), tree).target;
      if (target?.kind !== "SPLIT_FRACTION") continue;
      const key = splitInputKey(record.id, target);
      const user = `split:${record.id}`;
      if (key.startsWith("PARAMETER:")) {
        use(parameterInput(key.slice("PARAMETER:".length)), user);
        continue;
      }
      if (target.cellId !== undefined) {
        const cell = cellOf(esq, target.cellId);
        const input: EsqSampledInput = { key, kind: "CELL", ref: target.cellId, label: `Cell ${target.cellId}`, rate: false, users: [] };
        const run = cell?.ofRecord === "RUN" ? cell.run : undefined;
        const typed = cell?.ofRecord === "TYPED" ? cell.typed : undefined;
        const value = typed?.value ?? run?.mean ?? run?.point;
        if (value !== undefined) input.point = value;
        if (run !== undefined && finitePositive(run.p05) && finitePositive(run.p95) && finitePositive(run.p50) && run.p95 > run.p05) {
          input.law = { type: "LOGNORMAL", median: run.p50, errorFactor: Math.sqrt(run.p95 / run.p05) };
          input.source = "STEP_04";
        } else if (typed?.errorFactor !== undefined && typed.errorFactor >= 1 && finitePositive(typed.value)) {
          input.law = lognormalAroundMean(typed.value, typed.errorFactor);
          input.source = "STEP_04";
        }
        use(withSpread(esq, input, "The cell has no sampled run or typed error factor."), user);
        continue;
      }
      const input: EsqSampledInput = { key, kind: "SPLIT", ref: record.id, label: `${record.name} split fraction`, rate: false, users: [] };
      if (target.value !== undefined) input.point = target.value;
      if (finitePositive(target.value) && target.errorFactor !== undefined && target.errorFactor >= 1) {
        input.law = lognormalAroundMean(target.value, target.errorFactor);
        input.source = "STEP_02";
      }
      use(withSpread(esq, input, "The typed split fraction has no error factor."), user);
    }
  }
  return [...inputs.values()];
}

function importanceGroupsOf(esq: EventSequenceQuantification): EsqImportanceGroup[] {
  const model = esq.model;
  if (model === undefined) return [];
  const members = new Map(model.ccfGroups.flatMap((group) => group.memberIds.map((memberId) => [memberId, group.id] as const)));
  const groups = new Map<string, EsqImportanceGroup>();
  const slot = (kind: EsqImportanceGroupKind, ref: string, label: string): EsqImportanceGroup => {
    const key = `${kind}:${ref}`;
    const known = groups.get(key);
    if (known !== undefined) return known;
    const group: EsqImportanceGroup = { key, kind, ref, label, events: [], ccfGroups: [] };
    groups.set(key, group);
    return group;
  };
  const addEvent = (group: EsqImportanceGroup, eventId: string): void => {
    const ccf = members.get(eventId);
    if (ccf !== undefined) {
      if (!group.ccfGroups.includes(ccf)) group.ccfGroups.push(ccf);
      return;
    }
    if (!group.events.includes(eventId)) group.events.push(eventId);
  };
  for (const event of model.events) {
    const holder = holderOf(esq, model, event.id);
    if (holder.heldBy === "DA" && holder.holderId !== undefined) {
      const parameter = model.parameters.find((entry) => entry.id === holder.holderId);
      addEvent(slot("PARAMETER", holder.holderId, parameter === undefined ? holder.holderId : `${parameter.name} (${holder.holderId})`), event.id);
    }
    if (holder.heldBy === "HRA" && holder.holderId !== undefined) {
      const human = model.humanEvents.find((entry) => entry.id === holder.holderId);
      const group = slot("HFE", holder.holderId, human === undefined ? holder.holderId : `${human.name} (${holder.holderId})`);
      addEvent(group, event.id);
      const independent = esqIndependentEventId(event.id);
      if (!group.events.includes(independent)) group.events.push(independent);
    }
    if (event.systemId !== undefined) addEvent(slot("SYSTEM", event.systemId, event.systemName === undefined ? event.systemId : `${event.systemName} (${event.systemId})`), event.id);
  }
  for (const group of model.ccfGroups) slot("CCF_GROUP", group.id, `${group.name} (${group.id})`).ccfGroups.push(group.id);
  return [...groups.values()].filter((group) => group.events.length > 0 || group.ccfGroups.length > 0);
}

function esqImportanceRunId(): string {
  return esqStableId("importance-run");
}

function esqUncertaintyRunId(): string {
  return esqStableId("uncertainty-run");
}

function uncertaintyInputsKey(esq: EventSequenceQuantification): string {
  const spreads = [...(esq.uncertaintyWork?.spreads ?? [])].sort((a, b) => a.key.localeCompare(b.key)).map((entry) => [entry.key, entry.errorFactor]);
  const text = `${solveInputsKey(esq)}|${JSON.stringify(spreads)}`;
  return `${hash32(text, 2166136261).toString(16).padStart(8, "0")}${hash32(text, 374761393).toString(16).padStart(8, "0")}`;
}

export {
  PROBABILITY_TYPES,
  esqImportanceRunId,
  esqUncertaintyRunId,
  uncertaintyInputsKey,
  ccfInputKey,
  eventInputKey,
  importanceGroupsOf,
  initiatorInputKey,
  lawFromDistribution,
  lawMean,
  lawPercentile,
  lognormalAroundMean,
  sampledInputsOf,
  splitInputKey,
};
export type { EsqImportanceGroup, EsqImportanceGroupKind, EsqLawSource, EsqSampledInput, EsqSampledInputKind, EsqSamplingLaw };
