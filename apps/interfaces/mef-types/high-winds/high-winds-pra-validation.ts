import {
  HIGH_WINDS_PRA_SR_CATALOG,
  type HighWindsAnalysisRecord,
  type HighWindsHazardType,
  type HighWindsPRA,
  type WindFragilityCurvePoint,
  type WindHazardCurvePoint,
} from "./high-winds-pra";

export type HighWindsPraDiagnosticSeverity = "ERROR" | "WARNING" | "INFORMATION";

export interface HighWindsPraDiagnostic {
  code: string;
  severity: HighWindsPraDiagnosticSeverity;
  area: "SCOPE" | "WHA" | "WFR" | "WPR" | "INTEGRATION" | "DOCUMENTATION" | "WORKFLOW";
  message: string;
  recordRefs: string[];
}

interface LocatedRecord {
  path: string;
  record: HighWindsAnalysisRecord;
}

function isAnalysisRecord(value: unknown): value is HighWindsAnalysisRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.uuid === "string"
    && typeof candidate.code === "string"
    && typeof candidate.name === "string"
    && Array.isArray(candidate.implementsSrs);
}

function locatedRecords(mef: HighWindsPRA): LocatedRecord[] {
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

function cloneHighWindsPra(mef: HighWindsPRA): HighWindsPRA {
  return typeof structuredClone === "function"
    ? structuredClone(mef)
    : JSON.parse(JSON.stringify(mef)) as HighWindsPRA;
}

export function synchronizeHighWindsPraDerivedRegisters(mef: HighWindsPRA): HighWindsPRA {
  const next = cloneHighWindsPra(mef);
  const implementation = new Map<string, LocatedRecord[]>();
  for (const located of locatedRecords(next)) {
    for (const reference of located.record.implementsSrs) {
      implementation.set(reference.sr, [...(implementation.get(reference.sr) ?? []), located]);
    }
  }

  next.conformanceMatrix = Object.entries(HIGH_WINDS_PRA_SR_CATALOG).map(([sr, entry]) => {
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

function hasIncreasingWindAndDecreasingFrequency(points: WindHazardCurvePoint[]): boolean {
  if (points.length < 2) return false;
  return points.every((point, index) => {
    if (point.windSpeed < 0 || point.meanAnnualExceedanceFrequency <= 0) return false;
    if (index === 0) return true;
    const previous = points[index - 1];
    return point.windSpeed > previous.windSpeed
      && point.meanAnnualExceedanceFrequency < previous.meanAnnualExceedanceFrequency;
  });
}

function hasIncreasingWindAndFailureProbability(points: WindFragilityCurvePoint[]): boolean {
  if (points.length < 2) return false;
  return points.every((point, index) => {
    if (point.windSpeed < 0 || probabilityOutOfRange(point.conditionalFailureProbability)) return false;
    if (index === 0) return true;
    const previous = points[index - 1];
    return point.windSpeed > previous.windSpeed
      && point.conditionalFailureProbability >= previous.conditionalFailureProbability;
  });
}

function unresolvedReferences(references: string[], known: Set<string>): string[] {
  return references.filter((reference) => !known.has(reference));
}

export function validateHighWindsPra(mef: HighWindsPRA): HighWindsPraDiagnostic[] {
  const diagnostics: HighWindsPraDiagnostic[] = [];
  const add = (
    code: string,
    severity: HighWindsPraDiagnosticSeverity,
    area: HighWindsPraDiagnostic["area"],
    message: string,
    recordRefs: string[] = [],
  ): void => {
    diagnostics.push({ code, severity, area, message, recordRefs });
  };

  const records = locatedRecords(mef);
  const uuids = new Map<string, string>();
  const codes = new Map<string, string>();
  for (const { path, record } of records) {
    if (uuids.has(record.uuid)) add("W-DUPLICATE-UUID", "ERROR", "INTEGRATION", `Duplicate UUID ${record.uuid} prevents unambiguous traceability.`, [record.uuid, uuids.get(record.uuid) ?? "", path]);
    if (codes.has(record.code)) add("W-DUPLICATE-CODE", "ERROR", "INTEGRATION", `Duplicate record code ${record.code} prevents unambiguous traceability.`, [record.uuid, codes.get(record.code) ?? ""]);
    uuids.set(record.uuid, path);
    codes.set(record.code, record.uuid);
    if (record.status !== "DRAFT" && (record.description.trim().length === 0 || record.basis.trim().length === 0)) add("W-INCOMPLETE-RECORD", "ERROR", "DOCUMENTATION", `${record.code} is ${record.status} but lacks a complete description or basis.`, [record.uuid]);
    const unsupported = record.implementsSrs.filter((reference) => !(reference.sr in HIGH_WINDS_PRA_SR_CATALOG));
    if (unsupported.length > 0) add("W-UNSUPPORTED-SR", "ERROR", "DOCUMENTATION", `${record.code} contains unsupported High Winds requirement references.`, [record.uuid, ...unsupported.map((item) => item.sr)]);
  }

  if (mef.praScope.trim().length === 0) add("W-SCOPE-001", "ERROR", "SCOPE", "Define the integrated High Winds PRA scope.");
  if (mef.analysisBasis.siteBasis === undefined) add("W-SCOPE-002", "ERROR", "SCOPE", "Define a specific or bounding site basis.");
  if (mef.analysisBasis.scopeRecords.length === 0) add("W-SCOPE-003", "ERROR", "SCOPE", "Define the High Winds PRA analysis boundary and retained hazard scope.");
  if (mef.analysisBasis.applications.length === 0) add("W-SCOPE-004", "WARNING", "SCOPE", "Register at least one intended High Winds PRA application.");
  if (mef.analysisBasis.evidenceRegister.length === 0) add("W-SCOPE-005", "WARNING", "SCOPE", "The controlled High Winds evidence register is empty.");
  if (mef.analysisBasis.baselinePra === undefined) add("W-SCOPE-006", "ERROR", "SCOPE", "Define and freeze the baseline PRA used by the High Winds analysis.");
  if (mef.analysisBasis.interfaces.length === 0) add("W-SCOPE-007", "ERROR", "SCOPE", "Define the High Winds PRA input and output interfaces with other technical elements.");
  if ((mef.analysisBasis.siteBasis?.plantOperatingStateRefs.length ?? 0) === 0) add("W-SCOPE-008", "ERROR", "SCOPE", "Identify the plant operating states covered by the High Winds PRA.");

  const candidateByHazard = new Map(mef.hazardScreening.hazardCandidates.map((item) => [item.hazardType, item]));
  const retainedHazards = new Set<HighWindsHazardType>(mef.hazardScreening.hazardCandidates.filter((item) => item.disposition === "RETAINED").map((item) => item.hazardType));
  const screenedHazards = new Set<HighWindsHazardType>(mef.hazardScreening.hazardCandidates.filter((item) => item.disposition === "SCREENED").map((item) => item.hazardType));
  for (const hazardType of ["STRAIGHT_WIND", "TROPICAL_CYCLONE", "TORNADO"] as const) {
    if (!candidateByHazard.has(hazardType)) add("WHA-A-001", "ERROR", "WHA", `Disposition ${hazardType} in the high-wind hazard inventory.`, [hazardType]);
  }
  for (const decision of mef.hazardScreening.screeningDecisions) {
    if (decision.hazardTypes.includes("STRAIGHT_WIND") && decision.disposition === "SCREENED" && decision.criterion === "SCR-3") add("WHA-A-002", "ERROR", "WHA", "Straight winds cannot be deterministically screened using SCR-3.", [decision.uuid]);
    if (decision.disposition === "SCREENED" && decision.investigationRefs.length === 0) add("WHA-A-003", "ERROR", "WHA", `${decision.name} screens a hazard without an investigation confirmation.`, [decision.uuid]);
  }
  if (screenedHazards.size > 1 && mef.hazardScreening.aggregateScreeningChecks.length === 0) add("WHA-A-004", "ERROR", "WHA", "Demonstrate that the aggregate frequency of all probabilistically screened high-wind hazards satisfies SCR-2.");
  if (mef.hazardScreening.hazardCombinations.length === 0) add("WHA-A-005", "WARNING", "WHA", "Document applicable high-wind combinations and coexistent hazards.");

  const dataSourceRefs = new Set(mef.windDataAndReferenceBasis.dataSources.map((item) => item.uuid));
  const adjustmentRefs = new Set(mef.windDataAndReferenceBasis.dataAdjustments.map((item) => item.uuid));
  const referenceWindRefs = new Set(mef.windDataAndReferenceBasis.referenceWindDefinitions.map((item) => item.uuid));
  for (const hazardType of retainedHazards) {
    if (!mef.windDataAndReferenceBasis.referenceWindDefinitions.some((item) => item.hazardType === hazardType)) add("WHA-B-001", "ERROR", "WHA", `Define the reference wind speed and analysis range for retained hazard ${hazardType}.`, [hazardType]);
  }
  for (const source of mef.windDataAndReferenceBasis.dataSources) {
    if (probabilityOutOfRange(source.recordCompleteness)) add("WHA-B-002", "ERROR", "WHA", `${source.name} has record completeness outside zero to one.`, [source.uuid]);
  }
  for (const adjustment of mef.windDataAndReferenceBasis.dataAdjustments) {
    if (!dataSourceRefs.has(adjustment.dataSourceRef)) add("WHA-B-003", "ERROR", "WHA", `${adjustment.name} references an undefined wind-data source.`, [adjustment.uuid, adjustment.dataSourceRef]);
  }
  for (const check of mef.windDataAndReferenceBasis.qualificationChecks) {
    if (!dataSourceRefs.has(check.dataSourceRef)) add("WHA-B-004", "ERROR", "WHA", `${check.name} references an undefined wind-data source.`, [check.uuid, check.dataSourceRef]);
    const unresolved = unresolvedReferences(check.adjustmentRefs, adjustmentRefs);
    if (unresolved.length > 0) add("WHA-B-005", "ERROR", "WHA", `${check.name} references undefined wind-data adjustments.`, [check.uuid, ...unresolved]);
  }
  for (const definition of mef.windDataAndReferenceBasis.referenceWindDefinitions) {
    if (definition.lowerBoundWindSpeed < 0 || definition.upperAnalysisWindSpeed <= definition.lowerBoundWindSpeed) add("WHA-B-006", "ERROR", "WHA", `${definition.name} has an invalid lower or upper analysis wind speed.`, [definition.uuid]);
  }

  if (retainedHazards.has("STRAIGHT_WIND")) {
    if (mef.straightWindHazardAnalysis.stationAssessments.length === 0 || mef.straightWindHazardAnalysis.hazardResults.length === 0) add("WHA-C-001", "ERROR", "WHA", "Complete station assessment and hazard results for retained straight winds.");
    if (mef.capabilityCategory === "CC-II") {
      const components = new Set(mef.straightWindHazardAnalysis.climateComponents.map((item) => item.componentType));
      if (!components.has("THUNDERSTORM") || !components.has("NON_THUNDERSTORM")) add("WHA-C-002", "ERROR", "WHA", "CC-II straight-wind analysis must separately analyze thunderstorm and non-thunderstorm data.");
    }
    for (const result of mef.straightWindHazardAnalysis.hazardResults) {
      if (!referenceWindRefs.has(result.referenceWindDefinitionRef)) add("WHA-C-003", "ERROR", "WHA", `${result.name} references an undefined reference-wind definition.`, [result.uuid]);
      if (!hasIncreasingWindAndDecreasingFrequency(result.curvePoints)) add("WHA-C-004", "ERROR", "WHA", `${result.name} does not provide a valid monotonic straight-wind hazard curve.`, [result.uuid]);
    }
  }

  if (retainedHazards.has("TROPICAL_CYCLONE")) {
    if (mef.tropicalCycloneHazardAnalysis.hazardResults.length === 0) add("WHA-D-001", "ERROR", "WHA", "Develop a tropical-cyclone hazard result for the retained hazard.");
    for (const result of mef.tropicalCycloneHazardAnalysis.hazardResults) {
      if (result.simulationRef === undefined && result.publishedStudyRef === undefined) add("WHA-D-002", "ERROR", "WHA", `${result.name} has neither a qualified published basis nor a probabilistic simulation.`, [result.uuid]);
      if (!referenceWindRefs.has(result.referenceWindDefinitionRef) || !hasIncreasingWindAndDecreasingFrequency(result.curvePoints)) add("WHA-D-003", "ERROR", "WHA", `${result.name} has an undefined reference wind or invalid hazard curve.`, [result.uuid]);
    }
  }

  if (retainedHazards.has("TORNADO")) {
    if (mef.tornadoHazardAnalysis.climatologyRegions.length === 0 || mef.tornadoHazardAnalysis.hazardResults.length === 0) add("WHA-E-001", "ERROR", "WHA", "Develop a representative tornado climatology region and site hazard result.");
    for (const region of mef.tornadoHazardAnalysis.climatologyRegions) {
      if (!region.sufficientlyBroadForRareEvents) add("WHA-E-002", "ERROR", "WHA", `${region.name} is not sufficiently broad to represent rare tornadoes.`, [region.uuid]);
    }
    for (const result of mef.tornadoHazardAnalysis.hazardResults) {
      if (!result.pressureEffectIncluded || !result.atmosphericPressureChangeIncluded || !result.missileEffectIncluded) add("WHA-E-003", "ERROR", "WHA", `${result.name} does not include pressure, APC, and missile effects.`, [result.uuid]);
      if (!referenceWindRefs.has(result.referenceWindDefinitionRef) || !hasIncreasingWindAndDecreasingFrequency(result.curvePoints)) add("WHA-E-004", "ERROR", "WHA", `${result.name} has an undefined reference wind or invalid hazard curve.`, [result.uuid]);
    }
  }

  const hazardCurveRefs = new Set(mef.hazardIntegration.hazardCurves.map((item) => item.uuid));
  const hazardIntervalRefs = new Set(mef.hazardIntegration.hazardIntervals.map((item) => item.uuid));
  for (const hazardType of retainedHazards) {
    if (!mef.hazardIntegration.hazardCurves.some((curve) => curve.hazardType === hazardType)) add("WHA-F-001", "ERROR", "WHA", `Create an integrated hazard curve for retained hazard ${hazardType}.`, [hazardType]);
  }
  for (const curve of mef.hazardIntegration.hazardCurves) {
    if (!referenceWindRefs.has(curve.referenceWindDefinitionRef) || !hasIncreasingWindAndDecreasingFrequency(curve.curvePoints)) add("WHA-F-002", "ERROR", "WHA", `${curve.name} has an undefined reference wind or invalid monotonic curve.`, [curve.uuid]);
  }
  for (const interval of mef.hazardIntegration.hazardIntervals) {
    if (!hazardCurveRefs.has(interval.hazardCurveRef) || interval.upperWindSpeed <= interval.lowerWindSpeed || interval.representativeWindSpeed < interval.lowerWindSpeed || interval.representativeWindSpeed > interval.upperWindSpeed || interval.intervalAnnualFrequency < 0 || probabilityOutOfRange(interval.conditionalWeight)) add("WHA-F-003", "ERROR", "WHA", `${interval.name} has invalid curve linkage, bounds, frequency, or weight.`, [interval.uuid]);
  }
  if (mef.hazardIntegration.convergenceStudies.length === 0 && retainedHazards.size > 0) add("WHA-F-004", "ERROR", "WHA", "Demonstrate hazard-bin and upper-tail convergence for retained hazards.");

  const hwelRefs = new Set(mef.preliminaryPlantResponse.highWindsEquipmentList.map((item) => item.uuid));
  const failureModeRefs = new Set(mef.preliminaryPlantResponse.highWindsEquipmentList.flatMap((item) => item.failureModes.map((failureMode) => failureMode.uuid)));
  const activeHwel = mef.preliminaryPlantResponse.highWindsEquipmentList.filter((item) => item.disposition === "ACTIVE");
  if (activeHwel.length === 0) add("WPR-C-001", "ERROR", "WPR", "Develop a nonempty High Wind Equipment List from the plant-response model.");
  for (const entry of activeHwel) {
    if (entry.failureModes.length === 0) add("WPR-C-002", "ERROR", "WPR", `${entry.name} is active on the HWEL without a wind failure mode.`, [entry.uuid]);
    if (entry.applicableHazardTypes.length === 0 || entry.applicableWindEffects.length === 0) add("WPR-C-003", "ERROR", "WPR", `${entry.name} lacks applicable hazard or wind-effect assignments.`, [entry.uuid]);
  }

  const investigationRefs = new Set(mef.plantInvestigationAndMissileSurvey.investigations.map((item) => item.uuid));
  const surveyZoneRefs = new Set(mef.plantInvestigationAndMissileSurvey.missileSurveyZones.map((item) => item.uuid));
  const missileSourceRefs = new Set(mef.plantInvestigationAndMissileSurvey.missileSources.map((item) => item.uuid));
  if (mef.plantInvestigationAndMissileSurvey.investigations.length === 0) add("WFR-B-001", "ERROR", "WFR", "Perform investigations to establish or confirm plant conditions for fragility analysis.");
  for (const entry of activeHwel) {
    const unresolved = unresolvedReferences(entry.investigationRefs, investigationRefs);
    if (entry.investigationRefs.length === 0 || unresolved.length > 0) add("WFR-B-002", "ERROR", "WFR", `${entry.name} is not supported by a resolved investigation reference.`, [entry.uuid, ...unresolved]);
  }
  for (const source of mef.plantInvestigationAndMissileSurvey.missileSources) {
    if (!surveyZoneRefs.has(source.surveyZoneRef) || probabilityOutOfRange(source.sourceTimeFraction) || source.quantityBestEstimate < 0 || source.representativeMassKilograms < 0) add("WFR-B-003", "ERROR", "WFR", `${source.name} has an invalid survey zone, time fraction, quantity, or mass.`, [source.uuid]);
  }
  for (const profile of mef.plantInvestigationAndMissileSurvey.missilePopulationProfiles) {
    const unresolved = unresolvedReferences(profile.missileSourceRefs, missileSourceRefs);
    if (probabilityOutOfRange(profile.annualTimeFraction) || unresolved.length > 0) add("WFR-B-004", "ERROR", "WFR", `${profile.name} has an invalid time fraction or undefined missile sources.`, [profile.uuid, ...unresolved]);
  }

  const methodSelectionRefs = new Set(mef.sscScreeningAndFragilityBasis.methodSelections.map((item) => item.uuid));
  for (const entry of activeHwel) {
    if (!mef.sscScreeningAndFragilityBasis.methodSelections.some((selection) => selection.sscRefs.includes(entry.uuid))) add("WFR-C-001", "ERROR", "WFR", `${entry.name} lacks a fragility or screening method selection.`, [entry.uuid]);
  }
  for (const selection of mef.sscScreeningAndFragilityBasis.methodSelections) {
    const unresolvedSscs = unresolvedReferences(selection.sscRefs, hwelRefs);
    const unresolvedModes = unresolvedReferences(selection.failureModeRefs, failureModeRefs);
    if (unresolvedSscs.length + unresolvedModes.length > 0) add("WFR-C-002", "ERROR", "WFR", `${selection.name} references undefined HWEL SSCs or failure modes.`, [selection.uuid, ...unresolvedSscs, ...unresolvedModes]);
  }

  const allFragilityCurves = [
    ...mef.pressureAndApcFragilityAnalysis.fragilityCurves,
    ...mef.missileFragilityAnalysis.fragilityCurves,
    ...mef.interactionAndRainFragilityAnalysis.fragilityCurves,
  ];
  const fragilityRefs = new Set(allFragilityCurves.map((item) => item.uuid));
  for (const curve of allFragilityCurves) {
    if (!hwelRefs.has(curve.sscRef) || !failureModeRefs.has(curve.failureModeRef) || !referenceWindRefs.has(curve.referenceWindDefinitionRef) || !methodSelectionRefs.has(curve.methodSelectionRef)) add("WFR-H-001", "ERROR", "WFR", `${curve.name} contains unresolved SSC, failure-mode, reference-wind, or method references.`, [curve.uuid]);
    if (!hasIncreasingWindAndFailureProbability(curve.curvePoints)) add("WFR-H-002", "ERROR", "WFR", `${curve.name} does not provide a valid monotonic fragility curve.`, [curve.uuid]);
    if (!curve.hazardSpecific && curve.crossHazardUseJustification.trim().length === 0) add("WFR-H-003", "ERROR", "WFR", `${curve.name} is reused across hazards without justification.`, [curve.uuid]);
  }

  const needsPressure = activeHwel.some((item) => item.applicableWindEffects.includes("WIND_PRESSURE") || item.applicableWindEffects.includes("ATMOSPHERIC_PRESSURE_CHANGE"));
  if (needsPressure && (mef.pressureAndApcFragilityAnalysis.pressureLoadModels.length === 0 || mef.pressureAndApcFragilityAnalysis.fragilityCurves.length === 0)) add("WFR-D-001", "ERROR", "WFR", "Develop wind-pressure/APC load models and fragility curves for applicable HWEL SSCs.");
  for (const model of mef.pressureAndApcFragilityAnalysis.pressureLoadModels) {
    if (!hwelRefs.has(model.sscRef) || !failureModeRefs.has(model.failureModeRef) || !referenceWindRefs.has(model.referenceWindDefinitionRef)) add("WFR-D-002", "ERROR", "WFR", `${model.name} contains unresolved SSC, failure-mode, or reference-wind links.`, [model.uuid]);
    if (model.flexibleStructure && model.fundamentalFrequencyHertz === undefined) add("WFR-D-003", "ERROR", "WFR", `${model.name} treats a flexible SSC without a fundamental frequency.`, [model.uuid]);
  }

  const needsMissiles = activeHwel.some((item) => item.applicableWindEffects.includes("WIND_GENERATED_MISSILE"));
  if (needsMissiles && (mef.missileFragilityAnalysis.missileCategories.length === 0 || mef.missileFragilityAnalysis.trajectoryModels.length === 0 || mef.missileFragilityAnalysis.impactAndDamageModels.length === 0 || mef.missileFragilityAnalysis.fragilityCurves.length === 0)) add("WFR-E-001", "ERROR", "WFR", "Complete missile categorization, trajectory, impact/damage, and fragility analysis.");
  for (const category of mef.missileFragilityAnalysis.missileCategories) {
    const unresolved = unresolvedReferences(category.missileSourceRefs, missileSourceRefs);
    if (unresolved.length > 0) add("WFR-E-002", "ERROR", "WFR", `${category.name} references undefined missile sources.`, [category.uuid, ...unresolved]);
  }
  for (const model of mef.missileFragilityAnalysis.impactAndDamageModels) {
    if (probabilityOutOfRange(model.probabilityOfHit) || probabilityOutOfRange(model.probabilityOfDamageGivenHit)) add("WFR-E-003", "ERROR", "WFR", `${model.name} contains an invalid hit or conditional-damage probability.`, [model.uuid]);
    if (model.scalingMethod.trim().length > 0 && model.scalingJustification.trim().length === 0) add("WFR-E-004", "ERROR", "WFR", `${model.name} uses scaling without justification.`, [model.uuid]);
  }
  if (needsMissiles && !mef.missileFragilityAnalysis.convergenceStudies.some((study) => study.converged)) add("WFR-E-005", "ERROR", "WFR", "Demonstrate stable missile simulation results over the analyzed wind-speed range.");

  const needsInteraction = activeHwel.some((item) => item.applicableWindEffects.includes("STRUCTURAL_INTERACTION"));
  if (needsInteraction && mef.interactionAndRainFragilityAnalysis.structuralInteractionScenarios.length === 0) add("WFR-F-001", "ERROR", "WFR", "Evaluate structural interactions affecting applicable HWEL SSCs.");
  const needsRain = activeHwel.some((item) => item.applicableWindEffects.includes("WIND_DRIVEN_RAIN"));
  if (needsRain && (mef.interactionAndRainFragilityAnalysis.rainEntryPaths.length === 0 || mef.interactionAndRainFragilityAnalysis.windDrivenRainModels.length === 0 || mef.interactionAndRainFragilityAnalysis.rainTargetVulnerabilities.length === 0)) add("WFR-G-001", "ERROR", "WFR", "Define rain-entry paths, wind-driven rain models, and vulnerable target responses.");

  const initiatingEventRefs = new Set(mef.plantResponseModel.initiatingEventModels.map((item) => item.uuid));
  const eventSequenceRefs = new Set(mef.plantResponseModel.eventSequenceModels.map((item) => item.uuid));
  const missionTimeRefs = new Set(mef.plantResponseModel.missionTimes.map((item) => item.uuid));
  if (mef.plantResponseModel.initiatingEventModels.length === 0 || mef.plantResponseModel.eventSequenceModels.length === 0 || mef.plantResponseModel.systemModelModifications.length === 0) add("WPR-A-001", "ERROR", "WPR", "Develop high-wind initiating events, event sequences, and systems-model modifications.");
  for (const sequence of mef.plantResponseModel.eventSequenceModels) {
    const unresolvedInitiators = unresolvedReferences(sequence.initiatingEventRefs, initiatingEventRefs);
    if (unresolvedInitiators.length > 0 || !missionTimeRefs.has(sequence.missionTimeRef)) add("WPR-B-001", "ERROR", "WPR", `${sequence.name} has undefined initiating-event or mission-time references.`, [sequence.uuid, ...unresolvedInitiators, sequence.missionTimeRef]);
  }
  const unitCount = mef.analysisBasis.siteBasis?.reactorUnitRefs.length ?? 0;
  if (unitCount > 1 && mef.plantResponseModel.multiUnitAssessments.length === 0) add("WPR-B-002", "ERROR", "WPR", "Assess shared resources, SSCs, organizational response, and accessibility for the multi-reactor site.");

  const humanActionRefs = new Set(mef.humanReliabilityAnalysis.humanActions.map((item) => item.uuid));
  const hfeRefs = new Set(mef.humanReliabilityAnalysis.humanFailureEvents.map((item) => item.uuid));
  const contextRefs = new Set(mef.humanReliabilityAnalysis.performanceContexts.map((item) => item.uuid));
  for (const hfe of mef.humanReliabilityAnalysis.humanFailureEvents) {
    if (!humanActionRefs.has(hfe.humanActionRef)) add("WPR-D-001", "ERROR", "WPR", `${hfe.name} references an undefined high-wind human action.`, [hfe.uuid, hfe.humanActionRef]);
  }
  for (const estimate of mef.humanReliabilityAnalysis.hepEstimates) {
    if (!hfeRefs.has(estimate.humanFailureEventRef) || !contextRefs.has(estimate.performanceContextRef) || probabilityOutOfRange(estimate.nominalHep) || probabilityOutOfRange(estimate.highWindsHep) || estimate.dependencyAdjustment < 0) add("WPR-D-002", "ERROR", "WPR", `${estimate.name} has unresolved HFE/context links or invalid probability values.`, [estimate.uuid]);
  }
  if (mef.humanReliabilityAnalysis.humanActions.length > 0 && mef.humanReliabilityAnalysis.confirmations.length === 0) add("WPR-D-003", "ERROR", "WPR", "Confirm credited high-wind actions through procedure review, interview, talk-through, tabletop, or simulation.");

  const quantificationRunRefs = new Set(mef.eventSequenceQuantification.quantificationRuns.map((item) => item.uuid));
  if (mef.eventSequenceQuantification.quantificationRuns.length === 0 || mef.eventSequenceQuantification.eventSequenceFamilyResults.length === 0) add("WPR-E-001", "ERROR", "WPR", "Quantify High Winds PRA event-sequence-family frequencies on a plant-year basis.");
  for (const run of mef.eventSequenceQuantification.quantificationRuns) {
    const unresolvedCurves = unresolvedReferences(run.hazardCurveRefs, hazardCurveRefs);
    const unresolvedIntervals = unresolvedReferences(run.hazardIntervalRefs, hazardIntervalRefs);
    const unresolvedFragilities = unresolvedReferences(run.fragilityRefs, fragilityRefs);
    if (unresolvedCurves.length + unresolvedIntervals.length + unresolvedFragilities.length > 0) add("WPR-E-002", "ERROR", "WPR", `${run.name} has unresolved hazard, interval, or fragility inputs.`, [run.uuid, ...unresolvedCurves, ...unresolvedIntervals, ...unresolvedFragilities]);
    if (run.rareEventApproximationTreatment.trim().length === 0 || run.highFailureProbabilityTreatment.trim().length === 0) add("WPR-E-003", "ERROR", "WPR", `${run.name} does not document rare-event and high-failure-probability numerical treatment.`, [run.uuid]);
  }
  for (const result of mef.eventSequenceQuantification.hazardIntervalResults) {
    if (!quantificationRunRefs.has(result.quantificationRunRef) || !hazardIntervalRefs.has(result.hazardIntervalRef) || probabilityOutOfRange(result.conditionalSequenceProbability) || result.sequenceFrequencyPerPlantYear < 0) add("WPR-E-004", "ERROR", "WPR", `${result.name} has unresolved run/interval links or invalid probability/frequency values.`, [result.uuid]);
  }
  for (const result of mef.eventSequenceQuantification.eventSequenceFamilyResults) {
    if (!quantificationRunRefs.has(result.quantificationRunRef) || result.meanFrequencyPerPlantYear < 0 || result.pointEstimateFrequencyPerPlantYear < 0) add("WPR-E-005", "ERROR", "WPR", `${result.name} has an unresolved run or invalid event-sequence-family frequency.`, [result.uuid]);
  }
  if (mef.eventSequenceQuantification.quantificationRuns.length > 0 && !mef.eventSequenceQuantification.convergenceStudies.some((study) => study.converged)) add("WPR-E-006", "ERROR", "WPR", "Demonstrate quantification convergence for hazard binning, upper-tail truncation, and applicable numerical methods.");
  if (mef.capabilityCategory === "CC-II" && mef.eventSequenceQuantification.uncertaintyResults.length === 0) add("WPR-E-007", "ERROR", "WPR", "Propagate hazard, fragility, and plant-response uncertainty for CC-II results.");

  if (mef.riskInterpretation.riskInsights.length === 0) add("W-RISK-001", "WARNING", "INTEGRATION", "Document High Winds PRA risk insights and dominant contributors.");
  for (const path of mef.riskInterpretation.traceabilityPaths) {
    if (!path.complete) add("W-RISK-002", "ERROR", "INTEGRATION", `${path.name} does not provide complete evidence-to-decision traceability.`, [path.uuid]);
  }
  if (mef.riskInterpretation.quantificationIterations.length > 0 && !mef.riskInterpretation.quantificationIterations.some((iteration) => iteration.decision === "ACCEPT_STABLE")) add("W-RISK-003", "WARNING", "INTEGRATION", "No quantification iteration demonstrates stable accepted results.");

  const openInterfaceRefs = mef.analysisBasis.interfaces.filter((item) => !item.consistent || item.openItems.length > 0).map((item) => item.uuid);
  if (openInterfaceRefs.length > 0) add("W-CLOSE-001", "ERROR", "INTEGRATION", "Resolve inconsistent or open technical-element interfaces before approval.", openInterfaceRefs);
  const openPeerFindings = mef.technicalClosure.peerReviewFindings.filter((item) => item.closureStatus !== "CLOSED").map((item) => item.uuid);
  if (openPeerFindings.length > 0) add("W-CLOSE-002", "WARNING", "WORKFLOW", "Resolve open High Winds peer-review findings before approval.", openPeerFindings);
  if (mef.workflow.approvalSignatures.length > 0 && (openInterfaceRefs.length > 0 || openPeerFindings.length > 0 || diagnostics.some((item) => item.severity === "ERROR"))) add("W-WORKFLOW-001", "ERROR", "WORKFLOW", "Approval signatures are present while blocking High Winds issues remain open.");

  const requiredDocumentation = [
    mef.analysisBasis.documentation,
    mef.hazardScreening.documentation,
    mef.windDataAndReferenceBasis.documentation,
    mef.straightWindHazardAnalysis.documentation,
    mef.tropicalCycloneHazardAnalysis.documentation,
    mef.tornadoHazardAnalysis.documentation,
    mef.hazardIntegration.documentation,
    mef.preliminaryPlantResponse.documentation,
    mef.plantInvestigationAndMissileSurvey.documentation,
    mef.sscScreeningAndFragilityBasis.documentation,
    mef.pressureAndApcFragilityAnalysis.documentation,
    mef.missileFragilityAnalysis.documentation,
    mef.interactionAndRainFragilityAnalysis.documentation,
    mef.plantResponseModel.documentation,
    mef.humanReliabilityAnalysis.documentation,
    mef.eventSequenceQuantification.documentation,
    mef.technicalClosure.documentation,
  ];
  for (const documentation of requiredDocumentation) {
    if (documentation.processDescription.trim().length === 0 || documentation.inputsDescription.trim().length === 0 || documentation.methodsDescription.trim().length === 0 || documentation.resultsDescription.trim().length === 0) add("W-DOC-001", "WARNING", "DOCUMENTATION", `${documentation.name} is incomplete.`, [documentation.uuid]);
  }

  return diagnostics;
}

export function reviewBlockingHighWindsPraDiagnostics(mef: HighWindsPRA): HighWindsPraDiagnostic[] {
  return validateHighWindsPra(mef).filter((diagnostic) => diagnostic.severity === "ERROR");
}
