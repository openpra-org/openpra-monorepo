import { DistributionType } from "interfaces-mef-types/core/events";
import { type SRReference } from "interfaces-mef-types/core/pra-common";
import { ImportanceLevel } from "interfaces-mef-types/core/shared-patterns";
import { type SeismicPRA } from "interfaces-mef-types/seismic/seismic-pra";

type ReactorKind = "sfr" | "htgr";
type Spr = SeismicPRA["seismicPlantResponseAnalysis"];
type Quantification = Spr["quantification"];
type FamilyQuantification =
  Quantification["eventSequenceFamilyQuantifications"][number];
type HazardInterval =
  SeismicPRA["seismicHazardAnalysis"]["hazardQuantification"]["seismicPraInputs"]["hazardIntervals"][number];

interface FamilySeed {
  id: string;
  name: string;
  familyRef: string;
  initiators: string[];
  sequences: string[];
  releaseCategory: string;
  sourceTerm?: string;
  point: number;
  mean: number;
  median: number;
  errorFactor: number;
  weights: number[];
}

function srs(...codes: string[]): SRReference[] {
  return codes.map((sr) => ({
    sr,
    hlr: sr.split("-")[1]!.charAt(0) as SRReference["hlr"],
  }));
}

function rounded(value: number): number {
  return Number(value.toPrecision(7));
}

function contributions(
  intervals: HazardInterval[],
  total: number,
  weights: number[],
): FamilyQuantification["hazardBinContributions"] {
  const weightTotal = weights.reduce((sum, value) => sum + value, 0);
  let assigned = 0;
  return intervals.map((interval, index) => {
    const frequencyContribution = index === intervals.length - 1
      ? rounded(total - assigned)
      : rounded(total * (weights[index] ?? 0) / weightTotal);
    assigned += frequencyContribution;
    return {
      binRef: `SPR-${interval.uuid}`,
      frequencyContribution,
    };
  });
}

function familySeeds(kind: ReactorKind): FamilySeed[] {
  const isSfr = kind === "sfr";
  return [
    {
      id: "ESF-QUANT-STABLE",
      name: isSfr
        ? "Stable passive decay-heat removal"
        : "Stable passive module cooling",
      familyRef: "ESF-SEISMIC-STABLE",
      initiators: ["INITIATOR-DIRECT-GROUND-MOTION"],
      sequences: ["ES-SEISMIC-SUCCESS"],
      releaseCategory: "RC-NO-RELEASE",
      point: isSfr ? 1.72e-4 : 2.08e-4,
      mean: isSfr ? 1.79e-4 : 2.16e-4,
      median: isSfr ? 1.47e-4 : 1.81e-4,
      errorFactor: 2.2,
      weights: [0.42, 0.29, 0.16, 0.075, 0.036, 0.014, 0.004, 0.001],
    },
    {
      id: "ESF-QUANT-DAMAGE",
      name: isSfr
        ? "Reactor heat-removal challenge"
        : "Module fuel heat-up challenge",
      familyRef: "ESF-SEISMIC-DAMAGE",
      initiators: [
        "INITIATOR-DIRECT-GROUND-MOTION",
        "INITIATOR-DIRECT-SHUTDOWN",
      ],
      sequences: ["ES-SEISMIC-DAMAGE"],
      releaseCategory: "RC-SEISMIC-LIMITED-RELEASE",
      sourceTerm: isSfr ? "MS-SFR-REACTOR-RELEASE" : "MS-HTGR-FUEL-RELEASE",
      point: isSfr ? 9.8e-6 : 7.1e-6,
      mean: isSfr ? 1.08e-5 : 7.8e-6,
      median: isSfr ? 7.9e-6 : 5.7e-6,
      errorFactor: isSfr ? 3.4 : 3.2,
      weights: [0.01, 0.04, 0.12, 0.24, 0.28, 0.2, 0.09, 0.02],
    },
    {
      id: "ESF-QUANT-SHUTDOWN",
      name: isSfr
        ? "Shutdown decay-heat-removal challenge"
        : "Shutdown module-cooling challenge",
      familyRef: "ESF-SEISMIC-SHUTDOWN",
      initiators: ["INITIATOR-DIRECT-SHUTDOWN"],
      sequences: ["ES-SEISMIC-SHUTDOWN"],
      releaseCategory: "RC-SHUTDOWN-LIMITED-RELEASE",
      sourceTerm: isSfr ? "MS-SFR-SHUTDOWN-RELEASE" : "MS-HTGR-SHUTDOWN-RELEASE",
      point: isSfr ? 2.45e-6 : 1.85e-6,
      mean: isSfr ? 2.7e-6 : 2.05e-6,
      median: isSfr ? 1.9e-6 : 1.46e-6,
      errorFactor: 3.6,
      weights: [0.02, 0.07, 0.16, 0.25, 0.25, 0.16, 0.07, 0.02],
    },
    {
      id: "ESF-QUANT-SPENT-FUEL",
      name: isSfr
        ? "Spent-fuel vessel cooling challenge"
        : "Spent-fuel vault cooling challenge",
      familyRef: "ESF-SEISMIC-SPENT-FUEL",
      initiators: ["INITIATOR-DIRECT-SPENT-FUEL"],
      sequences: ["ES-SEISMIC-SPENT-FUEL"],
      releaseCategory: "RC-SPENT-FUEL-RELEASE",
      sourceTerm: isSfr ? "MS-SFR-SPENT-FUEL-RELEASE" : "MS-HTGR-SPENT-FUEL-RELEASE",
      point: isSfr ? 1.42e-6 : 1.16e-6,
      mean: isSfr ? 1.61e-6 : 1.32e-6,
      median: isSfr ? 1.06e-6 : 8.6e-7,
      errorFactor: 4,
      weights: [0.01, 0.04, 0.11, 0.22, 0.28, 0.21, 0.1, 0.03],
    },
    {
      id: "ESF-QUANT-LIQUEFACTION",
      name: "Liquefaction-induced support loss",
      familyRef: "ESF-SEISMIC-LIQUEFACTION",
      initiators: ["INITIATOR-LIQUEFACTION"],
      sequences: ["ES-SEISMIC-LIQUEFACTION"],
      releaseCategory: "RC-SEISMIC-LIMITED-RELEASE",
      sourceTerm: isSfr ? "MS-SFR-REACTOR-RELEASE" : "MS-HTGR-FUEL-RELEASE",
      point: isSfr ? 1.18e-6 : 8.4e-7,
      mean: isSfr ? 1.39e-6 : 1.01e-6,
      median: isSfr ? 8.2e-7 : 5.8e-7,
      errorFactor: 4.6,
      weights: [0, 0, 0.02, 0.12, 0.28, 0.3, 0.2, 0.08],
    },
    {
      id: "ESF-QUANT-EXTERNAL-FLOOD",
      name: "Seismically induced upstream-reservoir flooding",
      familyRef: "ESF-SEISMIC-EXTERNAL-FLOOD",
      initiators: ["INITIATOR-EXTERNAL-FLOOD"],
      sequences: ["ES-SEISMIC-EXTERNAL-FLOOD"],
      releaseCategory: "RC-SEISMIC-LIMITED-RELEASE",
      sourceTerm: isSfr ? "MS-SFR-REACTOR-RELEASE" : "MS-HTGR-FUEL-RELEASE",
      point: isSfr ? 2.2e-7 : 1.4e-7,
      mean: isSfr ? 3e-7 : 1.9e-7,
      median: isSfr ? 1.3e-7 : 8e-8,
      errorFactor: 5.5,
      weights: [0, 0, 0.01, 0.09, 0.27, 0.33, 0.22, 0.08],
    },
    {
      id: "ESF-QUANT-COMBINED",
      name: isSfr
        ? "Seismic sodium-boundary release and fire"
        : "Common-cause multi-module challenge",
      familyRef: isSfr
        ? "ESF-SEISMIC-SODIUM"
        : "ESF-MULTIMODULE-SEISMIC",
      initiators: ["INITIATOR-DIRECT-COMBINED"],
      sequences: [
        isSfr ? "ES-SEISMIC-SODIUM" : "ES-MULTIMODULE-SEISMIC",
      ],
      releaseCategory: isSfr
        ? "RC-SODIUM-FIRE-RELEASE"
        : "RC-MULTIMODULE-RELEASE",
      sourceTerm: isSfr ? "MS-SFR-SODIUM-RELEASE" : "MS-HTGR-MULTIMODULE-RELEASE",
      point: isSfr ? 5.55e-6 : 2.58e-6,
      mean: isSfr ? 6.2e-6 : 2.93e-6,
      median: isSfr ? 4.22e-6 : 1.87e-6,
      errorFactor: isSfr ? 3.8 : 4.1,
      weights: [0, 0.01, 0.05, 0.16, 0.29, 0.27, 0.16, 0.06],
    },
  ];
}

