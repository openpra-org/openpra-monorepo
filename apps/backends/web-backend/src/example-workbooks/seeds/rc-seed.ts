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
      numberOfPlumes: 1,
      radionuclideGroupFractions: [
        { group: "Cs-137", fraction: 3.0e-2 },
        { group: "I-131", fraction: 4.0e-2 },
      ],
      importantRadionuclides: ["Xe-133", "Kr-85", "I-131", "Cs-137", "Cs-134", "Te-132", "Sb-127", "Sr-90", "Ba-140", "Ru-103", "Ce-144"],
      importantRadionuclidesJustification: "The species that drive the dose, with the basis for the set.",
      releasePhaseTimings: [
        { startTime: 0, duration: 6, timeUnit: "h" },
        { startTime: 6, duration: 66, timeUnit: "h" },
      ],
      warningTime: 4,
      warningTimeDescription: "About 4 hours",
      hazardsImpactingProtectiveActions: "The seismic hazard that caused the release also degrades the roads and the shelters.",
      releaseEnergy: 2.0,
      releaseEnergyDescription: "2.0 MW thermal",
      releaseHeight: 30,
      releaseHeightDescription: "30 m, elevated by the sodium-fire buoyancy",
      releasedParticleSize: 1,
      releasedParticleSizeDescription: "Sub-micron to few-micron AMAD spectrum peaking near 1 micron, with a coarse tail to 10 microns",
      releaseUncertainties: "Propagated per MS-D4",
    },
  },
  {
    releaseCategory: "RC-2",
    sourceTermDefinitionRef: "ST-2",
    releaseCharacteristics: {
      numberOfPlumes: 1,
      radionuclideGroupFractions: [
        { group: "Cs-137", fraction: 2.0e-3 },
        { group: "I-131", fraction: 3.0e-3 },
      ],
      importantRadionuclides: ["Xe-133", "I-131", "Cs-137", "Te-132"],
      importantRadionuclidesJustification: "The species that drive the dose for the filtered release.",
      releasePhaseTimings: [{ startTime: 8, duration: 40, timeUnit: "h" }],
      warningTime: 8,
      warningTimeDescription: "About 8 hours",
      hazardsImpactingProtectiveActions: "The internal event leaves the road network and the shelters intact.",
      releaseEnergy: 0.4,
      releaseEnergyDescription: "0.4 MW thermal",
      releaseHeight: 10,
      releaseHeightDescription: "10 m, ground level",
      releasedParticleSize: 0.5,
      releasedParticleSizeDescription: "Sub-micron after pool scrubbing",
      releaseUncertainties: "Propagated per MS-D4",
    },
  },
  {
    releaseCategory: "RC-3",
    sourceTermDefinitionRef: "ST-1",
    releaseCharacteristics: {
      numberOfPlumes: 1,
      radionuclideGroupFractions: [{ group: "Xe-133", fraction: 1.0e-6 }],
      importantRadionuclides: ["Xe-133"],
      importantRadionuclidesJustification: "The intact-containment release is noble gas only.",
      releasePhaseTimings: [{ startTime: 0, duration: 24, timeUnit: "h" }],
      warningTimeDescription: "Below the action threshold",
      hazardsImpactingProtectiveActions: "No protective action is triggered by the routine release.",
      releaseEnergyDescription: "Negligible",
      releaseHeight: 10,
      releaseHeightDescription: "10 m, ground level",
      releasedParticleSizeDescription: "No aerosol, noble gas only",
      releaseUncertainties: "Characterized per MS-D2",
    },
  },
];

