import {
  OTHER_HAZARDS_PRA_SR_CATALOG,
  type OtherHazardsAnalysisRecord,
  type OtherHazardsPRA,
} from "./other-hazards-pra";

export type OtherHazardsPraDiagnosticSeverity = "ERROR" | "WARNING" | "INFORMATION";
export interface OtherHazardsPraDiagnostic {
  code: string;
  severity: OtherHazardsPraDiagnosticSeverity;
  area: "SCOPE" | "OHA" | "OFR" | "OPR" | "INTEGRATION" | "DOCUMENTATION" | "WORKFLOW";
  message: string;
  recordRefs: string[];
}

interface LocatedRecord { path: string; record: OtherHazardsAnalysisRecord }

function isAnalysisRecord(value: unknown): value is OtherHazardsAnalysisRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.uuid === "string"
    && typeof candidate.code === "string"
    && typeof candidate.name === "string"
    && Array.isArray(candidate.implementsSrs);
}

function locatedRecords(mef: OtherHazardsPRA): LocatedRecord[] {
  const located: LocatedRecord[] = [];
  const visit = (value: unknown, path: string): void => {
    if (isAnalysisRecord(value)) located.push({ path, record: value });
    if (value === null || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `${path}.${String(index)}`));
      return;
    }
    Object.entries(value).forEach(([key, child]) => visit(child, path.length === 0 ? key : `${path}.${key}`));
  };
  visit(mef, "");
  return located;
}

function clone(mef: OtherHazardsPRA): OtherHazardsPRA {
  return typeof structuredClone === "function" ? structuredClone(mef) : JSON.parse(JSON.stringify(mef)) as OtherHazardsPRA;
}

export function synchronizeOtherHazardsPraDerivedRegisters(mef: OtherHazardsPRA): OtherHazardsPRA {
  const next = clone(mef);
  const implementation = new Map<string, LocatedRecord[]>();
  for (const located of locatedRecords(next)) {
    for (const reference of located.record.implementsSrs) {
      implementation.set(reference.sr, [...(implementation.get(reference.sr) ?? []), located]);
    }
  }

  next.conformanceMatrix = Object.entries(OTHER_HAZARDS_PRA_SR_CATALOG).map(([sr, entry]) => {
    const existing = next.conformanceMatrix.find((item) => item.sr === sr);
    const implementations = implementation.get(sr) ?? [];
    return {
      sr,
      hlr: entry.hlr,
      capabilityCategory: next.capabilityCategory ?? "CC-II",
      applicableToStage: entry.stages,
      status: !entry.stages.includes(next.plantStage)
        ? "NOT_APPLICABLE"
        : implementations.length > 0
          ? "MET"
          : existing?.status === "NOT_MET" ? "NOT_MET" : "PENDING_REVIEW",
      satisfiedByElementPaths: implementations.map((item) => item.path),
      evidence: implementations.length > 0
        ? implementations.slice(0, 5).map((item) => `${item.record.code} ${item.record.name}`).join("; ")
        : existing?.evidence ?? "",
      reviewNotes: existing?.reviewNotes,
    };
  });
  next.internalReviewComments.openCount = next.internalReviewComments.comments.filter((comment) => !comment.resolved).length;
  next.internalReviewComments.resolvedCount = next.internalReviewComments.comments.filter((comment) => comment.resolved).length;
  next.modified = new Date().toISOString();
  next.metadata.lastModifiedDate = next.modified;
  return next;
}

function probabilityOutOfRange(value: number | undefined): boolean {
  return value !== undefined && (value < 0 || value > 1);
}

function unresolved(references: string[], known: Set<string>): string[] {
  return references.filter((reference) => reference.length > 0 && !known.has(reference));
}

function validHazardCurve(points: Array<{ intensity: number; meanAnnualExceedanceFrequency: number }>): boolean {
  return points.length >= 2 && points.every((point, index) => {
    if (point.intensity < 0 || point.meanAnnualExceedanceFrequency <= 0) return false;
    const previous = points[index - 1];
    return previous === undefined || (point.intensity > previous.intensity && point.meanAnnualExceedanceFrequency < previous.meanAnnualExceedanceFrequency);
  });
}

