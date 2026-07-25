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
  seismicHazardAnalysis: SeismicHazardAnalysisSchema,
  seismicFragilityAnalysis: SeismicFragilityAnalysisSchema,
  seismicPlantResponseAnalysis: SeismicPlantResponseAnalysisSchema,
  integration: SeismicPraIntegrationSchema,
  integratedUncertainties: z.array(IntegratedSeismicPraUncertaintySchema),
  integratedSensitivityStudies: z.array(SensitivityStudySchema),
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
