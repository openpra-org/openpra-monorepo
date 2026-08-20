import {
  type RadiologicalConsequenceAnalysis,
  type ReleaseCategoryInputs,
  type ProtectiveActionAnalysis,
  type MeteorologicalDataAnalysis,
  type AtmosphericDispersionAnalysis,
  type DosimetryAnalysis,
  type HealthEffectsAnalysis,
  type EconomicFactorsAnalysis,
  type ConsequenceQuantificationAnalysis,
  type RcDocumentation,
  RC_SR_CATALOG,
} from "interfaces-mef-types/rc/radiological-consequence-analysis";
import { TechnicalElementTypes } from "interfaces-mef-types/technical-element";
import { DistributionType } from "interfaces-mef-types/core/events";
import { type SRReference, type SRConformance, type SRStatus } from "interfaces-mef-types/core/pra-common";
import { ImportanceLevel, type SensitivityStudy } from "interfaces-mef-types/core/shared-patterns";

const NOW = "2026-06-04T12:00:00.000Z";
const CREATED = "2026-05-29T09:00:00.000Z";

function srs(...codes: string[]): SRReference[] {
  return codes.map((code) => {
    const dash = code.indexOf("-");
    return { sr: code, hlr: code.charAt(dash + 1) as SRReference["hlr"] };
  });
}

const WARN_SRS = new Set<string>(["RCPA-A5", "RCME-A1", "RCAD-B2", "RCQ-B2"]);

const SR_EVIDENCE: Record<string, string> = {
  "RCRE-A1": "A bounding site is described and justified to bound every candidate site in the PRA scope.",
  "RCRE-A2": "The nine consequence inputs are extracted per release category from the MS source-term table.",
  "RCRE-A3": "The category definitions and the source-term parameters are reviewed against the input list.",
  "RCRE-B1": "The consequence metric set comes from the intended application through RI-A1.",
  "RCRE-B2": "The degree of evaluation is declared aspect by aspect for the six downstream sub-elements.",
  "RCPA-A1": "Five protective actions are listed, each included with a one-line basis.",
  "RCPA-A4": "Two cohorts split the compliers from the non-compliers at CC-II.",
  "RCPA-A5": "The non-compliance fraction is sourced to evacuation studies, with the sourcing under review.",
  "RCPA-A9": "The evacuation delay is built as the six-link notification-to-departure chain.",
  "RCPA-A11": "The speeds, the delays and the shelter availability are adjusted for the seismic hazard group.",
  "RCME-A1": "The hourly site data is compiled, with the bounding-site representativeness under review.",
  "RCME-A3": "The data recovery is 92 percent, above the ninety percent floor, with the substitution reviewed.",
  "RCAD-B2": "The weather sample shifts the mean by 7 percent, with the mean-shift check being documented.",
  "RCAD-C2": "No credit is taken for plume rise at CC-I, and the buoyancy algorithms earn it at CC-II.",
  "RCAD-E7": "The conservatism direction of the deposition simplifications is demonstrated per aspect.",
  "RCDO-A1": "The five exposure pathways are identified and none is excluded.",
  "RCHE-B1": "Every risk factor is anchored to an internationally recognized body.",
  "RCEC-A1": "The seven cost categories are listed with their parameter definitions.",
  "RCQ-A3": "The event sequence families and their radiological consequences are compiled family by family.",
  "RCQ-B2": "The results are confirmed against the dose-distance trends, with the confirmation being recorded.",
  "RCQ-B3": "The risk-significant contributors are identified per HLR-RI-B.",
  "RCQ-C2": "The uncertainty is propagated with the phenomena dependencies accounted for.",
};

const SUB_ELEMENT_PATH: Record<string, string> = {
  RCRE: "releaseCategoryToConsequence",
  RCPA: "protectiveActionParameters",
  RCME: "meteorologicalData",
  RCAD: "atmosphericTransportAndDispersion",
  RCDO: "dosimetry",
  RCHE: "healthEffects",
  RCEC: "economicFactors",
  RCQ: "consequenceQuantification",
};

const conformanceMatrix: SRConformance[] = Object.keys(RC_SR_CATALOG).flatMap((code) => {
  const meta = RC_SR_CATALOG[code];
  const status: SRStatus = WARN_SRS.has(code) ? "PARTIAL" : "MET";
  const evidence = SR_EVIDENCE[code] ?? "Addressed in the radiological consequence analysis.";
  return (["CC-I", "CC-II"] as const).map((capabilityCategory) => ({
    sr: code,
    hlr: meta.hlr,
    capabilityCategory,
    applicableToStage: meta.stages,
    status,
    satisfiedByElementPaths: [SUB_ELEMENT_PATH[meta.subElement] ?? "documentation"],
    evidence,
  }));
});

const releaseCategoryInputs: ReleaseCategoryInputs[] = [
  {
    releaseCategory: "RC-1",
    sourceTermDefinitionRef: "ST-3",
    releaseCharacteristics: {
      numberOfPlumes: 2,
      radionuclideGroupFractions: [
        { group: "Xe-133", fraction: 8.0e-1 },
        { group: "Kr-85", fraction: 8.0e-1 },
        { group: "I-131", fraction: 4.0e-2 },
        { group: "Cs-137", fraction: 3.0e-2 },
        { group: "Cs-134", fraction: 2.5e-2 },
        { group: "Te-132", fraction: 2.0e-2 },
        { group: "Sb-127", fraction: 1.3e-2 },
        { group: "Sr-90", fraction: 5.0e-4 },
        { group: "Ba-140", fraction: 6.0e-4 },
        { group: "Ru-103", fraction: 3.0e-4 },
        { group: "Ru-106", fraction: 3.0e-4 },
        { group: "Ce-144", fraction: 8.0e-6 },
        { group: "La-140", fraction: 8.0e-6 },
        { group: "Pu-239", fraction: 5.0e-6 },
        { group: "Pu-241", fraction: 5.0e-6 },
        { group: "Na-24", fraction: 3.0e-2 },
        { group: "Na-22", fraction: 3.0e-2 },
      ],
      importantRadionuclides: ["Xe-133", "Kr-85", "Na-24", "I-131", "Cs-137", "Cs-134", "Te-132", "Sb-127", "Sr-90", "Ba-140", "Ru-103", "Ru-106", "Ce-144", "La-140", "Pu-239", "Pu-241", "Na-22"],
      importantRadionuclidesJustification: "The species driving early dose are the noble gases and the sodium-fire activation product Na-24 for cloudshine, the iodine for the thyroid intake, and the cesium and tellurium for the groundshine and inhalation, with the strontium and refractory species carried for the long-term dose.",
      releasePhaseTimings: [
        { startTime: 0, duration: 6, timeUnit: "h" },
        { startTime: 6, duration: 66, timeUnit: "h" },
      ],
      warningTime: 4,
      warningTimeDescription: "About 4 hours from the general emergency declaration to the start of the release.",
      hazardsImpactingProtectiveActions: "The seismic hazard that caused the release also degrades the road network and the shelter availability, so the protective-action credit is reduced for this hazard group.",
      releaseEnergy: 2.0,
      releaseEnergyDescription: "2.0 MW thermal from the sodium-pool fire that drives the plume buoyancy.",
      releaseHeight: 30,
      releaseHeightDescription: "30 m, elevated by the sodium-fire buoyancy above the reactor building.",
      releasedParticleSize: 1,
      releasedParticleSizeDescription: "Sub-micron to few-micron AMAD spectrum peaking near 1 micron, with a coarse tail to 10 microns from the sodium-fire aerosol.",
      releaseUncertainties: "The release fractions carry the MS-D4 propagated distributions, an error factor near 2.7 on the cesium fraction and near 2.4 on the iodine.",
    },
  },
  {
    releaseCategory: "RC-2",
    sourceTermDefinitionRef: "ST-2",
    releaseCharacteristics: {
      numberOfPlumes: 1,
      radionuclideGroupFractions: [
        { group: "Xe-133", fraction: 1.0e-1 },
        { group: "Kr-85", fraction: 1.0e-1 },
        { group: "I-131", fraction: 3.0e-3 },
        { group: "Cs-137", fraction: 2.0e-3 },
        { group: "Cs-134", fraction: 1.6e-3 },
        { group: "Te-132", fraction: 1.5e-3 },
      ],
      importantRadionuclides: ["Xe-133", "Kr-85", "I-131", "Cs-137", "Cs-134", "Te-132"],
      importantRadionuclidesJustification: "The pool scrubbing and the building filtration strip the refractory aerosol, so the filtered release is dominated by the noble gases, the residual iodine and the penetrating cesium.",
      releasePhaseTimings: [{ startTime: 8, duration: 40, timeUnit: "h" }],
      warningTime: 8,
      warningTimeDescription: "About 8 hours from the declaration to the start of the delayed release.",
      hazardsImpactingProtectiveActions: "The internal event leaves the road network and the shelters intact, so the full protective-action credit applies.",
      releaseEnergy: 0.4,
      releaseEnergyDescription: "0.4 MW thermal, insufficient for a credited plume rise.",
      releaseHeight: 10,
      releaseHeightDescription: "10 m, ground level at the building vent.",
      releasedParticleSize: 0.5,
      releasedParticleSizeDescription: "Sub-micron mode after the pool scrubbing removes the coarse aerosol.",
      releaseUncertainties: "The release fractions carry the MS-D4 propagated distribution, an error factor near 2.9 on the cesium fraction.",
    },
  },
  {
    releaseCategory: "RC-3",
    sourceTermDefinitionRef: "ST-1",
    releaseCharacteristics: {
      numberOfPlumes: 1,
      radionuclideGroupFractions: [{ group: "Xe-133", fraction: 1.0e-6 }],
      importantRadionuclides: ["Xe-133"],
      importantRadionuclidesJustification: "The intact-containment release is noble gas only, so only the cloudshine pathway carries any dose.",
      releasePhaseTimings: [{ startTime: 0, duration: 24, timeUnit: "h" }],
      warningTimeDescription: "The release stays below the protective-action threshold, so no warning time is credited.",
      hazardsImpactingProtectiveActions: "No protective action is triggered by the design-leakage release.",
      releaseEnergyDescription: "Negligible, treated as a ground-level release.",
      releaseHeight: 10,
      releaseHeightDescription: "10 m, ground level at the building vent.",
      releasedParticleSizeDescription: "No aerosol, noble gas only.",
      releaseUncertainties: "The release is characterized per MS-D2 against the cover-gas leak-rate range.",
    },
  },
];

