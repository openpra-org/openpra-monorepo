import { z } from "zod";
import { TechnicalElementTypes } from "../../technical-element";
import { technicalElementSchema } from "../technical-element";
import { SRReferenceSchema } from "../core/pra-common";

export const HsaRecordStatusSchema = z.enum(["DRAFT", "READY", "REVIEWED", "APPROVED", "SCREENED_OUT", "RETAINED", "OPEN", "CLOSED"]);
export const HsaHazardCategorySchema = z.enum(["NATURAL_EXTERNAL", "HUMAN_INDUCED_EXTERNAL", "INTERNAL_PLANT", "SECONDARY", "COMBINED"]);
export const HsaHazardDispositionSchema = z.enum(["QUALITATIVELY_SCREENED", "QUANTITATIVELY_SCREENED", "RETAIN_FOR_DEDICATED_PRA", "RETAIN_IN_INTERNAL_EVENTS_PRA", "BOUND_BY_ANOTHER_HAZARD", "OPEN"]);
export const HsaTechnicalElementCodeSchema = z.enum(["POS", "IE", "ES", "SC", "SY", "HR", "DA", "ESQ", "MS", "RC", "RI", "FL", "F", "S", "W", "XF", "O", "HS"]);

export const HsaAnalysisRecordSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  code: z.string(),
  description: z.string(),
  basis: z.string(),
  owner: z.string(),
  status: HsaRecordStatusSchema,
  evidenceRefs: z.array(z.string()),
  relatedRefs: z.array(z.string()),
  assumptionRefs: z.array(z.string()),
  implementsSrs: z.array(SRReferenceSchema),
});

export const HsaApplicationSchema = HsaAnalysisRecordSchema.extend({
  purpose: z.string(), decisionContext: z.string(), supportedRiskMetrics: z.array(z.string()), plantOperatingStateRefs: z.array(z.string()),
  reactorUnitRefs: z.array(z.string()), radioactiveMaterialSourceRefs: z.array(z.string()), boundingSiteUsed: z.boolean(), boundingSiteBasis: z.string(), limitations: z.array(z.string()),
});

export const HsaEvidenceRecordSchema = HsaAnalysisRecordSchema.extend({
  evidenceType: z.enum(["SITE_DATA", "DESIGN", "LICENSING", "PRA_MODEL", "OPERATING_EXPERIENCE", "INDUSTRY_STUDY", "GOVERNMENT_STUDY", "WALKDOWN", "INTERVIEW", "CALCULATION", "OTHER"]),
  sourceReference: z.string(), revision: z.string(), effectiveDate: z.string(), geographicApplicability: z.string(), plantApplicability: z.string(), qualityAndLimitations: z.string(), controlled: z.boolean(),
});

export const HsaSiteDescriptorSchema = HsaAnalysisRecordSchema.extend({
  descriptorType: z.enum(["SITE_LOCATION", "TOPOGRAPHY", "METEOROLOGY", "HYDROLOGY", "GEOLOGY", "LAND_USE", "TRANSPORTATION", "NEARBY_FACILITY", "PLANT_LAYOUT", "RADIOACTIVE_SOURCE"]),
  locationOrFeature: z.string(), distanceAndDirection: z.string(), elevationOrDatum: z.string(), observationPeriod: z.string(), currentCondition: z.string(), changeIndicator: z.string(),
});

export const HsaRegionalStudySchema = HsaAnalysisRecordSchema.extend({
  organization: z.string(), studyType: z.enum(["REGIONAL", "INDUSTRIAL", "TRANSPORTATION", "LAND_USE", "METEOROLOGICAL", "HYDROLOGICAL", "GEOLOGICAL", "EMERGENCY_PLANNING"]),
  coverageArea: z.string(), publicationDate: z.string(), hazardsAddressed: z.array(z.string()), findingsUsed: z.array(z.string()),
});

export const HsaDesignBasisRecordSchema = HsaAnalysisRecordSchema.extend({
  designFeatureRef: z.string(), hazardRefs: z.array(z.string()), designParameter: z.string(), designValue: z.string(), qualificationOrMargin: z.string(), creditedInScreening: z.boolean(), creditedFunction: z.string(),
});

