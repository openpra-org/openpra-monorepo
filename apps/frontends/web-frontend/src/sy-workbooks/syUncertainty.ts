import { DistributionType, type ParameterDistribution } from "interfaces-mef-types/core/events";
import type { SensitivityStudy } from "interfaces-mef-types/core/shared-patterns";
import type { CommonCauseFailureGroup, SystemBasicEvent, SystemsAnalysis, SystemLogicModel, SystemUncertaintyAnalysis } from "interfaces-mef-types/sy/systems-analysis";
import { systemLogicModelBasicEvents } from "interfaces-mef-types/sy/system-models";
import { eventParameter, treeEvents } from "./syIntegrityChecks";
import type { SyControlledParameterOption } from "./syWorkbookContext";

interface UncertaintyIssue {
  code: string;
  severity: "ERROR" | "WARNING";
  message: string;
}

interface LinkedInput {
  event: SystemBasicEvent;
  source: SyControlledParameterOption;
  distribution: ParameterDistribution;
  issues: UncertaintyIssue[];
}

interface InputRow {
  event: SystemBasicEvent;
  source?: SyControlledParameterOption;
  distribution?: ParameterDistribution;
  issues: UncertaintyIssue[];
}

type RunState = "READY" | "NO_INPUTS" | "NEEDS_FIX";

interface RunReadiness {
  state: RunState;
  inputs: LinkedInput[];
  message: string;
}

type ModelSource = SystemUncertaintyAnalysis["modelUncertainties"][number];
type CcfSource = NonNullable<SystemUncertaintyAnalysis["ccfUncertainties"]>[number];
type DependencySource = NonNullable<SystemUncertaintyAnalysis["dependencyUncertainties"]>[number];
type PlantList = "sources" | "assumptions" | "alternatives";

type UncertaintyAnalysis = Pick<SystemsAnalysis,
  | "systemDefinitions"
  | "systemLogicModels"
  | "systemBasicEvents"
  | "commonCauseFailureGroups"
  | "uncertaintyAnalyses"
  | "sensitivityStudies"
  | "modelUncertainty">;

const PLANT_LISTS: readonly PlantList[] = ["sources", "assumptions", "alternatives"];

function issue(code: string, severity: UncertaintyIssue["severity"], message: string): UncertaintyIssue {
  return { code, severity, message };
}

function blank(value: string | undefined): boolean {
  return (value ?? "").trim().length === 0;
}

function distributionIssues(distribution: ParameterDistribution): string[] {
  const values = Object.values(distribution).filter((value): value is number => typeof value === "number");
  if (values.some((value) => !Number.isFinite(value))) return ["Distribution parameters must be finite."];
  switch (distribution.type) {
    case DistributionType.BETA:
      return distribution.alpha > 0 && distribution.betaParam > 0 ? [] : ["Beta alpha and beta must be positive."];
    case DistributionType.LOGNORMAL:
      return distribution.median > 0 && distribution.median <= 1 && distribution.errorFactor >= 1 ? [] : ["Lognormal median must be in (0, 1] and error factor at least one."];
    case DistributionType.NORMAL:
      return distribution.mean >= 0 && distribution.mean <= 1 && distribution.stdDev >= 0 ? [] : ["Normal mean must be in [0, 1] and standard deviation non-negative."];
    case DistributionType.UNIFORM:
      return distribution.lower >= 0 && distribution.lower < distribution.upper && distribution.upper <= 1 ? [] : ["Uniform bounds must satisfy 0 ≤ lower < upper ≤ 1."];
    case DistributionType.GAMMA:
      return distribution.shape > 0 && distribution.rate > 0 ? [] : ["Gamma shape and rate must be positive."];
    case DistributionType.EXPONENTIAL:
      return distribution.failureRate > 0 ? [] : ["Exponential rate must be positive."];
    default:
      return [`The ${distribution.type} distribution is not supported for fault-tree sampling.`];
  }
}

function formatValue(value: number): string {
  const size = Math.abs(value);
  return size >= 0.01 && size < 1000 ? String(Number(value.toPrecision(4))) : value.toExponential(1).toUpperCase();
}