function validFragilityCurve(points: Array<{ intensity: number; conditionalFailureProbability: number }>): boolean {
  return points.length >= 2 && points.every((point, index) => {
    if (point.intensity < 0 || probabilityOutOfRange(point.conditionalFailureProbability)) return false;
    const previous = points[index - 1];
    return previous === undefined || (point.intensity > previous.intensity && point.conditionalFailureProbability >= previous.conditionalFailureProbability);
  });
}

export function validateOtherHazardsPra(mef: OtherHazardsPRA): OtherHazardsPraDiagnostic[] {
  const diagnostics: OtherHazardsPraDiagnostic[] = [];
  const add = (code: string, severity: OtherHazardsPraDiagnosticSeverity, area: OtherHazardsPraDiagnostic["area"], message: string, recordRefs: string[] = []): void => {
    diagnostics.push({ code, severity, area, message, recordRefs });
  };

  const records = locatedRecords(mef);
  const uuids = new Map<string, string>();
  const codes = new Map<string, string>();
  for (const { path, record } of records) {
    if (uuids.has(record.uuid)) add("O-DUPLICATE-UUID", "ERROR", "INTEGRATION", `Duplicate UUID ${record.uuid} prevents unambiguous traceability.`, [record.uuid, uuids.get(record.uuid) ?? "", path]);
    if (codes.has(record.code)) add("O-DUPLICATE-CODE", "ERROR", "INTEGRATION", `Duplicate record code ${record.code} prevents unambiguous traceability.`, [record.uuid, codes.get(record.code) ?? ""]);
    uuids.set(record.uuid, path);
    codes.set(record.code, record.uuid);
    if (record.status !== "DRAFT" && (record.description.trim().length === 0 || record.basis.trim().length === 0)) add("O-INCOMPLETE-RECORD", "ERROR", "DOCUMENTATION", `${record.code} is ${record.status} but lacks a complete description or basis.`, [record.uuid]);
    const unsupported = record.implementsSrs.filter((reference) => !(reference.sr in OTHER_HAZARDS_PRA_SR_CATALOG));
    if (unsupported.length > 0) add("O-UNSUPPORTED-SR", "ERROR", "DOCUMENTATION", `${record.code} contains unsupported Other Hazards requirement references.`, [record.uuid, ...unsupported.map((item) => item.sr)]);
  }

  if (mef.praScope.trim().length === 0) add("O-SCOPE-001", "ERROR", "SCOPE", "Define the integrated Other Hazards PRA scope.");
  if (mef.analysisBasis.siteBasis === undefined) add("O-SCOPE-002", "ERROR", "SCOPE", "Define a specific or justified bounding site.");
  if (mef.analysisBasis.scopeRecords.length === 0) add("O-SCOPE-003", "ERROR", "SCOPE", "Define the Other Hazards analysis boundary.");
  if (mef.analysisBasis.baselinePra === undefined) add("O-SCOPE-004", "ERROR", "SCOPE", "Define and freeze the baseline PRA.");
  if (mef.analysisBasis.interfaces.length === 0) add("O-SCOPE-005", "ERROR", "SCOPE", "Define technical-element inputs and outputs.");
  if ((mef.analysisBasis.siteBasis?.plantOperatingStateRefs.length ?? 0) === 0) add("O-SCOPE-006", "ERROR", "SCOPE", "Identify every plant operating state covered by the analysis.");
  if (mef.analysisBasis.evidenceRegister.length === 0 || mef.analysisBasis.siteAndRegionalData.length === 0) add("O-SCOPE-007", "WARNING", "SCOPE", "Control the evidence register and site/regional data basis.");

  const hazardGroups = mef.retainedHazardGroups.hazardGroups;
  const hazardGroupRefs = new Set(hazardGroups.map((item) => item.uuid));
  if (hazardGroups.length === 0) add("OHA-A-001", "ERROR", "OHA", "Import at least one retained hazard group from Hazards Screening Analysis.");
  for (const group of hazardGroups) {
    if (group.sourceHsaRefs.length === 0 || group.includedSubhazards.length === 0) add("OHA-A-002", "ERROR", "OHA", `${group.name} lacks an HSA source or a complete subgroup boundary.`, [group.uuid]);
    if (group.selectedIntensityMeasure.trim().length === 0 || group.intensityUnit.trim().length === 0) add("OHA-B-001", "ERROR", "OHA", `${group.name} lacks a selected hazard intensity measure and unit.`, [group.uuid]);
    if (!mef.retainedHazardGroups.completenessReviews.some((review) => review.hazardGroupRef === group.uuid && review.complete)) add("OHA-A-003", "ERROR", "OHA", `${group.name} lacks a completed hazard-group completeness review.`, [group.uuid]);
  }

  const intensityMeasureRefs = new Set(mef.hazardSourceCharacterization.intensityMeasures.map((item) => item.uuid));
  const sourceRefs = new Set(mef.hazardSourceCharacterization.hazardSources.map((item) => item.uuid));
  for (const group of hazardGroups) {
    if (!mef.hazardSourceCharacterization.hazardSources.some((item) => item.hazardGroupRef === group.uuid)) add("OHA-B-002", "ERROR", "OHA", `${group.name} lacks characterized hazard sources.`, [group.uuid]);
    if (!mef.hazardSourceCharacterization.intensityMeasures.some((item) => item.hazardGroupRef === group.uuid && item.selected)) add("OHA-B-003", "ERROR", "OHA", `${group.name} lacks a selected, plant-response-compatible intensity measure.`, [group.uuid]);
    if (!mef.hazardSourceCharacterization.effectModels.some((item) => item.hazardGroupRef === group.uuid)) add("OHA-B-004", "ERROR", "OHA", `${group.name} lacks a source-to-site effect model.`, [group.uuid]);
  }
  for (const model of mef.hazardSourceCharacterization.effectModels) {
    const missingSources = unresolved(model.sourceRefs, sourceRefs);
    if (!hazardGroupRefs.has(model.hazardGroupRef) || missingSources.length > 0) add("OHA-B-005", "ERROR", "OHA", `${model.name} has unresolved hazard-group or source references.`, [model.uuid, ...missingSources]);
  }

  const dataSetRefs = new Set(mef.hazardFrequencyAnalysis.occurrenceDataSets.map((item) => item.uuid));
  const occurrenceModelRefs = new Set(mef.hazardFrequencyAnalysis.occurrenceModels.map((item) => item.uuid));
  for (const group of hazardGroups) {
    if (!mef.hazardFrequencyAnalysis.occurrenceModels.some((item) => item.hazardGroupRef === group.uuid)) add("OHA-B-006", "ERROR", "OHA", `${group.name} lacks a hazard occurrence model.`, [group.uuid]);
    if (!mef.hazardFrequencyAnalysis.frequencyResults.some((item) => item.hazardGroupRef === group.uuid)) add("OHA-B-007", "ERROR", "OHA", `${group.name} lacks quantified frequency results.`, [group.uuid]);
  }
  for (const dataSet of mef.hazardFrequencyAnalysis.occurrenceDataSets) {
    if (probabilityOutOfRange(dataSet.completeness) || dataSet.eventCount < 0 || dataSet.observationYears <= 0) add("OHA-B-008", "ERROR", "OHA", `${dataSet.name} has invalid completeness, event count, or observation years.`, [dataSet.uuid]);
  }
  for (const model of mef.hazardFrequencyAnalysis.occurrenceModels) {
    const missingData = unresolved(model.dataSetRefs, dataSetRefs);
    if (missingData.length > 0 || !intensityMeasureRefs.has(model.intensityMeasureRef) || model.occurrenceRatePerYear < 0) add("OHA-B-009", "ERROR", "OHA", `${model.name} has unresolved inputs or an invalid occurrence rate.`, [model.uuid, ...missingData]);
  }
  for (const result of mef.hazardFrequencyAnalysis.frequencyResults) {
    if (!occurrenceModelRefs.has(result.occurrenceModelRef) || !intensityMeasureRefs.has(result.intensityMeasureRef) || result.meanAnnualExceedanceFrequency <= 0) add("OHA-B-010", "ERROR", "OHA", `${result.name} has unresolved frequency-model inputs or an invalid exceedance frequency.`, [result.uuid]);
  }

  for (const secondary of mef.secondaryAndCombinedHazards.secondaryHazardScenarios) {
    if (!hazardGroupRefs.has(secondary.primaryHazardGroupRef) || probabilityOutOfRange(secondary.conditionalOccurrenceProbability)) add("OHA-C-001", "ERROR", "OHA", `${secondary.name} has an unresolved primary hazard or invalid conditional probability.`, [secondary.uuid]);
    if (["INTERNAL_FIRE", "INTERNAL_FLOOD", "EXTERNAL_FLOOD"].includes(secondary.secondaryHazardType) && secondary.transferredRecordRefs.length === 0) add("OHA-C-002", "ERROR", "OHA", `${secondary.name} requires a controlled transfer to the applicable specialized hazard model.`, [secondary.uuid]);
  }
  if (hazardGroups.length > 0 && mef.secondaryAndCombinedHazards.combinedHazardAssessments.length === 0) add("OHA-C-003", "WARNING", "OHA", "Document the assessment of causal, coincident, sequential, and common-condition hazards.");

  const hazardCurveRefs = new Set(mef.hazardCurveAnalysis.hazardCurves.map((item) => item.uuid));
  const hazardIntervalRefs = new Set(mef.hazardCurveAnalysis.hazardIntervals.map((item) => item.uuid));
  for (const group of hazardGroups) {
    if (!mef.hazardCurveAnalysis.hazardCurves.some((curve) => curve.hazardGroupRef === group.uuid && curve.representsMeanCurve)) add("OHA-B-011", "ERROR", "OHA", `${group.name} lacks a mean hazard curve.`, [group.uuid]);
  }
  for (const curve of mef.hazardCurveAnalysis.hazardCurves) {
    if (!hazardGroupRefs.has(curve.hazardGroupRef) || !intensityMeasureRefs.has(curve.intensityMeasureRef) || !validHazardCurve(curve.curvePoints)) add("OHA-B-012", "ERROR", "OHA", `${curve.name} has unresolved references or a non-monotonic hazard curve.`, [curve.uuid]);
    if (mef.capabilityCategory === "CC-II" && !curve.uncertaintyFamilyAvailable) add("OHA-D-001", "ERROR", "OHA", `${curve.name} lacks the CC-II uncertainty-family basis.`, [curve.uuid]);
  }
  for (const interval of mef.hazardCurveAnalysis.hazardIntervals) {
    if (!hazardCurveRefs.has(interval.hazardCurveRef) || interval.upperIntensity <= interval.lowerIntensity || interval.representativeIntensity < interval.lowerIntensity || interval.representativeIntensity > interval.upperIntensity || interval.intervalAnnualFrequency < 0 || probabilityOutOfRange(interval.conditionalWeight)) add("OHA-B-013", "ERROR", "OHA", `${interval.name} has invalid curve linkage, bounds, frequency, or weight.`, [interval.uuid]);
  }
  if (hazardGroups.length > 0 && !mef.hazardCurveAnalysis.convergenceStudies.some((study) => study.converged)) add("OHA-B-014", "ERROR", "OHA", "Demonstrate hazard-interval and upper-tail convergence.");

  const sscEntries = mef.preliminaryPlantResponse.otherHazardsSscList;
  const sscRefs = new Set(sscEntries.map((item) => item.uuid));
  const failureModeRefs = new Set(sscEntries.flatMap((item) => item.failureModes.map((mode) => mode.uuid)));
  const activeSscs = sscEntries.filter((item) => item.disposition === "ACTIVE" || item.disposition === "BOUNDING_GROUP");
  if (activeSscs.length === 0) add("OPR-A-001", "ERROR", "OPR", "Develop a nonempty Other Hazards SSC list from the plant-response model.");
  for (const entry of activeSscs) {
    if (entry.failureModes.length === 0 || entry.applicableHazardGroupRefs.length === 0 || entry.applicableHazardEffects.length === 0) add("OPR-A-002", "ERROR", "OPR", `${entry.name} lacks failure modes, hazard groups, or effects.`, [entry.uuid]);
  }

  const investigationRefs = new Set(mef.plantInvestigation.investigations.map((item) => item.uuid));
  if (mef.plantInvestigation.investigations.length === 0) add("OFR-B-001", "ERROR", "OFR", "Perform investigations to establish or confirm fragility-governing plant conditions.");
  for (const entry of activeSscs) {
    const missing = unresolved(entry.investigationRefs, investigationRefs);
    if (entry.investigationRefs.length === 0 || missing.length > 0) add("OFR-B-002", "ERROR", "OFR", `${entry.name} lacks a resolved investigation reference.`, [entry.uuid, ...missing]);
  }

  const methodSelectionRefs = new Set(mef.fragilityBasis.methodSelections.map((item) => item.uuid));
  for (const entry of activeSscs) {
    if (!mef.fragilityBasis.methodSelections.some((selection) => selection.sscRefs.includes(entry.uuid))) add("OFR-A-001", "ERROR", "OFR", `${entry.name} lacks a fragility or screening method selection.`, [entry.uuid]);
  }
  for (const selection of mef.fragilityBasis.methodSelections) {
    const missingSscs = unresolved(selection.sscRefs, sscRefs);
    const missingModes = unresolved(selection.failureModeRefs, failureModeRefs);
    if (missingSscs.length + missingModes.length > 0 || !intensityMeasureRefs.has(selection.intensityMeasureRef)) add("OFR-A-002", "ERROR", "OFR", `${selection.name} has unresolved SSC, failure-mode, or intensity-measure references.`, [selection.uuid, ...missingSscs, ...missingModes]);
  }

  const demandModelRefs = new Set(mef.fragilityAnalysis.demandModels.map((item) => item.uuid));
  const capacityModelRefs = new Set(mef.fragilityAnalysis.capacityModels.map((item) => item.uuid));
  const fragilityRefs = new Set(mef.fragilityAnalysis.fragilityCurves.map((item) => item.uuid));
  for (const entry of activeSscs) {
    if (!mef.fragilityAnalysis.fragilityCurves.some((curve) => curve.sscRef === entry.uuid) && !mef.fragilityAnalysis.functionalFailureModels.some((model) => model.destinationModelRefs.includes(entry.uuid))) add("OFR-A-003", "ERROR", "OFR", `${entry.name} lacks a quantified physical or functional fragility.`, [entry.uuid]);
  }
  for (const curve of mef.fragilityAnalysis.fragilityCurves) {
    if (!sscRefs.has(curve.sscRef) || !failureModeRefs.has(curve.failureModeRef) || !methodSelectionRefs.has(curve.methodSelectionRef) || !demandModelRefs.has(curve.demandModelRef) || !capacityModelRefs.has(curve.capacityModelRef) || !intensityMeasureRefs.has(curve.intensityMeasureRef) || !validFragilityCurve(curve.curvePoints)) add("OFR-A-004", "ERROR", "OFR", `${curve.name} has unresolved inputs or a non-monotonic fragility curve.`, [curve.uuid]);
  }

  const initiatingEventRefs = new Set(mef.initiatingEventAndScenarioDevelopment.initiatingEventModels.map((item) => item.uuid));
  const scenarioFamilyRefs = new Set(mef.initiatingEventAndScenarioDevelopment.scenarioFamilies.map((item) => item.uuid));
  if (initiatingEventRefs.size === 0 || scenarioFamilyRefs.size === 0) add("OPR-A-003", "ERROR", "OPR", "Develop hazard-induced initiating events and scenario families.");
  for (const scenario of mef.initiatingEventAndScenarioDevelopment.scenarioFamilies) {
    const missingEvents = unresolved(scenario.initiatingEventRefs, initiatingEventRefs);
    const missingIntervals = unresolved(scenario.hazardIntervalRefs, hazardIntervalRefs);
    if (missingEvents.length + missingIntervals.length > 0) add("OPR-A-004", "ERROR", "OPR", `${scenario.name} has unresolved initiating-event or hazard-interval references.`, [scenario.uuid, ...missingEvents, ...missingIntervals]);
  }

  const eventSequenceRefs = new Set(mef.plantResponseModel.eventSequenceModels.map((item) => item.uuid));
  const missionTimeRefs = new Set(mef.plantResponseModel.missionTimes.map((item) => item.uuid));
  if (eventSequenceRefs.size === 0 || mef.plantResponseModel.systemModelModifications.length === 0 || missionTimeRefs.size === 0) add("OPR-B-001", "ERROR", "OPR", "Develop event sequences, system-model modifications, and hazard-appropriate mission times.");
  for (const sequence of mef.plantResponseModel.eventSequenceModels) {
    const missingScenarios = unresolved(sequence.scenarioFamilyRefs, scenarioFamilyRefs);
    const missingEvents = unresolved(sequence.initiatingEventRefs, initiatingEventRefs);
    if (missingScenarios.length + missingEvents.length > 0 || !missionTimeRefs.has(sequence.missionTimeRef)) add("OPR-B-002", "ERROR", "OPR", `${sequence.name} has unresolved scenario, initiating-event, or mission-time references.`, [sequence.uuid, ...missingScenarios, ...missingEvents]);
  }
  if ((mef.analysisBasis.siteBasis?.reactorUnitRefs.length ?? 0) > 1 && mef.plantResponseModel.multiUnitAssessments.length === 0) add("OPR-A-005", "ERROR", "OPR", "Assess shared SSCs, resources, actions, and site conditions for the multi-unit site.");

  const humanActionRefs = new Set(mef.humanReliabilityAnalysis.humanActions.map((item) => item.uuid));
  const hfeRefs = new Set(mef.humanReliabilityAnalysis.humanFailureEvents.map((item) => item.uuid));
  const contextRefs = new Set(mef.humanReliabilityAnalysis.performanceContexts.map((item) => item.uuid));
  for (const hfe of mef.humanReliabilityAnalysis.humanFailureEvents) {
    if (!humanActionRefs.has(hfe.humanActionRef)) add("OPR-E-001", "ERROR", "OPR", `${hfe.name} references an undefined human action.`, [hfe.uuid]);
  }
  for (const estimate of mef.humanReliabilityAnalysis.hepEstimates) {
    if (!hfeRefs.has(estimate.humanFailureEventRef) || !contextRefs.has(estimate.performanceContextRef) || probabilityOutOfRange(estimate.nominalHep) || probabilityOutOfRange(estimate.otherHazardsHep) || probabilityOutOfRange(estimate.recoveryCredit)) add("OPR-E-002", "ERROR", "OPR", `${estimate.name} has unresolved HFE/context links or invalid probabilities.`, [estimate.uuid]);
  }
  if (humanActionRefs.size > 0 && mef.humanReliabilityAnalysis.confirmations.length === 0) add("OPR-E-003", "ERROR", "OPR", "Confirm credited actions through procedure review, interview, talk-through, tabletop, simulation, or walkdown.");

  const runRefs = new Set(mef.eventSequenceQuantification.quantificationRuns.map((item) => item.uuid));
  if (runRefs.size === 0 || mef.eventSequenceQuantification.eventSequenceFamilyResults.length === 0) add("OPR-F-001", "ERROR", "OPR", "Quantify Other Hazards event-sequence-family frequencies on a plant-year basis.");
  for (const run of mef.eventSequenceQuantification.quantificationRuns) {
    const missingCurves = unresolved(run.hazardCurveRefs, hazardCurveRefs);
    const missingIntervals = unresolved(run.hazardIntervalRefs, hazardIntervalRefs);
    const missingFragilities = unresolved(run.fragilityRefs, fragilityRefs);
    if (missingCurves.length + missingIntervals.length + missingFragilities.length > 0) add("OPR-F-002", "ERROR", "OPR", `${run.name} has unresolved hazard, interval, or fragility inputs.`, [run.uuid, ...missingCurves, ...missingIntervals, ...missingFragilities]);
    if (run.successStateTreatment.trim().length === 0 || run.rareEventApproximationTreatment.trim().length === 0 || run.highFailureProbabilityTreatment.trim().length === 0) add("OPR-F-003", "ERROR", "OPR", `${run.name} does not document success-state, rare-event, and high-failure-probability treatment.`, [run.uuid]);
  }
  for (const result of mef.eventSequenceQuantification.hazardIntervalResults) {
    if (!runRefs.has(result.quantificationRunRef) || !hazardIntervalRefs.has(result.hazardIntervalRef) || probabilityOutOfRange(result.conditionalSequenceProbability) || result.sequenceFrequencyPerPlantYear < 0) add("OPR-F-004", "ERROR", "OPR", `${result.name} has unresolved run/interval links or invalid probability/frequency values.`, [result.uuid]);
  }
  if (runRefs.size > 0 && !mef.eventSequenceQuantification.convergenceStudies.some((study) => study.converged)) add("OPR-F-005", "ERROR", "OPR", "Demonstrate stable quantification for hazard intervals, upper-tail treatment, grouping, and numerical truncation.");
  if (mef.capabilityCategory === "CC-II" && mef.eventSequenceQuantification.uncertaintyResults.length === 0) add("OPR-F-006", "ERROR", "OPR", "Propagate hazard, fragility, plant-response, and HRA uncertainty for CC-II.");

  if (mef.riskInterpretation.riskInsights.length === 0) add("O-RISK-001", "WARNING", "INTEGRATION", "Document dominant contributors and Other Hazards risk insights.");
  if (!mef.riskInterpretation.quantificationIterations.some((iteration) => iteration.decision === "ACCEPT_STABLE" || iteration.decision === "ACCEPT_WITH_LIMITATION")) add("O-RISK-002", "WARNING", "INTEGRATION", "No refinement iteration records an accepted stable result.");
  for (const path of mef.riskInterpretation.traceabilityPaths) {
    if (!path.complete) add("O-RISK-003", "ERROR", "INTEGRATION", `${path.name} lacks complete evidence-to-decision traceability.`, [path.uuid]);
  }

  const openInterfaces = mef.analysisBasis.interfaces.filter((item) => !item.consistent || item.openItems.length > 0).map((item) => item.uuid);
  if (openInterfaces.length > 0) add("O-CLOSE-001", "ERROR", "INTEGRATION", "Resolve inconsistent or open technical-element interfaces before approval.", openInterfaces);
  const openPeerFindings = mef.technicalClosure.peerReviewFindings.filter((item) => item.closureStatus !== "CLOSED").map((item) => item.uuid);
  if (openPeerFindings.length > 0) add("O-CLOSE-002", "WARNING", "WORKFLOW", "Resolve open Other Hazards peer-review findings before approval.", openPeerFindings);

  const requiredDocumentation = [
    mef.analysisBasis.documentation,
    mef.retainedHazardGroups.documentation,
    mef.hazardSourceCharacterization.documentation,
    mef.hazardFrequencyAnalysis.documentation,
    mef.secondaryAndCombinedHazards.documentation,
    mef.hazardCurveAnalysis.documentation,
    mef.preliminaryPlantResponse.documentation,
    mef.plantInvestigation.documentation,
    mef.fragilityBasis.documentation,
    mef.fragilityAnalysis.documentation,
    mef.initiatingEventAndScenarioDevelopment.documentation,
    mef.plantResponseModel.documentation,
    mef.humanReliabilityAnalysis.documentation,
    mef.eventSequenceQuantification.documentation,
    mef.technicalClosure.documentation,
  ];
  for (const documentation of requiredDocumentation) {
    if (documentation.processDescription.trim().length === 0 || documentation.inputsDescription.trim().length === 0 || documentation.methodsDescription.trim().length === 0 || documentation.resultsDescription.trim().length === 0) add("O-DOC-001", "WARNING", "DOCUMENTATION", `${documentation.name} is incomplete.`, [documentation.uuid]);
  }

  if (mef.workflow.approvalSignatures.length > 0 && diagnostics.some((item) => item.severity === "ERROR")) add("O-WORKFLOW-001", "ERROR", "WORKFLOW", "Approval signatures are present while blocking Other Hazards issues remain open.");
  return diagnostics;
}

export function reviewBlockingOtherHazardsPraDiagnostics(mef: OtherHazardsPRA): OtherHazardsPraDiagnostic[] {
  return validateOtherHazardsPra(mef).filter((diagnostic) => diagnostic.severity === "ERROR");
}
