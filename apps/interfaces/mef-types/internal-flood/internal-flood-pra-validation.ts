import { INTERNAL_FLOOD_PRA_SR_CATALOG, type InternalFloodAnalysisRecord, type InternalFloodPRA } from "./internal-flood-pra";

export type InternalFloodPraDiagnosticSeverity = "ERROR" | "WARNING" | "INFORMATION";

export interface InternalFloodPraDiagnostic {
  code: string;
  severity: InternalFloodPraDiagnosticSeverity;
  area: "SCOPE" | "FLPP" | "FLSO" | "FLSN" | "FLEV" | "FLPR" | "FLHR" | "FLESQ" | "INTEGRATION" | "DOCUMENTATION";
  message: string;
  recordRefs: string[];
}

interface LocatedRecord {
  path: string;
  record: InternalFloodAnalysisRecord;
}

function isAnalysisRecord(value: unknown): value is InternalFloodAnalysisRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.uuid === "string"
    && typeof candidate.code === "string"
    && typeof candidate.name === "string"
    && Array.isArray(candidate.implementsSrs);
}

function locatedRecords(mef: InternalFloodPRA): LocatedRecord[] {
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

export function synchronizeInternalFloodPraDerivedRegisters(mef: InternalFloodPRA): InternalFloodPRA {
  const next = typeof structuredClone === "function"
    ? structuredClone(mef)
    : JSON.parse(JSON.stringify(mef)) as InternalFloodPRA;
  const implementation = new Map<string, LocatedRecord[]>();
  for (const located of locatedRecords(next)) {
    for (const reference of located.record.implementsSrs) {
      implementation.set(reference.sr, [...(implementation.get(reference.sr) ?? []), located]);
    }
  }

  next.integration.selectedFloodAreaRefs = next.plantPartitioning.floodAreas.map((area) => area.uuid);
  next.integration.selectedFloodSourceRefs = next.sourcesIdentificationAndCharacterization.sources.map((source) => source.uuid);
  next.integration.retainedFloodScenarioRefs = next.scenariosDevelopment.floodScenarios.filter((scenario) => scenario.disposition !== "SCREENED").map((scenario) => scenario.uuid);
  next.integration.initiatingEventRefs = next.initiatingEvents.initiatingEvents.map((event) => event.uuid);
  next.integration.plantResponseModelRefs = [
    ...next.plantResponseModel.eventSequenceModels.map((model) => model.uuid),
    ...next.plantResponseModel.systemModelModifications.map((model) => model.uuid),
  ];
  next.integration.humanFailureEventRefs = next.humanReliabilityAnalysis.humanFailureEvents.map((event) => event.uuid);
  next.integration.quantificationResultRefs = next.eventSequenceQuantification.eventSequenceFamilyResults.map((result) => result.uuid);

  next.conformanceMatrix = Object.entries(INTERNAL_FLOOD_PRA_SR_CATALOG).map(([sr, entry]) => {
    const existing = next.conformanceMatrix.find((item) => item.sr === sr);
    const implementations = implementation.get(sr) ?? [];
    const satisfiedByElementPaths = implementations.map((item) => item.path);
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
      satisfiedByElementPaths,
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

export function validateInternalFloodPra(mef: InternalFloodPRA): InternalFloodPraDiagnostic[] {
  const diagnostics: InternalFloodPraDiagnostic[] = [];
  const add = (code: string, severity: InternalFloodPraDiagnosticSeverity, area: InternalFloodPraDiagnostic["area"], message: string, recordRefs: string[] = []): void => {
    diagnostics.push({ code, severity, area, message, recordRefs });
  };
  const records = locatedRecords(mef);
  const uuids = new Map<string, string>();
  const codes = new Map<string, string>();
  for (const { path, record } of records) {
    if (uuids.has(record.uuid)) add("FL-DUPLICATE-UUID", "ERROR", "INTEGRATION", `Duplicate UUID ${record.uuid} prevents unambiguous traceability.`, [record.uuid, uuids.get(record.uuid) ?? "", path]);
    if (codes.has(record.code)) add("FL-DUPLICATE-CODE", "ERROR", "INTEGRATION", `Duplicate record code ${record.code} prevents unambiguous traceability.`, [record.uuid, codes.get(record.code) ?? ""]);
    uuids.set(record.uuid, path);
    codes.set(record.code, record.uuid);
    if (record.status !== "DRAFT" && (record.description.trim().length === 0 || record.basis.trim().length === 0)) add("FL-INCOMPLETE-RECORD", "ERROR", "DOCUMENTATION", `${record.code} is ${record.status} but has no complete description and basis.`, [record.uuid]);
    const unsupported = record.implementsSrs.filter((reference) => !(reference.sr in INTERNAL_FLOOD_PRA_SR_CATALOG));
    if (unsupported.length > 0) add("FL-UNSUPPORTED-SR", "ERROR", "DOCUMENTATION", `${record.code} contains unsupported Internal Flood requirement references.`, [record.uuid, ...unsupported.map((item) => item.sr)]);
  }

  if (mef.praScope.trim().length === 0) add("FL-SCOPE-001", "ERROR", "SCOPE", "Define the integrated Internal Flood PRA scope.");
  if (mef.applications.length === 0) add("FL-SCOPE-002", "WARNING", "SCOPE", "Register at least one intended Internal Flood PRA application.");
  if (mef.evidenceRegister.length === 0) add("FL-SCOPE-003", "WARNING", "SCOPE", "The controlled evidence register is empty.");
  if (mef.baselinePra === undefined) add("FL-SCOPE-004", "ERROR", "SCOPE", "Define and freeze the baseline PRA used by the Internal Flood analysis.");

  const areaRefs = new Set(mef.plantPartitioning.floodAreas.map((area) => area.uuid));
  const sourceRefs = new Set(mef.sourcesIdentificationAndCharacterization.sources.map((source) => source.uuid));
  const releaseRefs = new Set(mef.sourcesIdentificationAndCharacterization.releaseCharacterizations.map((release) => release.uuid));
  const scenarioRefs = new Set(mef.scenariosDevelopment.floodScenarios.map((scenario) => scenario.uuid));
  const scenarioGroupRefs = new Set(mef.initiatingEvents.scenarioGroups.map((group) => group.uuid));
  const initiatingEventRefs = new Set(mef.initiatingEvents.initiatingEvents.map((event) => event.uuid));
  const hfeRefs = new Set(mef.humanReliabilityAnalysis.humanFailureEvents.map((event) => event.uuid));

  if (areaRefs.size === 0) add("FLPP-001", "ERROR", "FLPP", "Define the complete set of nonoverlapping flood areas.");
  for (const check of mef.plantPartitioning.coverageChecks) {
    if (!check.complete || !check.nonOverlapping || check.unassignedLocations.length > 0 || check.overlappingAreaPairs.length > 0) add("FLPP-002", "ERROR", "FLPP", `${check.name} does not demonstrate complete, nonoverlapping flood-area coverage.`, [check.uuid, ...check.unassignedLocations]);
  }
  for (const source of mef.sourcesIdentificationAndCharacterization.sources) if (!areaRefs.has(source.floodAreaRef)) add("FLSO-001", "ERROR", "FLSO", `${source.name} references an undefined flood area.`, [source.uuid, source.floodAreaRef]);
  for (const release of mef.sourcesIdentificationAndCharacterization.releaseCharacterizations) {
    if (!sourceRefs.has(release.sourceRef)) add("FLSO-002", "ERROR", "FLSO", `${release.name} references an undefined flood source.`, [release.uuid, release.sourceRef]);
    if (release.minimumReleaseRateCubicMetresPerMinute > release.releaseRateCubicMetresPerMinute || release.releaseRateCubicMetresPerMinute > release.maximumReleaseRateCubicMetresPerMinute) add("FLSO-003", "ERROR", "FLSO", `${release.name} has an inconsistent release-rate range.`, [release.uuid]);
  }
  for (const path of mef.scenariosDevelopment.propagationPaths) if (!areaRefs.has(path.originFloodAreaRef) || !areaRefs.has(path.destinationFloodAreaRef)) add("FLSN-001", "ERROR", "FLSN", `${path.name} references an undefined origin or destination flood area.`, [path.uuid, path.originFloodAreaRef, path.destinationFloodAreaRef]);
  for (const scenario of mef.scenariosDevelopment.floodScenarios) {
    if (!sourceRefs.has(scenario.sourceRef) || !releaseRefs.has(scenario.releaseCharacterizationRef) || !areaRefs.has(scenario.originFloodAreaRef)) add("FLSN-002", "ERROR", "FLSN", `${scenario.name} has an unresolved source, release, or origin-area reference.`, [scenario.uuid]);
  }
  for (const group of mef.initiatingEvents.scenarioGroups) {
    const unresolved = group.floodScenarioRefs.filter((reference) => !scenarioRefs.has(reference));
    if (unresolved.length > 0) add("FLEV-001", "ERROR", "FLEV", `${group.name} contains unresolved flood-scenario references.`, [group.uuid, ...unresolved]);
  }
  for (const estimate of mef.initiatingEvents.frequencyEstimates) {
    if (!scenarioGroupRefs.has(estimate.floodScenarioGroupRef) || !initiatingEventRefs.has(estimate.initiatingEventRef)) add("FLEV-002", "ERROR", "FLEV", `${estimate.name} has an unresolved group or initiating-event reference.`, [estimate.uuid]);
    if (estimate.meanFrequencyPerPlantYear < 0) add("FLEV-003", "ERROR", "FLEV", `${estimate.name} has a negative annual frequency.`, [estimate.uuid]);
  }
  if (mef.plantResponseModel.eventSequenceModels.length === 0 || mef.plantResponseModel.systemModelModifications.length === 0) add("FLPR-001", "ERROR", "FLPR", "Develop flood-specific event-sequence and systems-model treatments.");
  for (const event of mef.humanReliabilityAnalysis.humanFailureEvents) if (!mef.humanReliabilityAnalysis.humanActions.some((action) => action.uuid === event.humanActionRef)) add("FLHR-001", "ERROR", "FLHR", `${event.name} references an undefined human action.`, [event.uuid, event.humanActionRef]);
  for (const estimate of mef.humanReliabilityAnalysis.hepEstimates) if (!hfeRefs.has(estimate.humanFailureEventRef) || estimate.meanHep < 0 || estimate.meanHep > 1) add("FLHR-002", "ERROR", "FLHR", `${estimate.name} has an unresolved HFE or invalid probability.`, [estimate.uuid, estimate.humanFailureEventRef]);
  if (mef.eventSequenceQuantification.eventSequenceFamilyResults.length === 0) add("FLESQ-001", "ERROR", "FLESQ", "Quantify the retained flood-induced event-sequence families.");
  for (const run of mef.eventSequenceQuantification.quantificationRuns) if (!run.converged || run.convergenceMetric > run.convergenceCriterion) add("FLESQ-002", "ERROR", "FLESQ", `${run.name} has not demonstrated quantification convergence.`, [run.uuid]);
  for (const result of mef.eventSequenceQuantification.eventSequenceFamilyResults) if (!initiatingEventRefs.has(result.initiatingEventRef)) add("FLESQ-003", "ERROR", "FLESQ", `${result.name} references an undefined initiating event.`, [result.uuid, result.initiatingEventRef]);

  if (mef.integration.interfaces.length === 0) add("FL-INT-001", "ERROR", "INTEGRATION", "Create and close the external technical-element interface records.");
  for (const item of mef.integration.interfaces) if (!item.consistent || item.openItems.length > 0) add("FL-INT-002", "ERROR", "INTEGRATION", `${item.name} is not closed and consistent.`, [item.uuid, ...item.openItems]);
  for (const check of mef.integration.consistencyChecks) if (check.result === "OPEN" || check.result === "FAIL") add("FL-INT-003", "ERROR", "INTEGRATION", `${check.name} has result ${check.result}.`, [check.uuid, ...check.openItems]);
  if (mef.integration.unresolvedInterfaces.length > 0) add("FL-INT-004", "ERROR", "INTEGRATION", "Resolve every open technical-element interface before review.", mef.integration.unresolvedInterfaces);

  const applicable = mef.conformanceMatrix.filter((row) => row.applicableToStage.includes(mef.plantStage));
  const notMet = applicable.filter((row) => row.status === "NOT_MET");
  const pending = applicable.filter((row) => row.status === "PENDING_REVIEW" || row.status === "PARTIAL");
  if (notMet.length > 0) add("FL-DOC-001", "ERROR", "DOCUMENTATION", `${String(notMet.length)} applicable requirements are not met.`, notMet.map((row) => row.sr));
  if (pending.length > 0) add("FL-DOC-002", "WARNING", "DOCUMENTATION", `${String(pending.length)} applicable requirements still require conformance disposition.`, pending.map((row) => row.sr));
  return diagnostics;
}

export function reviewBlockingInternalFloodPraDiagnostics(mef: InternalFloodPRA): InternalFloodPraDiagnostic[] {
  return validateInternalFloodPra(mef).filter((diagnostic) => diagnostic.severity === "ERROR");
}
