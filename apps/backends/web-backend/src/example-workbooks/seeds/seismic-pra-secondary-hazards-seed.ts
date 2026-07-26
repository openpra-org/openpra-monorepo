import { type SRReference } from "interfaces-mef-types/core/pra-common";
import { ImportanceLevel } from "interfaces-mef-types/core/shared-patterns";
import { type SeismicPRA } from "interfaces-mef-types/seismic/seismic-pra";

type ReactorKind = "sfr" | "htgr";
type Evaluation =
  SeismicPRA["seismicHazardAnalysis"]["secondaryHazardEvaluation"];
type SecondaryHazard = Evaluation["hazards"][number];
type RetainedAnalysis = NonNullable<SecondaryHazard["retainedAnalysis"]>;
type ExternalFloodingInterface =
  NonNullable<SecondaryHazard["externalFloodingInterface"]>;

function srs(...codes: string[]): SRReference[] {
  return codes.map((sr) => ({
    sr,
    hlr: sr.split("-")[1]!.charAt(0) as SRReference["hlr"],
  }));
}

function round(value: number): number {
  return Number(value.toPrecision(5));
}

function hazardCurveFamily(
  kind: ReactorKind,
  levels: number[],
  medianFrequencies: number[],
): RetainedAnalysis["hazardCurves"] {
  const prefix = kind === "sfr" ? "SFR-LIQ" : "HTGR-LIQ";
  const parameter = "Permanent differential ground displacement";
  const configurations = [
    { suffix: "P05", name: "5th fractile", statistic: "FRACTILE" as const, fractile: 0.05, factor: 0.42 },
    { suffix: "P50", name: "Median", statistic: "FRACTILE" as const, fractile: 0.5, factor: 1 },
    { suffix: "MEAN", name: "Mean", statistic: "MEAN" as const, factor: 1.18 },
    { suffix: "P95", name: "95th fractile", statistic: "FRACTILE" as const, fractile: 0.95, factor: 2.55 },
  ];

  return configurations.map((configuration) => ({
    uuid: `${prefix}-CURVE-${configuration.suffix}`,
    name: `${configuration.name} liquefaction displacement hazard`,
    hazardParameter: parameter,
    hazardParameterUnits: "cm",
    statistic: configuration.statistic,
    fractile: configuration.fractile,
    points: levels.map((hazardLevel, index) => ({
      hazardLevel,
      annualFrequencyOfExceedance: round(
        (medianFrequencies[index] ?? 0) * configuration.factor,
      ),
    })),
    calculationRunRef: `${prefix}-CALC-2026`,
    implementsSrs: srs("SHA-H3"),
  }));
}

