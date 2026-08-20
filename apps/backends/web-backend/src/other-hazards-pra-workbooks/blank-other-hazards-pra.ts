import { randomUUID } from "crypto";
import {
  OTHER_HAZARDS_PRA_SR_CATALOG,
  type OtherHazardsAnalysisRecord,
  type OtherHazardsPRA,
  type OtherHazardsProcessDocumentation,
} from "interfaces-mef-types/other-hazards/other-hazards-pra";
import { TechnicalElementTypes } from "interfaces-mef-types/technical-element";

function analysisRecord(code: string, name: string, owner: string): OtherHazardsAnalysisRecord {
  return {
    uuid: randomUUID(), code, name, description: "", basis: "", owner, status: "DRAFT",
    evidenceRefs: [], relatedRefs: [], assumptionRefs: [], implementsSrs: [],
  };
}

function documentation(code: string, name: string): OtherHazardsProcessDocumentation {
  return {
    uuid: code, name, processDescription: "", inputsDescription: "", methodsDescription: "",
    resultsDescription: "", limitations: [], supportingDocumentRefs: [], traceabilityLinks: [],
  };
}

function technicalSection(code: string, name: string) {
  return { modelUncertainties: [], preOperationalAssumptions: [], documentation: documentation(code, name) };
}

export function createBlankOtherHazardsPra(name: string, owner: string): OtherHazardsPRA {
  const now = new Date().toISOString();
  return {
    uuid: randomUUID(),
    name,
    type: TechnicalElementTypes.OTHER_HAZARDS_PRA,
    version: "1",
    created: now,
    modified: now,
    owner,
    workflowState: "DRAFT",
    workflowHistory: [{ state: "DRAFT", enteredAt: now, actor: owner }],
    capabilityCategory: "CC-II",
    plantStage: "PRE_OPERATIONAL",
    metadata: {
      versionInfo: { version: "1", lastUpdated: now, schemaVersion: "1.0.0" },
      analysisDate: now, analysts: [owner], reviewers: [], scope: "", limitations: [],
      lastModifiedDate: now, lastModifiedBy: owner,
    },
    conformanceMatrix: Object.entries(OTHER_HAZARDS_PRA_SR_CATALOG).map(([sr, entry]) => ({
      sr, hlr: entry.hlr, capabilityCategory: "CC-II", applicableToStage: entry.stages,
      status: entry.stages.includes("PRE_OPERATIONAL") ? "PENDING_REVIEW" : "NOT_APPLICABLE",
      satisfiedByElementPaths: [], evidence: "",
    })),
    internalReviewComments: { comments: [], openCount: 0, resolvedCount: 0 },
    activePeerReviewIds: [], activeAuditIds: [], praScope: "",
    analysisBasis: {
      siteBasis: {
        ...analysisRecord("O-SITE-001", "Other Hazards PRA site basis", owner),
        siteBasisType: "SPECIFIC_SITE", siteName: "", siteSelectionStatus: "CANDIDATE",
        boundingSiteRefs: [], boundingCharacteristics: [], regionalSettingDescription: "",
        terrainAndTopographyDescription: "", nearbyFacilityAndTransportDescription: "",
        licenseeControlledAreaDescription: "", reactorUnitRefs: [], radioactiveMaterialSourceRefs: [],
        plantOperatingStateRefs: [], multiReactorOrMultiSourceLocations: [], analysisDateCutoff: "",
      },
      scopeRecords: [], applications: [], evidenceRegister: [], siteAndRegionalData: [],
      designBasisRecords: [], operatingExperience: [],
      baselinePra: {
        modelName: "", modelReference: "", revision: "", freezeDate: "", freezeStatus: "WORKING",
        modelBoundary: "", plantOperatingStateRefs: [], reactorUnitRefs: [], radioactiveMaterialSourceRefs: [],
        recordTreatments: [], unresolvedInterfaces: [],
      },
      interfaces: [], ...technicalSection("DOC-O-BASIS", "Other Hazards Analysis Basis documentation"),
    },
    retainedHazardGroups: {
      hazardGroups: [], completenessReviews: [], overlapControls: [],
      ...technicalSection("DOC-O-RETAIN", "Retained Hazard Groups documentation"),
    },
    hazardSourceCharacterization: {
      hazardSources: [], intensityMeasures: [], effectModels: [], spatialZones: [], timelineModels: [],
      ...technicalSection("DOC-O-SOURCE", "Hazard Source and Effect Characterization documentation"),
    },
    hazardFrequencyAnalysis: {
      occurrenceDataSets: [], occurrenceModels: [], regionalApplicabilityAssessments: [],
      expertJudgmentPanels: [], frequencyResults: [],
      ...technicalSection("DOC-O-FREQ", "Hazard Frequency Analysis documentation"),
    },
    secondaryAndCombinedHazards: {
      secondaryHazardScenarios: [], combinedHazardAssessments: [], transferredAnalyses: [], dependencyControls: [],
      ...technicalSection("DOC-O-SECONDARY", "Secondary and Combined Hazards documentation"),
    },
    hazardCurveAnalysis: {
      logicTreeBranches: [], hazardCurves: [], hazardIntervals: [], convergenceStudies: [],
      ...technicalSection("DOC-O-CURVES", "Hazard Curves and Uncertainty documentation"),
    },
    preliminaryPlantResponse: {
      preliminaryInitiatingEvents: [], modelReviews: [], otherHazardsSscList: [], functionalRequirements: [],
      ...technicalSection("DOC-O-SSC", "Preliminary Plant Response and SSC Scope documentation"),
    },
    plantInvestigation: {
      investigations: [], findings: [], configurationConfirmations: [], accessRouteChecks: [],
      ...technicalSection("DOC-O-INV", "Plant Investigation documentation"),
    },
    fragilityBasis: {
      screeningDecisions: [], methodSelections: [], correlationGroups: [], genericDataApplicability: [],
      ...technicalSection("DOC-O-FRB", "Fragility Basis documentation"),
    },
    fragilityAnalysis: {
      demandModels: [], capacityModels: [], fragilityCurves: [], functionalFailureModels: [], secondaryEffectFragilities: [],
      ...technicalSection("DOC-O-FRA", "Fragility Analysis documentation"),
    },
    initiatingEventAndScenarioDevelopment: {
      initiatingEventModels: [], scenarioFamilies: [], scenarioTimelines: [], secondaryScenarioLinks: [], industryExperienceEvents: [],
      ...technicalSection("DOC-O-SCEN", "Initiating Event and Scenario Development documentation"),
    },
    plantResponseModel: {
      peerReviewDispositions: [], eventSequenceModels: [], successCriteria: [], systemModelModifications: [],
      missionTimes: [], dataParameters: [], correlationModels: [], multiUnitAssessments: [], levelTwoInterfaces: [],
      ...technicalSection("DOC-O-PRM", "Other Hazards Plant Response Model documentation"),
    },
    humanReliabilityAnalysis: {
      humanActions: [], humanFailureEvents: [], performanceContexts: [], hepEstimates: [], confirmations: [],
      recoveryAssessments: [], dependencyAssessments: [],
      ...technicalSection("DOC-O-HRA", "Other Hazards Human Reliability Analysis documentation"),
    },
    eventSequenceQuantification: {
      quantificationRuns: [], hazardIntervalResults: [], eventSequenceFamilyResults: [], convergenceStudies: [],
      uncertaintyResults: [], riskContributors: [], screeningDecisions: [],
      ...technicalSection("DOC-O-ESQ", "Other Hazards Event Sequence Quantification documentation"),
    },
    integratedUncertainties: [],
    riskInterpretation: {
      sensitivityStudies: [], riskInsights: [], refinementActions: [], quantificationIterations: [], integrationResults: [],
      overlapControls: [], riskDecisions: [], traceabilityPaths: [], controlledBaselines: [],
      stoppingCriteria: {
        maximumAggregateFrequencyChange: 0.05, maximumFamilyFrequencyChange: 0.1,
        maximumContributorRankShift: 1, requiredStableIterations: 2,
        requireNoNewRiskSignificantContributors: true, basis: "",
      },
    },
    technicalClosure: {
      conformanceReviews: [], documentationChecks: [], interfaceClosureChecks: [], peerReviewTeam: [],
      peerReviewFindings: [], readinessChecks: [],
      ...technicalSection("DOC-O-CLOSE", "Other Hazards Technical Closure documentation"),
    },
    workflow: {
      reportSections: [], draftQualityChecks: [], reviewAssignments: [], reviewFindings: [],
      approvalReadiness: [], approvalSignatures: [],
    },
    documentation: {
      overallProcessDescription: "", analysisBasisSummary: "", siteAndEvidenceSummary: "", retainedHazardsSummary: "",
      sourceCharacterizationSummary: "", frequencyAnalysisSummary: "", secondaryHazardsSummary: "", hazardCurveSummary: "",
      sscScopeSummary: "", investigationSummary: "", fragilitySummary: "", scenarioSummary: "", plantResponseSummary: "",
      humanReliabilitySummary: "", quantificationSummary: "", riskInsights: "", uncertaintySummary: "",
      configurationControlDescription: "", peerReviewScope: "", supportingDocumentRefs: [],
    },
    exampleDocuments: [], newlyDevelopedMethodIds: [],
  };
}