const protectiveActionParameters: ProtectiveActionAnalysis = {
  protectiveActionsIncluded: [
    { action: "EVACUATION", included: true, applicabilityJustification: "The population is moved out of the affected area before or during the release." },
    { action: "SHELTERING", included: true, applicabilityJustification: "The population stays indoors to reduce the inhalation and the cloudshine dose." },
    { action: "RELOCATION", included: true, applicabilityJustification: "The population is relocated from the contaminated area in the intermediate phase." },
    { action: "LAND_INTERDICTION_REMEDIATION", included: true, applicabilityJustification: "The contaminated land is interdicted or remediated before it is released." },
    { action: "FOOD_INTERDICTION_REMEDIATION", included: true, applicabilityJustification: "The contaminated food and crops are interdicted before consumption." },
  ],
  incidentPhasesModeled: [
    { phase: "EARLY", criteriaDescription: "Decisions are taken from plant status, by evacuation and sheltering." },
    { phase: "INTERMEDIATE", criteriaDescription: "Decisions are taken from measurements, by relocation and interdiction." },
    { phase: "LATE_LONG_TERM", criteriaDescription: "Recovery, remediation and land release are decided in the long term." },
  ],
  sourceDocuments: [
    { document: "Site emergency plan", usage: "Grounds the notification scheme and the protective-action decisions." },
    { document: "Evacuation time estimate study", usage: "Supplies the evacuation delays and the road-network speeds." },
    { document: "EPA and FDA protective-action guides", usage: "Sets the dose thresholds for the protective-action decisions." },
  ],
  cohortModeling: {
    approach: "MULTIPLE_COHORTS",
    cohorts: [
      {
        name: "Compliant cohort",
        description: "About 95 percent of the population, evacuating on the notification schedule from the emergency plan.",
        complianceAssumption: "Follows the instruction within the evacuation delay chain.",
      },
      {
        name: "Non-compliant cohort",
        description: "About 5 percent of the population, delaying or declining to evacuate, sheltered in place instead.",
        complianceAssumption: "The non-compliance fraction is taken from evacuation studies, not assumed to be zero.",
      },
    ],
  },
  complianceAssumptions: [
    {
      description: "The non-compliance fraction is grounded in published evacuation behavior.",
      basis: "No credit is taken for full compliance.",
    },
  ],
  shelterInPlaceCredit: {
    credited: true,
    justification: "The non-compliant cohort is sheltered in place with the building shielding factors applied.",
  },
  protectionParameters: [
    { parameter: "Cloudshine shielding factor, sheltered", value: "0.6", source: "Site emergency plan building stock." },
    { parameter: "Inhalation protection factor, sheltered", value: "0.4", source: "Site emergency plan building stock." },
  ],
  evacuationModeling: {
    approach: "Road-network evacuation model",
    description: "The routing follows the bounding road-network model until the site is selected.",
  },
  evacuationDelayComponents: [
    { component: "GENERAL_EMERGENCY_DECLARATION", estimate: "0 min" },
    { component: "SITE_NOTIFIES_OFFICIALS", estimate: "+15 min" },
    { component: "OFFICIALS_NOTIFY_PUBLIC", estimate: "+20 min" },
    { component: "PUBLIC_RECEIVES_INSTRUCTIONS", estimate: "+15 min" },
    { component: "SECURE_PERSONAL_PROPERTY", estimate: "+30 min" },
    { component: "LOAD_VEHICLES", estimate: "+20 min" },
  ],
  evacuationSpeed: {
    basis: "The evacuation speeds come from a site-specific evacuation time estimate study, not a generic value.",
    daytimeNighttimeConsidered: true,
    adverseWeatherConsidered: true,
    specialEventsConsidered: true,
    transientPopulationsConsidered: true,
  },
  hazardGroupAdjustments: [
    {
      hazardGroup: "Seismic",
      adjustmentDescription: "The earthquake that breached the barrier also dropped the bridges, so the speeds, the delays and the shelter availability are adjusted for the hazard that caused the release.",
    },
  ],
  populationDistribution: {
    basis: "ASSUMED_JUSTIFIED",
    description: "A bounding population density with transients included, projected forward.",
    justification: "Justified to bound the candidate sites.",
    transientPopulationsIncluded: true,
    projectionAdjustments: "Projected to the analysis year.",
  },
  landUseData: {
    basis: "GENERIC_SIMPLIFIED",
    description: "A generic land-use mix for crops and dairy until the county-level data is available.",
  },
  plantPhysicalCharacteristics: {
    basis: "ACTUAL",
    description: "The actual building dimensions and the stack heights from the design, used for the wake and the release elevation.",
  },
  releaseSourceGeographicLocation: "The release enters the atmosphere at the reactor building, 10 m above grade.",
  boundingSiteLocationJustification: "The bounding-site location is justified to bound the off-site data of every candidate site.",
  parameterUncertaintyCharacterization: "The protective-action and site-data uncertain inputs are characterized.",
  modelUncertainty: {
    sources: ["Non-compliance fraction"],
    assumptions: ["The evacuation network rests on a bounding road model."],
    alternatives: ["A finer cohort split by region"],
  },
  implementsSrs: srs("RCPA-A1", "RCPA-A2", "RCPA-A3", "RCPA-A4", "RCPA-A5", "RCPA-A9", "RCPA-A10", "RCPA-A11", "RCPA-B1", "RCPA-B2", "RCPA-B3", "RCPA-C3"),
};

