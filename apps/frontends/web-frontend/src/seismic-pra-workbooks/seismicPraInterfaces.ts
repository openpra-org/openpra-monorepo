import { type SeismicPRA } from "interfaces-mef-types/seismic/seismic-pra";

interface SeismicPraInterfaceFlow {
  information: string;
  handoff: string;
  references: string[];
}

interface SeismicPraInterfaceLane {
  code: string;
  element: string;
  role: string;
  direction: "in" | "out";
  rows: SeismicPraInterfaceFlow[];
}

function uniqueReferences(values: (string | undefined)[]): string[] {
  return Array.from(new Set(values.filter((value): value is string => value !== undefined && value.trim().length > 0)));
}

function seismicPraInterfaceLanes(mef: SeismicPRA): SeismicPraInterfaceLane[] {
  const spr = mef.seismicPlantResponseAnalysis;
  const initiatingEvents = [...spr.initiatingEventIdentification.directInitiators, ...spr.initiatingEventIdentification.secondaryHazardInitiators];
  const externalFloodModels = spr.plantResponseModel.retainedHazardModels.filter((model) => model.hazardType === "EXTERNAL_FLOOD");

  return [
    {
      code: "POS",
      element: "Plant Operating States",
      role: "Plant states & source scope",
      direction: "in",
      rows: [
        {
          information: "Plant operating states in scope",
          handoff: "Defines the operating configurations for seismic initiators, event sequences, and quantification.",
          references: uniqueReferences([
            ...spr.initiatingEventIdentification.plantOperatingStateRefs,
            ...spr.plantResponseModel.plantOperatingStateRefs,
          ]),
        },
        {
          information: "Radioactive-material source scope",
          handoff: "Identifies the reactor units and radioactive-material sources represented by the seismic model.",
          references: uniqueReferences(initiatingEvents.flatMap((event) => [...event.reactorUnitRefs, ...event.radioactiveMaterialSourceRefs])),
        },
      ],
    },
    {
      code: "IE",
      element: "Initiating Event Analysis",
      role: "Initiator basis",
      direction: "in",
      rows: [
        {
          information: "Internal-events initiator analogues",
          handoff: "Provides existing initiator definitions used to align trips, transients, and combined-event treatment.",
          references: uniqueReferences(initiatingEvents.map((event) => event.internalEventsInitiatingEventRef)),
        },
        {
          information: "Industry initiating-event experience",
          handoff: "Supports completeness review and identification of seismically induced initiating mechanisms.",
          references: uniqueReferences(initiatingEvents.flatMap((event) => event.industryExperienceRefs)),
        },
      ],
    },
    {
      code: "ES",
      element: "Event Sequence Analysis",
      role: "Event-sequence logic",
      direction: "in",
      rows: [
        {
          information: "Base event-sequence logic",
          handoff: "Provides the sequence structure adapted for seismic failures, secondary hazards, and multi-unit effects.",
          references: uniqueReferences(spr.plantResponseModel.eventSequenceRefs),
        },
      ],
    },
    {
      code: "SC",
      element: "Success Criteria Development",
      role: "Success criteria & mission times",
      direction: "in",
      rows: [
        {
          information: "Success criteria and mission-time basis",
          handoff: "Provides credited functions and response durations that must remain valid in the seismic environment.",
          references: uniqueReferences(
            spr.plantResponseModel.missionTimeAssessments.flatMap((assessment) => [assessment.successCriteriaRef, assessment.eventSequenceRef]),
          ),
        },
      ],
    },
    {
      code: "SY",
      element: "Systems Analysis",
      role: "Systems logic & equipment scope",
      direction: "in",
      rows: [
        {
          information: "Internal-events systems model",
          handoff: "Provides systems logic, basic events, credited functions, and failure modes used to establish the seismic equipment list.",
          references: uniqueReferences([
            spr.seismicEquipmentListDevelopment.internalEventsSystemsModelRef,
            ...spr.plantResponseModel.systemsLogicModelRefs,
          ]),
        },
      ],
    },
    {
      code: "HR",
      element: "Human Reliability Analysis",
      role: "Human actions & HEPs",
      direction: "in",
      rows: [
        {
          information: "Relevant internal-events human failure events",
          handoff: "Provides the base actions, dependencies, timing, and recovery candidates evaluated for seismic conditions.",
          references: uniqueReferences([
            ...spr.humanReliabilityModel.relevantInternalEventsHfeRefs,
            ...spr.plantResponseModel.humanErrorRefs,
          ]),
        },
      ],
    },
    {
      code: "DA",
      element: "Data Analysis",
      role: "Failure & availability data",
      direction: "in",
      rows: [
        {
          information: "Non-seismic failure and unavailability parameters",
          handoff: "Provides the random-failure and unavailability terms retained alongside seismic failures in the plant-response model.",
          references: uniqueReferences([...spr.plantResponseModel.nonSeismicFailureRefs, ...spr.plantResponseModel.unavailabilityRefs]),
        },
      ],
    },
    {
      code: "F",
      element: "Internal Fire PRA",
      role: "Fire-source scope",
      direction: "in",
      rows: [
        {
          information: "Internal-fire ignition sources",
          handoff: "Provides ignition sources and affected equipment considered in the seismic equipment and fragility scope.",
          references: uniqueReferences(spr.seismicEquipmentListDevelopment.internalFireIgnitionSourceRefs),
        },
      ],
    },
    {
      code: "FL",
      element: "Internal Flood PRA",
      role: "Flood-source scope",
      direction: "in",
      rows: [
        {
          information: "Internal-flood sources",
          handoff: "Provides flood sources and affected equipment considered in the seismic equipment and fragility scope.",
          references: uniqueReferences(spr.seismicEquipmentListDevelopment.internalFloodSourceRefs),
        },
      ],
    },
    {
      code: "XF",
      element: "External Flooding PRA",
      role: "Earthquake-induced flooding",
      direction: "out",
      rows: [
        {
          information: "Earthquake-induced flood models",
          handoff: "Provides retained flooding mechanisms, initiating events, affected SSCs, and seismic fragility links.",
          references: uniqueReferences([...mef.integration.externalFloodingAnalysisRefs, ...externalFloodModels.map((model) => model.uuid)]),
        },
      ],
    },
    {
      code: "ESQ",
      element: "Event Sequence Quantification",
      role: "Seismic family quantification",
      direction: "out",
      rows: [
        {
          information: "Seismic event-sequence family quantifications",
          handoff: "Provides mean family frequencies, uncertainty, sensitivities, and hazard-bin contributions.",
          references: uniqueReferences([
            ...mef.integration.eventSequenceQuantificationRefs,
            ...mef.integration.eventSequenceFamilyQuantificationRefs,
          ]),
        },
      ],
    },
    {
      code: "RI",
      element: "Risk Integration",
      role: "Seismic risk results & insights",
      direction: "out",
      rows: [
        {
          information: "Integrated seismic risk contribution",
          handoff: "Provides seismic sequence-family results, risk-significant contributors, uncertainties, and decision insights.",
          references: uniqueReferences([
            ...mef.integration.riskIntegrationRefs,
            ...spr.quantification.riskSignificantContributors.map((contributor) => contributor.uuid),
          ]),
        },
      ],
    },
  ];
}

export { seismicPraInterfaceLanes };
export type { SeismicPraInterfaceFlow, SeismicPraInterfaceLane };
