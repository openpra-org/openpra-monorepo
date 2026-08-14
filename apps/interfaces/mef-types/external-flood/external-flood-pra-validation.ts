import {
  EXTERNAL_FLOOD_PRA_SR_CATALOG,
  type ExternalFloodAnalysisRecord,
  type ExternalFloodPRA,
  type ExternalFloodPraSubelement,
} from "./external-flood-pra";

export type ExternalFloodPraDiagnosticSeverity = "ERROR" | "WARNING" | "INFORMATION";

export interface ExternalFloodPraDiagnostic {
  code: string;
  severity: ExternalFloodPraDiagnosticSeverity;
  area: ExternalFloodPraSubelement | "INTEGRATION" | "DOCUMENTATION" | "WORKFLOW";
  message: string;
  recordRefs: string[];
}

interface LocatedRecord { path: string; record: ExternalFloodAnalysisRecord }

function isAnalysisRecord(value: unknown): value is ExternalFloodAnalysisRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return typeof item["uuid"] === "string" && typeof item["code"] === "string"
    && typeof item["name"] === "string" && Array.isArray(item["implementsSrs"]);
}

function locatedRecords(mef: ExternalFloodPRA): LocatedRecord[] {
  const found: LocatedRecord[] = [];
  const visit = (value: unknown, path: string): void => {
    if (isAnalysisRecord(value)) found.push({ path, record: value });
    if (Array.isArray(value)) value.forEach((item, index) => visit(item, `${path}[${String(index)}]`));
    else if (value !== null && typeof value === "object") {
      for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
        if (key !== "conformanceMatrix" && key !== "internalReviewComments") visit(child, path.length === 0 ? key : `${path}.${key}`);
      }
    }
  };
  visit(mef, "");
  return found;
}

function clone(mef: ExternalFloodPRA): ExternalFloodPRA {
  return typeof structuredClone === "function" ? structuredClone(mef) : JSON.parse(JSON.stringify(mef)) as ExternalFloodPRA;
}

export function synchronizeExternalFloodPraDerivedRegisters(mef: ExternalFloodPRA): ExternalFloodPRA {
  const next = clone(mef);
  const records = locatedRecords(next);
  const prior = new Map(next.conformanceMatrix.map((entry) => [entry.sr, entry]));
  next.conformanceMatrix = Object.entries(EXTERNAL_FLOOD_PRA_SR_CATALOG).map(([sr, catalog]) => {
    const supporting = records.filter(({ record }) => record.implementsSrs.some((reference) => reference.sr === sr));
    const applicable = catalog.stages.includes(next.plantStage);
    const status = !applicable ? "NOT_APPLICABLE" as const
      : supporting.length === 0 ? "PENDING_REVIEW" as const
      : supporting.every(({ record }) => record.status === "APPROVED" || record.status === "CLOSED" || record.status === "REVIEWED" || record.status === "READY" || record.status === "RETAINED")
        ? "MET" as const : "PARTIAL" as const;
    return {
      sr,
      hlr: catalog.hlr,
      capabilityCategory: next.capabilityCategory ?? "CC-II",
      applicableToStage: catalog.stages,
      status,
      satisfiedByElementPaths: supporting.map(({ path }) => path),
      evidence: supporting.map(({ record }) => `${record.code}: ${record.name}`).join("; "),
      reviewNotes: prior.get(sr)?.reviewNotes,
    };
  });
  next.internalReviewComments = {
    ...next.internalReviewComments,
    openCount: next.internalReviewComments.comments.filter((comment) => !comment.resolved).length,
    resolvedCount: next.internalReviewComments.comments.filter((comment) => comment.resolved).length,
  };
  next.modified = new Date().toISOString();
  next.metadata.lastModifiedDate = next.modified;
  return next;
}

function arrayAt(root: unknown, path: string): unknown[] {
  let current = root;
  for (const segment of path.split(".")) current = (current as Record<string, unknown> | undefined)?.[segment];
  return Array.isArray(current) ? current : [];
}

function validMonotonicCurve(values: unknown, frequencies: unknown): boolean {
  if (!Array.isArray(values) || !Array.isArray(frequencies) || values.length < 2 || values.length !== frequencies.length) return false;
  return values.every((value, index) => typeof value === "number" && (index === 0 || value > (values[index - 1] as number)))
    && frequencies.every((value, index) => typeof value === "number" && value >= 0 && (index === 0 || value <= (frequencies[index - 1] as number)));
}

function validProbability(value: unknown): boolean { return typeof value === "number" && value >= 0 && value <= 1; }

