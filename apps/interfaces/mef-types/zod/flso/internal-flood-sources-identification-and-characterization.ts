import { z } from "zod";
import type { InternalFloodReleaseCharacterization, InternalFloodSource, InternalFloodSourceFailureMechanism, InternalFloodSourcesIdentificationAndCharacterization } from "../../flso/internal-flood-sources-identification-and-characterization";
import { InternalFloodAnalysisRecordSchema, InternalFloodInvestigationSchema, InternalFloodModelUncertaintySchema, InternalFloodPreOperationalAssumptionSchema, InternalFloodProcessDocumentationSchema, InternalFloodScreeningDecisionSchema } from "../internal-flood/internal-flood-pra-common";

export const InternalFloodSourceSchema = InternalFloodAnalysisRecordSchema.extend({
  sourceType: z.enum(["PIPE", "TANK", "VESSEL", "POOL", "HEAT_EXCHANGER", "HOSE", "FIRE_SUPPRESSION", "EXTERNAL_CONNECTION", "OTHER"]),
  systemRef: z.string(),
  floodAreaRef: z.string(),
  connectedFloodAreaRefs: z.array(z.string()),
  fluid: z.enum(["WATER", "STEAM", "SODIUM", "OIL", "CHEMICAL", "GAS_CONDENSATE", "OTHER"]),
  inventoryCubicMetres: z.number().optional(),
  operatingPressureKpa: z.number(),
  operatingTemperatureCelsius: z.number(),
  nominalDiameterMillimetres: z.number().optional(),
  material: z.string(),
  ageYears: z.number().optional(),
  isolationRefs: z.array(z.string()),
  plantOperatingStateRefs: z.array(z.string()),
  reactorUnitRefs: z.array(z.string()),
  radioactiveMaterialSourceRefs: z.array(z.string()),
  maintenanceExposureHoursPerYear: z.number().optional(),
  investigationRefs: z.array(z.string()),
  spatialLocationConfirmed: z.boolean(),
});

export const InternalFloodSourceFailureMechanismSchema = InternalFloodAnalysisRecordSchema.extend({
  sourceRef: z.string(),
  mechanism: z.enum(["LEAK", "RUPTURE", "SPRAY", "OVERFLOW", "DRAIN_DOWN", "OPERATOR_ERROR", "MAINTENANCE_ERROR", "FIRE_SUPPRESSION_ACTUATION", "OTHER"]),
  breachType: z.enum(["PINHOLE", "CRACK", "PARTIAL_BREAK", "FULL_BREAK", "OPEN_END", "OVERFLOW", "OTHER"]),
  breachAreaSquareMillimetres: z.number().optional(),
  credibleCauses: z.array(z.string()),
  consequentialEffects: z.array(z.string()),
  applicablePlantOperatingStateRefs: z.array(z.string()),
});

export const InternalFloodReleaseCharacterizationSchema = InternalFloodAnalysisRecordSchema.extend({
  sourceRef: z.string(),
  failureMechanismRef: z.string(),
  releaseRateCubicMetresPerMinute: z.number(),
  minimumReleaseRateCubicMetresPerMinute: z.number(),
  maximumReleaseRateCubicMetresPerMinute: z.number(),
  availableInventoryCubicMetres: z.number(),
  unisolatedDurationMinutes: z.number(),
  releasedVolumeCubicMetres: z.number(),
  fluidTemperatureCelsius: z.number(),
  dischargePressureKpa: z.number(),
  isolationSignal: z.string(),
  isolationTimeMinutes: z.number().optional(),
  releaseCalculationRef: z.string(),
  uncertaintyTreatment: z.string(),
});

export const InternalFloodSourcesIdentificationAndCharacterizationSchema = z.object({
  sources: z.array(InternalFloodSourceSchema),
  failureMechanisms: z.array(InternalFloodSourceFailureMechanismSchema),
  releaseCharacterizations: z.array(InternalFloodReleaseCharacterizationSchema),
  sourceScreeningDecisions: z.array(InternalFloodScreeningDecisionSchema),
  investigations: z.array(InternalFloodInvestigationSchema),
  modelUncertainties: z.array(InternalFloodModelUncertaintySchema),
  preOperationalAssumptions: z.array(InternalFloodPreOperationalAssumptionSchema),
  documentation: InternalFloodProcessDocumentationSchema,
});

type Expect<T extends true> = T;
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type _Source = Expect<Equal<z.infer<typeof InternalFloodSourceSchema>, InternalFloodSource>>;
type _Failure = Expect<Equal<z.infer<typeof InternalFloodSourceFailureMechanismSchema>, InternalFloodSourceFailureMechanism>>;
type _Release = Expect<Equal<z.infer<typeof InternalFloodReleaseCharacterizationSchema>, InternalFloodReleaseCharacterization>>;
type _Aggregate = Expect<Equal<z.infer<typeof InternalFloodSourcesIdentificationAndCharacterizationSchema>, InternalFloodSourcesIdentificationAndCharacterization>>;