export const HsaChangeMonitoringRecordSchema = HsaAnalysisRecordSchema.extend({
  monitoredDomain: z.enum(["PLANT", "SITE", "REGIONAL_INDUSTRY", "TRANSPORTATION", "LAND_USE", "CLIMATE", "OTHER"]), baselineDate: z.string(), currentReviewDate: z.string(),
  observedChanges: z.array(z.string()), affectedHazardRefs: z.array(z.string()), screeningImpact: z.string(), actionRequired: z.boolean(),
});

export const HsaHazardCandidateSchema = HsaAnalysisRecordSchema.extend({
  hazardFamily: z.string(), category: HsaHazardCategorySchema, origin: z.string(), applicability: z.enum(["APPLICABLE", "NOT_PHYSICALLY_POSSIBLE", "PENDING_INFORMATION"]),
  affectedPlantOperatingStateRefs: z.array(z.string()), affectedReactorUnitRefs: z.array(z.string()), affectedRadioactiveMaterialSourceRefs: z.array(z.string()), hazardParameters: z.array(z.string()),
  secondaryHazardRefs: z.array(z.string()), combinedHazardRefs: z.array(z.string()), preliminaryDisposition: HsaHazardDispositionSchema, dedicatedTechnicalElement: z.enum(["NONE", "S", "W", "XF", "O", "FL", "F"]),
});

export const HsaHazardRoutingDecisionSchema = HsaAnalysisRecordSchema.extend({
  hazardRef: z.string(), routeTo: z.enum(["QUALITATIVE_SCREENING", "QUANTITATIVE_SCREENING", "DEDICATED_HAZARD_PRA", "INTERNAL_EVENTS_MODEL"]), receivingTechnicalElement: HsaTechnicalElementCodeSchema,
  receivingRecordRefs: z.array(z.string()), overlapControls: z.array(z.string()), dispositionComplete: z.boolean(),
});

export const HsaHazardInteractionSchema = HsaAnalysisRecordSchema.extend({
  primaryHazardRef: z.string(), interactingHazardRefs: z.array(z.string()), interactionType: z.enum(["CONSEQUENTIAL", "CORRELATED", "INDEPENDENT_COINCIDENT", "COMMON_CAUSE_DRIVER"]),
  causalMechanism: z.string(), combinedLoadDescription: z.string(), affectedLocationRefs: z.array(z.string()), affectedSscRefs: z.array(z.string()),
  analysisTreatment: z.enum(["SEPARATE", "COMBINED_SCENARIO", "BOUND_BY_PRIMARY", "ROUTE_TO_DEDICATED_PRA"]), retained: z.boolean(),
});

export const HsaScreeningCriterionSchema = HsaAnalysisRecordSchema.extend({
  criterionCode: z.enum(["PHYSICALLY_IMPOSSIBLE", "DISTANCE", "DESIGN_ENVELOPE", "BOUNDED_BY_OTHER_EVENT", "SCR_1", "SCR_2", "SCR_3", "PROJECT_SPECIFIC"]), criterionType: z.enum(["QUALITATIVE", "QUANTITATIVE"]),
  applicabilityConditions: z.array(z.string()), thresholdValue: z.number().optional(), thresholdUnit: z.string().optional(), riskMetric: z.string(), conservatismRequirements: z.array(z.string()), prohibitedUses: z.array(z.string()),
});

export const HsaQualitativeScreeningDecisionSchema = HsaAnalysisRecordSchema.extend({
  hazardRef: z.string(), plantOperatingStateRefs: z.array(z.string()), criterionRef: z.string(), decision: z.enum(["SCREEN_OUT", "RETAIN", "MORE_INFORMATION_REQUIRED"]),
  siteSpecificFacts: z.array(z.string()), designFeaturesCredited: z.array(z.string()), conservativeArguments: z.array(z.string()), secondaryHazardsAddressed: z.boolean(), uncertaintyAddressed: z.boolean(),
});

export const HsaHazardFrequencyModelSchema = HsaAnalysisRecordSchema.extend({
  hazardRef: z.string(), modelType: z.enum(["EXCEEDANCE_CURVE", "OCCURRENCE_RATE", "EVENT_TREE", "FAULT_TREE", "BOUNDING_ESTIMATE", "DATABASE_RATE"]), frequencyBasis: z.string(), exposureBasis: z.string(),
  meanAnnualFrequency: z.number(), lowerAnnualFrequency: z.number(), upperAnnualFrequency: z.number(), parameterName: z.string(), parameterValue: z.number(), parameterUnit: z.string(),
  loadingDescription: z.string(), uncertaintyDistribution: z.string(), modelApplicability: z.string(),
});