const meteorologicalData: MeteorologicalDataAnalysis = {
  dataSource: "Onsite meteorological tower with 10 m and upper-level instruments.",
  spatialRepresentativenessJustification: "The tower is justified as spatially representative of the release area.",
  periodSelection: {
    approach: "MULTI_YEAR_EVALUATION",
    periodDescription: "Multiple years are evaluated to select the representative year.",
  },
  dataRecovery: {
    combinedRecoveryPercent: 92,
    meetsNinetyPercent: true,
    substitutionTechniques: "Short gaps are filled by interpolation, with the technique recorded.",
    meteorologistReview: {
      performed: true,
      reviewerQualification: "A qualified meteorologist reviewed the substitution.",
      considerations: "The terrain and the water bodies were considered in the review.",
    },
  },
  instrumentationQuality: {
    calibratedProgram: true,
    description: "The instruments are under a calibrated and maintained measurement program.",
  },
  extractedParameters: {
    windSpeedAndDirection10m: true,
    stabilityClassMeasurement: true,
    precipitation: true,
  },
  mixingHeights: {
    scope: "SEASONAL_MORNING_AND_AFTERNOON",
    source: "Recognized mixing-height data.",
  },
  stabilityClassificationMethod: {
    approach: "RECOGNIZED_SOURCE",
    description: "The stability class uses a recognized classification method, not a simplified rule.",
  },
  accuracyReview: {
    performed: true,
    findings: "The data accuracy was reviewed and the findings recorded.",
  },
  temporalChangesAccommodation: "The temporal changes across the weather data are accounted for.",
  timeResolution: "Hourly, matching the dispersion model.",
  parameterUncertaintyCharacterization: "The weather-year representativeness is characterized as a parameter uncertainty.",
  modelUncertainty: {
    sources: ["Weather-year representativeness"],
    assumptions: ["The weather year is a bounding representative set."],
    alternatives: ["A multi-year composite weather set"],
  },
  implementsSrs: srs("RCME-A1", "RCME-A2", "RCME-A3", "RCME-A4", "RCME-A5", "RCME-A6", "RCME-A7", "RCME-B2", "RCME-B3"),
};