function retainedLiquefaction(kind: ReactorKind): SecondaryHazard {
  const isSfr = kind === "sfr";
  const prefix = isSfr ? "SFR-LIQ" : "HTGR-LIQ";
  const levels = isSfr
    ? [0.1, 0.25, 0.5, 1, 2, 5, 10, 20, 40]
    : [0.1, 0.25, 0.5, 1, 2, 5, 10, 20, 35];
  const medianFrequencies = isSfr
    ? [3.1e-3, 1.55e-3, 7.1e-4, 2.8e-4, 9.6e-5, 1.9e-5, 3.8e-6, 5.8e-7, 5.2e-8]
    : [2.4e-3, 1.1e-3, 4.8e-4, 1.8e-4, 6.3e-5, 1.2e-5, 2.5e-6, 3.8e-7, 3e-8];
  const affectedArea = isSfr
    ? "Buried decay-heat-removal service trench south of the reactor building"
    : "Buried RCCS service corridor east of the reactor building";
  const affectedSystem = isSfr
    ? "Decay heat removal air cooler AC-1"
    : "Reactor cavity cooling panel RCCS-1";

  return {
    uuid: "SECONDARY-LIQUEFACTION",
    name: "Localized soil liquefaction and deformation",
    hazardType: "SOIL_LIQUEFACTION",
    description: isSfr
      ? "A saturated silty-sand backfill lens beneath the decay-heat-removal service trench can generate excess pore pressure during strong shaking."
      : "A localized saturated sand lens outside the basemat footprint can generate excess pore pressure during strong shaking.",
    initiatingMechanisms: [
      "Cyclic stress from horizontal ground motion",
      "Groundwater above the susceptible lens",
      "Post-liquefaction reconsolidation",
    ],
    siteEvidenceRefs: [
      `${prefix}-CPT-2026`,
      `${prefix}-BORING-LOGS-2025`,
      `${prefix}-GROUNDWATER-2024-2026`,
      `${prefix}-LAB-CYCLIC-TESTS`,
    ],
    potentiallyAffectedArea: affectedArea,
    potentiallyAffectedSeismicEquipmentListItemRefs: ["SEL-SECONDARY"],
    screening: {
      disposition: "RETAINED",
      criterion: "NOT_SCREENED",
      methodology: "Site-specific triggering, reconsolidation, and permanent-deformation analysis.",
      demonstrablyConservative: true,
      screeningBasis: "The lowest cyclic-resistance branch does not exclude deformation over the PRA hazard range.",
      calculationsAndEvidenceRefs: [
        `${prefix}-TRIGGERING-CALC`,
        `${prefix}-DEFORMATION-CALC`,
        `${prefix}-GROUNDWATER-BASIS`,
      ],
      reviewer: "Geotechnical hazard lead",
      reviewDate: "2026-05-22",
      implementsSrs: srs("SHA-H2"),
    },
    retainedAnalysis: {
      uuid: `${prefix}-ANALYSIS`,
      name: "Probabilistic liquefaction deformation analysis",
      hazardParameter: "Permanent differential ground displacement",
      parameterUnits: "cm",
      affectedSeismicEquipmentListItemRefs: ["SEL-SECONDARY"],
      failureMechanisms: [
        {
          id: `${prefix}-MECH-SETTLEMENT`,
          name: "Differential settlement",
          description: `Differential vertical movement distorts supports and alignment for ${affectedSystem}.`,
          fragilityParameter: "Differential vertical displacement",
          fragilityUnits: "cm",
        },
        {
          id: `${prefix}-MECH-LATERAL`,
          name: "Lateral ground deformation",
          description: `Permanent lateral movement imposes displacement demand on buried connections serving ${affectedSystem}.`,
          fragilityParameter: "Permanent lateral displacement",
          fragilityUnits: "cm",
        },
      ],
      hazardCurves: hazardCurveFamily(kind, levels, medianFrequencies),
      calculationMethod: "CPT-based triggering with magnitude scaling, groundwater logic-tree branches, and conditional permanent-deformation simulation integrated over the seismic hazard.",
      dataAndModelRefs: [
        `${prefix}-CPT-2026`,
        `${prefix}-BORING-LOGS-2025`,
        `${prefix}-GROUNDWATER-2024-2026`,
        `${prefix}-LAB-CYCLIC-TESTS`,
        `${prefix}-TRIGGERING-MODEL`,
        `${prefix}-DEFORMATION-MODEL`,
      ],
      uncertainties: [
        {
          uuid: `${prefix}-UNC-GW`,
          name: "Groundwater elevation",
          uncertaintyType: "EPISTEMIC",
          analysisArea: "SECONDARY_HAZARD",
          description: "Seasonal and long-term groundwater elevations control the thickness of susceptible saturated material.",
          affectedModelRefs: [`${prefix}-TRIGGERING-MODEL`],
          affectedResultRefs: ["LIQUEFACTION-HAZARD-RESULTS"],
          characterizationMethod: "Three weighted groundwater surfaces from monitoring records and upper-bound recharge.",
          logicTreeNodeRef: `${prefix}-LT-GW`,
          correlationAndDependencyTreatment: "One groundwater branch is shared across all affected soil columns.",
          propagationMethod: "Integrated as epistemic branches in every displacement hazard curve.",
          importance: ImportanceLevel.HIGH,
          riskSignificanceBasis: "Controls the onset frequency of liquefaction triggering.",
          implementsSrs: srs("SHA-H3"),
        },
        {
          uuid: `${prefix}-UNC-CRR`,
          name: "Cyclic resistance",
          uncertaintyType: "EPISTEMIC",
          analysisArea: "SECONDARY_HAZARD",
          description: "CPT normalization, fines correction, and correlation choice affect cyclic resistance.",
          affectedModelRefs: [`${prefix}-TRIGGERING-MODEL`],
          affectedResultRefs: ["LIQUEFACTION-HAZARD-RESULTS"],
          characterizationMethod: "Alternative accepted CPT correlations with site-specific laboratory calibration.",
          logicTreeNodeRef: `${prefix}-LT-CRR`,
          correlationAndDependencyTreatment: "Model choice is fully correlated across the susceptible lens.",
          propagationMethod: "Weighted logic-tree branches.",
          importance: ImportanceLevel.HIGH,
          riskSignificanceBasis: "Moves the median triggering threshold through the dominant ground-motion bins.",
          implementsSrs: srs("SHA-H3"),
        },
        {
          uuid: `${prefix}-UNC-DURATION`,
          name: "Earthquake duration and cyclic demand",
          uncertaintyType: "ALEATORY",
          analysisArea: "SECONDARY_HAZARD",
          description: "Record-to-record duration and cyclic demand vary at a given motion level.",
          affectedModelRefs: [`${prefix}-TRIGGERING-MODEL`],
          affectedResultRefs: ["LIQUEFACTION-HAZARD-RESULTS"],
          characterizationMethod: "Magnitude-conditioned demand variability from the Step 06 deaggregation.",
          correlationAndDependencyTreatment: "Shared event magnitude and independent local residuals are preserved.",
          propagationMethod: "Sampled conditionally within each hazard branch.",
          importance: ImportanceLevel.MEDIUM,
          riskSignificanceBasis: "Broadens the displacement distribution without changing the retained disposition.",
          implementsSrs: srs("SHA-H3"),
        },
        {
          uuid: `${prefix}-UNC-DEFORMATION`,
          name: "Post-liquefaction deformation model",
          uncertaintyType: "EPISTEMIC",
          analysisArea: "SECONDARY_HAZARD",
          description: "Alternative reconsolidation and lateral-deformation models produce different permanent displacement.",
          affectedModelRefs: [`${prefix}-DEFORMATION-MODEL`],
          affectedResultRefs: ["LIQUEFACTION-HAZARD-RESULTS"],
          characterizationMethod: "Center, lower, and upper deformation relationships constrained by site density and geometry.",
          logicTreeNodeRef: `${prefix}-LT-DEFORMATION`,
          correlationAndDependencyTreatment: "A common model branch applies to both affected failure mechanisms.",
          propagationMethod: "Weighted logic-tree branches and an integrated sensitivity case.",
          importance: ImportanceLevel.MEDIUM,
          riskSignificanceBasis: "Controls the upper tail used by the fragility analysis.",
          implementsSrs: srs("SHA-H3"),
        },
      ],
      sensitivityStudyRefs: ["SENS-LIQUEFACTION", `${prefix}-SENS-GROUNDWATER`, `${prefix}-SENS-DEFORMATION`],
      outputRefs: ["LIQUEFACTION-HAZARD-RESULTS"],
      implementsSrs: srs("SHA-H3"),
    },
    implementsSrs: srs("SHA-H1", "SHA-H2", "SHA-H3"),
  };
}

