import { z } from "zod";
import type { InternalFloodFrequencyDataSet, InternalFloodFrequencyEstimate, InternalFloodInitiatingEvent, InternalFloodInitiatingEvents, InternalFloodMitigationFailureProbability, InternalFloodScenarioGroup } from "../../flev/internal-flood-initiating-events";
import { InternalFloodAnalysisRecordSchema, InternalFloodModelUncertaintySchema, InternalFloodPreOperationalAssumptionSchema, InternalFloodProcessDocumentationSchema, InternalFloodScreeningDecisionSchema } from "../internal-flood/internal-flood-pra-common";

export const InternalFloodScenarioGroupSchema = InternalFloodAnalysisRecordSchema.extend({
  floodScenarioRefs: z.array(z.string()),
  groupingBasis: z.enum(["SIMILAR_PLANT_RESPONSE", "COMMON_SUCCESS_CRITERIA", "SIMILAR_TIMING", "COMMON_TARGET_SET", "BOUNDING_CONSEQUENCE", "OTHER"]),
  boundingScenarioRef: z.string().optional(), plantOperatingStateRefs: z.array(z.string()), reactorUnitRefs: z.array(z.string()),
  radioactiveMaterialSourceRefs: z.array(z.string()), commonInitiatingEventRef: z.string().optional(), commonFailureAndHumanEffects: z.string(), groupingValidityChecks: z.array(z.string()),
});

export const InternalFloodInitiatingEventSchema = InternalFloodAnalysisRecordSchema.extend({
  scenarioGroupRef: z.string(), baselineInitiatingEventRef: z.string().optional(),
  initiatingEventType: z.enum(["TRANSIENT", "LOSS_OF_COOLING", "LOSS_OF_POWER", "LOSS_OF_HEAT_SINK", "REACTIVITY_EVENT", "MULTI_UNIT_EVENT", "NEW_FLOOD_INITIATOR", "OTHER"]),
  newInitiatingEventRequired: z.boolean(), initiatingEventDefinition: z.string(), affectedPlantOperatingStateRefs: z.array(z.string()),
  affectedReactorUnitRefs: z.array(z.string()), affectedRadioactiveMaterialSourceRefs: z.array(z.string()), floodFailedSscRefs: z.array(z.string()), affectedEventSequenceRefs: z.array(z.string()),
});

export const InternalFloodFrequencyDataSetSchema = InternalFloodAnalysisRecordSchema.extend({
  dataType: z.enum(["GENERIC_PIPE_FAILURE", "PLANT_SPECIFIC_EVENT", "DESIGN_SPECIFIC_EVENT", "MAINTENANCE_EVENT", "MITIGATION_FAILURE", "OTHER"]),
  sourcePopulation: z.string(), applicableSystemRefs: z.array(z.string()), applicableFailureMechanisms: z.array(z.string()), eventCount: z.number(), exposure: z.number(),
  exposureUnit: z.enum(["COMPONENT_YEAR", "WELD_YEAR", "PLANT_YEAR", "MAINTENANCE_HOUR", "DEMAND"]), ageAdjustmentModel: z.string().optional(),
  meanRate: z.number(), rateUnit: z.string(), distribution: z.enum(["BETA", "GAMMA", "LOGNORMAL", "POINT_ESTIMATE", "EMPIRICAL"]),
  distributionParameters: z.record(z.string(), z.number()), applicabilityAssessment: z.string(),
});

export const InternalFloodMitigationFailureProbabilitySchema = InternalFloodAnalysisRecordSchema.extend({
  mitigationFeatureRef: z.string(), failureMode: z.string(), demandContext: z.string(), failureProbability: z.number(), lowerBound: z.number(), upperBound: z.number(),
  dataSetRefs: z.array(z.string()), systemModelBasicEventRef: z.string().optional(), humanFailureEventRef: z.string().optional(), dependencyTreatment: z.string(),
});

export const InternalFloodFrequencyEstimateSchema = InternalFloodAnalysisRecordSchema.extend({
  floodScenarioGroupRef: z.string(), initiatingEventRef: z.string(), sourceFailureRatePerYear: z.number(), operatingStateExposureFraction: z.number(),
  locationAllocationFactor: z.number(), breakSizeAllocationFactor: z.number(), maintenanceContributionPerYear: z.number(), mitigationFailureProbabilityRefs: z.array(z.string()),
  scenarioSpecificHepRefs: z.array(z.string()), meanFrequencyPerPlantYear: z.number(), fifthPercentileFrequencyPerPlantYear: z.number(), ninetyFifthPercentileFrequencyPerPlantYear: z.number(),
  calculationExpression: z.string(), calculationRef: z.string(), dataSetRefs: z.array(z.string()),
});

export const InternalFloodInitiatingEventsSchema = z.object({
  scenarioGroups: z.array(InternalFloodScenarioGroupSchema), initiatingEvents: z.array(InternalFloodInitiatingEventSchema), frequencyDataSets: z.array(InternalFloodFrequencyDataSetSchema),
  mitigationFailureProbabilities: z.array(InternalFloodMitigationFailureProbabilitySchema), frequencyEstimates: z.array(InternalFloodFrequencyEstimateSchema), screeningDecisions: z.array(InternalFloodScreeningDecisionSchema),
  modelUncertainties: z.array(InternalFloodModelUncertaintySchema), preOperationalAssumptions: z.array(InternalFloodPreOperationalAssumptionSchema), documentation: InternalFloodProcessDocumentationSchema,
});

type Expect<T extends true> = T;
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type _Group = Expect<Equal<z.infer<typeof InternalFloodScenarioGroupSchema>, InternalFloodScenarioGroup>>;
type _Initiator = Expect<Equal<z.infer<typeof InternalFloodInitiatingEventSchema>, InternalFloodInitiatingEvent>>;
type _Data = Expect<Equal<z.infer<typeof InternalFloodFrequencyDataSetSchema>, InternalFloodFrequencyDataSet>>;
type _Mitigation = Expect<Equal<z.infer<typeof InternalFloodMitigationFailureProbabilitySchema>, InternalFloodMitigationFailureProbability>>;
type _Frequency = Expect<Equal<z.infer<typeof InternalFloodFrequencyEstimateSchema>, InternalFloodFrequencyEstimate>>;
type _Aggregate = Expect<Equal<z.infer<typeof InternalFloodInitiatingEventsSchema>, InternalFloodInitiatingEvents>>;