export const HsaHazardDataAssessmentSchema = HsaAnalysisRecordSchema.extend({
  hazardRef: z.string(), sourceDatabase: z.string(), eventCount: z.number(), exposureYears: z.number(), screeningRules: z.array(z.string()),
  plantSpecificDataIncluded: z.boolean(), industryDataIncluded: z.boolean(), alternativeDataEvaluation: z.string(), selectedEstimateRef: z.string(),
});

export const HsaVulnerableSscSchema = HsaAnalysisRecordSchema.extend({
  hazardRefs: z.array(z.string()), sscRef: z.string(), systemRef: z.string(), locationRef: z.string(), creditedFunction: z.string(), failureModes: z.array(z.string()),
  demandOrLoading: z.string(), capacityOrProtection: z.string(), conditionalFailureProbability: z.number(), failureProbabilityTreatment: z.enum(["CALCULATED", "BOUNDING", "UNITY"]),
});

export const HsaPlantResponseScenarioSchema = HsaAnalysisRecordSchema.extend({
  hazardRefs: z.array(z.string()), initiatingEventRef: z.string(), eventSequenceRef: z.string(), eventSequenceFamilyRef: z.string(), affectedSscRefs: z.array(z.string()), affectedHumanActionRefs: z.array(z.string()),
  conditionalSequenceProbability: z.number(), meanAnnualFrequency: z.number(), consequenceResultRef: z.string(), modelTreatment: z.enum(["EXISTING_SEQUENCE", "MODIFIED_SEQUENCE", "NEW_SEQUENCE"]),
});

export const HsaHumanActionEffectSchema = HsaAnalysisRecordSchema.extend({
  hazardRefs: z.array(z.string()), humanFailureEventRef: z.string(), cueEffects: z.string(), accessAndHabitability: z.string(), timingEffects: z.string(), instrumentationEffects: z.string(),
  communicationEffects: z.string(), baselineHep: z.number(), hazardAdjustedHep: z.number(),
});

export const HsaPeerReviewDispositionSchema = HsaAnalysisRecordSchema.extend({
  sourcePeerReviewRef: z.string(), findingRef: z.string(), applicableTechnicalArea: z.string(), disposition: z.string(), incorporated: z.boolean(), verificationRefs: z.array(z.string()),
});

export const HsaConsequenceEstimateSchema = HsaAnalysisRecordSchema.extend({
  scenarioRef: z.string(), releaseCategoryRef: z.string(), consequenceMetric: z.string(), meanConsequence: z.number(), consequenceUnit: z.string(), screeningSurrogate: z.string(), consequenceThreshold: z.number(), thresholdUnit: z.string(),
});

export const HsaQuantitativeScreeningDecisionSchema = HsaAnalysisRecordSchema.extend({
  hazardRef: z.string(), scenarioRefs: z.array(z.string()), criterionRef: z.string(), meanEventSequenceFamilyFrequency: z.number(), riskContribution: z.number(), riskContributionUnit: z.string(),
  conservativeMultipliers: z.array(z.string()), decision: z.enum(["SCREEN_OUT", "RETAIN"]), retainedTechnicalElement: HsaTechnicalElementCodeSchema,
});

export const HsaFinalHazardDispositionSchema = HsaAnalysisRecordSchema.extend({
  hazardRef: z.string(), disposition: HsaHazardDispositionSchema, controllingDecisionRefs: z.array(z.string()), receivingTechnicalElement: HsaTechnicalElementCodeSchema,
  retainedScenarioRefs: z.array(z.string()), restrictions: z.array(z.string()), approvedForUse: z.boolean(),
});

export const HsaInvestigationSchema = HsaAnalysisRecordSchema.extend({
  investigationType: z.enum(["WALKDOWN", "INTERVIEW", "TABLETOP", "COMPUTERIZED_WALKDOWN", "DOCUMENT_REVIEW", "SITE_RECONNAISSANCE"]), scope: z.string(), locations: z.array(z.string()), participants: z.array(z.string()),
  performedDate: z.string(), observations: z.array(z.string()), findingRefs: z.array(z.string()), confirmedRecordRefs: z.array(z.string()), asBuiltOrIntendedConfirmed: z.boolean(),
});

