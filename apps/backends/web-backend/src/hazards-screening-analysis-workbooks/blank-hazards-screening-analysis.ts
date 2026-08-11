import { randomUUID } from "crypto";
import { HSA_SR_CATALOG, type HazardsScreeningAnalysis } from "interfaces-mef-types/hazards-screening/hazards-screening-analysis";
import { TechnicalElementTypes } from "interfaces-mef-types/technical-element";

export function createBlankHazardsScreeningAnalysis(name: string, owner: string): HazardsScreeningAnalysis {
  const now = new Date().toISOString();
  return {
    uuid: randomUUID(), name, type: TechnicalElementTypes.HAZARDS_SCREENING_ANALYSIS, version: "1", created: now, modified: now, owner,
    workflowState: "DRAFT", workflowHistory: [{ state: "DRAFT", enteredAt: now, actor: owner }], capabilityCategory: "CC-II", plantStage: "PRE_OPERATIONAL",
    metadata: { versionInfo: { version: "1", lastUpdated: now, schemaVersion: "1.0.0" }, analysisDate: now, analysts: [owner], reviewers: [], scope: "", limitations: [], lastModifiedDate: now, lastModifiedBy: owner },
    conformanceMatrix: Object.entries(HSA_SR_CATALOG).map(([sr, entry]) => ({ sr, hlr: entry.hlr, capabilityCategory: "CC-II", applicableToStage: entry.stages, status: entry.stages.includes("PRE_OPERATIONAL") ? "PENDING_REVIEW" : "NOT_APPLICABLE", satisfiedByElementPaths: [], evidence: "" })),
    internalReviewComments: { comments: [], openCount: 0, resolvedCount: 0 }, activePeerReviewIds: [], activeAuditIds: [], praScope: "", applications: [], evidenceRegister: [],
    siteCharacterization: { siteDescriptors: [], regionalStudies: [], designBasisRecords: [], changeMonitoringRecords: [] },
    hazardInventory: { hazards: [], routingDecisions: [] }, combinedHazards: { interactions: [] }, screeningCriteria: { criteria: [] }, qualitativeScreening: { decisions: [] },
    quantitativeCharacterization: { frequencyModels: [], dataAssessments: [] },
    plantResponse: { vulnerableSscs: [], scenarios: [], humanActionEffects: [], peerReviewDispositions: [] },
    quantitativeScreening: { consequenceEstimates: [], decisions: [] }, confirmations: { investigations: [] }, uncertainties: [], preOperationalAssumptions: [],
    integration: { interfaces: [], finalDispositions: [], technicalHandoffs: [], unresolvedInterfaces: [] }, traceability: { paths: [], controlledBaselines: [] },
    workflow: { reportSections: [], draftQualityChecks: [], reviewAssignments: [], reviewFindings: [], approvalReadiness: [], approvalSignatures: [] },
    documentation: { overallProcess: "", hazardIdentificationSummary: "", qualitativeScreeningSummary: "", quantitativeScreeningSummary: "", plantConfirmationSummary: "", uncertaintySummary: "", resultsAndHandoffsSummary: "", configurationControlSummary: "", supportingDocumentRefs: [] },
    newlyDevelopedMethodIds: [],
  };
}
