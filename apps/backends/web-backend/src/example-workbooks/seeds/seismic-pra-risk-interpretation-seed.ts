import { ImportanceLevel } from "interfaces-mef-types/core/shared-patterns";
import { type SeismicPRA } from "interfaces-mef-types/seismic/seismic-pra";

type ReactorKind = "sfr" | "htgr";

function rounded(value: number): number {
  return Number(value.toPrecision(6));
}

function relativeChange(previous: number, current: number): number {
  return rounded(Math.abs(current - previous) / previous);
}

export function populateRiskInterpretation(
  mef: SeismicPRA,
  kind: ReactorKind,
): void {
  const isSfr = kind === "sfr";
  const token = kind.toUpperCase();
  const quant = mef.seismicPlantResponseAnalysis.quantification;
  const humanActions =
    mef.seismicPlantResponseAnalysis.humanReliabilityModel.humanActions;
  const fieldAction = humanActions.find((action) =>
    action.controlRoomOrExControlRoom === "EX_CONTROL_ROOM"
      || action.controlRoomOrExControlRoom === "BOTH");
  const recoveryAction = humanActions.find((action) => action.recoveryAction);
  const releaseFamilies = quant.eventSequenceFamilyQuantifications.filter(
    (family) => family.releaseCategoryRef !== "RC-NO-RELEASE",
  );
  const finalMean = rounded(releaseFamilies.reduce(
    (sum, family) =>
      sum + (family.meanFrequency ?? family.pointEstimateFrequency),
    0,
  ));
  const combinedFamily = releaseFamilies.find((family) =>
    family.uuid === "ESF-QUANT-COMBINED") ?? releaseFamilies.at(-1);
  const primaryEquipment =
    mef.seismicPlantResponseAnalysis.seismicEquipmentListDevelopment
      .equipment.find((equipment) => equipment.uuid === "SEL-PRIMARY");
  const secondaryEquipment =
    mef.seismicPlantResponseAnalysis.seismicEquipmentListDevelopment
      .equipment.find((equipment) => equipment.uuid === "SEL-SECONDARY");
  const primaryName = primaryEquipment?.name
    ?? (isSfr ? "Primary sodium pump" : "Main helium circulator");
  const secondaryName = secondaryEquipment?.name
    ?? (isSfr ? "Decay-heat-removal air cooler" : "RCCS cooling panel");

  mef.riskInterpretation.refinementActions = [
    {
      uuid: "REFINEMENT-CONFIGURATION-EVIDENCE",
      name: "Confirm risk-significant configurations",
      technicalArea: "EVIDENCE",
      driverRefs: [
        "UNC-SPR-AS-BUILT",
        "CONTRIBUTOR-PRIMARY-SSC",
        "CONTRIBUTOR-SECONDARY-SSC",
      ],
      affectedRecordRefs: [
        "SEL-PRIMARY",
        "SEL-SECONDARY",
        `SEL-${token}-REACTOR-BUILDING`,
      ],
      refinement: `Reconcile the installed or intended anchorage, support load paths, clearances, cable and piping routes, and credited field-access route for ${primaryName}, ${secondaryName}, and the reactor-building common demand path.`,
      evidenceRefs: [
        `EVIDENCE-DESIGN-DRAWINGS-${token}`,
        `EVIDENCE-EQUIPMENT-QUALIFICATION-${token}`,
        `EVIDENCE-WALKDOWN-CONFIG-${token}`,
      ],
      expectedEffect: "Close configuration assumptions that can change capacity, dependency, or human-action credit.",
      priority: ImportanceLevel.HIGH,
      status: "CLOSED",
      quantificationIterationRef: "REFINEMENT-RUN-4",
      result: "The modeled configurations and alternate access route were confirmed within the evaluated bounds; no new seismic failure mode was added.",
      decisionBasis: "Retain the final SEL, fragility scope, and action-access assumptions, with construction turnover confirmation controlled as a pre-operational item.",
      implementsSrs: [
        { sr: "SPR-E6", hlr: "E" },
        { sr: "SPR-E7", hlr: "E" },
        { sr: "SPR-E8", hlr: "E" },
      ],
    },
    {
      uuid: "REFINEMENT-PLANT-DEMAND",
      name: "Refine reactor-building and foundation demand",
      technicalArea: "PLANT_DEMAND",
      driverRefs: [
        "UNC-SPR-SITE-RESPONSE",
        "CONTRIBUTOR-REACTOR-BUILDING",
        "CONTRIBUTOR-INTERMEDIATE-HAZARD-BIN",
      ],
      affectedRecordRefs: [
        "RESPONSE-PRIMARY-LOCATION",
        "CONTROL-POINT-FOUNDATION",
        "DISCRETIZATION-1",
      ],
      refinement: isSfr
        ? "Replace the bounding reactor-building transfer with the verified soil-structure-interaction ensemble for the common basemat, sodium-boundary supports, and decay-heat-removal elevations."
        : "Replace the bounding common-basemat transfer with the verified soil-structure-interaction ensemble for the reactor building, helium-service area, and RCCS support elevations.",
      evidenceRefs: [
        `EVIDENCE-SITE-INVESTIGATION-${token}`,
        "EVIDENCE-SFR-CALCS",
        "EVIDENCE-SHA-REPORT",
      ],
      expectedEffect: "Reduce avoidable response conservatism in the 0.8 to 1.8 g risk-dominant range while preserving profile uncertainty.",
      priority: ImportanceLevel.HIGH,
      status: "CLOSED",
      quantificationIterationRef: "REFINEMENT-RUN-1",
      result: "Median in-structure spectral demand at the controlling equipment elevations decreased by 5%, while the upper profile branch remained within the original bound.",
      decisionBasis: "Use the refined median demand and retain the full soil-profile and damping uncertainty in the production calculation.",
      implementsSrs: [
        { sr: "SFR-B2", hlr: "B" },
        { sr: "SFR-B3", hlr: "B" },
        { sr: "SPR-E8", hlr: "E" },
      ],
    },
    {
      uuid: "REFINEMENT-FRAGILITY",
      name: `Refine ${secondaryName} fragility`,
      technicalArea: "FRAGILITY",
      driverRefs: [
        "UNC-SPR-FRAGILITY-CAPACITY",
        "CONTRIBUTOR-SECONDARY-SSC",
      ],
      affectedRecordRefs: [
        "FRAGILITY-SECONDARY",
        "SEL-SECONDARY",
      ],
      refinement: isSfr
        ? "Use support-specific test and qualification evidence to separate air-cooler support capacity from fan functional capacity and retain the lower composite failure mode."
        : "Use panel, header-support, and connection-specific evidence to separate RCCS panel support capacity from flow-path functional capacity and retain the lower composite failure mode.",
      evidenceRefs: [
        `EVIDENCE-EQUIPMENT-QUALIFICATION-${token}`,
        "EVIDENCE-SFR-CALCS",
      ],
      expectedEffect: "Replace a generic lower-bound capacity with a mechanism-specific plant value for the leading SSC contributor.",
      priority: ImportanceLevel.HIGH,
      status: "CLOSED",
      quantificationIterationRef: "REFINEMENT-RUN-1",
      result: isSfr
        ? "The controlling median capacity increased by 6%; fan functional failure remained the controlling mode."
        : "The controlling median capacity increased by 8%; panel-support distortion remained the controlling mode.",
      decisionBasis: "Use the mechanism-specific median and uncertainty, and preserve the confirmed support configuration under configuration control.",
      implementsSrs: [
        { sr: "SFR-E3", hlr: "E" },
        { sr: "SPR-E8", hlr: "E" },
      ],
    },
    {
      uuid: "REFINEMENT-CORRELATION",
      name: "Refine common-demand correlation",
      technicalArea: "FRAGILITY",
      driverRefs: [
        "UNC-SPR-FRAGILITY-CORRELATION",
        "CONTRIBUTOR-COMBINED-FAMILY",
      ],
      affectedRecordRefs: [
        ...mef.seismicFragilityAnalysis.results.correlationGroups
          .map((group) => group.uuid),
        combinedFamily?.uuid ?? "ESF-QUANT-COMBINED",
      ],
      refinement: "Separate common structural demand, shared construction variables, and mechanism-specific capacity terms instead of applying one correlation coefficient to every co-located SSC.",
      evidenceRefs: [
        "EVIDENCE-SFR-CALCS",
        `EVIDENCE-DESIGN-DRAWINGS-${token}`,
      ],
      expectedEffect: "Represent common-cause failure realistically and bound the result between independence and perfect-correlation cases.",
      priority: ImportanceLevel.HIGH,
      status: "CLOSED",
      quantificationIterationRef: "REFINEMENT-RUN-2",
      result: "The partial-correlation model increased the combined-family mean by 4% relative to independence and remained 11% below the perfect-correlation bound.",
      decisionBasis: "Retain the mechanism-specific partial-correlation model because it preserves known common demand without forcing unrelated capacities to fail together.",
      implementsSrs: [
        { sr: "SFR-E5", hlr: "E" },
        { sr: "SPR-E6", hlr: "E" },
        { sr: "SPR-E8", hlr: "E" },
      ],
    },
    {
      uuid: "REFINEMENT-PLANT-LOGIC",
      name: "Refine shared-support and secondary-hazard logic",
      technicalArea: "PLANT_RESPONSE",
      driverRefs: [
        "UNC-SPR-SYSTEM-DEPENDENCY",
        "CONTRIBUTOR-COMBINED-FAMILY",
        "CONTRIBUTOR-LIQUEFACTION",
      ],
      affectedRecordRefs: [
        "SY-SEISMIC-MODEL",
        combinedFamily?.eventSequenceFamilyRef ?? "ESF-SEISMIC-COMBINED",
        "INITIATOR-LIQUEFACTION",
        "INITIATOR-EXTERNAL-FLOOD",
      ],
      refinement: isSfr
        ? "Model shared DC power, passive decay-heat-removal supports, sodium-boundary leakage and ignition control, liquefaction deformation, and protected external-flood access as explicit conditional dependencies."
        : "Model shared DC power, module-cooling supports, multi-module staffing, liquefaction deformation, and protected external-flood access as explicit conditional dependencies.",
      evidenceRefs: [
        `EVIDENCE-BASELINE-PRA-${token}`,
        `EVIDENCE-DESIGN-DRAWINGS-${token}`,
        "EVIDENCE-SEL",
      ],
      expectedEffect: "Remove hidden independence assumptions and prevent double counting across mutually exclusive release outcomes.",
      priority: ImportanceLevel.HIGH,
      status: "CLOSED",
      quantificationIterationRef: "REFINEMENT-RUN-2",
      result: "Explicit shared-support logic produced one new high-importance combined-family contributor; mutually exclusive release partitions removed overlapping sequence states.",
      decisionBasis: "Retain the explicit dependency model and the exact family partition in the controlled plant-response model.",
      implementsSrs: [
        { sr: "SPR-C3", hlr: "C" },
        { sr: "SPR-E2", hlr: "E" },
        { sr: "SPR-E8", hlr: "E" },
      ],
    },
    {
      uuid: "REFINEMENT-HRA",
      name: "Refine seismic field-action HEPs",
      technicalArea: "HUMAN_RELIABILITY",
      driverRefs: [
        "UNC-SPR-HUMAN-RELIABILITY",
        "CONTRIBUTOR-FIELD-ACTION",
        "CONTRIBUTOR-RECOVERY-ACTION",
      ],
      affectedRecordRefs: [
        fieldAction?.humanFailureEventRef ?? "HFE-SEISMIC-LOCAL-ACTION",
        recoveryAction?.humanFailureEventRef ?? "HFE-SEISMIC-RECOVERY",
      ],
      refinement: "Use final task timing, route obstructions, lighting, communications, staffing, aftershock restrictions, tools, and cue availability to update field-action and recovery HEPs and their within-sequence dependence.",
      evidenceRefs: [
        `EVIDENCE-PROCEDURES-${token}`,
        `EVIDENCE-WALKDOWN-CONFIG-${token}`,
        `EVIDENCE-OPERATING-EXPERIENCE-${token}`,
      ],
      expectedEffect: "Replace generic seismic performance factors with task-specific HEP distributions and prevent unsupported recovery credit.",
      priority: ImportanceLevel.MEDIUM,
      status: "CLOSED",
      quantificationIterationRef: "REFINEMENT-RUN-3",
      result: "The field-action mean HEP increased by 12%; recovery credit was retained only for the modeled intact-target and accessible-route conditions.",
      decisionBasis: "Use the task-specific HEPs and dependencies; require procedure validation and route confirmation before operation.",
      implementsSrs: [
        { sr: "SPR-D5", hlr: "D" },
        { sr: "SPR-D6", hlr: "D" },
        { sr: "SPR-E8", hlr: "E" },
      ],
    },
  ];

  const runMeans = [
    rounded(finalMean * 1.19),
    rounded(finalMean * 1.075),
    rounded(finalMean * 1.026),
    rounded(finalMean * 1.012),
    finalMean,
  ];
  const runData = [
    {
      uuid: "REFINEMENT-RUN-0",
      name: "Baseline quantification",
      modelVersion: `${token}-S-PRA 0.7`,
      calculationDate: "2026-06-10",
      actionRefs: [] as string[],
      maxFamilyChange: undefined,
      rankingStable: false,
      newRefs: [] as string[],
      decision: "CONTINUE_REFINEMENT" as const,
      basis: "The preliminary model identified dominant plant-demand, fragility, correlation, shared-support, and HRA contributors requiring focused refinement.",
    },
    {
      uuid: "REFINEMENT-RUN-1",
      name: "Demand and fragility refinement",
      modelVersion: `${token}-S-PRA 0.8`,
      calculationDate: "2026-06-13",
      actionRefs: [
        "REFINEMENT-PLANT-DEMAND",
        "REFINEMENT-FRAGILITY",
      ],
      maxFamilyChange: 0.14,
      rankingStable: false,
      newRefs: ["CONTRIBUTOR-COMBINED-FAMILY"],
      decision: "CONTINUE_REFINEMENT" as const,
      basis: "The aggregate result changed materially and the combined release family entered the risk-significant set.",
    },
    {
      uuid: "REFINEMENT-RUN-2",
      name: "Dependency and plant-logic refinement",
      modelVersion: `${token}-S-PRA 0.9`,
      calculationDate: "2026-06-17",
      actionRefs: [
        "REFINEMENT-CORRELATION",
        "REFINEMENT-PLANT-LOGIC",
      ],
      maxFamilyChange: 0.078,
      rankingStable: false,
      newRefs: ["CONTRIBUTOR-EXTERNAL-FLOOD"],
      decision: "CONTINUE_REFINEMENT" as const,
      basis: "Family-specific change remained above the five-percent criterion and one retained secondary-hazard contributor required confirmation.",
    },
    {
      uuid: "REFINEMENT-RUN-3",
      name: "HRA and secondary-hazard confirmation",
      modelVersion: `${token}-S-PRA 0.95`,
      calculationDate: "2026-06-20",
      actionRefs: ["REFINEMENT-HRA"],
      maxFamilyChange: 0.041,
      rankingStable: true,
      newRefs: [] as string[],
      decision: "CONTINUE_REFINEMENT" as const,
      basis: "All numerical criteria were met for one run, but the stopping rule requires two consecutive stable iterations.",
    },
    {
      uuid: "REFINEMENT-RUN-4",
      name: "Final stability confirmation",
      modelVersion: `${token}-S-PRA 1.0`,
      calculationDate: "2026-06-22",
      actionRefs: ["REFINEMENT-CONFIGURATION-EVIDENCE"],
      maxFamilyChange: 0.036,
      rankingStable: true,
      newRefs: [] as string[],
      decision: "ACCEPT_STABLE" as const,
      basis: "Two consecutive runs met the aggregate and family-change criteria, contributor rank shift did not exceed one position, and no new risk-significant contributor appeared.",
    },
  ];
  const topContributorRefs = [
    "CONTRIBUTOR-SECONDARY-SSC",
    "CONTRIBUTOR-PRIMARY-SSC",
    "CONTRIBUTOR-COMBINED-FAMILY",
    "CONTRIBUTOR-REACTOR-BUILDING",
    "CONTRIBUTOR-INTERMEDIATE-HAZARD-BIN",
  ];
  mef.riskInterpretation.quantificationIterations = runData.map(
    (run, index) => ({
      uuid: run.uuid,
      name: run.name,
      modelVersion: run.modelVersion,
      calculationDate: run.calculationDate,
      refinementActionRefs: run.actionRefs,
      aggregateReleaseFamilyMeanFrequency: runMeans[index]!,
      previousAggregateReleaseFamilyMeanFrequency:
        index === 0 ? undefined : runMeans[index - 1],
      relativeChange: index === 0
        ? undefined
        : relativeChange(runMeans[index - 1]!, runMeans[index]!),
      maximumFamilyRelativeChange: run.maxFamilyChange,
      topContributorRefs,
      contributorRankingStable: run.rankingStable,
      newRiskSignificantContributorRefs: run.newRefs,
      decision: run.decision,
      basis: run.basis,
      implementsSrs: [
        { sr: "SPR-E4", hlr: "E" },
        { sr: "SPR-E8", hlr: "E" },
      ],
    }),
  );

  mef.riskInterpretation.stoppingCriteria = {
    maximumAggregateFrequencyChange: 0.02,
    maximumFamilyFrequencyChange: 0.05,
    maximumContributorRankShift: 1,
    requiredStableIterations: 2,
    requireNoNewRiskSignificantContributors: true,
    basis: "Stop only after two consecutive requantifications change the aggregate release-family mean by no more than 2%, change every release-family mean by no more than 5%, shift the leading contributor ranks by no more than one position, and identify no new risk-significant contributor. Relative contributor review retains enough contributors to represent at least 95% of the applicable contribution measure.",
  };
}