export const HsaUncertaintySchema = HsaAnalysisRecordSchema.extend({
  uncertaintyType: z.enum(["PARAMETER", "MODEL", "COMPLETENESS", "ASSUMPTION"]), sourceArea: z.enum(["HAZARD_IDENTIFICATION", "QUALITATIVE_SCREENING", "HAZARD_FREQUENCY", "PLANT_RESPONSE", "CONSEQUENCE", "INTEGRATION"]),
  affectedRecordRefs: z.array(z.string()), potentialImpact: z.string(), reasonableAlternatives: z.array(z.string()), treatment: z.string(), sensitivityRefs: z.array(z.string()), importance: z.enum(["LOW", "MEDIUM", "HIGH"]),
});

export const HsaPreOperationalAssumptionSchema = HsaAnalysisRecordSchema.extend({
  affectedRecordRefs: z.array(z.string()), missingDesignInformation: z.array(z.string()), limitation: z.string(), closureAction: z.string(), closurePhase: z.string(), closureStatus: z.enum(["OPEN", "IN_PROGRESS", "CLOSED"]),
});

export const HsaInterfaceTransferItemSchema = z.object({
  uuid: z.string(), name: z.string(), recordRef: z.string(), sourceModelRef: z.string(), destinationRefs: z.array(z.string()), values: z.array(z.string()), evidenceRefs: z.array(z.string()), status: z.enum(["CONTROLLED", "WORKING", "OPEN"]),
});

export const HsaInterfaceRecordSchema = HsaAnalysisRecordSchema.extend({
  technicalElementCode: HsaTechnicalElementCodeSchema, technicalElementName: z.string(), direction: z.enum(["INPUT", "OUTPUT"]), role: z.string(), producer: HsaTechnicalElementCodeSchema, consumer: HsaTechnicalElementCodeSchema,
  payloadType: z.enum(["OPERATING_STATE", "INITIATING_EVENT", "EVENT_SEQUENCE", "SUCCESS_CRITERION", "SYSTEM_MODEL", "HUMAN_FAILURE_EVENT", "DATA_PARAMETER", "CONSEQUENCE_RESULT", "HAZARD_DISPOSITION", "HAZARD_INPUT", "RISK_RESULT"]),
  columns: z.array(z.string()), transferItems: z.array(HsaInterfaceTransferItemSchema), producerRefs: z.array(z.string()), consumerRefs: z.array(z.string()), consistencyChecks: z.array(z.string()), consistent: z.boolean(), openItems: z.array(z.string()),
});

export const HsaTechnicalHandoffSchema = HsaAnalysisRecordSchema.extend({
  destinationTechnicalElement: HsaTechnicalElementCodeSchema, transferredHazardRefs: z.array(z.string()), transferredScenarioRefs: z.array(z.string()), transferredResultRefs: z.array(z.string()),
  modelBoundaryStatement: z.string(), overlapControls: z.array(z.string()), acceptanceStatus: z.enum(["WORKING", "READY", "ACCEPTED"]), acceptanceReference: z.string(),
});

export const HsaTraceabilityPathSchema = HsaAnalysisRecordSchema.extend({
  evidenceRefs: z.array(z.string()), siteDescriptorRefs: z.array(z.string()), hazardRefs: z.array(z.string()), interactionRefs: z.array(z.string()), criterionRefs: z.array(z.string()), screeningDecisionRefs: z.array(z.string()),
  frequencyModelRefs: z.array(z.string()), sscRefs: z.array(z.string()), scenarioRefs: z.array(z.string()), consequenceRefs: z.array(z.string()), finalDispositionRefs: z.array(z.string()), handoffRefs: z.array(z.string()), complete: z.boolean(),
});

export const HsaControlledBaselineSchema = HsaAnalysisRecordSchema.extend({
  modelVersion: z.string(), reportRef: z.string(), evidenceIndexRef: z.string(), configurationControlRecordId: z.string(), peerReviewRef: z.string(), packageManifestRefs: z.array(z.string()), unresolvedLimitations: z.array(z.string()), releaseStatus: z.enum(["WORKING", "CONTROLLED", "SUPERSEDED"]),
});

