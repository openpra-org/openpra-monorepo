import { HSA_SR_CATALOG, type HazardsScreeningAnalysis, type HsaAnalysisRecord } from "./hazards-screening-analysis";

export type HsaDiagnosticSeverity = "ERROR" | "WARNING" | "INFORMATION";
export type HsaDiagnosticArea = "SCOPE" | "IDENTIFICATION" | "QUALITATIVE_SCREENING" | "QUANTITATIVE_SCREENING" | "CONFIRMATION" | "INTEGRATION" | "DOCUMENTATION";

export interface HsaDiagnostic {
  code: string;
  severity: HsaDiagnosticSeverity;
  area: HsaDiagnosticArea;
  message: string;
  recordRefs: string[];
}

interface LocatedRecord { path: string; record: HsaAnalysisRecord }

function isRecord(value: unknown): value is HsaAnalysisRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.uuid === "string" && typeof candidate.code === "string" && typeof candidate.name === "string" && Array.isArray(candidate.implementsSrs);
}

function locatedRecords(mef: HazardsScreeningAnalysis): LocatedRecord[] {
  const found: LocatedRecord[] = [];
  const visit = (value: unknown, path: string): void => {
    if (isRecord(value)) found.push({ path, record: value });
    if (value === null || typeof value !== "object") return;
    if (Array.isArray(value)) {
      value.forEach((item, index) => visit(item, `${path}.${String(index)}`));
      return;
    }
    Object.entries(value).forEach(([key, item]) => visit(item, path.length === 0 ? key : `${path}.${key}`));
  };
  visit(mef, "");
  return found;
}

function clone(mef: HazardsScreeningAnalysis): HazardsScreeningAnalysis {
  return typeof structuredClone === "function" ? structuredClone(mef) : JSON.parse(JSON.stringify(mef)) as HazardsScreeningAnalysis;
}

export function synchronizeHsaDerivedRegisters(mef: HazardsScreeningAnalysis): HazardsScreeningAnalysis {
  const next = clone(mef);
  const implementation = new Map<string, LocatedRecord[]>();
  for (const located of locatedRecords(next)) {
    for (const reference of located.record.implementsSrs) implementation.set(reference.sr, [...(implementation.get(reference.sr) ?? []), located]);
  }
  next.conformanceMatrix = Object.entries(HSA_SR_CATALOG).map(([sr, entry]) => {
    const existing = next.conformanceMatrix.find((item) => item.sr === sr);
    const implementations = implementation.get(sr) ?? [];
    const applicable = entry.stages.includes(next.plantStage);
    return {
      sr,
      hlr: entry.hlr,
      capabilityCategory: next.capabilityCategory ?? "CC-II",
      applicableToStage: entry.stages,
      status: !applicable ? "NOT_APPLICABLE" : implementations.length > 0 ? "MET" : existing?.status === "NOT_MET" ? "NOT_MET" : "PENDING_REVIEW",
      satisfiedByElementPaths: implementations.map((item) => item.path),
      evidence: implementations.length > 0 ? implementations.slice(0, 6).map((item) => `${item.record.code} ${item.record.name}`).join("; ") : existing?.evidence ?? "",
      reviewNotes: existing?.reviewNotes,
    };
  });
  next.internalReviewComments.openCount = next.internalReviewComments.comments.filter((comment) => !comment.resolved).length;
  next.internalReviewComments.resolvedCount = next.internalReviewComments.comments.filter((comment) => comment.resolved).length;
  next.modified = new Date().toISOString();
  next.metadata.lastModifiedDate = next.modified;
  return next;
}

function outOfProbabilityRange(value: number): boolean { return value < 0 || value > 1; }