const protectiveActionParameters: ProtectiveActionAnalysis = {
  protectiveActionsIncluded: [
    { action: "EVACUATION", included: true, applicabilityJustification: "The population inside the emergency planning zone is moved out of the affected area before or during the plume passage." },
    { action: "SHELTERING", included: true, applicabilityJustification: "The population that does not evacuate stays indoors to reduce the inhalation and the cloudshine dose." },
    { action: "RELOCATION", included: true, applicabilityJustification: "The population is relocated from the contaminated area in the intermediate phase against the projected-dose criterion." },
    { action: "LAND_INTERDICTION_REMEDIATION", included: true, applicabilityJustification: "Contaminated land above the long-term habitability criterion is interdicted or decontaminated before it is released." },
    { action: "FOOD_INTERDICTION_REMEDIATION", included: true, applicabilityJustification: "Contaminated food and crops above the derived intervention levels are interdicted before consumption." },
  ],
  incidentPhasesModeled: [
    { phase: "EARLY", criteriaDescription: "The first four days from plume arrival. Evacuation and sheltering are decided from plant status against the EPA early-phase PAG of 1 to 5 rem projected dose." },
    { phase: "INTERMEDIATE", criteriaDescription: "The first week to the first year. Relocation and interdiction are decided from measurements against the EPA relocation PAG of 2 rem in the first year." },
    { phase: "LATE_LONG_TERM", criteriaDescription: "Beyond the first year. Recovery, decontamination and land release are decided against the 0.5 rem per year habitability criterion." },
  ],
  sourceDocuments: [
    { document: "Site emergency plan and notification scheme", usage: "Grounds the notification chain and the protective-action decision points.", justification: "The plan meets the fifteen-minute alert-and-notification design objective for the emergency planning zone." },
    { document: "Evacuation time estimate study", usage: "Supplies the evacuation delay distributions and the road-network speeds by cohort and condition.", justification: "The study follows the trip-generation and trip-distribution method for the emergency planning zone." },
    { document: "EPA PAG Manual and FDA derived intervention levels", usage: "Sets the dose thresholds for the evacuation, relocation and food-interdiction decisions.", justification: "The guides are the recognized protective-action criteria for the early, intermediate and food pathways." },
  ],
  cohortModeling: {
    approach: "MULTIPLE_COHORTS",
    cohorts: [
      {
        name: "Compliant evacuating cohort",
        description: "About 99.5 percent of the population, evacuating on the notification schedule from the emergency plan.",
        complianceAssumption: "Follows the instruction within the evacuation delay chain, with no shielding credit while in the open during transit.",
      },
      {
        name: "Non-compliant sheltered cohort",
        description: "About 0.5 percent of the population, delaying or declining to evacuate and sheltered in place instead.",
        complianceAssumption: "The 0.5 percent non-compliance fraction is taken from the consequence-code convention used in the reference risk studies, not assumed to be zero.",
      },
    ],
  },
  complianceAssumptions: [
    {
      description: "The 0.5 percent non-compliance fraction is grounded in the published evacuation behavior used in the reference risk studies.",
      basis: "No credit is taken for full compliance, so a residual sheltered cohort always remains in the affected area.",
    },
  ],
  shelterInPlaceCredit: {
    credited: true,
    justification: "The non-compliant cohort is sheltered in place with the building cloudshine, groundshine and inhalation protection factors applied.",
  },
  protectionParameters: [
    { parameter: "Cloudshine shielding factor, normal activity", value: "0.75", source: "Consequence-code convention for the general population, about 19 percent of the day outdoors." },
    { parameter: "Cloudshine shielding factor, sheltered", value: "0.6", source: "Consequence-code convention for the sheltered cohort in the site building stock." },
    { parameter: "Cloudshine shielding factor, evacuating", value: "1.0", source: "No shielding credit while in the open during transit." },
    { parameter: "Groundshine shielding factor, normal activity", value: "0.33", source: "Consequence-code convention for the general population." },
    { parameter: "Groundshine shielding factor, sheltered", value: "0.2", source: "Consequence-code convention for the sheltered cohort." },
    { parameter: "Groundshine shielding factor, evacuating", value: "0.5", source: "Partial shielding credit inside the vehicle during transit." },
    { parameter: "Inhalation protection factor, normal activity", value: "0.41", source: "Consequence-code convention for the general population." },
    { parameter: "Inhalation protection factor, sheltered", value: "0.33", source: "Consequence-code convention for the sheltered cohort in a closed building." },
    { parameter: "Inhalation protection factor, evacuating", value: "1.0", source: "No inhalation protection credit while in the open during transit." },
    { parameter: "Hot-spot relocation dose", value: "0.05 Sv (5 rem) projected, at 12 to 24 hours", source: "The upper EPA early-phase protective-action guide, applied as the hot-spot relocation trigger." },
    { parameter: "Normal relocation dose", value: "0.01 Sv (1 rem) projected, first year", source: "The intermediate-phase relocation criterion against the EPA relocation guide." },
    { parameter: "Long-term habitability criterion", value: "0.04 Sv (4 rem) over 5 years", source: "The 2 rem first-year plus 0.5 rem per year habitability and land-release criterion." },
  ],
  evacuationModeling: {
    approach: "Road-network evacuation model with a bounding radial speed",
    description: "The routing follows the bounding road-network model at a 1.8 m per second effective radial speed until the site is selected and a plant-specific network is available.",
  },
  evacuationDelayComponents: [
    { component: "GENERAL_EMERGENCY_DECLARATION", estimate: "0 min, the reference point for the chain" },
    { component: "SITE_NOTIFIES_OFFICIALS", estimate: "+15 min, meeting the alert-and-notification objective" },
    { component: "OFFICIALS_NOTIFY_PUBLIC", estimate: "+20 min for the public alert and instruction" },
    { component: "PUBLIC_RECEIVES_INSTRUCTIONS", estimate: "+15 min to receive and understand the instruction" },
    { component: "SECURE_PERSONAL_PROPERTY", estimate: "+30 min to prepare the home and gather the household" },
    { component: "LOAD_VEHICLES", estimate: "+20 min to load the vehicles and depart" },
  ],
  evacuationSpeed: {
    basis: "The evacuation speeds come from the site-specific evacuation time estimate study, a bounding 1.8 m per second radial speed in congestion, not a generic free-flow value.",
    daytimeNighttimeConsidered: true,
    adverseWeatherConsidered: true,
    specialEventsConsidered: true,
    transientPopulationsConsidered: true,
  },
  hazardGroupAdjustments: [
    {
      hazardGroup: "Seismic",
      adjustmentDescription: "The earthquake that breached the barrier also drops the bridges and damages the buildings, so the road-network capacity, the evacuation speeds and the shelter availability are reduced for the seismic hazard group that caused the release.",
    },
    {
      hazardGroup: "Internal events",
      adjustmentDescription: "The internal-event release leaves the infrastructure intact, so the full evacuation speeds and shelter availability apply.",
    },
  ],
  populationDistribution: {
    basis: "ASSUMED_JUSTIFIED",
    description: "A bounding uniform population density of 100 persons per square kilometre within the 80 km analysis radius, with transients included and the demographics projected to the analysis year.",
    justification: "The assumed density and its projection are justified to bound the candidate sites in the PRA scope until the site is selected.",
    transientPopulationsIncluded: true,
    projectionAdjustments: "The base density is projected forward to the analysis year at the regional growth rate.",
  },
  landUseData: {
    basis: "GENERIC_SIMPLIFIED",
    description: "A generic land-use mix of cropland, dairy and non-farm use out to 80 km, until the county-level land-use data is available at site selection.",
    intraRegionalAdjustments: "The crop and dairy fractions are held uniform across the analysis grid at the bounding stage.",
  },
  plantPhysicalCharacteristics: {
    basis: "ACTUAL",
    description: "The actual reactor-building dimensions and the stack heights from the design, used for the building-wake and the release-elevation treatment.",
  },
  releaseSourceGeographicLocation: "The release enters the atmosphere at the reactor building, 10 m above grade for the ground-level categories and 30 m for the buoyant early-release category.",
  boundingSiteLocationJustification: "The bounding-site location, a flat inland site with a 400 m exclusion-area boundary and the nearest population centre at 6 km, is justified to bound the off-site data of every candidate site.",
  parameterUncertaintyCharacterization: "The non-compliance fraction, the evacuation delay and speed, and the population density are carried as characterized parameter uncertainties.",
  modelUncertainty: {
    sources: ["Non-compliance fraction", "Evacuation road-network model"],
    assumptions: ["The evacuation network rests on a bounding radial-speed model.", "The population density is a bounding uniform assumption."],
    alternatives: ["A finer cohort split by region", "A plant-specific road-network model"],
  },
  implementsSrs: srs("RCPA-A1", "RCPA-A2", "RCPA-A3", "RCPA-A4", "RCPA-A5", "RCPA-A6", "RCPA-A7", "RCPA-A8", "RCPA-A9", "RCPA-A10", "RCPA-A11", "RCPA-A12", "RCPA-B1", "RCPA-B2", "RCPA-B3", "RCPA-B4", "RCPA-B5", "RCPA-B6", "RCPA-B7", "RCPA-C1", "RCPA-C2", "RCPA-C3"),
};