const REQUIRED_ESQ_REQUIREMENTS = [
  "ESQ-A4", "ESQ-A6", "ESQ-A7",
  "ESQ-B1", "ESQ-B2", "ESQ-B3", "ESQ-B5", "ESQ-B6", "ESQ-B7",
  "ESQ-B8", "ESQ-B9", "ESQ-B10",
  "ESQ-C1", "ESQ-C2", "ESQ-C3", "ESQ-C4", "ESQ-C5", "ESQ-C6",
  "ESQ-C7", "ESQ-C8", "ESQ-C9", "ESQ-C10", "ESQ-C11", "ESQ-C12",
  "ESQ-C13", "ESQ-C14", "ESQ-C15", "ESQ-C16", "ESQ-C17",
  "ESQ-D1", "ESQ-D2", "ESQ-D3", "ESQ-D5", "ESQ-D6", "ESQ-D7",
] as const;

function esqEvidence(requirement: string): string {
  if (requirement.startsWith("ESQ-A")) {
    return "Each seismic family is quantified per plant-year from mutually exclusive hazard bins; success and release outcomes retain their initiating-event, sequence, truncation, and screening bases.";
  }
  if (requirement.startsWith("ESQ-B")) {
    return "The linked event-tree and fault-tree solution preserves shared events and dependencies, applies Boolean flag and mutual-exclusion rules before cutset generation, and retains individual events inside modules for review.";
  }
  if (["ESQ-C7", "ESQ-C8", "ESQ-C9"].includes(requirement)) {
    return "No post-release equipment-survival or operator-action credit is used in the seismic family quantification, so the adverse-environment credit requirement is not applicable.";
  }
  if (requirement.startsWith("ESQ-C")) {
    return "Seismic functional, physical, human, phenomenological, and radionuclide-barrier dependencies are represented in the sequence logic, fragility links, HFE dependencies, and design-specific barrier evaluations.";
  }
  return "Independent review samples risk-significant and non-risk-significant solutions, checks model and operational consistency, verifies flag and recovery rules, and reconciles contributor rankings with the linked plant model.";
}

function sensitivities(kind: ReactorKind): Quantification["sensitivityStudies"] {
  const isSfr = kind === "sfr";
  return [
    {
      uuid: "SENS-SPR-HAZARD-BRANCHES",
      name: "Hazard logic-tree branches",
      description: "Requantify all families using the weighted lower and upper credible hazard branch combinations.",
      variedParameters: ["hazardBranchWeight", "groundMotionMedian"],
      parameterRanges: { hazardBranchWeight: [0.05, 0.35], groundMotionMedian: [0.82, 1.24] },
      results: isSfr
        ? "Total release-family mean frequency changes from 1.42E-5 to 3.91E-5 per plant-year."
        : "Total release-family mean frequency changes from 9.0E-6 to 2.31E-5 per plant-year.",
      insights: "Hazard epistemic branches control the total range, but the leading sequence families and SSC contributors do not change.",
      impact: "High effect on magnitude; low effect on ranking.",
      modelUncertaintyId: "UNC-SPR-HAZARD-BRANCHES",
      implementsSrs: srs("SPR-E6", "SPR-E8"),
    },
    {
      uuid: "SENS-SPR-SITE-RESPONSE",
      name: "Nonlinear site-response alternative",
      description: "Compare equivalent-linear and nonlinear profile ensembles while preserving the same outcrop input motions.",
      variedParameters: ["profileWeight", "modulusReductionScale"],
      parameterRanges: { profileWeight: [0.1, 0.55], modulusReductionScale: [0.85, 1.15] },
      results: "Release-family mean frequency changes by -11% to +17%; the 0.8 to 1.8 g bins carry most of the effect.",
      insights: "Foundation motion uncertainty is important but does not create a new dominant family.",
      impact: "Moderate integrated impact.",
      modelUncertaintyId: "UNC-SPR-SITE-RESPONSE",
      implementsSrs: srs("SPR-E6", "SPR-E8"),
    },
    {
      uuid: "SENS-SPR-FRAGILITY-MEDIAN",
      name: "Risk-significant median capacities",
      description: "Scale median capacities for the leading active and passive SSC fragilities together and separately.",
      variedParameters: ["medianCapacityScale"],
      parameterRanges: { medianCapacityScale: [0.8, 1.2] },
      results: isSfr
        ? "Total release-family mean frequency changes by -29% to +48%."
        : "Total release-family mean frequency changes by -25% to +42%.",
      insights: "Configuration control for the leading heat-removal SSCs provides the strongest practical risk leverage.",
      impact: "High effect on total release-family frequency.",
      modelUncertaintyId: "UNC-SPR-FRAGILITY-CAPACITY",
      implementsSrs: srs("SPR-E6", "SPR-E8"),
    },
    {
      uuid: "SENS-SPR-FRAGILITY-CORRELATION",
      name: "Fragility correlation",
      description: "Solve independent, partial-correlation, and common-cause alternatives for co-located equipment and shared structures.",
      variedParameters: ["correlationCoefficient"],
      parameterRanges: { correlationCoefficient: [0, 1] },
      results: isSfr
        ? "The combined sodium-boundary family changes by -14% to +27%."
        : "The multi-module family changes by -18% to +36%.",
      insights: "Partial correlation remains the central model; perfect correlation is retained as a bounding sensitivity.",
      impact: "High for the combined family; moderate for total frequency.",
      modelUncertaintyId: "UNC-SPR-FRAGILITY-CORRELATION",
      implementsSrs: srs("SPR-E6", "SPR-E8"),
    },
    {
      uuid: "SENS-SPR-SYSTEM-DEPENDENCY",
      name: "Support-system dependency",
      description: "Challenge the treatment of shared DC power, support cooling, and common structural response in the sequence logic.",
      variedParameters: ["sharedSupportFailureProbability"],
      parameterRanges: { sharedSupportFailureProbability: [0.35, 1] },
      results: "The leading damage-family mean changes by -9% to +22%; no screened family becomes risk significant.",
      insights: "Explicit shared-support logic is retained because an independence assumption understates the combined-event family.",
      impact: "Moderate effect on the leading families.",
      modelUncertaintyId: "UNC-SPR-SYSTEM-DEPENDENCY",
      implementsSrs: srs("SPR-E6", "SPR-E8"),
    },
    {
      uuid: "SENS-SPR-HRA",
      name: "Seismic HEP uncertainty",
      description: "Propagate the HEP distributions and repeat the solution with lower- and upper-bound seismic performance-shaping factors.",
      variedParameters: ["humanErrorProbabilityScale"],
      parameterRanges: { humanErrorProbabilityScale: [0.5, 2] },
      results: "Total release-family mean frequency changes by -6% to +13%; field actions dominate the upper change.",
      insights: "Route qualification, lighting, communications, and procedure validation should be preserved through final design.",
      impact: "Moderate effect with a clear closure action.",
      modelUncertaintyId: "UNC-SPR-HUMAN-RELIABILITY",
      implementsSrs: srs("SPR-E6", "SPR-E8"),
    },
    {
      uuid: "SENS-SPR-RARE-EVENT",
      name: "Exact rare-event solution",
      description: "Compare the rare-event cutset sum with exact Boolean or conditional split-fraction solutions in saturated fragility bins.",
      variedParameters: ["conditionalFailureProbabilityCap"],
      parameterRanges: { conditionalFailureProbabilityCap: [0.95, 1] },
      results: "The uncorrected solution overstates total release-family frequency by 6.1%; contributor ordering is unchanged after correction.",
      insights: "The corrected Boolean solution is required above the fragility saturation threshold.",
      impact: "Material numerical bias if left uncorrected.",
      modelUncertaintyId: "UNC-SPR-RARE-EVENT",
      implementsSrs: srs("SPR-E2", "SPR-E6", "SPR-E8"),
    },
    {
      uuid: "SENS-SPR-AS-BUILT",
      name: "Pre-operational configuration",
      description: "Requantify credible final anchorage, routing, procedure, and shared-support alternatives that remain open before construction closeout.",
      variedParameters: ["capacityScale", "fieldActionTimeScale"],
      parameterRanges: { capacityScale: [0.9, 1.1], fieldActionTimeScale: [0.85, 1.25] },
      results: "The combined alternatives change total release-family mean frequency by -12% to +24%; no new dominant family appears.",
      insights: "The open assumptions are suitable for pre-operational decisions but must close before operational application.",
      impact: "Moderate and explicitly configuration dependent.",
      modelUncertaintyId: "UNC-SPR-AS-BUILT",
      implementsSrs: srs("SPR-E7", "SPR-E8"),
    },
  ];
}

