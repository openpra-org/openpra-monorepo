import { ccfFactorExpressions, ccfFactorVector, type CcfFactorModel, type UncertainExpression, type UncertainUnit } from "../core/uncertainty";
import { legacyDistributionExpression, legacyExpression } from "../core/legacy-uncertainty-adapter";
import { holdsEstimate } from "../da/data-analysis";
import { carriesUncertainExpression } from "../sy/systems-analysis";
import type {
  EsqCcfRecord,
  EsqModel,
  EsqParameterRecord,
  EsqSpread,
  EsqSplitFractionTarget,
  EventSequenceQuantification,
} from "./event-sequence-quantification";
import { cellExpressionOfRecord, cellOf } from "./esq-barrier-inputs";
import { esqIndependentEventId, resolvedRecoveries } from "./esq-post-inputs";
import { esqStableId, functionLinkOf, groupFrequency, hash32, resolveLink, sameItem, treesInScope } from "./esq-run-inputs";
import { solveInputsKey } from "./esq-solve-inputs";

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

type EsqLawSource = "DA" | "SY" | "IE" | "STEP_02" | "STEP_04" | "STEP_06" | "TYPED";

interface EsqLegacyValue {
  point: number;
  errorFactor?: number;
}

interface EsqSampledInput {
  key: string;
  kind: EsqSampledInputKind;
  ref: string;
  label: string;
  unit: UncertainUnit;
  expression?: UncertainExpression;
  contract: boolean;
  uncertain: boolean;
  legacy?: EsqLegacyValue;
  source?: EsqLawSource;
  missing?: string;
  users: string[];
}

interface EsqHolder {
  heldBy: "DA" | "HRA" | "TYPED";
  holderId?: string;
}

const PROBABILITY_TYPES = new Set(["PROBABILITY", "UNAVAILABILITY", "HUMAN_ERROR_PROBABILITY"]);

const RATE_TYPES = new Set(["FAILURE_RATE", "FREQUENCY"]);

const RATE_MODELS = new Set(["RUNNING_RATE", "STANDBY_RATE"]);

function finitePositive(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value) && value > 0;
}

function parameterUnit(parameter: EsqParameterRecord | undefined): UncertainUnit {
  if (parameter === undefined) return "PROBABILITY";
  if (parameter.quantificationModel !== undefined && RATE_MODELS.has(parameter.quantificationModel)) return "PER_HOUR";
  if (parameter.parameterType === "FREQUENCY") return "PER_YEAR";
  if (parameter.parameterType === "FAILURE_RATE") return "PER_HOUR";
  return "PROBABILITY";
}

function hasUncertainty(expression: UncertainExpression): boolean {
  switch (expression.node) {
    case "VALUE":
      return expression.value.law.family !== "POINT";
    case "PARAMETER":
      return true;
    case "OPERATION":
      return expression.operands.some(hasUncertainty);
    case "MODEL":
      return Object.values(expression.model).some((argument) => typeof argument === "object" && hasUncertainty(argument));
  }
}

function factorsUncertain(factors: CcfFactorModel): boolean {
  const vector = ccfFactorVector(factors);
  if (vector !== undefined && (vector.node === "PARAMETER" || vector.law.family === "DIRICHLET")) return true;
  return ccfFactorExpressions(factors).some(hasUncertainty);
}