const meteorologicalData: MeteorologicalDataAnalysis = {
  dataSource: "Onsite meteorological tower with wind speed and direction at 10 m and 60 m, ambient temperature at 10 m, the vertical temperature difference between 10 m and 60 m, and precipitation near ground level.",
  spatialRepresentativenessJustification: "The tower is justified as spatially representative of the release area, on the same flat inland terrain with no intervening large water body.",
  periodSelection: {
    approach: "MULTI_YEAR_EVALUATION",
    periodDescription: "Five years of hourly data are evaluated and the representative single year is selected as the one closest to the five-year joint frequency distribution.",
  },
  dataRecovery: {
    combinedRecoveryPercent: 92,
    meetsNinetyPercent: true,
    lowRecoveryJustification: "The joint recovery of wind speed, wind direction and stability class is 92 percent, above the ninety percent floor.",
    substitutionTechniques: "Short gaps under two hours are filled by interpolation, and longer gaps use the redundant channel, with the technique recorded per gap.",
    meteorologistReview: {
      performed: true,
      reviewerQualification: "A qualified meteorologist reviewed the substitution and the representativeness.",
      considerations: "The terrain, the water bodies and the seasonal wind patterns were considered in the review.",
    },
  },
  instrumentationQuality: {
    calibratedProgram: true,
    description: "The instruments are under a calibrated and maintained program with daily channel checks and semiannual channel calibrations from sensor through recorder.",
  },
  extractedParameters: {
    windSpeedAndDirection10m: true,
    stabilityClassMeasurement: true,
    precipitation: true,
  },
  mixingHeights: {
    scope: "SEASONAL_MORNING_AND_AFTERNOON",
    source: "Seasonal morning-minimum and afternoon-maximum mixing heights from the recognized national mixing-height climatology.",
  },
  stabilityClassificationMethod: {
    approach: "RECOGNIZED_SOURCE",
    description: "The Pasquill stability class is assigned from the vertical temperature difference between 10 m and 60 m using the recognized delta-T classification, not a simplified rule.",
  },
  accuracyReview: {
    performed: true,
    findings: "The data accuracy was reviewed against the system accuracy classes and the findings recorded, with no channel outside its accuracy band.",
  },
  temporalChangesAccommodation: "The diurnal and seasonal changes are carried in the hourly record and the seasonal mixing heights.",
  timeResolution: "Hourly, matching the dispersion model time step.",
  parameterUncertaintyCharacterization: "The weather-year representativeness is characterized as a parameter uncertainty and sampled in the dispersion analysis.",
  modelUncertainty: {
    sources: ["Weather-year representativeness"],
    assumptions: ["The selected year is a representative bounding set for the site."],
    alternatives: ["A multi-year composite weather set"],
  },
  implementsSrs: srs("RCME-A1", "RCME-A2", "RCME-A3", "RCME-A4", "RCME-A5", "RCME-A6", "RCME-A7", "RCME-A8", "RCME-A9", "RCME-A10", "RCME-B1", "RCME-B2", "RCME-B3"),
};

const atmosphericTransportAndDispersion: AtmosphericDispersionAnalysis = {
  dispersionModel: {
    modelClass: "SEGMENTED_PLUME",
    name: "Segmented-plume Gaussian dispersion model",
    justification: "A variable-trajectory segmented plume is justified for the multi-hour two-phase release over the sampled weather year, where the wind shifts between the early and the long-term phase.",
  },
  temporalResolution: {
    approach: "HOURLY_UPDATES",
    description: "The wind, the stability and the precipitation update each hour, and a new plume segment is started each hour of release.",
  },
  spatialTreatment: {
    approach: "TWO_DIMENSIONAL_GRID",
    gridDescription: "A polar grid of 16 compass sectors by radial rings out to 80 km.",
    gridJustification: "The two-dimensional grid is justified for the receptor distances of interest, from the 400 m boundary to the 80 km population limit.",
  },
  windFieldData: "The wind-field data is the single-tower observation carried across the grid, consistent with the RCME meteorology.",
  windRepresentativeness: "The single-tower wind field is representative of the flat inland release area.",
  meteorologicalDataPerRcme: true,
  meteorologicalSampling: {
    approach: "STATISTICAL_SAMPLING",
    technique: "The weather year is binned into 16 stability-and-wind-speed classes plus 20 rain-and-distance classes, and about 1000 weather trials are drawn by stratified sampling across the 36 bins.",
    meanShiftValidation: {
      performed: true,
      meanShiftPercent: 7,
      justification: "The 1000-trial sample reproduces the full-year mean dispersion factor within 7 percent, inside the ten percent criterion.",
    },
  },
  elevatedReleaseAlgorithms: "The elevated-release algorithms are applied with the 30 m release height for the buoyant early-release category, and a ground-level treatment for the filtered and leakage categories.",
  plumeRise: {
    credited: true,
    algorithmsDescription: "The plume rise is credited through the momentum and buoyancy algorithms for the 2.0 MW sodium-fire early-release category at CC-II, and taken as ground level otherwise.",
  },
  buildingWakeEffects: "The building-wake effects are applied with the actual reactor-building dimensions for the ground-level categories at CC-II.",
  plumeSegmentation: {
    approach: "MULTIPLE_PLUMES",
    description: "The two-phase early release is treated as a sequence of hourly plume segments so the wind shift between the early puff and the long-term phase is carried.",
  },
  deposition: {
    dryDeposition: {
      included: true,
      approach: "PER_PARTICLE_SIZE",
      velocities: [
        { particleSize: "0.1 micron AMAD", velocity: 0.0005 },
        { particleSize: "1 micron AMAD", velocity: 0.001 },
        { particleSize: "5 micron AMAD", velocity: 0.005 },
        { particleSize: "10 micron AMAD", velocity: 0.017 },
      ],
    },
    wetDeposition: {
      included: true,
      precipitationIntensityDependent: true,
      washoutCoefficients: [
        { condition: "Light rain, 1 mm per hour", coefficient: 9.5e-5 },
        { condition: "Moderate rain, 4 mm per hour", coefficient: 2.9e-4 },
        { condition: "Heavy rain, 16 mm per hour", coefficient: 8.6e-4 },
      ],
    },
    sourceDepletion: {
      included: true,
      scope: "DRY_AND_WET",
    },
    resuspension: {
      included: true,
      description: "Resuspension of the deposited material is included for the long-term inhalation dose in the intermediate phase.",
    },
  },
  terrainEffectsConsideration: "The flat-earth assumption is justified for the inland bounding site with no significant terrain within the analysis grid.",
  siteCharacteristicsConsidered: "The surface roughness of 10 cm and the mixing-height cap are carried in the dispersion.",
  receptorLocationsSpecification: "The receptors are the 400 m exclusion-area boundary individual and the population-grid nodes out to 80 km, including the 6 km population centre.",
  modelLimitations: "The straight-line-within-segment approximation and the flat-earth grid bound the model to the validated downwind distance of 80 km.",
  parameterUncertaintyCharacterization: "The dry-deposition velocity, the washout coefficient and the dispersion-coefficient fits are carried as characterized parameter uncertainties.",
  modelUncertainty: {
    sources: ["Wet-deposition washout model", "Dry-deposition velocity by particle size"],
    assumptions: ["The flat-earth dispersion is bounded to the inland site.", "The washout follows the power-law form."],
    alternatives: ["A terrain-following trajectory model", "A spectral washout model"],
  },
  implementsSrs: srs("RCAD-A1", "RCAD-A2", "RCAD-A3", "RCAD-A4", "RCAD-A5", "RCAD-A6", "RCAD-A7", "RCAD-A8", "RCAD-B1", "RCAD-B2", "RCAD-C1", "RCAD-C2", "RCAD-C3", "RCAD-C4", "RCAD-C5", "RCAD-C6", "RCAD-D1", "RCAD-D2", "RCAD-D3", "RCAD-D4", "RCAD-E1", "RCAD-E2", "RCAD-E3", "RCAD-E4", "RCAD-E5", "RCAD-E6", "RCAD-E7", "RCAD-F1", "RCAD-F2", "RCAD-F3"),
};

