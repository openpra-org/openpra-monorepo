import type { SystemLogicModel, SystemsAnalysis } from "interfaces-mef-types/sy/systems-analysis";
import { systemFaultTreeBasicEventIds } from "interfaces-mef-types/sy/system-models";
import { applyFaultTreeOperation, type FaultTreeEditorModel } from "../newly-developed-methods/fault-tree";

interface SystemRemoval {
  analysis: SystemsAnalysis;
  faultTrees: number;
  basicEvents: number;
  commonCauseGroups: number;
  transfers: number;
  records: number;
}

function removedCount<T>(before: readonly T[] | undefined, after: readonly T[] | undefined): number {
  return (before?.length ?? 0) - (after?.length ?? 0);
}

function kept<T>(items: T[] | undefined, keep: (item: T) => boolean): T[] | undefined {
  return items === undefined ? undefined : items.filter(keep);
}

function withoutElement<T extends { applicableElements?: string[] }>(items: T[], systemId: string): T[] {
  return items.flatMap((item) => {
    const elements = item.applicableElements;
    if (elements === undefined || !elements.includes(systemId)) return [item];
    const applicableElements = elements.filter((id) => id !== systemId);
    return applicableElements.length === 0 ? [] : [{ ...item, applicableElements }];
  });
}

function withoutTransfers(model: SystemLogicModel, leafIds: readonly string[]): SystemLogicModel {
  const initial: FaultTreeEditorModel = {
    modelId: model.uuid,
    code: model.code,
    name: model.name,
    description: model.description,
    topGate: model.topGate,
    gates: model.gates,
    leafNodes: model.leafNodes,
    gateInputs: model.gateInputs,
    nodePositions: model.nodePositions,
    layout: model.layout,
  };
  const editor = leafIds.reduce(
    (current, leafId) => applyFaultTreeOperation(current, { basicEvents: [] }, { type: "DELETE_LEAF", leafId }).model,
    initial,
  );
  const { modelId: _modelId, ...tree } = editor;
  return { ...model, ...tree };
}