function preOperationalAssumptions(
  kind: ReactorKind,
): NonNullable<Spr["preOperationalAssumptions"]> {
  const isSfr = kind === "sfr";
  const prefix = kind.toUpperCase();
  return [
    {
      uuid: `PREOP-${prefix}-ANCHORAGE`,
      assumptionId: `SPR-${prefix}-PREOP-01`,
      description: "Final installed anchorage and support details remain bounded by the fragility input configurations.",
      impact: "A lower installed capacity could increase the leading equipment-failure contribution.",
      rationale: "Issued-for-construction loads, anchor schedules, and conservative installation tolerances support the current median capacities.",
      references: [`${prefix}-IFC-ANCHORAGE-REGISTER-2026`],
      isPreOperational: true,
      addressingPlans: "Reconcile the SEL to as-built anchor records and inspection results.",
      status: "IN_PROGRESS",
      limitations: ["Not suitable for operational configuration-change decisions until as-built reconciliation is complete."],
      influenceOnDefinition: "Controls the median-capacity alternative for the leading active and passive SSC fragilities.",
      riskImpact: ImportanceLevel.HIGH,
      closureBasis: "Approved as-built drawings, installation inspections, and fragility reconciliation show no adverse unmodeled condition.",
      plannedClosureActions: ["Complete anchorage walkdown", "Resolve deviations", "Rerun affected fragilities and family results"],
      affectedElementIds: ["SEL-PRIMARY", "SEL-SECONDARY", "ESF-QUANT-DAMAGE"],
      implementsSrs: srs("SPR-E7"),
      affectedTechnicalElementCodes: ["SFR", "SPR"],
      potentialAlternatives: ["Reduce median capacities by ten percent", "Model installation-specific fragilities"],
      owner: "Seismic capability lead",
    },
    {
      uuid: `PREOP-${prefix}-PROCEDURES`,
      assumptionId: `SPR-${prefix}-PREOP-02`,
      description: "Planned seismic response procedures, staffing, cues, and field routes support the credited human actions.",
      impact: "Longer action times or unavailable cues increase the field-action HEP contribution.",
      rationale: "Procedure drafts, staffing plans, simulator walk-throughs, and route reviews support the modeled action windows.",
      references: [`${prefix}-SEISMIC-PROCEDURE-DEVELOPMENT-2026`],
      isPreOperational: true,
      addressingPlans: "Validate final procedures and action timing with the operating crew.",
      status: "IN_PROGRESS",
      limitations: ["Credited field actions require final route and communication validation."],
      influenceOnDefinition: "Defines the central HEPs, task times, cues, and dependency treatment used in quantification.",
      riskImpact: ImportanceLevel.MEDIUM,
      closureBasis: "Validated procedures and timed crew exercises remain within modeled action windows and HEP bases.",
      plannedClosureActions: ["Complete simulator validation", "Time field routes", "Update HRA distributions"],
      affectedElementIds: ["HRA-SEISMIC-2026", "SENS-SPR-HRA"],
      implementsSrs: srs("SPR-E7"),
      affectedTechnicalElementCodes: ["HR", "SPR"],
      potentialAlternatives: ["Use upper-bound HEPs", "Remove field-action credit"],
      owner: "Human reliability lead",
    },
    {
      uuid: `PREOP-${prefix}-SITE`,
      assumptionId: `SPR-${prefix}-PREOP-03`,
      description: "The selected soil-profile ensemble bounds final excavation and foundation conditions.",
      impact: "A profile outside the ensemble could shift foundation motion and the hazard-bin contribution pattern.",
      rationale: "Borehole, geophysical, laboratory, and profile-weight evidence spans the current building footprint.",
      references: [`${prefix}-GEOTECHNICAL-DATA-REPORT-2026`],
      isPreOperational: true,
      addressingPlans: "Compare excavation acceptance and foundation records to the modeled profile ensemble.",
      status: "IN_PROGRESS",
      limitations: ["Foundation-input results remain conditional on final geotechnical confirmation."],
      influenceOnDefinition: "Controls the site-response branch weights propagated through fragility demand and family frequencies.",
      riskImpact: ImportanceLevel.MEDIUM,
      closureBasis: "Excavation and foundation acceptance data fall within the modeled profile ranges.",
      plannedClosureActions: ["Review excavation data", "Confirm foundation elevation", "Update profile weights if required"],
      affectedElementIds: ["SITE-PROFILE-BEST-ESTIMATE", "DISCRETIZATION-1"],
      implementsSrs: srs("SPR-E7"),
      affectedTechnicalElementCodes: ["SHA", "SFR", "SPR"],
      potentialAlternatives: ["Shift weight to the soft profile", "Add a foundation-specific response branch"],
      owner: "Geotechnical lead",
    },
    {
      uuid: `PREOP-${prefix}-ELECTRICAL`,
      assumptionId: `SPR-${prefix}-PREOP-04`,
      description: "Final protection, DC-power, and cable routing preserve the modeled separation and dependency boundaries.",
      impact: "Unrecognized shared routing can increase common-cause failure and change the leading combined-event family.",
      rationale: "Current one-line diagrams, routing models, and room layouts support the modeled train boundaries.",
      references: [`${prefix}-ELECTRICAL-ROUTING-MODEL-2026`],
      isPreOperational: true,
      addressingPlans: "Reconcile final cable schedules, cabinet locations, and penetrations to the systems model.",
      status: "OPEN",
      limitations: ["Shared-routing insights are preliminary until final installation records are available."],
      influenceOnDefinition: "Controls shared-support dependencies, contact-chatter scope, and correlation group membership.",
      riskImpact: ImportanceLevel.HIGH,
      closureBasis: "As-built routing and cabinet configuration match the modeled separation or are incorporated into a revised solution.",
      plannedClosureActions: ["Complete routing reconciliation", "Walk down shared penetrations", "Resolve dependency changes"],
      affectedElementIds: ["SY-DC-POWER", "CORR-DC-POWER", "ESF-QUANT-COMBINED"],
      implementsSrs: srs("SPR-E7"),
      affectedTechnicalElementCodes: ["SY", "SFR", "SPR"],
      potentialAlternatives: ["Model complete dependence", "Add route-specific basic events"],
      owner: "Systems analysis lead",
    },
    {
      uuid: `PREOP-${prefix}-DESIGN-SPECIFIC`,
      assumptionId: `SPR-${prefix}-PREOP-05`,
      description: isSfr
        ? "Final sodium-boundary supports, leak collection, and fire mitigation remain consistent with the modeled combined seismic sequence."
        : "Final module shared-support design and RCCS configuration remain consistent with the modeled multi-module sequence.",
      impact: isSfr
        ? "Different sodium release or mitigation behavior could change the sodium-family frequency and source term."
        : "Additional shared dependencies could increase the multi-module family frequency.",
      rationale: isSfr
        ? "The current piping, guard-vessel, drainage, and fire-protection design bounds the reference release paths."
        : "The current shared electrical, service-area, and passive heat-rejection design bounds the reference common-cause paths.",
      references: [isSfr ? "SFR-SODIUM-SAFETY-DESIGN-2026" : "HTGR-MULTIMODULE-SUPPORT-DESIGN-2026"],
      isPreOperational: true,
      addressingPlans: "Confirm the design-specific shared and secondary effects at final design.",
      status: "IN_PROGRESS",
      limitations: ["The combined-event family is not final until design-specific closeout is complete."],
      influenceOnDefinition: "Defines the design-specific combined family, affected SSCs, fragilities, and mitigation dependencies.",
      riskImpact: ImportanceLevel.HIGH,
      closureBasis: "Final design reconciliation confirms the current model or a revised sensitivity remains within the application acceptance basis.",
      plannedClosureActions: ["Complete design reconciliation", "Close open interfaces", "Rerun the combined family"],
      affectedElementIds: ["INITIATOR-DIRECT-COMBINED", "ESF-QUANT-COMBINED"],
      implementsSrs: srs("SPR-E7"),
      affectedTechnicalElementCodes: ["SPR", "SFR", "MS"],
      potentialAlternatives: ["Use the bounding combined-event sensitivity", "Add design-specific split fractions"],
      owner: "Seismic PRA lead",
    },
  ];
}