export function validateExternalFloodPra(mef: ExternalFloodPRA): ExternalFloodPraDiagnostic[] {
  const diagnostics: ExternalFloodPraDiagnostic[] = [];
  const add = (code: string, severity: ExternalFloodPraDiagnosticSeverity, area: ExternalFloodPraDiagnostic["area"], message: string, recordRefs: string[] = []): void => {
    diagnostics.push({ code, severity, area, message, recordRefs });
  };

  const requiredCollections: Array<[string, ExternalFloodPraDiagnostic["area"], string]> = [
    ["analysisBasis.scopeRecords", "INTEGRATION", "Define at least one controlled External Flood PRA scope record."],
    ["analysisBasis.applications", "INTEGRATION", "Define at least one PRA application and decision context."],
    ["analysisBasis.evidenceRegister", "XFHA", "Control the evidence used by the external-flood analysis."],
    ["analysisBasis.interfaces", "INTEGRATION", "Define technical-element inputs and outputs for External Flood PRA."],
    ["hazardScreening.hazardCandidates", "XFHA", "Identify the complete set of site-relevant external-flood hazards."],
    ["hazardScreening.screeningDecisions", "XFHA", "Record hazard-screening decisions and bases."],
    ["siteFloodModel.dataSources", "XFHA", "Qualify the common site-flood data sources."],
    ["siteFloodModel.siteParameters", "XFHA", "Define common topographic, hydrologic, drainage, and boundary parameters."],
    ["siteFloodModel.datumConversions", "XFHA", "Control vertical and horizontal datum conversions."],
    ["siteFloodModel.numericalModels", "XFHA", "Qualify the numerical models used for site flooding."],
    ["localIntensePrecipitationAnalysis.precipitationInputs", "XFHA", "Define local-intense-precipitation inputs."],
    ["localIntensePrecipitationAnalysis.drainageCatchments", "XFHA", "Define site drainage catchments and capacities."],
    ["localIntensePrecipitationAnalysis.hazardResults", "XFHA", "Produce location-specific local-precipitation hazard results."],
    ["riverineFloodAnalysis.watershedModels", "XFHA", "Define riverine watershed and routing models."],
    ["riverineFloodAnalysis.frequencyAnalyses", "XFHA", "Develop riverine discharge-frequency results."],
    ["riverineFloodAnalysis.hazardResults", "XFHA", "Produce location-specific riverine hazard results."],
    ["damAndImpoundmentAnalysis.impoundmentInventory", "XFHA", "Complete the relevant dam and impoundment inventory."],
    ["damAndImpoundmentAnalysis.failureModes", "XFHA", "Evaluate credible dam and impoundment failure modes."],
    ["damAndImpoundmentAnalysis.hazardResults", "XFHA", "Produce routed impoundment-failure hazard results."],
    ["surgeSeicheTsunamiAnalysis.coastalSources", "XFHA", "Identify applicable surge, seiche, and tsunami sources."],
    ["surgeSeicheTsunamiAnalysis.hazardResults", "XFHA", "Produce applicable coastal and enclosed-water hazard results."],
    ["hazardIntegration.hazardCurves", "XFHA", "Develop controlled hazard curves for retained flood mechanisms."],
    ["hazardIntegration.spatialCharacterizations", "XFHA", "Map retained hazards to plant locations and response parameters."],
    ["hazardIntegration.hazardIntervals", "XFHA", "Discretize retained flood hazards for plant-response quantification."],
    ["preliminaryPlantResponse.externalFloodEquipmentList", "XFPR", "Develop a nonempty External Flood Equipment List."],
    ["plantInvestigation.investigations", "XFFR", "Perform plant investigations supporting pathway and fragility analysis."],
    ["plantInvestigation.floodPathways", "XFFR", "Confirm flood ingress and propagation pathways."],
    ["plantInvestigation.protectionFeatures", "XFFR", "Inventory credited and challenged flood-protection features."],
    ["sscScreeningAndFragilityBasis.methodSelections", "XFFR", "Select fragility or screening methods for retained SSC failure modes."],
    ["sscScreeningAndFragilityBasis.failureModes", "XFFR", "Define retained external-flood failure modes."],
    ["floodFragilityAnalysis.barrierFragilities", "XFFR", "Develop fragilities for credited flood-protection features."],
    ["floodFragilityAnalysis.equipmentFragilities", "XFFR", "Develop equipment and structure flood fragilities."],
    ["floodFragilityAnalysis.fragilityCurves", "XFFR", "Provide conditional failure probability across the analyzed flood range."],
    ["scenarioDevelopment.scenarioGroups", "XFPR", "Develop representative external-flood scenario groups."],
    ["scenarioDevelopment.propagationModels", "XFPR", "Model flood propagation, accumulation, drainage, and protection states."],
    ["scenarioDevelopment.scenarioTimelines", "XFPR", "Define warning, arrival, ingress, failure, action, and mission timelines."],
    ["plantResponseModel.initiatingEventModels", "XFPR", "Develop external-flood initiating-event models."],
    ["plantResponseModel.eventSequenceModels", "XFPR", "Develop complete external-flood event-sequence models."],
    ["plantResponseModel.systemModelModifications", "XFPR", "Implement flood failures and dependencies in system logic."],
    ["humanReliabilityAnalysis.humanActions", "XFPR", "Identify external-flood preparation, response, and recovery actions."],
    ["humanReliabilityAnalysis.humanFailureEvents", "XFPR", "Define external-flood human failure events."],
    ["humanReliabilityAnalysis.hepEstimates", "XFPR", "Quantify flood-specific HEPs and uncertainty."],
    ["eventSequenceQuantification.quantificationRuns", "XFPR", "Execute a controlled External Flood PRA quantification."],
    ["eventSequenceQuantification.eventSequenceFamilyResults", "XFPR", "Quantify event-sequence-family frequencies."],
    ["riskInterpretation.riskInsights", "INTEGRATION", "Document external-flood risk insights and dominant contributors."],
    ["riskIntegration.integrationResults", "INTEGRATION", "Integrate external-flood results into total-risk measures."],
    ["riskIntegration.traceabilityPaths", "INTEGRATION", "Trace important results from evidence through risk decisions."],
    ["technicalClosure.conformanceReviews", "DOCUMENTATION", "Complete the External Flood PRA conformance review."],
    ["technicalClosure.readinessChecks", "WORKFLOW", "Complete peer-review and approval-readiness checks."],
  ];
  for (const [path, area, message] of requiredCollections) if (arrayAt(mef, path).length === 0) add(`XF-EMPTY-${path.replace(/[^a-z0-9]/gi, "-").toUpperCase()}`, "ERROR", area, message);

  if (mef.analysisBasis.siteBasis === undefined || mef.analysisBasis.siteBasis.siteName.trim().length === 0) add("XFHA-A-001", "ERROR", "XFHA", "Define the specific site or justified bounding-site basis.");
  if (mef.analysisBasis.baselinePra === undefined || mef.analysisBasis.baselinePra.modelReference.trim().length === 0) add("XFPR-B-001", "ERROR", "XFPR", "Define and freeze the applicable baseline PRA model.");

  const records = locatedRecords(mef);
  const uuids = new Set<string>();
  for (const { record } of records) {
    if (uuids.has(record.uuid)) add("XF-SCHEMA-001", "ERROR", "DOCUMENTATION", `${record.name} duplicates record UUID ${record.uuid}.`, [record.uuid]);
    uuids.add(record.uuid);
    const unsupported = record.implementsSrs.filter((reference) => !(reference.sr in EXTERNAL_FLOOD_PRA_SR_CATALOG));
    if (unsupported.length > 0) add("XF-SCHEMA-002", "ERROR", "DOCUMENTATION", `${record.name} references unknown SRs: ${unsupported.map((item) => item.sr).join(", ")}.`, [record.uuid]);
  }

  const retained = new Set(mef.hazardScreening.hazardCandidates.filter((item) => item["disposition"] === "RETAINED").map((item) => String(item["hazardType"])));
  for (const hazard of retained) {
    if (!mef.hazardIntegration.hazardCurves.some((curve) => curve["hazardType"] === hazard)) add("XFHA-G-001", "ERROR", "XFHA", `Develop an integrated hazard curve for retained hazard ${hazard}.`);
  }
  for (const curve of mef.hazardIntegration.hazardCurves) {
    if (!validMonotonicCurve(curve["values"], curve["annualExceedanceFrequencies"])) add("XFHA-G-002", "ERROR", "XFHA", `${curve.name} does not contain a valid monotonic hazard curve.`, [curve.uuid]);
  }
  for (const interval of mef.hazardIntegration.hazardIntervals) {
    if (!(typeof interval["lowerValue"] === "number" && typeof interval["upperValue"] === "number" && interval["upperValue"] > interval["lowerValue"])
      || !validProbability(interval["conditionalWeight"]) || !(typeof interval["intervalAnnualFrequency"] === "number" && interval["intervalAnnualFrequency"] >= 0)) {
      add("XFHA-B-001", "ERROR", "XFHA", `${interval.name} has invalid bounds, conditional weight, or frequency.`, [interval.uuid]);
    }
  }

  for (const result of [
    ...mef.localIntensePrecipitationAnalysis.hazardResults,
    ...mef.riverineFloodAnalysis.hazardResults,
    ...mef.damAndImpoundmentAnalysis.hazardResults,
    ...mef.surgeSeicheTsunamiAnalysis.hazardResults,
  ]) {
    if (!validProbability(result["annualExceedanceProbability"])) add("XFHA-RESULT-001", "ERROR", "XFHA", `${result.name} has an invalid annual exceedance probability.`, [result.uuid]);
  }
  for (const fragility of mef.floodFragilityAnalysis.fragilityCurves) {
    const demands = fragility["demandValues"];
    const probabilities = fragility["conditionalFailureProbabilities"];
    const valid = Array.isArray(demands) && Array.isArray(probabilities) && demands.length >= 2 && demands.length === probabilities.length
      && demands.every((value, index) => typeof value === "number" && (index === 0 || value > (demands[index - 1] as number)))
      && probabilities.every((value, index) => validProbability(value) && (index === 0 || value >= (probabilities[index - 1] as number)));
    if (!valid) add("XFFR-F-001", "ERROR", "XFFR", `${fragility.name} does not contain a valid monotonic fragility curve.`, [fragility.uuid]);
  }
  for (const estimate of mef.humanReliabilityAnalysis.hepEstimates) {
    if (!validProbability(estimate["nominalHep"]) || !validProbability(estimate["externalFloodHep"])) add("XFPR-D-001", "ERROR", "XFPR", `${estimate.name} has an invalid nominal or external-flood HEP.`, [estimate.uuid]);
  }
  for (const result of mef.eventSequenceQuantification.eventSequenceFamilyResults) {
    if (!(typeof result["meanFrequencyPerPlantYear"] === "number" && result["meanFrequencyPerPlantYear"] >= 0)) add("XFPR-E-001", "ERROR", "XFPR", `${result.name} has an invalid mean frequency.`, [result.uuid]);
  }
  if (mef.eventSequenceQuantification.quantificationRuns.length > 0 && !mef.eventSequenceQuantification.convergenceStudies.some((study) => study["converged"] === true)) add("XFPR-E-002", "ERROR", "XFPR", "Demonstrate quantification convergence for flood discretization and numerical treatment.");

  const openInterfaces = mef.analysisBasis.interfaces.filter((item) => !item.consistent || item.openItems.length > 0);
  if (openInterfaces.length > 0) add("XF-CLOSE-001", "ERROR", "INTEGRATION", "Resolve inconsistent or open technical-element interfaces before approval.", openInterfaces.map((item) => item.uuid));
  const incompleteTrace = mef.riskIntegration.traceabilityPaths.filter((item) => item["complete"] !== true);
  if (incompleteTrace.length > 0) add("XF-CLOSE-002", "ERROR", "INTEGRATION", "Complete all evidence-to-decision traceability paths.", incompleteTrace.map((item) => item.uuid));

  const requiredDocumentation = [
    mef.analysisBasis, mef.hazardScreening, mef.siteFloodModel, mef.localIntensePrecipitationAnalysis,
    mef.riverineFloodAnalysis, mef.damAndImpoundmentAnalysis, mef.surgeSeicheTsunamiAnalysis,
    mef.hazardIntegration, mef.preliminaryPlantResponse, mef.plantInvestigation,
    mef.sscScreeningAndFragilityBasis, mef.floodFragilityAnalysis, mef.scenarioDevelopment,
    mef.plantResponseModel, mef.humanReliabilityAnalysis, mef.eventSequenceQuantification, mef.technicalClosure,
  ];
  for (const section of requiredDocumentation) {
    const document = section.documentation;
    if ([document.processDescription, document.inputsDescription, document.methodsDescription, document.resultsDescription].some((value) => value.trim().length === 0)) {
      add("XF-DOC-001", "WARNING", "DOCUMENTATION", `${document.name} is incomplete.`, [document.uuid]);
    }
  }

  const openFindings = mef.technicalClosure.peerReviewFindings.filter((item) => item["closureStatus"] !== "CLOSED");
  if (openFindings.length > 0) add("XF-CLOSE-003", "WARNING", "WORKFLOW", "Resolve open External Flood PRA peer-review findings before approval.", openFindings.map((item) => item.uuid));
  if (mef.workflow.approvalSignatures.length > 0 && diagnostics.some((item) => item.severity === "ERROR")) add("XF-WORKFLOW-001", "ERROR", "WORKFLOW", "Approval signatures are present while blocking External Flood PRA issues remain open.");

  return diagnostics;
}

export function reviewBlockingExternalFloodPraDiagnostics(mef: ExternalFloodPRA): ExternalFloodPraDiagnostic[] {
  return validateExternalFloodPra(mef).filter((diagnostic) => diagnostic.severity === "ERROR");
}