const dosimetry: DosimetryAnalysis = {
  exposurePathways: [
    { pathway: "CLOUDSHINE", included: true },
    { pathway: "GROUNDSHINE", included: true },
    { pathway: "SKIN_DEPOSITION", included: true },
    { pathway: "INHALATION", included: true },
    { pathway: "INGESTION", included: true },
  ],
  dispersionResultsUsed: true,
  exposurePeriods: [
    { period: "Early phase, plume passage and first 4 days", justification: "The cloudshine and the inhalation integrate over the plume passage, and the early groundshine over the first four days." },
    { period: "Intermediate phase, first year", justification: "The groundshine and the resuspension inhalation integrate over the relocation-criteria window to the first year." },
    { period: "Late phase, to 50-year commitment", justification: "The committed dose from the intake is integrated over the 50-year dose-commitment period." },
  ],
  cloudImmersionModel: {
    approach: "FINITE_PLUME_OR_CORRECTED",
    description: "A finite-plume deep-dose model with the cloud geometry corrected, rather than the semi-infinite approximation, for the elevated buoyant plume.",
  },
  groundshineIntegration: "The groundshine is integrated over each exposure period with the deposited-activity decay and the weathering removal.",
  skinBetaTreatment: "The beta dose to the skin from the deposited material is included at CC-II with the skin dose-conversion factors.",
  breathingRates: {
    approach: "PER_COHORT_JUSTIFIED",
    description: "A breathing rate of 2.66e-4 cubic metres per second is applied for the early phase, adjusted per cohort by activity, with the long-term rate applied in the intermediate phase.",
  },
  ingestionTreatment: {
    approach: "GENERIC_INTAKE",
    description: "A generic ingestion intake is included at CC-II through the food pathway, screened against the derived intervention levels.",
  },
  dcf: {
    source: "Federal Guidance Report 12 for the external cloudshine and groundshine, Federal Guidance Report 11 and 13 for the internal inhalation and ingestion, cross-checked against ICRP Publication 72 and 119.",
    type: "ORGAN_SPECIFIC",
  },
  shieldingConsiderations: "The cloudshine, groundshine and inhalation protection factors follow the cohort definitions from the protective-action analysis.",
  occupancyConsiderations: "The occupancy fractions, about 19 percent outdoors for the general population, follow the cohort definitions.",
  receptorTypes: ["Site-boundary individual at 400 m", "Population-centre resident at 6 km", "Population-grid node to 80 km"],
  dosimetryModelsUsed: "A pathway dose-integration calculation using the recognized dose-conversion factor libraries.",
  doseAggregationMethod: "The dose is aggregated across the five pathways for the total effective dose, and by organ for the early-effect thresholds.",
  radionuclideDecayConsideration: "The decay and the daughter buildup during transport and exposure are accounted for over each period.",
  parameterUncertaintyCharacterization: "The dose-conversion factors, the breathing rate and the shielding factors are carried as characterized parameter uncertainties.",
  modelUncertainty: {
    sources: ["Cloud-immersion geometry", "Dose-conversion factor set"],
    assumptions: ["The dose-conversion factors come from the recognized federal and international sources."],
    alternatives: ["A voxel-phantom organ-dose model resolved per cohort"],
  },
  implementsSrs: srs("RCDO-A1", "RCDO-A2", "RCDO-A3", "RCDO-A4", "RCDO-A5", "RCDO-A6", "RCDO-A7", "RCDO-A8", "RCDO-A9", "RCDO-A10", "RCDO-B1", "RCDO-B2", "RCDO-C1", "RCDO-C2"),
};

const healthEffects: HealthEffectsAnalysis = {
  earlyHealthEffects: [
    "Hematopoietic syndrome, with a red-marrow LD50 near 3.8 Gy under minimal medical care",
    "Pulmonary injury from the inhaled material at a high acute lung dose",
    "Gastrointestinal syndrome from a high acute dose to the lower large intestine",
  ],
  latentHealthEffects: [
    "Latent cancer fatality across the exposed population",
    "Latent cancer incidence across the exposed population",
    "Thyroid nodules and cancer from the iodine intake",
  ],
  earlyEffectParameters: {
    approach: "ORGAN_SPECIFIC_DOSE_RESPONSE",
    description: "Organ-specific hazard-function dose-response parameters for the red marrow, the lung and the lower large intestine, with the threshold and the LD50 by organ.",
  },
  latentEffectParameters: {
    approach: "ORGAN_SPECIFIC_FACTORS",
    description: "Organ-specific risk factors with the dose and dose-rate effectiveness factor applied at low dose, and the incidence and fatality split carried separately.",
  },
  ageGenderHomogeneous: true,
  riskFactorSources: [
    { source: "BEIR VII lifetime attributable risk model", recognizedBody: "National research council", version: "Phase 2" },
    { source: "ICRP nominal risk coefficients", recognizedBody: "International commission on radiological protection", version: "Publication 103" },
    { source: "Federal Guidance Report 13 risk coefficients", recognizedBody: "United States environmental protection agency", version: "1999" },
  ],
  parameterUncertaintyCharacterization: "The dose-response slope at low dose, the dose-rate effectiveness factor and the early-effect thresholds are carried as characterized parameter uncertainties.",
  modelUncertainty: {
    sources: ["Low-dose dose-response shape", "Dose-rate effectiveness factor"],
    assumptions: ["The population is kept age and gender homogeneous.", "The linear-no-threshold model applies for the latent effects."],
    alternatives: ["Age and gender resolved risk factors", "A threshold or hormetic low-dose model"],
  },
  implementsSrs: srs("RCHE-A1", "RCHE-A2", "RCHE-A3", "RCHE-A4", "RCHE-A5", "RCHE-A6", "RCHE-B1", "RCHE-B2", "RCHE-B3", "RCHE-C1", "RCHE-C2", "RCHE-C3"),
};

