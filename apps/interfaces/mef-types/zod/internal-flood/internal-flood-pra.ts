import { z } from "zod";
import type { InternalFloodBaselinePraDefinition, InternalFloodBaselinePraRecordTreatment, InternalFloodConsistencyCheck, InternalFloodControlledBaseline, InternalFloodModelRefinement, InternalFloodPRA, InternalFloodPraApplication, InternalFloodPraDocumentation, InternalFloodPraEvidenceRecord, InternalFloodPraIntegration, InternalFloodPraWorkflow, InternalFloodRefinementIteration, InternalFloodRiskDecision, InternalFloodRiskInsight, InternalFloodRiskIntegrationBaseline, InternalFloodRiskIntegrationResult, InternalFloodRiskInterpretation, InternalFloodRiskTraceabilityPath, InternalFloodWorkflowRecord } from "../../internal-flood/internal-flood-pra";
import { TechnicalElementTypes } from "../../technical-element";
import { InternalFloodEventSequenceQuantificationSchema } from "../flesq/internal-flood-event-sequence-quantification";
import { InternalFloodInitiatingEventsSchema } from "../flev/internal-flood-initiating-events";
import { InternalFloodHumanReliabilityAnalysisSchema } from "../flhr/internal-flood-human-reliability-analysis";
import { InternalFloodPlantPartitioningSchema } from "../flpp/internal-flood-plant-partitioning";
import { InternalFloodPlantResponseModelSchema } from "../flpr/internal-flood-plant-response-model";
import { InternalFloodScenariosDevelopmentSchema } from "../flsn/internal-flood-scenarios-development";
import { InternalFloodSourcesIdentificationAndCharacterizationSchema } from "../flso/internal-flood-sources-identification-and-characterization";
import { technicalElementSchema } from "../technical-element";
import { HazardConditionedMethodModelsSchema, createEmptyHazardConditionedMethodModels } from "../hazard-conditioned-models";
import { InternalFloodAnalysisRecordSchema, InternalFloodModelUncertaintySchema, InternalFloodPraInterfaceRecordSchema, InternalFloodPraSubelementSchema } from "./internal-flood-pra-common";

export const InternalFloodPraApplicationSchema = InternalFloodAnalysisRecordSchema.extend({
  purpose: z.string(), decisionContext: z.string(), supportedRiskMetrics: z.array(z.string()), consumingElementRefs: z.array(z.string()), configurationBasis: z.string(), limitations: z.array(z.string()),
});

export const InternalFloodPraEvidenceRecordSchema = InternalFloodAnalysisRecordSchema.extend({
  evidenceType: z.enum(["DRAWING", "CALCULATION", "PROCEDURE", "DATA", "MODEL", "WALKDOWN", "INTERVIEW", "REVIEW", "OTHER"]),
  sourceReference: z.string(), revision: z.string().optional(), effectiveDate: z.string().optional(), applicableSubelements: z.array(InternalFloodPraSubelementSchema),
  applicability: z.string(), qualityAndLimitations: z.string(), fileReference: z.string().optional(), supersedesEvidenceRef: z.string().optional(), controlled: z.boolean(),
});

export const InternalFloodBaselinePraRecordTreatmentSchema = InternalFloodAnalysisRecordSchema.extend({
  technicalArea: z.enum(["PLANT_OPERATING_STATES", "INITIATING_EVENTS", "EVENT_SEQUENCES", "SUCCESS_CRITERIA", "SYSTEMS", "DATA", "HUMAN_RELIABILITY", "RISK_INTEGRATION"]),
  sourceRecordRefs: z.array(z.string()), treatment: z.enum(["REUSED", "MODIFIED", "NEW", "NOT_APPLICABLE"]), internalFloodChange: z.string(), unresolvedItems: z.array(z.string()),
});

export const InternalFloodBaselinePraDefinitionSchema = z.object({
  modelName: z.string(), modelReference: z.string(), revision: z.string(), freezeDate: z.string(), freezeStatus: z.enum(["WORKING", "FROZEN", "REFERENCE_ONLY"]),
  modelBoundary: z.string(), plantOperatingStateRefs: z.array(z.string()), reactorUnitRefs: z.array(z.string()), radioactiveMaterialSourceRefs: z.array(z.string()),
  recordTreatments: z.array(InternalFloodBaselinePraRecordTreatmentSchema), unresolvedInterfaces: z.array(z.string()),
});

