import type {
  CommonCauseFailureGroup,
  SystemBasicEvent,
  SystemLogicModel,
  SystemsAnalysis,
} from "interfaces-mef-types/sy/systems-analysis";
import { systemLogicModelBasicEvents } from "interfaces-mef-types/sy/system-models";
import { SHARED_CAUSE_KEYS, SHARED_CAUSE_LABELS } from "./syViewData";
import type { SyControlledCcfEstimateOption } from "./syWorkbookContext";

type SupportedCcfModel = "BETA_FACTOR" | "MGL" | "ALPHA_FACTOR" | "PHI_FACTOR";

type CcfModelParameters = NonNullable<CommonCauseFailureGroup["modelSpecificParameters"]>;

interface CcfGroupIssue {
  code: string;
  message: string;
  severity: "ERROR" | "WARNING";
}

interface CcfFactor {
  key: string;
  label: string;
  value: number;
}

const SUPPORTED_CCF_MODELS: SupportedCcfModel[] = [
  "BETA_FACTOR",
  "MGL",
  "ALPHA_FACTOR",
  "PHI_FACTOR",
];

const MGL_LABELS = ["β", "γ", "δ"];

const MGL_NAMED_KEYS = ["beta", "gamma", "delta"];

function isSupportedCcfModel(value: string): value is SupportedCcfModel {
  return SUPPORTED_CCF_MODELS.some((candidate) => candidate === value);
}

function orderedFactors(values: Record<string, number>): [string, number][] {
  return Object.entries(values).sort(([left], [right]) =>
    left.localeCompare(right, undefined, { numeric: true }),
  );
}

function sameValue(left: number, right: number): boolean {
  return Math.abs(left - right) <= 1e-12 + 1e-9 * Math.max(Math.abs(left), Math.abs(right));
}

function formatFactor(value: number): string {
  return String(Number(value.toPrecision(5)));
}

function formatProbability(value: number): string {
  return value.toExponential(1).toUpperCase();
}

function totalFailureProbability(group: CommonCauseFailureGroup): number | null {
  const parameters = group.modelSpecificParameters;
  if (group.modelType === "BETA_FACTOR") return parameters?.betaFactorParameters?.totalFailureProbability ?? null;
  if (group.modelType === "MGL") return parameters?.mglParameters?.totalFailureProbability ?? null;
  if (group.modelType === "ALPHA_FACTOR") return parameters?.alphaFactorParameters?.totalFailureProbability ?? null;
  if (group.modelType === "PHI_FACTOR") return parameters?.phiFactorParameters?.totalFailureProbability ?? null;
  return null;
}

function mglFactorValues(values: NonNullable<CcfModelParameters["mglParameters"]>): number[] {
  return [values.beta, values.gamma, values.delta, ...orderedFactors(values.additionalFactors ?? {}).map(([, value]) => value)]
    .filter((value): value is number => value !== undefined);
}

function factorSymbol(modelType: string, index: number): string {
  if (modelType === "BETA_FACTOR") return "β";
  if (modelType === "MGL") return MGL_LABELS[index] ?? `Factor ${index + 1}`;
  return `${modelType === "PHI_FACTOR" ? "φ" : "α"}${index + 1}`;
}

function factorText(modelType: string, values: readonly number[]): string {
  return values.map((value, index) => `${factorSymbol(modelType, index)} ${formatFactor(value)}`).join(" · ");
}

function ccfFactors(group: CommonCauseFailureGroup): CcfFactor[] {
  const parameters = group.modelSpecificParameters;
  const entries: [string, number][] = group.modelType === "BETA_FACTOR"
    ? (parameters?.betaFactorParameters === undefined ? [] : [["beta", parameters.betaFactorParameters.beta]])
    : group.modelType === "MGL"
      ? (parameters?.mglParameters === undefined ? [] : mglFactorValues(parameters.mglParameters).map((value, index): [string, number] => [`factor${index + 1}`, value]))
      : group.modelType === "ALPHA_FACTOR"
        ? orderedFactors(parameters?.alphaFactorParameters?.alphaFactors ?? {})
        : group.modelType === "PHI_FACTOR"
          ? orderedFactors(parameters?.phiFactorParameters?.phiFactors ?? {})
          : [];
  return entries.map(([key, value], index) => ({ key, label: factorSymbol(group.modelType, index), value }));
}

