import { type SRReference } from "interfaces-mef-types/core/pra-common";
import { type SeismicPRA } from "interfaces-mef-types/seismic/seismic-pra";

type ReactorKind = "sfr" | "htgr";
type Spr = SeismicPRA["seismicPlantResponseAnalysis"];
type Initiator = Spr["initiatingEventIdentification"]["directInitiators"][number];
type PlantModel = Spr["plantResponseModel"];
type LogicCompliance =
  PlantModel["newSeismicLogic"][number]["requirementCompliance"][number];

function srs(...codes: string[]): SRReference[] {
  return codes.map((sr) => ({
    sr,
    hlr: sr.split("-")[1]!.charAt(0) as SRReference["hlr"],
  }));
}

function compliance(
  requirementGroups: LogicCompliance["requirementGroup"][],
  satisfiedByRefs: string[],
): LogicCompliance[] {
  return requirementGroups.map((requirementGroup) => ({
    requirementGroup,
    applicable: true,
    capabilityCategory: "CC-II",
    status: "MET",
    satisfiedByRefs,
    evidence:
      "The added seismic logic is developed, reviewed, quantified, and configuration controlled under the cited CC-II technical-element records.",
  }));
}

function populateInitiators(mef: SeismicPRA, kind: ReactorKind): void {
  const isSfr = kind === "sfr";
  const prefix = kind.toUpperCase();
  const powerTripName = isSfr
    ? "Power-operation seismic trip and heat-transport challenge"
    : "Concurrent module trip and primary-circulation challenge";
  const shutdownName = isSfr
    ? "Shutdown decay-heat-removal challenge"
    : "Shutdown module cooling challenge";
  const spentFuelName = isSfr
    ? "Spent-fuel cooling and handling challenge"
    : "Spent-fuel vault cooling challenge";
  const combinedName = isSfr
    ? "Seismic trip with sodium-boundary challenge"
    : "Common-ground-motion multi-module response";
  const primarySystem = isSfr
    ? "Primary sodium pump P-1"
    : "Helium circulator HC-1";
  const passiveSystem = isSfr
    ? "Decay heat removal air cooler AC-1"
    : "Reactor cavity cooling panel RCCS-1";
  const unitRefs = isSfr
    ? ["UNIT-1"]
    : ["MODULE-1", "MODULE-2", "MODULE-3", "MODULE-4"];
  const commonExperienceRefs = [
    "EPRI-SEISMIC-EQUIPMENT-EXPERIENCE-DATABASE",
    "NRC-SEISMIC-OPERATING-EXPERIENCE",
    `${prefix}-DESIGN-SEISMIC-RISK-REVIEW-2026`,
  ];
  const direct = (
    uuid: string,
    name: string,
    description: string,
    plantOperatingStateRefs: string[],
    radioactiveMaterialSourceRefs: string[],
    affectedSscRefs: string[],
    eventSequenceRefs: string[],
    directGroundMotionFailureRefs: string[],
    origin: Initiator["origin"] = "DIRECT_GROUND_MOTION",
  ): Initiator => ({
    uuid,
    name,
    origin,
    description,
    plantOperatingStateRefs,
    reactorUnitRefs: unitRefs,
    radioactiveMaterialSourceRefs,
    directGroundMotionFailureRefs,
    industryExperienceRefs: commonExperienceRefs,
    automaticOrManualTrip: true,
    affectedSscRefs,
    eventSequenceRefs,
    riskSignificant: true,
    retained: true,
    implementsSrs: srs("SPR-A1", "SPR-A3", "SPR-A4"),
  });

  const directInitiators: Initiator[] = [
    direct(
      "INITIATOR-DIRECT-GROUND-MOTION",
      powerTripName,
      isSfr
        ? "Ground motion trips the reactor, removes normal heat transport, and challenges the active-to-passive decay-heat-removal transition."
        : "Common ground motion trips the operating modules and challenges primary helium circulation before passive RCCS heat removal is established.",
      ["POS-POWER"],
      ["SOURCE-REACTOR"],
      [
        "SEL-PRIMARY",
        `SEL-${prefix}-RTS-CABINET`,
        `SEL-${prefix}-DC-BATTERY-A`,
      ],
      ["ES-SEISMIC-SUCCESS", "ES-SEISMIC-DAMAGE"],
      [
        "FAILURE-MODE-PRIMARY",
        `FAILURE-MODE-${prefix}-RTS-CABINET`,
        `FAILURE-MODE-${prefix}-DC-BATTERY-A`,
      ],
    ),
    direct(
      "INITIATOR-DIRECT-SHUTDOWN",
      shutdownName,
      `Strong motion during shutdown can interrupt the configured decay-heat-removal path and challenge ${passiveSystem}.`,
      ["POS-SHUTDOWN"],
      ["SOURCE-REACTOR"],
      ["SEL-SECONDARY", `SEL-${prefix}-DC-BATTERY-B`],
      ["ES-SEISMIC-SHUTDOWN", "ES-SEISMIC-DAMAGE"],
      ["FAILURE-MODE-SECONDARY", `FAILURE-MODE-${prefix}-DC-BATTERY-B`],
    ),
    direct(
      "INITIATOR-DIRECT-SPENT-FUEL",
      spentFuelName,
      isSfr
        ? "Ground motion can interrupt fuel-handling support, damage stored-fuel cooling features, or obstruct recovery access."
        : "Ground motion can obstruct passive vault cooling passages or challenge fuel-handling equipment in a configuration with stored fuel.",
      ["POS-POWER", "POS-SHUTDOWN"],
      ["SOURCE-SPENT-FUEL"],
      [
        isSfr
          ? "SEL-SFR-SPENT-FUEL-VESSEL"
          : "SEL-HTGR-SPENT-FUEL-VAULT",
        `SEL-${prefix}-CABLE-TRAYS`,
      ],
      ["ES-SEISMIC-SPENT-FUEL"],
      [
        isSfr
          ? "FAILURE-MODE-SFR-SPENT-FUEL-VESSEL"
          : "FAILURE-MODE-HTGR-SPENT-FUEL-VAULT",
        `FAILURE-MODE-${prefix}-CABLE-TRAYS`,
      ],
    ),
    direct(
      "INITIATOR-DIRECT-COMBINED",
      combinedName,
      isSfr
        ? `The reactor trip is evaluated together with seismic damage to ${primarySystem} and credible sodium-boundary response.`
        : "The same earthquake acts on all four modules and shared support systems, so concurrent trips and shared dependencies are modeled as one combined event.",
      ["POS-POWER"],
      ["SOURCE-REACTOR", "SOURCE-SPENT-FUEL"],
      isSfr
        ? ["SEL-PRIMARY", "SEL-SFR-SODIUM-PIPING"]
        : ["SEL-PRIMARY", "SEL-SECONDARY", "SEL-HTGR-DC-BATTERY-A"],
      [isSfr ? "ES-SEISMIC-SODIUM" : "ES-MULTIMODULE-SEISMIC"],
      isSfr
        ? ["FAILURE-MODE-PRIMARY", "FAILURE-MODE-SFR-SODIUM-PIPING"]
        : [
            "FAILURE-MODE-PRIMARY",
            "FAILURE-MODE-SECONDARY",
            "FAILURE-MODE-HTGR-DC-BATTERY-A",
          ],
      "COMBINED_EVENT",
    ),
  ];

  const secondary = (
    uuid: string,
    name: string,
    description: string,
    secondaryHazardRef: string,
    affectedSscRefs: string[],
    eventSequenceRefs: string[],
    retained: boolean,
    screeningOrSubsumingBasis: string,
  ): Initiator => ({
    uuid,
    name,
    origin: "SECONDARY_HAZARD",
    description,
    plantOperatingStateRefs: ["POS-POWER", "POS-SHUTDOWN"],
    reactorUnitRefs: unitRefs,
    radioactiveMaterialSourceRefs: ["SOURCE-REACTOR", "SOURCE-SPENT-FUEL"],
    secondaryHazardRef,
    industryExperienceRefs: commonExperienceRefs,
    automaticOrManualTrip: retained,
    affectedSscRefs,
    eventSequenceRefs,
    riskSignificant: retained,
    screeningOrSubsumingBasis,
    retained,
    implementsSrs: srs("SPR-A2", "SPR-A3", "SPR-A4"),
  });

  const secondaryHazardInitiators: Initiator[] = [
    secondary(
      "INITIATOR-LIQUEFACTION",
      "Liquefaction-induced support deformation",
      `Permanent ground deformation can remove the credited function of ${passiveSystem} and extend post-earthquake access constraints.`,
      "SECONDARY-LIQUEFACTION",
      ["SEL-SECONDARY", `SEL-${prefix}-REACTOR-BUILDING`],
      ["ES-SEISMIC-LIQUEFACTION", "ES-SEISMIC-DAMAGE"],
      true,
      "Retained because the site-specific displacement hazard overlaps the lower tail of the linked fragility and contributes to the modeled damage family.",
    ),
    secondary(
      "INITIATOR-INTERNAL-FLOOD-1",
      "Seismic service-water release",
      "Pipe rupture and spray in the electrical building can challenge redundant power and protection divisions.",
      "INTERNAL-FLOOD-SERVICE-WATER",
      [`SEL-${prefix}-SERVICE-WATER`, `SEL-${prefix}-SWITCHGEAR`],
      ["ES-SEISMIC-FLOOD"],
      false,
      "The integrated source fragility and room-consequence frequency satisfy SCR-2; the source remains in the SEL and threshold confirmation register.",
    ),
    secondary(
      "INITIATOR-INTERNAL-FLOOD-2",
      isSfr
        ? "Seismic feedwater release in the steam-generator bay"
        : "Seismic RCCS expansion-tank release",
      isSfr
        ? "A feedwater-line rupture can flood the steam-generator bay and create a coupled sodium-water challenge."
        : "Expansion-tank rupture can reduce RCCS inventory and flood the upper service gallery.",
      isSfr ? "INTERNAL-FLOOD-STEAM-WATER" : "INTERNAL-FLOOD-RCCS-TANK",
      [
        isSfr ? "SEL-SFR-STEAM-WATER" : "SEL-HTGR-RCCS-WATER",
        "SEL-SECONDARY",
      ],
      ["ES-SEISMIC-FLOOD"],
      false,
      "Source-specific capacity, isolation, drainage, and consequence integration place the aggregate sequence contribution below SCR-2.",
    ),
    secondary(
      "INITIATOR-INTERNAL-FIRE",
      isSfr
        ? "Seismic sodium release and fire"
        : "Seismic electrical-source fire",
      isSfr
        ? "Sodium boundary damage can release and ignite sodium in heat-transport or storage areas."
        : "Transformer or battery-charger damage can produce an ignition source near credited electrical equipment.",
      "INTERNAL-FIRE-SEISMIC-SOURCES",
      isSfr
        ? ["SEL-SFR-SODIUM-PIPING", "SEL-SFR-SODIUM-STORAGE"]
        : ["SEL-HTGR-TRANSFORMER", "SEL-HTGR-BATTERY-CHARGER"],
      ["ES-SEISMIC-FIRE"],
      false,
      "The two source fragilities, separation features, and conditional ignition treatment remain below the screening limit in the final plant model.",
    ),
    secondary(
      "INITIATOR-EXTERNAL-FLOOD",
      "Seismically induced upstream-reservoir flooding",
      "Earthquake-conditioned embankment damage and breach can route an external flood wave to electrical, heat-removal support, below-grade cable, and site-access areas.",
      "SECONDARY-EXTERNAL-FLOODING",
      isSfr
        ? [
            "SEL-SFR-SWITCHGEAR",
            "SEL-SFR-DC-BATTERY-A",
            "SEL-SFR-DHR-DAMPER",
          ]
        : [
            "SEL-HTGR-SWITCHGEAR",
            "SEL-HTGR-DC-BATTERY-A",
            "SEL-HTGR-RCCS-HEADER",
          ],
      ["ES-SEISMIC-EXTERNAL-FLOOD"],
      true,
      "Retained because upper credible embankment-response and breach-routing branches produce inundation at protected plant areas; the complete XFHA interface is carried into the plant-response model.",
    ),
    secondary(
      "INITIATOR-SECONDARY-SETTLEMENT",
      "Non-liquefiable soil settlement",
      "Cyclic densification and differential settlement outside the retained liquefaction lens were evaluated for foundations and buried services.",
      "SECONDARY-SOIL-SETTLEMENT",
      [`SEL-${prefix}-REACTOR-BUILDING`],
      [],
      false,
      "Bounding settlement and foundation-distortion calculations satisfy the documented screening criterion without masking the retained liquefaction mechanism.",
    ),
  ];

  const identification = mef.seismicPlantResponseAnalysis
    .initiatingEventIdentification;
  identification.systematicProcess =
    "For each in-scope operating state and radioactive-material source, reconcile direct ground-motion failure effects, secondary-hazard screening, SEL source failures, internal-events initiating groups, multi-unit dependencies, and operating experience; retain every event capable of producing a risk-significant event-sequence family.";
  identification.plantOperatingStateRefs = ["POS-POWER", "POS-SHUTDOWN"];
  identification.directInitiators = directInitiators;
  identification.secondaryHazardInitiators = secondaryHazardInitiators;
  identification.industryExperienceSources = [
    ...commonExperienceRefs,
    "EPRI-NP-6041-SL-SEISMIC-EXPERIENCE",
    "EPRI-3002000709-SEISMIC-PRA-IMPLEMENTATION",
    `${prefix}-PLANT-TRANSIENT-AND-DESIGN-REVIEW`,
  ];
  identification.multiReactorAndMultiSourceEvaluation = isSfr
    ? "The single reactor, spent-fuel storage and handling source, sodium boundaries, and shared electrical/support dependencies are evaluated for concurrent earthquake effects; multi-reactor logic is not applicable."
    : "The same ground motion acts on four reactor modules, the spent-fuel vault, and shared RCCS, electrical, and human-response resources; concurrent module states and common dependencies are preserved in the seismic event sequences.";
  identification.completenessReview =
    "The register reconciles every Step 07 hazard disposition, every modeled seismic flood and fire source, both in-scope operating states, each radioactive-material source, all risk-significant SEL failure effects, and applicable earthquake operating experience. Screened records remain visible with their technical basis.";
  identification.riskSignificanceEvaluationMethod =
    "Use conservative sequence prescreening followed by hazard-fragility-systems quantification; retain an initiating event when its event-sequence-family contribution exceeds SCR-2 or changes contributor ranking, release category, or risk insight.";
  identification.retainedInitiatingEventRefs = [
    ...directInitiators.map((initiator) => initiator.uuid),
    "INITIATOR-LIQUEFACTION",
    "INITIATOR-EXTERNAL-FLOOD",
  ];
  identification.implementsSrs = srs("SPR-A1", "SPR-A2", "SPR-A3", "SPR-A4");
}