function distributionLabel(distribution: ParameterDistribution): string {
  switch (distribution.type) {
    case DistributionType.BETA: return `Beta, alpha ${formatValue(distribution.alpha)}, beta ${formatValue(distribution.betaParam)}`;
    case DistributionType.LOGNORMAL: return `Lognormal, median ${formatValue(distribution.median)}, error factor ${formatValue(distribution.errorFactor)}`;
    case DistributionType.NORMAL: return `Normal, mean ${formatValue(distribution.mean)}, standard deviation ${formatValue(distribution.stdDev)}`;
    case DistributionType.UNIFORM: return `Uniform, ${formatValue(distribution.lower)} to ${formatValue(distribution.upper)}`;
    case DistributionType.GAMMA: return `Gamma, shape ${formatValue(distribution.shape)}, rate ${formatValue(distribution.rate)}`;
    case DistributionType.EXPONENTIAL: return `Exponential, rate ${formatValue(distribution.failureRate)}`;
    case DistributionType.POINT_ESTIMATE: return `Point value ${formatValue(distribution.value)}`;
    default: return distribution.type;
  }
}

function analysisModelBasicEvents(sy: Pick<SystemsAnalysis, "systemLogicModels" | "systemBasicEvents">, model: SystemLogicModel): SystemBasicEvent[] {
  const events = new Map<string, SystemBasicEvent>();
  const visited = new Set<string>();
  const pending = [model];
  while (pending.length > 0) {
    const current = pending.pop()!;
    if (visited.has(current.uuid)) continue;
    visited.add(current.uuid);
    systemLogicModelBasicEvents(sy, current).forEach((event) => events.set(event.uuid, event));
    current.leafNodes.forEach((leaf) => {
      if (leaf.kind !== "TRANSFER_REFERENCE") return;
      const target = sy.systemLogicModels.find((candidate) => candidate.uuid === leaf.target.modelId);
      if (target !== undefined && !visited.has(target.uuid)) pending.push(target);
    });
  }
  return [...events.values()];
}

function linkedModelInputs(
  sy: Pick<SystemsAnalysis, "systemLogicModels" | "systemBasicEvents" | "commonCauseFailureGroups">,
  model: SystemLogicModel,
  parameters: readonly SyControlledParameterOption[],
): LinkedInput[] {
  const events = analysisModelBasicEvents(sy, model);
  const eventById = new Map(events.map((event) => [event.uuid, event]));
  const sampledSource = (id: string): string | undefined => {
    const event = eventById.get(id);
    const source = event === undefined ? undefined : eventParameter(event, parameters);
    return source?.uncertainty === undefined || source.uncertainty.type === DistributionType.POINT_ESTIMATE ? undefined : `${source.workbookId}/${source.parameterId}`;
  };
  const mixedGroups = new Map<string, string>();
  (sy.commonCauseFailureGroups ?? []).forEach((group) => {
    const members = group.members?.basicEvents.map((member) => member.id) ?? [];
    if (members.length < 2 || members.some((id) => !eventById.has(id))) return;
    const sources = members.map(sampledSource);
    const sampled = new Set(sources.filter((key) => key !== undefined));
    if (sampled.size === 0 || (sampled.size === 1 && sources.every((key) => key !== undefined))) return;
    members.forEach((id) => mixedGroups.set(id, group.name));
  });
  return events.filter((event) => event.failureMode !== "COMMON_CAUSE_FAILURE").flatMap((event): LinkedInput[] => {
    const source = eventParameter(event, parameters);
    if (source?.uncertainty === undefined || source.uncertainty.type === DistributionType.POINT_ESTIMATE) return [];
    const issues = distributionIssues(source.uncertainty).map((message) => issue("DISTRIBUTION", "ERROR", message));
    if (event.controlledDataSource?.referenceType !== "WORKBOOK_PARAMETER") issues.push(issue("LEGACY_LINK", "ERROR", "Linked by the old DA reference only. Pick the estimate in Step 02 so runs sample it."));
    if (source.rateUnit !== undefined || event.quantificationBasis?.kind === "FAILURE_RATE") issues.push(issue("RATE", "ERROR", "Failure-rate sampling needs mission-time conversion."));
    const group = mixedGroups.get(event.uuid);
    if (group !== undefined) issues.push(issue("CCF_SOURCE", "ERROR", `The members of ${group} link different DA estimates. Link all of them to one estimate in Step 02.`));
    return [{ event, source, distribution: source.uncertainty, issues }];
  });
}