function ccfFactorText(group: CommonCauseFailureGroup): string {
  return factorText(group.modelType, ccfFactors(group).map(({ value }) => value));
}

function sharedCauseLines(group: CommonCauseFailureGroup): string[] {
  const shared = group.sharedCauseFactors ?? {};
  return [...SHARED_CAUSE_KEYS.filter((key) => shared[key] === true).map((key) => SHARED_CAUSE_LABELS[key]), ...(shared.otherFactors ?? [])];
}

function mglParametersFrom(values: readonly number[], total: number): CcfModelParameters {
  return {
    mglParameters: {
      beta: values[0] ?? 0,
      ...(values[1] === undefined ? {} : { gamma: values[1] }),
      ...(values[2] === undefined ? {} : { delta: values[2] }),
      ...(values.length <= 3 ? {} : { additionalFactors: Object.fromEntries(values.slice(3).map((value, index) => [`factor${index + 4}`, value])) }),
      totalFailureProbability: total,
    },
  };
}

function parametersFromValues(modelType: SupportedCcfModel, values: readonly number[], total: number): CcfModelParameters {
  if (modelType === "BETA_FACTOR") return { betaFactorParameters: { beta: values[0] ?? 0, totalFailureProbability: total } };
  if (modelType === "MGL") return mglParametersFrom(values, total);
  if (modelType === "ALPHA_FACTOR") {
    return { alphaFactorParameters: { alphaFactors: Object.fromEntries(values.map((value, index) => [`alpha${index + 1}`, value])), totalFailureProbability: total } };
  }
  return { phiFactorParameters: { phiFactors: Object.fromEntries(values.map((value, index) => [`phi${index + 1}`, value])), totalFailureProbability: total } };
}

function estimateValues(estimate: Pick<SyControlledCcfEstimateOption, "modelType" | "parameters">): number[] {
  const ordered = orderedFactors(estimate.parameters).map(([, value]) => value);
  if (estimate.modelType === "BETA_FACTOR") {
    const beta = estimate.parameters["beta"] ?? ordered[0];
    return beta === undefined ? [] : [beta];
  }
  if (estimate.modelType !== "MGL") return ordered;
  const named = MGL_NAMED_KEYS.flatMap((key) => {
    const value = estimate.parameters[key];
    return value === undefined ? [] : [value];
  });
  return [...named, ...orderedFactors(estimate.parameters).filter(([key]) => !MGL_NAMED_KEYS.includes(key)).map(([, value]) => value)];
}

function estimateParameters(estimate: Pick<SyControlledCcfEstimateOption, "modelType" | "parameters">, total: number): CcfModelParameters {
  return parametersFromValues(estimate.modelType, estimateValues(estimate), total);
}

function estimateFactorText(estimate: Pick<SyControlledCcfEstimateOption, "modelType" | "parameters">): string {
  return factorText(estimate.modelType, estimateValues(estimate));
}

function matchesEstimate(group: CommonCauseFailureGroup, estimate: SyControlledCcfEstimateOption): boolean {
  if (group.modelType !== estimate.modelType) return false;
  const expected = estimateValues(estimate);
  const actual = ccfFactors(group).map(({ value }) => value);
  return expected.length === actual.length && expected.every((value, index) => sameValue(value, actual[index] ?? Number.NaN));
}

function linkedEstimate(group: CommonCauseFailureGroup, estimates: readonly SyControlledCcfEstimateOption[]): SyControlledCcfEstimateOption | undefined {
  const reference = group.dataAnalysisCCFParameterRef;
  return reference === undefined ? undefined : estimates.find((estimate) => estimate.estimateId === reference);
}

function memberEvents(group: CommonCauseFailureGroup, analysis: Pick<SystemsAnalysis, "systemBasicEvents">): SystemBasicEvent[] {
  const eventById = new Map(analysis.systemBasicEvents.map((event) => [event.uuid, event]));
  return (group.members?.basicEvents ?? []).flatMap(({ id }) => {
    const event = eventById.get(id);
    return event === undefined ? [] : [event];
  });
}