const economicFactors: EconomicFactorsAnalysis = {
  costCategories: [
    { category: "Evacuation cost", parameterDefinitions: ["The per-person daily cost of the evacuation and the temporary lodging."] },
    { category: "Relocation and temporary unemployment", parameterDefinitions: ["The per-person one-time relocation cost and the temporary loss of employment."] },
    { category: "Land value and depreciation", parameterDefinitions: ["The lost land value and the depreciation of the interdicted area."] },
    { category: "Crop losses", parameterDefinitions: ["The value of the crops and the dairy lost to the interdiction."] },
    { category: "Decontamination", parameterDefinitions: ["The per-hectare farm and per-person non-farm decontamination cost at the two decontamination-factor levels."] },
    { category: "Loss of use", parameterDefinitions: ["The cost of the property held out of use during the recovery and interdiction period."] },
    { category: "Medical costs", parameterDefinitions: ["The cost of the medical response to the early and the latent health effects."] },
  ],
  parameterConsistencyConfirmed: true,
  costParameterEstimates: [
    {
      parameter: "Evacuation and relocation daily cost",
      dataBasis: "GENERIC_JUSTIFIED",
      source: "Reference consequence-code economic parameters, about 172 dollars per person-day.",
      justification: "For a bounding site the daily cost is the reference-study value pending the selected-region cost, logged for closure.",
      timeFrameAdjustment: "Escalated to the analysis year with the consumer price index.",
    },
    {
      parameter: "One-time relocation cost",
      dataBasis: "GENERIC_JUSTIFIED",
      source: "Reference consequence-code economic parameters, about 12000 dollars per person.",
      timeFrameAdjustment: "Escalated to the analysis year with the consumer price index.",
    },
    {
      parameter: "Farm decontamination cost",
      dataBasis: "GENERIC_JUSTIFIED",
      source: "Reference consequence-code economic parameters, about 1330 dollars per hectare at decontamination factor 3 and 2960 at factor 15.",
      timeFrameAdjustment: "Escalated to the analysis year with the consumer price index.",
    },
    {
      parameter: "Non-farm decontamination cost",
      dataBasis: "GENERIC_JUSTIFIED",
      source: "Reference consequence-code economic parameters, about 7110 dollars per person at decontamination factor 3 and 19000 at factor 15.",
      timeFrameAdjustment: "Escalated to the analysis year with the consumer price index.",
    },
    {
      parameter: "Land and farm wealth value",
      dataBasis: "REGIONAL_SITE_APPLICABLE",
      source: "Regional farm and non-farm wealth values within the 80 km grid, with the fraction in improvements.",
      justification: "For a bounding site the regional wealth values are estimated prior to site selection and logged for closure.",
    },
    {
      parameter: "Depreciation and discount rate",
      dataBasis: "GENERIC_JUSTIFIED",
      source: "A 20 percent per year depreciation rate and a 12 percent per year societal discount rate from the reference economic study.",
    },
  ],
  parameterUncertaintyCharacterization: "The daily cost, the decontamination cost and the land value are carried as characterized parameter uncertainties.",
  modelUncertainty: {
    sources: ["Regional cost parameters", "Interdiction and condemnation criterion"],
    assumptions: ["The regional costs are estimated prior to site selection.", "Land not restorable within 30 years is condemned."],
    alternatives: ["Selected-region cost data at site selection"],
  },
  implementsSrs: srs("RCEC-A1", "RCEC-A2", "RCEC-B1", "RCEC-B2", "RCEC-B3", "RCEC-B4", "RCEC-B5", "RCEC-B6", "RCEC-B7", "RCEC-C1", "RCEC-C2", "RCEC-C3"),
};

