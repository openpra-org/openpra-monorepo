import { z } from "zod";
import type { SeismicPRA } from "../../seismic/seismic-pra";
import { TechnicalElementTypes } from "../../technical-element";
import { technicalElementSchema } from "../technical-element";
import { BaseModelUncertaintyDocumentationSchema, PreOperationalAssumptionSchema } from "../core/documentation";
import { ImportanceLevelSchema, SensitivityStudySchema } from "../core/shared-patterns";
import { SRReferenceSchema } from "../core/pra-common";
import { SeismicHazardAnalysisSchema } from "../sha/seismic-hazard-analysis";
import { SeismicFragilityAnalysisSchema } from "../sfr/seismic-fragility-analysis";
import { SeismicPlantResponseAnalysisSchema } from "../spr/seismic-plant-response-analysis";
import { SeismicPraInterfaceRecordSchema, SeismicPraSubelementSchema } from "./seismic-pra-common";

export const SeismicPraApplicationSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  purpose: z.string(),
  decisionContext: z.string(),
  supportedRiskMetrics: z.array(z.string()),
  consumingElementRefs: z.array(z.string()),
  configurationBasis: z.string(),
  limitations: z.array(z.string()),
  evidenceRefs: z.array(z.string()),
  status: z.enum(["PLANNED", "ACTIVE", "COMPLETED", "SUPERSEDED"]),
});

export const SeismicPraEvidenceRecordSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  evidenceType: z.enum(["DATA", "MODEL", "CALCULATION", "DOCUMENT", "REVIEW", "DECISION", "OTHER"]),
  sourceReference: z.string(),
  revision: z.string().optional(),
  effectiveDate: z.string().optional(),
  owner: z.string(),
  applicableSubelements: z.array(SeismicPraSubelementSchema),
  applicability: z.string(),
  qualityAndLimitations: z.string(),
  fileReference: z.string().optional(),
  supersedesEvidenceRef: z.string().optional(),
  status: z.enum(["DRAFT", "CONTROLLED", "SUPERSEDED"]),
  implementsSrs: z.array(SRReferenceSchema),
});

export const BaselinePraRecordTreatmentSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  technicalArea: z.enum([
    "PLANT_OPERATING_STATES",
    "INITIATING_EVENTS",
    "EVENT_SEQUENCES",
    "SUCCESS_CRITERIA",
    "SYSTEMS",
    "DATA",
    "HUMAN_RELIABILITY",
    "INTERNAL_FIRE",
    "INTERNAL_FLOOD",
    "EXTERNAL_HAZARDS",
    "RISK_INTEGRATION",
    "SEISMIC_LOGIC",
  ]),
  sourceRecordRefs: z.array(z.string()),
  treatment: z.enum(["REUSED", "MODIFIED", "NEW", "NOT_APPLICABLE"]),
  seismicChange: z.string(),
  owner: z.string(),
  status: z.enum(["CONFIRMED", "OPEN"]),
});

export const BaselinePraDefinitionSchema = z.object({
  modelName: z.string(),
  modelReference: z.string(),
  sourceEvidenceRef: z.string(),
  revision: z.string(),
  freezeDate: z.string(),
  freezeStatus: z.enum(["WORKING", "FROZEN", "REFERENCE_ONLY"]),
  modelBoundary: z.string(),
  nonSeismicHazardModelRefs: z.array(z.string()),
  recordTreatments: z.array(BaselinePraRecordTreatmentSchema),
  unresolvedInterfaces: z.array(z.string()),
});

export const SeismicPraConsistencyCheckSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  checkType: z.enum([
    "GROUND_MOTION_PARAMETER",
    "CONTROL_POINT",
    "SPECTRAL_SHAPE",
    "HAZARD_RANGE",
    "SEISMIC_EQUIPMENT_LIST",
    "FAILURE_MODE",
    "FRAGILITY_CORRELATION",
    "HAZARD_FRAGILITY_INTEGRATION",
    "SECONDARY_HAZARD",
    "PLANT_STAGE",
    "CAPABILITY_CATEGORY",
    "OTHER",
  ]),
  subelements: z.array(SeismicPraSubelementSchema),
  comparedRefs: z.array(z.string()),
  method: z.string(),
  result: z.enum(["PASS", "OPEN", "FAIL", "NOT_APPLICABLE"]),
  evidence: z.string(),
  openItems: z.array(z.string()),
  implementsSrs: z.array(SRReferenceSchema),
});