export function populateQuantification(
  mef: SeismicPRA,
  kind: ReactorKind,
): void {
  const isSfr = kind === "sfr";
  const spr = mef.seismicPlantResponseAnalysis;
  const quant = spr.quantification;
  const intervals = mef.seismicHazardAnalysis.hazardQuantification
    .seismicPraInputs.hazardIntervals;
  const fragilityRefs = mef.seismicFragilityAnalysis.results
    .fragilityEvaluations.map((evaluation) => evaluation.uuid);
  const seeds = familySeeds(kind).sort((left, right) =>
    left.id === "ESF-QUANT-STABLE"
      ? 1
      : right.id === "ESF-QUANT-STABLE"
        ? -1
        : 0);

  quant.eventSequenceFamilyQuantifications = seeds.map((seed) => ({
    uuid: seed.id,
    name: seed.name,
    eventSequenceFamilyRef: seed.familyRef,
    initiatingEventRefs: seed.initiators,
    eventSequenceRefs: seed.sequences,
    releaseCategoryRef: seed.releaseCategory,
    sourceTermRef: seed.sourceTerm,
    hazardDiscretizationRef: "DISCRETIZATION-1",
    meanHazardUsed: true,
    meanFragilitiesUsed: true,
    pointEstimateFrequency: seed.point,
    meanFrequency: seed.mean,
    frequencyUnit: "PER_PLANT_YEAR",
    frequencyDistribution: {
      type: DistributionType.LOGNORMAL,
      median: seed.median,
      errorFactor: seed.errorFactor,
    },
    hazardBinContributions: contributions(intervals, seed.mean, seed.weights),
    uncertaintyContributions: [
      {
        sourceType: "HAZARD",
        sourceRef: "GM-LT-1",
        contributionDescription: "Source and ground-motion logic-tree branches are sampled with their state-of-knowledge weights.",
      },
      {
        sourceType: "HAZARD",
        sourceRef: "SITE-RESPONSE-BRANCHES",
        contributionDescription: "Profile, modulus-reduction, damping, and foundation-input branches preserve site-response epistemic uncertainty.",
      },
      {
        sourceType: "FRAGILITY",
        sourceRef: "SFR-CAPACITY-DISTRIBUTIONS",
        contributionDescription: "Median capacities and beta components are sampled for every linked active and passive SSC failure mode.",
      },
      {
        sourceType: "FRAGILITY",
        sourceRef: "SFR-CORRELATION-GROUPS",
        contributionDescription: "Common demand and capacity dependencies are sampled by the stored partial and causal correlation models.",
      },
      {
        sourceType: "SYSTEMS",
        sourceRef: "SY-SEISMIC-MODEL",
        contributionDescription: "Systems, support-system, sequence, flag, and recovery dependencies are solved in each sample.",
      },
      {
        sourceType: "SYSTEMS",
        sourceRef: `${kind.toUpperCase()}-SEISMIC-HRA-2026`,
        contributionDescription: "Seismic HEP distributions and within-sequence dependence are propagated with the systems logic.",
      },
    ],
    truncationAndScreeningTreatment: "Cutset truncation is refined until each family changes by less than 0.5%; excluded high-capacity SSCs remain bounded by the cumulative SCR-2 calculation, and the final hazard bin extends through fragility saturation.",
    quantificationMethod: "Conditional fragility probabilities are evaluated at each representative ground motion, the dependent event-sequence logic is solved, the result is multiplied by the non-overlapping bin frequency, and the bin results are summed per plant-year.",
    implementsSrs: srs("SPR-E1", "SPR-E3", "SPR-E4", "SPR-E5"),
  }));

  const releaseFamilies = quant.eventSequenceFamilyQuantifications.filter(
    (family) => family.releaseCategoryRef !== "RC-NO-RELEASE",
  );
  const totalReleaseFrequency = releaseFamilies.reduce(
    (sum, family) => sum + (family.meanFrequency ?? family.pointEstimateFrequency),
    0,
  );
  const familyRefs = quant.eventSequenceFamilyQuantifications.map(
    (family) => family.eventSequenceFamilyRef,
  );
  const binTotals = new Map<string, number>();
  for (const family of quant.eventSequenceFamilyQuantifications) {
    for (const contribution of family.hazardBinContributions) {
      binTotals.set(
        contribution.binRef,
        (binTotals.get(contribution.binRef) ?? 0)
          + contribution.frequencyContribution,
      );
    }
  }
  const allFamilyFrequency = quant.eventSequenceFamilyQuantifications.reduce(
    (sum, family) => sum + (family.meanFrequency ?? family.pointEstimateFrequency),
    0,
  );

  quant.hazardDiscretizations = [{
    uuid: "DISCRETIZATION-1",
    name: "1 Hz spectral-acceleration integration mesh",
    hazardCurveRefs: ["HAZARD-CURVE-MEAN-1HZ"],
    bins: intervals.map((interval) => ({
      uuid: `SPR-${interval.uuid}`,
      name: interval.name,
      hazardCurveRef: interval.sourceHazardCurveRef,
      lowerGroundMotion: interval.lowerGroundMotion,
      upperGroundMotion: interval.upperGroundMotion,
      representativeGroundMotion: interval.representativeGroundMotion,
      groundMotionUnits: interval.groundMotionUnits,
      annualFrequency: interval.annualFrequency,
      conditionalFrequencyMethod: interval.frequencyCalculationMethod,
      fragilityEvaluationRefs: [...fragilityRefs],
      eventSequenceFamilyRefs: [...familyRefs],
      contributionToRiskMetric: rounded(
        (binTotals.get(`SPR-${interval.uuid}`) ?? 0) / allFamilyFrequency,
      ),
    })),
    numericalMethod: "Difference-of-exceedance bin frequencies with geometric representative motion and conditional fragility/system solution at each bin.",
    convergenceMetric: "Total mean frequency of release event-sequence families",
    convergenceTolerance: 0.02,
    convergenceStudies: [
      { binCount: 4, metricValue: rounded(totalReleaseFrequency * 1.16), relativeChange: 0.16 },
      { binCount: 6, metricValue: rounded(totalReleaseFrequency * 1.055), relativeChange: 0.091 },
      { binCount: 8, metricValue: rounded(totalReleaseFrequency * 1.012), relativeChange: 0.012 },
      { binCount: 12, metricValue: rounded(totalReleaseFrequency), relativeChange: 0.004 },
    ],
    converged: true,
    basis: "The eight-bin production mesh and a twelve-bin confirmation mesh both change the total release-family frequency by less than the two-percent criterion and preserve the leading family and contributor rankings.",
    implementsSrs: srs("SPR-E1", "SPR-E3"),
  }];

  const dominantFragilities = fragilityRefs.slice(0, 8);
  const damage = quant.eventSequenceFamilyQuantifications.find(
    (family) => family.uuid === "ESF-QUANT-DAMAGE",
  )!;
  const combined = quant.eventSequenceFamilyQuantifications.find(
    (family) => family.uuid === "ESF-QUANT-COMBINED",
  )!;
  const externalFlood = quant.eventSequenceFamilyQuantifications.find(
    (family) => family.uuid === "ESF-QUANT-EXTERNAL-FLOOD",
  )!;
  quant.rareEventApproximationAssessments = [
    {
      uuid: "RARE-EVENT-SATURATED-FRAGILITY",
      name: "Saturated-fragility cutset correction",
      affectedModelRef: damage.uuid,
      approximationMethod: "Rare-event sum of minimal cutsets",
      fragilityRefsApproachingUnity: dominantFragilities.slice(0, 4),
      overestimationMechanism: "At high ground motion, several conditional SSC failure probabilities approach one and overlapping cutsets cease to be mutually exclusive.",
      uncorrectedResult: rounded((damage.meanFrequency ?? 0) * 1.081),
      correctedResult: damage.meanFrequency,
      correctionMethod: "Use exact Boolean quantification for the affected cutset modules above 1.2 g and retain the rare-event solution only where all cutset probabilities remain small.",
      impactAssessment: "The correction lowers the damage-family mean by 8.1% without changing its leading SSC or HFE contributors.",
      implementsSrs: srs("SPR-E2"),
    },
    {
      uuid: "RARE-EVENT-CORRELATED-FAILURES",
      name: "Correlated structural and equipment failures",
      affectedModelRef: combined.uuid,
      approximationMethod: "Independent rare-event product for partially correlated failures",
      fragilityRefsApproachingUnity: dominantFragilities.slice(2, 7),
      overestimationMechanism: "Independent cutset summation duplicates common-demand states when correlated structural and equipment failures saturate in the upper bins.",
      uncorrectedResult: rounded((combined.meanFrequency ?? 0) * 1.052),
      correctedResult: combined.meanFrequency,
      correctionMethod: "Sample the stored correlation groups once per epistemic realization and solve the conditional sequence logic without duplicating common-demand states.",
      impactAssessment: "The corrected combined-family mean is 5.2% lower and its partial-correlation treatment remains bounded by the perfect-correlation sensitivity.",
      implementsSrs: srs("SPR-E2"),
    },
    {
      uuid: "RARE-EVENT-TOTAL-RELEASE",
      name: "Total release-family overlap check",
      affectedModelRef: "SPR-QUANTIFICATION-2026",
      approximationMethod: "Sum of family-level rare-event solutions",
      fragilityRefsApproachingUnity: dominantFragilities,
      overestimationMechanism: "Shared initiating-event, support-system, and barrier-failure states can appear in more than one family-level diagnostic solution if family partitions are not enforced.",
      uncorrectedResult: rounded(totalReleaseFrequency * 1.061),
      correctedResult: rounded(totalReleaseFrequency),
      correctionMethod: "Apply mutually exclusive end-state and release-category partitions before aggregating family results, then verify the aggregate with the exact event-tree solution.",
      impactAssessment: "The uncorrected aggregate is 6.1% high; the partitioned result is used for all reported means, uncertainty distributions, and contributor fractions.",
      implementsSrs: srs("SPR-E2", "SPR-E4"),
    },
  ];

  quant.esqRequirementCompliance = REQUIRED_ESQ_REQUIREMENTS.map(
    (requirement) => ({
      requirement,
      applicable: !["ESQ-C7", "ESQ-C8", "ESQ-C9"].includes(requirement),
      status: ["ESQ-C7", "ESQ-C8", "ESQ-C9"].includes(requirement)
        ? "NOT_APPLICABLE" as const
        : "MET" as const,
      satisfiedByRefs: [
        "ESQ-SEISMIC-QUANTIFICATION-2026",
        ...quant.eventSequenceFamilyQuantifications.map((family) => family.uuid),
      ],
      evidence: esqEvidence(requirement),
    }),
  );

  quant.resultType = "MEANS_WITH_PROPAGATED_PARAMETER_UNCERTAINTY";
  quant.integratedHazardFragilitySystemsMethod = "For every epistemic sample, the mean hazard branches define non-overlapping bin frequencies; sampled fragility capacities and correlation groups produce conditional SSC failures; the systems, sequence, and HRA logic is solved conditionally; bin-frequency products are summed into mutually exclusive family frequencies per plant-year.";
  quant.parameterUncertaintyPropagationMethod = "A 50,000-sample Latin-hypercube calculation jointly samples hazard branches, site-response branches, fragility medians and beta components, state-of-knowledge correlations, systems parameters, and HEP distributions. Common parameters are sampled once per realization to preserve epistemic dependence.";
  quant.sensitivityStudies = sensitivities(kind);
  quant.modelUncertainties = [
    {
      uuid: "UNC-SPR-HAZARD-BRANCHES",
      name: "Hazard branch weights and ground-motion medians",
      sourceArea: "HAZARD_INTERFACE",
      uncertaintyType: "MODEL",
      description: "Alternative source and ground-motion branches change bin frequencies across the full hazard range.",
      affectedModelRefs: ["GM-LT-1", "DISCRETIZATION-1"],
      affectedEventSequenceFamilyRefs: [...familyRefs],
      relatedAssumptions: ["The final site remains within the current source and ground-motion model applicability ranges."],
      reasonableAlternatives: ["Lower credible branch combination", "Upper credible branch combination", "Alternative ground-motion model weights"],
      treatment: "Branch identities and weights are propagated in every epistemic sample and challenged in a focused sensitivity.",
      propagated: true,
      sensitivityStudyRefs: ["SENS-SPR-HAZARD-BRANCHES"],
      importance: ImportanceLevel.HIGH,
      implementsSrs: srs("SPR-E5", "SPR-E6", "SPR-E8"),
    },
    {
      uuid: "UNC-SPR-SITE-RESPONSE",
      name: "Nonlinear site response and profile weights",
      sourceArea: "HAZARD_INTERFACE",
      uncertaintyType: "MODEL",
      description: "Profile selection, dynamic properties, and nonlinear method alter foundation motion passed into fragility evaluation.",
      affectedModelRefs: ["SITE-RESPONSE-BRANCHES", "DISCRETIZATION-1"],
      affectedEventSequenceFamilyRefs: [...familyRefs],
      relatedAssumptions: ["The profile ensemble bounds final excavation and foundation conditions."],
      reasonableAlternatives: ["Equivalent-linear response", "Nonlinear response", "Soft-profile-dominant weighting"],
      treatment: "Site-response branches are propagated with the hazard branches and compared in the nonlinear-method sensitivity.",
      propagated: true,
      sensitivityStudyRefs: ["SENS-SPR-SITE-RESPONSE"],
      importance: ImportanceLevel.MEDIUM,
      implementsSrs: srs("SPR-E5", "SPR-E6", "SPR-E8"),
    },
    {
      uuid: "UNC-SPR-FRAGILITY-CAPACITY",
      name: "Median fragility capacities",
      sourceArea: "FRAGILITY_INTERFACE",
      uncertaintyType: "PARAMETER",
      description: "Response, anchorage, material, and mechanism evidence determine the median capacities of risk-significant SSCs.",
      affectedModelRefs: dominantFragilities,
      affectedEventSequenceFamilyRefs: familyRefs.filter((ref) => ref !== "ESF-SEISMIC-STABLE"),
      relatedAssumptions: ["Installed configurations remain within the evaluated fragility configurations."],
      reasonableAlternatives: ["Equipment-specific lower median", "Generic-data median", "Plant-specific calculated median"],
      treatment: "Lognormal capacity distributions are sampled with common response terms and mechanism-specific capacity terms.",
      propagated: true,
      sensitivityStudyRefs: ["SENS-SPR-FRAGILITY-MEDIAN"],
      importance: ImportanceLevel.HIGH,
      implementsSrs: srs("SPR-E5", "SPR-E6", "SPR-E8"),
    },
    {
      uuid: "UNC-SPR-FRAGILITY-CORRELATION",
      name: "Fragility correlation",
      sourceArea: "FRAGILITY_INTERFACE",
      uncertaintyType: "MODEL",
      description: "The degree of common demand and capacity dependence among co-located SSCs affects combined failure probability.",
      affectedModelRefs: mef.seismicFragilityAnalysis.results.correlationGroups.map((group) => group.uuid),
      affectedEventSequenceFamilyRefs: [combined.eventSequenceFamilyRef, damage.eventSequenceFamilyRef],
      relatedAssumptions: ["Common structural response is partially correlated while mechanism-specific capacity remains distinct."],
      reasonableAlternatives: ["Independence", "Stored partial correlation", "Perfect correlation"],
      treatment: "The stored partial-correlation model is central; independence and perfect correlation are sensitivity bounds.",
      propagated: false,
      sensitivityStudyRefs: ["SENS-SPR-FRAGILITY-CORRELATION"],
      importance: ImportanceLevel.HIGH,
      implementsSrs: srs("SPR-E6", "SPR-E8"),
    },
    {
      uuid: "UNC-SPR-SYSTEM-DEPENDENCY",
      name: "Shared support-system dependency",
      sourceArea: "SYSTEMS_MODEL",
      uncertaintyType: "MODEL",
      description: "Shared DC power, cooling, structural response, and routing can couple otherwise redundant mitigation trains.",
      affectedModelRefs: ["SY-SEISMIC-MODEL", "SY-DC-POWER", "SY-DECAY-HEAT-REMOVAL"],
      affectedEventSequenceFamilyRefs: [damage.eventSequenceFamilyRef, combined.eventSequenceFamilyRef],
      relatedAssumptions: ["Current design information correctly identifies shared supports and separation boundaries."],
      reasonableAlternatives: ["Train independence", "Explicit shared support", "Complete support-system dependence"],
      treatment: "Explicit shared-support logic is central and alternative dependency strengths are sensitivity tested.",
      propagated: false,
      sensitivityStudyRefs: ["SENS-SPR-SYSTEM-DEPENDENCY"],
      importance: ImportanceLevel.HIGH,
      implementsSrs: srs("SPR-E6", "SPR-E8"),
    },
    {
      uuid: "UNC-SPR-HUMAN-RELIABILITY",
      name: "Seismic human performance",
      sourceArea: "HUMAN_RELIABILITY",
      uncertaintyType: "PARAMETER",
      description: "Seismic cues, stress, task time, access, physical hazards, communications, and dependence affect credited response and recovery actions.",
      affectedModelRefs: spr.humanReliabilityModel.humanActions.map((action) => action.humanFailureEventRef),
      affectedEventSequenceFamilyRefs: familyRefs.filter((ref) => ref !== "ESF-SEISMIC-STABLE"),
      relatedAssumptions: ["Planned procedures, staffing, routes, tools, and indications are available as modeled."],
      reasonableAlternatives: ["Central HEP distributions", "Upper-bound seismic performance factors", "Remove field-action credit"],
      treatment: "HEP distributions and dependencies are propagated; a focused scale sensitivity bounds unresolved procedure details.",
      propagated: true,
      sensitivityStudyRefs: ["SENS-SPR-HRA"],
      importance: ImportanceLevel.MEDIUM,
      implementsSrs: srs("SPR-E5", "SPR-E6", "SPR-E8"),
    },
    {
      uuid: "UNC-SPR-RARE-EVENT",
      name: "Rare-event approximation",
      sourceArea: "QUANTIFICATION",
      uncertaintyType: "MODEL",
      description: "Cutset summation overstates probability when conditional fragilities approach one or common states overlap.",
      affectedModelRefs: quant.rareEventApproximationAssessments.map((assessment) => assessment.uuid),
      affectedEventSequenceFamilyRefs: familyRefs.filter((ref) => ref !== "ESF-SEISMIC-STABLE"),
      relatedAssumptions: ["Exact Boolean treatment is required once the small-probability approximation no longer applies."],
      reasonableAlternatives: ["Uncorrected cutset sum", "Probability-capped cutsets", "Exact Boolean solution"],
      treatment: "The exact solution is used in affected bins and compared with the rare-event result as a numerical sensitivity.",
      propagated: false,
      sensitivityStudyRefs: ["SENS-SPR-RARE-EVENT"],
      importance: ImportanceLevel.MEDIUM,
      implementsSrs: srs("SPR-E2", "SPR-E6", "SPR-E8"),
    },
    {
      uuid: "UNC-SPR-AS-BUILT",
      name: "Final as-built and as-operated configuration",
      sourceArea: "SYSTEMS_MODEL",
      uncertaintyType: "MODEL",
      description: "Open construction, routing, procedure, staffing, and design-specific details can alter fragility, dependency, or HRA inputs.",
      affectedModelRefs: ["SEL-2026", "SY-SEISMIC-MODEL", `${kind.toUpperCase()}-SEISMIC-HRA-2026`],
      affectedEventSequenceFamilyRefs: [...familyRefs],
      relatedAssumptions: preOperationalAssumptions(kind).map((assumption) => assumption.assumptionId),
      reasonableAlternatives: ["Current reference design", "Bounding lower-capacity configuration", "Bounding longer-action-time configuration"],
      treatment: "Credible combined alternatives are evaluated in one integrated sensitivity and controlled by explicit closure actions.",
      propagated: false,
      sensitivityStudyRefs: ["SENS-SPR-AS-BUILT"],
      importance: ImportanceLevel.HIGH,
      implementsSrs: srs("SPR-E6", "SPR-E7", "SPR-E8"),
    },
  ];
  quant.combinedAssumptionEvaluation = "Individual hazard, site-response, fragility, correlation, systems, HRA, numerical, and pre-operational alternatives were first screened separately, then the important alternatives were combined coherently. The bounding combination changes the total release-family mean by no more than 24%, does not create a new dominant family, and leaves the leading equipment, dependency, and field-action insights unchanged.";

  const equipment = spr.seismicEquipmentListDevelopment.equipment;
  const equipmentName = (reference: string): string =>
    equipment.find((item) => item.uuid === reference)?.name ?? reference;
  const localAction = spr.humanReliabilityModel.humanActions.find((action) =>
    action.controlRoomOrExControlRoom === "EX_CONTROL_ROOM"
    || action.controlRoomOrExControlRoom === "BOTH");
  const recoveryAction = spr.humanReliabilityModel.humanActions.find(
    (action) => action.recoveryAction,
  );
  const inducedFailures = spr.plantResponseModel.inducedFailures;
  const primaryFailure = inducedFailures.find((failure) =>
    failure.sscRef === "SEL-PRIMARY") ?? inducedFailures[0];
  const secondaryFailure = inducedFailures.find((failure) =>
    failure.sscRef === "SEL-SECONDARY") ?? inducedFailures[1];
  const reactorBuildingRef = `SEL-${kind.toUpperCase()}-REACTOR-BUILDING`;
  quant.riskSignificantContributors = [
    {
      uuid: "CONTRIBUTOR-PRIMARY-SSC",
      name: `${equipmentName("SEL-PRIMARY")} seismic failure`,
      contributorType: "SSC",
      contributorRef: "SEL-PRIMARY",
      affectedEventSequenceFamilyRefs: [damage.eventSequenceFamilyRef, combined.eventSequenceFamilyRef],
      contributionValue: isSfr ? 0.31 : 0.27,
      contributionMetric: "Fractional contribution to affected release-family mean frequency",
      importance: ImportanceLevel.HIGH,
      designOperationMaintenanceContext: "Support stiffness, anchorage, rotating-equipment clearances, and post-installation inspection control the evaluated capacity.",
      riskInsight: "Preserve the qualified support and anchorage configuration and resolve any installation deviation before operation.",
      implementsSrs: srs("SPR-E4", "SPR-E8"),
    },
    {
      uuid: "CONTRIBUTOR-SECONDARY-SSC",
      name: `${equipmentName("SEL-SECONDARY")} seismic failure`,
      contributorType: "SSC",
      contributorRef: "SEL-SECONDARY",
      affectedEventSequenceFamilyRefs: [damage.eventSequenceFamilyRef, "ESF-SEISMIC-SHUTDOWN", "ESF-SEISMIC-LIQUEFACTION"],
      contributionValue: isSfr ? 0.38 : 0.42,
      contributionMetric: "Fractional contribution to affected release-family mean frequency",
      importance: ImportanceLevel.HIGH,
      designOperationMaintenanceContext: "Foundation behavior, load path, support condition, and functional inspection directly affect passive heat-removal reliability.",
      riskInsight: "This is the strongest practical risk-reduction target; preserve margin and inspect the full load path.",
      implementsSrs: srs("SPR-E4", "SPR-E8"),
    },
    {
      uuid: "CONTRIBUTOR-PRIMARY-BASIC-EVENT",
      name: primaryFailure?.name ?? "Primary heat-removal induced failure",
      contributorType: "BASIC_EVENT",
      contributorRef: primaryFailure?.systemsBasicEventRef ?? "BE-SEL-PRIMARY",
      affectedEventSequenceFamilyRefs: [damage.eventSequenceFamilyRef],
      contributionValue: isSfr ? 0.24 : 0.21,
      contributionMetric: "Conditional contribution within the damage family",
      importance: ImportanceLevel.HIGH,
      designOperationMaintenanceContext: "The basic event transfers the controlling fragility and shared-support dependencies into the seismic systems model.",
      riskInsight: "The systems and fragility identifiers must remain synchronized after any support, motor, or alignment change.",
      implementsSrs: srs("SPR-E4", "SPR-E8"),
    },
    {
      uuid: "CONTRIBUTOR-SECONDARY-BASIC-EVENT",
      name: secondaryFailure?.name ?? "Passive heat-removal induced failure",
      contributorType: "BASIC_EVENT",
      contributorRef: secondaryFailure?.systemsBasicEventRef ?? "BE-SEL-SECONDARY",
      affectedEventSequenceFamilyRefs: [damage.eventSequenceFamilyRef, "ESF-SEISMIC-SHUTDOWN"],
      contributionValue: isSfr ? 0.29 : 0.33,
      contributionMetric: "Conditional contribution within affected families",
      importance: ImportanceLevel.HIGH,
      designOperationMaintenanceContext: "The event represents the complete credited function, including support, connected lines, and required passive flow path.",
      riskInsight: "Configuration control must cover the whole success path, not only the named equipment item.",
      implementsSrs: srs("SPR-E4", "SPR-E8"),
    },
    {
      uuid: "CONTRIBUTOR-FIELD-ACTION",
      name: localAction?.name ?? "Seismic field action",
      contributorType: "HUMAN_ACTION",
      contributorRef: localAction?.humanFailureEventRef ?? "HFE-SEISMIC-LOCAL-ACTION",
      affectedEventSequenceFamilyRefs: localAction?.eventSequenceRefs.map((sequence) =>
        sequence.replace("ES-", "ESF-")) ?? [damage.eventSequenceFamilyRef],
      contributionValue: 0.14,
      contributionMetric: "Fractional contribution to affected mitigation-failure sequences",
      importance: ImportanceLevel.MEDIUM,
      designOperationMaintenanceContext: "Procedure quality, route clearance, lighting, communication, staffing, tools, cues, and aftershock rules support the credited action.",
      riskInsight: "Validate the final route and procedure under realistic seismic conditions before operational use.",
      implementsSrs: srs("SPR-E4", "SPR-E8"),
    },
    {
      uuid: "CONTRIBUTOR-RECOVERY-ACTION",
      name: recoveryAction?.name ?? "Qualified recovery action",
      contributorType: "HUMAN_ACTION",
      contributorRef: recoveryAction?.humanFailureEventRef ?? "HFE-SEISMIC-RECOVERY",
      affectedEventSequenceFamilyRefs: recoveryAction?.eventSequenceRefs.map((sequence) =>
        sequence.replace("ES-", "ESF-")) ?? [damage.eventSequenceFamilyRef],
      contributionValue: 0.08,
      contributionMetric: "Fractional contribution to affected recovery-failure sequences",
      importance: ImportanceLevel.MEDIUM,
      designOperationMaintenanceContext: "Recovery is credited only with an intact target, available cues, released access, time margin, staffing, tools, and explicit dependence.",
      riskInsight: "Do not broaden recovery credit beyond the validated conditions represented in the HRA.",
      implementsSrs: srs("SPR-E4", "SPR-E8"),
    },
    {
      uuid: "CONTRIBUTOR-INTERMEDIATE-HAZARD-BIN",
      name: `${intervals[4]?.name ?? "PRA bin 5"} ground-motion contribution`,
      contributorType: "HAZARD_BIN",
      contributorRef: `SPR-${intervals[4]?.uuid ?? "HAZARD-INTERVAL-5"}`,
      affectedEventSequenceFamilyRefs: familyRefs.filter((ref) => ref !== "ESF-SEISMIC-STABLE"),
      contributionValue: 0.28,
      contributionMetric: "Fraction of aggregate release-family mean frequency",
      importance: ImportanceLevel.HIGH,
      designOperationMaintenanceContext: "This range combines appreciable annual frequency with rapidly increasing conditional failure probabilities.",
      riskInsight: "Hazard, response, and capacity refinements near the 0.8 to 1.2 g range have the greatest leverage on total seismic risk.",
      implementsSrs: srs("SPR-E3", "SPR-E4", "SPR-E8"),
    },
    {
      uuid: "CONTRIBUTOR-UPPER-HAZARD-BIN",
      name: `${intervals[6]?.name ?? "PRA bin 7"} ground-motion contribution`,
      contributorType: "HAZARD_BIN",
      contributorRef: `SPR-${intervals[6]?.uuid ?? "HAZARD-INTERVAL-7"}`,
      affectedEventSequenceFamilyRefs: [combined.eventSequenceFamilyRef, "ESF-SEISMIC-LIQUEFACTION"],
      contributionValue: 0.16,
      contributionMetric: "Fraction of combined and liquefaction family mean frequency",
      importance: ImportanceLevel.MEDIUM,
      designOperationMaintenanceContext: "Upper-bin fragilities approach saturation and require the exact rare-event solution.",
      riskInsight: "Retain the upper hazard tail and exact Boolean treatment even though the bin frequency is small.",
      implementsSrs: srs("SPR-E2", "SPR-E3", "SPR-E4"),
    },
    {
      uuid: "CONTRIBUTOR-LIQUEFACTION",
      name: "Liquefaction-induced support deformation",
      contributorType: "INITIATING_EVENT",
      contributorRef: "INITIATOR-LIQUEFACTION",
      affectedEventSequenceFamilyRefs: ["ESF-SEISMIC-LIQUEFACTION", damage.eventSequenceFamilyRef],
      contributionValue: isSfr ? 0.061 : 0.067,
      contributionMetric: "Fraction of aggregate release-family mean frequency",
      importance: ImportanceLevel.MEDIUM,
      designOperationMaintenanceContext: "Foundation improvement, buried-service flexibility, alternate access, and monitoring determine the retained soil-deformation contribution.",
      riskInsight: "Preserve the alternate heat-removal path and verify ground-improvement acceptance criteria.",
      implementsSrs: srs("SPR-E4", "SPR-E8"),
    },
    {
      uuid: "CONTRIBUTOR-EXTERNAL-FLOOD",
      name: "Seismically induced upstream-reservoir flooding",
      contributorType: "INITIATING_EVENT",
      contributorRef: "INITIATOR-EXTERNAL-FLOOD",
      affectedEventSequenceFamilyRefs: [
        externalFlood.eventSequenceFamilyRef,
        damage.eventSequenceFamilyRef,
      ],
      contributionValue: rounded(
        (externalFlood.meanFrequency ?? 0) / totalReleaseFrequency,
      ),
      contributionMetric: "Fraction of aggregate release-family mean frequency",
      importance: ImportanceLevel.MEDIUM,
      designOperationMaintenanceContext: "Reservoir operating range, embankment condition, drainage geometry, flood-door and penetration configuration, protected electrical boundaries, and post-earthquake access control the contribution.",
      riskInsight: "Maintain reservoir surveillance, site drainage, flood barriers, penetration seals, and the protected access route as one configuration-controlled external-flood defense.",
      implementsSrs: srs("SPR-E4", "SPR-E8"),
    },
    {
      uuid: "CONTRIBUTOR-COMBINED-FAMILY",
      name: combined.name,
      contributorType: "EVENT_SEQUENCE_FAMILY",
      contributorRef: combined.eventSequenceFamilyRef,
      affectedEventSequenceFamilyRefs: [combined.eventSequenceFamilyRef],
      contributionValue: rounded((combined.meanFrequency ?? 0) / totalReleaseFrequency),
      contributionMetric: "Fraction of aggregate release-family mean frequency",
      importance: ImportanceLevel.HIGH,
      designOperationMaintenanceContext: isSfr
        ? "Sodium-boundary support, leak collection, ignition control, passive heat removal, and barrier response jointly control this family."
        : "Shared support, module response, passive cooling, multi-module staffing, and common structural motion jointly control this family.",
      riskInsight: isSfr
        ? "Treat the sodium boundary and mitigation features as one coupled seismic risk-control package."
        : "Manage common supports and multi-module dependencies explicitly rather than as independent module events.",
      implementsSrs: srs("SPR-E4", "SPR-E8"),
    },
    {
      uuid: "CONTRIBUTOR-REACTOR-BUILDING",
      name: `${equipmentName(reactorBuildingRef)} structural response`,
      contributorType: "SSC",
      contributorRef: reactorBuildingRef,
      affectedEventSequenceFamilyRefs: [damage.eventSequenceFamilyRef, combined.eventSequenceFamilyRef],
      contributionValue: 0.19,
      contributionMetric: "Common-demand contribution to affected family means",
      importance: ImportanceLevel.HIGH,
      designOperationMaintenanceContext: "Foundation input, SSI, structural damping, floor response, penetrations, and supported-equipment demand share this response path.",
      riskInsight: "Structural-model changes must trigger coordinated response, fragility, correlation, and quantification updates.",
      implementsSrs: srs("SPR-E4", "SPR-E8"),
    },
    {
      uuid: "CONTRIBUTOR-SHUTDOWN-SEQUENCE",
      name: "Shutdown cooling sequence",
      contributorType: "EVENT_SEQUENCE",
      contributorRef: "ES-SEISMIC-SHUTDOWN",
      affectedEventSequenceFamilyRefs: ["ESF-SEISMIC-SHUTDOWN"],
      contributionValue: rounded(
        (quant.eventSequenceFamilyQuantifications.find((family) =>
          family.uuid === "ESF-QUANT-SHUTDOWN")?.meanFrequency ?? 0)
          / totalReleaseFrequency,
      ),
      contributionMetric: "Fraction of aggregate release-family mean frequency",
      importance: ImportanceLevel.MEDIUM,
      designOperationMaintenanceContext: "Shutdown lineup, maintenance configuration, decay heat, available trains, and action timing differ from power operation.",
      riskInsight: "Retain a separate shutdown family; power-operation grouping would mask its configuration-specific dependencies.",
      implementsSrs: srs("SPR-E4", "SPR-E8"),
    },
  ];
  quant.riskSignificantContributors.sort((left, right) =>
    left.uuid === "CONTRIBUTOR-SECONDARY-SSC"
      ? -1
      : right.uuid === "CONTRIBUTOR-SECONDARY-SSC"
        ? 1
        : 0);

  quant.outputQualityChecks = [
    "Every SHA hazard interval resolves to exactly one SPR bin with identical bounds, representative motion, units, and annual frequency.",
    "Every active induced-failure basic event resolves to a stored SFR fragility and correlation group.",
    "Hazard-bin contributions sum to each reported event-sequence-family mean frequency within numerical tolerance.",
    "Mutually exclusive release-category partitions reconcile to the aggregate release-family frequency.",
    "The exact Boolean solution replaces the rare-event approximation where conditional fragilities approach one.",
    "Eight-bin and twelve-bin meshes satisfy the two-percent convergence criterion and preserve contributor ranking.",
    "Mean hazard and mean fragilities are used, with parameter uncertainty propagated for hazard, fragility, systems, and HRA inputs.",
    "State-of-knowledge correlation is preserved by sampling common epistemic variables once per realization.",
    "Cutset truncation refinement changes each family mean by less than 0.5%.",
    "Risk-significant and sampled non-risk-significant cutsets have independent logic and physical-meaning reviews.",
    "Flag settings, mutual-exclusion rules, module formation, and recovery rules reproduce the controlled solution.",
    "Pre-operational assumptions and unresolved model alternatives map to sensitivity studies and closure actions.",
  ];
  quant.implementsSrs = srs(
    "SPR-E1", "SPR-E2", "SPR-E3", "SPR-E4",
    "SPR-E5", "SPR-E6", "SPR-E7", "SPR-E8",
  );
  spr.preOperationalAssumptions = preOperationalAssumptions(kind);

  for (const interval of intervals) {
    interval.usedByEventSequenceFamilyRefs = [...familyRefs];
  }

  spr.documentation.quantificationMethods = "Mean seismic hazard and fragility inputs are integrated through a converged hazard mesh and dependent plant model. Exact Boolean correction is applied in saturated bins, and joint Latin-hypercube propagation produces family means and uncertainty distributions.";
  spr.documentation.eventSequenceFamilyResults = `${quant.eventSequenceFamilyQuantifications.length} mutually exclusive seismic families are quantified per plant-year; aggregate release-family mean frequency is ${totalReleaseFrequency.toExponential(3)}.`;
  spr.documentation.sensitivityStudyResults = `${quant.sensitivityStudies.length} integrated studies challenge hazard, site response, fragility capacity and correlation, systems dependency, HRA, numerical treatment, and open pre-operational assumptions.`;
  spr.documentation.riskSignificantContributors = `${quant.riskSignificantContributors.length} contributors identify the leading SSCs, basic events, human actions, hazard bins, initiating events, sequences, and combined family.`;
  spr.documentation.modelUncertaintiesAndAlternatives = `${quant.modelUncertainties.length} plant-response uncertainties link assumptions and reasonable alternatives to propagation or integrated sensitivity studies.`;
  spr.documentation.preOperationalLimitations = "Final as-built anchorage, routing, foundation conditions, procedures, staffing, and design-specific combined-event details must be reconciled before operational application.";
  spr.documentation.quantificationLimitations = [
    "The example quantification supports pre-operational design decisions and must be updated with final as-built and as-operated evidence.",
    "Consequences and integrated multi-hazard risk metrics are transferred to the downstream Risk Integration technical element.",
  ];
  spr.documentation.dataModelAndCalculationRefs = [
    "SHA-RESULTS-2026.H5",
    "SFR-FRAGILITY-RESULTS-2026.H5",
    "SY-SEISMIC-MODEL",
    `${kind.toUpperCase()}-SEISMIC-HRA-2026`,
    "SPR-QUANTIFICATION-INPUTS-2026.JSON",
    "SPR-LHS-50000-RESULTS-2026.H5",
    "SPR-RARE-EVENT-CHECK-2026",
    "SPR-QUANTIFICATION-INDEPENDENT-REVIEW-2026",
  ];
  spr.documentation.traceability =
    quant.eventSequenceFamilyQuantifications.map((family) => ({
      initiatingEventRef: family.initiatingEventRefs[0]!,
      eventSequenceRefs: [...family.eventSequenceRefs],
      equipmentRefs: family.uuid === "ESF-QUANT-SPENT-FUEL"
        ? equipment.filter((item) => item.name.toLowerCase().includes("spent"))
          .map((item) => item.uuid)
        : ["SEL-PRIMARY", "SEL-SECONDARY"],
      fragilityRefs: [...fragilityRefs],
      hazardRefs: ["HAZARD-CURVE-MEAN-1HZ", "DISCRETIZATION-1"],
      quantificationRef: family.uuid,
    }));
}