const atmosphericTransportAndDispersion: AtmosphericDispersionAnalysis = {
  dispersionModel: {
    modelClass: "SEGMENTED_PLUME",
    name: "Segmented-plume dispersion model",
    justification: "A variable-trajectory plume is justified for the multi-hour release over the sampled weather year.",
  },
  temporalResolution: {
    approach: "HOURLY_UPDATES",
    description: "Hourly wind, stability and precipitation updates.",
  },
  spatialTreatment: {
    approach: "TWO_DIMENSIONAL_GRID",
    gridDescription: "A two-dimensional polar grid.",
    gridJustification: "Justified for the receptor distances of interest.",
  },
  windFieldData: "The wind-field data is consistent with the RCME meteorology.",
  windRepresentativeness: "The wind field is representative of the release area.",
  meteorologicalDataPerRcme: true,
  meteorologicalSampling: {
    approach: "STATISTICAL_SAMPLING",
    technique: "The weather year is sampled to represent the distribution of dispersion conditions.",
    meanShiftValidation: {
      performed: true,
      meanShiftPercent: 7,
      justification: "The sample reproduces the full-year mean within ten percent.",
    },
  },
  elevatedReleaseAlgorithms: "Elevated-release algorithms applied with the justified height at CC-II.",
  plumeRise: {
    credited: true,
    algorithmsDescription: "Credited through momentum and buoyancy algorithms at CC-II.",
  },
  buildingWakeEffects: "Wake effects applied with the actual building dimensions at CC-II.",
  plumeSegmentation: {
    approach: "MULTIPLE_PLUMES",
    description: "The two-phase release is treated as multiple plume segments.",
  },
  deposition: {
    dryDeposition: {
      included: true,
      approach: "PER_PARTICLE_SIZE",
      velocities: [
        { particleSize: "1 micron", velocity: 0.001 },
        { particleSize: "5 micron", velocity: 0.01 },
      ],
    },
    wetDeposition: {
      included: true,
      precipitationIntensityDependent: true,
      washoutCoefficients: [
        { condition: "Light rain", coefficient: 0.00005 },
        { condition: "Heavy rain", coefficient: 0.0003 },
      ],
    },
    sourceDepletion: {
      included: true,
      scope: "DRY_AND_WET",
    },
    resuspension: {
      included: true,
      description: "Resuspension of the deposited material.",
    },
  },
  terrainEffectsConsideration: "The flat-earth assumption is justified for the inland bounding site.",
  siteCharacteristicsConsidered: "The site characteristics are accounted for in the dispersion.",
  receptorLocationsSpecification: "The receptors are specified at the site boundary and the population-centre distances.",
  modelLimitations: "The grid is bounded to the validated downwind distance.",
  parameterUncertaintyCharacterization: "The dispersion and deposition parameter uncertainty is characterized.",
  modelUncertainty: {
    sources: ["Wet-deposition washout model"],
    assumptions: ["The flat-earth dispersion is bounded to the inland site."],
    alternatives: ["A terrain-following trajectory model"],
  },
  implementsSrs: srs("RCAD-A1", "RCAD-A2", "RCAD-A3", "RCAD-A4", "RCAD-A5", "RCAD-B1", "RCAD-B2", "RCAD-C1", "RCAD-C2", "RCAD-C3", "RCAD-E1", "RCAD-E3", "RCAD-E5", "RCAD-E6", "RCAD-E7", "RCAD-F2", "RCAD-F3"),
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
    { period: "Early phase, plume passage", justification: "The cloudshine and the inhalation integrate over the plume passage." },
    { period: "Intermediate phase, ground exposure", justification: "The groundshine integrates over the relocation-criteria window." },
  ],
  cloudImmersionModel: {
    approach: "FINITE_PLUME_OR_CORRECTED",
    description: "Finite-plume deep dose with the cloud geometry corrected.",
  },
  groundshineIntegration: "The groundshine is integrated over the exposure period.",
  skinBetaTreatment: "Beta dose from the material deposited on the skin, included at CC-II.",
  breathingRates: {
    approach: "PER_COHORT_JUSTIFIED",
    description: "A justified breathing rate per cohort.",
  },
  ingestionTreatment: {
    approach: "GENERIC_INTAKE",
    description: "Generic ingestion intake included at CC-II.",
  },
  dcf: {
    source: "Recognized dose-conversion data sets.",
    type: "ORGAN_SPECIFIC",
  },
  shieldingConsiderations: "The shielding factors follow the cohort definitions.",
  occupancyConsiderations: "The occupancy fractions follow the cohort definitions.",
  receptorTypes: ["Site-boundary individual", "Population-centre resident"],
  dosimetryModelsUsed: "Pathway dose-integration calculation.",
  doseAggregationMethod: "The dose is aggregated across the pathways and the receptors.",
  radionuclideDecayConsideration: "The decay during transport and exposure is accounted for.",
  parameterUncertaintyCharacterization: "The dosimetry parameter uncertainty is characterized.",
  modelUncertainty: {
    sources: ["Dose conversion"],
    assumptions: ["The dose conversion factors come from a recognized source."],
    alternatives: ["Organ-specific factors resolved per cohort"],
  },
  implementsSrs: srs("RCDO-A1", "RCDO-A2", "RCDO-A3", "RCDO-A4", "RCDO-A5", "RCDO-A6", "RCDO-A7", "RCDO-A8", "RCDO-A9", "RCDO-A10", "RCDO-B1", "RCDO-B2", "RCDO-C1", "RCDO-C2"),
};

const healthEffects: HealthEffectsAnalysis = {
  earlyHealthEffects: [
    "Hematopoietic syndrome from a high acute dose",
    "Pulmonary injury from inhaled material",
    "Gastrointestinal injury from a high acute dose",
  ],
  latentHealthEffects: [
    "Latent cancer fatality across the exposed population",
    "Latent cancer incidence across the exposed population",
    "Thyroid effects from the iodine intake",
  ],
  earlyEffectParameters: {
    approach: "ORGAN_SPECIFIC_DOSE_RESPONSE",
    description: "Organ-specific dose-response parameters.",
  },
  latentEffectParameters: {
    approach: "ORGAN_SPECIFIC_FACTORS",
    description: "Organ-specific factors with the dose-rate effectiveness and the incidence and fatality split.",
  },
  ageGenderHomogeneous: true,
  riskFactorSources: [
    { source: "BEIR VII dose-response", recognizedBody: "National research council", version: "Phase 2" },
    { source: "ICRP risk coefficients", recognizedBody: "International commission", version: "Publication 103" },
  ],
  parameterUncertaintyCharacterization: "The health-effect parameter uncertainty is characterized.",
  modelUncertainty: {
    sources: ["Dose-response model"],
    assumptions: ["The population is kept age and gender homogeneous."],
    alternatives: ["Age and gender resolved risk factors"],
  },
  implementsSrs: srs("RCHE-A1", "RCHE-A2", "RCHE-A3", "RCHE-A4", "RCHE-A5", "RCHE-B1", "RCHE-B2", "RCHE-B3", "RCHE-C1", "RCHE-C2", "RCHE-C3"),
};