function runReadiness(
  sy: Pick<SystemsAnalysis, "systemLogicModels" | "systemBasicEvents" | "commonCauseFailureGroups">,
  model: SystemLogicModel,
  parameters: readonly SyControlledParameterOption[],
): RunReadiness {
  const inputs = linkedModelInputs(sy, model, parameters);
  if (inputs.length === 0) return { state: "NO_INPUTS", inputs, message: "No basic event in this fault tree has a DA distribution. Link a DA workbook in Step 01 Interfaces, then pick each event's estimate in Step 02." };
  const blocking = inputs.flatMap((input) => input.issues.filter((item) => item.severity === "ERROR").map((item) => `${input.event.code}: ${item.message}`));
  if (blocking.length > 0) return { state: "NEEDS_FIX", inputs, message: blocking[0] ?? "" };
  return { state: "READY", inputs, message: "" };
}

function inputRows(
  sy: Pick<SystemsAnalysis, "systemLogicModels" | "systemBasicEvents" | "commonCauseFailureGroups">,
  systemId: string,
  parameters: readonly SyControlledParameterOption[],
): InputRow[] {
  const model = sy.systemLogicModels.find((candidate) => candidate.systemReference === systemId);
  if (model === undefined) return [];
  const linked = new Map(linkedModelInputs(sy, model, parameters).map((input) => [input.event.uuid, input]));
  return treeEvents(sy, systemId)
    .filter((event) => event.failureMode !== "HUMAN_ERROR" && event.failureMode !== "COMMON_CAUSE_FAILURE")
    .map((event): InputRow => {
      const input = linked.get(event.uuid);
      if (input !== undefined) return { event, source: input.source, distribution: input.distribution, issues: input.issues };
      const source = eventParameter(event, parameters);
      if (source !== undefined) return { event, source, issues: [issue("NO_DISTRIBUTION", "WARNING", "The DA estimate has no distribution, so the run keeps its point value.")] };
      if (event.failureMode === "TEST_MAINTENANCE") return { event, issues: [] };
      return { event, issues: [issue("NO_ESTIMATE", "WARNING", "No DA estimate is linked, so the run keeps its point value.")] };
    });
}

function systemAnalyses(sy: Pick<SystemsAnalysis, "uncertaintyAnalyses">, systemId: string): SystemUncertaintyAnalysis[] {
  return (sy.uncertaintyAnalyses ?? []).filter((analysis) => analysis.system === systemId);
}

function modelSources(sy: Pick<SystemsAnalysis, "uncertaintyAnalyses">, systemId: string): ModelSource[] {
  return systemAnalyses(sy, systemId).flatMap((analysis) => analysis.modelUncertainties);
}

function ccfSources(sy: Pick<SystemsAnalysis, "uncertaintyAnalyses">, systemId: string): CcfSource[] {
  return systemAnalyses(sy, systemId).flatMap((analysis) => analysis.ccfUncertainties ?? []);
}

function dependencySources(sy: Pick<SystemsAnalysis, "uncertaintyAnalyses">, systemId: string): DependencySource[] {
  return systemAnalyses(sy, systemId).flatMap((analysis) => analysis.dependencyUncertainties ?? []);
}

function sourceOptions(sy: Pick<SystemsAnalysis, "uncertaintyAnalyses">, systemId: string): { id: string; label: string }[] {
  return [
    ...modelSources(sy, systemId).map((item) => ({ id: item.uncertaintyId, label: item.description })),
    ...ccfSources(sy, systemId).map((item) => ({ id: item.uncertaintyId, label: item.description })),
    ...dependencySources(sy, systemId).map((item) => ({ id: item.uncertaintyId, label: item.description })),
  ];
}

function sourceSystem(sy: Pick<SystemsAnalysis, "uncertaintyAnalyses">, uncertaintyId: string): string | undefined {
  return (sy.uncertaintyAnalyses ?? []).find((analysis) =>
    analysis.modelUncertainties.some((item) => item.uncertaintyId === uncertaintyId)
    || (analysis.ccfUncertainties ?? []).some((item) => item.uncertaintyId === uncertaintyId)
    || (analysis.dependencyUncertainties ?? []).some((item) => item.uncertaintyId === uncertaintyId))?.system;
}

function systemStudies(sy: Pick<SystemsAnalysis, "uncertaintyAnalyses" | "sensitivityStudies">, systemId: string): SensitivityStudy[] {
  const ids = new Set(sourceOptions(sy, systemId).map((option) => option.id));
  return (sy.sensitivityStudies ?? []).filter((study) => study.modelUncertaintyId !== undefined && ids.has(study.modelUncertaintyId));
}

