import {
  carriesUncertainExpression,
  type CommonCauseFailureGroup,
  type SystemBasicEvent,
  type SystemLogicModel,
  type SystemsAnalysis,
} from "interfaces-mef-types/sy/systems-analysis";
import {
  canonicalJson,
  ccfFactorExpressions,
  ccfFactorVector,
  ccfModelTakesTotal,
  expressionReferences,
  parameterReferenceKey,
  type CcfFactorModel,
  type UncertainExpression,
  type UncertainVector,
} from "interfaces-mef-types/core/uncertainty";
import { systemLogicModelBasicEvents } from "interfaces-mef-types/sy/system-models";
import { ccfFactorDraft } from "../newly-developed-methods/shared/uncertainEditor";
import { expressionText } from "../newly-developed-methods/shared/uncertainText";
import { CCF_MODELS, SHARED_CAUSE_KEYS, SHARED_CAUSE_LABELS } from "./syViewData";
import type { SyControlledCcfEstimateOption, SyControlledCcfVectorOption } from "./syWorkbookContext";

interface CcfGroupIssue {
  code: string;
  message: string;
  severity: "ERROR" | "WARNING";
}

type ParameterLabel = (key: string) => string;

type CcfAnalysis = Pick<SystemsAnalysis, "systemDefinitions" | "systemBasicEvents" | "commonCauseFailureGroups">;

const MGL_LETTERS: readonly string[] = ["β", "γ", "δ"];

const SUM_TOLERANCE = 1e-6;

function ownKey(key: string): string {
  return key;
}

function formatFactor(value: number): string {
  return String(Number(value.toPrecision(5)));
}

function mglLetter(index: number): string {
  return MGL_LETTERS[index] ?? `Factor ${index + 2}`;
}

function pointOf(expression: UncertainExpression): number | null {
  return expression.node === "VALUE" && expression.value.law.family === "POINT" ? expression.value.law.value : null;
}

function factorExpressionText(expression: UncertainExpression, label: ParameterLabel): string {
  const point = pointOf(expression);
  return point === null ? expressionText(expression, label) : formatFactor(point);
}

function vectorText(symbol: string, vector: UncertainVector, label: ParameterLabel): string {
  if (vector.node === "PARAMETER") return `${symbol} ${label(parameterReferenceKey(vector.reference))}`;
  const law = vector.law;
  if (law.family === "DIRICHLET") return `${symbol} Dirichlet (${law.concentrations.map(formatFactor).join(", ")})`;
  if (law.family === "WEIGHTED_DIRICHLET") return `${symbol} weighted Dirichlet (${law.concentrations.map(formatFactor).join(", ")}; weights ${law.weights.map(formatFactor).join(", ")})`;
  return law.values.map((value, index) => `${symbol}${index + 1} ${formatFactor(value)}`).join(" · ");
}

function ccfFactorText(factors: CcfFactorModel, label: ParameterLabel = ownKey): string {
  switch (factors.model) {
    case "BETA_FACTOR":
      return `β ${factorExpressionText(factors.beta, label)}`;
    case "MGL":
      return factors.factors.map((factor, index) => `${mglLetter(index)} ${factorExpressionText(factor, label)}`).join(" · ");
    case "ALPHA_FACTOR":
      return vectorText("α", factors.alphas, label);
    case "PHI_FACTOR":
      return vectorText("φ", factors.phis, label);
    case "BINOMIAL_FAILURE_RATE":
      return [
        `Qᵢ ${factorExpressionText(factors.independent, label)}`,
        `μ ${factorExpressionText(factors.nonLethalShock, label)}`,
        `p ${factorExpressionText(factors.componentFailure, label)}`,
        `ω ${factorExpressionText(factors.lethalShock, label)}`,
      ].join(" · ");
  }
}

function ccfModelText(factors: CcfFactorModel): string {
  const label = CCF_MODELS[factors.model].label;
  if (factors.model !== "ALPHA_FACTOR") return label;
  return `${label}, ${factors.testing === "STAGGERED" ? "staggered" : "non-staggered"} testing`;
}

function sharedCauseLines(group: CommonCauseFailureGroup): string[] {
  const shared = group.sharedCauseFactors ?? {};
  return [...SHARED_CAUSE_KEYS.filter((key) => shared[key] === true).map((key) => SHARED_CAUSE_LABELS[key]), ...(shared.otherFactors ?? [])];
}