const economicFactors: EconomicFactorsAnalysis = {
  costCategories: [
    { category: "Evacuation cost", parameterDefinitions: ["The cost of moving the population out of the affected area."] },
    { category: "Relocation and temporary unemployment", parameterDefinitions: ["The cost of relocation, including the temporary loss of employment."] },
    { category: "Land value and depreciation", parameterDefinitions: ["The lost land value and the depreciation of the interdicted area."] },
    { category: "Crop losses", parameterDefinitions: ["The value of the crops and the dairy lost to the interdiction."] },
    { category: "Decontamination", parameterDefinitions: ["The cost of decontaminating the affected land and property."] },
    { category: "Loss of use", parameterDefinitions: ["The cost of the property held out of use during the recovery."] },
    { category: "Medical costs", parameterDefinitions: ["The cost of the medical response to the health effects."] },
  ],
  parameterConsistencyConfirmed: true,
  costParameterEstimates: [
    {
      parameter: "Regional cost data",
      dataBasis: "REGIONAL_SITE_APPLICABLE",
      source: "The cost parameters use regional data applicable to the bounding site.",
      justification: "For a bounding site the regional costs are estimated prior to site selection and logged for closure.",
    },
    {
      parameter: "Recognized sources",
      dataBasis: "REGIONAL_SITE_APPLICABLE",
      source: "The costs come from recognized economic data sources.",
    },
    {
      parameter: "Inflation adjustment",
      dataBasis: "REGIONAL_SITE_APPLICABLE",
      source: "Consumer price index series.",
      timeFrameAdjustment: "The costs are adjusted to a common year using the consumer price index.",
    },
  ],
  parameterUncertaintyCharacterization: "The economic parameter uncertainty is characterized.",
  modelUncertainty: {
    sources: ["Cost parameters"],
    assumptions: ["The regional costs are estimated prior to site selection."],
    alternatives: ["Selected-region cost data at site selection"],
  },
  implementsSrs: srs("RCEC-A1", "RCEC-A2", "RCEC-B1", "RCEC-B2", "RCEC-B3", "RCEC-B7", "RCEC-C1", "RCEC-C2", "RCEC-C3"),
};