export const HsaWorkflowRecordSchema = HsaAnalysisRecordSchema.extend({
  workflowRecordType: z.enum(["REPORT_SECTION", "QUALITY_CHECK", "REVIEW_ASSIGNMENT", "REVIEW_FINDING", "APPROVAL_READINESS", "APPROVAL_SIGNATURE"]), discipline: z.string(), assignee: z.string(), dueDate: z.string().optional(), result: z.string(), verificationRefs: z.array(z.string()),
});

export const HsaWorkflowSchema = z.object({
  reportSections: z.array(HsaWorkflowRecordSchema), draftQualityChecks: z.array(HsaWorkflowRecordSchema), reviewAssignments: z.array(HsaWorkflowRecordSchema), reviewFindings: z.array(HsaWorkflowRecordSchema),
  approvalReadiness: z.array(HsaWorkflowRecordSchema), approvalSignatures: z.array(HsaWorkflowRecordSchema),
});

export const HsaDocumentationSummarySchema = z.object({
  overallProcess: z.string(), hazardIdentificationSummary: z.string(), qualitativeScreeningSummary: z.string(), quantitativeScreeningSummary: z.string(), plantConfirmationSummary: z.string(),
  uncertaintySummary: z.string(), resultsAndHandoffsSummary: z.string(), configurationControlSummary: z.string(), supportingDocumentRefs: z.array(z.string()),
});

export const HazardsScreeningAnalysisSchema = z.object({
  ...technicalElementSchema(TechnicalElementTypes.HAZARDS_SCREENING_ANALYSIS).shape,
  praScope: z.string(), applications: z.array(HsaApplicationSchema), evidenceRegister: z.array(HsaEvidenceRecordSchema),
  siteCharacterization: z.object({ siteDescriptors: z.array(HsaSiteDescriptorSchema), regionalStudies: z.array(HsaRegionalStudySchema), designBasisRecords: z.array(HsaDesignBasisRecordSchema), changeMonitoringRecords: z.array(HsaChangeMonitoringRecordSchema) }),
  hazardInventory: z.object({ hazards: z.array(HsaHazardCandidateSchema), routingDecisions: z.array(HsaHazardRoutingDecisionSchema) }),
  combinedHazards: z.object({ interactions: z.array(HsaHazardInteractionSchema) }), screeningCriteria: z.object({ criteria: z.array(HsaScreeningCriterionSchema) }),
  qualitativeScreening: z.object({ decisions: z.array(HsaQualitativeScreeningDecisionSchema) }),
  quantitativeCharacterization: z.object({ frequencyModels: z.array(HsaHazardFrequencyModelSchema), dataAssessments: z.array(HsaHazardDataAssessmentSchema) }),
  plantResponse: z.object({ vulnerableSscs: z.array(HsaVulnerableSscSchema), scenarios: z.array(HsaPlantResponseScenarioSchema), humanActionEffects: z.array(HsaHumanActionEffectSchema), peerReviewDispositions: z.array(HsaPeerReviewDispositionSchema) }),
  quantitativeScreening: z.object({ consequenceEstimates: z.array(HsaConsequenceEstimateSchema), decisions: z.array(HsaQuantitativeScreeningDecisionSchema) }),
  confirmations: z.object({ investigations: z.array(HsaInvestigationSchema) }), uncertainties: z.array(HsaUncertaintySchema), preOperationalAssumptions: z.array(HsaPreOperationalAssumptionSchema),
  integration: z.object({ interfaces: z.array(HsaInterfaceRecordSchema), finalDispositions: z.array(HsaFinalHazardDispositionSchema), technicalHandoffs: z.array(HsaTechnicalHandoffSchema), unresolvedInterfaces: z.array(z.string()) }),
  traceability: z.object({ paths: z.array(HsaTraceabilityPathSchema), controlledBaselines: z.array(HsaControlledBaselineSchema) }), workflow: HsaWorkflowSchema, documentation: HsaDocumentationSummarySchema,
  configurationControlRecordId: z.string().optional(), newlyDevelopedMethodIds: z.array(z.string()).optional(),
});
