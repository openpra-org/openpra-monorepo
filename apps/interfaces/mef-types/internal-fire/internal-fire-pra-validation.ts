import { INTERNAL_FIRE_PRA_SR_CATALOG, type InternalFireAnalysisRecord, type InternalFirePRA } from "./internal-fire-pra";

export type InternalFirePraDiagnosticSeverity = "ERROR" | "WARNING" | "INFORMATION";

export interface InternalFirePraDiagnostic {
  code: string;
  severity: InternalFirePraDiagnosticSeverity;
  area: "SCOPE" | "FPP" | "FES" | "FCS" | "FQLS" | "FPRM" | "FSS" | "FIGN" | "FCF" | "FHR" | "FESQ" | "INTEGRATION" | "DOCUMENTATION";
  message: string;
  recordRefs: string[];
}

interface LocatedRecord {
  path: string;
  record: InternalFireAnalysisRecord;
}

function isAnalysisRecord(value: unknown): value is InternalFireAnalysisRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.uuid === "string"
    && typeof candidate.code === "string"
    && typeof candidate.name === "string"
    && Array.isArray(candidate.implementsSrs);
}

function locatedRecords(mef: InternalFirePRA): LocatedRecord[] {
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

function cloneInternalFirePra(mef: InternalFirePRA): InternalFirePRA {
  return typeof structuredClone === "function"
    ? structuredClone(mef)
    : JSON.parse(JSON.stringify(mef)) as InternalFirePRA;
}

export function synchronizeInternalFirePraDerivedRegisters(mef: InternalFirePRA): InternalFirePRA {
  const next = cloneInternalFirePra(mef);
  const implementation = new Map<string, LocatedRecord[]>();
  for (const located of locatedRecords(next)) {
    for (const reference of located.record.implementsSrs) {
      implementation.set(reference.sr, [...(implementation.get(reference.sr) ?? []), located]);
    }
  }

  next.integration.selectedPauRefs = next.plantBoundaryAndPartitioning.physicalAnalysisUnits.map((item) => item.uuid);
  next.integration.selectedEquipmentRefs = next.equipmentSelection.equipmentSelections.filter((item) => item.disposition === "INCLUDE").map((item) => item.uuid);
  next.integration.selectedCableRefs = next.cableSelectionAndLocation.cables.map((item) => item.uuid);
  next.integration.retainedFireScenarioRefs = next.scenarioSelectionAndAnalysis.fireScenarios.filter((item) => item.disposition !== "SCREENED").map((item) => item.uuid);
  next.integration.ignitionFrequencyRefs = next.ignitionFrequency.frequencyEstimates.map((item) => item.uuid);
  next.integration.circuitFailureResultRefs = next.circuitFailureAnalysis.failureProbabilities.map((item) => item.uuid);
  next.integration.humanFailureEventRefs = next.humanReliabilityAnalysis.humanFailureEvents.map((item) => item.uuid);
  next.integration.quantificationResultRefs = next.eventSequenceQuantification.eventSequenceFamilyResults.map((item) => item.uuid);

  next.conformanceMatrix = Object.entries(INTERNAL_FIRE_PRA_SR_CATALOG).map(([sr, entry]) => {
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
          : existing?.status === "NOT_MET"
            ? "NOT_MET"
            : "PENDING_REVIEW",
      satisfiedByElementPaths: implementations.map((item) => item.path),
      evidence: implementations.length > 0
        ? implementations.slice(0, 4).map((item) => `${item.record.code} ${item.record.name}`).join("; ")
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

export function validateInternalFirePra(mef: InternalFirePRA): InternalFirePraDiagnostic[] {
  const diagnostics: InternalFirePraDiagnostic[] = [];
  const add = (code: string, severity: InternalFirePraDiagnosticSeverity, area: InternalFirePraDiagnostic["area"], message: string, recordRefs: string[] = []): void => {
    diagnostics.push({ code, severity, area, message, recordRefs });
  };

  const records = locatedRecords(mef);
  const uuids = new Map<string, string>();
  const codes = new Map<string, string>();
  for (const { path, record } of records) {
    if (uuids.has(record.uuid)) add("F-DUPLICATE-UUID", "ERROR", "INTEGRATION", `Duplicate UUID ${record.uuid} prevents unambiguous traceability.`, [record.uuid, uuids.get(record.uuid) ?? "", path]);
    if (codes.has(record.code)) add("F-DUPLICATE-CODE", "ERROR", "INTEGRATION", `Duplicate record code ${record.code} prevents unambiguous traceability.`, [record.uuid, codes.get(record.code) ?? ""]);
    uuids.set(record.uuid, path);
    codes.set(record.code, record.uuid);
    if (record.status !== "DRAFT" && (record.description.trim().length === 0 || record.basis.trim().length === 0)) add("F-INCOMPLETE-RECORD", "ERROR", "DOCUMENTATION", `${record.code} is ${record.status} but lacks a complete description or basis.`, [record.uuid]);
    const unsupported = record.implementsSrs.filter((reference) => !(reference.sr in INTERNAL_FIRE_PRA_SR_CATALOG));
    if (unsupported.length > 0) add("F-UNSUPPORTED-SR", "ERROR", "DOCUMENTATION", `${record.code} contains unsupported Internal Fire requirement references.`, [record.uuid, ...unsupported.map((item) => item.sr)]);
  }

  if (mef.praScope.trim().length === 0) add("F-SCOPE-001", "ERROR", "SCOPE", "Define the integrated Internal Fire PRA scope.");
  if (mef.applications.length === 0) add("F-SCOPE-002", "WARNING", "SCOPE", "Register at least one intended Internal Fire PRA application.");
  if (mef.evidenceRegister.length === 0) add("F-SCOPE-003", "WARNING", "SCOPE", "The controlled evidence register is empty.");
  if (mef.baselinePra === undefined) add("F-SCOPE-004", "ERROR", "SCOPE", "Define and freeze the baseline PRA used by Internal Fire analysis.");
  if (mef.plantBoundaryAndPartitioning.globalBoundary.atPowerOperatingStateRefs.length === 0) add("F-SCOPE-005", "ERROR", "SCOPE", "Define the at-power operating states covered by the Internal Fire PRA.");

  const pauRefs = new Set(mef.plantBoundaryAndPartitioning.physicalAnalysisUnits.map((item) => item.uuid));
  const partitionRefs = new Set(mef.plantBoundaryAndPartitioning.partitioningElements.map((item) => item.uuid));
  const equipmentRefs = new Set(mef.equipmentSelection.equipmentSelections.map((item) => item.uuid));
  const cableRefs = new Set(mef.cableSelectionAndLocation.cables.map((item) => item.uuid));
  const racewayRefs = new Set(mef.cableSelectionAndLocation.raceways.map((item) => item.uuid));
  const ignitionSourceRefs = new Set(mef.scenarioSelectionAndAnalysis.ignitionSources.map((item) => item.uuid));
  const targetSetRefs = new Set(mef.scenarioSelectionAndAnalysis.damageTargetSets.map((item) => item.uuid));
  const fireModelRefs = new Set(mef.scenarioSelectionAndAnalysis.fireModelAnalyses.map((item) => item.uuid));
  const suppressionAssessmentRefs = new Set(mef.scenarioSelectionAndAnalysis.detectionSuppressionAssessments.map((item) => item.uuid));
  const scenarioRefs = new Set(mef.scenarioSelectionAndAnalysis.fireScenarios.map((item) => item.uuid));
  const frequencyGroupRefs = new Set(mef.ignitionFrequency.frequencyGroups.map((item) => item.uuid));
  const frequencyEstimateRefs = new Set(mef.ignitionFrequency.frequencyEstimates.map((item) => item.uuid));
  const circuitRefs = new Set(mef.circuitFailureAnalysis.circuits.map((item) => item.uuid));
  const circuitEvaluationRefs = new Set(mef.circuitFailureAnalysis.failureModeEvaluations.map((item) => item.uuid));
  const humanActionRefs = new Set(mef.humanReliabilityAnalysis.humanActions.map((item) => item.uuid));
  const hfeRefs = new Set(mef.humanReliabilityAnalysis.humanFailureEvents.map((item) => item.uuid));
  const contextRefs = new Set(mef.humanReliabilityAnalysis.performanceContexts.map((item) => item.uuid));
  const quantificationRunRefs = new Set(mef.eventSequenceQuantification.quantificationRuns.map((item) => item.uuid));

  if (pauRefs.size === 0) add("FPP-001", "ERROR", "FPP", "Define the complete set of nonoverlapping physical analysis units.");
  for (const check of mef.plantBoundaryAndPartitioning.coverageChecks) {
    if (!check.complete || !check.nonOverlapping || check.unassignedLocations.length > 0 || check.overlappingPauPairs.length > 0) add("FPP-002", "ERROR", "FPP", `${check.name} does not demonstrate complete, nonoverlapping PAU coverage.`, [check.uuid, ...check.unassignedLocations]);
  }
  for (const element of mef.plantBoundaryAndPartitioning.partitioningElements) {
    if (!pauRefs.has(element.fromPauRef) || (element.toPauRef !== undefined && !pauRefs.has(element.toPauRef))) add("FPP-003", "ERROR", "FPP", `${element.name} references an undefined PAU.`, [element.uuid, element.fromPauRef, element.toPauRef ?? ""]);
  }
  for (const pau of mef.plantBoundaryAndPartitioning.physicalAnalysisUnits) {
    const unresolved = pau.boundaryElementRefs.filter((reference) => !partitionRefs.has(reference));
    if (unresolved.length > 0) add("FPP-004", "ERROR", "FPP", `${pau.name} contains unresolved partitioning-element references.`, [pau.uuid, ...unresolved]);
  }

  if (equipmentRefs.size === 0) add("FES-001", "ERROR", "FES", "Select the equipment and instrumentation required by the fire plant-response model.");
  for (const item of mef.equipmentSelection.equipmentSelections) {
    const unresolved = item.physicalAnalysisUnitRefs.filter((reference) => !pauRefs.has(reference));
    if (unresolved.length > 0) add("FES-002", "ERROR", "FES", `${item.name} references undefined PAUs.`, [item.uuid, ...unresolved]);
    if (item.disposition === "INCLUDE" && item.fireFailureModes.length === 0) add("FES-003", "ERROR", "FES", `${item.name} is included without a fire failure mode.`, [item.uuid]);
  }

  for (const cable of mef.cableSelectionAndLocation.cables) {
    if (!equipmentRefs.has(cable.equipmentRef)) add("FCS-001", "ERROR", "FCS", `${cable.name} references undefined selected equipment.`, [cable.uuid, cable.equipmentRef]);
    const unresolvedPaus = cable.physicalAnalysisUnitRefs.filter((reference) => !pauRefs.has(reference));
    const unresolvedRaceways = cable.racewayRefs.filter((reference) => !racewayRefs.has(reference));
    if (unresolvedPaus.length + unresolvedRaceways.length > 0) add("FCS-002", "ERROR", "FCS", `${cable.name} has unresolved PAU or raceway routing.`, [cable.uuid, ...unresolvedPaus, ...unresolvedRaceways]);
    if (cable.routingStatus === "NOT_ROUTED" && cable.riskSignificant) add("FCS-003", "WARNING", "FCS", `${cable.name} is risk-significant but has no established or assumed routing.`, [cable.uuid]);
  }
  for (const raceway of mef.cableSelectionAndLocation.raceways) {
    if (!pauRefs.has(raceway.physicalAnalysisUnitRef)) add("FCS-004", "ERROR", "FCS", `${raceway.name} references an undefined PAU.`, [raceway.uuid, raceway.physicalAnalysisUnitRef]);
    const unresolved = raceway.cableRefs.filter((reference) => !cableRefs.has(reference));
    if (unresolved.length > 0) add("FCS-005", "ERROR", "FCS", `${raceway.name} contains undefined cables.`, [raceway.uuid, ...unresolved]);
  }

  const screenedPaus = new Set(mef.qualitativeScreening.screeningDecisions.flatMap((item) => item.screenedObjectType === "PAU" ? item.screenedObjectRefs : []));
  const undispositionedPaus = [...pauRefs].filter((reference) => !screenedPaus.has(reference));
  if (undispositionedPaus.length > 0) add("FQLS-001", "ERROR", "FQLS", "Apply qualitative screening to every PAU.", undispositionedPaus);
  for (const reference of mef.qualitativeScreening.retainedPauRefs) if (!pauRefs.has(reference)) add("FQLS-002", "ERROR", "FQLS", "A retained PAU reference does not resolve.", [reference]);

  if (mef.plantResponseModel.eventSequenceModels.length === 0 || mef.plantResponseModel.systemModelModifications.length === 0) add("FPRM-001", "ERROR", "FPRM", "Develop fire-specific event-sequence and systems-model treatments.");

  for (const source of mef.scenarioSelectionAndAnalysis.ignitionSources) {
    if (!pauRefs.has(source.physicalAnalysisUnitRef)) add("FSS-001", "ERROR", "FSS", `${source.name} references an undefined PAU.`, [source.uuid, source.physicalAnalysisUnitRef]);
    if (!frequencyGroupRefs.has(source.ignitionFrequencyGroupRef)) add("FSS-002", "ERROR", "FSS", `${source.name} references an undefined ignition-frequency group.`, [source.uuid, source.ignitionFrequencyGroupRef]);
  }
  for (const target of mef.scenarioSelectionAndAnalysis.damageTargetSets) {
    const unresolved = [...target.physicalAnalysisUnitRefs.filter((reference) => !pauRefs.has(reference)), ...target.cableRefs.filter((reference) => !cableRefs.has(reference)), ...target.racewayRefs.filter((reference) => !racewayRefs.has(reference))];
    if (unresolved.length > 0) add("FSS-003", "ERROR", "FSS", `${target.name} contains unresolved PAU, cable, or raceway references.`, [target.uuid, ...unresolved]);
  }
  for (const scenario of mef.scenarioSelectionAndAnalysis.fireScenarios) {
    const unresolved = [...scenario.physicalAnalysisUnitRefs.filter((reference) => !pauRefs.has(reference)), ...scenario.ignitionSourceRefs.filter((reference) => !ignitionSourceRefs.has(reference))];
    if (!targetSetRefs.has(scenario.damageTargetSetRef) || !fireModelRefs.has(scenario.fireModelAnalysisRef) || !suppressionAssessmentRefs.has(scenario.detectionSuppressionAssessmentRef) || unresolved.length > 0) add("FSS-004", "ERROR", "FSS", `${scenario.name} has unresolved source, target, fire-model, suppression, or PAU references.`, [scenario.uuid, scenario.damageTargetSetRef, scenario.fireModelAnalysisRef, scenario.detectionSuppressionAssessmentRef, ...unresolved]);
  }
  for (const model of mef.scenarioSelectionAndAnalysis.fireModelAnalyses) {
    if (!model.withinApplicabilityLimits) add("FSS-005", "ERROR", "FSS", `${model.name} applies a fire model outside its limits.`, [model.uuid]);
    if (probabilityOutOfRange(model.severityFactor) || probabilityOutOfRange(model.conditionalTargetDamageProbability)) add("FSS-006", "ERROR", "FSS", `${model.name} contains an invalid conditional factor.`, [model.uuid]);
  }

  const retainedPauSet = new Set(mef.qualitativeScreening.retainedPauRefs);
  const pausWithFrequency = new Set(mef.ignitionFrequency.frequencyEstimates.map((item) => item.physicalAnalysisUnitRef));
  const missingFrequencyPaus = [...retainedPauSet].filter((reference) => !pausWithFrequency.has(reference));
  if (missingFrequencyPaus.length > 0) add("FIGN-001", "ERROR", "FIGN", "Every retained PAU requires a nonzero ignition frequency.", missingFrequencyPaus);
  for (const estimate of mef.ignitionFrequency.frequencyEstimates) {
    if (!ignitionSourceRefs.has(estimate.ignitionSourceRef) || !pauRefs.has(estimate.physicalAnalysisUnitRef) || !frequencyGroupRefs.has(estimate.frequencyGroupRef)) add("FIGN-002", "ERROR", "FIGN", `${estimate.name} has unresolved source, PAU, or frequency-group references.`, [estimate.uuid]);
    if (estimate.meanFrequencyPerPlantYear <= 0) add("FIGN-003", "ERROR", "FIGN", `${estimate.name} must have a positive annual ignition frequency.`, [estimate.uuid]);
    if (!estimate.preservesPlantWideFrequency) add("FIGN-004", "ERROR", "FIGN", `${estimate.name} has not demonstrated plant-wide frequency preservation.`, [estimate.uuid]);
  }

  for (const circuit of mef.circuitFailureAnalysis.circuits) {
    const unresolved = circuit.cableRefs.filter((reference) => !cableRefs.has(reference));
    if (!equipmentRefs.has(circuit.equipmentRef) || unresolved.length > 0) add("FCF-001", "ERROR", "FCF", `${circuit.name} has unresolved equipment or cable references.`, [circuit.uuid, circuit.equipmentRef, ...unresolved]);
  }
  for (const evaluation of mef.circuitFailureAnalysis.failureModeEvaluations) {
    if (!circuitRefs.has(evaluation.circuitRef)) add("FCF-002", "ERROR", "FCF", `${evaluation.name} references an undefined circuit.`, [evaluation.uuid, evaluation.circuitRef]);
    const unresolved = evaluation.fireScenarioRefs.filter((reference) => !scenarioRefs.has(reference));
    if (unresolved.length > 0) add("FCF-003", "ERROR", "FCF", `${evaluation.name} references undefined fire scenarios.`, [evaluation.uuid, ...unresolved]);
  }
  for (const estimate of mef.circuitFailureAnalysis.failureProbabilities) {
    if (!circuitEvaluationRefs.has(estimate.failureModeEvaluationRef) || probabilityOutOfRange(estimate.meanProbability) || probabilityOutOfRange(estimate.durationProbability)) add("FCF-004", "ERROR", "FCF", `${estimate.name} has an unresolved evaluation or invalid probability.`, [estimate.uuid, estimate.failureModeEvaluationRef]);
  }

  for (const hfe of mef.humanReliabilityAnalysis.humanFailureEvents) if (!humanActionRefs.has(hfe.humanActionRef)) add("FHR-001", "ERROR", "FHR", `${hfe.name} references an undefined human action.`, [hfe.uuid, hfe.humanActionRef]);
  for (const context of mef.humanReliabilityAnalysis.performanceContexts) if (!hfeRefs.has(context.humanFailureEventRef) || !scenarioRefs.has(context.fireScenarioRef)) add("FHR-002", "ERROR", "FHR", `${context.name} has an unresolved HFE or fire scenario.`, [context.uuid, context.humanFailureEventRef, context.fireScenarioRef]);
  for (const estimate of mef.humanReliabilityAnalysis.hepEstimates) if (!hfeRefs.has(estimate.humanFailureEventRef) || !contextRefs.has(estimate.performanceContextRef) || probabilityOutOfRange(estimate.meanHep)) add("FHR-003", "ERROR", "FHR", `${estimate.name} has an unresolved reference or invalid HEP.`, [estimate.uuid, estimate.humanFailureEventRef, estimate.performanceContextRef]);

  if (mef.eventSequenceQuantification.eventSequenceFamilyResults.length === 0) add("FESQ-001", "ERROR", "FESQ", "Quantify the retained fire-induced event-sequence families.");
  for (const run of mef.eventSequenceQuantification.quantificationRuns) if (!run.converged || run.convergenceMetric > run.convergenceCriterion) add("FESQ-002", "ERROR", "FESQ", `${run.name} has not demonstrated quantification convergence.`, [run.uuid]);
  for (const result of mef.eventSequenceQuantification.scenarioResults) {
    if (!quantificationRunRefs.has(result.quantificationRunRef) || !scenarioRefs.has(result.fireScenarioRef) || !frequencyEstimateRefs.has(result.ignitionFrequencyRef)) add("FESQ-003", "ERROR", "FESQ", `${result.name} has unresolved run, scenario, or ignition-frequency references.`, [result.uuid]);
    if (probabilityOutOfRange(result.conditionalDamageProbability) || probabilityOutOfRange(result.conditionalSequenceProbability) || result.meanFrequencyPerPlantYear < 0) add("FESQ-004", "ERROR", "FESQ", `${result.name} contains an invalid probability or frequency.`, [result.uuid]);
  }

  if (mef.integration.interfaces.length === 0) add("F-INT-001", "ERROR", "INTEGRATION", "Create and close the external technical-element interface records.");
  for (const item of mef.integration.interfaces) if (!item.consistent || item.openItems.length > 0) add("F-INT-002", "ERROR", "INTEGRATION", `${item.name} is not closed and consistent.`, [item.uuid, ...item.openItems]);
  for (const check of mef.integration.consistencyChecks) if (check.result === "OPEN" || check.result === "FAIL") add("F-INT-003", "ERROR", "INTEGRATION", `${check.name} has result ${check.result}.`, [check.uuid, ...check.openItems]);
  if (mef.integration.unresolvedInterfaces.length > 0) add("F-INT-004", "ERROR", "INTEGRATION", "Resolve every open technical-element interface before review.", mef.integration.unresolvedInterfaces);

  const applicable = mef.conformanceMatrix.filter((row) => row.applicableToStage.includes(mef.plantStage));
  const notMet = applicable.filter((row) => row.status === "NOT_MET");
  const pending = applicable.filter((row) => row.status === "PENDING_REVIEW" || row.status === "PARTIAL");
  if (notMet.length > 0) add("F-DOC-001", "ERROR", "DOCUMENTATION", `${String(notMet.length)} applicable requirements are not met.`, notMet.map((row) => row.sr));
  if (pending.length > 0) add("F-DOC-002", "WARNING", "DOCUMENTATION", `${String(pending.length)} applicable requirements still require conformance disposition.`, pending.map((row) => row.sr));
  return diagnostics;
}

export function reviewBlockingInternalFirePraDiagnostics(mef: InternalFirePRA): InternalFirePraDiagnostic[] {
  return validateInternalFirePra(mef).filter((diagnostic) => diagnostic.severity === "ERROR");
}