const consequenceQuantification: ConsequenceQuantificationAnalysis = {
  consequenceCodesUsed: [
    { code: "Consequence pipeline code", benchmarkBasis: "Benchmarked against the Gaussian model for the simple cases." },
    { code: "Weather-sampling driver", benchmarkBasis: "Validated to reproduce the full-year mean within ten percent." },
  ],
  modelAndCodeLimitations: [
    { code: "Consequence pipeline code", feature: "Plume-duration regime", limitation: "The model is bounded to the validated release-duration range." },
    { code: "Consequence pipeline code", feature: "Spatial limit", limitation: "The grid is bounded to the validated downwind distance." },
    { code: "Consequence pipeline code", feature: "Flat earth versus terrain", limitation: "The flat-earth assumption is justified for the inland bounding site." },
  ],
  eventSequenceConsequences: [
    {
      uuid: "RCQ-ESF-EARLY",
      eventSequenceFamily: "ESF-EARLY",
      releaseCategoryReference: "RC-1",
      sourceTermReference: "ST-3",
      consequenceResults: [
        {
          metric: "Latent cancer risk",
          meanValue: 2.0e-4,
          unit: "per event",
          uncertaintyDistribution: { type: DistributionType.LOGNORMAL, median: 2.0e-4, errorFactor: 3.0 },
          uncertaintyDescription: "Propagated with the phenomena dependencies.",
        },
        {
          metric: "Individual dose at boundary",
          meanValue: 8.0e-2,
          unit: "Sv",
          uncertaintyDistribution: { type: DistributionType.LOGNORMAL, median: 8.0e-2, errorFactor: 2.5 },
          uncertaintyDescription: "Propagated with the phenomena dependencies.",
        },
      ],
      riskSignificance: ImportanceLevel.HIGH,
    },
    {
      uuid: "RCQ-ESF-LATE",
      eventSequenceFamily: "ESF-LATE",
      releaseCategoryReference: "RC-2",
      sourceTermReference: "ST-2",
      consequenceResults: [
        {
          metric: "Latent cancer risk",
          meanValue: 1.0e-5,
          unit: "per event",
          uncertaintyDistribution: { type: DistributionType.LOGNORMAL, median: 1.0e-5, errorFactor: 3.0 },
          uncertaintyDescription: "Propagated with the phenomena dependencies.",
        },
        {
          metric: "Individual dose at boundary",
          meanValue: 4.0e-3,
          unit: "Sv",
          uncertaintyDistribution: { type: DistributionType.LOGNORMAL, median: 4.0e-3, errorFactor: 2.5 },
          uncertaintyDescription: "Propagated with the phenomena dependencies.",
        },
      ],
      riskSignificance: ImportanceLevel.MEDIUM,
    },
    {
      uuid: "RCQ-ESF-LEAK",
      eventSequenceFamily: "ESF-LEAK",
      releaseCategoryReference: "RC-3",
      sourceTermReference: "ST-1",
      consequenceResults: [
        { metric: "Latent cancer risk", meanValue: 2.0e-8, unit: "per event", uncertaintyDescription: "Characterized, below the action threshold." },
        { metric: "Individual dose at boundary", meanValue: 1.0e-6, unit: "Sv", uncertaintyDescription: "Characterized, below the action threshold." },
      ],
      riskSignificance: ImportanceLevel.LOW,
    },
  ],
  outputReview: {
    performed: true,
    indicationsFound: [],
    acceptanceJustifications: [
      "No error statements were found in the run logs.",
      "No silent zeros were found, the low-consequence family is expected.",
    ],
  },
  resultsConfirmation: {
    performed: true,
    description: "The results were confirmed by examining the dose-distance trends against expectation.",
  },
  riskSignificantContributors: [
    { contributor: "Early-release category RC-1", basisPerRiB: "Drives the latent cancer risk per HLR-RI-B.", significance: ImportanceLevel.HIGH },
    { contributor: "Pool scrubbing decontamination factor", basisPerRiB: "The retention uncertainty moves the consequence per HLR-RI-B.", significance: ImportanceLevel.HIGH },
    { contributor: "Evacuation timing for the seismic group", basisPerRiB: "The non-compliance and the road damage move the early dose.", significance: ImportanceLevel.MEDIUM },
  ],
  riskSignificanceCriteriaUsed: [
    {
      criteriaType: "SAFETY_GOAL",
      description: "The frequency-consequence target from the intended application.",
    },
  ],
  modelUncertaintyAssessments: [
    {
      sourceSubElement: "RCAD",
      uncertaintySource: "Wet-deposition washout model",
      relatedAssumptions: ["The washout coefficients follow the precipitation intensity."],
      reasonableAlternatives: ["A spectral washout model"],
      evaluationType: "QUANTITATIVE",
      evaluationScope: "INDIVIDUAL",
      effectOnMetrics: "Shifts the groundshine and the downwind concentration together.",
    },
    {
      sourceSubElement: "RCPA",
      uncertaintySource: "Non-compliance fraction",
      relatedAssumptions: ["The non-compliance fraction comes from published evacuation behavior."],
      reasonableAlternatives: ["A region-specific compliance survey"],
      evaluationType: "QUANTITATIVE",
      evaluationScope: "COMBINATION",
      effectOnMetrics: "Combines with the warning time to move the early dose.",
    },
    {
      sourceSubElement: "RCHE",
      uncertaintySource: "Dose-response model",
      relatedAssumptions: ["The risk factors come from internationally recognized bodies."],
      reasonableAlternatives: ["An alternative dose-response shape at low dose"],
      evaluationType: "QUALITATIVE",
      evaluationScope: "INDIVIDUAL",
      effectOnMetrics: "Shifts the latent cancer risk per unit dose.",
    },
  ],
  uncertaintyCharacterization: {
    level: "PROPAGATED_WITH_PHENOMENA_DEPENDENCIES",
    description: "The uncertainty distribution of each consequence metric is calculated by propagation, with the dependencies between the uncertain phenomena accounted for.",
    phenomenaDependencies: [
      {
        description: "The weather year drives the dispersion and the wet deposition together.",
        dependentPhenomena: ["Weather sampling", "Wet deposition"],
        treatmentMethod: "Sampled together so the same hour drives both.",
      },
      {
        description: "The evacuation timing and the early dose are correlated through the release timing.",
        dependentPhenomena: ["Evacuation timing", "Early dose"],
        treatmentMethod: "Sampled together so the warning time moves both.",
      },
    ],
  },
  riskMetricMapping: [
    {
      consequenceMetric: "Latent cancer risk",
      riskMetric: "INDIVIDUAL_LATENT_CANCER_FATALITY_RISK",
      mappingDescription: "The family-by-family consequence table is what RI pairs with the ESQ frequency to form the frequency-consequence point.",
    },
    {
      consequenceMetric: "Individual dose at boundary",
      riskMetric: "INDIVIDUAL_EARLY_FATALITY_RISK",
      mappingDescription: "The boundary dose feeds the early-fatality axis of the frequency-consequence target.",
    },
  ],
  quantificationLimitations: [
    "The flat-earth dispersion is bounded to the inland bounding site.",
    "The bounding-site demographics are conservative until the site is selected.",
  ],
  implementsSrs: srs("RCQ-A1", "RCQ-A2", "RCQ-A3", "RCQ-B1", "RCQ-B2", "RCQ-B3", "RCQ-C1", "RCQ-C2", "RCQ-D1", "RCQ-D2", "RCQ-D3"),
};