function ownedCcfGroups(sy: Pick<SystemsAnalysis, "commonCauseFailureGroups">, systemId: string): CommonCauseFailureGroup[] {
  return sy.commonCauseFailureGroups.filter((group) => group.affectedSystems[0] === systemId);
}

function relatedCcfGroups(sy: Pick<SystemsAnalysis, "commonCauseFailureGroups">, systemId: string): CommonCauseFailureGroup[] {
  return sy.commonCauseFailureGroups.filter((group) => group.affectedSystems.includes(systemId));
}

function modelSourceIssues(item: ModelSource): UncertaintyIssue[] {
  const issues: UncertaintyIssue[] = [];
  if (blank(item.description)) issues.push(issue("SOURCE_WHAT", "ERROR", "Say what the source is."));
  if (blank(item.impact)) issues.push(issue("SOURCE_EFFECT", "WARNING", "Effect on the results not recorded."));
  if (blank(item.treatmentApproach)) issues.push(issue("SOURCE_TREATMENT", "WARNING", "Treatment not recorded."));
  return issues;
}

function ccfSourceIssues(sy: Pick<SystemsAnalysis, "commonCauseFailureGroups">, systemId: string, item: CcfSource): UncertaintyIssue[] {
  const issues: UncertaintyIssue[] = [];
  if (!relatedCcfGroups(sy, systemId).some((group) => group.uuid === item.ccfGroupId)) issues.push(issue("CCF_GONE", "WARNING", "The common cause group is not in this system any more."));
  if (blank(item.description)) issues.push(issue("SOURCE_WHAT", "ERROR", "Say what the source is."));
  if (blank(item.impact)) issues.push(issue("SOURCE_EFFECT", "WARNING", "Effect on the results not recorded."));
  return issues;
}

function dependencySourceIssues(sy: Pick<SystemsAnalysis, "systemDefinitions">, item: DependencySource): UncertaintyIssue[] {
  const issues: UncertaintyIssue[] = [];
  if (item.supportingSystem !== undefined && !sy.systemDefinitions.some((system) => system.uuid === item.supportingSystem)) {
    issues.push(issue("SUPPORT_GONE", "WARNING", "The support system is not in scope any more."));
  }
  if (blank(item.description)) issues.push(issue("SOURCE_WHAT", "ERROR", "Say what the source is."));
  if (blank(item.impact)) issues.push(issue("SOURCE_EFFECT", "WARNING", "Effect on the results not recorded."));
  return issues;
}

function studyIssues(sy: Pick<SystemsAnalysis, "uncertaintyAnalyses">, study: SensitivityStudy): UncertaintyIssue[] {
  const issues: UncertaintyIssue[] = [];
  if (blank(study.description)) issues.push(issue("STUDY_WHAT", "ERROR", "Say what the study varies."));
  if (study.modelUncertaintyId === undefined || sourceSystem(sy, study.modelUncertaintyId) === undefined) issues.push(issue("STUDY_SOURCE", "ERROR", "Pick the source it tests."));
  if (study.variedParameters.length === 0) issues.push(issue("STUDY_PARAMETERS", "WARNING", "No varied parameter."));
  study.variedParameters.forEach((name) => {
    const range = study.parameterRanges[name];
    if (range === undefined || !(range[0] < range[1])) issues.push(issue("STUDY_RANGE", "WARNING", `Set the range for ${name}.`));
  });
  if (blank(study.results)) issues.push(issue("STUDY_RESULT", "WARNING", "Result not recorded."));
  return issues;
}

function coverageIssues(sy: UncertaintyAnalysis, systemId: string): UncertaintyIssue[] {
  const issues: UncertaintyIssue[] = [];
  if (modelSources(sy, systemId).length === 0) issues.push(issue("COVERAGE_MODEL", "WARNING", "No model uncertainty recorded for this system (SY-A32)."));
  const covered = new Set(ccfSources(sy, systemId).map((item) => item.ccfGroupId));
  ownedCcfGroups(sy, systemId).filter((group) => !covered.has(group.uuid)).forEach((group) => {
    issues.push(issue("COVERAGE_CCF", "WARNING", `No uncertainty recorded for the ${group.name} group (SY-B16).`));
  });
  return issues;
}