export const SeismicPraCoverageSummarySchema = z.object({
  sprEquipmentCount: z.number(),
  fragilityScopeEquipmentCount: z.number(),
  quantifiedFragilityCount: z.number(),
  unlinkedEquipmentRefs: z.array(z.string()),
  unmodeledFailureModeRefs: z.array(z.string()),
  retainedSecondaryHazardRefs: z.array(z.string()),
  modeledSecondaryHazardRefs: z.array(z.string()),
  coverageBasis: z.string(),
});

export const SeismicPraIntegrationSchema = z.object({
  interfaces: z.array(SeismicPraInterfaceRecordSchema),
  consistencyChecks: z.array(SeismicPraConsistencyCheckSchema),
  coverage: SeismicPraCoverageSummarySchema,
  selectedGroundMotionParameterRefs: z.array(z.string()),
  selectedControlPointRefs: z.array(z.string()),
  hazardCurveRefs: z.array(z.string()),
  responseSpectrumRefs: z.array(z.string()),
  hazardIntervalRefs: z.array(z.string()),
  seismicEquipmentListRef: z.string(),
  fragilityResultRefs: z.array(z.string()),
  eventSequenceFamilyQuantificationRefs: z.array(z.string()),
  externalFloodingAnalysisRefs: z.array(z.string()),
  eventSequenceQuantificationRefs: z.array(z.string()),
  riskIntegrationRefs: z.array(z.string()),
  integrationMethod: z.string(),
  unresolvedInterfaces: z.array(z.string()),
  implementsSrs: z.array(SRReferenceSchema),
});

export const IntegratedSeismicPraUncertaintySchema = z.object({
  uuid: z.string(),
  name: z.string(),
  sourceSubelement: SeismicPraSubelementSchema,
  sourceUncertaintyRef: z.string(),
  affectedSubelements: z.array(SeismicPraSubelementSchema),
  affectedEventSequenceFamilyRefs: z.array(z.string()),
  uncertaintyType: z.enum(["PARAMETER", "MODEL", "ASSUMPTION"]),
  dependencyAndCorrelationTreatment: z.string(),
  propagationOrSensitivityTreatment: z.string(),
  combinedEffect: z.string(),
  importance: ImportanceLevelSchema,
  sensitivityStudyRefs: z.array(z.string()),
  closureOrRefinementActions: z.array(z.string()),
  implementsSrs: z.array(SRReferenceSchema),
});

export const SeismicModelRefinementSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  technicalArea: z.enum([
    "EVIDENCE",
    "PLANT_DEMAND",
    "FRAGILITY",
    "PLANT_RESPONSE",
    "HUMAN_RELIABILITY",
  ]),
  driverRefs: z.array(z.string()),
  affectedRecordRefs: z.array(z.string()),
  refinement: z.string(),
  evidenceRefs: z.array(z.string()),
  expectedEffect: z.string(),
  priority: ImportanceLevelSchema,
  status: z.enum(["PROPOSED", "IN_PROGRESS", "REQUANTIFIED", "CLOSED"]),
  quantificationIterationRef: z.string().optional(),
  result: z.string(),
  decisionBasis: z.string(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const SeismicRefinementIterationSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  modelVersion: z.string(),
  calculationDate: z.string(),
  refinementActionRefs: z.array(z.string()),
  aggregateReleaseFamilyMeanFrequency: z.number(),
  previousAggregateReleaseFamilyMeanFrequency: z.number().optional(),
  relativeChange: z.number().optional(),
  maximumFamilyRelativeChange: z.number().optional(),
  topContributorRefs: z.array(z.string()),
  contributorRankingStable: z.boolean(),
  newRiskSignificantContributorRefs: z.array(z.string()),
  decision: z.enum(["CONTINUE_REFINEMENT", "ACCEPT_STABLE"]),
  basis: z.string(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const SeismicRefinementStoppingCriteriaSchema = z.object({
  maximumAggregateFrequencyChange: z.number(),
  maximumFamilyFrequencyChange: z.number(),
  maximumContributorRankShift: z.number(),
  requiredStableIterations: z.number(),
  requireNoNewRiskSignificantContributors: z.boolean(),
  basis: z.string(),
});

export const SeismicRiskInterpretationSchema = z.object({
  refinementActions: z.array(SeismicModelRefinementSchema),
  quantificationIterations: z.array(SeismicRefinementIterationSchema),
  stoppingCriteria: SeismicRefinementStoppingCriteriaSchema,
});

export const SeismicRiskIntegrationResultSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  modelVersion: z.string(),
  plantOperatingStateRefs: z.array(z.string()),
  unitRefs: z.array(z.string()),
  radioactiveMaterialSourceRefs: z.array(z.string()),
  initiatingEventRefs: z.array(z.string()),
  eventSequenceFamilyRefs: z.array(z.string()),
  releaseCategoryRefs: z.array(z.string()),
  aggregateReleaseFamilyMeanFrequency: z.number(),
  frequencyUnit: z.literal("PER_PLANT_YEAR"),
  uncertaintyRange: z.object({
    lowerBound: z.number(),
    upperBound: z.number(),
    confidenceLevel: z.number(),
  }).optional(),
  internalEventsRiskRef: z.string(),
  otherHazardRiskRefs: z.array(z.string()),
  overlapTreatment: z.string(),
  crossHazardIntegrationBasis: z.string(),
  riskIntegrationResultRef: z.string(),
  dominantContributorRefs: z.array(z.string()),
  status: z.enum([
    "DRAFT",
    "READY_FOR_RISK_INTEGRATION",
    "ACCEPTED_BY_RISK_INTEGRATION",
  ]),
  implementsSrs: z.array(SRReferenceSchema),
});