export const InternalFloodConsistencyCheckSchema = InternalFloodAnalysisRecordSchema.extend({
  checkType: z.enum(["AREA_SOURCE", "SOURCE_RELEASE", "PATH_SCENARIO", "SCENARIO_INITIATOR", "SCENARIO_TARGET", "TARGET_SYSTEM_MODEL", "HFE_CONTEXT", "FREQUENCY_RECONCILIATION", "TRACEABILITY", "OTHER"]),
  subelements: z.array(InternalFloodPraSubelementSchema), comparedRefs: z.array(z.string()), method: z.string(), result: z.enum(["PASS", "OPEN", "FAIL", "NOT_APPLICABLE"]), openItems: z.array(z.string()),
});

export const InternalFloodPraIntegrationSchema = z.object({
  interfaces: z.array(InternalFloodPraInterfaceRecordSchema), consistencyChecks: z.array(InternalFloodConsistencyCheckSchema), selectedFloodAreaRefs: z.array(z.string()),
  selectedFloodSourceRefs: z.array(z.string()), retainedFloodScenarioRefs: z.array(z.string()), initiatingEventRefs: z.array(z.string()), plantResponseModelRefs: z.array(z.string()),
  humanFailureEventRefs: z.array(z.string()), quantificationResultRefs: z.array(z.string()), unresolvedInterfaces: z.array(z.string()), integrationMethod: z.string(),
});

export const InternalFloodRiskInsightSchema = InternalFloodAnalysisRecordSchema.extend({
  insightType: z.enum(["DOMINANT_CONTRIBUTOR", "DEFENSE_IN_DEPTH", "MODEL_LIMITATION", "UNCERTAINTY", "DESIGN_OPPORTUNITY"]), contributorRefs: z.array(z.string()),
  affectedRiskMetric: z.string(), fractionalContribution: z.number().optional(), decisionImplication: z.string(),
});

export const InternalFloodModelRefinementSchema = InternalFloodAnalysisRecordSchema.extend({
  technicalArea: z.enum(["EVIDENCE", "PARTITIONING", "SOURCE", "SCENARIO", "FREQUENCY", "PLANT_RESPONSE", "HRA", "QUANTIFICATION"]), driverRefs: z.array(z.string()),
  affectedRecordRefs: z.array(z.string()), refinement: z.string(), expectedEffect: z.string(), priority: z.enum(["LOW", "MEDIUM", "HIGH"]),
  refinementStatus: z.enum(["PROPOSED", "IN_PROGRESS", "REQUANTIFIED", "CLOSED"]), quantificationIterationRef: z.string().optional(), result: z.string(), decisionBasis: z.string(),
});

export const InternalFloodRefinementIterationSchema = InternalFloodAnalysisRecordSchema.extend({
  modelVersion: z.string(), calculationDate: z.string(), refinementActionRefs: z.array(z.string()), aggregateMeanFrequencyPerPlantYear: z.number(),
  previousAggregateMeanFrequencyPerPlantYear: z.number().optional(), relativeChange: z.number().optional(), maximumFamilyRelativeChange: z.number().optional(),
  topContributorRefs: z.array(z.string()), contributorRankingStable: z.boolean(), newRiskSignificantContributorRefs: z.array(z.string()), decision: z.enum(["CONTINUE_REFINEMENT", "ACCEPT_STABLE"]),
});

export const InternalFloodRiskInterpretationSchema = z.object({
  riskInsights: z.array(InternalFloodRiskInsightSchema), refinementActions: z.array(InternalFloodModelRefinementSchema), quantificationIterations: z.array(InternalFloodRefinementIterationSchema),
  stoppingCriteria: z.object({ maximumAggregateFrequencyChange: z.number(), maximumFamilyFrequencyChange: z.number(), maximumContributorRankShift: z.number(), requiredStableIterations: z.number(), requireNoNewRiskSignificantContributors: z.boolean(), basis: z.string() }),
});

export const InternalFloodRiskIntegrationResultSchema = InternalFloodAnalysisRecordSchema.extend({
  modelVersion: z.string(), plantOperatingStateRefs: z.array(z.string()), reactorUnitRefs: z.array(z.string()), radioactiveMaterialSourceRefs: z.array(z.string()),
  eventSequenceFamilyRefs: z.array(z.string()), releaseCategoryRefs: z.array(z.string()), aggregateMeanFrequencyPerPlantYear: z.number(), fifthPercentileFrequencyPerPlantYear: z.number(),
  ninetyFifthPercentileFrequencyPerPlantYear: z.number(), otherHazardRiskRefs: z.array(z.string()), overlapTreatment: z.string(), dominantContributorRefs: z.array(z.string()),
  integrationStatus: z.enum(["DRAFT", "READY_FOR_RISK_INTEGRATION", "ACCEPTED_BY_RISK_INTEGRATION"]),
});