function populatePlantModel(mef: SeismicPRA, kind: ReactorKind): void {
  const isSfr = kind === "sfr";
  const prefix = kind.toUpperCase();
  const xfPrefix = isSfr ? "PIONEER-MESA-XF" : "CEDAR-BASIN-XF";
  const model = mef.seismicPlantResponseAnalysis.plantResponseModel;
  const equipment = mef.seismicPlantResponseAnalysis
    .seismicEquipmentListDevelopment.equipment;
  const fragilities = mef.seismicFragilityAnalysis.results
    .fragilityEvaluations;
  const thresholdMethods = mef.seismicFragilityAnalysis.thresholdProgram
    .thresholdMethods;
  const unitRefs = isSfr
    ? ["UNIT-1"]
    : ["MODULE-1", "MODULE-2", "MODULE-3", "MODULE-4"];

  model.baseInternalEventsModelRefs = [
    "IE-INITIATING-EVENT-GROUPS-2026",
    "ES-REFERENCE-MODEL",
    "SY-REFERENCE-MODEL",
    "SC-REFERENCE-BASIS",
    "HR-REFERENCE-MODEL",
    "DA-REFERENCE-PARAMETERS",
  ];
  model.baseNonSeismicHazardModelRefs = [
    "INTERNAL-FLOOD-REFERENCE",
    "INTERNAL-FIRE-REFERENCE",
  ];
  model.eventSequenceRefs = [
    "ES-SEISMIC-SUCCESS",
    "ES-SEISMIC-DAMAGE",
    "ES-SEISMIC-SHUTDOWN",
    "ES-SEISMIC-SPENT-FUEL",
    "ES-SEISMIC-LIQUEFACTION",
    "ES-SEISMIC-EXTERNAL-FLOOD",
    "ES-SEISMIC-FLOOD",
    "ES-SEISMIC-FIRE",
    isSfr ? "ES-SEISMIC-SODIUM" : "ES-MULTIMODULE-SEISMIC",
  ];
  model.systemsLogicModelRefs = [
    "SY-SEISMIC-MODEL",
    "SY-REACTOR-PROTECTION",
    "SY-DECAY-HEAT-REMOVAL",
    "SY-DC-POWER",
    isSfr ? "SY-SODIUM-HEAT-TRANSPORT" : "SY-RCCS",
    "SY-SPENT-FUEL-COOLING",
  ];
  model.peerReviewFindingResolutions = [
    {
      uuid: "SPR-PRF-IE-SEQUENCE-COVERAGE",
      name: "Internal-events sequence coverage",
      sourcePraElement: "Internal Events Event Sequence Analysis",
      sourcePeerReviewRef: "IE-PEER-REVIEW-2025",
      findingRef: "IE-F&O-ES-07",
      relevanceToSeismicPra: "The internal-events model did not contain simultaneous loss-of-support and multi-source seismic initiators.",
      potentialAmplificationInSeismicModel: "Common ground motion can make the omitted combinations leading contributors even when the corresponding independent internal-events combinations are negligible.",
      resolutionStatus: "RESOLVED",
      resolution: "Added shutdown, spent-fuel, secondary-hazard, and combined-event sequence families with explicit common seismic dependencies.",
      incorporatedModelRefs: ["ES-SEISMIC-SHUTDOWN", "ES-SEISMIC-SPENT-FUEL", isSfr ? "ES-SEISMIC-SODIUM" : "ES-MULTIMODULE-SEISMIC"],
      evidenceRefs: [`${prefix}-SPR-SEQUENCE-RECONCILIATION-001`],
      implementsSrs: srs("SPR-B2"),
    },
    {
      uuid: "SPR-PRF-SYSTEM-BOUNDARIES",
      name: "Support-system boundary consistency",
      sourcePraElement: "Internal Events Systems Analysis",
      sourcePeerReviewRef: "IE-PEER-REVIEW-2025",
      findingRef: "IE-F&O-SY-12",
      relevanceToSeismicPra: "Support-system boundaries and shared electrical dependencies determine the consequence of correlated seismic failures.",
      potentialAmplificationInSeismicModel: "A boundary omission could hide shared loss of support across otherwise redundant heat-removal trains.",
      resolutionStatus: "RESOLVED",
      resolution: "Reconciled train boundaries, support dependencies, DC and AC interfaces, and shared structures to the SEL and seismic logic.",
      incorporatedModelRefs: ["SY-SEISMIC-MODEL", "SY-DC-POWER", "CORR-DC-POWER"],
      evidenceRefs: [`${prefix}-SPR-SYSTEM-BOUNDARY-004`, `${prefix}-SEL-RECONCILIATION-2026`],
      implementsSrs: srs("SPR-B2"),
    },
    {
      uuid: "SPR-PRF-FLOOD-SPRAY",
      name: "Internal-flood spray propagation",
      sourcePraElement: "Internal Flood PRA",
      sourcePeerReviewRef: "FL-PEER-REVIEW-2025",
      findingRef: "FL-F&O-SN-03",
      relevanceToSeismicPra: "A seismic pipe rupture may create broader spray and simultaneous equipment damage than the random internal-flood scenario.",
      potentialAmplificationInSeismicModel: "Earthquake-caused spatially correlated failures can defeat the independent-train assumptions used in the base flood model.",
      resolutionStatus: "RESOLVED",
      resolution: "Updated spray zones, drainage, isolation timing, and correlated equipment targets for both seismic flood sources before applying the SCR-2 screen.",
      incorporatedModelRefs: ["INITIATOR-INTERNAL-FLOOD-1", "INITIATOR-INTERNAL-FLOOD-2", "ES-SEISMIC-FLOOD"],
      evidenceRefs: [`${prefix}-SEISMIC-FLOOD-RECONCILIATION-006`],
      implementsSrs: srs("SPR-B2", "SPR-B9"),
    },
    {
      uuid: "SPR-PRF-FIRE-TARGETS",
      name: "Internal-fire target and dependency update",
      sourcePraElement: "Internal Fire PRA",
      sourcePeerReviewRef: "FIRE-PEER-REVIEW-2025",
      findingRef: "FIRE-F&O-FPRM-09",
      relevanceToSeismicPra: "Seismic source motion can alter ignition probability, fire barriers, target sets, and operator access.",
      potentialAmplificationInSeismicModel: "A source and barrier affected by the same earthquake can increase conditional target damage.",
      resolutionStatus: "RESOLVED",
      resolution: "Reconciled credible source fragilities, barrier status, target sets, suppression, and access with the seismic fire prescreen.",
      incorporatedModelRefs: ["INITIATOR-INTERNAL-FIRE", "ES-SEISMIC-FIRE"],
      evidenceRefs: [`${prefix}-SEISMIC-FIRE-RECONCILIATION-003`],
      implementsSrs: srs("SPR-B2", "SPR-B10"),
    },
    {
      uuid: "SPR-PRF-MISSION-TIME",
      name: "Long-duration mission-time basis",
      sourcePraElement: "Internal Events Success Criteria",
      sourcePeerReviewRef: "IE-PEER-REVIEW-2025",
      findingRef: "IE-F&O-SC-04",
      relevanceToSeismicPra: "Seismic debris, aftershocks, loss of infrastructure, and staffing constraints may persist beyond the internal-events recovery window.",
      potentialAmplificationInSeismicModel: "Using the shorter internal-events mission without checking accessibility could over-credit recovery and replenishment.",
      resolutionStatus: "RESOLVED",
      resolution: "Reassessed six seismic mission times using thermal-hydraulic demand, stored inventories, flood persistence, access, aftershock, and emergency-response capability.",
      incorporatedModelRefs: ["MISSION-TIME-1", "MISSION-TIME-SHUTDOWN", "MISSION-TIME-SPENT-FUEL", "MISSION-TIME-LIQUEFACTION", "MISSION-TIME-EXTERNAL-FLOOD", "MISSION-TIME-LONG-TERM"],
      evidenceRefs: [`${prefix}-SEISMIC-MISSION-TIME-012`],
      implementsSrs: srs("SPR-B2", "SPR-B7"),
    },
  ];

  model.inducedFailures = fragilities
    .filter((evaluation) => !evaluation.thresholdSatisfied)
    .map((evaluation, index) => {
      const item = equipment.find((candidate) =>
        candidate.uuid === evaluation.sscRef);
      const failureMode = item?.failureModes.find((candidate) =>
        candidate.uuid === evaluation.systemsFailureModeRef);
      if (item === undefined || failureMode === undefined) {
        throw new Error(`Cannot build plant-response failure ${evaluation.uuid}`);
      }
      return {
        uuid: `INDUCED-FAILURE-${index + 1}`,
        name: failureMode.name,
        sscRef: item.uuid,
        seismicEquipmentListEntryRef: item.uuid,
        systemsFailureModeRef: failureMode.uuid,
        fragilityEvaluationRef: evaluation.uuid,
        systemsBasicEventRef: failureMode.systemModelBasicEventRefs[0]
          ?? `BE-${item.uuid}`,
        failureEffect: failureMode.consequenceDescription,
        correlationGroupRefs: evaluation.correlationGroupRefs,
        causalDependencyRefs: item.uuid === "SEL-SECONDARY"
          ? ["DEP-SECONDARY-HAZARD-DEFORMATION"]
          : ["DEP-COMMON-GROUND-MOTION"],
        eventSequenceRefs: Array.from(new Set([
          ...(failureMode.eventSequenceRefs ?? []),
          ...(item.uuid === "SEL-SECONDARY"
            ? ["ES-SEISMIC-LIQUEFACTION"]
            : ["ES-SEISMIC-SUCCESS"]),
        ])),
        modelImplementation:
          "The systems basic event is quantified in every hazard bin from the linked mean fragility curve; correlated demand, capacity dependence, and secondary-hazard conditioning are applied before Boolean solution.",
        implementsSrs: srs("SPR-B3", "SPR-B4"),
      };
    });
  model.nonSeismicFailureRefs = [
    "BE-RANDOM-DHR-TRAIN-A",
    "BE-RANDOM-DHR-TRAIN-B",
    "BE-RANDOM-DC-DIV-A",
    "BE-RANDOM-DC-DIV-B",
    "BE-COMMON-CAUSE-PROTECTION",
    "BE-OFFSITE-POWER-NONRECOVERY",
  ];
  model.unavailabilityRefs = [
    "UA-DHR-TRAIN-A-MAINT",
    "UA-DC-DIV-B-TEST",
    "UA-SPENT-FUEL-HANDLING",
    "UA-FIRE-SUPPRESSION-TRAIN",
    "UA-FLOOD-ISOLATION-VALVE",
  ];
  model.humanErrorRefs = [
    "HFE-SEISMIC-LOCAL-ACTION",
    "HFE-SEISMIC-DHR-ALIGN",
    "HFE-SEISMIC-POWER-RECOVERY",
    "HFE-SEISMIC-SPENT-FUEL",
  ];
  model.plantOperatingStateRefs = ["POS-POWER", "POS-SHUTDOWN"];
  model.radioactiveMaterialSourceRefs = [
    "SOURCE-REACTOR",
    "SOURCE-SPENT-FUEL",
    ...(isSfr ? ["SOURCE-SODIUM-ACTIVATION-PRODUCTS"] : []),
  ];
  model.fragilityThresholds = thresholdMethods.map((method, index) => ({
    uuid: method.plantResponseThresholdRef,
    name: method.name,
    groundMotionParameterRef: method.groundMotionParameterRef,
    controlPointRef: method.controlPointRef,
    thresholdCapacity: method.thresholdCapacity,
    capacityUnits: method.capacityUnits,
    hazardCurveRef: method.groundMotionParameterRef === "GMP-H-PGA"
      ? "HAZARD-CURVE-GMP-H-PGA-MEAN"
      : method.groundMotionParameterRef === "GMP-H-SA-10HZ"
        ? "HAZARD-CURVE-GMP-H-SA-10HZ-MEAN"
        : "HAZARD-CURVE-MEAN-1HZ",
    cumulativeSscCount: method.cumulativeSscCountBasis,
    correlationAndGroupingBasis: method.correlationTreatment,
    integratedAnnualFrequency: [7.5e-9, 4.8e-9, 1.9e-9, 3.2e-9][index]!,
    screeningCriterion: "SCR-2",
    criterionLimit: 1e-7,
    satisfiesCriterion: method.satisfiesScr2,
    eventSequenceFamilyApplicability: [
      "ESF-SEISMIC-DAMAGE",
      "ESF-SEISMIC-SHUTDOWN",
    ],
    finalModelConfirmation:
      "Final hazard-bin quantification confirms the correlated aggregate screened contribution remains below SCR-2 without removing retained soil-deformation, flood-source, fire-source, or spatial-interaction interfaces from technical review.",
    sensitivityStudyRefs: ["SENS-THRESHOLD", "SENS-CORRELATION"],
    implementsSrs: srs("SPR-B5"),
  }));
  const relayFragility = fragilities.find((evaluation) =>
    evaluation.analysisCategory === "CONTACT_CHATTER");
  model.contactChatterModels = relayFragility === undefined
    ? []
    : [{
        uuid: "CHATTER-MODEL-RTS-RELAY",
        name: "Protection relay chatter disposition",
        deviceSscRef: relayFragility.sscRef,
        fragilityEvaluationRef: relayFragility.uuid,
        affectedSscRefs: [
          `SEL-${prefix}-RTS-CABINET`,
          `SEL-${prefix}-DC-BATTERY-A`,
        ],
        chatterEffect: "ACCEPTABLE_CHATTER",
        systemsLogicRefs: ["SY-REACTOR-PROTECTION", "SY-DC-POWER"],
        riskSignificant: false,
        exclusionByDesignBasis:
          "The installed contact form, energized state, restraint clip, cabinet spectrum, and qualified chatter capacity were evaluated systematically; integrated chatter sequences remain below SCR-2.",
        implementsSrs: srs("SPR-B6"),
      }];
  const missionConfigurations = [
    {
      uuid: "MISSION-TIME-1",
      name: "Power-operation decay-heat removal",
      eventSequenceRef: "ES-SEISMIC-DAMAGE",
      successCriteriaRef: "SC-DECAY-HEAT-REMOVAL",
      hours: 72,
      access: "Local access is restricted for the first two hours and uses the qualified north route thereafter.",
      response: "On-site response is available with degraded communications; no off-site replenishment is credited before 24 hours.",
      duration: "Strong motion is brief, but aftershocks, debris, loss of lighting, and infrastructure disruption are carried through 72 hours.",
      basis: isSfr
        ? "Pool thermal inertia, two passive DRACS trains, natural-circulation sodium, stored electrical energy, and atmospheric heat rejection support a 72-hour mission."
        : "Core and vessel thermal response, RCCS inventory, natural circulation, and passive heat rejection support a 72-hour mission.",
    },
    {
      uuid: "MISSION-TIME-SHUTDOWN",
      name: "Shutdown cooling configuration",
      eventSequenceRef: "ES-SEISMIC-SHUTDOWN",
      successCriteriaRef: "SC-SHUTDOWN-COOLING",
      hours: 24,
      access: "The modeled shutdown lineup can be confirmed from the control room; one local valve route remains available with debris allowance.",
      response: "Shift staffing and the technical support center are sufficient without mutual aid during the first day.",
      duration: "Aftershock effects on the configured shutdown train and local access are represented for 24 hours.",
      basis: "Decay-heat level, inventory, lineup availability, and recovery windows support the shutdown mission.",
    },
    {
      uuid: "MISSION-TIME-SPENT-FUEL",
      name: "Spent-fuel heat removal",
      eventSequenceRef: "ES-SEISMIC-SPENT-FUEL",
      successCriteriaRef: "SC-SPENT-FUEL-COOLING",
      hours: 168,
      access: "Fuel-building access may be delayed for eight hours; monitoring and alternate makeup or airflow paths remain available.",
      response: "Long-term monitoring, portable equipment, and staffing are evaluated through seven days.",
      duration: "Aftershocks and infrastructure recovery are represented over the full stored-fuel heat-removal mission.",
      basis: isSfr
        ? "Fuel-vessel inventory, natural convection, shielding constraints, and portable makeup support the seven-day evaluation."
        : "Passive vault airflow, thermal mass, blockage monitoring, and portable debris removal support the seven-day evaluation.",
    },
    {
      uuid: "MISSION-TIME-LIQUEFACTION",
      name: "Soil-deformation recovery constraint",
      eventSequenceRef: "ES-SEISMIC-LIQUEFACTION",
      successCriteriaRef: "SC-ALTERNATE-DECAY-HEAT-REMOVAL",
      hours: 72,
      access: "The normal service-trench route is unavailable; the model credits a surveyed alternate route with increased travel time.",
      response: "Emergency response staging is relocated outside the deformation zone and does not depend on the affected buried service.",
      duration: "Permanent ground deformation persists for the mission; recovery of the affected support is not credited.",
      basis: "The success criterion uses unaffected heat-removal capability and explicitly excludes repair of the deformed foundation or buried connection.",
    },
    {
      uuid: "MISSION-TIME-EXTERNAL-FLOOD",
      name: "External-flood isolation and stable cooling",
      eventSequenceRef: "ES-SEISMIC-EXTERNAL-FLOOD",
      successCriteriaRef: "SC-EXTERNAL-FLOOD-STABLE-COOLING",
      hours: 72,
      access: "Inundated yard and below-grade routes are unavailable until surveyed; the model uses the elevated protected route and does not credit access through flooded electrical areas.",
      response: "On-site staffing and protected communications support isolation and monitoring; off-site entry through the affected access route is not credited during the flood plateau.",
      duration: "Arrival time, flood rise, peak inundation, recession, drainage, debris, and aftershock restrictions are represented through the 72-hour mission.",
      basis: isSfr
        ? "Protected DC power, isolated electrical penetrations, one available DRACS air path, and stored monitoring capability support the flood-conditioned mission."
        : "Protected DC power, compartment isolation, unaffected passive RCCS heat rejection, and stored monitoring capability support the flood-conditioned mission.",
    },
    {
      uuid: "MISSION-TIME-LONG-TERM",
      name: "Long-term stable cooling and monitoring",
      eventSequenceRef: "ES-SEISMIC-SUCCESS",
      successCriteriaRef: "SC-LONG-TERM-STABLE-STATE",
      hours: 168,
      access: "Credited monitoring locations are reachable after initial area surveys; damaged zones are excluded.",
      response: "Fuel, water, electrical, staffing, and communications needs are checked through the transition to off-site support.",
      duration: "Long-duration infrastructure disruption and aftershock response are represented for seven days.",
      basis: "Inventory depletion, thermal-hydraulic demand, surveillance, and recovery calculations demonstrate stable cooling and monitoring.",
    },
  ];
  model.missionTimeAssessments = missionConfigurations.map((item) => ({
    uuid: item.uuid,
    name: item.name,
    eventSequenceRef: item.eventSequenceRef,
    successCriteriaRef: item.successCriteriaRef,
    assumedMissionTimeHours: item.hours,
    sustainedAccessibilityImpact: item.access,
    emergencyResponseCapabilityImpact: item.response,
    seismicEnvironmentDuration: item.duration,
    missionTimeValid: true,
    capabilityCategoryApplied: "CC-II",
    basis: item.basis,
    implementsSrs: srs("SPR-B7"),
  }));
  model.newSeismicLogic = [
    {
      uuid: "NEW-LOGIC-SEISMIC-SEQUENCES",
      name: "Direct and secondary seismic event sequences",
      logicType: "EVENT_SEQUENCE",
      reasonNeeded: "Internal-events sequences do not represent common ground motion, secondary soil deformation, or concurrent source challenges.",
      baseInternalEventsModelRef: "ES-REFERENCE-MODEL",
      modelRefs: ["ES-SEISMIC-DAMAGE", "ES-SEISMIC-SHUTDOWN", "ES-SEISMIC-LIQUEFACTION", "ES-SEISMIC-EXTERNAL-FLOOD"],
      requirementCompliance: compliance(["HLR-ES-A", "HLR-ES-B"], ["ES-SEISMIC-REVIEW-2026"]),
      verificationAndValidation: "Sequence headings, transfers, end states, and family mapping were independently reviewed and exercised with boundary cases.",
      implementsSrs: srs("SPR-B1", "SPR-B8"),
    },
    {
      uuid: "NEW-LOGIC-SEISMIC-SUCCESS-CRITERIA",
      name: "Seismic mission-time success criteria",
      logicType: "SUCCESS_CRITERION",
      reasonNeeded: "Accessibility, aftershocks, infrastructure damage, and long-duration source cooling require seismic-specific mission times.",
      baseInternalEventsModelRef: "SC-REFERENCE-BASIS",
      modelRefs: model.missionTimeAssessments.map((assessment) =>
        assessment.successCriteriaRef),
      requirementCompliance: compliance(["HLR-SC-A", "HLR-SC-B"], ["SC-SEISMIC-CALC-2026"]),
      verificationAndValidation: "Thermal-hydraulic results, inventories, timing, access, and response resources were checked against every modeled sequence.",
      implementsSrs: srs("SPR-B7", "SPR-B8"),
    },
    {
      uuid: "NEW-LOGIC-CORRELATED-FAILURES",
      name: "Correlated seismic failure logic",
      logicType: "SYSTEM_MODEL",
      reasonNeeded: "Common demand and shared construction can invalidate the independent basic-event treatment used for random failures.",
      baseInternalEventsModelRef: "SY-REFERENCE-MODEL",
      modelRefs: ["SY-SEISMIC-MODEL", ...mef.seismicFragilityAnalysis.results.correlationGroups.map((group) => group.uuid)],
      requirementCompliance: compliance(["HLR-SY-A", "HLR-SY-B"], ["SY-SEISMIC-V&V-2026"]),
      verificationAndValidation: "Single-failure, perfect-correlation, and partial-correlation boundary solutions reproduce the expected limiting behavior.",
      implementsSrs: srs("SPR-B3", "SPR-B4", "SPR-B8"),
    },
    {
      uuid: "NEW-LOGIC-SEISMIC-DATA",
      name: "Hazard-bin failure probabilities and thresholds",
      logicType: "DATA_PARAMETER",
      reasonNeeded: "Seismic basic-event probabilities vary with motion level and require correlated fragility and threshold integration.",
      baseInternalEventsModelRef: "DA-REFERENCE-PARAMETERS",
      modelRefs: [
        ...fragilities.map((evaluation) => evaluation.uuid),
        ...model.fragilityThresholds.map((threshold) => threshold.uuid),
      ],
      requirementCompliance: compliance(
        ["HLR-DA-A", "HLR-DA-B", "HLR-DA-C", "HLR-DA-D"],
        ["DA-SEISMIC-PARAMETER-REVIEW-2026"],
      ),
      verificationAndValidation: "Independent recomputation verifies bin conditional failure probabilities, monotonicity, threshold aggregation, and parameter-unit consistency.",
      implementsSrs: srs("SPR-B4", "SPR-B5", "SPR-B8"),
    },
    {
      uuid: "NEW-LOGIC-SEISMIC-HUMAN-ACTIONS",
      name: "Seismic access and recovery dependencies",
      logicType: "HUMAN_ACTION",
      reasonNeeded: "Debris, lighting loss, physical hazards, communication failures, and concurrent unit demands change action feasibility and dependence.",
      baseInternalEventsModelRef: "HR-REFERENCE-MODEL",
      modelRefs: model.humanErrorRefs,
      requirementCompliance: compliance(["HLR-HR-D"], ["HR-SEISMIC-ACTION-REVIEW-2026"]),
      verificationAndValidation: "Action timing, location, cues, resources, dependency, and recovery credit were reconciled to mission-time and sequence records.",
      implementsSrs: srs("SPR-B8"),
    },
  ];
  model.retainedHazardModels = [
    {
      uuid: "RETAINED-HAZARD-LIQUEFACTION",
      name: "Liquefaction and permanent ground deformation",
      hazardType: "OTHER_SECONDARY_HAZARD",
      hazardAnalysisRef: "SECONDARY-LIQUEFACTION",
      initiatingEventRefs: ["INITIATOR-LIQUEFACTION"],
      sourceSscRefs: [`SEL-${prefix}-REACTOR-BUILDING`],
      affectedSscRefs: ["SEL-SECONDARY"],
      fragilityRefs: ["FRAGILITY-SECONDARY", "FRAGILITY-SOIL"],
      plantResponseModelRefs: [
        "INDUCED-FAILURE-2",
        "ES-SEISMIC-LIQUEFACTION",
        "MISSION-TIME-LIQUEFACTION",
      ],
      requirementCompliance: [
        {
          requirementGroup: "HLR-OFR-A",
          capabilityCategory: "CC-II",
          applicable: true,
          status: "MET",
          satisfiedByRefs: ["FRAGILITY-SECONDARY", "FRAGILITY-SOIL"],
          evidence: "The affected functions use site-specific soil-deformation hazard and realistic fragility evaluations.",
        },
        {
          requirementGroup: "HLR-OPR-B",
          capabilityCategory: "CC-II",
          applicable: true,
          status: "MET",
          satisfiedByRefs: ["ES-SEISMIC-LIQUEFACTION", "MISSION-TIME-LIQUEFACTION"],
          evidence: "The plant-response sequence preserves permanent loss of the affected support and the alternate recovery path.",
        },
      ],
      integrationBasis:
        "Condition the linked SSC fragilities and permanent access impacts on the displacement-hazard result, preserve correlation with ground motion, and quantify the retained sequence in the same hazard-bin solution.",
      implementsSrs: srs("SPR-B12"),
    },
    {
      uuid: "RETAINED-HAZARD-EXTERNAL-FLOOD",
      name: "Seismically induced upstream-reservoir flooding",
      hazardType: "EXTERNAL_FLOOD",
      hazardAnalysisRef: "SECONDARY-EXTERNAL-FLOODING",
      initiatingEventRefs: ["INITIATOR-EXTERNAL-FLOOD"],
      sourceSscRefs: [`${xfPrefix}-RESERVOIR-EMBANKMENT`],
      affectedSscRefs: isSfr
        ? [
            "SEL-SFR-SWITCHGEAR",
            "SEL-SFR-DC-BATTERY-A",
            "SEL-SFR-DHR-DAMPER",
          ]
        : [
            "SEL-HTGR-SWITCHGEAR",
            "SEL-HTGR-DC-BATTERY-A",
            "SEL-HTGR-RCCS-HEADER",
          ],
      fragilityRefs: [
        `${xfPrefix}-FLOOD-DOOR-HYDROSTATIC`,
        `${xfPrefix}-CABLE-VAULT-INGRESS`,
        `${xfPrefix}-DRAIN-BACKFLOW`,
        `${xfPrefix}-YARD-EQUIPMENT-INUNDATION`,
      ],
      plantResponseModelRefs: [
        `${xfPrefix}-PLANT-RESPONSE-MODEL`,
        "ES-SEISMIC-EXTERNAL-FLOOD",
        "MISSION-TIME-EXTERNAL-FLOOD",
        "ESF-SEISMIC-EXTERNAL-FLOOD",
      ],
      requirementCompliance: [
        "A",
        "B",
        "C",
        "D",
        "E",
        "F",
        "G",
      ].map((group) => ({
        requirementGroup: `HLR-XFHA-${group}`,
        capabilityCategory: "CC-II" as const,
        applicable: true,
        status: "MET" as const,
        satisfiedByRefs: [
          `${xfPrefix}-ANALYSIS-2026`,
          `${xfPrefix}-PLANT-RESPONSE-MODEL`,
          "ES-SEISMIC-EXTERNAL-FLOOD",
        ],
        evidence: `The controlled external-flood package applies HLR-XFHA-${group} to the earthquake-conditioned hazard, flood-protection fragility, and plant-response sequence.`,
      })),
      integrationBasis:
        "Condition embankment response and breach on the common earthquake branch, route the breach hydrograph to plant-area receptors, apply frequency-dependent flood-protection fragilities, and quantify spatially correlated inundation and access effects without multiplying independent seismic and flood frequencies.",
      implementsSrs: srs("SPR-B11"),
    },
  ];
  model.multiReactorModels = [{
    uuid: "MULTI-REACTOR-1",
    name: isSfr
      ? "Single-reactor applicability evaluation"
      : "Four-module concurrent seismic response",
    applicable: !isSfr,
    reactorUnitRefs: unitRefs,
    sharedSscRefs: isSfr
      ? []
      : [
          "SEL-SECONDARY",
          "SEL-HTGR-DC-BATTERY-A",
          "SEL-HTGR-SWITCHGEAR",
          "SEL-HTGR-SPENT-FUEL-VAULT",
        ],
    sharedHazardAndDependencyDescription: isSfr
      ? "The reference design contains one reactor unit; shared effects with spent-fuel and sodium-source areas are handled as multi-source dependencies."
      : "The same ground motion trips all modules and acts on shared RCCS, electrical distribution, spent-fuel, access, staffing, and recovery resources.",
    concurrentInitiatingEventRefs: [
      "INITIATOR-DIRECT-GROUND-MOTION",
      "INITIATOR-DIRECT-COMBINED",
    ],
    multiUnitEventSequenceRefs: isSfr ? [] : ["ES-MULTIMODULE-SEISMIC"],
    sharedHumanActionRefs: ["HFE-SEISMIC-LOCAL-ACTION", "HFE-SEISMIC-POWER-RECOVERY"],
    sharedRadioactiveSourceRefs: ["SOURCE-REACTOR", "SOURCE-SPENT-FUEL"],
    modelImplementation: isSfr
      ? "No multi-reactor sequence is added; concurrent reactor, spent-fuel, and sodium-source impacts remain explicitly coupled in the single-unit model."
      : "One common initiating event samples shared failures and resources before module-specific branch states; common actions are evaluated once and propagated to every affected module.",
    exclusionBasis: isSfr
      ? "The Generic SFR example has one reactor unit."
      : undefined,
    implementsSrs: srs("SPR-B13"),
  }];
  model.modificationsFromBaseModel = [
    "Added full-power, shutdown, spent-fuel, secondary-hazard, and combined seismic initiating-event groups.",
    "Added event sequences for soil deformation, source-specific hazards, and concurrent radioactive-material sources.",
    "Replaced constant failure probabilities for active seismic SSCs with hazard-bin conditional fragilities.",
    "Implemented fragility correlation groups and shared causal dependencies from the fragility analysis.",
    "Applied four cumulative fragility thresholds only after correlated hazard integration.",
    "Evaluated relay contact chatter against installed state, cabinet response, and system effect.",
    "Reassessed six mission times for access, aftershock, flood persistence, infrastructure, staffing, and stored-resource effects.",
    "Added seismic-specific event-sequence, success-criteria, systems, data, and human-action logic under CC-II controls.",
    "Reconciled seismic internal-flood and fire sources to source fragility and consequence models.",
    "Retained site-specific liquefaction as a coupled hazard-fragility-plant-response sequence.",
    "Retained seismically induced upstream-reservoir flooding through the complete external-flood hazard, fragility, and plant-response interface.",
    isSfr
      ? "Captured concurrent reactor, spent-fuel, and sodium-source effects within the single-unit model."
      : "Captured concurrent four-module trips, shared SSC failures, and shared response resources.",
    "Resolved applicable internal-events, internal-flood, and internal-fire peer-review findings.",
  ];
  model.completenessAndConsistencyReview =
    "The adapted model reconciles every retained initiator, active SEL failure mode, fragility and correlation group, screening threshold, chatter evaluation, operating state, radioactive-material source, base-model dependency, peer-review finding, mission time, retained secondary hazard, and applicable multi-unit effect. Independent reference checks and boundary quantifications found no orphaned or double-counted records.";
  model.implementsSrs = srs(
    "SPR-B1",
    "SPR-B2",
    "SPR-B3",
    "SPR-B4",
    "SPR-B5",
    "SPR-B6",
    "SPR-B7",
    "SPR-B8",
    "SPR-B9",
    "SPR-B10",
    "SPR-B11",
    "SPR-B12",
    "SPR-B13",
  );
}

export function populatePlantResponseModel(
  mef: SeismicPRA,
  kind: ReactorKind,
): void {
  populateInitiators(mef, kind);
  populatePlantModel(mef, kind);
}
