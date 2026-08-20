import { z } from "zod";
import type { InternalFloodEventSequenceModel, InternalFloodMissionTimeAssessment, InternalFloodPeerReviewFindingDisposition, InternalFloodPlantResponseModel, InternalFloodPlantResponseResult, InternalFloodSuccessCriterion, InternalFloodSystemModelModification } from "../../flpr/internal-flood-plant-response-model";
import { InternalFloodAnalysisRecordSchema, InternalFloodModelUncertaintySchema, InternalFloodPreOperationalAssumptionSchema, InternalFloodProcessDocumentationSchema } from "../internal-flood/internal-flood-pra-common";

export const InternalFloodPlantResponseResultSchema = InternalFloodAnalysisRecordSchema.extend({
  floodScenarioGroupRef: z.string(), eventSequenceFamilyRefs: z.array(z.string()), conditionalSequenceFamilyProbability: z.number(),
  annualSequenceFamilyFrequency: z.number(), releaseCategoryRefs: z.array(z.string()), riskSignificantContributorRefs: z.array(z.string()), quantificationRef: z.string(),
});

export const InternalFloodEventSequenceModelSchema = InternalFloodAnalysisRecordSchema.extend({
  initiatingEventRef: z.string(), baselineEventSequenceRefs: z.array(z.string()), modelTreatment: z.enum(["REUSED", "MODIFIED", "NEW"]),
  sequenceFamilyRefs: z.array(z.string()), floodScenarioGroupRefs: z.array(z.string()), affectedReactorUnitRefs: z.array(z.string()), affectedRadioactiveMaterialSourceRefs: z.array(z.string()),
  topEvents: z.array(z.object({ uuid: z.string(), name: z.string(), successBranch: z.string(), failureBranch: z.string(), modelRef: z.string() })),
  endStates: z.array(z.object({ name: z.string(), releaseCategoryRef: z.string(), disposition: z.string() })), multiUnitOrSourceLogic: z.string(),
});

export const InternalFloodSuccessCriterionSchema = InternalFloodAnalysisRecordSchema.extend({
  function: z.string(), initiatingEventRefs: z.array(z.string()), eventSequenceRefs: z.array(z.string()), requiredSystemTrainRefs: z.array(z.string()),
  requiredSscRefs: z.array(z.string()), requiredOperatorActionRefs: z.array(z.string()), successDefinition: z.string(), analysisMethod: z.string(), analysisRef: z.string(),
  plantOperatingStateRefs: z.array(z.string()), missionTimeHours: z.number(),
});

export const InternalFloodSystemModelModificationSchema = InternalFloodAnalysisRecordSchema.extend({
  systemRef: z.string(), baselineModelRef: z.string(), treatment: z.enum(["REUSED", "MODIFIED", "NEW"]), floodScenarioGroupRefs: z.array(z.string()), floodFailedSscRefs: z.array(z.string()),
  addedBasicEvents: z.array(z.object({ uuid: z.string(), name: z.string(), probability: z.number(), failureMechanism: z.string(), sourceRef: z.string() })),
  modifiedLogic: z.string(), isolationAndRecoveryLogic: z.string(), sharedDependencyRefs: z.array(z.string()), consequentialHazardRefs: z.array(z.string()), verification: z.string(),
});

export const InternalFloodMissionTimeAssessmentSchema = InternalFloodAnalysisRecordSchema.extend({
  successCriterionRef: z.string(), systemModelRef: z.string(), baselineMissionTimeHours: z.number(), floodMissionTimeHours: z.number(), timingDriver: z.string(),
  thermalHydraulicOrProcessBasis: z.string(), adequate: z.boolean(), modelChangeRefs: z.array(z.string()),
});

export const InternalFloodPeerReviewFindingDispositionSchema = InternalFloodAnalysisRecordSchema.extend({
  sourceReviewRef: z.string(), findingId: z.string(), affectedBaselineModelRefs: z.array(z.string()), internalFloodImpact: z.string(),
  disposition: z.enum(["NO_IMPACT", "MODEL_UPDATED", "OPEN"]), modelChangeRefs: z.array(z.string()), closureEvidenceRefs: z.array(z.string()),
});

export const InternalFloodPlantResponseModelSchema = z.object({
  plantResponseResults: z.array(InternalFloodPlantResponseResultSchema), eventSequenceModels: z.array(InternalFloodEventSequenceModelSchema),
  successCriteria: z.array(InternalFloodSuccessCriterionSchema), systemModelModifications: z.array(InternalFloodSystemModelModificationSchema),
  missionTimeAssessments: z.array(InternalFloodMissionTimeAssessmentSchema), peerReviewFindingDispositions: z.array(InternalFloodPeerReviewFindingDispositionSchema),
  modelUncertainties: z.array(InternalFloodModelUncertaintySchema), preOperationalAssumptions: z.array(InternalFloodPreOperationalAssumptionSchema), documentation: InternalFloodProcessDocumentationSchema,
});

type Expect<T extends true> = T;
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type _Result = Expect<Equal<z.infer<typeof InternalFloodPlantResponseResultSchema>, InternalFloodPlantResponseResult>>;
type _Sequence = Expect<Equal<z.infer<typeof InternalFloodEventSequenceModelSchema>, InternalFloodEventSequenceModel>>;
type _Criterion = Expect<Equal<z.infer<typeof InternalFloodSuccessCriterionSchema>, InternalFloodSuccessCriterion>>;
type _System = Expect<Equal<z.infer<typeof InternalFloodSystemModelModificationSchema>, InternalFloodSystemModelModification>>;
type _Mission = Expect<Equal<z.infer<typeof InternalFloodMissionTimeAssessmentSchema>, InternalFloodMissionTimeAssessment>>;
type _Finding = Expect<Equal<z.infer<typeof InternalFloodPeerReviewFindingDispositionSchema>, InternalFloodPeerReviewFindingDisposition>>;
type _Aggregate = Expect<Equal<z.infer<typeof InternalFloodPlantResponseModelSchema>, InternalFloodPlantResponseModel>>;