function legacyInput(esq: EventSequenceQuantification, input: EsqSampledInput, legacy: EsqLegacyValue | undefined, missing: string): EsqSampledInput {
  if (legacy === undefined) return { ...input, missing };
  const spread = spreadOf(esq, input.key);
  const errorFactor = legacy.errorFactor ?? (spread !== undefined && Number.isFinite(spread.errorFactor) && spread.errorFactor >= 1 ? spread.errorFactor : undefined);
  const expression = legacyExpression(input.unit, legacy.point, errorFactor);
  const next: EsqSampledInput = { ...input, legacy: { ...legacy, ...(errorFactor === undefined ? {} : { errorFactor }) }, expression, uncertain: hasUncertainty(expression) };
  if (legacy.errorFactor === undefined && errorFactor !== undefined) next.source = "TYPED";
  if (errorFactor === undefined || !(errorFactor > 1)) next.missing = missing;
  return next;
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
      unit: parameterUnit(parameter),
      contract: parameter !== undefined && holdsEstimate(parameter.quantificationModel),
      uncertain: false,
      users: [],
    };
    if (input.contract) {
      if (parameter?.estimate === undefined) return { ...input, missing: "DA gives this parameter no estimate." };
      const next: EsqSampledInput = { ...input, expression: parameter.estimate, uncertain: hasUncertainty(parameter.estimate), source: "DA" };
      if (!next.uncertain) next.missing = "DA gives this estimate no uncertainty. Give it a law in DA.";
      return next;
    }
    const legacy = parameter?.distribution === undefined ? undefined : legacyDistributionExpression(input.unit, parameter.distribution);
    if (legacy !== undefined && parameter?.value !== undefined) return { ...input, expression: legacy, uncertain: hasUncertainty(legacy), legacy: { point: parameter.value }, source: "DA" };
    return legacyInput(esq, input, parameter?.value === undefined ? undefined : { point: parameter.value }, "DA gives no distribution. Type an error factor or add one in DA.");
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
      const input: EsqSampledInput = { key: `HFE:${holder.holderId}`, kind: "HFE", ref: holder.holderId, label: human === undefined ? holder.holderId : `${human.name} (${holder.holderId})`, unit: "PROBABILITY", contract: false, uncertain: false, users: [] };
      use(legacyInput(esq, input, human?.value === undefined ? undefined : { point: human.value }, "HR gives no distribution. Type an error factor."), user);
      continue;
    }
    const input: EsqSampledInput = { key: `EVENT:${event.id}`, kind: "EVENT", ref: event.id, label: event.name.length > 0 ? `${event.code} · ${event.name}` : event.code, unit: "PROBABILITY", contract: carriesUncertainExpression(event.failureMode), uncertain: false, users: [] };
    if (input.contract) {
      if (event.expression === undefined) {
        use({ ...input, missing: "SY gives this event no value." }, user);
        continue;
      }
      const next: EsqSampledInput = { ...input, expression: event.expression, uncertain: hasUncertainty(event.expression), source: "SY" };
      if (!next.uncertain) next.missing = "SY types this value without uncertainty. Give it a law in SY.";
      use(next, user);
      continue;
    }
    use(legacyInput(esq, input, event.value === undefined || event.valueUnit === "PER_HOUR" ? undefined : { point: event.value }, "SY types this value without a distribution. Type an error factor."), user);
  }
  for (const group of model.ccfGroups) {
    const parameter = ccfParameterOf(esq, model, group);
    if (parameter !== undefined) {
      use(parameterInput(parameter), `ccf:${group.id}`);
      continue;
    }
    const input: EsqSampledInput = { key: `CCF_GROUP:${group.id}`, kind: "CCF_GROUP", ref: group.id, label: `${group.name} (${group.id})`, unit: "PROBABILITY", contract: true, uncertain: false, users: [] };
    if (group.total === undefined || group.factors === undefined) {
      use({ ...input, missing: "SY gives this group no total or no factors. Complete the group in SY and import again." }, `ccf:${group.id}`);
      continue;
    }
    const next: EsqSampledInput = { ...input, expression: group.total, uncertain: hasUncertainty(group.total) || factorsUncertain(group.factors), source: "SY" };
    if (!next.uncertain) next.missing = "SY gives this group total and its factors no uncertainty. Give them a law in SY or DA.";
    use(next, `ccf:${group.id}`);
  }
  for (const recovery of resolvedRecoveries(esq)) {
    if (!recovery.credited) continue;
    const input: EsqSampledInput = { key: `RECOVERY:${recovery.id}`, kind: "RECOVERY", ref: recovery.id, label: `NR-${recovery.id}${recovery.name.length > 0 ? ` · ${recovery.name}` : ""}`, unit: "PROBABILITY", contract: false, uncertain: false, users: [] };
    const typed = recovery.rule?.typed;
    const stated = recovery.source === "TYPED" && typed?.errorFactor !== undefined && typed.errorFactor >= 1 && finitePositive(typed.value);
    const legacy = stated && typed !== undefined && typed.value !== undefined ? { point: typed.value, errorFactor: typed.errorFactor } : recovery.value === undefined ? undefined : { point: recovery.value };
    const built = legacyInput(esq, input, legacy, "HR gives no distribution for this recovery. Type an error factor.");
    use(stated ? { ...built, source: "STEP_06" } : built, `recovery:${recovery.id}`);
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
    const input: EsqSampledInput = { key, kind: "INITIATOR", ref: groupId, label: `${record?.name ?? groupId} (${groupId})`, unit: "PER_YEAR", contract: true, uncertain: false, users: [] };
    if (view.given === undefined) {
      use({ ...input, missing: "The initiator group has no frequency. Take it from IE or DA, or type it in Step 02." }, `initiator:${groupId}`);
      continue;
    }
    const fromIe = view.source === "IE";
    const next: EsqSampledInput = { ...input, expression: view.given, uncertain: hasUncertainty(view.given), source: fromIe ? "IE" : "STEP_02" };
    if (!next.uncertain) next.missing = fromIe ? "IE gives this frequency no uncertainty. Give it a law in IE." : "The typed frequency has no uncertainty. Give it a law in Step 02.";
    use(next, `initiator:${groupId}`);
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
        const input: EsqSampledInput = { key, kind: "CELL", ref: target.cellId, label: `Cell ${target.cellId}`, unit: "PROBABILITY", contract: true, uncertain: false, users: [] };
        const expression = cell === undefined ? undefined : cellExpressionOfRecord(cell);
        if (cell === undefined || expression === undefined) {
          use({ ...input, missing: "The cell has no value of record. Run it or type its value in Step 04." }, user);
          continue;
        }
        const next: EsqSampledInput = { ...input, expression, uncertain: hasUncertainty(expression), source: "STEP_04" };
        if (!next.uncertain) next.missing = cell.ofRecord === "RUN" ? "The cell run of record has no sampled law. Make a load or capacity field uncertain and run it again in Step 04." : "The typed cell value has no uncertainty. Give it a law in Step 04.";
        use(next, user);
        continue;
      }
      const input: EsqSampledInput = { key, kind: "SPLIT", ref: record.id, label: `${record.name} split fraction`, unit: "PROBABILITY", contract: false, uncertain: false, users: [] };
      const stated = finitePositive(target.value) && target.errorFactor !== undefined && target.errorFactor >= 1;
      const legacy = target.value === undefined ? undefined : { point: target.value, ...(stated ? { errorFactor: target.errorFactor } : {}) };
      const built = legacyInput(esq, input, legacy, "The typed split fraction has no error factor.");
      use(stated ? { ...built, source: "STEP_02" } : built, user);
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
  RATE_TYPES,
  esqImportanceRunId,
  esqUncertaintyRunId,
  factorsUncertain,
  hasUncertainty,
  holderOf,
  uncertaintyInputsKey,
  ccfInputKey,
  eventInputKey,
  importanceGroupsOf,
  initiatorInputKey,
  parameterUnit,
  sampledInputsOf,
  splitInputKey,
};
export type { EsqImportanceGroup, EsqImportanceGroupKind, EsqLawSource, EsqLegacyValue, EsqSampledInput, EsqSampledInputKind };