export function validateHazardsScreeningAnalysis(mef: HazardsScreeningAnalysis): HsaDiagnostic[] {
  const diagnostics: HsaDiagnostic[] = [];
  const add = (code: string, severity: HsaDiagnosticSeverity, area: HsaDiagnosticArea, message: string, recordRefs: string[] = []): void => { diagnostics.push({ code, severity, area, message, recordRefs }); };
  const records = locatedRecords(mef);
  const uuids = new Map<string, string>();
  const codes = new Map<string, string>();
  for (const { path, record } of records) {
    const priorUuid = uuids.get(record.uuid);
    const priorCode = codes.get(record.code);
    if (priorUuid !== undefined) add("HS-DUPLICATE-UUID", "ERROR", "DOCUMENTATION", `Duplicate UUID ${record.uuid} prevents unambiguous traceability.`, [priorUuid, path]);
    if (priorCode !== undefined) add("HS-DUPLICATE-CODE", "ERROR", "DOCUMENTATION", `Duplicate record code ${record.code} prevents unambiguous traceability.`, [priorCode, record.uuid]);
    uuids.set(record.uuid, path);
    codes.set(record.code, record.uuid);
    if (record.status !== "DRAFT" && record.status !== "OPEN" && (record.name.trim().length === 0 || record.description.trim().length === 0 || record.basis.trim().length === 0)) add("HS-INCOMPLETE-RECORD", "ERROR", "DOCUMENTATION", `${record.code} is ${record.status} but lacks a complete name, description, or basis.`, [record.uuid]);
    const invalidSrs = record.implementsSrs.filter((item) => !(item.sr in HSA_SR_CATALOG));
    if (invalidSrs.length > 0) add("HS-UNSUPPORTED-SR", "ERROR", "DOCUMENTATION", `${record.code} references an unsupported HSA requirement.`, [record.uuid, ...invalidSrs.map((item) => item.sr)]);
  }

  if (mef.praScope.trim().length === 0) add("HS-SCOPE-001", "ERROR", "SCOPE", "Define the Hazards Screening Analysis scope.");
  if (mef.applications.length === 0) add("HS-SCOPE-002", "ERROR", "SCOPE", "Register at least one intended HSA application.");
  if (mef.evidenceRegister.length === 0) add("HS-SCOPE-003", "WARNING", "SCOPE", "The controlled evidence register is empty.");
  if (mef.integration.interfaces.length === 0) add("HS-SCOPE-004", "ERROR", "INTEGRATION", "Define the HSA interfaces with other PRA technical elements.");
  for (const item of mef.integration.interfaces) {
    if (!item.consistent || item.openItems.length > 0) add("HS-INT-001", "ERROR", "INTEGRATION", `${item.name} is not closed and consistent.`, [item.uuid, ...item.openItems]);
    if (item.transferItems.length === 0) add("HS-INT-002", "WARNING", "INTEGRATION", `${item.name} has no controlled transfer records.`, [item.uuid]);
  }
  if (mef.integration.unresolvedInterfaces.length > 0) add("HS-INT-003", "ERROR", "INTEGRATION", "Resolve every HSA technical-element interface before review.", mef.integration.unresolvedInterfaces);

  const hazardRefs = new Set(mef.hazardInventory.hazards.map((item) => item.uuid));
  const criterionRefs = new Set(mef.screeningCriteria.criteria.map((item) => item.uuid));
  const qualitativeHazards = new Set(mef.qualitativeScreening.decisions.map((item) => item.hazardRef));
  const quantitativeHazards = new Set(mef.quantitativeScreening.decisions.map((item) => item.hazardRef));
  const finalHazards = new Set(mef.integration.finalDispositions.map((item) => item.hazardRef));
  if (hazardRefs.size === 0) add("HS-A-001", "ERROR", "IDENTIFICATION", "Develop a comprehensive HSA hazard inventory.");
  for (const hazard of mef.hazardInventory.hazards) {
    if (hazard.affectedPlantOperatingStateRefs.length === 0 || hazard.affectedRadioactiveMaterialSourceRefs.length === 0) add("HS-A-002", "ERROR", "IDENTIFICATION", `${hazard.name} is not evaluated for plant operating states and radioactive-material sources.`, [hazard.uuid]);
    if (!finalHazards.has(hazard.uuid)) add("HS-A-003", "ERROR", "INTEGRATION", `${hazard.name} has no final disposition.`, [hazard.uuid]);
    if (!qualitativeHazards.has(hazard.uuid) && !quantitativeHazards.has(hazard.uuid)) add("HS-A-004", "ERROR", "QUALITATIVE_SCREENING", `${hazard.name} has no qualitative or quantitative screening decision.`, [hazard.uuid]);
  }
  for (const routing of mef.hazardInventory.routingDecisions) if (!hazardRefs.has(routing.hazardRef) || !routing.dispositionComplete) add("HS-A-005", "ERROR", "IDENTIFICATION", `${routing.name} has an unresolved hazard or incomplete route.`, [routing.uuid, routing.hazardRef]);
  for (const interaction of mef.combinedHazards.interactions) {
    const unresolved = [interaction.primaryHazardRef, ...interaction.interactingHazardRefs].filter((ref) => !hazardRefs.has(ref));
    if (unresolved.length > 0) add("HS-A-006", "ERROR", "IDENTIFICATION", `${interaction.name} references undefined hazards.`, [interaction.uuid, ...unresolved]);
  }

  if (criterionRefs.size === 0) add("HS-B-001", "ERROR", "QUALITATIVE_SCREENING", "Define approved qualitative and quantitative screening criteria.");
  for (const decision of mef.qualitativeScreening.decisions) {
    if (!hazardRefs.has(decision.hazardRef) || !criterionRefs.has(decision.criterionRef)) add("HS-B-002", "ERROR", "QUALITATIVE_SCREENING", `${decision.name} has an unresolved hazard or criterion.`, [decision.uuid, decision.hazardRef, decision.criterionRef]);
    if (decision.decision === "SCREEN_OUT" && (!decision.secondaryHazardsAddressed || !decision.uncertaintyAddressed || decision.siteSpecificFacts.length === 0)) add("HS-B-003", "ERROR", "QUALITATIVE_SCREENING", `${decision.name} does not support qualitative screening with site facts, secondary-hazard treatment, and uncertainty treatment.`, [decision.uuid]);
  }

  const frequencyHazards = new Set(mef.quantitativeCharacterization.frequencyModels.map((item) => item.hazardRef));
  for (const model of mef.quantitativeCharacterization.frequencyModels) {
    if (!hazardRefs.has(model.hazardRef)) add("HS-C-001", "ERROR", "QUANTITATIVE_SCREENING", `${model.name} references an undefined hazard.`, [model.uuid, model.hazardRef]);
    if (model.meanAnnualFrequency < 0 || model.lowerAnnualFrequency < 0 || model.upperAnnualFrequency < model.meanAnnualFrequency || model.meanAnnualFrequency < model.lowerAnnualFrequency) add("HS-C-002", "ERROR", "QUANTITATIVE_SCREENING", `${model.name} contains an invalid annual-frequency range.`, [model.uuid]);
  }
  const sscRefs = new Set(mef.plantResponse.vulnerableSscs.map((item) => item.uuid));
  for (const ssc of mef.plantResponse.vulnerableSscs) if (outOfProbabilityRange(ssc.conditionalFailureProbability)) add("HS-C-003", "ERROR", "QUANTITATIVE_SCREENING", `${ssc.name} contains an invalid conditional failure probability.`, [ssc.uuid]);
  const scenarioRefs = new Set(mef.plantResponse.scenarios.map((item) => item.uuid));
  for (const scenario of mef.plantResponse.scenarios) {
    const unresolvedHazards = scenario.hazardRefs.filter((ref) => !hazardRefs.has(ref));
    const unresolvedSscs = scenario.affectedSscRefs.filter((ref) => !sscRefs.has(ref));
    if (unresolvedHazards.length + unresolvedSscs.length > 0) add("HS-C-004", "ERROR", "QUANTITATIVE_SCREENING", `${scenario.name} has unresolved hazard or vulnerable-SSC references.`, [scenario.uuid, ...unresolvedHazards, ...unresolvedSscs]);
    if (outOfProbabilityRange(scenario.conditionalSequenceProbability) || scenario.meanAnnualFrequency < 0) add("HS-C-005", "ERROR", "QUANTITATIVE_SCREENING", `${scenario.name} contains an invalid conditional probability or frequency.`, [scenario.uuid]);
  }
  for (const effect of mef.plantResponse.humanActionEffects) if (outOfProbabilityRange(effect.baselineHep) || outOfProbabilityRange(effect.hazardAdjustedHep)) add("HS-C-006", "ERROR", "QUANTITATIVE_SCREENING", `${effect.name} contains an invalid human-error probability.`, [effect.uuid]);
  for (const estimate of mef.quantitativeScreening.consequenceEstimates) if (!scenarioRefs.has(estimate.scenarioRef) || estimate.meanConsequence < 0) add("HS-C-007", "ERROR", "QUANTITATIVE_SCREENING", `${estimate.name} has an unresolved scenario or invalid consequence.`, [estimate.uuid, estimate.scenarioRef]);
  for (const decision of mef.quantitativeScreening.decisions) {
    if (!hazardRefs.has(decision.hazardRef) || !criterionRefs.has(decision.criterionRef) || !frequencyHazards.has(decision.hazardRef)) add("HS-C-008", "ERROR", "QUANTITATIVE_SCREENING", `${decision.name} has an unresolved hazard, criterion, or hazard-frequency model.`, [decision.uuid]);
    if (decision.meanEventSequenceFamilyFrequency < 0 || decision.riskContribution < 0) add("HS-C-009", "ERROR", "QUANTITATIVE_SCREENING", `${decision.name} contains an invalid quantitative result.`, [decision.uuid]);
  }

  if (mef.confirmations.investigations.length === 0) add("HS-D-001", "ERROR", "CONFIRMATION", "Record plant and surroundings investigations that confirm the HSA basis.");
  for (const item of mef.confirmations.investigations) if (!item.asBuiltOrIntendedConfirmed) add("HS-D-002", "ERROR", "CONFIRMATION", `${item.name} does not confirm the actual or intended plant basis.`, [item.uuid]);
  if (mef.traceability.paths.length === 0) add("HS-E-001", "ERROR", "DOCUMENTATION", "Create end-to-end HSA traceability paths.");
  for (const path of mef.traceability.paths) if (!path.complete) add("HS-E-002", "ERROR", "DOCUMENTATION", `${path.name} is incomplete.`, [path.uuid]);

  const applicable = mef.conformanceMatrix.filter((row) => row.applicableToStage.includes(mef.plantStage));
  const notMet = applicable.filter((row) => row.status === "NOT_MET");
  const pending = applicable.filter((row) => row.status === "PENDING_REVIEW" || row.status === "PARTIAL");
  if (notMet.length > 0) add("HS-CONF-001", "ERROR", "DOCUMENTATION", `${String(notMet.length)} applicable HSA supporting requirements are not met.`, notMet.map((item) => item.sr));
  if (pending.length > 0) add("HS-CONF-002", "WARNING", "DOCUMENTATION", `${String(pending.length)} applicable HSA supporting requirements still require conformance evidence.`, pending.map((item) => item.sr));
  return diagnostics;
}

export function reviewBlockingHsaDiagnostics(mef: HazardsScreeningAnalysis): HsaDiagnostic[] {
  return validateHazardsScreeningAnalysis(mef).filter((item) => item.severity === "ERROR");
}
