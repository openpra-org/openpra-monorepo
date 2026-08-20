import { z } from "zod";
import type { InternalFloodEventSequenceFamilyResult, InternalFloodEventSequenceQuantification, InternalFloodQuantificationDependency, InternalFloodQuantificationRun, InternalFloodQuantificationTraceability, InternalFloodQuantificationUncertaintyResult, InternalFloodRiskContributor, InternalFloodSensitivityStudy } from "../../flesq/internal-flood-event-sequence-quantification";
import { InternalFloodAnalysisRecordSchema, InternalFloodModelUncertaintySchema, InternalFloodPreOperationalAssumptionSchema, InternalFloodProcessDocumentationSchema } from "../internal-flood/internal-flood-pra-common";

export const InternalFloodQuantificationRunSchema = InternalFloodAnalysisRecordSchema.extend({
  modelVersion: z.string(), calculationDate: z.string(), initiatingEventRefs: z.array(z.string()), eventSequenceModelRefs: z.array(z.string()), humanFailureEventRefs: z.array(z.string()),
  mitigationFailureRefs: z.array(z.string()), independentFailureModelRef: z.string(), commonCauseFailureModelRef: z.string(), maintenanceUnavailabilityModelRef: z.string(),
  modelOrCode: z.string(), solverVersion: z.string(), truncationLimitPerPlantYear: z.number(), sampleCount: z.number(), randomSeed: z.number().optional(),
  convergenceMetric: z.number(), convergenceCriterion: z.number(), converged: z.boolean(), verificationChecks: z.array(z.string()),
});

export const InternalFloodEventSequenceFamilyResultSchema = InternalFloodAnalysisRecordSchema.extend({
  quantificationRunRef: z.string(), eventSequenceFamilyRef: z.string(), initiatingEventRef: z.string(), floodScenarioGroupRefs: z.array(z.string()), releaseCategoryRef: z.string(),
  plantOperatingStateRefs: z.array(z.string()), reactorUnitRefs: z.array(z.string()), radioactiveMaterialSourceRefs: z.array(z.string()), meanFrequencyPerPlantYear: z.number(),
  medianFrequencyPerPlantYear: z.number(), fifthPercentileFrequencyPerPlantYear: z.number(), ninetyFifthPercentileFrequencyPerPlantYear: z.number(), conditionalSequenceProbability: z.number(),
  dominantCutsetRefs: z.array(z.string()), screened: z.boolean(), screeningDecisionRef: z.string().optional(),
});

export const InternalFloodQuantificationDependencySchema = InternalFloodAnalysisRecordSchema.extend({
  quantificationRunRef: z.string(), dependencyType: z.enum(["SPATIAL", "FUNCTIONAL", "COMMON_CAUSE", "HUMAN", "MAINTENANCE", "SHARED_SUPPORT", "OTHER"]),
  dependentEventRefs: z.array(z.string()), affectedScenarioGroupRefs: z.array(z.string()), treatment: z.string(), correlationCoefficient: z.number().optional(),
  jointProbability: z.number().optional(), modelImplementationRef: z.string(), verification: z.string(),
});

export const InternalFloodRiskContributorSchema = InternalFloodAnalysisRecordSchema.extend({
  quantificationRunRef: z.string(), contributorType: z.enum(["PLANT_OPERATING_STATE", "INITIATING_EVENT", "EVENT_SEQUENCE", "BASIC_EVENT", "FLOOD_AREA", "FLOOD_SOURCE", "FLOOD_SCENARIO", "FLOOD_PHENOMENON", "SSC", "HUMAN_ACTION", "OTHER"]),
  contributorRef: z.string(), affectedEventSequenceFamilyRefs: z.array(z.string()), absoluteFrequencyContributionPerPlantYear: z.number(), fractionalContribution: z.number(),
  fussellVesely: z.number().optional(), riskAchievementWorth: z.number().optional(), riskReductionWorth: z.number().optional(), riskSignificant: z.boolean(), ranking: z.number(),
});