function linkedEstimate(group: CommonCauseFailureGroup, estimates: readonly SyControlledCcfEstimateOption[]): SyControlledCcfEstimateOption | undefined {
  const reference = group.dataAnalysisCCFParameterRef;
  return reference === undefined ? undefined : estimates.find((estimate) => estimate.estimateId === reference);
}

function matchesEstimate(group: CommonCauseFailureGroup, estimate: SyControlledCcfEstimateOption): boolean {
  return canonicalJson(group.factors) === canonicalJson(estimate.factors);
}

function factorLinks(factors: CcfFactorModel): string[] {
  const vector = ccfFactorVector(factors);
  return [...(vector?.node === "PARAMETER" ? [vector.reference] : []), ...ccfFactorExpressions(factors).flatMap(expressionReferences)].map(parameterReferenceKey);
}

function uniqueMemberIds(group: CommonCauseFailureGroup): string[] {
  return [...new Set(group.members?.basicEvents.map(({ id }) => id) ?? [])];
}

function memberEvents(group: CommonCauseFailureGroup, analysis: Pick<SystemsAnalysis, "systemBasicEvents">): SystemBasicEvent[] {
  const eventById = new Map(analysis.systemBasicEvents.map((event) => [event.uuid, event]));
  return (group.members?.basicEvents ?? []).flatMap(({ id }) => {
    const event = eventById.get(id);
    return event === undefined ? [] : [event];
  });
}

function memberValueKeys(group: CommonCauseFailureGroup, analysis: Pick<SystemsAnalysis, "systemBasicEvents">): string[] {
  const keys = memberEvents(group, analysis).flatMap((event) => {
    if (carriesUncertainExpression(event.failureMode)) return event.expression === undefined ? [] : [canonicalJson(event.expression)];
    return event.probability === undefined ? [] : [`probability:${event.probability}`];
  });
  return [...new Set(keys)];
}

function sharedMemberExpression(group: CommonCauseFailureGroup, analysis: Pick<SystemsAnalysis, "systemBasicEvents">): UncertainExpression | null {
  const members = memberEvents(group, analysis);
  const first = members[0]?.expression;
  if (first === undefined) return null;
  const key = canonicalJson(first);
  const shared = members.every((event) => carriesUncertainExpression(event.failureMode) && event.expression !== undefined && canonicalJson(event.expression) === key);
  return shared ? first : null;
}

const NO_TOTAL: UncertainExpression = { node: "VALUE", value: { unit: "PROBABILITY", law: { family: "POINT", value: 0 } } };

function groupTotal(group: CommonCauseFailureGroup, analysis: Pick<SystemsAnalysis, "systemBasicEvents">): UncertainExpression | undefined {
  if (!ccfModelTakesTotal(group.factors)) return undefined;
  return sharedMemberExpression(group, analysis) ?? group.total;
}

function withoutTotal(group: CommonCauseFailureGroup): CommonCauseFailureGroup {
  if (group.total === undefined) return group;
  const next = { ...group };
  delete next.total;
  return next;
}

function withMemberTotal(group: CommonCauseFailureGroup, analysis: Pick<SystemsAnalysis, "systemBasicEvents">): CommonCauseFailureGroup {
  if (!ccfModelTakesTotal(group.factors)) return withoutTotal(group);
  const total = sharedMemberExpression(group, analysis) ?? group.total ?? NO_TOTAL;
  return group.total !== undefined && canonicalJson(total) === canonicalJson(group.total) ? group : { ...group, total };
}

function withMemberTotals<T extends Pick<SystemsAnalysis, "systemBasicEvents" | "commonCauseFailureGroups">>(analysis: T, eventIds: ReadonlySet<string>): T {
  const groups = analysis.commonCauseFailureGroups.map((group) => (
    (group.members?.basicEvents ?? []).some(({ id }) => eventIds.has(id)) ? withMemberTotal(group, analysis) : group
  ));
  return groups.some((group, index) => group !== analysis.commonCauseFailureGroups[index])
    ? { ...analysis, commonCauseFailureGroups: groups }
    : analysis;
}

type VectorLengths = ReadonlyMap<string, number>;

function vectorLength(vector: UncertainVector, lengths: VectorLengths): number | null {
  if (vector.node === "PARAMETER") return lengths.get(parameterReferenceKey(vector.reference)) ?? null;
  return vector.law.family === "FIXED" ? vector.law.values.length : vector.law.concentrations.length;
}

