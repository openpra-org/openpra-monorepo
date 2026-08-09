import { z } from "zod";
import type { InternalFloodHepEstimate, InternalFloodHumanAction, InternalFloodHumanActionTiming, InternalFloodHumanDependencyGroup, InternalFloodHumanFailureEvent, InternalFloodHumanPerformanceContext, InternalFloodHumanReliabilityAnalysis } from "../../flhr/internal-flood-human-reliability-analysis";
import { InternalFloodAnalysisRecordSchema, InternalFloodInvestigationSchema, InternalFloodModelUncertaintySchema, InternalFloodPreOperationalAssumptionSchema, InternalFloodProcessDocumentationSchema } from "../internal-flood/internal-flood-pra-common";

export const InternalFloodHumanActionSchema = InternalFloodAnalysisRecordSchema.extend({
  actionType: z.enum(["PRE_INITIATOR", "POST_INITIATOR", "RECOVERY", "UNDESIRED_ACTION"]), baselineHumanActionRef: z.string().optional(),
  floodScenarioGroupRefs: z.array(z.string()), eventSequenceRefs: z.array(z.string()), procedureRefs: z.array(z.string()), crew: z.string(), actionLocation: z.string(),
  equipmentRefs: z.array(z.string()), cues: z.array(z.string()), floodInducedCueFailures: z.array(z.string()), requiredOutcome: z.string(), retained: z.boolean(),
});

export const InternalFloodHumanFailureEventSchema = InternalFloodAnalysisRecordSchema.extend({
  humanActionRef: z.string(), basicEventRef: z.string(), failureDefinition: z.string(), scenarioContext: z.string(), affectedEventSequenceRefs: z.array(z.string()),
  floodAreaRefs: z.array(z.string()), plantOperatingStateRefs: z.array(z.string()), reactorUnitRefs: z.array(z.string()), radioactiveMaterialSourceRefs: z.array(z.string()),
});

export const InternalFloodHumanPerformanceContextSchema = InternalFloodAnalysisRecordSchema.extend({
  humanFailureEventRef: z.string(), diagnosisComplexity: z.enum(["LOW", "MODERATE", "HIGH"]), cueQuality: z.enum(["CLEAR", "DEGRADED", "FAILED"]),
  procedureQuality: z.enum(["GOOD", "ADEQUATE", "POOR"]), trainingAndExperience: z.string(), staffingAndWorkload: z.string(), communication: z.string(),
  accessRouteRefs: z.array(z.string()), maximumRouteWaterDepthMetres: z.number(), sprayExposure: z.string(), ambientTemperatureCelsius: z.number(), lighting: z.string(),
  personalProtectiveEquipment: z.string(), stressAndTimePressure: z.string(), otherPerformanceShapingFactors: z.array(z.string()),
});

export const InternalFloodHumanActionTimingSchema = InternalFloodAnalysisRecordSchema.extend({
  humanFailureEventRef: z.string(), cueAvailableMinutes: z.number(), damageOrDeadlineMinutes: z.number(), diagnosisMinutes: z.number(), travelMinutes: z.number(),
  executionMinutes: z.number(), contingencyMinutes: z.number(), totalRequiredMinutes: z.number(), marginMinutes: z.number(), feasible: z.boolean(),
  feasibilityInvestigationRef: z.string().optional(), routeAndExecutionBasis: z.string(),
});

export const InternalFloodHepEstimateSchema = InternalFloodAnalysisRecordSchema.extend({
  humanFailureEventRef: z.string(), method: z.string(), nominalHep: z.number(), meanHep: z.number(), fifthPercentileHep: z.number(), ninetyFifthPercentileHep: z.number(),
  timingAssessmentRef: z.string(), performanceContextRef: z.string(), recoveryCredit: z.boolean(), recoveryActionRef: z.string().optional(),
  quantificationInputs: z.record(z.string(), z.number()), calculationRef: z.string(),
});

export const InternalFloodHumanDependencyGroupSchema = InternalFloodAnalysisRecordSchema.extend({
  humanFailureEventRefs: z.array(z.string()), dependencyLevel: z.enum(["ZERO", "LOW", "MODERATE", "HIGH", "COMPLETE"]), commonCrew: z.boolean(), commonCue: z.boolean(),
  commonProcedure: z.boolean(), commonLocationOrRoute: z.boolean(), timeSeparationMinutes: z.number(), dependencyBasis: z.string(), jointFailureProbability: z.number(), quantificationTreatment: z.string(),
});

export const InternalFloodHumanReliabilityAnalysisSchema = z.object({
  humanActions: z.array(InternalFloodHumanActionSchema), humanFailureEvents: z.array(InternalFloodHumanFailureEventSchema), performanceContexts: z.array(InternalFloodHumanPerformanceContextSchema),
  timingAssessments: z.array(InternalFloodHumanActionTimingSchema), hepEstimates: z.array(InternalFloodHepEstimateSchema), dependencyGroups: z.array(InternalFloodHumanDependencyGroupSchema),
  investigations: z.array(InternalFloodInvestigationSchema),
  modelUncertainties: z.array(InternalFloodModelUncertaintySchema), preOperationalAssumptions: z.array(InternalFloodPreOperationalAssumptionSchema), documentation: InternalFloodProcessDocumentationSchema,
});

type Expect<T extends true> = T;
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type _Action = Expect<Equal<z.infer<typeof InternalFloodHumanActionSchema>, InternalFloodHumanAction>>;
type _Hfe = Expect<Equal<z.infer<typeof InternalFloodHumanFailureEventSchema>, InternalFloodHumanFailureEvent>>;
type _Context = Expect<Equal<z.infer<typeof InternalFloodHumanPerformanceContextSchema>, InternalFloodHumanPerformanceContext>>;
type _Timing = Expect<Equal<z.infer<typeof InternalFloodHumanActionTimingSchema>, InternalFloodHumanActionTiming>>;
type _Hep = Expect<Equal<z.infer<typeof InternalFloodHepEstimateSchema>, InternalFloodHepEstimate>>;
type _Dependency = Expect<Equal<z.infer<typeof InternalFloodHumanDependencyGroupSchema>, InternalFloodHumanDependencyGroup>>;
type _Aggregate = Expect<Equal<z.infer<typeof InternalFloodHumanReliabilityAnalysisSchema>, InternalFloodHumanReliabilityAnalysis>>;