function memberProbabilities(group: CommonCauseFailureGroup, analysis: Pick<SystemsAnalysis, "systemBasicEvents">): number[] {
  const values = memberEvents(group, analysis).flatMap((event) => {
    const value = event.probability;
    return value === undefined || !Number.isFinite(value) ? [] : [value];
  });
  return values.filter((value, index) => values.findIndex((candidate) => sameValue(candidate, value)) === index);
}

function memberProbability(group: CommonCauseFailureGroup, analysis: Pick<SystemsAnalysis, "systemBasicEvents">): number | null {
  const values = memberProbabilities(group, analysis);
  return values.length === 1 ? (values[0] ?? null) : null;
}

function withTotalProbability(group: CommonCauseFailureGroup, total: number): CcfModelParameters | null {
  const parameters = group.modelSpecificParameters;
  if (group.modelType === "BETA_FACTOR" && parameters?.betaFactorParameters !== undefined) {
    return { betaFactorParameters: { ...parameters.betaFactorParameters, totalFailureProbability: total } };
  }
  if (group.modelType === "MGL" && parameters?.mglParameters !== undefined) {
    return { mglParameters: { ...parameters.mglParameters, totalFailureProbability: total } };
  }
  if (group.modelType === "ALPHA_FACTOR" && parameters?.alphaFactorParameters !== undefined) {
    return { alphaFactorParameters: { ...parameters.alphaFactorParameters, totalFailureProbability: total } };
  }
  if (group.modelType === "PHI_FACTOR" && parameters?.phiFactorParameters !== undefined) {
    return { phiFactorParameters: { ...parameters.phiFactorParameters, totalFailureProbability: total } };
  }
  return null;
}

function withMemberTotals(analysis: SystemsAnalysis, eventIds: ReadonlySet<string>): SystemsAnalysis {
  const groups = analysis.commonCauseFailureGroups.map((group) => {
    if (!(group.members?.basicEvents ?? []).some(({ id }) => eventIds.has(id))) return group;
    const total = memberProbability(group, analysis);
    const current = totalFailureProbability(group);
    if (total === null || (current !== null && sameValue(current, total))) return group;
    const parameters = withTotalProbability(group, total);
    return parameters === null ? group : { ...group, modelSpecificParameters: parameters };
  });
  return groups.some((group, index) => group !== analysis.commonCauseFailureGroups[index])
    ? { ...analysis, commonCauseFailureGroups: groups }
    : analysis;
}

function rangeIssue(value: number, label: string): CcfGroupIssue | null {
  return Number.isFinite(value) && value >= 0 && value <= 1
    ? null
    : { code: "CCF_FACTOR_RANGE", severity: "ERROR", message: `${label} must be between 0 and 1.` };
}