export const InternalFloodRiskDecisionSchema = InternalFloodAnalysisRecordSchema.extend({
  decisionType: z.enum(["DESIGN", "CONFIGURATION_CONTROL", "PROCEDURE", "MONITORING", "DATA_COLLECTION", "MODEL_CONTROL"]), driverRefs: z.array(z.string()), affectedSscRefs: z.array(z.string()),
  action: z.string(), duePhase: z.string(), disposition: z.enum(["IMPLEMENT", "MONITOR", "CONFIRM_PRE_OPERATIONAL", "RETAIN_CURRENT_BASIS", "FORWARD_TO_PLANT_PROCESS"]),
  verificationRefs: z.array(z.string()), reanalysisRequired: z.boolean(), riskIntegrationResultRef: z.string(),
});

export const InternalFloodRiskTraceabilityPathSchema = InternalFloodAnalysisRecordSchema.extend({
  evidenceRefs: z.array(z.string()), floodAreaRefs: z.array(z.string()), floodSourceRefs: z.array(z.string()), propagationPathRefs: z.array(z.string()), floodScenarioRefs: z.array(z.string()),
  initiatingEventRefs: z.array(z.string()), sscRefs: z.array(z.string()), humanFailureEventRefs: z.array(z.string()), eventSequenceFamilyRefs: z.array(z.string()), resultRefs: z.array(z.string()), decisionRefs: z.array(z.string()), complete: z.boolean(),
});

export const InternalFloodControlledBaselineSchema = InternalFloodAnalysisRecordSchema.extend({
  modelVersion: z.string(), quantificationRunRef: z.string(), reportRef: z.string(), configurationControlRecordId: z.string(), peerReviewRef: z.string(),
  packageManifestRefs: z.array(z.string()), unresolvedLimitations: z.array(z.string()), releaseStatus: z.enum(["WORKING", "CONTROLLED", "SUPERSEDED"]),
});

export const InternalFloodRiskIntegrationBaselineSchema = z.object({
  results: z.array(InternalFloodRiskIntegrationResultSchema), decisions: z.array(InternalFloodRiskDecisionSchema), traceabilityPaths: z.array(InternalFloodRiskTraceabilityPathSchema), controlledBaselines: z.array(InternalFloodControlledBaselineSchema),
});

export const InternalFloodWorkflowRecordSchema = InternalFloodAnalysisRecordSchema.extend({
  workflowRecordType: z.enum(["REPORT_SECTION", "QUALITY_CHECK", "REVIEW_ASSIGNMENT", "REVIEW_FINDING", "APPROVAL_READINESS", "APPROVAL_SIGNATURE"]),
  discipline: z.string(), assignee: z.string(), dueDate: z.string().optional(), result: z.string(), verificationRefs: z.array(z.string()),
});

export const InternalFloodPraWorkflowSchema = z.object({
  reportSections: z.array(InternalFloodWorkflowRecordSchema), draftQualityChecks: z.array(InternalFloodWorkflowRecordSchema), reviewAssignments: z.array(InternalFloodWorkflowRecordSchema),
  reviewFindings: z.array(InternalFloodWorkflowRecordSchema), approvalReadiness: z.array(InternalFloodWorkflowRecordSchema), approvalSignatures: z.array(InternalFloodWorkflowRecordSchema),
});

export const InternalFloodPraDocumentationSchema = z.object({
  overallProcessDescription: z.string(), partitioningSummary: z.string(), sourceSummary: z.string(), scenarioSummary: z.string(), frequencySummary: z.string(), plantResponseSummary: z.string(),
  humanReliabilitySummary: z.string(), quantificationSummary: z.string(), riskInsights: z.string(), uncertaintySummary: z.string(), configurationControlDescription: z.string(), peerReviewScope: z.string(), supportingDocumentRefs: z.array(z.string()),
});

export const InternalFloodPraExampleDocumentSchema = z.object({
  id: z.string(), name: z.string(), kind: z.enum(["doc", "sheet", "image"]), sizeLabel: z.string(), uploadedLabel: z.string(), extracted: z.string(), linked: z.number(), url: z.string().optional(),
});

