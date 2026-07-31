import { Named, Unique } from "../core/meta";
import { SRReference } from "../core/pra-common";

export type SeismicPraSubelement = "SHA" | "SFR" | "SPR";

export type SeismicEquipmentListInclusionSource =
  | "INTERNAL_EVENTS_SYSTEM_MODEL"
  | "SEISMIC_EVENT_SEQUENCE_MODEL"
  | "ADDITIONAL_SEISMIC_SSC"
  | "INTERNAL_FLOOD_SOURCE"
  | "INTERNAL_FIRE_IGNITION_SOURCE"
  | "SECONDARY_HAZARD"
  | "INVESTIGATION_FINDING";

export type SeismicFailureModeType =
  | "FUNCTIONAL"
  | "STRUCTURAL"
  | "ANCHORAGE"
  | "PRESSURE_BOUNDARY"
  | "CONTACT_CHATTER"
  | "FLOOD_SOURCE"
  | "FIRE_IGNITION_SOURCE"
  | "SEISMIC_INTERACTION"
  | "SOIL_FAILURE"
  | "OTHER";

export interface SeismicFailureMode extends Unique, Named {
  failureModeType: SeismicFailureModeType;
  description: string;
  creditedFunction: string;
  failureDefinition: string;
  requiredState: "FUNCTION_DURING_EARTHQUAKE" | "FUNCTION_AFTER_EARTHQUAKE" | "MAINTAIN_BOUNDARY" | "OTHER";
  systemModelBasicEventRefs: string[];
  eventSequenceRefs?: string[];
  inducedBySecondaryHazardRef?: string;
  fragilityMechanismRefs: string[];
  consequenceDescription: string;
  implementsSrs: SRReference[];
}

export interface SeismicEquipmentListEntry extends Unique, Named {
  sscType: "STRUCTURE" | "SYSTEM" | "COMPONENT" | "RELAY" | "PANEL" | "CABINET" | "FLOOD_SOURCE" | "FIRE_SOURCE" | "OTHER";
  componentRef?: string;
  systemRef?: string;
  structureRef?: string;
  parentSscRef?: string;
  reactorUnitRefs: string[];
  radioactiveMaterialSourceRefs?: string[];
  building: string;
  roomOrArea?: string;
  elevation?: string;
  orientation?: string;
  mountingAndAnchorage: string;
  creditedFunctions: string[];
  inclusionSources: SeismicEquipmentListInclusionSource[];
  sourceElementRefs: string[];
  failureModes: SeismicFailureMode[];
  correlationGroupRefs: string[];
  fragilityAnalysisRef?: string;
  disposition: "ACTIVE" | "INHERENTLY_RUGGED" | "ABOVE_FRAGILITY_THRESHOLD" | "REMOVED_FROM_MODEL";
  dispositionBasis: string;
  revisionHistory: {
    date: string;
    action: "ADDED" | "UPDATED" | "REMOVED" | "RESTORED";
    reason: string;
    actor: string;
  }[];
  implementsSrs: SRReference[];
}

export interface FragilityCorrelationGroup extends Unique, Named {
  memberSscRefs: string[];
  correlationModel: "PERFECT" | "INDEPENDENT" | "PARTIAL" | "CAUSAL_DEPENDENCY";
  correlationCoefficient?: number;
  commonDemandBasis: string;
  constructionSimilarity: string;
  installationSimilarity: string;
  locationAndOrientationSimilarity: string;
  capacitySimilarity: string;
  causalLogicRef?: string;
  modelingImplementation: string;
  justification: string;
  sensitivityStudyRefs: string[];
  implementsSrs: SRReference[];
}

export interface SeismicPraInterfaceRecord extends Unique, Named {
  producer: SeismicPraSubelement;
  consumer: SeismicPraSubelement | "ESQ" | "RI" | "XF" | "F" | "FL" | "HR";
  payloadType:
    | "GROUND_MOTION_PARAMETER"
    | "HAZARD_CURVE"
    | "RESPONSE_SPECTRUM"
    | "HAZARD_INTERVAL"
    | "SEISMIC_EQUIPMENT_LIST"
    | "FRAGILITY"
    | "CORRELATION_MODEL"
    | "SECONDARY_HAZARD"
    | "EVENT_SEQUENCE_FREQUENCY"
    | "UNCERTAINTY"
    | "OTHER";
  producerRefs: string[];
  consumerRefs: string[];
  transferBasis: string;
  consistencyChecks: string[];
  consistent: boolean;
  openItems: string[];
  implementsSrs: SRReference[];
}
