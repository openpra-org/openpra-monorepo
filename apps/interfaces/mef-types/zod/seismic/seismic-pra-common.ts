import { z } from "zod";
import type {
  FragilityCorrelationGroup,
  SeismicEquipmentListEntry,
  SeismicFailureMode,
  SeismicPraInterfaceRecord,
} from "../../seismic/seismic-pra-common";
import { SRReferenceSchema } from "../core/pra-common";

export const SeismicPraSubelementSchema = z.enum(["SHA", "SFR", "SPR"]);

export const SeismicEquipmentListInclusionSourceSchema = z.enum([
  "INTERNAL_EVENTS_SYSTEM_MODEL",
  "SEISMIC_EVENT_SEQUENCE_MODEL",
  "ADDITIONAL_SEISMIC_SSC",
  "INTERNAL_FLOOD_SOURCE",
  "INTERNAL_FIRE_IGNITION_SOURCE",
  "SECONDARY_HAZARD",
  "INVESTIGATION_FINDING",
]);

export const SeismicFailureModeTypeSchema = z.enum([
  "FUNCTIONAL",
  "STRUCTURAL",
  "ANCHORAGE",
  "PRESSURE_BOUNDARY",
  "CONTACT_CHATTER",
  "FLOOD_SOURCE",
  "FIRE_IGNITION_SOURCE",
  "SEISMIC_INTERACTION",
  "SOIL_FAILURE",
  "OTHER",
]);

export const SeismicFailureModeSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  failureModeType: SeismicFailureModeTypeSchema,
  description: z.string(),
  creditedFunction: z.string(),
  failureDefinition: z.string(),
  requiredState: z.enum(["FUNCTION_DURING_EARTHQUAKE", "FUNCTION_AFTER_EARTHQUAKE", "MAINTAIN_BOUNDARY", "OTHER"]),
  systemModelBasicEventRefs: z.array(z.string()),
  eventSequenceRefs: z.array(z.string()).optional(),
  inducedBySecondaryHazardRef: z.string().optional(),
  fragilityMechanismRefs: z.array(z.string()),
  consequenceDescription: z.string(),
  implementsSrs: z.array(SRReferenceSchema),
});

export const SeismicEquipmentListEntrySchema = z.object({
  uuid: z.string(),
  name: z.string(),
  sscType: z.enum(["STRUCTURE", "SYSTEM", "COMPONENT", "RELAY", "PANEL", "CABINET", "FLOOD_SOURCE", "FIRE_SOURCE", "OTHER"]),
  componentRef: z.string().optional(),
  systemRef: z.string().optional(),
  structureRef: z.string().optional(),
  parentSscRef: z.string().optional(),
  reactorUnitRefs: z.array(z.string()),
  radioactiveMaterialSourceRefs: z.array(z.string()).optional(),
  building: z.string(),
  roomOrArea: z.string().optional(),
  elevation: z.string().optional(),
  orientation: z.string().optional(),
  mountingAndAnchorage: z.string(),
  creditedFunctions: z.array(z.string()),
  inclusionSources: z.array(SeismicEquipmentListInclusionSourceSchema),
  sourceElementRefs: z.array(z.string()),
  failureModes: z.array(SeismicFailureModeSchema),
  correlationGroupRefs: z.array(z.string()),
  fragilityAnalysisRef: z.string().optional(),
  disposition: z.enum(["ACTIVE", "INHERENTLY_RUGGED", "ABOVE_FRAGILITY_THRESHOLD", "REMOVED_FROM_MODEL"]),
  dispositionBasis: z.string(),
  revisionHistory: z.array(
    z.object({
      date: z.string(),
      action: z.enum(["ADDED", "UPDATED", "REMOVED", "RESTORED"]),
      reason: z.string(),
      actor: z.string(),
    }),
  ),
  implementsSrs: z.array(SRReferenceSchema),
});

export const FragilityCorrelationGroupSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  memberSscRefs: z.array(z.string()),
  correlationModel: z.enum(["PERFECT", "INDEPENDENT", "PARTIAL", "CAUSAL_DEPENDENCY"]),
  correlationCoefficient: z.number().optional(),
  commonDemandBasis: z.string(),
  constructionSimilarity: z.string(),
  installationSimilarity: z.string(),
  locationAndOrientationSimilarity: z.string(),
  capacitySimilarity: z.string(),
  causalLogicRef: z.string().optional(),
  modelingImplementation: z.string(),
  justification: z.string(),
  sensitivityStudyRefs: z.array(z.string()),
  implementsSrs: z.array(SRReferenceSchema),
});

export const SeismicPraInterfaceRecordSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  producer: SeismicPraSubelementSchema,
  consumer: z.union([SeismicPraSubelementSchema, z.enum(["ESQ", "RI", "XF", "F", "FL", "HR"])]),
  payloadType: z.enum([
    "GROUND_MOTION_PARAMETER",
    "HAZARD_CURVE",
    "RESPONSE_SPECTRUM",
    "HAZARD_INTERVAL",
    "SEISMIC_EQUIPMENT_LIST",
    "FRAGILITY",
    "CORRELATION_MODEL",
    "SECONDARY_HAZARD",
    "EVENT_SEQUENCE_FREQUENCY",
    "UNCERTAINTY",
    "OTHER",
  ]),
  producerRefs: z.array(z.string()),
  consumerRefs: z.array(z.string()),
  transferBasis: z.string(),
  consistencyChecks: z.array(z.string()),
  consistent: z.boolean(),
  openItems: z.array(z.string()),
  implementsSrs: z.array(SRReferenceSchema),
});

type Expect<T extends true> = T;
type Equal<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

type _AssertSeismicFailureMode = Expect<Equal<z.infer<typeof SeismicFailureModeSchema>, SeismicFailureMode>>;
type _AssertSeismicEquipmentListEntry = Expect<
  Equal<z.infer<typeof SeismicEquipmentListEntrySchema>, SeismicEquipmentListEntry>
>;
type _AssertFragilityCorrelationGroup = Expect<
  Equal<z.infer<typeof FragilityCorrelationGroupSchema>, FragilityCorrelationGroup>
>;
type _AssertSeismicPraInterfaceRecord = Expect<
  Equal<z.infer<typeof SeismicPraInterfaceRecordSchema>, SeismicPraInterfaceRecord>
>;