function retainedExternalFlooding(kind: ReactorKind): SecondaryHazard {
  const isSfr = kind === "sfr";
  const sitePrefix = isSfr ? "PIONEER-MESA" : "CEDAR-BASIN";
  const xfPrefix = `${sitePrefix}-XF`;
  const reservoir = isSfr
    ? "Pioneer Mesa raw-water balancing reservoir"
    : "Cedar Basin upper water-supply reservoir";
  const affectedSscRefs = isSfr
    ? [
        "SEL-SFR-SWITCHGEAR",
        "SEL-SFR-DC-BATTERY-A",
        "SEL-SFR-DHR-DAMPER",
      ]
    : [
        "SEL-HTGR-SWITCHGEAR",
        "SEL-HTGR-DC-BATTERY-A",
        "SEL-HTGR-RCCS-HEADER",
      ];
  const hazardResultRefs = [
    `${xfPrefix}-PEAK-WATER-SURFACE`,
    `${xfPrefix}-DEPTH-VELOCITY`,
    `${xfPrefix}-ARRIVAL-DURATION`,
    `${xfPrefix}-DEBRIS-HYDRODYNAMIC-LOAD`,
  ];
  const fragilityMechanismRefs = [
    `${xfPrefix}-FLOOD-DOOR-HYDROSTATIC`,
    `${xfPrefix}-CABLE-VAULT-INGRESS`,
    `${xfPrefix}-DRAIN-BACKFLOW`,
    `${xfPrefix}-YARD-EQUIPMENT-INUNDATION`,
  ];
  const requirementInputs: Array<{
    requirementGroup: ExternalFloodingInterface["interfaceRequirements"][number]["requirementGroup"];
    refs: string[];
    evidence: string;
  }> = [
    {
      requirementGroup: "XFHA-A",
      refs: [`${xfPrefix}-HAZARD-SCOPE`, `${xfPrefix}-SEISMIC-INITIATOR-FREQUENCY`],
      evidence: `The ${reservoir} breach scenario is defined as a seismically initiated external-flood mechanism and is conditional on the shared earthquake source and ground-motion branches.`,
    },
    {
      requirementGroup: "XFHA-B",
      refs: [`${xfPrefix}-RESERVOIR-INVENTORY`, `${xfPrefix}-EMBANKMENT-CONDITION`, `${xfPrefix}-TERRAIN-MODEL`],
      evidence: "Reservoir operating range, embankment geometry and condition, downstream terrain, drainage features, plant elevations, and uncertainties are controlled inputs.",
    },
    {
      requirementGroup: "XFHA-C",
      refs: [`${xfPrefix}-BREACH-MODEL`, `${xfPrefix}-ROUTING-MODEL`, `${xfPrefix}-MODEL-CALIBRATION`],
      evidence: "Alternative breach-development branches are routed over the site terrain with mass-balance, mesh, roughness, and sensitivity checks.",
    },
    {
      requirementGroup: "XFHA-D",
      refs: hazardResultRefs,
      evidence: "Frequency-tagged water-surface elevation, depth, velocity, arrival time, duration, debris, and hydrodynamic-load results are available at each affected plant area.",
    },
    {
      requirementGroup: "XFHA-E",
      refs: fragilityMechanismRefs,
      evidence: "Flood-door loading, below-grade ingress, drainage backflow, and yard-equipment inundation mechanisms are linked to the affected SSC and protection-feature fragilities.",
    },
    {
      requirementGroup: "XFHA-F",
      refs: [
        `${xfPrefix}-PLANT-RESPONSE-MODEL`,
        "ES-SEISMIC-EXTERNAL-FLOOD",
        "MISSION-TIME-EXTERNAL-FLOOD",
      ],
      evidence: "The plant-response model carries inundation of affected electrical and heat-removal support functions, access constraints, mission time, and common-cause spatial effects.",
    },
    {
      requirementGroup: "XFHA-G",
      refs: [`${xfPrefix}-CALC-PACKAGE-2026`, `${xfPrefix}-INDEPENDENT-REVIEW-2026`],
      evidence: "Inputs, assumptions, model versions, calculations, sensitivities, results, interfaces, and independent-review resolutions are traceable in the controlled flood-analysis package.",
    },
  ];

  return {
    uuid: "SECONDARY-EXTERNAL-FLOODING",
    name: "Seismically induced upstream-reservoir flooding",
    hazardType: "EARTHQUAKE_INDUCED_EXTERNAL_FLOODING",
    description: `Strong shaking can damage the ${reservoir} embankment, initiate a breach, and route a flood wave through the hydraulically connected drainage toward protected plant areas.`,
    initiatingMechanisms: [
      "Coseismic embankment deformation and cracking",
      "Internal erosion and progressive breach formation",
      "Breach-hydrograph routing to plant grade",
    ],
    siteEvidenceRefs: [
      `${xfPrefix}-RESERVOIR-INVENTORY`,
      `${xfPrefix}-EMBANKMENT-CONDITION`,
      `${xfPrefix}-SURVEY-AND-LIDAR-2025`,
      `${xfPrefix}-HYDRAULIC-CONNECTIVITY`,
      `${xfPrefix}-PLANT-ELEVATION-SURVEY`,
    ],
    potentiallyAffectedArea: isSfr
      ? "Electrical-service building entrances, below-grade cable routes, DRACS air-path equipment, and the credited site-access route"
      : "Shared electrical-service building entrances, below-grade cable routes, RCCS service headers, and the credited site-access route",
    potentiallyAffectedSeismicEquipmentListItemRefs: affectedSscRefs,
    screening: {
      disposition: "RETAINED",
      criterion: "NOT_SCREENED",
      methodology: "Conditional embankment-response and breach-frequency analysis followed by two-dimensional unsteady hydraulic routing to plant-area receptor points.",
      demonstrablyConservative: false,
      screeningBasis: "The upper credible embankment-response and breach-development branches produce nonzero inundation at protected plant areas, so site-feasibility screening is not used.",
      calculationsAndEvidenceRefs: [
        `${xfPrefix}-SEISMIC-EMBANKMENT-CALC`,
        `${xfPrefix}-BREACH-FREQUENCY-CALC`,
        `${xfPrefix}-ROUTING-CALC`,
        `${xfPrefix}-PLANT-AREA-RESULTS`,
      ],
      reviewer: "External-flood and seismic-hazards integration lead",
      reviewDate: "2026-05-22",
      implementsSrs: srs("SHA-H2", "SHA-H4"),
    },
    externalFloodingInterface: {
      externalFloodingAnalysisRef: `${xfPrefix}-ANALYSIS-2026`,
      mechanismDescription: `Earthquake-conditioned deformation of the ${reservoir} embankment can progress to breach; the resulting hydrograph is routed to plant-area receptor points with shared seismic, breach, and hydraulic uncertainty branches.`,
      interfaceRequirements: requirementInputs.map((requirement) => ({
        requirementGroup: requirement.requirementGroup,
        applicable: true,
        status: "MET",
        satisfiedByRefs: requirement.refs,
        evidence: requirement.evidence,
      })),
      hazardParameterResultsRefs: hazardResultRefs,
      fragilityFailureMechanismRefs: fragilityMechanismRefs,
      interfaceBasis: "The seismic hazard supplies earthquake occurrence, magnitude, duration, and ground-motion branches; the external-flood analysis supplies conditional embankment failure, breach development, inundation severity and frequency, flood-protection fragility, and plant-area effects without treating these quantities as independent.",
      implementsSrs: srs("SHA-H4"),
    },
    implementsSrs: srs("SHA-H1", "SHA-H2", "SHA-H4"),
  };
}