export const InternalFloodPRASchema = z.object({
  ...technicalElementSchema(TechnicalElementTypes.INTERNAL_FLOOD_PRA).shape,
  praScope: z.string(), hazardConditionedModels: HazardConditionedMethodModelsSchema.default(createEmptyHazardConditionedMethodModels), applications: z.array(InternalFloodPraApplicationSchema), evidenceRegister: z.array(InternalFloodPraEvidenceRecordSchema), baselinePra: InternalFloodBaselinePraDefinitionSchema.optional(),
  plantPartitioning: InternalFloodPlantPartitioningSchema, sourcesIdentificationAndCharacterization: InternalFloodSourcesIdentificationAndCharacterizationSchema,
  scenariosDevelopment: InternalFloodScenariosDevelopmentSchema, initiatingEvents: InternalFloodInitiatingEventsSchema, plantResponseModel: InternalFloodPlantResponseModelSchema,
  humanReliabilityAnalysis: InternalFloodHumanReliabilityAnalysisSchema, eventSequenceQuantification: InternalFloodEventSequenceQuantificationSchema, integration: InternalFloodPraIntegrationSchema,
  integratedUncertainties: z.array(InternalFloodModelUncertaintySchema), riskInterpretation: InternalFloodRiskInterpretationSchema, riskIntegrationBaseline: InternalFloodRiskIntegrationBaselineSchema,
  workflow: InternalFloodPraWorkflowSchema, documentation: InternalFloodPraDocumentationSchema, configurationControlRecordId: z.string().optional(),
  exampleDocuments: z.array(InternalFloodPraExampleDocumentSchema).optional(), newlyDevelopedMethodIds: z.array(z.string()).optional(),
});

type Expect<T extends true> = T;
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type _Application = Expect<Equal<z.infer<typeof InternalFloodPraApplicationSchema>, InternalFloodPraApplication>>;
type _Evidence = Expect<Equal<z.infer<typeof InternalFloodPraEvidenceRecordSchema>, InternalFloodPraEvidenceRecord>>;
type _BaselineTreatment = Expect<Equal<z.infer<typeof InternalFloodBaselinePraRecordTreatmentSchema>, InternalFloodBaselinePraRecordTreatment>>;
type _Baseline = Expect<Equal<z.infer<typeof InternalFloodBaselinePraDefinitionSchema>, InternalFloodBaselinePraDefinition>>;
type _Check = Expect<Equal<z.infer<typeof InternalFloodConsistencyCheckSchema>, InternalFloodConsistencyCheck>>;
type _Integration = Expect<Equal<z.infer<typeof InternalFloodPraIntegrationSchema>, InternalFloodPraIntegration>>;
type _Insight = Expect<Equal<z.infer<typeof InternalFloodRiskInsightSchema>, InternalFloodRiskInsight>>;
type _Refinement = Expect<Equal<z.infer<typeof InternalFloodModelRefinementSchema>, InternalFloodModelRefinement>>;
type _Iteration = Expect<Equal<z.infer<typeof InternalFloodRefinementIterationSchema>, InternalFloodRefinementIteration>>;
type _Interpretation = Expect<Equal<z.infer<typeof InternalFloodRiskInterpretationSchema>, InternalFloodRiskInterpretation>>;
type _IntegrationResult = Expect<Equal<z.infer<typeof InternalFloodRiskIntegrationResultSchema>, InternalFloodRiskIntegrationResult>>;
type _Decision = Expect<Equal<z.infer<typeof InternalFloodRiskDecisionSchema>, InternalFloodRiskDecision>>;
type _Trace = Expect<Equal<z.infer<typeof InternalFloodRiskTraceabilityPathSchema>, InternalFloodRiskTraceabilityPath>>;
type _Controlled = Expect<Equal<z.infer<typeof InternalFloodControlledBaselineSchema>, InternalFloodControlledBaseline>>;
type _RiskBaseline = Expect<Equal<z.infer<typeof InternalFloodRiskIntegrationBaselineSchema>, InternalFloodRiskIntegrationBaseline>>;
type _WorkflowRecord = Expect<Equal<z.infer<typeof InternalFloodWorkflowRecordSchema>, InternalFloodWorkflowRecord>>;
type _Workflow = Expect<Equal<z.infer<typeof InternalFloodPraWorkflowSchema>, InternalFloodPraWorkflow>>;
type _Documentation = Expect<Equal<z.infer<typeof InternalFloodPraDocumentationSchema>, InternalFloodPraDocumentation>>;
type _Pra = Expect<Equal<z.infer<typeof InternalFloodPRASchema>, InternalFloodPRA>>;