function validateCcfGroup(
  group: CommonCauseFailureGroup,
  analysis: SystemsAnalysis,
  estimates?: readonly SyControlledCcfEstimateOption[],
): CcfGroupIssue[] {
  const issues: CcfGroupIssue[] = [];
  const push = (issue: CcfGroupIssue | null): void => { if (issue !== null) issues.push(issue); };
  const members = group.members?.basicEvents.map(({ id }) => id) ?? [];
  const uniqueMembers = [...new Set(members)];
  const eventById = new Map(analysis.systemBasicEvents.map((event) => [event.uuid, event]));

  if (group.name.trim().length === 0) issues.push({ code: "CCF_NAME", severity: "ERROR", message: "Enter a group name." });
  if (group.affectedSystems.length === 0 || !analysis.systemDefinitions.some(({ uuid }) => uuid === group.affectedSystems[0])) {
    issues.push({ code: "CCF_OWNER", severity: "ERROR", message: "Select the system that owns this group." });
  }
  if (group.scope === "INTERSYSTEM" && new Set(group.affectedSystems).size < 2) {
    issues.push({ code: "CCF_INTERSYSTEM_SCOPE", severity: "ERROR", message: "An across systems group must include at least two systems." });
  }
  if (members.length !== uniqueMembers.length) {
    issues.push({ code: "CCF_DUPLICATE_MEMBER", severity: "ERROR", message: "A basic event can appear only once in a group." });
  }
  if (uniqueMembers.length < 2) {
    issues.push({ code: "CCF_MEMBER_COUNT", severity: "ERROR", message: "Select at least two member basic events." });
  }
  for (const memberId of uniqueMembers) {
    const event = eventById.get(memberId);
    if (event === undefined) {
      issues.push({ code: "CCF_MEMBER_MISSING", severity: "ERROR", message: `Member ${memberId} does not exist in the basic event catalogue.` });
    } else if (event.failureMode === "COMMON_CAUSE_FAILURE") {
      issues.push({
        code: "CCF_COLLAPSED_MEMBER",
        severity: "ERROR",
        message: `${event.name} is a collapsed common cause event. Select the independent component events, and PRAXIS generates the common cause events.`,
      });
    } else if (event.probability === undefined || !Number.isFinite(event.probability) || event.probability < 0 || event.probability > 1) {
      issues.push({ code: "CCF_MEMBER_PROBABILITY", severity: "ERROR", message: `${event.name} needs a probability between 0 and 1.` });
    }
  }
  const probabilities = memberProbabilities(group, analysis);
  if (probabilities.length > 1) {
    issues.push({ code: "CCF_MEMBER_MISMATCH", severity: "ERROR", message: `The member events carry different probabilities (${probabilities.map(formatProbability).join(", ")}). Give every member the same probability in Step 02.` });
  }

  if (!isSupportedCcfModel(group.modelType)) {
    issues.push({ code: "CCF_MODEL", severity: "ERROR", message: "Select a PRAXIS supported common cause model." });
  }
  const total = totalFailureProbability(group);
  push(total === null
    ? { code: "CCF_TOTAL", severity: "ERROR", message: "Select the member events to set Qₜ." }
    : rangeIssue(total, "Qₜ"));
  if (total !== null && probabilities.length === 1 && probabilities[0] !== undefined && !sameValue(total, probabilities[0])) {
    issues.push({ code: "CCF_TOTAL_MISMATCH", severity: "ERROR", message: `Qₜ ${formatProbability(total)} does not match the member events (${formatProbability(probabilities[0])}).` });
  }

  const parameters = group.modelSpecificParameters;
  if (group.modelType === "BETA_FACTOR") {
    const beta = parameters?.betaFactorParameters?.beta;
    push(beta === undefined ? { code: "CCF_BETA", severity: "ERROR", message: "Enter the beta factor." } : rangeIssue(beta, "Beta factor"));
  } else if (group.modelType === "MGL") {
    const values = parameters?.mglParameters;
    if (values === undefined) {
      issues.push({ code: "CCF_MGL", severity: "ERROR", message: "Enter the MGL factors." });
    } else {
      const factors = mglFactorValues(values);
      if (factors.length === 0 || factors.length > Math.max(0, uniqueMembers.length - 1)) {
        issues.push({ code: "CCF_MGL_COUNT", severity: "ERROR", message: `MGL requires 1 to ${Math.max(1, uniqueMembers.length - 1)} factors for this group.` });
      }
      factors.forEach((value, index) => push(rangeIssue(value, `MGL factor ${index + 1}`)));
    }
  } else if (group.modelType === "ALPHA_FACTOR") {
    const factors = ccfFactors(group);
    if (factors.length !== uniqueMembers.length) {
      issues.push({ code: "CCF_ALPHA_COUNT", severity: "ERROR", message: `Alpha factor requires ${uniqueMembers.length} factors for ${uniqueMembers.length} members.` });
    }
    factors.forEach(({ label, value }) => push(rangeIssue(value, label)));
    const sum = factors.reduce((current, { value }) => current + value, 0);
    if (factors.length > 0 && Math.abs(sum - 1) > 1e-6) {
      issues.push({ code: "CCF_ALPHA_SUM", severity: "ERROR", message: `Alpha factors must sum to 1. The current sum is ${sum.toFixed(6)}.` });
    }
  } else if (group.modelType === "PHI_FACTOR") {
    const factors = ccfFactors(group);
    if (factors.length === 0 || factors.length > uniqueMembers.length) {
      issues.push({ code: "CCF_PHI_COUNT", severity: "ERROR", message: `Phi factor requires 1 to ${Math.max(1, uniqueMembers.length)} factors for this group.` });
    }
    factors.forEach(({ label, value }) => push(rangeIssue(value, label)));
    const sum = factors.reduce((current, { value }) => current + value, 0);
    if (factors.length > 0 && Math.abs(sum - 1) > 1e-6) {
      issues.push({ code: "CCF_PHI_SUM", severity: "ERROR", message: `Phi factors must sum to 1. The current sum is ${sum.toFixed(6)}.` });
    }
  }

  if ((group.groupSelectionBasis ?? group.description).trim().length === 0) {
    issues.push({ code: "CCF_BASIS", severity: "WARNING", message: "Document the grouping basis." });
  }
  const reference = (group.dataAnalysisCCFParameterRef ?? "").trim();
  if (reference.length === 0) {
    issues.push({ code: "CCF_DA_REFERENCE", severity: "WARNING", message: "Link the parameter estimate from Data Analysis." });
    if ((group.dataSources ?? []).length === 0) {
      issues.push({ code: "CCF_SOURCE", severity: "WARNING", message: "Identify the parameter source." });
    }
  } else if (estimates !== undefined && estimates.length > 0) {
    const estimate = linkedEstimate(group, estimates);
    if (estimate === undefined) {
      issues.push({ code: "CCF_DA_MISSING", severity: "WARNING", message: `The linked DA estimate ${reference} is not in the linked DA workbook.` });
    } else if (!matchesEstimate(group, estimate)) {
      issues.push({ code: "CCF_DA_STALE", severity: "WARNING", message: `The model or factors differ from DA estimate ${reference}.` });
    }
  }
  return issues;
}