const sensitivityStudies: SensitivityStudy[] = [
  {
    uuid: "SS-1",
    name: "Weather-year sensitivity",
    description: "Sweep of the selected weather year.",
    variedParameters: ["Weather year"],
    parameterRanges: { "Weather year": [1, 5] },
    results: "Selecting a wetter year raises the local groundshine and lowers the downwind dose.",
  },
  {
    uuid: "SS-2",
    name: "Evacuation-delay sensitivity",
    description: "Sweep of the evacuation delay chain.",
    variedParameters: ["Evacuation delay"],
    parameterRanges: { "Evacuation delay": [100, 130] },
    results: "Adding thirty minutes to the delay chain raises the early dose for the compliant cohort.",
  },
  {
    uuid: "SS-3",
    name: "Plume-rise sensitivity",
    description: "Sweep of the plume-rise credit.",
    variedParameters: ["Plume rise credit"],
    parameterRanges: { "Plume rise credit": [0, 1] },
    results: "Crediting plume rise lowers the boundary dose, so the credit is justified before it is taken.",
  },
];

const boundingSiteAssumptions = [
  { id: "BS-1", area: "Protective actions", desc: "The evacuation network rests on a bounding road model, to confirm against the selected site.", path: "protectiveActionParameters" },
  { id: "BS-2", area: "Population", desc: "The population density is bounding and assumed, to replace with census demographics at site selection.", path: "protectiveActionParameters" },
  { id: "BS-3", area: "Meteorology", desc: "The weather year is a bounding representative set, to replace with the selected-site tower data.", path: "meteorologicalData" },
  { id: "BS-4", area: "Economics", desc: "The regional costs are estimated prior to site selection, to update with the selected-region data.", path: "economicFactors" },
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

const documentation: RcDocumentation = {
  processDescription: "The source term is received per category, the site and the people are characterized, the plume is transported, and the dose, the health effects and the costs are quantified per event sequence family, per ASME/ANS RA-S-1.4 HLR-RCRE through HLR-RCQ.",
  inputsDescription: "RC takes the source-term table from MS, the release-category definitions from ES, and the consequence metric from RI.",
  appliedMethods: "A segmented-plume dispersion calculation, probabilistic weather sampling, pathway dose integration, recognized dose-response models and regional cost data, each one accepted way to do its sub-task.",
  resultsSummary: "Three event sequence families are quantified, and the early-release family ESF-EARLY drives the latent cancer risk at a mean of 2.0E-4 per event.",
  rcreProcess: "The nine consequence inputs are extracted per release category, the bounding site is described and justified, and the scoping declaration covers the six downstream sub-elements.",
  rcpaProcess: "Five protective actions are modeled across three incident phases, with two cohorts, a six-link evacuation delay chain and the seismic cross-hazard adjustment.",
  rcpaModelUncertaintySources: "The non-compliance fraction is the leading protective-action model uncertainty.",
  rcpaBoundingSiteDocumentation: "The population, the land use and the road network are bounding assumptions, logged for closure at site selection.",
  rcmeProcess: "The hourly weather year is compiled from the onsite tower at 92 percent recovery, with the substitution reviewed by a qualified meteorologist.",
  rcmeModelUncertaintySources: "The weather-year representativeness is the leading meteorology model uncertainty.",
  rcmeBoundingSiteDocumentation: "The weather year is a bounding representative set until the selected-site tower data replaces it.",
  rcadProcess: "A segmented plume runs with hourly updates on a justified grid, the weather year is sampled within the mean-shift criterion, and the credit fence and the deposition matrix are applied at CC-II.",
  rcadModelUncertaintySources: "The wet-deposition washout model is the leading dispersion model uncertainty.",
  rcadBoundingSiteDocumentation: "The flat-earth dispersion is bounded to the inland bounding site.",
  rcdoProcess: "Five exposure pathways are integrated per cohort with a finite-plume immersion model and organ-specific dose conversion factors.",
  rcdoModelUncertaintySources: "The dose conversion factors are the leading dosimetry model uncertainty.",
  rcheProcess: "The early and the latent health effects are converted through organ-specific parameters anchored to recognized bodies.",
  rcheModelUncertaintySources: "The dose-response model is the leading health-effect model uncertainty.",
  rcecProcess: "The seven cost categories are estimated from regional data, recognized sources and a common-year adjustment.",
  rcecModelUncertaintySources: "The regional cost parameters are the leading economic model uncertainty.",
  rcecBoundingSiteDocumentation: "The regional costs are estimated prior to site selection and logged for closure.",
  rcqProcess: "The benchmarked codes quantify the consequence per family, the output is reviewed for errors and silent zeros, and the risk-significant contributors are identified per HLR-RI-B.",
  rcqModelUncertaintySources: "The model uncertainties from every sub-element funnel into the consequence distribution, propagated with the phenomena dependencies.",
  rcqLimitations: "The flat-earth dispersion and the bounding-site demographics bound the quantification until the site is selected.",
  praTaskInterfaces: "RC takes the source term from MS, the categories from ES and the metric from RI, and it delivers the family-by-family consequence table that Risk Integration pairs with the ESQ frequency to close the risk equation.",
  implementsSrs: srs("RCPA-C3", "RCME-B3", "RCAD-F3", "RCHE-C3", "RCEC-C3", "RCQ-D1", "RCQ-D2", "RCQ-D3"),
};

export const RC_ANALYSIS: RadiologicalConsequenceAnalysis = {
  uuid: "rc-generic-1",
  name: "Generic-1 Radiological Consequence Analysis",
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
      { id: "rev-2", name: "Nadia Sorensen", role: "INTERNAL_REVIEWER", title: "Independent Reviewer, also Source Term reviewer", organization: "Nuclear Safety Associates" },
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
    consequenceMetrics: ["Early fatality risk", "Latent cancer risk", "Individual dose"],
    metricSelectionApplicationBasis: "The metric set comes from the intended application, the LMP frequency-consequence target.",
    protectiveActionsModellingDegree: "Evacuation, sheltering and relocation are modeled with multiple cohorts.",
    meteorologyModellingDegree: "A representative weather year is compiled from the onsite tower.",
    atmosphericDispersionModellingDegree: "A variable-trajectory plume is run over the sampled weather year.",
    dosimetryModellingDegree: "Cloudshine, groundshine and inhalation are integrated per cohort.",
    healthEffectsModellingDegree: "Early and latent effects are converted through recognized risk models.",
    economicFactorsModellingDegree: "The cost categories are estimated from regional data where the metric needs them.",
    implementsSrs: srs("RCRE-B1", "RCRE-B2"),
  },
  releaseCategoryToConsequence: {
    siteInformation: {
      isBounding: true,
      boundingSite: {
        description: "A bounding generic site with a conservative population density and a representative inland terrain.",
        characteristics: {
          siteBoundaryDistance: 400,
          populationCentreDistance: 6,
          terrain: "Flat inland terrain with no nearby large water body.",
          additionalCharacteristics: [
            { name: "Site boundary distance", value: "400 m, the exclusion-area boundary distance" },
            { name: "Population centre distance", value: "6 km to the nearest population centre" },
          ],
        },
        boundingJustification: "The assumed density and the short boundary distance bound every candidate site in the PRA scope.",
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
  modelUncertainty: {
    uuid: "rc-mu-1",
    name: "RC model uncertainty documentation",
    uncertaintySources: [
      { source: "Wet-deposition washout model", impact: "Shifts the groundshine and the downwind concentration together." },
      { source: "Non-compliance fraction", impact: "Combines with the warning time to move the early dose." },
      { source: "Dose-response model", impact: "Shifts the latent cancer risk per unit dose." },
    ],
    relatedAssumptions: [],
    reasonableAlternatives: [],
  },
  boundingSiteAssumptions,
  documentation,
  configurationControlRecordId: "cc-2026.05.20-001",
  newlyDevelopedMethodIds: ["NM-091", "NM-094", "NM-097"],
};