export const SeismicRiskDecisionSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  decisionType: z.enum([
    "DESIGN",
    "CONFIGURATION_CONTROL",
    "PROCEDURE",
    "MONITORING",
    "DATA_COLLECTION",
    "DEFENSE_IN_DEPTH_INPUT",
    "SSC_CLASSIFICATION_INPUT",
    "MODEL_CONTROL",
  ]),
  driverRefs: z.array(z.string()),
  affectedSscRefs: z.array(z.string()),
  action: z.string(),
  owner: z.string(),
  duePhase: z.string(),
  disposition: z.enum([
    "IMPLEMENT",
    "MONITOR",
    "CONFIRM_PRE_OPERATIONAL",
    "RETAIN_CURRENT_BASIS",
    "FORWARD_TO_PLANT_PROCESS",
  ]),
  verificationRefs: z.array(z.string()),
  reanalysisRequired: z.boolean(),
  riskIntegrationResultRef: z.string(),
  basis: z.string(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const SeismicRiskTraceabilityPathSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  evidenceRefs: z.array(z.string()),
  hazardRefs: z.array(z.string()),
  responseRefs: z.array(z.string()),
  sscRefs: z.array(z.string()),
  failureMechanismRefs: z.array(z.string()),
  fragilityRefs: z.array(z.string()),
  plantModelRefs: z.array(z.string()),
  humanActionRefs: z.array(z.string()),
  eventSequenceRefs: z.array(z.string()),
  eventSequenceFamilyRef: z.string(),
  releaseCategoryRef: z.string(),
  riskIntegrationResultRef: z.string(),
  decisionRefs: z.array(z.string()),
  status: z.enum(["PASS", "OPEN"]),
  openItems: z.array(z.string()),
});

export const SeismicControlledBaselineSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  modelVersion: z.string(),
  configurationControlRecordId: z.string(),
  quantificationRunRef: z.string(),
  riskIntegrationHandoffRef: z.string(),
  controlledDocumentRefs: z.array(z.string()),
  peerReviewRef: z.string(),
  peerReviewStatus: z.enum(["NOT_STARTED", "IN_PROGRESS", "COMPLETE"]),
  openFindingRefs: z.array(z.string()),
  approvalStatus: z.enum(["NOT_SUBMITTED", "IN_REVIEW", "APPROVED"]),
  approvedBy: z.string().optional(),
  approvalDate: z.string().optional(),
  releaseStatus: z.enum(["WORKING", "CONTROLLED", "SUPERSEDED"]),
  releaseDate: z.string().optional(),
  scopeLimitations: z.array(z.string()),
  basis: z.string(),
});

export const SeismicRiskIntegrationBaselineSchema = z.object({
  result: SeismicRiskIntegrationResultSchema,
  decisions: z.array(SeismicRiskDecisionSchema),
  traceabilityPaths: z.array(SeismicRiskTraceabilityPathSchema),
  baseline: SeismicControlledBaselineSchema,
});

export const SeismicPraPeerReviewBasisSchema = z.object({
  peerReviewIds: z.array(z.string()),
  systemsEngineeringCoverage: z.string(),
  seismicHazardCoverage: z.string(),
  seismicCapabilityCoverage: z.string(),
  seismicPraCoverage: z.string(),
  fragilityWalkdownExperienceCoverage: z.string(),
  methodologyReviewScope: z.string(),
  openFindingRefs: z.array(z.string()),
});

