import type {
  CommonCauseFailureGroup,
  SystemLogicModel,
  SystemsAnalysis,
} from "interfaces-mef-types/sy/systems-analysis";
import { systemLogicModelBasicEvents } from "interfaces-mef-types/sy/system-models";

type SupportedCcfModel = "BETA_FACTOR" | "MGL" | "ALPHA_FACTOR" | "PHI_FACTOR";

interface CcfGroupIssue {
  code: string;
  message: string;
  severity: "ERROR" | "WARNING";
}

interface CcfParameterSummary {
  short: string;
  detail: string;
  totalFailureProbability: number;
}

const SUPPORTED_CCF_MODELS: SupportedCcfModel[] = [
  "BETA_FACTOR",
  "MGL",
  "ALPHA_FACTOR",
  "PHI_FACTOR",
];

function orderedFactors(values: Record<string, number>): [string, number][] {
  return Object.entries(values).sort(([left], [right]) =>
    left.localeCompare(right, undefined, { numeric: true }),
  );
}

function totalFailureProbability(group: CommonCauseFailureGroup): number | null {
  const parameters = group.modelSpecificParameters;
  if (group.modelType === "BETA_FACTOR") return parameters?.betaFactorParameters?.totalFailureProbability ?? null;
  if (group.modelType === "MGL") return parameters?.mglParameters?.totalFailureProbability ?? null;
  if (group.modelType === "ALPHA_FACTOR") return parameters?.alphaFactorParameters?.totalFailureProbability ?? null;
  if (group.modelType === "PHI_FACTOR") return parameters?.phiFactorParameters?.totalFailureProbability ?? null;
  return null;
}

function ccfParameterSummary(group: CommonCauseFailureGroup): CcfParameterSummary | null {
  const total = totalFailureProbability(group);
  if (total === null) return null;
  const parameters = group.modelSpecificParameters;
  if (group.modelType === "BETA_FACTOR" && parameters?.betaFactorParameters !== undefined) {
    const { beta } = parameters.betaFactorParameters;
    return { short: `β ${beta}`, detail: `β ${beta} · Qₜ ${total.toExponential(2).toUpperCase()}`, totalFailureProbability: total };
  }
  if (group.modelType === "MGL" && parameters?.mglParameters !== undefined) {
    const { beta, gamma, delta, additionalFactors } = parameters.mglParameters;
    const factors = [beta, gamma, delta, ...orderedFactors(additionalFactors ?? {}).map(([, value]) => value)]
      .filter((value): value is number => value !== undefined);
    return { short: `${factors.length} Greek factor${factors.length === 1 ? "" : "s"}`, detail: `MGL ${factors.join(" · ")} · Qₜ ${total.toExponential(2).toUpperCase()}`, totalFailureProbability: total };
  }
  if (group.modelType === "ALPHA_FACTOR" && parameters?.alphaFactorParameters !== undefined) {
    const factors = orderedFactors(parameters.alphaFactorParameters.alphaFactors);
    return { short: `${factors.length} α factor${factors.length === 1 ? "" : "s"}`, detail: `${factors.map(([key, value]) => `${key.replace(/^alpha/, "α")} ${value}`).join(" · ")} · Qₜ ${total.toExponential(2).toUpperCase()}`, totalFailureProbability: total };
  }
  if (group.modelType === "PHI_FACTOR" && parameters?.phiFactorParameters !== undefined) {
    const factors = orderedFactors(parameters.phiFactorParameters.phiFactors);
    return { short: `${factors.length} φ factor${factors.length === 1 ? "" : "s"}`, detail: `${factors.map(([key, value]) => `${key.replace(/^phi/, "φ")} ${value}`).join(" · ")} · Qₜ ${total.toExponential(2).toUpperCase()}`, totalFailureProbability: total };
  }
  return null;
}

function rangeIssue(value: number, label: string): CcfGroupIssue | null {
  return Number.isFinite(value) && value >= 0 && value <= 1
    ? null
    : { code: "CCF_FACTOR_RANGE", severity: "ERROR", message: `${label} must be between 0 and 1.` };
}

