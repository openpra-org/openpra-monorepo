import { z } from "zod";
import type { InternalFloodHydraulicCalculation, InternalFloodHydraulicTimePoint, InternalFloodMitigationFeature, InternalFloodPropagationPath, InternalFloodScenario, InternalFloodScenariosDevelopment, InternalFloodSscSusceptibility } from "../../flsn/internal-flood-scenarios-development";
import { InternalFloodAnalysisRecordSchema, InternalFloodInvestigationSchema, InternalFloodModelUncertaintySchema, InternalFloodPreOperationalAssumptionSchema, InternalFloodProcessDocumentationSchema, InternalFloodScreeningDecisionSchema } from "../internal-flood/internal-flood-pra-common";

export const InternalFloodPropagationPathSchema = InternalFloodAnalysisRecordSchema.extend({
  originFloodAreaRef: z.string(), destinationFloodAreaRef: z.string(),
  pathType: z.enum(["DOOR_GAP", "PENETRATION", "STAIRWELL", "HATCH", "DRAIN", "BACKFLOW", "HVAC", "GRATE", "SEAL_FAILURE", "STRUCTURAL_FAILURE", "OTHER"]),
  openingAreaSquareMetres: z.number(), invertElevationMetres: z.number(), activationHeadMetres: z.number(),
  flowCapacityCubicMetresPerMinute: z.number(), travelTimeMinutes: z.number(), direction: z.enum(["ONE_WAY", "BIDIRECTIONAL"]),
  barrierRef: z.string().optional(), structuralFailurePossible: z.boolean(), operatingStateDependencies: z.array(z.string()), investigationRefs: z.array(z.string()),
});

export const InternalFloodMitigationFeatureSchema = InternalFloodAnalysisRecordSchema.extend({
  floodAreaRef: z.string(),
  featureType: z.enum(["ALARM", "DIKE", "CURB", "WATERTIGHT_DOOR", "BARRIER", "DRAIN", "SUMP", "PUMP", "SHIELD", "BLOWOUT_PANEL", "DAMPER", "ISOLATION", "OTHER"]),
  credited: z.boolean(), passive: z.boolean(), designCapacity: z.number(), capacityUnit: z.string(), actuationOrAvailabilityBasis: z.string(),
  dependentPowerRefs: z.array(z.string()), dependentHumanActionRefs: z.array(z.string()), failureModeRefs: z.array(z.string()),
  surveillanceOrTestRef: z.string(), plantOperatingStateRefs: z.array(z.string()),
});

export const InternalFloodSscSusceptibilitySchema = InternalFloodAnalysisRecordSchema.extend({
  sscRef: z.string(), floodAreaRef: z.string(), creditedFunctions: z.array(z.string()),
  failureMechanisms: z.array(z.enum(["SUBMERGENCE", "SPRAY", "HUMIDITY", "CONDENSATION", "JET_IMPINGEMENT", "PIPE_WHIP", "TEMPERATURE", "PRESSURE", "CHEMICAL_REACTION", "OTHER"])),
  lowestDamageElevationMetres: z.number().optional(), sprayExposure: z.string(), qualifiedTemperatureCelsius: z.number().optional(),
  qualifiedPressureKpa: z.number().optional(), operabilityBasis: z.enum(["TEST", "ANALYSIS", "EXPERT_JUDGMENT", "COMBINATION"]),
  operabilityEvidenceRefs: z.array(z.string()), failureBasicEventRefs: z.array(z.string()), mitigationFeatureRefs: z.array(z.string()),
});

export const InternalFloodHydraulicTimePointSchema = z.object({
  elapsedMinutes: z.number(), floodHeightMetres: z.number(), floodedVolumeCubicMetres: z.number(),
  inflowCubicMetresPerMinute: z.number(), drainageCubicMetresPerMinute: z.number(),
});

export const InternalFloodHydraulicCalculationSchema = InternalFloodAnalysisRecordSchema.extend({
  floodScenarioRef: z.string(), floodAreaRef: z.string(), sourceReleaseRef: z.string(), propagationPathRefs: z.array(z.string()),
  mitigationFeatureRefs: z.array(z.string()), initialInventoryCubicMetres: z.number(), totalReleasedVolumeCubicMetres: z.number(),
  maximumFloodHeightMetres: z.number(), timeToMaximumHeightMinutes: z.number(), timeToCriticalDamageMinutes: z.number().optional(),
  occupancyAndFreeVolumeBasis: z.string(), calculationMethod: z.string(), modelOrCode: z.string(), timeHistory: z.array(InternalFloodHydraulicTimePointSchema), verification: z.string(),
});

export const InternalFloodScenarioSchema = InternalFloodAnalysisRecordSchema.extend({
  scenarioId: z.string(), sourceRef: z.string(), sourceFailureMechanismRef: z.string(), releaseCharacterizationRef: z.string(),
  originFloodAreaRef: z.string(), affectedFloodAreaRefs: z.array(z.string()), propagationPathRefs: z.array(z.string()), mitigationFeatureRefs: z.array(z.string()),
  hydraulicCalculationRefs: z.array(z.string()), affectedSscSusceptibilityRefs: z.array(z.string()), failedSscRefs: z.array(z.string()),
  initiatingEventCandidate: z.string(), automaticResponseRefs: z.array(z.string()), operatorActionRefs: z.array(z.string()),
  plantOperatingStateRefs: z.array(z.string()), reactorUnitRefs: z.array(z.string()), radioactiveMaterialSourceRefs: z.array(z.string()),
  chemicalOrPhysicalInteraction: z.string(), limitingOrBoundingBasis: z.string(), disposition: z.enum(["RETAINED", "SCREENED", "GROUPED"]),
});

export const InternalFloodScenariosDevelopmentSchema = z.object({
  propagationPaths: z.array(InternalFloodPropagationPathSchema), mitigationFeatures: z.array(InternalFloodMitigationFeatureSchema),
  sscSusceptibilities: z.array(InternalFloodSscSusceptibilitySchema), hydraulicCalculations: z.array(InternalFloodHydraulicCalculationSchema),
  floodScenarios: z.array(InternalFloodScenarioSchema), screeningDecisions: z.array(InternalFloodScreeningDecisionSchema),
  investigations: z.array(InternalFloodInvestigationSchema), modelUncertainties: z.array(InternalFloodModelUncertaintySchema),
  preOperationalAssumptions: z.array(InternalFloodPreOperationalAssumptionSchema), documentation: InternalFloodProcessDocumentationSchema,
});

type Expect<T extends true> = T;
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type _Path = Expect<Equal<z.infer<typeof InternalFloodPropagationPathSchema>, InternalFloodPropagationPath>>;
type _Mitigation = Expect<Equal<z.infer<typeof InternalFloodMitigationFeatureSchema>, InternalFloodMitigationFeature>>;
type _Ssc = Expect<Equal<z.infer<typeof InternalFloodSscSusceptibilitySchema>, InternalFloodSscSusceptibility>>;
type _Time = Expect<Equal<z.infer<typeof InternalFloodHydraulicTimePointSchema>, InternalFloodHydraulicTimePoint>>;
type _Calculation = Expect<Equal<z.infer<typeof InternalFloodHydraulicCalculationSchema>, InternalFloodHydraulicCalculation>>;
type _Scenario = Expect<Equal<z.infer<typeof InternalFloodScenarioSchema>, InternalFloodScenario>>;
type _Aggregate = Expect<Equal<z.infer<typeof InternalFloodScenariosDevelopmentSchema>, InternalFloodScenariosDevelopment>>;
