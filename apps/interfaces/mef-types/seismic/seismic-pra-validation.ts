import { SEISMIC_PRA_SR_CATALOG, type SeismicPRA } from "./seismic-pra";

export type SeismicPraDiagnosticSeverity = "ERROR" | "WARNING" | "INFORMATION";

export interface SeismicPraDiagnostic {
  code: string;
  severity: SeismicPraDiagnosticSeverity;
  area: "SCOPE" | "SHA" | "SFR" | "SPR" | "INTEGRATION" | "DOCUMENTATION";
  message: string;
  recordRefs: string[];
}

function findDuplicateUuids(mef: SeismicPRA): string[] {
  const duplicates = new Set<string>();
  const visit = (value: object): void => {
    const record = value as Record<string, string | number | boolean | object | null | undefined>;
    Object.values(record).forEach((child) => {
      if (child !== null && typeof child === "object") {
        if (Array.isArray(child)) {
          const siblingUuids = new Set<string>();
          child.forEach((item) => {
            if (item !== null && typeof item === "object") {
              const itemRecord = item as Record<string, string | number | boolean | object | null | undefined>;
              if (typeof itemRecord.uuid === "string" && itemRecord.uuid.trim().length > 0) {
                if (siblingUuids.has(itemRecord.uuid)) duplicates.add(itemRecord.uuid);
                siblingUuids.add(itemRecord.uuid);
              }
              visit(item);
            }
          });
        } else {
          visit(child);
        }
      }
    });
  };
  visit(mef);
  return [...duplicates];
}

function synchronizeSeismicPraDerivedRegisters(mef: SeismicPRA): SeismicPRA {
  const next = structuredClone(mef);
  const sha = next.seismicHazardAnalysis;
  const sfr = next.seismicFragilityAnalysis;
  const spr = next.seismicPlantResponseAnalysis;
  const equipment = spr.seismicEquipmentListDevelopment.equipment;
  const fragilities = sfr.results.fragilityEvaluations;
  const fragilitySscRefs = new Set(fragilities.map((fragility) => fragility.sscRef));
  const fragilityFailureModeRefs = new Set(fragilities.map((fragility) => fragility.systemsFailureModeRef));
  const retainedHazards = sha.secondaryHazardEvaluation.hazards.filter((hazard) => hazard.screening.disposition === "RETAINED");
  const modeledSecondaryRefs = new Set([
    ...spr.initiatingEventIdentification.secondaryHazardInitiators.map((initiator) => initiator.secondaryHazardRef).filter((reference): reference is string => reference !== undefined),
    ...spr.plantResponseModel.retainedHazardModels.map((model) => model.hazardAnalysisRef),
  ]);

  next.integration.selectedGroundMotionParameterRefs = sha.analysisBasis.groundMotionParameters.filter((parameter) => parameter.usedForFragility || parameter.usedForPlantResponse).map((parameter) => parameter.uuid);
  next.integration.selectedControlPointRefs = sha.responseSpectraEvaluation.controlPoints.map((controlPoint) => controlPoint.uuid);
  next.integration.hazardCurveRefs = sha.hazardQuantification.hazardCurves.map((curve) => curve.uuid);
  next.integration.responseSpectrumRefs = [
    ...sha.responseSpectraEvaluation.horizontalSpectra.map((spectrum) => spectrum.uuid),
    ...sha.responseSpectraEvaluation.verticalSpectra.map((spectrum) => spectrum.uuid),
    ...sha.responseSpectraEvaluation.foundationInputResponseSpectra.map((spectrum) => spectrum.uuid),
    ...sha.hazardQuantification.uniformHazardSpectra.map((spectrum) => spectrum.uuid),
  ];
  next.integration.hazardIntervalRefs = sha.hazardQuantification.seismicPraInputs.hazardIntervals.map((interval) => interval.uuid);
  next.integration.fragilityResultRefs = fragilities.map((fragility) => fragility.uuid);
  next.integration.eventSequenceFamilyQuantificationRefs = spr.quantification.eventSequenceFamilyQuantifications.map((result) => result.uuid);
  next.integration.coverage.sprEquipmentCount = equipment.length;
  next.integration.coverage.fragilityScopeEquipmentCount = sfr.scope.includedSscRefs.length;
  next.integration.coverage.quantifiedFragilityCount = fragilities.length;
  next.integration.coverage.unlinkedEquipmentRefs = equipment.filter((item) => !fragilitySscRefs.has(item.uuid) && item.disposition === "ACTIVE").map((item) => item.uuid);
  next.integration.coverage.unmodeledFailureModeRefs = equipment.flatMap((item) => item.failureModes.filter((failureMode) => !fragilityFailureModeRefs.has(failureMode.uuid) && item.disposition === "ACTIVE").map((failureMode) => failureMode.uuid));
  next.integration.coverage.retainedSecondaryHazardRefs = retainedHazards.map((hazard) => hazard.uuid);
  next.integration.coverage.modeledSecondaryHazardRefs = retainedHazards.filter((hazard) => modeledSecondaryRefs.has(hazard.uuid)).map((hazard) => hazard.uuid);
  next.internalReviewComments.openCount = next.internalReviewComments.comments.filter((comment) => !comment.resolved).length;
  next.internalReviewComments.resolvedCount = next.internalReviewComments.comments.filter((comment) => comment.resolved).length;
  return next;
}

