import { ccfFactorExpressions, ccfFactorVector, type CcfFactorModel, type UncertainExpression, type UncertainVector } from "interfaces-mef-types/core/uncertainty";
import type { SensitivityStudy } from "interfaces-mef-types/core/shared-patterns";
import {
  carriesUncertainExpression,
  type CommonCauseFailureGroup,
  type SystemBasicEvent,
  type SystemsAnalysis,
  type SystemLogicModel,
  type SystemUncertaintyAnalysis,
} from "interfaces-mef-types/sy/systems-analysis";
import { systemLogicModelBasicEvents } from "interfaces-mef-types/sy/system-models";
import { treeEvents } from "./syIntegrityChecks";
import { ccfGroupsForModel, type CcfAnalysis } from "./syCcf";
import { expressionUncertain, linkedOptions, missingReferences, valueTable, type ParameterTable } from "./syBasicEventValues";
import type { SyControlledParameterOption } from "./syWorkbookContext";

interface UncertaintyIssue {
  code: string;
  severity: "ERROR" | "WARNING";
  message: string;
}

interface UncertaintyInput {
  event: SystemBasicEvent;
  expression?: UncertainExpression;
  sources: SyControlledParameterOption[];
  uncertain: boolean;
  issues: UncertaintyIssue[];
}

type RunState = "READY" | "NO_INPUTS" | "NEEDS_FIX";

interface RunReadiness {
  state: RunState;
  inputs: UncertaintyInput[];
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

function vectorUncertain(vector: UncertainVector | undefined): boolean {
  if (vector === undefined) return false;
  return vector.node === "PARAMETER" || vector.law.family === "DIRICHLET";
}

function factorsUncertain(factors: CcfFactorModel, table: ParameterTable): boolean {
  return vectorUncertain(ccfFactorVector(factors)) || ccfFactorExpressions(factors).some((expression) => expressionUncertain(expression, table));
}

function ccfUncertain(sy: CcfAnalysis, model: SystemLogicModel, table: ParameterTable): boolean {
  return ccfGroupsForModel(sy, model).some((group) => factorsUncertain(group.factors, table) || expressionUncertain(group.total, table));
}

function eventInput(event: SystemBasicEvent, parameters: readonly SyControlledParameterOption[], table: ParameterTable): UncertaintyInput {
  const expression = event.expression;
  const issues: UncertaintyIssue[] = [];
  if (expression === undefined) issues.push(issue("NO_VALUE", "ERROR", "No value yet. Set it in Step 02."));
  if (missingReferences(expression, table).length > 0) issues.push(issue("SOURCE_MISSING", "WARNING", "It links a value that is not in the linked DA or SC workbook."));
  return {
    event,
    ...(expression === undefined ? {} : { expression }),
    sources: linkedOptions(expression, parameters),
    uncertain: expression !== undefined && expressionUncertain(expression, table),
    issues,
  };
}

function modelInputs(
  sy: Pick<SystemsAnalysis, "systemLogicModels" | "systemBasicEvents" | "commonCauseFailureGroups">,
  model: SystemLogicModel,
  parameters: readonly SyControlledParameterOption[],
  missionTimes: ParameterTable,
): UncertaintyInput[] {
  const events = analysisModelBasicEvents(sy, model).filter((event) => carriesUncertainExpression(event.failureMode));
  const table = valueTable(parameters, missionTimes);
  return events.map((event) => eventInput(event, parameters, table));
}

function runReadiness(
  sy: Pick<SystemsAnalysis, "systemDefinitions" | "systemLogicModels" | "systemBasicEvents" | "commonCauseFailureGroups">,
  model: SystemLogicModel,
  parameters: readonly SyControlledParameterOption[],
  missionTimes: ParameterTable,
): RunReadiness {
  const inputs = modelInputs(sy, model, parameters, missionTimes);
  const blocking = inputs.flatMap((input) => input.issues.filter((item) => item.severity === "ERROR").map((item) => `${input.event.code}: ${item.message}`));
  if (blocking.length > 0) return { state: "NEEDS_FIX", inputs, message: blocking[0] ?? "" };
  if (!inputs.some((input) => input.uncertain) && !ccfUncertain(sy, model, valueTable(parameters, missionTimes))) {
    return { state: "NO_INPUTS", inputs, message: "No basic event or common cause group in this fault tree holds an uncertain value. Give one a distribution, or link a DA estimate that has one." };
  }
  return { state: "READY", inputs, message: "" };
}

function inputRows(
  sy: Pick<SystemsAnalysis, "systemLogicModels" | "systemBasicEvents" | "commonCauseFailureGroups">,
  systemId: string,
  parameters: readonly SyControlledParameterOption[],
  missionTimes: ParameterTable,
): UncertaintyInput[] {
  const model = sy.systemLogicModels.find((candidate) => candidate.systemReference === systemId);
  if (model === undefined) return [];
  const inputs = new Map(modelInputs(sy, model, parameters, missionTimes).map((input) => [input.event.uuid, input]));
  return treeEvents(sy, systemId).flatMap((event) => {
    const input = inputs.get(event.uuid);
    return input === undefined ? [] : [input];
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
  inputRows,
  modelInputs,
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
  type ModelSource,
  type PlantList,
  type RunReadiness,
  type RunState,
  type UncertaintyAnalysis,
  type UncertaintyInput,
  type UncertaintyIssue,
};