function validateCcfGroup(group: CommonCauseFailureGroup, analysis: SystemsAnalysis): CcfGroupIssue[] {
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
        message: `${event.code ?? event.uuid} is a collapsed common cause event. Select the independent component events; PRAXIS generates the common cause events.`,
      });
    } else if (event.probability === undefined || !Number.isFinite(event.probability) || event.probability < 0 || event.probability > 1) {
      issues.push({ code: "CCF_MEMBER_PROBABILITY", severity: "ERROR", message: `${event.code ?? event.uuid} needs a probability between 0 and 1.` });
    }
  }

  if (!SUPPORTED_CCF_MODELS.includes(group.modelType as SupportedCcfModel)) {
    issues.push({ code: "CCF_MODEL", severity: "ERROR", message: "Select a PRAXIS supported common cause model." });
  }
  const total = totalFailureProbability(group);
  push(total === null
    ? { code: "CCF_TOTAL", severity: "ERROR", message: "Enter the total failure probability." }
    : rangeIssue(total, "Total failure probability"));

  const parameters = group.modelSpecificParameters;
  if (group.modelType === "BETA_FACTOR") {
    const beta = parameters?.betaFactorParameters?.beta;
    push(beta === undefined ? { code: "CCF_BETA", severity: "ERROR", message: "Enter the beta factor." } : rangeIssue(beta, "Beta factor"));
  } else if (group.modelType === "MGL") {
    const values = parameters?.mglParameters;
    if (values === undefined) {
      issues.push({ code: "CCF_MGL", severity: "ERROR", message: "Enter the MGL factors." });
    } else {
      const factors = [values.beta, values.gamma, values.delta, ...orderedFactors(values.additionalFactors ?? {}).map(([, value]) => value)]
        .filter((value): value is number => value !== undefined);
      if (factors.length === 0 || factors.length > Math.max(0, uniqueMembers.length - 1)) {
        issues.push({ code: "CCF_MGL_COUNT", severity: "ERROR", message: `MGL requires 1 to ${Math.max(1, uniqueMembers.length - 1)} factors for this group.` });
      }
      factors.forEach((value, index) => push(rangeIssue(value, `MGL factor ${index + 1}`)));
    }
  } else if (group.modelType === "ALPHA_FACTOR") {
    const factors = orderedFactors(parameters?.alphaFactorParameters?.alphaFactors ?? {});
    if (factors.length !== uniqueMembers.length) {
      issues.push({ code: "CCF_ALPHA_COUNT", severity: "ERROR", message: `Alpha factor requires ${uniqueMembers.length} factors for ${uniqueMembers.length} members.` });
    }
    factors.forEach(([key, value]) => push(rangeIssue(value, key)));
    const sum = factors.reduce((current, [, value]) => current + value, 0);
    if (factors.length > 0 && Math.abs(sum - 1) > 1e-6) {
      issues.push({ code: "CCF_ALPHA_SUM", severity: "ERROR", message: `Alpha factors must sum to 1; the current sum is ${sum.toFixed(6)}.` });
    }
  } else if (group.modelType === "PHI_FACTOR") {
    const factors = orderedFactors(parameters?.phiFactorParameters?.phiFactors ?? {});
    if (factors.length === 0 || factors.length > uniqueMembers.length) {
      issues.push({ code: "CCF_PHI_COUNT", severity: "ERROR", message: `Phi factor requires 1 to ${Math.max(1, uniqueMembers.length)} factors for this group.` });
    }
    factors.forEach(([key, value]) => push(rangeIssue(value, key)));
    const sum = factors.reduce((current, [, value]) => current + value, 0);
    if (factors.length > 0 && Math.abs(sum - 1) > 1e-6) {
      issues.push({ code: "CCF_PHI_SUM", severity: "ERROR", message: `Phi factors must sum to 1; the current sum is ${sum.toFixed(6)}.` });
    }
  }

  if ((group.groupSelectionBasis ?? group.description).trim().length === 0) {
    issues.push({ code: "CCF_BASIS", severity: "WARNING", message: "Document the grouping basis." });
  }
  if ((group.dataAnalysisCCFParameterRef ?? "").trim().length === 0) {
    issues.push({ code: "CCF_DA_REFERENCE", severity: "WARNING", message: "Link the parameter estimate from Data Analysis." });
  }
  if ((group.dataSources ?? []).length === 0) {
    issues.push({ code: "CCF_SOURCE", severity: "WARNING", message: "Identify the parameter source." });
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

function defaultCcfParameters(modelType: SupportedCcfModel, memberCount: number, total: number) {
  const count = Math.max(2, memberCount);
  if (modelType === "BETA_FACTOR") {
    return { betaFactorParameters: { beta: 0.05, totalFailureProbability: total } };
  }
  if (modelType === "MGL") {
    return { mglParameters: { beta: 0.05, totalFailureProbability: total } };
  }
  if (modelType === "ALPHA_FACTOR") {
    const remainder = count === 1 ? 0 : 0.05 / (count - 1);
    return {
      alphaFactorParameters: {
        alphaFactors: Object.fromEntries(Array.from({ length: count }, (_, index) => [`alpha${index + 1}`, index === 0 ? 0.95 : remainder])),
        totalFailureProbability: total,
      },
    };
  }
  const remainder = count === 1 ? 0 : 0.05 / (count - 1);
  return {
    phiFactorParameters: {
      phiFactors: Object.fromEntries(Array.from({ length: count }, (_, index) => [`phi${index + 1}`, index === 0 ? 0.95 : remainder])),
      totalFailureProbability: total,
    },
  };
}

export {
  SUPPORTED_CCF_MODELS,
  ccfGroupIsReady,
  ccfGroupsForModel,
  ccfParameterSummary,
  defaultCcfParameters,
  orderedFactors,
  totalFailureProbability,
  validateCcfGroup,
  type CcfGroupIssue,
  type CcfParameterSummary,
  type SupportedCcfModel,
};