const consequenceQuantification: ConsequenceQuantificationAnalysis = {
  consequenceCodesUsed: [
    { code: "Consequence pipeline code", benchmarkBasis: "Benchmarked against a hand Gaussian-plume calculation for the simple cases and cross-checked against an independent Lagrangian puff model." },
    { code: "Weather-sampling driver", benchmarkBasis: "Validated to reproduce the full-year mean dispersion factor within ten percent." },
  ],
  modelAndCodeLimitations: [
    { code: "Consequence pipeline code", feature: "Plume-duration regime", limitation: "The segmented-plume model is bounded to the validated release-duration range of the 72-hour early release." },
    { code: "Consequence pipeline code", feature: "Spatial limit", limitation: "The grid is bounded to the validated 80 km downwind distance." },
    { code: "Consequence pipeline code", feature: "Flat earth versus terrain", limitation: "The flat-earth assumption is justified for the inland bounding site." },
  ],
  eventSequenceConsequences: [
    {
      uuid: "RCQ-ESF-EARLY",
      eventSequenceFamily: "ESF-EARLY",
      releaseCategoryReference: "RC-1",
      sourceTermReference: "ST-3",
      consequenceResults: [
        { metric: "Individual early fatality risk", meanValue: 2.0e-7, unit: "per event", uncertaintyDistribution: { type: DistributionType.LOGNORMAL, median: 1.0e-7, errorFactor: 5.0 }, uncertaintyDescription: "The boundary dose stays below the acute threshold with evacuation, so the early-fatality risk is small and propagated." },
        { metric: "Individual latent cancer fatality risk", meanValue: 2.0e-4, unit: "per event", uncertaintyDistribution: { type: DistributionType.LOGNORMAL, median: 2.0e-4, errorFactor: 3.0 }, uncertaintyDescription: "Propagated with the phenomena dependencies between the weather and the deposition." },
        { metric: "Individual dose at boundary", meanValue: 8.0e-2, unit: "Sv", uncertaintyDistribution: { type: DistributionType.LOGNORMAL, median: 8.0e-2, errorFactor: 2.5 }, uncertaintyDescription: "The 50-year committed effective dose at the 400 m boundary, propagated." },
        { metric: "Population dose to 80 km", meanValue: 4.0e3, unit: "person-Sv", uncertaintyDistribution: { type: DistributionType.LOGNORMAL, median: 4.0e3, errorFactor: 3.0 }, uncertaintyDescription: "The collective effective dose to the population within 80 km." },
      ],
      riskSignificance: ImportanceLevel.HIGH,
    },
    {
      uuid: "RCQ-ESF-ATWS",
      eventSequenceFamily: "ESF-ATWS",
      releaseCategoryReference: "RC-1",
      sourceTermReference: "ST-3",
      consequenceResults: [
        { metric: "Individual early fatality risk", meanValue: 1.5e-7, unit: "per event", uncertaintyDistribution: { type: DistributionType.LOGNORMAL, median: 8.0e-8, errorFactor: 5.0 }, uncertaintyDescription: "The reactivity-transient family shares the early-release category, with a small propagated early-fatality risk." },
        { metric: "Individual latent cancer fatality risk", meanValue: 1.8e-4, unit: "per event", uncertaintyDistribution: { type: DistributionType.LOGNORMAL, median: 1.8e-4, errorFactor: 3.0 }, uncertaintyDescription: "Propagated with the phenomena dependencies." },
        { metric: "Individual dose at boundary", meanValue: 7.0e-2, unit: "Sv", uncertaintyDistribution: { type: DistributionType.LOGNORMAL, median: 7.0e-2, errorFactor: 2.5 }, uncertaintyDescription: "The 50-year committed effective dose at the boundary for the reactivity-transient family, propagated." },
        { metric: "Population dose to 80 km", meanValue: 3.5e3, unit: "person-Sv", uncertaintyDistribution: { type: DistributionType.LOGNORMAL, median: 3.5e3, errorFactor: 3.0 }, uncertaintyDescription: "The collective effective dose within 80 km." },
      ],
      riskSignificance: ImportanceLevel.HIGH,
    },
    {
      uuid: "RCQ-ESF-LATE",
      eventSequenceFamily: "ESF-LATE",
      releaseCategoryReference: "RC-2",
      sourceTermReference: "ST-2",
      consequenceResults: [
        { metric: "Individual early fatality risk", meanValue: 0.0, unit: "per event", uncertaintyDescription: "The filtered release is far below the acute threshold, so the early-fatality risk is zero." },
        { metric: "Individual latent cancer fatality risk", meanValue: 1.0e-5, unit: "per event", uncertaintyDistribution: { type: DistributionType.LOGNORMAL, median: 1.0e-5, errorFactor: 3.0 }, uncertaintyDescription: "Propagated with the phenomena dependencies." },
        { metric: "Individual dose at boundary", meanValue: 4.0e-3, unit: "Sv", uncertaintyDistribution: { type: DistributionType.LOGNORMAL, median: 4.0e-3, errorFactor: 2.5 }, uncertaintyDescription: "The 50-year committed effective dose at the boundary for the filtered release, propagated." },
        { metric: "Population dose to 80 km", meanValue: 2.0e2, unit: "person-Sv", uncertaintyDistribution: { type: DistributionType.LOGNORMAL, median: 2.0e2, errorFactor: 3.0 }, uncertaintyDescription: "The collective effective dose within 80 km." },
      ],
      riskSignificance: ImportanceLevel.MEDIUM,
    },
    {
      uuid: "RCQ-ESF-LEAK",
      eventSequenceFamily: "ESF-LEAK",
      releaseCategoryReference: "RC-3",
      sourceTermReference: "ST-1",
      consequenceResults: [
        { metric: "Individual early fatality risk", meanValue: 0.0, unit: "per event", uncertaintyDescription: "No acute dose, so the early-fatality risk is zero." },
        { metric: "Individual latent cancer fatality risk", meanValue: 2.0e-8, unit: "per event", uncertaintyDescription: "Characterized, below the action threshold." },
        { metric: "Individual dose at boundary", meanValue: 1.0e-6, unit: "Sv", uncertaintyDescription: "Characterized, below the action threshold." },
        { metric: "Population dose to 80 km", meanValue: 5.0e-2, unit: "person-Sv", uncertaintyDescription: "Characterized, a negligible noble-gas cloudshine collective dose." },
      ],
      riskSignificance: ImportanceLevel.LOW,
    },
  ],
  outputReview: {
    performed: true,
    indicationsFound: [],
    acceptanceJustifications: [
      "No error statements were found in the run logs for the 1000-trial weather sample.",
      "No silent zeros were found in the risk-significant families, and the low-consequence leakage family is expected to be near zero.",
    ],
  },
  resultsConfirmation: {
    performed: true,
    description: "The results were confirmed by examining the dose-distance trends, which fall off monotonically with distance and scale with the release fraction as expected.",
  },
  riskSignificantContributors: [
    { contributor: "Early-release category RC-1", basisPerRiB: "Drives the latent cancer risk and the population dose per HLR-RI-B.", significance: ImportanceLevel.HIGH },
    { contributor: "Pool scrubbing decontamination factor", basisPerRiB: "The aerosol-retention uncertainty moves the cesium release fraction and the consequence per HLR-RI-B.", significance: ImportanceLevel.HIGH },
    { contributor: "Evacuation timing for the seismic group", basisPerRiB: "The non-compliance fraction and the road damage move the early dose for the seismic hazard group.", significance: ImportanceLevel.MEDIUM },
  ],
  riskSignificanceCriteriaUsed: [
    {
      criteriaType: "SAFETY_GOAL",
      description: "The frequency-consequence target from the intended application, anchored to the quantitative health objectives of 5e-7 per year prompt fatality and 2e-6 per year latent cancer fatality.",
    },
  ],
  modelUncertaintyAssessments: [
    {
      sourceSubElement: "RCAD",
      uncertaintySource: "Wet-deposition washout model",
      relatedAssumptions: ["The washout coefficient follows the power-law form with the precipitation intensity."],
      reasonableAlternatives: ["A spectral washout model resolved by droplet size"],
      evaluationType: "QUANTITATIVE",
      evaluationScope: "INDIVIDUAL",
      effectOnMetrics: "Shifts the local groundshine and the downwind concentration together, so it is sampled with the weather.",
    },
    {
      sourceSubElement: "RCPA",
      uncertaintySource: "Non-compliance fraction",
      relatedAssumptions: ["The 0.5 percent non-compliance fraction comes from the reference evacuation behavior."],
      reasonableAlternatives: ["A region-specific compliance survey"],
      evaluationType: "QUANTITATIVE",
      evaluationScope: "COMBINATION",
      effectOnMetrics: "Combines with the warning time to move the early dose for the sheltered cohort.",
    },
    {
      sourceSubElement: "RCHE",
      uncertaintySource: "Low-dose dose-response model",
      relatedAssumptions: ["The risk factors come from internationally recognized bodies under the linear-no-threshold model."],
      reasonableAlternatives: ["An alternative dose-response shape at low dose"],
      evaluationType: "QUALITATIVE",
      evaluationScope: "INDIVIDUAL",
      effectOnMetrics: "Shifts the latent cancer risk per unit dose across the population.",
    },
    {
      sourceSubElement: "RCDO",
      uncertaintySource: "Cloud-immersion geometry",
      relatedAssumptions: ["The finite-plume correction is applied for the elevated buoyant plume."],
      reasonableAlternatives: ["A semi-infinite cloud approximation"],
      evaluationType: "QUANTITATIVE",
      evaluationScope: "INDIVIDUAL",
      effectOnMetrics: "Shifts the cloudshine dose for the elevated early-release plume.",
    },
  ],
  uncertaintyCharacterization: {
    level: "PROPAGATED_WITH_PHENOMENA_DEPENDENCIES",
    description: "The uncertainty distribution of each consequence metric is calculated by propagation over the weather sample and the parameter distributions, with the dependencies between the uncertain phenomena accounted for.",
    phenomenaDependencies: [
      {
        description: "The weather year drives the dispersion and the wet deposition together, so the same hour drives both.",
        dependentPhenomena: ["Weather sampling", "Wet deposition"],
        treatmentMethod: "Sampled together in the same weather trial.",
      },
      {
        description: "The evacuation timing and the early dose are correlated through the release timing and the warning time.",
        dependentPhenomena: ["Evacuation timing", "Early dose"],
        treatmentMethod: "Sampled together so the warning time moves both.",
      },
      {
        description: "The pool scrubbing decontamination factor sets both the released cesium fraction and the aerosol particle size that drives deposition.",
        dependentPhenomena: ["Pool scrubbing", "Deposition velocity"],
        treatmentMethod: "Carried from the MS source-term propagation into the dispersion sample.",
      },
    ],
  },
  riskMetricMapping: [
    {
      consequenceMetric: "Individual latent cancer fatality risk",
      riskMetric: "INDIVIDUAL_LATENT_CANCER_FATALITY_RISK",
      mappingDescription: "The family-by-family consequence table is what RI pairs with the ESQ frequency to form the individual latent-cancer risk against the quantitative health objective.",
    },
    {
      consequenceMetric: "Individual early fatality risk",
      riskMetric: "INDIVIDUAL_EARLY_FATALITY_RISK",
      mappingDescription: "The boundary early-fatality risk feeds the prompt-fatality axis of the frequency-consequence target.",
    },
    {
      consequenceMetric: "Individual dose at boundary",
      riskMetric: "OTHER",
      mappingDescription: "The 30-day dose at the boundary maps to the dose axis of the licensing frequency-consequence target.",
    },
  ],
  quantificationLimitations: [
    "The flat-earth dispersion is bounded to the inland bounding site.",
    "The bounding uniform population density is conservative until the site is selected.",
  ],
  implementsSrs: srs("RCQ-A1", "RCQ-A2", "RCQ-A3", "RCQ-B1", "RCQ-B2", "RCQ-B3", "RCQ-C1", "RCQ-C2", "RCQ-D1", "RCQ-D2", "RCQ-D3"),
};

const sensitivityStudies: SensitivityStudy[] = [
  {
    uuid: "SS-1",
    name: "Weather-year sensitivity",
    description: "Sweep of the selected weather year across the five candidate years.",
    variedParameters: ["Weather year"],
    parameterRanges: { "Weather year": [1, 5] },
    results: "Selecting a wetter year raises the local groundshine and lowers the downwind population dose, within the propagated interval.",
  },
  {
    uuid: "SS-2",
    name: "Evacuation-delay sensitivity",
    description: "Sweep of the total evacuation delay chain from 100 to 130 minutes.",
    variedParameters: ["Evacuation delay"],
    parameterRanges: { "Evacuation delay": [100, 130] },
    results: "Adding thirty minutes to the delay chain raises the early dose for the sheltered cohort but does not change the risk-significance ranking.",
  },
  {
    uuid: "SS-3",
    name: "Plume-rise credit sensitivity",
    description: "Sweep of the plume-rise credit for the buoyant early release from no credit to full credit.",
    variedParameters: ["Plume rise credit"],
    parameterRanges: { "Plume rise credit": [0, 1] },
    results: "Crediting the plume rise lowers the boundary dose by about a factor of two, so the credit is justified before it is taken.",
  },
  {
    uuid: "SS-4",
    name: "Dry-deposition velocity sensitivity",
    description: "Sweep of the dry-deposition velocity for the 1 micron aerosol from 0.3 to 3 cm per second.",
    variedParameters: ["Dry deposition velocity"],
    parameterRanges: { "Dry deposition velocity": [0.003, 0.03] },
    results: "A higher deposition velocity raises the local groundshine and lowers the downwind concentration, trading dose between the near and the far field.",
  },
];

