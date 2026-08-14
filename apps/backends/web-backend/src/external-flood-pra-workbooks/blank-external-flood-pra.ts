import { randomUUID } from "crypto";
import {
  EXTERNAL_FLOOD_PRA_SR_CATALOG,
  type ExternalFloodAnalysisRecord,
  type ExternalFloodPRA,
  type ExternalFloodProcessDocumentation,
} from "interfaces-mef-types/external-flood/external-flood-pra";
import { TechnicalElementTypes } from "interfaces-mef-types/technical-element";

function analysisRecord(code: string, name: string, owner: string): ExternalFloodAnalysisRecord {
  return { uuid: randomUUID(), code, name, description: "", basis: "", owner, status: "DRAFT", evidenceRefs: [], relatedRefs: [], assumptionRefs: [], implementsSrs: [] };
}

function documentation(code: string, name: string): ExternalFloodProcessDocumentation {
  return { uuid: code, name, processDescription: "", inputsDescription: "", methodsDescription: "", resultsDescription: "", limitations: [], supportingDocumentRefs: [], traceabilityLinks: [] };
}

function technicalSection(code: string, name: string) {
  return { modelUncertainties: [], preOperationalAssumptions: [], documentation: documentation(code, name) };
}

export function createBlankExternalFloodPra(name: string, owner: string): ExternalFloodPRA {
  const now = new Date().toISOString();
  return {
    uuid: randomUUID(), name, type: TechnicalElementTypes.EXTERNAL_FLOODING_PRA, version: "1", created: now, modified: now, owner,
    workflowState: "DRAFT", workflowHistory: [{ state: "DRAFT", enteredAt: now, actor: owner }], capabilityCategory: "CC-II", plantStage: "PRE_OPERATIONAL",
    metadata: {
      versionInfo: { version: "1", lastUpdated: now, schemaVersion: "1.0.0" }, analysisDate: now, analysts: [owner], reviewers: [],
      scope: "", limitations: [], lastModifiedDate: now, lastModifiedBy: owner,
    },
    conformanceMatrix: Object.entries(EXTERNAL_FLOOD_PRA_SR_CATALOG).map(([sr, entry]) => ({
      sr, hlr: entry.hlr, capabilityCategory: "CC-II", applicableToStage: entry.stages,
      status: entry.stages.includes("PRE_OPERATIONAL") ? "PENDING_REVIEW" : "NOT_APPLICABLE", satisfiedByElementPaths: [], evidence: "",
    })),
    internalReviewComments: { comments: [], openCount: 0, resolvedCount: 0 }, activePeerReviewIds: [], activeAuditIds: [], praScope: "",
    analysisBasis: {
      siteBasis: {
        ...analysisRecord("XF-SITE-001", "External Flood PRA site basis", owner), siteBasisType: "SPECIFIC_SITE", siteName: "",
        siteSelectionStatus: "CANDIDATE", boundingSiteRefs: [], boundingCharacteristics: [], watershedAndCoastalSetting: "",
        topographyAndDrainageDescription: "", datumAndSurveyBasis: "", licenseeControlledAreaDescription: "",
        reactorUnitRefs: [], radioactiveMaterialSourceRefs: [], plantOperatingStateRefs: [], multiReactorOrMultiSourceLocations: [], analysisDateCutoff: "",
      },
      scopeRecords: [], applications: [], evidenceRegister: [],
      baselinePra: { modelName: "", modelReference: "", revision: "", freezeDate: "", freezeStatus: "WORKING", modelBoundary: "", plantOperatingStateRefs: [], reactorUnitRefs: [], radioactiveMaterialSourceRefs: [], recordTreatments: [], unresolvedInterfaces: [] },
      interfaces: [], ...technicalSection("DOC-XF-BASIS", "External Flood PRA Analysis Basis documentation"),
    },
    hazardScreening: { hazardCandidates: [], hazardCombinations: [], screeningDecisions: [], aggregateScreeningChecks: [], confirmations: [], investigations: [], ...technicalSection("DOC-XF-HS", "External Flood Hazard Screening documentation") },
    siteFloodModel: { dataSources: [], siteParameters: [], datumConversions: [], hydrologicAssumptions: [], numericalModels: [], qualificationChecks: [], ...technicalSection("DOC-XF-SITE", "Site Flood Model documentation") },
    localIntensePrecipitationAnalysis: { precipitationInputs: [], drainageCatchments: [], hydraulicModels: [], surfaceFlowPaths: [], hazardResults: [], ...technicalSection("DOC-XF-LIP", "Local Intense Precipitation documentation") },
    riverineFloodAnalysis: { watershedModels: [], frequencyAnalyses: [], stageDischargeModels: [], leveeAssessments: [], hazardResults: [], ...technicalSection("DOC-XF-RIVER", "Riverine Flood Analysis documentation") },
    damAndImpoundmentAnalysis: { impoundmentInventory: [], failureModes: [], breachModels: [], routingModels: [], hazardResults: [], ...technicalSection("DOC-XF-DAM", "Dam and Impoundment Analysis documentation") },
    surgeSeicheTsunamiAnalysis: { coastalSources: [], stormSurgeModels: [], seicheModels: [], tsunamiModels: [], hazardResults: [], ...technicalSection("DOC-XF-COAST", "Surge, Seiche, and Tsunami Analysis documentation") },
    hazardIntegration: { logicTreeBranches: [], hazardCurves: [], spatialCharacterizations: [], hazardIntervals: [], uncertaintyStudies: [], convergenceStudies: [], ...technicalSection("DOC-XF-HAZ", "External Flood Hazard Integration documentation") },
    preliminaryPlantResponse: { preliminaryInitiatingEvents: [], modelReviews: [], externalFloodEquipmentList: [], ...technicalSection("DOC-XF-XFEL", "Preliminary Plant Response and XFEL documentation") },
    plantInvestigation: { investigations: [], findings: [], floodPathways: [], protectionFeatures: [], drainageFeatures: [], ...technicalSection("DOC-XF-INV", "Plant Investigation and Flood Pathway documentation") },
    sscScreeningAndFragilityBasis: { screeningDecisions: [], methodSelections: [], failureModes: [], correlationGroups: [], coexistentHazardAssessments: [], ...technicalSection("DOC-XF-FRB", "SSC Screening and Fragility Basis documentation") },
    floodFragilityAnalysis: { barrierFragilities: [], equipmentFragilities: [], structuralLoadModels: [], sealAssessments: [], fragilityCurves: [], ...technicalSection("DOC-XF-FRA", "Flood Protection and SSC Fragility documentation") },
    scenarioDevelopment: { scenarioGroups: [], propagationModels: [], scenarioTimelines: [], hazardCombinations: [], screeningDecisions: [], ...technicalSection("DOC-XF-SCN", "Flood Scenario Development documentation") },
    plantResponseModel: { peerReviewDispositions: [], initiatingEventModels: [], eventSequenceModels: [], successCriteria: [], systemModelModifications: [], missionTimes: [], dataParameters: [], multiUnitAssessments: [], ...technicalSection("DOC-XF-PRM", "External Flood Plant Response Model documentation") },
    humanReliabilityAnalysis: { humanActions: [], humanFailureEvents: [], performanceContexts: [], hepEstimates: [], confirmations: [], recoveryAssessments: [], dependencyAssessments: [], ...technicalSection("DOC-XF-HRA", "External Flood Human Reliability Analysis documentation") },
    eventSequenceQuantification: { quantificationRuns: [], hazardIntervalResults: [], eventSequenceFamilyResults: [], convergenceStudies: [], uncertaintyResults: [], riskContributors: [], screeningDecisions: [], ...technicalSection("DOC-XF-ESQ", "External Flood Event Sequence Quantification documentation") },
    integratedUncertainties: [],
    riskInterpretation: { riskInsights: [], refinementActions: [], quantificationIterations: [], sensitivityStudies: [] },
    riskIntegration: { integrationResults: [], riskDecisions: [], traceabilityPaths: [], controlledBaselines: [] },
    technicalClosure: { conformanceReviews: [], documentationChecks: [], interfaceClosureChecks: [], peerReviewTeam: [], peerReviewFindings: [], readinessChecks: [], ...technicalSection("DOC-XF-CLOSE", "External Flood Technical Closure documentation") },
    workflow: { reportSections: [], draftQualityChecks: [], reviewAssignments: [], reviewFindings: [], approvalReadiness: [], approvalSignatures: [] },
    documentation: {
      overallProcessDescription: "", analysisBasisSummary: "", evidenceAndSiteBasisSummary: "", hazardScreeningSummary: "", siteFloodModelSummary: "",
      localIntensePrecipitationSummary: "", riverineFloodSummary: "", damAndImpoundmentSummary: "", surgeSeicheTsunamiSummary: "",
      hazardIntegrationSummary: "", equipmentListSummary: "", investigationSummary: "", fragilitySummary: "", scenarioSummary: "",
      plantResponseSummary: "", humanReliabilitySummary: "", quantificationSummary: "", riskInsights: "", uncertaintySummary: "",
      configurationControlDescription: "", peerReviewScope: "", supportingDocumentRefs: [],
    },
    exampleDocuments: [], newlyDevelopedMethodIds: [],
  };
}