function ccfGroupIsReady(group: CommonCauseFailureGroup, analysis: SystemsAnalysis): boolean {
  return validateCcfGroup(group, analysis).every(({ severity }) => severity !== "ERROR");
}

function ccfGroupsForModel(analysis: SystemsAnalysis, model: SystemLogicModel): CommonCauseFailureGroup[] {
  const modelEvents = new Set(systemLogicModelBasicEvents(analysis, model).map(({ uuid }) => uuid));
  return analysis.commonCauseFailureGroups.filter((group) => {
    const members = group.members?.basicEvents.map(({ id }) => id) ?? [];
    return ccfGroupIsReady(group, analysis) && members.length >= 2 && members.every((id) => modelEvents.has(id));
  });
}

function defaultCcfParameters(modelType: SupportedCcfModel, memberCount: number, total: number): CcfModelParameters {
  const count = Math.max(2, memberCount);
  if (modelType === "BETA_FACTOR") {
    return { betaFactorParameters: { beta: 0.05, totalFailureProbability: total } };
  }
  if (modelType === "MGL") {
    return { mglParameters: { beta: 0.05, totalFailureProbability: total } };
  }
  const remainder = 0.05 / (count - 1);
  const values = Array.from({ length: count }, (_, index) => (index === 0 ? 0.95 : remainder));
  if (modelType === "ALPHA_FACTOR") {
    return { alphaFactorParameters: { alphaFactors: Object.fromEntries(values.map((value, index) => [`alpha${index + 1}`, value])), totalFailureProbability: total } };
  }
  return { phiFactorParameters: { phiFactors: Object.fromEntries(values.map((value, index) => [`phi${index + 1}`, value])), totalFailureProbability: total } };
}

export {
  SUPPORTED_CCF_MODELS,
  ccfFactorText,
  ccfFactors,
  ccfGroupIsReady,
  ccfGroupsForModel,
  defaultCcfParameters,
  estimateFactorText,
  estimateParameters,
  factorSymbol,
  formatFactor,
  isSupportedCcfModel,
  linkedEstimate,
  matchesEstimate,
  memberEvents,
  memberProbability,
  orderedFactors,
  parametersFromValues,
  sharedCauseLines,
  totalFailureProbability,
  validateCcfGroup,
  withMemberTotals,
  withTotalProbability,
  type CcfFactor,
  type CcfGroupIssue,
  type CcfModelParameters,
  type SupportedCcfModel,
};
