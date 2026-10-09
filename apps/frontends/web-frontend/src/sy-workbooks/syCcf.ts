import {
  carriesUncertainExpression,
  type CommonCauseFailureGroup,
  type SystemBasicEvent,
  type SystemLogicModel,
  type SystemsAnalysis,
} from "interfaces-mef-types/sy/systems-analysis";
import {
  canonicalJson,
  parameterReferenceKey,
  type CcfFactorModel,
  type UncertainExpression,
  type UncertainVector,
} from "interfaces-mef-types/core/uncertainty";
import { systemLogicModelBasicEvents } from "interfaces-mef-types/sy/system-models";
import { ccfFactorDraft } from "../newly-developed-methods/shared/uncertainEditor";
import { expressionText } from "../newly-developed-methods/shared/uncertainText";
import { CCF_MODELS, SHARED_CAUSE_KEYS, SHARED_CAUSE_LABELS } from "./syViewData";
import type { SyControlledCcfEstimateOption } from "./syWorkbookContext";

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

function withMemberTotal(group: CommonCauseFailureGroup, analysis: Pick<SystemsAnalysis, "systemBasicEvents">): CommonCauseFailureGroup {
  const shared = sharedMemberExpression(group, analysis);
  return shared === null || canonicalJson(shared) === canonicalJson(group.total) ? group : { ...group, total: shared };
}

function withMemberTotals<T extends Pick<SystemsAnalysis, "systemBasicEvents" | "commonCauseFailureGroups">>(analysis: T, eventIds: ReadonlySet<string>): T {
  const groups = analysis.commonCauseFailureGroups.map((group) => (
    (group.members?.basicEvents ?? []).some(({ id }) => eventIds.has(id)) ? withMemberTotal(group, analysis) : group
  ));
  return groups.some((group, index) => group !== analysis.commonCauseFailureGroups[index])
    ? { ...analysis, commonCauseFailureGroups: groups }
    : analysis;
}

function vectorLength(vector: UncertainVector): number | null {
  if (vector.node === "PARAMETER") return null;
  return vector.law.family === "DIRICHLET" ? vector.law.concentrations.length : vector.law.values.length;
}

function factorsFit(factors: CcfFactorModel, size: number): boolean {
  switch (factors.model) {
    case "BETA_FACTOR":
      return true;
    case "MGL":
      return factors.factors.length >= 1 && factors.factors.length <= Math.max(1, size - 1);
    case "ALPHA_FACTOR": {
      const length = vectorLength(factors.alphas);
      return length === null || length === size;
    }
    case "PHI_FACTOR": {
      const length = vectorLength(factors.phis);
      return length === null || (length >= 1 && length <= size);
    }
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
  if (vector.node === "PARAMETER" || vector.law.family === "DIRICHLET") return [];
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

function factorIssues(factors: CcfFactorModel, size: number): CcfGroupIssue[] {
  switch (factors.model) {
    case "BETA_FACTOR": {
      const issue = rangeIssue(factors.beta, "Beta factor");
      return issue === null ? [] : [issue];
    }
    case "MGL": {
      const count = factors.factors.length === 0 || factors.factors.length > Math.max(1, size - 1)
        ? [{ code: "CCF_MGL_COUNT", severity: "ERROR" as const, message: `MGL requires 1 to ${Math.max(1, size - 1)} factors for this group.` }]
        : [];
      return [...count, ...factors.factors.flatMap((factor, index) => {
        const issue = rangeIssue(factor, `MGL factor ${mglLetter(index)}`);
        return issue === null ? [] : [issue];
      })];
    }
    case "ALPHA_FACTOR": {
      const length = vectorLength(factors.alphas);
      const count = length !== null && length !== size
        ? [{ code: "CCF_ALPHA_COUNT", severity: "ERROR" as const, message: `Alpha factor requires ${size} factors for ${size} members.` }]
        : [];
      return [...count, ...vectorIssues(factors.alphas, "α", "ALPHA")];
    }
    case "PHI_FACTOR": {
      const length = vectorLength(factors.phis);
      const count = length !== null && (length < 1 || length > size)
        ? [{ code: "CCF_PHI_COUNT", severity: "ERROR" as const, message: `Phi factor requires 1 to ${Math.max(1, size)} factors for this group.` }]
        : [];
      return [...count, ...vectorIssues(factors.phis, "φ", "PHI")];
    }
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
  if (memberValueKeys(group, analysis).length > 1) {
    issues.push({ code: "CCF_MEMBER_MISMATCH", severity: "WARNING", message: "The member events hold different values, so Qₜ stays as typed. Give every member the same value in Step 02 to take Qₜ from them." });
  }
  return issues;
}

function totalIssues(group: CommonCauseFailureGroup, analysis: CcfAnalysis): CcfGroupIssue[] {
  const issues: CcfGroupIssue[] = [];
  const range = rangeIssue(group.total, "Qₜ");
  if (range !== null) issues.push(range);
  const shared = sharedMemberExpression(group, analysis);
  if (shared === null && pointOf(group.total) === 0) {
    issues.push({ code: "CCF_TOTAL", severity: "ERROR", message: "Set Qₜ. Give the members one shared value, or type Qₜ." });
  }
  if (shared !== null && canonicalJson(shared) !== canonicalJson(group.total)) {
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
  return matchesEstimate(group, estimate) ? [] : [{ code: "CCF_DA_STALE", severity: "WARNING", message: `The factors differ from DA estimate ${reference}.` }];
}

function validateCcfGroup(group: CommonCauseFailureGroup, analysis: CcfAnalysis, estimates?: readonly SyControlledCcfEstimateOption[]): CcfGroupIssue[] {
  const issues: CcfGroupIssue[] = [];
  if (group.name.trim().length === 0) issues.push({ code: "CCF_NAME", severity: "ERROR", message: "Enter a group name." });
  if (group.affectedSystems.length === 0 || !analysis.systemDefinitions.some(({ uuid }) => uuid === group.affectedSystems[0])) {
    issues.push({ code: "CCF_OWNER", severity: "ERROR", message: "Select the system that owns this group." });
  }
  if (group.scope === "INTERSYSTEM" && new Set(group.affectedSystems).size < 2) {
    issues.push({ code: "CCF_INTERSYSTEM_SCOPE", severity: "ERROR", message: "An across systems group must include at least two systems." });
  }
  issues.push(...memberIssues(group, analysis), ...totalIssues(group, analysis), ...factorIssues(group.factors, uniqueMemberIds(group).length));
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
  ccfFactorText,
  ccfGroupIsReady,
  ccfGroupsForModel,
  ccfModelText,
  fittedFactors,
  linkedEstimate,
  matchesEstimate,
  memberEvents,
  sharedCauseLines,
  sharedMemberExpression,
  uniqueMemberIds,
  validateCcfGroup,
  withMemberTotal,
  withMemberTotals,
  type CcfAnalysis,
  type CcfGroupIssue,
};