const NO_LENGTHS: VectorLengths = new Map();

function vectorLengths(options: readonly SyControlledCcfVectorOption[]): VectorLengths {
  return new Map(options.map((option) => [parameterReferenceKey(option.reference), option.length]));
}

function factorsFit(factors: CcfFactorModel, size: number): boolean {
  switch (factors.model) {
    case "BETA_FACTOR":
      return true;
    case "MGL":
      return factors.factors.length >= 1 && factors.factors.length <= Math.max(1, size - 1);
    case "ALPHA_FACTOR": {
      const length = vectorLength(factors.alphas, NO_LENGTHS);
      return length === null || length === size;
    }
    case "PHI_FACTOR": {
      const length = vectorLength(factors.phis, NO_LENGTHS);
      return length === null || length === size;
    }
    case "BINOMIAL_FAILURE_RATE":
      return true;
  }
}

function fittedFactors(factors: CcfFactorModel, size: number): CcfFactorModel {
  if (size < 2 || factorsFit(factors, size)) return factors;
  return ccfFactorDraft(factors.model, size, factors.model === "ALPHA_FACTOR" ? factors.testing : "NON_STAGGERED");
}

function rangeIssue(expression: UncertainExpression, label: string): CcfGroupIssue | null {
  const point = pointOf(expression);
  return point === null || (Number.isFinite(point) && point >= 0 && point <= 1)
    ? null
    : { code: "CCF_FACTOR_RANGE", severity: "ERROR", message: `${label} must be between 0 and 1.` };
}

function vectorIssues(vector: UncertainVector, symbol: string, prefix: "ALPHA" | "PHI"): CcfGroupIssue[] {
  if (vector.node === "PARAMETER" || vector.law.family !== "FIXED") return [];
  const values = vector.law.values;
  const issues: CcfGroupIssue[] = values.flatMap((value, index) => (
    Number.isFinite(value) && value >= 0 && value <= 1 ? [] : [{ code: "CCF_FACTOR_RANGE", severity: "ERROR" as const, message: `${symbol}${index + 1} must be between 0 and 1.` }]
  ));
  const sum = values.reduce((current, value) => current + value, 0);
  if (values.length > 0 && Math.abs(sum - 1) > SUM_TOLERANCE) {
    issues.push({ code: `CCF_${prefix}_SUM`, severity: "ERROR", message: `${prefix === "ALPHA" ? "Alpha" : "Phi"} factors must sum to 1. The current sum is ${sum.toFixed(6)}.` });
  }
  return issues;
}

function orderText(from: number, to: number): string {
  return from === to ? `order ${from}` : `orders ${from} to ${to}`;
}

function zeroOrders(model: string, from: number, to: number): CcfGroupIssue[] {
  if (from > to) return [];
  return [{ code: "CCF_ORDERS_ZERO", severity: "WARNING", message: `${model} sets ${orderText(from, to)} to zero.` }];
}

function vectorCountIssues(vector: UncertainVector, size: number, lengths: VectorLengths, code: "CCF_ALPHA_COUNT" | "CCF_PHI_COUNT", model: string): CcfGroupIssue[] {
  if (vector.node === "PARAMETER" && !lengths.has(parameterReferenceKey(vector.reference))) {
    return lengths.size === 0 ? [] : [{ code: "CCF_VECTOR_MISSING", severity: "ERROR", message: `The linked vector ${vector.reference.entityId} is not in the linked DA workbook.` }];
  }
  const length = vectorLength(vector, lengths);
  return length !== null && length !== size
    ? [{ code, severity: "ERROR", message: `${model} needs exactly ${size} factors for ${size} members, not ${length}.` }]
    : [];
}

