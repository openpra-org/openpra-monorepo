import { DistributionType, type ParameterDistribution } from "interfaces-mef-types/core/events";
import type { SystemsAnalysis, SystemLogicModel } from "interfaces-mef-types/sy/systems-analysis";
import { systemLogicModelBasicEvents } from "interfaces-mef-types/sy/system-models";
import type { SyControlledParameterOption } from "./syWorkbookContext";

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

function analysisModelBasicEvents(sy: SystemsAnalysis, model: SystemLogicModel) {
  const events = new Map<string, SystemsAnalysis["systemBasicEvents"][number]>();
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

function linkedModelInputs(sy: SystemsAnalysis, model: SystemLogicModel, parameters: SyControlledParameterOption[]) {
  const events = analysisModelBasicEvents(sy, model);
  const eventIds = new Set(events.map((event) => event.uuid));
  const ccfMembers = new Set((sy.commonCauseFailureGroups ?? [])
    .filter((group) => (group.members?.basicEvents.length ?? 0) >= 2 && group.members!.basicEvents.every((member) => eventIds.has(member.id)))
    .flatMap((group) => group.members?.basicEvents.map((member) => member.id) ?? []));
  return events.filter((event) => event.failureMode !== "COMMON_CAUSE_FAILURE").flatMap((event) => {
    const reference = event.controlledDataSource;
    if (reference?.referenceType !== "WORKBOOK_PARAMETER") return [];
    const source = parameters.find((parameter) => parameter.workbookId === reference.workbookId && parameter.parameterId === reference.entityId);
    if (source?.uncertainty === undefined || source.uncertainty.type === DistributionType.POINT_ESTIMATE) return [];
    const issues = distributionIssues(source.uncertainty);
    if (source.parameterType === "FREQUENCY" || event.quantificationBasis?.kind === "FAILURE_RATE") issues.push("Failure-rate sampling needs mission-time conversion.");
    if (ccfMembers.has(event.uuid)) issues.push("CCF expansion cannot propagate this member distribution.");
    return [{ event, source, distribution: source.uncertainty, issues }];
  });
}

export { analysisModelBasicEvents, distributionIssues, linkedModelInputs };