export const InternalFloodQuantificationUncertaintyResultSchema = InternalFloodAnalysisRecordSchema.extend({
  quantificationRunRef: z.string(), uncertaintySourceRefs: z.array(z.string()), affectedEventSequenceFamilyRefs: z.array(z.string()), propagationMethod: z.string(), distributionSummary: z.string(),
  meanFrequencyPerPlantYear: z.number(), fifthPercentileFrequencyPerPlantYear: z.number(), ninetyFifthPercentileFrequencyPerPlantYear: z.number(), dependencyAndCorrelationTreatment: z.string(), operatingStateChangeImpact: z.string(),
});

export const InternalFloodSensitivityStudySchema = InternalFloodAnalysisRecordSchema.extend({
  quantificationRunRef: z.string(), variedInputRefs: z.array(z.string()), alternativeModel: z.string(), baselineFrequencyPerPlantYear: z.number(), sensitivityFrequencyPerPlantYear: z.number(),
  relativeChange: z.number(), changedContributorRankings: z.array(z.string()), conclusion: z.string(),
});

export const InternalFloodQuantificationTraceabilitySchema = InternalFloodAnalysisRecordSchema.extend({
  evidenceRefs: z.array(z.string()), floodAreaRefs: z.array(z.string()), floodSourceRefs: z.array(z.string()), floodScenarioRefs: z.array(z.string()), initiatingEventRefs: z.array(z.string()),
  plantModelRefs: z.array(z.string()), humanFailureEventRefs: z.array(z.string()), eventSequenceFamilyRefs: z.array(z.string()), quantificationResultRefs: z.array(z.string()), riskContributorRefs: z.array(z.string()), complete: z.boolean(),
});

export const InternalFloodEventSequenceQuantificationSchema = z.object({
  quantificationRuns: z.array(InternalFloodQuantificationRunSchema), eventSequenceFamilyResults: z.array(InternalFloodEventSequenceFamilyResultSchema),
  dependencies: z.array(InternalFloodQuantificationDependencySchema), riskContributors: z.array(InternalFloodRiskContributorSchema), uncertaintyResults: z.array(InternalFloodQuantificationUncertaintyResultSchema),
  sensitivityStudies: z.array(InternalFloodSensitivityStudySchema), traceability: z.array(InternalFloodQuantificationTraceabilitySchema), modelUncertainties: z.array(InternalFloodModelUncertaintySchema),
  preOperationalAssumptions: z.array(InternalFloodPreOperationalAssumptionSchema), documentation: InternalFloodProcessDocumentationSchema,
});

type Expect<T extends true> = T;
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type _Run = Expect<Equal<z.infer<typeof InternalFloodQuantificationRunSchema>, InternalFloodQuantificationRun>>;
type _Result = Expect<Equal<z.infer<typeof InternalFloodEventSequenceFamilyResultSchema>, InternalFloodEventSequenceFamilyResult>>;
type _Dependency = Expect<Equal<z.infer<typeof InternalFloodQuantificationDependencySchema>, InternalFloodQuantificationDependency>>;
type _Contributor = Expect<Equal<z.infer<typeof InternalFloodRiskContributorSchema>, InternalFloodRiskContributor>>;
type _Uncertainty = Expect<Equal<z.infer<typeof InternalFloodQuantificationUncertaintyResultSchema>, InternalFloodQuantificationUncertaintyResult>>;
type _Sensitivity = Expect<Equal<z.infer<typeof InternalFloodSensitivityStudySchema>, InternalFloodSensitivityStudy>>;
type _Trace = Expect<Equal<z.infer<typeof InternalFloodQuantificationTraceabilitySchema>, InternalFloodQuantificationTraceability>>;
type _Aggregate = Expect<Equal<z.infer<typeof InternalFloodEventSequenceQuantificationSchema>, InternalFloodEventSequenceQuantification>>;