function screenedHazards(kind: ReactorKind): SecondaryHazard[] {
  const isSfr = kind === "sfr";
  const sitePrefix = isSfr ? "PIONEER-MESA" : "CEDAR-BASIN";
  const reactorArea = isSfr
    ? "Reactor and steam-generator building footprint"
    : "Four-module reactor building plateau";

  const records: Array<{
    uuid: string;
    name: string;
    hazardType: SecondaryHazard["hazardType"];
    description: string;
    mechanisms: string[];
    evidence: string[];
    area: string;
    criterion: SecondaryHazard["screening"]["criterion"];
    methodology: string;
    basis: string;
    calculations: string[];
  }> = [
    {
      uuid: "SECONDARY-FAULT-DISPLACEMENT",
      name: "Surface fault displacement",
      hazardType: "FAULT_DISPLACEMENT",
      description: "Primary or distributed surface rupture through the safety-related site footprint.",
      mechanisms: ["Coseismic surface rupture", "Distributed fault-zone deformation"],
      evidence: [`${sitePrefix}-QUATERNARY-FAULT-MAP`, `${sitePrefix}-LIDAR-2025`, `${sitePrefix}-TRENCHING-REPORT`],
      area: reactorArea,
      criterion: "SCR-2",
      methodology: "Capable-fault mapping, LiDAR lineament review, trenching, and site-strain evaluation.",
      basis: isSfr
        ? "No capable Quaternary fault intersects the footprint; the nearest mapped capable trace is 31 km away."
        : "No capable Quaternary fault intersects the footprint; the nearest mapped capable trace is 46 km away.",
      calculations: [`${sitePrefix}-FAULT-DISPLACEMENT-SCREEN`],
    },
    {
      uuid: "SECONDARY-LANDSLIDE",
      name: "Slope instability and rockfall",
      hazardType: "LANDSLIDE",
      description: "Seismically triggered slope movement, debris runout, or rockfall reaching credited structures or access routes.",
      mechanisms: ["Rotational slope failure", "Rockfall", "Debris runout"],
      evidence: [`${sitePrefix}-DEM-2025`, `${sitePrefix}-GEOMORPHIC-MAP`, `${sitePrefix}-SLOPE-BORINGS`],
      area: "Safety-related buildings, heat-rejection equipment, and credited access routes",
      criterion: "SCR-2",
      methodology: "Terrain screening followed by pseudo-static stability and conservative runout checks.",
      basis: isSfr
        ? "The nearest potentially unstable escarpment is 2.6 km outside the conservative runout envelope."
        : "The building plateau is below 3 percent grade and the nearest mapped unstable slope is 3.8 km away.",
      calculations: [`${sitePrefix}-SLOPE-SCREEN`, `${sitePrefix}-RUNOUT-CHECK`],
    },
    {
      uuid: "SECONDARY-SOIL-SETTLEMENT",
      name: "Seismic settlement of non-liquefiable soils",
      hazardType: "SOIL_SETTLEMENT",
      description: "Volumetric strain and densification of unsaturated or non-liquefiable foundation soils.",
      mechanisms: ["Cyclic densification", "Differential settlement across soil transitions"],
      evidence: [`${sitePrefix}-FILL-ACCEPTANCE`, `${sitePrefix}-LAB-DYNAMIC-PROPERTIES`, `${sitePrefix}-FOUNDATION-BORINGS`],
      area: reactorArea,
      criterion: "SCR-3",
      methodology: "Bounding cyclic-strain settlement and foundation-distortion calculation.",
      basis: isSfr
        ? "Engineered fill settlement is below 0.35 cm at the 1E-5 motion and the integrated SSC failure frequency is below the project SCR-3 limit."
        : "Dense native gravel and controlled fill settlement are below 0.25 cm at the 1E-5 motion and the integrated SSC failure frequency is below the project SCR-3 limit.",
      calculations: [`${sitePrefix}-SETTLEMENT-CALC`, `${sitePrefix}-SCR3-CHECK`],
    },
    {
      uuid: "SECONDARY-GROUND-FAILURE",
      name: "Bearing, collapse, and lateral ground failure",
      hazardType: "GROUND_FAILURE",
      description: "Foundation bearing failure, collapse-prone ground, or lateral spreading not included in the retained liquefaction lens.",
      mechanisms: ["Bearing failure", "Collapsible-soil deformation", "Lateral spreading"],
      evidence: [`${sitePrefix}-GEOTECHNICAL-DESIGN-REPORT`, `${sitePrefix}-GEOPHYSICS`, `${sitePrefix}-GROUND-IMPROVEMENT-QA`],
      area: reactorArea,
      criterion: "SCR-2",
      methodology: "Foundation capacity, collapse susceptibility, free-face geometry, and improved-ground verification.",
      basis: isSfr
        ? "Competent volcanic rock and verified ground improvement exclude bearing collapse and lateral spreading beneath credited structures."
        : "Dense gravel over bedrock, no free face, and verified foundation preparation exclude credible bearing collapse or lateral spreading.",
      calculations: [`${sitePrefix}-GROUND-FAILURE-SCREEN`],
    },
    {
      uuid: "SECONDARY-TSUNAMI-SEICHE",
      name: "Tsunami and seiche",
      hazardType: "TSUNAMI_OR_SEICHE",
      description: "Long-period water-level oscillation or wave runup generated by regional earthquakes.",
      mechanisms: ["Tsunami propagation", "Reservoir seiche", "Enclosed-basin sloshing"],
      evidence: [`${sitePrefix}-COASTAL-DISTANCE`, `${sitePrefix}-WATERBODY-INVENTORY`, `${sitePrefix}-SEICHE-SCREEN`],
      area: "Plant grade and credited ultimate heat-sink features",
      criterion: "SCR-2",
      methodology: "Coastal exposure, connected-waterbody geometry, and conservative runup screening.",
      basis: isSfr
        ? "The site is more than 700 km inland and no hydraulically connected waterbody can support damaging seiche runup."
        : "The site is more than 500 km inland; the nearest reservoir is not hydraulically connected and its bounding seiche remains below plant grade.",
      calculations: [`${sitePrefix}-TSUNAMI-SEICHE-SCREEN`],
    },
  ];

  return records.map((record) => ({
    uuid: record.uuid,
    name: record.name,
    hazardType: record.hazardType,
    description: record.description,
    initiatingMechanisms: record.mechanisms,
    siteEvidenceRefs: record.evidence,
    potentiallyAffectedArea: record.area,
    potentiallyAffectedSeismicEquipmentListItemRefs: [],
    screening: {
      disposition: "SCREENED_OUT",
      criterion: record.criterion,
      methodology: record.methodology,
      demonstrablyConservative: true,
      screeningBasis: record.basis,
      calculationsAndEvidenceRefs: record.calculations,
      reviewer: "Secondary-hazards review lead",
      reviewDate: "2026-05-22",
      implementsSrs: srs("SHA-H2"),
    },
    implementsSrs: srs("SHA-H1", "SHA-H2"),
  }));
}