function plantItems(sy: Pick<SystemsAnalysis, "modelUncertainty">, list: PlantList): { text: string; detail: string; systems: string[] }[] {
  const documentation = sy.modelUncertainty;
  if (list === "sources") return documentation.uncertaintySources.map((item) => ({ text: item.source, detail: item.impact, systems: item.applicableElements ?? [] }));
  if (list === "assumptions") return documentation.relatedAssumptions.map((item) => ({ text: item.assumption, detail: item.basis, systems: item.applicableElements ?? [] }));
  return documentation.reasonableAlternatives.map((item) => ({ text: item.alternative, detail: item.reasonNotSelected, systems: item.applicableElements ?? [] }));
}

function plantItemIssues(item: { text: string; detail: string; systems: readonly string[] }, list: PlantList): UncertaintyIssue[] {
  const issues: UncertaintyIssue[] = [];
  if (blank(item.text)) issues.push(issue("PLANT_WHAT", "ERROR", list === "sources" ? "Say what the source is." : list === "assumptions" ? "Say what is assumed." : "Say what the alternative is."));
  if (blank(item.detail)) issues.push(issue("PLANT_DETAIL", "WARNING", list === "sources" ? "Effect on the results not recorded." : list === "assumptions" ? "Basis not recorded." : "Why it was not selected is not recorded."));
  if (item.systems.length === 0) issues.push(issue("PLANT_SYSTEMS", "WARNING", "Pick the systems it applies to."));
  return issues;
}

function newSystemAnalysis(systemId: string): SystemUncertaintyAnalysis {
  return {
    uuid: crypto.randomUUID(),
    system: systemId,
    propagationMethod: "MONTE_CARLO",
    modelUncertainties: [],
    parameterUncertainties: [],
    implementsSrs: [{ sr: "SY-A32", hlr: "A" }, { sr: "SY-B16", hlr: "B" }],
  };
}

function withSystemAnalysis(
  draft: SystemsAnalysis,
  systemId: string,
  change: (analysis: SystemUncertaintyAnalysis) => SystemUncertaintyAnalysis,
): SystemsAnalysis {
  const analyses = draft.uncertaintyAnalyses ?? [];
  const index = analyses.findIndex((analysis) => analysis.system === systemId);
  if (index < 0) return { ...draft, uncertaintyAnalyses: [...analyses, change(newSystemAnalysis(systemId))] };
  return { ...draft, uncertaintyAnalyses: analyses.map((analysis, position) => (position === index ? change(analysis) : analysis)) };
}

function uncertaintyErrors(sy: UncertaintyAnalysis): UncertaintyIssue[] {
  return [
    ...sy.systemDefinitions.flatMap((system) => [
      ...(modelSources(sy, system.uuid).length === 0 ? [issue("COVERAGE_MODEL", "ERROR", `${system.name} has no model uncertainty recorded.`)] : []),
      ...modelSources(sy, system.uuid).flatMap(modelSourceIssues),
      ...ccfSources(sy, system.uuid).flatMap((item) => ccfSourceIssues(sy, system.uuid, item)),
      ...dependencySources(sy, system.uuid).flatMap((item) => dependencySourceIssues(sy, item)),
    ]),
    ...(sy.sensitivityStudies ?? []).flatMap((study) => studyIssues(sy, study)),
    ...PLANT_LISTS.flatMap((list) => plantItems(sy, list).flatMap((item) => plantItemIssues(item, list))),
  ].filter((item) => item.severity === "ERROR");
}

export {
  PLANT_LISTS,
  analysisModelBasicEvents,
  ccfSourceIssues,
  ccfSources,
  coverageIssues,
  dependencySourceIssues,
  dependencySources,
  distributionIssues,
  distributionLabel,
  inputRows,
  linkedModelInputs,
  modelSourceIssues,
  modelSources,
  ownedCcfGroups,
  plantItemIssues,
  plantItems,
  relatedCcfGroups,
  runReadiness,
  sourceOptions,
  sourceSystem,
  studyIssues,
  systemAnalyses,
  systemStudies,
  uncertaintyErrors,
  withSystemAnalysis,
  type CcfSource,
  type DependencySource,
  type InputRow,
  type LinkedInput,
  type ModelSource,
  type PlantList,
  type RunReadiness,
  type RunState,
  type UncertaintyAnalysis,
  type UncertaintyIssue,
};