const boundingSiteAssumptions = [
  { id: "BS-1", area: "Protective actions", desc: "The evacuation network rests on a bounding radial-speed model, to confirm against the selected-site road network.", path: "protectiveActionParameters" },
  { id: "BS-2", area: "Population", desc: "The population density is a bounding uniform assumption, to replace with census demographics at site selection.", path: "protectiveActionParameters" },
  { id: "BS-3", area: "Meteorology", desc: "The weather year is a bounding representative set, to replace with the selected-site tower data.", path: "meteorologicalData" },
  { id: "BS-4", area: "Economics", desc: "The regional wealth values are estimated prior to site selection, to update with the selected-region data.", path: "economicFactors" },
].map((a) => ({
  uuid: a.id,
  assumptionId: a.id,
  description: a.desc,
  influenceOnDefinition: a.area,
  status: "OPEN" as const,
  limitations: ["Bounding site, pending closure at site selection."],
  riskImpact: ImportanceLevel.MEDIUM,
  closureBasis: "Close against the selected site.",
  plannedClosureActions: ["Re-check at site selection."],
  affectedElementIds: [a.path],
}));

const preOperationalAssumptions = [
  { id: "PA-1", area: "Protective actions", desc: "The emergency plan and the evacuation time estimate rest on the pre-operational plan, to confirm against the as-operated drills and the final evacuation time estimate.", path: "protectiveActionParameters", sr: "RCPA-C3" },
  { id: "PA-2", area: "Meteorology", desc: "The representative weather year rests on the pre-operational tower placement, to confirm against the as-built onsite tower record.", path: "meteorologicalData", sr: "RCME-B3" },
  { id: "PA-3", area: "Consequence quantification", desc: "The nine consequence inputs rest on the pre-operational source term, to confirm against the as-built fuel and the startup source term.", path: "consequenceQuantification", sr: "RCQ-D1" },
].map((a) => ({
  uuid: a.id,
  assumptionId: a.id,
  description: a.desc,
  influenceOnDefinition: a.area,
  status: "OPEN" as const,
  limitations: ["Pre-operational, pending as-built and as-operated confirmation."],
  riskImpact: ImportanceLevel.MEDIUM,
  closureBasis: "Confirm against the operating plant.",
  plannedClosureActions: ["Re-check at the operating stage."],
  affectedElementIds: [a.path],
  implementsSrs: srs(a.sr),
}));

const documentation: RcDocumentation = {
  processDescription: "The source term is received per category, the site and the people are characterized, the plume is transported, and the dose, the health effects and the costs are quantified per event sequence family, per ASME/ANS RA-S-1.4 HLR-RCRE through HLR-RCQ.",
  inputsDescription: "RC takes the source-term table from MS, the release-category definitions from ES, and the consequence metric from RI.",
  appliedMethods: "A segmented-plume dispersion calculation, stratified weather sampling, pathway dose integration with recognized dose-conversion libraries, recognized dose-response models and reference regional cost data, each one an accepted way to do its sub-task.",
  resultsSummary: "Four event sequence families are quantified, and the early-release families ESF-EARLY and ESF-ATWS drive the latent cancer risk at a mean individual risk near 2.0E-4 per event and a boundary dose near 8.0E-2 Sv.",
  rcreProcess: "The nine consequence inputs are extracted per release category, the bounding site is described and justified, and the scoping declaration covers the six downstream sub-elements.",
  rcpaProcess: "Five protective actions are modeled across three incident phases, with two cohorts, the six-link evacuation delay chain, the EPA protective-action guides and the seismic cross-hazard adjustment.",
  rcpaModelUncertaintySources: "The non-compliance fraction and the bounding road-network model are the leading protective-action model uncertainties.",
  rcpaBoundingSiteDocumentation: "The population, the land use and the road network are bounding assumptions, logged for closure at site selection.",
  rcmeProcess: "The hourly weather year is compiled from the onsite tower at 92 percent recovery, with the delta-T stability classification and the substitution reviewed by a qualified meteorologist.",
  rcmeModelUncertaintySources: "The weather-year representativeness is the leading meteorology model uncertainty.",
  rcmeBoundingSiteDocumentation: "The weather year is a bounding representative set until the selected-site tower data replaces it.",
  rcadProcess: "A segmented plume runs with hourly updates on a justified polar grid, the weather year is sampled across 36 bins within the mean-shift criterion, and the credit fence and the deposition matrix are applied at CC-II.",
  rcadModelUncertaintySources: "The wet-deposition washout model and the dry-deposition velocity are the leading dispersion model uncertainties.",
  rcadBoundingSiteDocumentation: "The flat-earth dispersion is bounded to the inland bounding site.",
  rcdoProcess: "Five exposure pathways are integrated per cohort with a finite-plume immersion model, the recognized dose-conversion libraries and organ-specific factors.",
  rcdoModelUncertaintySources: "The cloud-immersion geometry and the dose-conversion factor set are the leading dosimetry model uncertainties.",
  rcheProcess: "The early and the latent health effects are converted through organ-specific parameters anchored to the recognized risk-factor bodies.",
  rcheModelUncertaintySources: "The low-dose dose-response shape and the dose-rate effectiveness factor are the leading health-effect model uncertainties.",
  rcecProcess: "The seven cost categories are estimated from reference consequence-code economic data, the regional wealth values and a common-year consumer-price-index adjustment.",
  rcecModelUncertaintySources: "The regional cost parameters and the interdiction criterion are the leading economic model uncertainties.",
  rcecBoundingSiteDocumentation: "The regional wealth values are estimated prior to site selection and logged for closure.",
  rcqProcess: "The benchmarked codes quantify the consequence per family, the output is reviewed for errors and silent zeros, and the risk-significant contributors are identified per HLR-RI-B.",
  rcqModelUncertaintySources: "The model uncertainties from every sub-element funnel into the consequence distribution, propagated with the phenomena dependencies.",
  rcqLimitations: "The flat-earth dispersion and the bounding-site demographics bound the quantification until the site is selected.",
  praTaskInterfaces: "RC takes the source term from MS, the categories from ES and the metric from RI, and it delivers the family-by-family consequence table that Risk Integration pairs with the ESQ frequency to close the risk equation.",
  implementsSrs: srs("RCPA-C3", "RCME-B3", "RCAD-F3", "RCDO-C2", "RCHE-C3", "RCEC-C3", "RCQ-D1", "RCQ-D2", "RCQ-D3"),
};