function validateSeismicPra(mef: SeismicPRA): SeismicPraDiagnostic[] {
  const diagnostics: SeismicPraDiagnostic[] = [];
  const add = (code: string, severity: SeismicPraDiagnosticSeverity, area: SeismicPraDiagnostic["area"], message: string, recordRefs: string[] = []): void => {
    diagnostics.push({ code, severity, area, message, recordRefs });
  };
  const sha = mef.seismicHazardAnalysis;
  const sfr = mef.seismicFragilityAnalysis;
  const spr = mef.seismicPlantResponseAnalysis;

  if (mef.praScope.trim().length === 0) add("SCOPE-001", "ERROR", "SCOPE", "Define the integrated Seismic PRA scope.");
  if (mef.applications.length === 0) add("SCOPE-002", "WARNING", "SCOPE", "Register at least one intended Seismic PRA application.");
  if (mef.evidenceRegister.length === 0) add("SCOPE-003", "WARNING", "SCOPE", "The common evidence register is empty.");
  if (mef.configurationBaseline.plantConfigurationRefs.length === 0) add("SCOPE-004", "ERROR", "SCOPE", "Link the plant configuration represented by the analysis.");
  if (mef.configurationBaseline.changeControlProcess.trim().length === 0) add("SCOPE-005", "WARNING", "SCOPE", "Document the configuration change-control process.");
  if (mef.configurationBaseline.openItems.length > 0) add("SCOPE-006", "WARNING", "SCOPE", "The configuration baseline has open items that require tracked closure.", mef.configurationBaseline.openItems);
  const duplicateUuids = findDuplicateUuids(mef);
  if (duplicateUuids.length > 0) add("SCOPE-007", "ERROR", "SCOPE", "Duplicate UUIDs within a controlled register prevent unambiguous end-to-end traceability.", duplicateUuids);
  const evidenceRefs = new Set(mef.evidenceRegister.map((evidence) => evidence.uuid));
  const unresolvedApplicationEvidence = mef.applications.flatMap((application) => application.evidenceRefs.filter((reference) => !evidenceRefs.has(reference)));
  if (unresolvedApplicationEvidence.length > 0) add("SCOPE-008", "ERROR", "SCOPE", "Application records reference evidence that is not in the common evidence register.", unresolvedApplicationEvidence);
  const invalidEvidenceRequirements = mef.evidenceRegister.flatMap((evidence) => evidence.implementsSrs.filter((reference) => !(reference.sr in SEISMIC_PRA_SR_CATALOG)).map((reference) => `${evidence.uuid}:${reference.sr}`));
  if (invalidEvidenceRequirements.length > 0) add("SCOPE-009", "ERROR", "SCOPE", "Evidence records contain unsupported Seismic PRA requirement references.", invalidEvidenceRequirements);

  if (sha.analysisBasis.groundMotionParameters.length === 0) add("SHA-001", "ERROR", "SHA", "Define at least one shared ground-motion parameter.");
  if (sha.earthScienceInputs.dataSets.length === 0) add("SHA-002", "ERROR", "SHA", "Register the earth-science data used by the hazard analysis.");
  if (sha.earthScienceInputs.studyRegions.length === 0) add("SHA-003", "ERROR", "SHA", "Define the regional and local study coverage.");
  if (sha.earthScienceInputs.earthquakeCatalog.events.length === 0) add("SHA-004", "WARNING", "SHA", "The earthquake catalog has no event records.");
  if (sha.sourceCharacterization.earthquakeSources.length === 0) add("SHA-005", "ERROR", "SHA", "Characterize the credible seismic sources.");
  if (sha.groundMotionCharacterization.predictionModels.length === 0) add("SHA-006", "ERROR", "SHA", "Select and justify the ground-motion prediction models.");
  if (sha.siteResponseAnalysis.localSiteResponseIncluded && (sha.siteResponseAnalysis.profiles.length === 0 || sha.siteResponseAnalysis.methods.length === 0)) {
    add("SHA-007", "ERROR", "SHA", "Local site response is included but its profiles or analysis methods are missing.");
  }
  if (sha.hazardQuantification.hazardCurves.length === 0) add("SHA-008", "ERROR", "SHA", "Provide the mean and fractile hazard results.");
  if (sha.hazardQuantification.uniformHazardSpectra.length === 0) add("SHA-009", "ERROR", "SHA", "Provide uniform-hazard spectra for the selected motion levels.");
  if (sha.secondaryHazardEvaluation.hazards.length === 0) add("SHA-010", "ERROR", "SHA", "Identify and disposition the applicable secondary seismic hazards.");
  for (const link of sha.documentation.traceabilityLinks) {
    if (link.sourceRef.trim().length === 0 || link.targetRef.trim().length === 0 || link.relationship.trim().length === 0) {
      add("SHA-016", "ERROR", "SHA", "Complete every SHA source-to-result traceability relationship.", [link.uuid]);
    }
    const invalidRequirements = link.requirementRefs.filter((reference) => !(reference.sr in SEISMIC_PRA_SR_CATALOG));
    if (invalidRequirements.length > 0) add("SHA-017", "ERROR", "SHA", "A SHA traceability link contains unsupported requirement references.", [link.uuid, ...invalidRequirements.map((reference) => reference.sr)]);
  }

  const curveRefs = new Set(sha.hazardQuantification.hazardCurves.map((curve) => curve.uuid));
  const parameterRefs = new Set(sha.analysisBasis.groundMotionParameters.map((parameter) => parameter.uuid));
  const controlPointRefs = new Set(sha.responseSpectraEvaluation.controlPoints.map((controlPoint) => controlPoint.uuid));
  const intervals = [...sha.hazardQuantification.seismicPraInputs.hazardIntervals].sort((left, right) => left.lowerGroundMotion - right.lowerGroundMotion);
  for (const interval of intervals) {
    if (interval.lowerGroundMotion >= interval.upperGroundMotion || interval.representativeGroundMotion < interval.lowerGroundMotion || interval.representativeGroundMotion > interval.upperGroundMotion) {
      add("SHA-011", "ERROR", "SHA", `${interval.name} has invalid lower, representative, or upper ground-motion values.`, [interval.uuid]);
    }
    if (!curveRefs.has(interval.sourceHazardCurveRef)) add("SHA-012", "ERROR", "SHA", `${interval.name} references a hazard curve that is not in the SHA result register.`, [interval.uuid, interval.sourceHazardCurveRef]);
    if (!parameterRefs.has(interval.groundMotionParameterRef)) add("SHA-013", "ERROR", "SHA", `${interval.name} references an undefined ground-motion parameter.`, [interval.uuid, interval.groundMotionParameterRef]);
    if (!controlPointRefs.has(interval.controlPointRef)) add("SHA-014", "ERROR", "SHA", `${interval.name} references an undefined control point.`, [interval.uuid, interval.controlPointRef]);
  }
  for (let index = 1; index < intervals.length; index += 1) {
    const previous = intervals[index - 1];
    const current = intervals[index];
    if (previous !== undefined && current !== undefined && current.lowerGroundMotion < previous.upperGroundMotion) {
      add("SHA-015", "ERROR", "SHA", `${previous.name} and ${current.name} overlap.`, [previous.uuid, current.uuid]);
    }
  }

  const equipment = spr.seismicEquipmentListDevelopment.equipment;
  if (equipment.length === 0) add("SPR-001", "ERROR", "SPR", "Develop the seismic equipment list from the plant systems model and hazard interfaces.");
  if (sfr.scope.seismicEquipmentListRef.trim().length === 0) add("SFR-001", "ERROR", "SFR", "Link fragility scope to the controlled seismic equipment list.");
  if (sfr.seismicResponseAnalysis.structuralModels.length === 0) add("SFR-002", "ERROR", "SFR", "Provide the structural response model or justified scaling basis.");
  if (sfr.plantInvestigations.length === 0) add("SFR-003", "ERROR", "SFR", "Record the applicable walkdown, design review, or simulated plant investigation.");
  if (sfr.results.fragilityEvaluations.length === 0) add("SFR-004", "ERROR", "SFR", "Provide the retained SSC fragility evaluations.");

  const fragilityRefs = new Set(sfr.results.fragilityEvaluations.map((fragility) => fragility.uuid));
  const mechanismRefs = new Set(sfr.results.failureMechanisms.map((mechanism) => mechanism.uuid));
  const equipmentRefs = new Set(equipment.map((item) => item.uuid));
  const failureModeRefs = new Set(equipment.flatMap((item) => item.failureModes.map((failureMode) => failureMode.uuid)));
  for (const fragility of sfr.results.fragilityEvaluations) {
    if (!mechanismRefs.has(fragility.controllingMechanismRef)) add("SFR-005", "ERROR", "SFR", `${fragility.name} has no resolvable controlling failure mechanism.`, [fragility.uuid, fragility.controllingMechanismRef]);
    if (!parameterRefs.has(fragility.groundMotionParameterRef)) add("SFR-006", "ERROR", "SFR", `${fragility.name} uses an undefined shared ground-motion parameter.`, [fragility.uuid, fragility.groundMotionParameterRef]);
    if (!controlPointRefs.has(fragility.controlPointRef)) add("SFR-007", "ERROR", "SFR", `${fragility.name} uses an undefined SHA control point.`, [fragility.uuid, fragility.controlPointRef]);
  }
  for (const trace of sfr.documentation.traceability) {
    const unresolved = [
      ...(equipmentRefs.has(trace.sscRef) ? [] : [trace.sscRef]),
      ...(failureModeRefs.has(trace.failureModeRef) ? [] : [trace.failureModeRef]),
      ...(fragilityRefs.has(trace.fragilityRef) ? [] : [trace.fragilityRef]),
      ...trace.mechanismRefs.filter((reference) => !mechanismRefs.has(reference)),
    ];
    if (unresolved.length > 0) add("SFR-008", "ERROR", "SFR", "An SFR SSC-to-fragility trace contains unresolved canonical references.", unresolved);
  }

  const initiators = [...spr.initiatingEventIdentification.directInitiators, ...spr.initiatingEventIdentification.secondaryHazardInitiators];
  if (initiators.length === 0) add("SPR-002", "ERROR", "SPR", "Identify the direct and secondary-hazard seismic initiating events.");
  if (spr.plantResponseModel.inducedFailures.length === 0) add("SPR-003", "ERROR", "SPR", "Map seismic equipment failure modes and fragilities into the plant-response model.");
  for (const failure of spr.plantResponseModel.inducedFailures) {
    if (!fragilityRefs.has(failure.fragilityEvaluationRef)) add("SPR-004", "ERROR", "SPR", `${failure.name} references a fragility that is not in the SFR result register.`, [failure.uuid, failure.fragilityEvaluationRef]);
  }
  if (spr.quantification.hazardDiscretizations.length === 0) add("SPR-005", "ERROR", "SPR", "Define and converge the hazard discretization.");
  if (spr.quantification.eventSequenceFamilyQuantifications.length === 0) add("SPR-006", "ERROR", "SPR", "Quantify the seismic event-sequence families.");
  for (const discretization of spr.quantification.hazardDiscretizations) {
    if (!discretization.converged) add("SPR-007", "ERROR", "SPR", `${discretization.name} has not demonstrated convergence.`, [discretization.uuid]);
  }
  const initiatingEventRefs = new Set(initiators.map((initiator) => initiator.uuid));
  const quantificationRefs = new Set(spr.quantification.eventSequenceFamilyQuantifications.map((result) => result.uuid));
  for (const trace of spr.documentation.traceability) {
    const unresolved = [
      ...(initiatingEventRefs.has(trace.initiatingEventRef) ? [] : [trace.initiatingEventRef]),
      ...(quantificationRefs.has(trace.quantificationRef) ? [] : [trace.quantificationRef]),
      ...trace.equipmentRefs.filter((reference) => !equipmentRefs.has(reference)),
      ...trace.fragilityRefs.filter((reference) => !fragilityRefs.has(reference)),
    ];
    if (unresolved.length > 0) add("SPR-008", "ERROR", "SPR", "An SPR initiator-to-quantification trace contains unresolved canonical references.", unresolved);
  }

  if (mef.integration.interfaces.length === 0) add("INT-001", "ERROR", "INTEGRATION", "Create the SHA-to-SFR, SHA-to-SPR, and SFR-to-SPR interface records.");
  if (mef.integration.consistencyChecks.length === 0) add("INT-002", "ERROR", "INTEGRATION", "Record the multidisciplinary consistency checks.");
  for (const item of mef.integration.interfaces) {
    if (!item.consistent || item.openItems.length > 0) add("INT-003", "ERROR", "INTEGRATION", `${item.name} is not closed and consistent.`, [item.uuid, ...item.openItems]);
  }
  for (const check of mef.integration.consistencyChecks) {
    if (check.result === "FAIL" || check.result === "OPEN") add("INT-004", "ERROR", "INTEGRATION", `${check.name} has result ${check.result}.`, [check.uuid, ...check.openItems]);
  }
  if (mef.integration.unresolvedInterfaces.length > 0) add("INT-005", "ERROR", "INTEGRATION", "Resolve every open cross-subelement interface before review.", mef.integration.unresolvedInterfaces);
  if (mef.integratedUncertainties.length === 0) add("INT-006", "WARNING", "INTEGRATION", "No integrated hazard-fragility-systems uncertainty has been recorded.");
  if (mef.integratedSensitivityStudies.length === 0) add("INT-007", "WARNING", "INTEGRATION", "No integrated sensitivity study has been recorded.");

  const expectedEquipmentCount = equipment.length;
  if (mef.integration.coverage.sprEquipmentCount !== expectedEquipmentCount) {
    add("INT-008", "ERROR", "INTEGRATION", `The integration coverage count (${mef.integration.coverage.sprEquipmentCount}) does not match the seismic equipment list (${expectedEquipmentCount}).`);
  }
  if (mef.integration.coverage.unlinkedEquipmentRefs.length > 0 || mef.integration.coverage.unmodeledFailureModeRefs.length > 0) {
    add("INT-009", "ERROR", "INTEGRATION", "Close unlinked equipment and unmodeled failure modes.", [...mef.integration.coverage.unlinkedEquipmentRefs, ...mef.integration.coverage.unmodeledFailureModeRefs]);
  }
  const unmodeledSecondaryHazards = mef.integration.coverage.retainedSecondaryHazardRefs.filter((reference) => !mef.integration.coverage.modeledSecondaryHazardRefs.includes(reference));
  if (unmodeledSecondaryHazards.length > 0) {
    add("INT-010", "ERROR", "INTEGRATION", "Trace every retained secondary seismic hazard into the plant-response model.", unmodeledSecondaryHazards);
  }

  const documentation = [
    ["SHA", sha.documentation.processDescription, sha.documentation.traceabilityLinks.length],
    ["SFR", sfr.documentation.processDescription, sfr.documentation.traceability.length],
    ["SPR", spr.documentation.processDescription, spr.documentation.traceability.length],
    ["Integrated", mef.documentation.overallProcessDescription, mef.documentation.traceabilityMatrix.length],
  ] as const;
  for (const [name, description, traceCount] of documentation) {
    if (description.trim().length === 0) add("DOC-001", "ERROR", "DOCUMENTATION", `${name} process documentation is incomplete.`);
    if (traceCount === 0) add("DOC-002", "WARNING", "DOCUMENTATION", `${name} traceability has no records.`);
  }
  for (const trace of mef.documentation.traceabilityMatrix) {
    if (!(trace.requirement in SEISMIC_PRA_SR_CATALOG)) add("DOC-005", "ERROR", "DOCUMENTATION", `${trace.requirement} is not a recognized Seismic PRA supporting requirement.`, [trace.requirement]);
    if (trace.dataRefs.length === 0 || trace.modelRefs.length === 0 || trace.resultRefs.length === 0 || trace.documentationRefs.length === 0) {
      add("DOC-006", "ERROR", "DOCUMENTATION", `${trace.requirement} does not have a complete data-model-result-document trace.`, [trace.requirement]);
    }
  }
  const applicableConformance = mef.conformanceMatrix.filter((row) => row.applicableToStage.includes(mef.plantStage));
  const notMet = applicableConformance.filter((row) => row.status === "NOT_MET");
  const pending = applicableConformance.filter((row) => row.status === "PENDING_REVIEW" || row.status === "PARTIAL");
  if (notMet.length > 0) add("DOC-003", "ERROR", "DOCUMENTATION", `${notMet.length} applicable supporting requirement${notMet.length === 1 ? " is" : "s are"} not met.`, notMet.map((row) => row.sr));
  if (pending.length > 0) add("DOC-004", "WARNING", "DOCUMENTATION", `${pending.length} applicable supporting requirement${pending.length === 1 ? " still requires" : "s still require"} conformance disposition.`, pending.map((row) => row.sr));

  return diagnostics;
}

function reviewBlockingSeismicPraDiagnostics(mef: SeismicPRA): SeismicPraDiagnostic[] {
  return validateSeismicPra(mef).filter((diagnostic) => diagnostic.severity === "ERROR");
}

export { reviewBlockingSeismicPraDiagnostics, synchronizeSeismicPraDerivedRegisters, validateSeismicPra };