function factorIssues(factors: CcfFactorModel, size: number, lengths: VectorLengths = NO_LENGTHS): CcfGroupIssue[] {
  switch (factors.model) {
    case "BETA_FACTOR": {
      const issue = rangeIssue(factors.beta, "Beta factor");
      return [...(issue === null ? [] : [issue]), ...(size > 2 ? zeroOrders(`The beta factor for ${size} members`, 2, size - 1) : [])];
    }
    case "MGL": {
      const count = factors.factors.length;
      const limit = Math.max(1, size - 1);
      const countIssues = count === 0 || count > limit
        ? [{ code: "CCF_MGL_COUNT", severity: "ERROR" as const, message: `MGL needs 1 to ${limit} factors for ${size} members, not ${count}.` }]
        : zeroOrders(`MGL with ${count} ${count === 1 ? "factor" : "factors"} for ${size} members`, count + 2, size);
      return [...countIssues, ...factors.factors.flatMap((factor, index) => {
        const issue = rangeIssue(factor, `MGL factor ${mglLetter(index)}`);
        return issue === null ? [] : [issue];
      })];
    }
    case "ALPHA_FACTOR":
      return [...vectorCountIssues(factors.alphas, size, lengths, "CCF_ALPHA_COUNT", "Alpha factor"), ...vectorIssues(factors.alphas, "α", "ALPHA")];
    case "PHI_FACTOR":
      return [...vectorCountIssues(factors.phis, size, lengths, "CCF_PHI_COUNT", "Phi factor"), ...vectorIssues(factors.phis, "φ", "PHI")];
    case "BINOMIAL_FAILURE_RATE":
      return [
        rangeIssue(factors.independent, "The independent failure probability"),
        rangeIssue(factors.nonLethalShock, "The non-lethal shock probability"),
        rangeIssue(factors.componentFailure, "The component failure fraction"),
        rangeIssue(factors.lethalShock, "The lethal shock probability"),
      ].flatMap((issue) => (issue === null ? [] : [issue]));
  }
}

function memberIssues(group: CommonCauseFailureGroup, analysis: CcfAnalysis): CcfGroupIssue[] {
  const members = group.members?.basicEvents.map(({ id }) => id) ?? [];
  const unique = uniqueMemberIds(group);
  const eventById = new Map(analysis.systemBasicEvents.map((event) => [event.uuid, event]));
  const issues: CcfGroupIssue[] = [];
  if (members.length !== unique.length) issues.push({ code: "CCF_DUPLICATE_MEMBER", severity: "ERROR", message: "A basic event can appear only once in a group." });
  if (unique.length < 2) issues.push({ code: "CCF_MEMBER_COUNT", severity: "ERROR", message: "Select at least two member basic events." });
  for (const memberId of unique) {
    const event = eventById.get(memberId);
    if (event === undefined) {
      issues.push({ code: "CCF_MEMBER_MISSING", severity: "ERROR", message: `Member ${memberId} does not exist in the basic event catalogue.` });
    } else if (event.failureMode === "COMMON_CAUSE_FAILURE") {
      issues.push({
        code: "CCF_COLLAPSED_MEMBER",
        severity: "ERROR",
        message: `${event.name} is a collapsed common cause event. Select the independent component events, and PRAXIS generates the common cause events.`,
      });
    } else if (carriesUncertainExpression(event.failureMode)) {
      if (event.expression === undefined) issues.push({ code: "CCF_MEMBER_PROBABILITY", severity: "ERROR", message: `${event.name} needs a value. Set it in Step 02.` });
    } else if (event.probability === undefined || !Number.isFinite(event.probability) || event.probability < 0 || event.probability > 1) {
      issues.push({ code: "CCF_MEMBER_PROBABILITY", severity: "ERROR", message: `${event.name} needs a probability between 0 and 1.` });
    }
  }
  if (ccfModelTakesTotal(group.factors) && memberValueKeys(group, analysis).length > 1) {
    issues.push({ code: "CCF_MEMBER_MISMATCH", severity: "WARNING", message: "The member events hold different values, so Qₜ stays as typed. Give every member the same value in Step 02 to take Qₜ from them." });
  }
  return issues;
}

function totalIssues(group: CommonCauseFailureGroup, analysis: CcfAnalysis): CcfGroupIssue[] {
  if (!ccfModelTakesTotal(group.factors)) {
    return group.total === undefined ? [] : [{ code: "CCF_TOTAL_UNUSED", severity: "ERROR", message: "A binomial failure rate group takes no Qₜ. The model gives every order." }];
  }
  const total = group.total;
  const shared = sharedMemberExpression(group, analysis);
  if (total === undefined) {
    return [{ code: "CCF_TOTAL", severity: "ERROR", message: "Set Qₜ. Give the members one shared value, or type Qₜ." }];
  }
  const issues: CcfGroupIssue[] = [];
  const range = rangeIssue(total, "Qₜ");
  if (range !== null) issues.push(range);
  if (shared === null && pointOf(total) === 0) {
    issues.push({ code: "CCF_TOTAL", severity: "ERROR", message: "Set Qₜ. Give the members one shared value, or type Qₜ." });
  }
  if (shared !== null && canonicalJson(shared) !== canonicalJson(total)) {
    issues.push({ code: "CCF_TOTAL_MISMATCH", severity: "ERROR", message: "Qₜ differs from the value the member events share." });
  }
  return issues;
}