export const RC_ANALYSIS: RadiologicalConsequenceAnalysis = {
  uuid: "rc-generic-1",
  name: "RC Workbook 2",
  type: TechnicalElementTypes.CONSEQUENCE_ANALYSIS,
  version: "1",
  created: CREATED,
  modified: NOW,
  owner: "praman",
  workflowState: "DRAFT",
  workflowHistory: [{ state: "DRAFT", enteredAt: CREATED, actor: "praman" }],
  capabilityCategory: "CC-II",
  plantStage: "PRE_OPERATIONAL",
  metadata: {
    versionInfo: { version: "1", lastUpdated: NOW, schemaVersion: "0.0.1" },
    analysisDate: NOW,
    analysts: ["praman", "smarchetti", "dokoye"],
    reviewers: [
      { id: "rev-1", name: "Dr. Hossein Ardakani", role: "INTERNAL_REVIEWER", title: "Lead Technical Reviewer", organization: "Nuclear Safety Associates" },
      { id: "rev-2", name: "Priya Raman", role: "INTERNAL_REVIEWER", title: "Independent Reviewer, also Source Term reviewer", organization: "Nuclear Safety Associates" },
      { id: "rev-3", name: "Tomas Berg", role: "INTERNAL_REVIEWER", title: "Independent Reviewer, also Risk Integration reviewer", organization: "Nuclear Safety Associates" },
      { id: "ewhitmore", name: "Dr. Elaine Whitmore", role: "INTERNAL_APPROVER", title: "PRA Technical Authority", organization: "Generic Atomics" },
    ],
    scope: "Radiological consequence analysis for the Generic-1 sodium-cooled fast reactor, computing what the release does to the world, the dose, the health effects, the land and the cost, per event sequence family.",
    limitations: ["Bounding site: the population, the road network, the weather year and the regional costs are bounding assumptions, logged for closure at site selection."],
    lastModifiedDate: NOW,
    lastModifiedBy: "praman",
  },
  conformanceMatrix,
  internalReviewComments: {
    openCount: 4,
    resolvedCount: 1,
    comments: [
      { uuid: "rcc-1", authorRole: "INTERNAL_REVIEWER", authorId: "rev-2", createdAt: "2026-06-02T09:14:00.000Z", associatedSr: "RCRE-A3", text: "The handoff lists the nine inputs for RC-1, so RCRE-A3 needs the traceability to the MS source-term table shown to confirm no input is missing.", severity: "MAJOR", resolved: false },
      { uuid: "rcc-2", authorRole: "INTERNAL_REVIEWER", authorId: "rev-1", createdAt: "2026-06-02T10:30:00.000Z", associatedSr: "RCAD-B2", text: "The weather sample is in place, but RCAD-B2 needs the mean-shift check shown to confirm the sample does not bias the consequence mean.", severity: "MAJOR", resolved: false },
      { uuid: "rcc-3", authorRole: "INTERNAL_REVIEWER", authorId: "rev-1", createdAt: "2026-06-03T14:05:00.000Z", associatedSr: "RCPA-A5", text: "The cohorts split compliers from refusers, so RCPA-A5 needs the non-compliance fraction sourced to an evacuation study, not assumed.", severity: "MINOR", resolved: false },
      { uuid: "rcc-4", authorRole: "INTERNAL_REVIEWER", authorId: "rev-2", createdAt: "2026-06-03T15:20:00.000Z", associatedSr: "RCAD-C2", text: "The credit fence forbids plume rise at CC-I and earns it at CC-II.", severity: "OBSERVATION", resolved: true, resolution: "No change required, the buoyancy algorithm and its justification are recorded for the CC-II credit.", resolvedAt: "2026-06-03T16:30:00.000Z", resolvedBy: "rev-2" },
      { uuid: "rcc-5", authorRole: "INTERNAL_REVIEWER", authorId: "rev-3", createdAt: "2026-06-03T16:00:00.000Z", associatedSr: "RCQ-C2", text: "The propagation samples the weather and the wet deposition together, so RCQ-C2 needs the phenomena dependency shown so the correlation is auditable for RI.", severity: "MINOR", resolved: false },
    ],
  },
  activePeerReviewIds: [],
  activeAuditIds: [],
  praScope: "Full-scope radiological consequence analysis for the Generic-1 SFR, bounding site, capability category CC-II.",
  scope: {
    consequenceMetrics: ["Individual early fatality risk", "Individual latent cancer fatality risk", "Individual dose at boundary", "Population dose to 80 km"],
    metricSelectionApplicationBasis: "The metric set comes from the intended application, the licensing frequency-consequence target and the quantitative health objectives.",
    protectiveActionsModellingDegree: "Evacuation, sheltering, relocation and interdiction are modeled with multiple cohorts and the EPA protective-action guides.",
    meteorologyModellingDegree: "A representative weather year is compiled from the onsite tower with the delta-T stability classification.",
    atmosphericDispersionModellingDegree: "A segmented-plume model is run over the sampled weather year on a two-dimensional grid.",
    dosimetryModellingDegree: "Five exposure pathways are integrated per cohort with organ-specific dose-conversion factors.",
    healthEffectsModellingDegree: "Early and latent effects are converted through recognized organ-specific risk models.",
    economicFactorsModellingDegree: "The seven cost categories are estimated from reference and regional economic data where the metric needs them.",
    implementsSrs: srs("RCRE-B1", "RCRE-B2"),
  },
  releaseCategoryToConsequence: {
    siteInformation: {
      isBounding: true,
      boundingSite: {
        description: "A bounding generic inland site with a conservative population density and a representative inland terrain.",
        characteristics: {
          siteBoundaryDistance: 400,
          populationCentreDistance: 6,
          terrain: "Flat inland terrain with no nearby large water body.",
          additionalCharacteristics: [
            { name: "Site boundary distance", value: "400 m, the exclusion-area boundary distance" },
            { name: "Population centre distance", value: "6 km to the nearest population centre" },
            { name: "Analysis radius", value: "80 km outer grid radius" },
            { name: "Population density", value: "100 persons per square kilometre, uniform bounding" },
          ],
        },
        boundingJustification: "The assumed uniform density and the short 400 m boundary distance bound every candidate site in the PRA scope.",
        boundedSites: ["Candidate inland site A", "Candidate inland site B"],
      },
    },
    releaseCategoryInputs,
    releaseCategoryAndSourceTermReviewed: true,
    reviewBasis: "The category definitions and the source-term parameters are reviewed against the nine-input list, traceable to the MS source-term table.",
    implementsSrs: srs("RCRE-A1", "RCRE-A2", "RCRE-A3", "RCRE-C1"),
  },
  protectiveActionParameters,
  meteorologicalData,
  atmosphericTransportAndDispersion,
  dosimetry,
  healthEffects,
  economicFactors,
  consequenceQuantification,
  sensitivityStudies,
  riskIntegrationFeedback: {
    analysisRef: "ri-generic-1",
    feedbackDate: NOW,
    metricFeedback: [
      { metric: "Individual latent cancer fatality risk", riskSignificance: ImportanceLevel.HIGH, insights: ["The early-release families drive the individual latent-cancer risk."], recommendations: ["Prioritize the source-term retention and the evacuation timing."] },
      { metric: "Individual dose at boundary", riskSignificance: ImportanceLevel.MEDIUM, insights: ["The boundary dose stays below the early-fatality threshold with the evacuation credit."], recommendations: ["Confirm the evacuation-timing credit at the selected site."] },
    ],
    releaseCategoryFeedback: [
      { releaseCategoryReference: "RC-1", riskSignificance: ImportanceLevel.HIGH, insights: ["The early release drives the individual and the population dose."], recommendations: ["Tighten the pool-scrubbing and confinement-retention uncertainty."], status: "IN_PROGRESS" },
      { releaseCategoryReference: "RC-2", riskSignificance: ImportanceLevel.MEDIUM, insights: ["The filtered release is a minor contributor to the risk."], recommendations: ["No further action is needed at this stage."], status: "ADDRESSED" },
    ],
    generalFeedback: "Risk Integration confirms the early-release category drives the individual and the population risk, so the retention phenomena and the evacuation timing are the priorities for the consequence side.",
    response: {
      description: "The pool-scrubbing decontamination factor and the non-compliance fraction are carried as the leading model uncertainties and swept in the sensitivity studies.",
      changes: ["Wet-deposition washout and non-compliance fraction held as the leading uncertainties", "Weather-year and evacuation-delay sensitivities retained"],
      status: "IN_PROGRESS",
    },
  },
  modelUncertainty: {
    uuid: "rc-mu-1",
    name: "RC model uncertainty documentation",
    uncertaintySources: [
      { source: "Wet-deposition washout model", impact: "Shifts the groundshine and the downwind concentration together." },
      { source: "Non-compliance fraction", impact: "Combines with the warning time to move the early dose." },
      { source: "Low-dose dose-response model", impact: "Shifts the latent cancer risk per unit dose." },
      { source: "Cloud-immersion geometry", impact: "Shifts the cloudshine dose for the elevated plume." },
    ],
    relatedAssumptions: [],
    reasonableAlternatives: [],
  },
  preOperationalAssumptions,
  boundingSiteAssumptions,
  documentation,
  configurationControlRecordId: "cc-2026.05.20-001",
  exampleDocuments: [
    { id: "RC-DOC-01", name: "EPA Protective Action Guides Manual", kind: "doc", sizeLabel: "EPA", uploadedLabel: "EPA-400/R-17/001", extracted: "Early-phase evacuation, intermediate-phase relocation and food-pathway dose thresholds behind the protective-action analysis", linked: 4, url: "/api/example-documents/rc/epa-pag" },
    { id: "RC-DOC-02", name: "Meteorological Monitoring Programs for Nuclear Power Plants", kind: "doc", sizeLabel: "NRC", uploadedLabel: "Regulatory Guide 1.23", extracted: "Tower heights, delta-T stability classification and 90 percent data recovery behind the meteorology", linked: 3, url: "/api/example-documents/rc/rg-123" },
    { id: "RC-DOC-03", name: "MACCS Best Practices for Consequence Analysis", kind: "doc", sizeLabel: "SAND", uploadedLabel: "NUREG/CR-7009", extracted: "Deposition velocities, washout coefficients, weather sampling and shielding factors behind the dispersion and dosimetry", linked: 5, url: "/api/example-documents/rc/maccs-best-practices" },
    { id: "RC-DOC-04", name: "Reactor Safety Goal and Consequence Parameter Study", kind: "doc", sizeLabel: "SAND", uploadedLabel: "NUREG/CR-4551", extracted: "Cohort shielding, relocation criteria and economic cost parameters behind the protective-action and economic analysis", linked: 4, url: "/api/example-documents/rc/nureg-1150" },
    { id: "RC-DOC-05", name: "Risk-Informed Performance-Based Guidance for Non-Light-Water Reactor PRA", kind: "doc", sizeLabel: "NEI", uploadedLabel: "NEI 18-04", extracted: "The frequency-consequence target and the quantitative health objectives behind the metric selection", linked: 2, url: "/api/example-documents/rc/nei-18-04" },
  ],
  newlyDevelopedMethodIds: ["NM-091", "NM-094", "NM-097"],
};
