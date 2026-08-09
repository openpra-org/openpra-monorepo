import { randomUUID } from "crypto";
import { INTERNAL_FLOOD_PRA_SR_CATALOG, type InternalFloodAnalysisRecord, type InternalFloodPRA, type InternalFloodProcessDocumentation } from "interfaces-mef-types/internal-flood/internal-flood-pra";
import { TechnicalElementTypes } from "interfaces-mef-types/technical-element";

function analysisRecord(code: string, name: string, owner: string): InternalFloodAnalysisRecord {
  return {
    uuid: randomUUID(), code, name, description: "", basis: "", owner, status: "DRAFT",
    evidenceRefs: [], relatedRefs: [], assumptionRefs: [], implementsSrs: [],
  };
}

function documentation(code: string, name: string): InternalFloodProcessDocumentation {
  return {
    uuid: code, name, processDescription: "", inputsDescription: "", methodsDescription: "", resultsDescription: "",
    limitations: [], supportingDocumentRefs: [], traceabilityLinks: [],
  };
}

export function createBlankInternalFloodPra(name: string, owner: string): InternalFloodPRA {
  const now = new Date().toISOString();
  const boundary = analysisRecord("FLPP-BOUNDARY-001", "Internal Flood PRA analysis boundary", owner);
  return {
    uuid: randomUUID(), name, type: TechnicalElementTypes.INTERNAL_FLOOD_PRA, version: "1", created: now, modified: now, owner,
    workflowState: "DRAFT", workflowHistory: [{ state: "DRAFT", enteredAt: now, actor: owner }], capabilityCategory: "CC-II", plantStage: "PRE_OPERATIONAL",
    metadata: {
      versionInfo: { version: "1", lastUpdated: now, schemaVersion: "1.0.0" }, analysisDate: now, analysts: [owner], reviewers: [],
      scope: "", limitations: [], lastModifiedDate: now, lastModifiedBy: owner,
    },
    conformanceMatrix: Object.entries(INTERNAL_FLOOD_PRA_SR_CATALOG).map(([sr, entry]) => ({
      sr, hlr: entry.hlr, capabilityCategory: "CC-II", applicableToStage: entry.stages,
      status: entry.stages.includes("PRE_OPERATIONAL") ? "PENDING_REVIEW" : "NOT_APPLICABLE", satisfiedByElementPaths: [], evidence: "",
    })),
    internalReviewComments: { comments: [], openCount: 0, resolvedCount: 0 }, activePeerReviewIds: [], activeAuditIds: [],
    praScope: "", applications: [], evidenceRegister: [],
    plantPartitioning: {
      analysisBoundary: {
        ...boundary, plantStructureRefs: [], reactorUnitRefs: [], radioactiveMaterialSourceRefs: [], includedBuildings: [],
        includedElevationRange: { lowerMetres: 0, upperMetres: 0, datum: "Plant datum" }, internalExternalHazardInterface: "",
        multiUnitAndSharedSourceBasis: "", exclusions: [],
      },
      floodAreas: [], coverageChecks: [], investigations: [], modelUncertainties: [], preOperationalAssumptions: [],
      documentation: documentation("DOC-FLPP", "Internal Flood Plant Partitioning documentation"),
    },
    sourcesIdentificationAndCharacterization: {
      sources: [], failureMechanisms: [], releaseCharacterizations: [], sourceScreeningDecisions: [], investigations: [], modelUncertainties: [], preOperationalAssumptions: [],
      documentation: documentation("DOC-FLSO", "Internal Flood Sources Identification and Characterization documentation"),
    },
    scenariosDevelopment: {
      propagationPaths: [], mitigationFeatures: [], sscSusceptibilities: [], hydraulicCalculations: [], floodScenarios: [], screeningDecisions: [], investigations: [], modelUncertainties: [], preOperationalAssumptions: [],
      documentation: documentation("DOC-FLSN", "Internal Flood Scenarios Development documentation"),
    },
    initiatingEvents: {
      scenarioGroups: [], initiatingEvents: [], frequencyDataSets: [], mitigationFailureProbabilities: [], frequencyEstimates: [], screeningDecisions: [], modelUncertainties: [], preOperationalAssumptions: [],
      documentation: documentation("DOC-FLEV", "Internal Flood Initiating Events documentation"),
    },
    plantResponseModel: {
      plantResponseResults: [], eventSequenceModels: [], successCriteria: [], systemModelModifications: [], missionTimeAssessments: [], peerReviewFindingDispositions: [], modelUncertainties: [], preOperationalAssumptions: [],
      documentation: documentation("DOC-FLPR", "Internal Flood Plant Response Model documentation"),
    },
    humanReliabilityAnalysis: {
      humanActions: [], humanFailureEvents: [], performanceContexts: [], timingAssessments: [], hepEstimates: [], dependencyGroups: [], investigations: [], modelUncertainties: [], preOperationalAssumptions: [],
      documentation: documentation("DOC-FLHR", "Internal Flood Human Reliability Analysis documentation"),
    },
    eventSequenceQuantification: {
      quantificationRuns: [], eventSequenceFamilyResults: [], dependencies: [], riskContributors: [], uncertaintyResults: [], sensitivityStudies: [], traceability: [], modelUncertainties: [], preOperationalAssumptions: [],
      documentation: documentation("DOC-FLESQ", "Internal Flood Event Sequence Quantification documentation"),
    },
    integration: {
      interfaces: [], consistencyChecks: [], selectedFloodAreaRefs: [], selectedFloodSourceRefs: [], retainedFloodScenarioRefs: [], initiatingEventRefs: [], plantResponseModelRefs: [],
      humanFailureEventRefs: [], quantificationResultRefs: [], unresolvedInterfaces: [], integrationMethod: "",
    },
    integratedUncertainties: [],
    riskInterpretation: {
      riskInsights: [], refinementActions: [], quantificationIterations: [],
      stoppingCriteria: { maximumAggregateFrequencyChange: 0.05, maximumFamilyFrequencyChange: 0.1, maximumContributorRankShift: 1, requiredStableIterations: 2, requireNoNewRiskSignificantContributors: true, basis: "" },
    },
    riskIntegrationBaseline: { results: [], decisions: [], traceabilityPaths: [], controlledBaselines: [] },
    workflow: { reportSections: [], draftQualityChecks: [], reviewAssignments: [], reviewFindings: [], approvalReadiness: [], approvalSignatures: [] },
    documentation: {
      overallProcessDescription: "", partitioningSummary: "", sourceSummary: "", scenarioSummary: "", frequencySummary: "", plantResponseSummary: "",
      humanReliabilitySummary: "", quantificationSummary: "", riskInsights: "", uncertaintySummary: "", configurationControlDescription: "", peerReviewScope: "", supportingDocumentRefs: [],
    },
    exampleDocuments: [], newlyDevelopedMethodIds: [],
  };
}