function sourceIssues(group: CommonCauseFailureGroup, estimates: readonly SyControlledCcfEstimateOption[] | undefined): CcfGroupIssue[] {
  const reference = (group.dataAnalysisCCFParameterRef ?? "").trim();
  if (reference.length === 0) {
    return [
      { code: "CCF_DA_REFERENCE", severity: "WARNING", message: "Link the parameter estimate from Data Analysis." },
      ...((group.dataSources ?? []).length === 0 ? [{ code: "CCF_SOURCE", severity: "WARNING" as const, message: "Identify the parameter source." }] : []),
    ];
  }
  if (estimates === undefined || estimates.length === 0) return [];
  const estimate = linkedEstimate(group, estimates);
  if (estimate === undefined) return [{ code: "CCF_DA_MISSING", severity: "WARNING", message: `The linked DA estimate ${reference} is not in the linked DA workbook.` }];
  if (matchesEstimate(group, estimate)) return [];
  const copied = factorLinks(estimate.factors).length > 0 && factorLinks(group.factors).length === 0;
  return [{ code: "CCF_DA_STALE", severity: "WARNING", message: copied ? `The factors are a typed copy of DA estimate ${reference}. Apply it again to link them, so they follow DA.` : `The factors differ from DA estimate ${reference}.` }];
}

function validateCcfGroup(group: CommonCauseFailureGroup, analysis: CcfAnalysis, estimates?: readonly SyControlledCcfEstimateOption[], lengths: VectorLengths = NO_LENGTHS): CcfGroupIssue[] {
  const issues: CcfGroupIssue[] = [];
  if (group.name.trim().length === 0) issues.push({ code: "CCF_NAME", severity: "ERROR", message: "Enter a group name." });
  if (group.affectedSystems.length === 0 || !analysis.systemDefinitions.some(({ uuid }) => uuid === group.affectedSystems[0])) {
    issues.push({ code: "CCF_OWNER", severity: "ERROR", message: "Select the system that owns this group." });
  }
  if (group.scope === "INTERSYSTEM" && new Set(group.affectedSystems).size < 2) {
    issues.push({ code: "CCF_INTERSYSTEM_SCOPE", severity: "ERROR", message: "An across systems group must include at least two systems." });
  }
  issues.push(...memberIssues(group, analysis), ...totalIssues(group, analysis), ...factorIssues(group.factors, uniqueMemberIds(group).length, lengths));
  if ((group.groupSelectionBasis ?? group.description).trim().length === 0) {
    issues.push({ code: "CCF_BASIS", severity: "WARNING", message: "Document the grouping basis." });
  }
  issues.push(...sourceIssues(group, estimates));
  return issues;
}

function ccfGroupIsReady(group: CommonCauseFailureGroup, analysis: CcfAnalysis): boolean {
  return validateCcfGroup(group, analysis).every(({ severity }) => severity !== "ERROR");
}

function ccfGroupsForModel(analysis: CcfAnalysis, model: Pick<SystemLogicModel, "leafNodes">): CommonCauseFailureGroup[] {
  const modelEvents = new Set(systemLogicModelBasicEvents(analysis, model).map(({ uuid }) => uuid));
  return analysis.commonCauseFailureGroups.filter((group) => {
    const members = group.members?.basicEvents.map(({ id }) => id) ?? [];
    return ccfGroupIsReady(group, analysis) && members.length >= 2 && members.every((id) => modelEvents.has(id));
  });
}

export {
  factorIssues as ccfFactorIssues,
  ccfFactorText,
  ccfGroupIsReady,
  ccfGroupsForModel,
  ccfModelText,
  fittedFactors,
  groupTotal,
  linkedEstimate,
  matchesEstimate,
  memberEvents,
  sharedCauseLines,
  sharedMemberExpression,
  uniqueMemberIds,
  validateCcfGroup,
  vectorLengths,
  withMemberTotal,
  withMemberTotals,
  type CcfAnalysis,
  type CcfGroupIssue,
  type VectorLengths,
};