function withoutSystem(sy: SystemsAnalysis, systemId: string): SystemRemoval {
  const removedModels = sy.systemLogicModels.filter((model) => model.systemReference === systemId);
  const removedModelIds = new Set(removedModels.map((model) => model.uuid));
  const transferIds = (model: SystemLogicModel): string[] => model.leafNodes.flatMap((leaf) =>
    leaf.kind === "TRANSFER_REFERENCE" && removedModelIds.has(leaf.target.modelId) ? [leaf.id] : []);
  const otherModels = sy.systemLogicModels.filter((model) => !removedModelIds.has(model.uuid));
  const transfers = otherModels.reduce((total, model) => total + transferIds(model).length, 0);
  const systemLogicModels = otherModels.map((model) => {
    const ids = transferIds(model);
    return ids.length === 0 ? model : withoutTransfers(model, ids);
  });

  const keptEventIds = new Set(systemLogicModels.flatMap((model) => systemFaultTreeBasicEventIds(model)));
  const removedEventIds = new Set(removedModels.flatMap((model) => systemFaultTreeBasicEventIds(model)).filter((id) => !keptEventIds.has(id)));

  const removedGroupIds = new Set(sy.commonCauseFailureGroups.filter((group) => {
    if (group.affectedSystems[0] === systemId) return true;
    const members = group.members?.basicEvents ?? [];
    const left = members.filter((member) => !removedEventIds.has(member.id)).length;
    return left < members.length && left < 2;
  }).map((group) => group.uuid));
  const commonCauseFailureGroups = sy.commonCauseFailureGroups.filter((group) => !removedGroupIds.has(group.uuid)).map((group) => {
    const affectedSystems = group.affectedSystems.filter((id) => id !== systemId);
    const members = group.members === undefined ? undefined : { ...group.members, basicEvents: group.members.basicEvents.filter((member) => !removedEventIds.has(member.id)) };
    const unchanged = affectedSystems.length === group.affectedSystems.length && members?.basicEvents.length === group.members?.basicEvents.length;
    return unchanged ? group : { ...group, affectedSystems, members };
  });

  const analyses = sy.uncertaintyAnalyses;
  const removedAnalyses = (analyses ?? []).filter((analysis) => analysis.system === systemId);
  const otherAnalyses = (analyses ?? []).filter((analysis) => analysis.system !== systemId);
  const droppedItems = otherAnalyses.flatMap((analysis) => [
    ...(analysis.ccfUncertainties ?? []).filter((item) => removedGroupIds.has(item.ccfGroupId)),
    ...(analysis.dependencyUncertainties ?? []).filter((item) => item.supportingSystem === systemId),
  ]);
  const removedSourceIds = new Set([
    ...removedAnalyses.flatMap((analysis) => [
      ...analysis.modelUncertainties.map((item) => item.uncertaintyId),
      ...(analysis.ccfUncertainties ?? []).map((item) => item.uncertaintyId),
      ...(analysis.dependencyUncertainties ?? []).map((item) => item.uncertaintyId),
    ]),
    ...droppedItems.map((item) => item.uncertaintyId),
  ]);
  const uncertaintyAnalyses = analyses === undefined ? undefined : otherAnalyses.map((analysis) => {
    const ccfUncertainties = analysis.ccfUncertainties?.filter((item) => !removedGroupIds.has(item.ccfGroupId));
    const dependencyUncertainties = analysis.dependencyUncertainties?.filter((item) => item.supportingSystem !== systemId);
    const unchanged = ccfUncertainties?.length === analysis.ccfUncertainties?.length && dependencyUncertainties?.length === analysis.dependencyUncertainties?.length;
    return unchanged ? analysis : { ...analysis, ccfUncertainties, dependencyUncertainties };
  });

  const modelUncertainty = {
    ...sy.modelUncertainty,
    uncertaintySources: withoutElement(sy.modelUncertainty.uncertaintySources, systemId),
    relatedAssumptions: withoutElement(sy.modelUncertainty.relatedAssumptions, systemId),
    reasonableAlternatives: withoutElement(sy.modelUncertainty.reasonableAlternatives, systemId),
  };
  const preOperationalAssumptions = sy.preOperationalAssumptions?.flatMap((item) => {
    if (!item.affectedElementIds.includes(systemId)) return [item];
    const affectedElementIds = item.affectedElementIds.filter((id) => id !== systemId);
    return affectedElementIds.length === 0 ? [] : [{ ...item, affectedElementIds }];
  });
  const supportSystemSuccessCriteria = sy.supportSystemSuccessCriteria?.flatMap((item) => {
    if (item.systemReference === systemId) return [];
    if (!item.supportedSystems.includes(systemId)) return [item];
    const supportedSystems = item.supportedSystems.filter((id) => id !== systemId);
    return supportedSystems.length === 0 ? [] : [{ ...item, supportedSystems }];
  });
  const dependencyHclConfigurations = sy.dependencyHclConfigurations?.map((configuration) => {
    const faultTrees = configuration.faultTrees.filter((tree) => !removedModelIds.has(tree.modelId));
    const bindings = configuration.bindings.filter((binding) => !removedEventIds.has(binding.faultTreeBasicEvent.entityId));
    const unchanged = faultTrees.length === configuration.faultTrees.length && bindings.length === configuration.bindings.length;
    return unchanged ? configuration : { ...configuration, faultTrees, bindings };
  });

  const analysis: SystemsAnalysis = {
    ...sy,
    systemDefinitions: sy.systemDefinitions.filter((item) => item.uuid !== systemId),
    systemToSafetyFunctionMappings: sy.systemToSafetyFunctionMappings.filter((item) => item.systemReference !== systemId),
    systemLogicModels,
    systemBasicEvents: sy.systemBasicEvents.filter((item) => !removedEventIds.has(item.uuid)),
    variableSuccessCriteria: kept(sy.variableSuccessCriteria, (item) => item.systemReference !== systemId),
    systemConfirmationRecords: kept(sy.systemConfirmationRecords, (item) => item.systemReference !== systemId),
    systemDependencies: sy.systemDependencies.filter((item) => item.dependentSystem !== systemId && item.supportingSystem !== systemId),
    componentDependencies: sy.componentDependencies.filter((item) => item.system !== systemId),
    dependencyHclConfigurations,
    dependencySearchMethodology: {
      ...sy.dependencySearchMethodology,
      systemsAnalyzed: sy.dependencySearchMethodology.systemsAnalyzed.filter((id) => id !== systemId),
    },
    commonCauseFailureGroups,
    supportSystemNeedAnalyses: kept(sy.supportSystemNeedAnalyses, (item) => item.systemReference !== systemId),
    supportSystemSuccessCriteria,
    humanFailureEventIntegrations: sy.humanFailureEventIntegrations.filter((item) => item.system !== systemId),
    isolationTripConditions: kept(sy.isolationTripConditions, (item) => item.systemReference !== systemId),
    modularizationRecords: kept(sy.modularizationRecords, (item) => item.systemReference !== systemId),
    simultaneousUnavailabilityEvents: kept(sy.simultaneousUnavailabilityEvents, (item) => item.systemReference !== systemId),
    componentScreeningJustifications: kept(sy.componentScreeningJustifications, (item) => item.systemReference !== systemId),
    lpsdSystemConfigurations: kept(sy.lpsdSystemConfigurations, (item) => item.systemReference !== systemId),
    environmentalDesignBasisConsiderations: kept(sy.environmentalDesignBasisConsiderations, (item) => item.systemReference !== systemId),
    initiationActuationSystems: kept(sy.initiationActuationSystems, (item) => item.systemReference !== systemId),
    digitalInstrumentationAndControl: kept(sy.digitalInstrumentationAndControl, (item) => item.systemReference !== systemId),
    passiveSystemsTreatments: kept(sy.passiveSystemsTreatments, (item) => item.systemReference !== systemId),
    depletionModels: kept(sy.depletionModels, (item) => item.associatedSystem !== systemId),
    overCapacityConsiderations: kept(sy.overCapacityConsiderations, (item) => item.system !== systemId),
    modelValidations: kept(sy.modelValidations, (item) => item.systemReference !== systemId),
    componentBoundaryReviews: kept(sy.componentBoundaryReviews, (item) => item.systemReference !== systemId),
    nomenclatureDesignators: kept(sy.nomenclatureDesignators, (item) => item.systemReference !== systemId),
    systemModelEvaluations: kept(sy.systemModelEvaluations, (item) => item.system !== systemId),
    uncertaintyAnalyses,
    sensitivityStudies: kept(sy.sensitivityStudies, (study) => study.modelUncertaintyId === undefined || !removedSourceIds.has(study.modelUncertaintyId)),
    modelUncertainty,
    preOperationalAssumptions,
  };

  const records = [
    removedCount(sy.variableSuccessCriteria, analysis.variableSuccessCriteria),
    removedCount(sy.systemConfirmationRecords, analysis.systemConfirmationRecords),
    removedCount(sy.systemDependencies, analysis.systemDependencies),
    removedCount(sy.componentDependencies, analysis.componentDependencies),
    removedCount(sy.supportSystemNeedAnalyses, analysis.supportSystemNeedAnalyses),
    removedCount(sy.supportSystemSuccessCriteria, analysis.supportSystemSuccessCriteria),
    removedCount(sy.humanFailureEventIntegrations, analysis.humanFailureEventIntegrations),
    removedCount(sy.isolationTripConditions, analysis.isolationTripConditions),
    removedCount(sy.modularizationRecords, analysis.modularizationRecords),
    removedCount(sy.simultaneousUnavailabilityEvents, analysis.simultaneousUnavailabilityEvents),
    removedCount(sy.componentScreeningJustifications, analysis.componentScreeningJustifications),
    removedCount(sy.lpsdSystemConfigurations, analysis.lpsdSystemConfigurations),
    removedCount(sy.environmentalDesignBasisConsiderations, analysis.environmentalDesignBasisConsiderations),
    removedCount(sy.initiationActuationSystems, analysis.initiationActuationSystems),
    removedCount(sy.digitalInstrumentationAndControl, analysis.digitalInstrumentationAndControl),
    removedCount(sy.passiveSystemsTreatments, analysis.passiveSystemsTreatments),
    removedCount(sy.depletionModels, analysis.depletionModels),
    removedCount(sy.overCapacityConsiderations, analysis.overCapacityConsiderations),
    removedCount(sy.modelValidations, analysis.modelValidations),
    removedCount(sy.componentBoundaryReviews, analysis.componentBoundaryReviews),
    removedCount(sy.nomenclatureDesignators, analysis.nomenclatureDesignators),
    removedCount(sy.systemModelEvaluations, analysis.systemModelEvaluations),
    removedCount(sy.uncertaintyAnalyses, analysis.uncertaintyAnalyses),
    removedCount(sy.sensitivityStudies, analysis.sensitivityStudies),
    removedCount(sy.preOperationalAssumptions, analysis.preOperationalAssumptions),
    removedCount(sy.modelUncertainty.uncertaintySources, modelUncertainty.uncertaintySources),
    removedCount(sy.modelUncertainty.relatedAssumptions, modelUncertainty.relatedAssumptions),
    removedCount(sy.modelUncertainty.reasonableAlternatives, modelUncertainty.reasonableAlternatives),
    droppedItems.length,
  ].reduce((total, count) => total + count, 0);

  return {
    analysis,
    faultTrees: removedModels.filter((model) => model.gates.length > 0 || model.leafNodes.length > 0).length,
    basicEvents: removedEventIds.size,
    commonCauseGroups: removedGroupIds.size,
    transfers,
    records,
  };
}

function counted(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function removalMessage(name: string, removal: SystemRemoval): string | null {
  const parts = [
    removal.faultTrees > 0 ? "its fault tree" : null,
    removal.basicEvents > 0 ? counted(removal.basicEvents, "basic event") : null,
    removal.commonCauseGroups > 0 ? counted(removal.commonCauseGroups, "common cause group") : null,
    removal.records > 0 ? `${counted(removal.records, "other record")} about it` : null,
  ].filter((part): part is string => part !== null);
  const transfers = removal.transfers > 0 ? `${counted(removal.transfers, "transfer")} to it from other fault trees` : null;
  if (parts.length === 0 && transfers === null) return null;
  const listed = parts.length <= 1 ? parts.join("") : `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
  if (transfers === null) return `Removing ${name} also removes ${listed}.`;
  if (parts.length === 0) return `Removing ${name} also removes ${transfers}.`;
  return `Removing ${name} also removes ${listed}. It removes ${transfers} too.`;
}

export { removalMessage, withoutSystem, type SystemRemoval };