export function populateSecondaryHazards(
  mef: SeismicPRA,
  kind: ReactorKind,
): void {
  const isSfr = kind === "sfr";
  const evaluation = mef.seismicHazardAnalysis.secondaryHazardEvaluation;
  evaluation.identificationMethod =
    "Systematic site-feasibility review of fault displacement, slope instability, liquefaction, settlement, ground failure, earthquake-induced flooding, tsunami, and seiche mechanisms.";
  evaluation.siteAndRegionalHazardListSources = isSfr
    ? [
        "PIONEER-MESA-SITE-CHARACTERIZATION-2026",
        "PIONEER-MESA-QUATERNARY-FAULT-MAP",
        "PIONEER-MESA-DEM-2025",
        "PIONEER-MESA-GEOTECHNICAL-DESIGN-REPORT",
        "PIONEER-MESA-WATERSHED-INVENTORY",
        "PIONEER-MESA-HAZARDS-SCREENING-WORKBOOK",
      ]
    : [
        "CEDAR-BASIN-SITE-CHARACTERIZATION-2026",
        "CEDAR-BASIN-QUATERNARY-FAULT-MAP",
        "CEDAR-BASIN-DEM-2025",
        "CEDAR-BASIN-GEOTECHNICAL-DESIGN-REPORT",
        "CEDAR-BASIN-WATERSHED-INVENTORY",
        "CEDAR-BASIN-HAZARDS-SCREENING-WORKBOOK",
      ];
  const screened = screenedHazards(kind);
  evaluation.hazards = [
    ...screened.slice(0, 2),
    retainedLiquefaction(kind),
    ...screened.slice(2, 4),
    retainedExternalFlooding(kind),
    ...screened.slice(4),
  ];
  evaluation.seismicEquipmentListRef = "SEL-2026";
  evaluation.screeningCriteriaReference =
    "Project secondary-hazard procedure implementing SCR-2 site-feasibility and SCR-3 demonstrably conservative failure-frequency screening.";
  evaluation.crossHazardDependencies = [
    "Liquefaction triggering is conditional on the shared horizontal ground-motion hazard and earthquake magnitude.",
    "Groundwater elevation is common to liquefaction and settlement; earthquake magnitude, duration, and ground-motion branches are shared with the external-flood embankment response.",
    "Seismically induced internal flooding from plant tanks and piping remains in the internal-flood and fragility interfaces, not this external-hazard list.",
  ];
  evaluation.completenessReview =
    "All standard secondary-seismic-hazard classes were checked against current site data; every screened record has a conservative criterion, liquefaction is linked through the non-flood hazard model, and upstream-reservoir flooding is linked through the complete XFHA interface and plant-response model.";
  evaluation.implementsSrs = srs("SHA-H1", "SHA-H2", "SHA-H3", "SHA-H4");

  const retainedOutputRefs = evaluation.hazards.flatMap(
    (hazard) => [
      ...(hazard.retainedAnalysis?.outputRefs ?? []),
      ...(hazard.externalFloodingInterface?.hazardParameterResultsRefs ?? []),
    ],
  );
  const inputs =
    mef.seismicHazardAnalysis.hazardQuantification.seismicPraInputs;
  inputs.secondaryHazardResultRefs = retainedOutputRefs;
  inputs.hazardIntervals.forEach((interval, index) => {
    interval.secondaryHazardResultRefs =
      index >= 3 ? [...retainedOutputRefs] : [];
  });
}