export const SeismicPraDocumentationSchema = z.object({
  overallProcessDescription: z.string(),
  shaSummary: z.string(),
  sfrSummary: z.string(),
  sprSummary: z.string(),
  subelementInterfaceDescription: z.string(),
  integratedResultsSummary: z.string(),
  integratedRiskInsights: z.string(),
  integratedUncertaintySummary: z.string(),
  preOperationalAndBoundingSiteLimitations: z.string().optional(),
  configurationControlDescription: z.string(),
  peerReviewBasis: SeismicPraPeerReviewBasisSchema,
  supportingDocumentRefs: z.array(z.string()),
  traceabilityMatrix: z.array(
    z.object({
      requirement: z.string(),
      subelement: SeismicPraSubelementSchema,
      dataRefs: z.array(z.string()),
      modelRefs: z.array(z.string()),
      resultRefs: z.array(z.string()),
      documentationRefs: z.array(z.string()),
    }),
  ),
});

export const SeismicPraExampleDocumentSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: z.enum(["doc", "sheet", "image"]),
  sizeLabel: z.string(),
  uploadedLabel: z.string(),
  extracted: z.string(),
  linked: z.number(),
  url: z.string().optional(),
});

export const SeismicPRASchema = z.object({
  ...technicalElementSchema(TechnicalElementTypes.SEISMIC_PRA).shape,
  praScope: z.string(),
  applications: z.array(SeismicPraApplicationSchema),
  evidenceRegister: z.array(SeismicPraEvidenceRecordSchema),
  baselinePra: BaselinePraDefinitionSchema.optional(),
  seismicHazardAnalysis: SeismicHazardAnalysisSchema,
  seismicFragilityAnalysis: SeismicFragilityAnalysisSchema,
  seismicPlantResponseAnalysis: SeismicPlantResponseAnalysisSchema,
  integration: SeismicPraIntegrationSchema,
  integratedUncertainties: z.array(IntegratedSeismicPraUncertaintySchema),
  integratedSensitivityStudies: z.array(SensitivityStudySchema),
  riskInterpretation: SeismicRiskInterpretationSchema.default({
    refinementActions: [],
    quantificationIterations: [],
    stoppingCriteria: {
      maximumAggregateFrequencyChange: 0.02,
      maximumFamilyFrequencyChange: 0.05,
      maximumContributorRankShift: 1,
      requiredStableIterations: 2,
      requireNoNewRiskSignificantContributors: true,
      basis: "",
    },
  }),
  riskIntegrationBaseline: SeismicRiskIntegrationBaselineSchema.default({
    result: {
      uuid: "",
      name: "Seismic risk integration handoff",
      modelVersion: "",
      plantOperatingStateRefs: [],
      unitRefs: [],
      radioactiveMaterialSourceRefs: [],
      initiatingEventRefs: [],
      eventSequenceFamilyRefs: [],
      releaseCategoryRefs: [],
      aggregateReleaseFamilyMeanFrequency: 0,
      frequencyUnit: "PER_PLANT_YEAR",
      internalEventsRiskRef: "",
      otherHazardRiskRefs: [],
      overlapTreatment: "",
      crossHazardIntegrationBasis: "",
      riskIntegrationResultRef: "",
      dominantContributorRefs: [],
      status: "DRAFT",
      implementsSrs: [],
    },
    decisions: [],
    traceabilityPaths: [],
    baseline: {
      uuid: "",
      name: "Controlled Seismic PRA baseline",
      modelVersion: "",
      configurationControlRecordId: "",
      quantificationRunRef: "",
      riskIntegrationHandoffRef: "",
      controlledDocumentRefs: [],
      peerReviewRef: "",
      peerReviewStatus: "NOT_STARTED",
      openFindingRefs: [],
      approvalStatus: "NOT_SUBMITTED",
      releaseStatus: "WORKING",
      scopeLimitations: [],
      basis: "",
    },
  }),
  modelUncertainty: BaseModelUncertaintyDocumentationSchema,
  preOperationalAssumptions: z.array(PreOperationalAssumptionSchema).optional(),
  documentation: SeismicPraDocumentationSchema,
  configurationControlRecordId: z.string().optional(),
  exampleDocuments: z.array(SeismicPraExampleDocumentSchema).optional(),
  newlyDevelopedMethodIds: z.array(z.string()).optional(),
});

type Expect<T extends true> = T;
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

type _AssertSeismicPraMirrorsType = Expect<Equal<z.infer<typeof SeismicPRASchema>, SeismicPRA>>;
