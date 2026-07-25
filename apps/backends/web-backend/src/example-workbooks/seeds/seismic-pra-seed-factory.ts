import { type SRReference } from "interfaces-mef-types/core/pra-common";
import { ImportanceLevel } from "interfaces-mef-types/core/shared-patterns";
import { type SeismicPRA } from "interfaces-mef-types/seismic/seismic-pra";
import { createBlankSeismicPra } from "../../seismic-pra-workbooks/blank-seismic-pra";

type ReactorKind = "sfr" | "htgr";

function srs(...codes: string[]): SRReference[] {
  return codes.map((sr) => ({ sr, hlr: sr.split("-")[1]!.charAt(0) as SRReference["hlr"] }));
}

export function createSeismicPraExample(kind: ReactorKind): SeismicPRA {
  const isSfr = kind === "sfr";
  const reactor = isSfr ? "Generic SFR" : "Generic HTGR";
  const site = isSfr ? "Pioneer Mesa Site" : "Cedar Basin Site";
  const building = isSfr ? "Reactor and steam-generator building" : "Reactor building and helium service area";
  const primarySsc = isSfr ? "Primary sodium pump P-1" : "Helium circulator HC-1";
  const secondarySsc = isSfr ? "Decay heat removal air cooler AC-1" : "Reactor cavity cooling panel RCCS-1";
  const mef = createBlankSeismicPra(isSfr ? "S Workbook 2" : "S Workbook 1", "example.preparer");

  mef.uuid = `SEISMIC-PRA-${kind.toUpperCase()}`;
  mef.created = "2026-06-18T09:00:00.000Z";
  mef.modified = "2026-06-22T15:30:00.000Z";
  mef.praScope = `Full-scope, pre-operational Seismic PRA for the ${reactor}, integrating seismic hazard, fragility, and plant response for all radioactive-material sources and operating states.`;
  mef.metadata.scope = mef.praScope;
  mef.metadata.plantIdentity = {
    name: reactor,
    vendor: "OpenPRA reference design",
    reactorType: isSfr ? "Pool-type sodium-cooled fast reactor" : "Modular high-temperature gas-cooled reactor",
    thermalPower: isSfr ? "840 MWth" : "250 MWth per module",
    primaryCoolant: isSfr ? "Sodium" : "Helium",
    siteName: site,
    numberOfModules: isSfr ? 1 : 4,
  };
  mef.metadata.limitations = ["Reference-design information is used where final as-built data are not yet available."];
  mef.commonAssumptions = [{
    uuid: `ASSUMPTION-${kind.toUpperCase()}-SITE`,
    description: `The selected ${site} profiles bound the final safety-related building footprint.`,
    rationale: "The profile set spans the geotechnical investigation range and is carried as epistemic branches.",
    isPreOperational: true,
    status: "IN_PROGRESS",
    addressingPlans: "Confirm against excavation and foundation acceptance records.",
    limitations: ["Final foundation elevations remain subject to configuration control."],
  }];
  mef.applications = [{
    uuid: `APPLICATION-${kind.toUpperCase()}-BASELINE`,
    name: "Integrated seismic risk baseline",
    purpose: "Support design, operations, maintenance, emergency planning, and risk-informed decision making with one configuration-controlled seismic risk model.",
    decisionContext: `Pre-operational CC-II decisions for the ${reactor}, including risk-significant SSC prioritization and confirmation of design margins.`,
    supportedRiskMetrics: ["Event-sequence-family frequency per plant-year", "SSC and basic-event importance", "Hazard-bin contribution"],
    consumingElementRefs: ["RI-SEISMIC-CONTRIBUTION", "SEISMIC-PEER-REVIEW-2026"],
    configurationBasis: `The ${site} hazard, reference-design configuration, SEL revision 2026, and linked SHA/SFR/SPR calculation packages.`,
    limitations: ["Final as-built and as-operated configuration confirmation remains a pre-operational closure item."],
    evidenceRefs: ["EVIDENCE-SHA-REPORT", "EVIDENCE-SFR-CALCS", "EVIDENCE-SEL"],
    status: "ACTIVE",
  }];
  mef.evidenceRegister = [
    {
      uuid: "EVIDENCE-SHA-REPORT",
      name: `${reactor} seismic hazard report`,
      evidenceType: "DOCUMENT",
      sourceReference: "SHA-REPORT-2026",
      revision: "1",
      effectiveDate: "2026-06-18",
      owner: "Hazard team",
      applicableSubelements: ["SHA", "SFR", "SPR"],
      applicability: "Controls the hazard basis, motion definitions, spectra, intervals, and secondary-hazard results transferred downstream.",
      qualityAndLimitations: "Independently checked; final site confirmation remains a tracked pre-operational closure item.",
      fileReference: "DOC-SHA",
      status: "CONTROLLED",
      implementsSrs: srs("SHA-I1", "SHA-I2", "SHA-I3"),
    },
    {
      uuid: "EVIDENCE-SFR-CALCS",
      name: `${reactor} seismic response and fragility calculations`,
      evidenceType: "CALCULATION",
      sourceReference: "SFR-RESPONSE-RESULTS.H5",
      revision: "1",
      effectiveDate: "2026-06-20",
      owner: "Fragility team",
      applicableSubelements: ["SFR", "SPR"],
      applicability: "Provides response, mechanisms, capacity, fragility curves, uncertainty, and correlation used by the plant-response model.",
      qualityAndLimitations: "Calculation verification is complete; final vendor capacity confirmation remains tracked.",
      fileReference: "DOC-SFR",
      status: "CONTROLLED",
      implementsSrs: srs("SFR-F1", "SFR-F2", "SFR-F3"),
    },
    {
      uuid: "EVIDENCE-SEL",
      name: `${reactor} seismic equipment list`,
      evidenceType: "MODEL",
      sourceReference: "SEL-2026",
      revision: "1",
      effectiveDate: "2026-06-21",
      owner: "Systems and fragility team",
      applicableSubelements: ["SFR", "SPR"],
      applicability: "Canonical scope and failure-mode register shared by plant response, investigations, fragility, and quantification.",
      qualityAndLimitations: "Multidisciplinary completeness check passed for the reference-design configuration.",
      fileReference: "DOC-SEL",
      status: "CONTROLLED",
      implementsSrs: srs("SFR-A1", "SPR-C1", "SPR-C6"),
    },
  ];

  const sha = mef.seismicHazardAnalysis;
  sha.uuid = `SHA-${kind.toUpperCase()}`;
  sha.praScope = `Site-specific hazard from 1E-2 through 1E-8 annual exceedance, including horizontal and vertical motion and secondary seismic hazards for ${site}.`;
  sha.analysisBasis.site = {
    uuid: `SITE-${kind.toUpperCase()}`,
    name: site,
    siteBasis: "IDENTIFIED_SITE",
    siteName: site,
    location: {
      latitude: isSfr ? 43.186 : 35.642,
      longitude: isSfr ? -116.421 : -112.284,
      elevation: isSfr ? 812 : 1460,
      elevationUnit: "m",
      horizontalDatum: "WGS84",
      verticalDatum: "NAVD88",
    },
    selectionAndApplicabilityBasis: "The defined coordinates, foundation footprint, and geotechnical profiles match the plant configuration used by fragility and response analyses.",
    boundsAllSitesInScope: true,
    boundingDemonstration: "The weighted lower, best-estimate, and upper profiles span measured velocity and damping uncertainty.",
    implementsSrs: srs("SHA-A1", "SHA-A2"),
  };
  sha.analysisBasis.structuredProcess = {
    ...sha.analysisBasis.structuredProcess,
    uuid: `SSHAC-${kind.toUpperCase()}`,
    name: "SSHAC Level 2 hazard study",
    processType: "SSHAC_LEVEL_2",
    processLevelBasis: "The study complexity, available regional models, and intended CC-II applications support a documented Level 2 process.",
    studyObjective: "Develop technically defensible center, body, and range distributions for seismic sources, ground motion, and site response.",
    participants: [{
      uuid: "SHA-PARTICIPANT-TI",
      name: "Technical Integration Team",
      organization: "OpenPRA Reference Program",
      role: "TECHNICAL_INTEGRATOR",
      discipline: "INTEGRATION",
      responsibilities: ["Integrate source, ground-motion, and site-response evaluations", "Document CBR judgments"],
      qualifications: "Senior hazard specialists with SSHAC project experience",
      conflictOfInterestEvaluation: "No conflicts identified",
    }],
    activities: [{
      uuid: "SHA-ACTIVITY-WORKSHOP",
      name: "Data evaluation and integration workshop",
      activityType: "WORKSHOP",
      date: "2026-03-12",
      objective: "Challenge alternative interpretations and establish preliminary weights.",
      participants: ["SHA-PARTICIPANT-TI"],
      inputs: ["CATALOG-1", "REGIONAL-FAULT-DB", "STRONG-MOTION-DB"],
      decisions: ["Retain two source recurrence alternatives and three NGA ground-motion models."],
      outputs: ["SOURCE-LT-1", "GM-LT-1"],
      recordReference: "SHA-WORKSHOP-MINUTES-02",
    }],
    technicalIntegrationApproach: "Repeated evaluation, challenge, feedback, and documented weighting by the technical integrator.",
    evaluationAndIntegrationMethods: "Data sets and models are evaluated for quality, applicability, and dependence before logic-tree integration.",
    centerBodyRangeDemonstration: "Sensitivity cases and branch diagnostics show that the logic trees span credible interpretations and center on the integrator's best estimate.",
    qualityAssuranceProcess: "Independent calculation checks, controlled scripts, peer checking, and traceable workshop records.",
    independentReviewProcess: "An independent hazard reviewer examined inputs, judgments, weights, calculations, and documentation.",
    deviationsAndLimitations: [],
    implementsSrs: srs("SHA-A3", "SHA-A4", "SHA-A5", "SHA-A6", "SHA-A7"),
  };
  sha.analysisBasis.groundMotionParameters = [{
    uuid: "GMP-SA-1HZ",
    name: "Geometric-mean horizontal SA at 1 Hz",
    parameterType: "SPECTRAL_ACCELERATION",
    direction: "GEOMETRIC_MEAN_HORIZONTAL",
    units: "g",
    dampingRatio: 0.05,
    oscillatorPeriodSeconds: 1,
    oscillatorFrequencyHz: 1,
    componentDefinition: "Geometric mean of two orthogonal horizontal components at the free-field rock control point.",
    selectedRange: { minimum: 0.01, maximum: 3.0 },
    selectedFrequencyRangeHz: { lower: 0.5, upper: 100 },
    usedForHazard: true,
    usedForFragility: true,
    usedForPlantResponse: true,
    consistencyBasis: "A single identifier, component definition, units, range, and control point are transferred through SHA, SFR, and SPR.",
    downstreamElementRefs: ["REFERENCE-EQ-1", "FRAGILITY-PRIMARY", "DISCRETIZATION-1"],
    implementsSrs: srs("SHA-A2", "SHA-A7"),
  }];
  sha.analysisBasis.calculationBounds = {
    maximumGroundMotion: 3,
    groundMotionUnits: "g",
    tailExtrapolationMethod: "Log-linear extrapolation of the terminal three hazard points, checked against branch calculations.",
    truncationImpactEvaluation: "Extending the upper bound to 4 g changes total seismic risk by less than one percent.",
    sequenceRankingUnaffected: true,
    lowerBoundMagnitude: 4.5,
    magnitudeScale: "Mw",
    lowerBoundMagnitudeBasis: "Events below Mw 4.5 do not contribute materially at the selected motion range.",
    epsilonLimit: 3,
    epsilonTailTreatment: "Truncated-normal residual with branch sensitivity at epsilon 4.",
    epsilonLimitBasis: "Record support and hazard sensitivity justify the selected truncation.",
    implementsSrs: srs("SHA-H1", "SHA-H2", "SHA-H3", "SHA-H4"),
  };
  sha.earthScienceInputs.dataSets = [{
    uuid: "EARTH-SCIENCE-DATA-1",
    name: "Regional geology, seismology, and geotechnical compilation",
    discipline: "GEOLOGY",
    sourceOrganization: "State geological survey and plant geotechnical program",
    sourceReference: "SHA-DATA-COMPILATION-2026",
    publicationOrAcquisitionDate: "2026-02-28",
    dataCutoffDate: "2026-01-31",
    spatialCoverage: "Site region to 500 km and local site footprint",
    temporalCoverage: "Historical, instrumental, and paleoseismic record",
    resolution: "Regional to boring-scale",
    format: "GIS, catalog database, boring logs, and laboratory test reports",
    qualityAndLimitations: "Source provenance and uncertainty are recorded; sparse paleoseismic constraints are represented epistemically.",
    currentnessAssessment: "Searches and agency queries found no material post-cutoff information.",
    interpretationsSupported: ["Source geometry", "recurrence", "site profile", "site response"],
    fileReference: "SHA-DATA-ROOM",
    implementsSrs: srs("SHA-B1", "SHA-B2", "SHA-B3"),
  }];
  sha.earthScienceInputs.studyRegions = [{
    uuid: "STUDY-REGION-1",
    name: "Regional seismic study area",
    boundaryDescription: "A 500 km regional source study area with focused local characterization within 50 km.",
    radialExtentKm: 500,
    tectonicSetting: isSfr ? "Basin-and-range extension with distributed crustal faulting" : "Stable continental interior adjacent to the Intermountain seismic belt",
    includedSourceRegions: ["LOCAL-FAULT-ZONE", "REGIONAL-BACKGROUND"],
    majorContributorCoverageBasis: "Deaggregation confirms all sources contributing more than one percent are within the study region.",
    regionalPropagationDataSufficiency: "Regional strong-motion data are supplemented by applicable NGA data.",
    localSiteEffectsDataSufficiency: "Borehole velocities and laboratory curves support the weighted site profiles.",
    uncertaintyCoverageBasis: "Alternative boundaries and recurrence models are represented in the source logic tree.",
    mapReference: "SHA-MAP-01",
    implementsSrs: srs("SHA-B1", "SHA-B4"),
  }];
  sha.earthScienceInputs.earthquakeCatalog = {
    ...sha.earthScienceInputs.earthquakeCatalog,
    uuid: "CATALOG-1",
    name: "Homogenized earthquake catalog",
    catalogStartDateOrAge: "1800",
    catalogEndDate: "2026-01-31",
    magnitudeScales: ["Mw", "ML", "mb"],
    homogenizationMethod: "Published regional conversions to Mw with conversion uncertainty retained.",
    declusteringMethod: "Reasenberg declustering with window sensitivity.",
    completenessAssessment: "Stepp-style assessment by magnitude band and source region.",
    locationAndMagnitudeUncertaintyTreatment: "Event-specific uncertainty where available and period-dependent defaults otherwise.",
    duplicateResolutionMethod: "Agency priority hierarchy followed by record-level reconciliation.",
    events: [{
      uuid: "EQ-1959-REFERENCE",
      recordType: "INSTRUMENTAL",
      eventDateOrAge: "1959-08-18",
      locationDescription: "Regional reference earthquake",
      magnitude: 7.2,
      magnitudeScale: "Mw",
      magnitudeUncertainty: 0.15,
      depthKm: 10,
      depthUncertaintyKm: 3,
      sourceReferences: ["CATALOG-SOURCE-USGS"],
      qualityFlags: ["REVIEWED"],
    }],
    sourceReferences: ["USGS-COMCAT", "STATE-HISTORICAL-CATALOG"],
    implementsSrs: srs("SHA-B2", "SHA-B3"),
  };
  sha.earthScienceInputs.dataGapAssessment = "No gap was identified that prevents a CC-II hazard analysis; paleoseismic recurrence remains an explicit epistemic uncertainty.";
  sha.earthScienceInputs.subjectMatterExpertReview = "Geology, seismology, geophysics, and geotechnical specialists reviewed data quality and interpretations.";
  sha.earthScienceInputs.compilationCutoffDate = "2026-01-31";
  sha.earthScienceInputs.implementsSrs = srs("SHA-B1", "SHA-B2", "SHA-B3", "SHA-B4", "SHA-B5");
  sha.sourceCharacterization.structuredApproach = "Source geometry, maximum magnitude, and recurrence are developed as coupled epistemic alternatives under the SSHAC process.";
  sha.sourceCharacterization.earthquakeSources = [{
    uuid: "SOURCE-LOCAL-FAULT",
    name: "Local crustal fault zone",
    sourceType: "FAULT",
    tectonicRegionType: "Active shallow crust",
    active: true,
    faultMechanisms: ["NORMAL", "OBLIQUE"],
    geometry: {
      geometryType: "PLANE",
      geometryDescription: "Segmented fault plane with alternate connected and independent rupture models.",
      closestDistanceToSiteKm: isSfr ? 18 : 32,
      depthRangeKm: { minimum: 0, maximum: 18 },
      strikeDegrees: 342,
      dipDegrees: 55,
      uncertaintyDescription: "Trace location, dip, segmentation, and down-dip extent are represented by logic-tree branches.",
    },
    magnitudeFrequencyModels: [{
      uuid: "MFD-LOCAL-GR",
      name: "Truncated Gutenberg-Richter recurrence",
      modelType: "GUTENBERG_RICHTER",
      minimumMagnitude: 4.5,
      maximumMagnitude: 7.25,
      magnitudeScale: "Mw",
      annualRateAboveMinimum: 0.018,
      aValue: 2.1,
      bValue: 0.92,
      dataAndMethodBasis: "Catalog rates, slip rate, and paleoseismic constraints are jointly evaluated.",
    }],
    historicalAndInstrumentalEventRefs: ["EQ-1959-REFERENCE"],
    sourceDataRefs: ["EARTH-SCIENCE-DATA-1"],
    majorHazardContributor: true,
    characterizationBasis: "Mapped faulting, seismicity, tectonic setting, and deformation rates.",
    uncertainties: ["Segmentation", "maximum magnitude", "recurrence rate"],
    implementsSrs: srs("SHA-C1", "SHA-C2", "SHA-C3", "SHA-C4"),
  }];
  sha.sourceCharacterization.sourceLogicTree = {
    ...sha.sourceCharacterization.sourceLogicTree,
    uuid: "SOURCE-LT-1",
    name: "Seismic source characterization logic tree",
    nodes: [{
      uuid: "SOURCE-LT-NODE-MMAX",
      name: "Maximum magnitude",
      nodeKind: "MAXIMUM_MAGNITUDE",
      branches: [
        { uuid: "MMAX-70", name: "Mw 7.0", value: 7, weight: 0.35, technicalBasis: "Regional analogs", dataSupport: ["EARTH-SCIENCE-DATA-1"] },
        { uuid: "MMAX-725", name: "Mw 7.25", value: 7.25, weight: 0.65, technicalBasis: "Fault dimensions and broader analog set", dataSupport: ["EARTH-SCIENCE-DATA-1"] },
      ],
      weightSum: 1,
      elicitationBasis: "Technical integrator judgment following evaluator challenge.",
    }],
    totalEndBranchCount: 12,
    branchWeightReview: "Weights were independently summed, reviewed, and sensitivity tested.",
    dependenciesAndCorrelations: "Geometry and recurrence dependencies are maintained through conditional branching.",
    centerBodyRangeCoverage: "Branches capture the center, credible body, and tails of source interpretations.",
    implementsSrs: srs("SHA-C3", "SHA-C5"),
  };
  sha.sourceCharacterization.uncertaintyIdentificationMethod = "Structured data/model inventory, expert challenge, and logic-tree diagnostics.";
  sha.sourceCharacterization.sourceModelReference = "SOURCE-MODEL-2026";
  sha.sourceCharacterization.technicalIntegrationSummary = "Source alternatives and weights reflect the technically defensible CBR after evaluation of dependence and data quality.";
  sha.sourceCharacterization.implementsSrs = srs("SHA-C1", "SHA-C2", "SHA-C3", "SHA-C4", "SHA-C5");

  sha.groundMotionCharacterization.governingMechanisms = ["Shallow crustal faulting", "regional background seismicity"];
  sha.groundMotionCharacterization.historicalAndInstrumentalReview = "Observed regional attenuation, intensity, and recording characteristics were reviewed against candidate model behavior.";
  sha.groundMotionCharacterization.modelSelectionCriteria = ["Tectonic applicability", "magnitude-distance coverage", "component compatibility", "usable sigma model"];
  sha.groundMotionCharacterization.predictionModels = [{
    uuid: "GMPE-1",
    name: "Weighted NGA-style crustal ground-motion model",
    modelKind: "PUBLISHED_GMPE",
    version: "2022",
    sourceReference: "GMPE-REFERENCE-2022",
    tectonicRegionTypes: ["Active shallow crust"],
    faultMechanisms: ["NORMAL", "OBLIQUE", "STRIKE_SLIP"],
    magnitudeRange: { minimum: 4, maximum: 8.5 },
    distanceRangeKm: { minimum: 0, maximum: 500 },
    supportedParameterRefs: ["GMP-SA-1HZ"],
    horizontalComponentDefinition: "Converted to geometric mean horizontal using published factors.",
    siteTermDefinition: "Reference-rock prediction followed by site-response convolution.",
    medianModelDescription: "Magnitude-, distance-, and mechanism-dependent median spectral acceleration.",
    aleatoryVariabilityDescription: "Total sigma separated into inter- and intra-event components.",
    sigmaComponents: { total: 0.62, interEvent: 0.28, intraEvent: 0.55 },
    extrapolationAndTruncation: "No material extrapolation in the risk-significant magnitude-distance range; residuals truncated at epsilon 3.",
    applicabilityAndLimitations: "Applicable to the governing crustal mechanisms; epistemic model alternatives cover residual model uncertainty.",
    calibrationDataRefs: ["STRONG-MOTION-DB"],
    logicTreeWeight: 0.4,
    selectionBasis: "Selected through the same structured process used for source characterization.",
    implementsSrs: srs("SHA-D1", "SHA-D2", "SHA-D3"),
  }];
  sha.groundMotionCharacterization.groundMotionLogicTree = {
    ...sha.groundMotionCharacterization.groundMotionLogicTree,
    uuid: "GM-LT-1",
    name: "Ground-motion characterization logic tree",
    nodes: [],
    totalEndBranchCount: 6,
    branchWeightReview: "Model weights sum to one for every source-region branch.",
    dependenciesAndCorrelations: "Common data dependence is considered in model weighting and sigma treatment.",
    centerBodyRangeCoverage: "Three prediction models and site-term alternatives span credible medians and sigma.",
    implementsSrs: srs("SHA-D2", "SHA-D4"),
  };
  sha.groundMotionCharacterization.referenceHorizons = [{
    uuid: "REF-HORIZON-ROCK",
    name: "Reference rock horizon",
    horizonType: "ROCK",
    depth: isSfr ? 52 : 34,
    depthUnit: "m",
    shearWaveVelocity: 760,
    shearWaveVelocityUnit: "m/s",
    density: 2200,
    densityUnit: "kg/m3",
    dampingRatio: 0.02,
    definitionBasis: "Borehole velocity logs and foundation geotechnical model.",
    uncertaintyDescription: "Depth and velocity uncertainty are represented in profile branches.",
    implementsSrs: srs("SHA-D3"),
  }];
  sha.groundMotionCharacterization.processCompatibilityBasis = "Source and ground-motion models use consistent magnitude scale, distance metrics, component definition, and reference horizon.";
  sha.groundMotionCharacterization.siteToSiteVariabilityIncluded = true;
  sha.groundMotionCharacterization.siteToSiteVariabilityTreatment = "Ergodic site-to-site sigma is partially removed and residual site uncertainty is represented explicitly.";
  sha.groundMotionCharacterization.implementsSrs = srs("SHA-D1", "SHA-D2", "SHA-D3", "SHA-D4");

  sha.siteResponseAnalysis.topographyAndGeology = {
    topographicDescription: "Gently sloping engineered platform without sharp ridges at the safety-related footprint.",
    topographicDataRefs: ["SITE-LIDAR-2025"],
    surficialDepositDescription: "Layered alluvium over weathered and competent rock.",
    surficialGeologyDataRefs: ["GEOTECH-REPORT-2026"],
    geologicStructureDescription: "Subhorizontal layers with limited lateral variability across the footprint.",
    geotechnicalInvestigationRefs: ["BORING-LOGS-B1-B12", "CROSSHOLE-VELOCITY-2026"],
    topographicEffectsSignificant: false,
    topographicEffectsTreatment: "Two-dimensional screening calculations show less than five-percent amplification over the 1–20 Hz range.",
    implementsSrs: srs("SHA-E1", "SHA-E6"),
  };
  sha.siteResponseAnalysis.profiles = [{
    uuid: "PROFILE-BEST",
    name: "Best-estimate geotechnical profile",
    profileType: "BEST_ESTIMATE",
    locationDescription: building,
    layers: [{
      uuid: "LAYER-1",
      name: "Engineered fill and dense alluvium",
      materialType: "Dense granular soil",
      topDepth: 0,
      bottomDepth: 18,
      depthUnit: "m",
      thickness: 18,
      properties: [{
        uuid: "VS-LAYER-1",
        name: "Small-strain shear-wave velocity",
        propertyType: "SHEAR_WAVE_VELOCITY",
        value: isSfr ? 420 : 510,
        units: "m/s",
        sourceReference: "CROSSHOLE-VELOCITY-2026",
        basisAndLimitations: "Median of accepted measurements; epistemic bounds use the measured range.",
      }],
      spatialVariability: "Coefficient of variation 0.18 across the building footprint.",
      sourceReferences: ["GEOTECH-REPORT-2026"],
    }],
    depthToBedrock: isSfr ? 52 : 34,
    depthUnit: "m",
    bedrockDefinition: "Material with Vs at or above 760 m/s.",
    groundwaterDepth: isSfr ? 22 : 48,
    profileWeight: 0.5,
    siteVariabilityBasis: "Borehole-to-borehole and laboratory variability with lower and upper profile branches.",
    sourceReferences: ["GEOTECH-REPORT-2026"],
    implementsSrs: srs("SHA-E1", "SHA-E2"),
  }];
  sha.siteResponseAnalysis.methods = [{
    uuid: "SITE-RESPONSE-METHOD-1",
    name: "One-dimensional nonlinear site response",
    dimension: "ONE_DIMENSIONAL",
    analysisType: "NONLINEAR",
    softwareAndVersion: "OpenSiteResponse 2.1",
    methodDescription: "Time-domain nonlinear propagation of suites scaled across the hazard range.",
    dimensionSelectionBasis: "Measured layering is approximately horizontal and 2-D screening found limited edge effects.",
    inputLocation: "REF-HORIZON-ROCK",
    outputLocation: "CONTROL-POINT-FOUNDATION",
    boundaryConditions: "Compliant base with transmitting lateral boundaries.",
    materialModelDescription: "Pressure-dependent modulus reduction and damping calibrated to laboratory curves.",
    verificationAndValidation: "Benchmark problems, energy checks, and independent input/output review completed.",
    limitations: ["One-dimensional method is restricted to the safety-related platform."],
    implementsSrs: srs("SHA-E2", "SHA-E3", "SHA-E4"),
  }];
  sha.siteResponseAnalysis.incorporationIntoHazardMethod = "Profile and property branches are convolved with reference-rock hazard to obtain control-point hazard.";
  sha.siteResponseAnalysis.localSiteResponseIncluded = true;
  sha.siteResponseAnalysis.boundingSiteVariabilityIncluded = false;
  sha.siteResponseAnalysis.approachJustification = "The site is identified and supported by site-specific investigation, so explicit local response is appropriate.";
  sha.siteResponseAnalysis.implementsSrs = srs("SHA-E1", "SHA-E2", "SHA-E3", "SHA-E4", "SHA-E5", "SHA-E6");

  sha.responseSpectraEvaluation.controlPoints = [{
    uuid: "CONTROL-POINT-FOUNDATION",
    name: "Safety-related foundation control point",
    controlPointType: "FOUNDATION",
    locationDescription: `Basemat elevation of the ${building}`,
    elevation: isSfr ? 794 : 1448,
    elevationUnit: "m",
    applicableStructureRefs: ["STRUCTURE-REACTOR-BUILDING"],
    basis: "Common control point for hazard, structural response, fragility, and plant-response discretization.",
  }];
  const curvePoints = [
    { groundMotion: 0.05, annualFrequencyOfExceedance: isSfr ? 2.2e-2 : 1.5e-2 },
    { groundMotion: 0.1, annualFrequencyOfExceedance: isSfr ? 4.8e-3 : 3.2e-3 },
    { groundMotion: 0.2, annualFrequencyOfExceedance: isSfr ? 7.4e-4 : 5.1e-4 },
    { groundMotion: 0.4, annualFrequencyOfExceedance: isSfr ? 7.2e-5 : 5.6e-5 },
    { groundMotion: 0.8, annualFrequencyOfExceedance: isSfr ? 4.1e-6 : 3.3e-6 },
    { groundMotion: 1.6, annualFrequencyOfExceedance: isSfr ? 1.2e-7 : 9.5e-8 },
    { groundMotion: 3.0, annualFrequencyOfExceedance: 1e-9 },
  ];
  sha.hazardQuantification.hazardCurves = [{
    uuid: "HAZARD-CURVE-MEAN-1HZ",
    name: "Mean foundation SA(1 Hz) hazard curve",
    groundMotionParameterRef: "GMP-SA-1HZ",
    controlPointRef: "CONTROL-POINT-FOUNDATION",
    direction: "GEOMETRIC_MEAN_HORIZONTAL",
    statistic: "MEAN",
    groundMotionUnits: "g",
    frequencyUnit: "per plant-year",
    points: curvePoints,
    interpolationMethod: "Log-log linear interpolation",
    extrapolationMethod: "Terminal log-linear slope",
    calculationRunRef: "HAZARD-RUN-2026",
    implementsSrs: srs("SHA-F1", "SHA-H1"),
  }];
  const spectrumPoints = [0.01, 0.1, 0.2, 0.5, 1, 2].map((periodSeconds) => ({
    periodSeconds,
    frequencyHz: 1 / periodSeconds,
    spectralAcceleration: (isSfr ? 0.42 : 0.36) * (periodSeconds <= 0.2 ? 1.35 : periodSeconds <= 0.5 ? 1.1 : periodSeconds <= 1 ? 0.8 : 0.45),
    units: "g",
  }));
  sha.hazardQuantification.uniformHazardSpectra = [{
    uuid: "UHS-1E-4-H",
    name: "1E-4 mean horizontal uniform hazard spectrum",
    spectrumType: "UNIFORM_HAZARD",
    direction: "GEOMETRIC_MEAN_HORIZONTAL",
    controlPointRef: "CONTROL-POINT-FOUNDATION",
    annualFrequencyOfExceedance: 1e-4,
    dampingRatio: 0.05,
    statistic: "MEAN",
    points: spectrumPoints,
    derivationMethod: "Interpolate each spectral hazard curve at 1E-4 annual exceedance.",
    sourceHazardCurveRefs: ["HAZARD-CURVE-MEAN-1HZ"],
    implementsSrs: srs("SHA-F1", "SHA-G1"),
  }];
  sha.hazardQuantification.calculationRuns = [{
    uuid: "HAZARD-RUN-2026",
    name: "Integrated hazard calculation",
    calculationDate: "2026-05-21",
    software: "OpenPSHA",
    softwareVersion: "4.0",
    sourceModelRef: "SOURCE-MODEL-2026",
    groundMotionModelRef: "GM-LT-1",
    siteResponseModelRefs: ["SITE-RESPONSE-METHOD-1"],
    logicTreeEndBranchCount: 72,
    numericalIntegrationMethod: "Adaptive magnitude-distance integration over all end branches.",
    magnitudeStep: 0.1,
    distanceStepKm: 1,
    annualFrequencyRange: { minimum: 1e-9, maximum: 1e-2 },
    convergenceCriteria: "Less than one percent change in hazard across refined integration grids.",
    convergenceDemonstration: "Magnitude and distance step-halving changed risk-range hazard by at most 0.6 percent.",
    verificationChecks: ["Branch weights sum to one", "independent spot calculations", "monotonic curve check"],
    warningsAndLimitations: [],
    outputFileRefs: ["SHA-RESULTS-2026.H5"],
    implementsSrs: srs("SHA-F1", "SHA-F2", "SHA-F3", "SHA-F4"),
  }];
  sha.hazardQuantification.seismicPraInputs.hazardIntervals = [
    { lower: 0.1, upper: 0.2, representative: 0.15, frequency: isSfr ? 4.06e-3 : 2.69e-3 },
    { lower: 0.2, upper: 0.4, representative: 0.3, frequency: isSfr ? 6.68e-4 : 4.54e-4 },
    { lower: 0.4, upper: 0.8, representative: 0.6, frequency: isSfr ? 6.79e-5 : 5.27e-5 },
    { lower: 0.8, upper: 1.6, representative: 1.2, frequency: isSfr ? 3.98e-6 : 3.21e-6 },
  ].map((bin, index) => ({
    uuid: `HAZARD-INTERVAL-${index + 1}`,
    name: `Hazard interval ${index + 1}`,
    groundMotionParameterRef: "GMP-SA-1HZ",
    controlPointRef: "CONTROL-POINT-FOUNDATION",
    lowerGroundMotion: bin.lower,
    upperGroundMotion: bin.upper,
    representativeGroundMotion: bin.representative,
    groundMotionUnits: "g",
    annualFrequency: bin.frequency,
    frequencyUnit: "per plant-year",
    frequencyCalculationMethod: "Difference of mean hazard-curve exceedance frequencies at interval bounds.",
    sourceHazardCurveRef: "HAZARD-CURVE-MEAN-1HZ",
    usedByEventSequenceFamilyRefs: ["ESF-SEISMIC-DAMAGE"],
    implementsSrs: srs("SHA-F3", "SPR-E1"),
  }));
  sha.hazardQuantification.seismicPraInputs.fragilityInputSpectrumRefs = ["UHS-1E-4-H"];
  sha.hazardQuantification.seismicPraInputs.plantResponseInputRefs = sha.hazardQuantification.seismicPraInputs.hazardIntervals.map((item) => item.uuid);
  sha.hazardQuantification.seismicPraInputs.eventSequenceQuantificationInputRefs = ["ESF-SEISMIC-DAMAGE"];
  sha.hazardQuantification.seismicPraInputs.transferBasis = "Mean hazard curves, common control point, consistent motion definitions, and non-overlapping intervals are transferred under configuration control.";
  sha.hazardQuantification.seismicPraInputs.consistencyChecks = ["Motion units and components match SFR", "interval frequencies reconcile to hazard curve", "upper tail extends past fragility saturation"];
  sha.hazardQuantification.seismicPraInputs.implementsSrs = srs("SHA-F1", "SHA-F2", "SHA-F3", "SHA-F4");
  sha.hazardQuantification.uncertaintyPropagationMethod = "Full logic-tree integration of epistemic branches with aleatory variability integrated within branches.";
  sha.hazardQuantification.aleatoryUncertaintiesPropagated = true;
  sha.hazardQuantification.epistemicUncertaintiesPropagated = true;
  sha.hazardQuantification.resultQualityChecks = ["Hazard curves are monotonic", "fractiles bracket the mean", "deaggregation contributions sum to one"];
  sha.hazardQuantification.implementsSrs = srs("SHA-F1", "SHA-F2", "SHA-F3", "SHA-F4");
  sha.responseSpectraEvaluation.horizontalSpectra = sha.hazardQuantification.uniformHazardSpectra;
  sha.responseSpectraEvaluation.downstreamConsistencyBasis = "The same spectra, control point, damping, direction, and units are used for structural response and fragility reference earthquake selection.";
  sha.responseSpectraEvaluation.implementsSrs = srs("SHA-G1", "SHA-G2");
  sha.secondaryHazardEvaluation.identificationMethod = "Systematic review of ground deformation, slope, settlement, liquefaction, seiche, and earthquake-induced flooding mechanisms.";
  sha.secondaryHazardEvaluation.siteAndRegionalHazardListSources = ["SITE-CHARACTERIZATION-REPORT", "HAZARDS-SCREENING-WORKBOOK"];
  sha.secondaryHazardEvaluation.hazards = [{
    uuid: "SECONDARY-LIQUEFACTION",
    name: "Earthquake-induced soil liquefaction",
    hazardType: "SOIL_LIQUEFACTION",
    description: "Potential cyclic pore-pressure generation in a localized saturated sand lens away from the basemat.",
    initiatingMechanisms: ["Strong shaking", "elevated groundwater"],
    siteEvidenceRefs: ["CPT-2026", "GROUNDWATER-MONITORING"],
    potentiallyAffectedArea: "Buried service corridor east of the reactor building",
    potentiallyAffectedSeismicEquipmentListItemRefs: ["SEL-SECONDARY"],
    screening: {
      disposition: "RETAINED",
      criterion: "NOT_SCREENED",
      methodology: "Site-specific cyclic resistance and deformation evaluation.",
      demonstrablyConservative: true,
      screeningBasis: "Retained because deformation cannot be excluded at the lowest profile branch.",
      calculationsAndEvidenceRefs: ["LIQUEFACTION-CALC-01"],
      implementsSrs: srs("SHA-I1", "SHA-I2"),
    },
    retainedAnalysis: {
      uuid: "LIQUEFACTION-ANALYSIS-1",
      name: "Localized liquefaction deformation analysis",
      hazardParameter: "Permanent ground displacement",
      parameterUnits: "cm",
      affectedSeismicEquipmentListItemRefs: ["SEL-SECONDARY"],
      failureMechanisms: [{ id: "LIQ-MECH-1", name: "Differential settlement", description: "Settlement-induced loss of cooler alignment", fragilityParameter: "settlement", fragilityUnits: "cm" }],
      hazardCurves: [],
      calculationMethod: "Probabilistic cyclic stress and post-liquefaction deformation analysis.",
      dataAndModelRefs: ["CPT-2026", "LIQUEFACTION-CALC-01"],
      uncertainties: [],
      sensitivityStudyRefs: ["SENS-LIQUEFACTION"],
      outputRefs: ["LIQUEFACTION-HAZARD-RESULTS"],
      implementsSrs: srs("SHA-I2", "SHA-I3"),
    },
    implementsSrs: srs("SHA-I1", "SHA-I2", "SHA-I3"),
  }];
  sha.secondaryHazardEvaluation.screeningCriteriaReference = "Non-LWR PRA Standard SCR-2/SCR-3 criteria and project hazards-screening procedure.";
  sha.secondaryHazardEvaluation.crossHazardDependencies = ["Liquefaction deformation conditional on strong ground motion"];
  sha.secondaryHazardEvaluation.completenessReview = "All site-region seismic secondary hazards are dispositioned and retained mechanisms are transferred to SFR and SPR.";
  sha.secondaryHazardEvaluation.implementsSrs = srs("SHA-I1", "SHA-I2", "SHA-I3");
  sha.documentation.processDescription = "A structured SSHAC Level 2 process develops source, ground-motion, site-response, spectra, and secondary-hazard results for Seismic PRA.";
  sha.documentation.inputsDescription = "Regional and site earth-science data, catalog records, geotechnical investigations, and strong-motion models are controlled and traceable.";
  sha.documentation.modelStructureDescription = "Coupled source, ground-motion, and site-response logic trees are integrated into mean and fractile control-point hazard.";
  sha.documentation.hazardResultsSummary = "Mean curves and spectra cover 1E-2 to below 1E-8 per plant-year and are discretized for response quantification.";
  sha.documentation.secondaryHazardMethods = "Secondary mechanisms are systematically identified, screened, or retained with hazard and fragility interfaces.";
  sha.documentation.riskSignificantUncertaintiesAndAssumptions = "Local-fault recurrence, ground-motion median, and nonlinear site response dominate hazard uncertainty.";
  sha.documentation.modelUncertaintyDocumentation = "Reasonable source, prediction-model, and site-response alternatives are carried in the logic tree or sensitivity studies.";
  sha.documentation.dataAndModelReferences = ["SHA-DATA-COMPILATION-2026", "SOURCE-MODEL-2026", "GM-LT-1", "SITE-RESPONSE-METHOD-1"];
  sha.documentation.calculationFileRefs = ["SHA-RESULTS-2026.H5"];
  sha.documentation.traceabilityLinks = [
    {
      uuid: "TRACE-SHA-DATA-RESULT",
      sourceType: "DATA_SET",
      sourceRef: "EARTH-SCIENCE-DATA-1",
      targetType: "HAZARD_CURVE",
      targetRef: "HAZARD-CURVE-MEAN-1HZ",
      relationship: "The controlled earth-science compilation supports the source, ground-motion, and site-response branches integrated into the mean hazard curve.",
      requirementRefs: srs("SHA-B1", "SHA-C1", "SHA-D1", "SHA-F1"),
    },
    {
      uuid: "TRACE-SHA-RESULT-INTERFACE",
      sourceType: "RESULT",
      sourceRef: "UHS-1E-4-H",
      targetType: "SEISMIC_PRA_INTERFACE",
      targetRef: "IF-SHA-SFR",
      relationship: "The controlled uniform-hazard spectrum, motion definition, and control point are transferred to fragility and plant-response analyses.",
      requirementRefs: srs("SHA-G1", "SHA-G2", "SHA-I2"),
    },
  ];
  sha.documentation.implementsSrs = srs("SHA-A1", "SHA-B1", "SHA-C1", "SHA-D1", "SHA-E1", "SHA-F1", "SHA-G1", "SHA-H1", "SHA-I1");

  const sfr = mef.seismicFragilityAnalysis;
  sfr.uuid = `SFR-${kind.toUpperCase()}`;
  sfr.praScope = `Develop realistic CC-II seismic demands and fragilities for the ${reactor} equipment list over the hazard range of interest.`;
  sfr.scope = {
    seismicEquipmentListRef: "SEL-2026",
    includedSscRefs: ["SEL-PRIMARY", "SEL-SECONDARY"],
    excludedSscs: [],
    correlationGroupRefs: ["CORR-COLOCATED-EQUIPMENT"],
    scopeEvolutionSummary: "The scope was reconciled against system logic, seismic initiators, secondary hazards, and walkdown findings.",
    systemsFragilityAlignment: "Every modeled seismic basic event maps to an SEL failure mode and a controlling fragility evaluation.",
    implementsSrs: srs("SFR-A1", "SFR-A2"),
  };
  sfr.seismicResponseAnalysis.hazardSpectrumRefs = ["UHS-1E-4-H"];
  sfr.seismicResponseAnalysis.referenceEarthquakes = [{
    uuid: "REFERENCE-EQ-1",
    name: "Risk-range reference earthquake",
    hazardSpectrumRef: "UHS-1E-4-H",
    groundMotionParameterRef: "GMP-SA-1HZ",
    controlPointRef: "CONTROL-POINT-FOUNDATION",
    annualFrequencyOfExceedance: 1e-4,
    groundMotionLevel: isSfr ? 0.42 : 0.36,
    groundMotionUnits: "g",
    horizontalComponentRefs: ["UHS-1E-4-H"],
    verticalComponentRef: "VERTICAL-SPECTRUM-1E-4",
    hazardRangeOfInterest: { lowerGroundMotion: 0.1, upperGroundMotion: 1.6, basis: "Contains all intervals contributing materially to seismic risk." },
    riskDominantInputLevel: 0.6,
    selectionMethod: "Hazard-consistent spectrum selected near the geometric center of risk contribution.",
    selectionValidation: "Scaling sensitivities reproduce median response across the hazard range of interest.",
    nonlinearBehaviorBasis: "Potential nonlinearities are modeled or bounded at upper input levels.",
    implementsSrs: srs("SFR-B1", "SFR-B2"),
  }];
  sfr.seismicResponseAnalysis.structuralModels = [{
    uuid: "STRUCTURAL-MODEL-1",
    name: `${building} three-dimensional model`,
    structureRef: "STRUCTURE-REACTOR-BUILDING",
    modelType: "THREE_DIMENSIONAL_FINITE_ELEMENT",
    softwareAndVersion: "OpenStruct 7.2",
    modelFileRefs: ["STRUCT-MODEL-2026"],
    asModeledCondition: "AS_INTENDED_TO_OPERATE",
    stiffnessRepresentation: "Median cracked stiffness with uncertainty sampling.",
    massRepresentation: "Distributed structural mass and explicit equipment mass.",
    dampingRepresentation: "Frequency- and response-level-dependent median damping.",
    stressStateRepresentation: "Gravity and operating prestress included.",
    directionalCoupling: "Three translational directions solved simultaneously.",
    rotationalInertia: "Included for major floors and equipment masses.",
    diaphragmFlexibility: "Shell-element floor diaphragms.",
    torsionalEffects: "Explicit eccentricity and 3-D modes.",
    structuralCoupling: "Shared foundation and adjoining structural interfaces modeled.",
    foundationAndEmbedment: "Embedded foundation with frequency-dependent soil springs.",
    nonlinearFeatures: ["Gap/contact at selected interfaces"],
    modalProperties: [{ mode: 1, frequencyHz: isSfr ? 4.1 : 3.6, dampingRatio: 0.05, direction: "X", massParticipationFraction: 0.62 }],
    verificationAndValidation: "Independent model review, mass/stiffness checks, mode-shape inspection, and benchmark comparison.",
    limitations: ["Final as-built nonstructural mass requires confirmation."],
    implementsSrs: srs("SFR-B2", "SFR-B3"),
  }];
  sfr.seismicResponseAnalysis.responseResults = [{
    uuid: "RESPONSE-PRIMARY-LOCATION",
    name: "Median floor response at primary SSC location",
    responseModelRef: "STRUCTURAL-MODEL-1",
    referenceEarthquakeRef: "REFERENCE-EQ-1",
    location: `${building}, primary equipment elevation`,
    responseQuantity: "FLOOR_RESPONSE_SPECTRUM",
    direction: "COMBINED",
    units: "g",
    spectrumPoints: spectrumPoints.map((point) => ({ frequencyHz: point.frequencyHz, periodSeconds: point.periodSeconds, medianResponse: point.spectralAcceleration * 1.25 })),
    betaRandomness: 0.24,
    betaUncertainty: 0.31,
    compositeBeta: 0.392,
    variabilityBasis: "Input motion, damping, frequency, stiffness, and soil properties are separated into aleatory and epistemic contributions.",
    applicableSscRefs: ["SEL-PRIMARY", "SEL-SECONDARY"],
    outputFileRef: "SFR-RESPONSE-RESULTS.H5",
    implementsSrs: srs("SFR-B3", "SFR-B4"),
  }];
  sfr.seismicResponseAnalysis.soilStructureInteractionAnalyses = [{
    uuid: "SSI-1",
    name: "Probabilistic soil-structure interaction",
    applicable: true,
    significanceAssessment: "SSI shifts dominant frequencies and materially affects response uncertainty.",
    analysisType: "PROBABILISTIC",
    method: "Substructure frequency-domain SSI",
    siteSpecific: true,
    soilProfileRefs: ["PROFILE-BEST"],
    strainCompatibleProperties: true,
    embedmentTreatment: "Sidewall and basemat interaction included.",
    groundMotionIncoherenceTreatment: "Wave-passage and incoherence sensitivity included.",
    structureSoilStructureInteractionTreatment: "Common soil domain represented through coupled impedance terms.",
    medianResponseResultRefs: ["RESPONSE-PRIMARY-LOCATION"],
    uncertaintyResultRefs: ["RESPONSE-PRIMARY-LOCATION"],
    exclusionOrMethodBasis: "Site-specific SSI is retained because flexible profiles overlap structural frequencies.",
    implementsSrs: srs("SFR-B3", "SFR-B5"),
  }];
  sfr.seismicResponseAnalysis.probabilisticSimulations = [{
    uuid: "RESPONSE-SIM-1",
    name: "Probabilistic response simulation",
    method: "LATIN_HYPERCUBE",
    simulationCount: 200,
    randomSeed: 19421,
    inputMotionSetCount: 30,
    componentsPerSet: 3,
    sampledAleatoryVariables: ["input motion record", "damping"],
    sampledEpistemicVariables: ["soil profile", "stiffness", "SSI impedance"],
    correlationTreatment: "Within-structure stiffness and damping correlations are preserved.",
    convergenceMetric: "Median and logarithmic standard deviation at risk-significant spectral ordinates.",
    convergenceCriterion: "Less than two-percent change over the last 50 simulations.",
    convergenceResults: [{ sampleCount: 150, metricValue: 0.019 }, { sampleCount: 200, metricValue: 0.011 }],
    stableResponsesDemonstrated: true,
    outputResultRefs: ["RESPONSE-PRIMARY-LOCATION"],
    implementsSrs: srs("SFR-B5", "SFR-B6"),
  }];
  sfr.seismicResponseAnalysis.groundMotionParameterConsistency = "Reference-earthquake motion matches the SHA geometric-mean horizontal SA definition and g units.";
  sfr.seismicResponseAnalysis.controlPointConsistency = "Foundation input and response transfer use CONTROL-POINT-FOUNDATION.";
  sfr.seismicResponseAnalysis.timeHistoryDevelopmentBasis = "Hazard-consistent three-component suites preserve component correlation and spectral variability.";
  sfr.seismicResponseAnalysis.medianCentered = true;
  sfr.seismicResponseAnalysis.approximationBiasAssessment = "Scaling and numerical approximations introduce less than five-percent median bias across the HROI.";
  sfr.seismicResponseAnalysis.implementsSrs = srs("SFR-B1", "SFR-B2", "SFR-B3", "SFR-B4", "SFR-B5", "SFR-B6");
  sfr.thresholdProgram.inherentlyRuggedBases = [{
    uuid: "RUGGED-BASIS-1",
    name: "Inherently rugged passive-component basis",
    referenceGroundMotionParameter: "GMP-SA-1HZ",
    genericRuggedComponentTypes: ["Welded process piping below 50 mm", "structural steel platforms"],
    guidanceReferences: ["EPRI seismic experience database", "project ruggedness procedure"],
    plantSpecificAdditions: [],
    excludedComponentTypes: ["Active relays", "unanchored equipment"],
    capacityBeyondRiskSignificantRangeBasis: "Experience capacities exceed the terminal risk-significant hazard interval with margin.",
    hazardIndependentBasis: "The classification derives from demonstrated capacity, not the local hazard level.",
    implementsSrs: srs("SFR-C1"),
  }];
  sfr.thresholdProgram.thresholdMethods = [{
    uuid: "THRESHOLD-1",
    name: "Cumulative fragility threshold",
    plantResponseThresholdRef: "SPR-THRESHOLD-1",
    groundMotionParameterRef: "GMP-SA-1HZ",
    controlPointRef: "CONTROL-POINT-FOUNDATION",
    thresholdCapacity: 1.8,
    capacityUnits: "g",
    cumulativeSscCountBasis: 12,
    correlationTreatment: "Perfectly correlated groups counted once and independent groups accumulated probabilistically.",
    screeningCapacitySources: ["qualification records", "experience data", "plant-specific calculations"],
    caveatsAndInclusionRules: ["Anchorage and supports included", "all credible failure modes below threshold included"],
    comparisonMethod: "Integrate the aggregate conditional failure probability over the mean hazard curve.",
    satisfiesScr2: true,
    implementsSrs: srs("SFR-C2"),
  }];
  sfr.thresholdProgram.screenedSscRefs = [];
  sfr.thresholdProgram.screeningConfirmationMethod = "Walkdown and document review confirm applicability of every ruggedness and threshold disposition.";
  sfr.thresholdProgram.anchorageAndSupportIncluded = true;
  sfr.thresholdProgram.implementsSrs = srs("SFR-C1", "SFR-C2");
  sfr.plantInvestigations = [{
    uuid: "INVESTIGATION-1",
    name: isSfr ? "SFR seismic design walkdown" : "HTGR seismic design walkdown",
    investigationType: "COMPUTERIZED_WALKDOWN",
    conditionBasis: "AS_INTENDED_TO_OPERATE",
    date: "2026-04-16",
    scope: "All risk-significant SEL items, anchorage, load paths, spatial interactions, flood/fire sources, and operator access routes.",
    procedures: "Project seismic walkdown procedure based on established nuclear seismic margin practice and adapted for pre-operational design review.",
    team: [{
      uuid: "WALKDOWN-ENGINEER-1",
      name: "Lead seismic capability engineer",
      organization: "OpenPRA Reference Program",
      role: "Team lead",
      seismicPerformanceExperience: "Twenty years of nuclear seismic capability evaluation",
      walkdownExperience: "Seismic walkdowns at six nuclear sites",
      systemsOrOperationsExperience: "Supported system-engineering interviews for the reference design",
      qualifications: ["Civil/structural PE", "seismic walkdown lead"],
    }],
    designDocumentRefs: ["GENERAL-ARRANGEMENT-2026", "ANCHORAGE-SCHEDULE-2026"],
    sscRefsReviewed: ["SEL-PRIMARY", "SEL-SECONDARY"],
    anchorageAndLoadPathReview: "Anchorage, support, and structural load paths were traced to foundations and modeled response locations.",
    observations: ["Adequate separation from adjacent equipment", "maintenance clearances preserved"],
    findings: [{
      uuid: "FINDING-1",
      name: "Flexible service-line interaction",
      sscRef: "SEL-PRIMARY",
      findingType: "INTERACTION",
      description: "A service line could impose nozzle load at high differential displacement.",
      location: building,
      credible: true,
      potentiallyRiskSignificant: true,
      affectedFunctionOrAction: `Operation of ${primarySsc}`,
      affectedFailureModeRefs: ["FAILURE-MODE-PRIMARY"],
      resolutionOrFragilityTreatment: "Interaction load included in the controlling functional fragility.",
      evidenceRefs: ["INTERACTION-CALC-01"],
      implementsSrs: srs("SFR-D5", "SFR-D6"),
    }],
    fragilityThresholdConfirmations: [
      { sscRef: "SEL-PRIMARY", anchorageConfirmed: true, supportConfirmed: true, thresholdSatisfied: false, basis: "Retained for explicit fragility." },
      { sscRef: "SEL-SECONDARY", anchorageConfirmed: true, supportConfirmed: true, thresholdSatisfied: false, basis: "Retained for explicit fragility and secondary-hazard dependency." },
    ],
    conclusions: "The SEL is complete for the modeled design; identified interactions are represented in fragility and plant response.",
    limitations: ["Physical as-built walkdown remains a pre-operational closure item."],
    implementsSrs: srs("SFR-D1", "SFR-D2", "SFR-D4", "SFR-D5", "SFR-D6", "SFR-D7", "SFR-D8"),
  }];
  sfr.results.failureMechanisms = [
    {
      uuid: "MECHANISM-PRIMARY",
      name: `${primarySsc} functional failure`,
      sscRef: "SEL-PRIMARY",
      systemsFailureModeRef: "FAILURE-MODE-PRIMARY",
      mechanismType: "FUNCTIONAL_FAILURE",
      failureModeType: "FUNCTIONAL",
      description: "Loss of credited function from combined inertial, anchorage, and service-line demands.",
      demandParameter: "Floor spectral acceleration",
      demandUnits: "g",
      demandResultRefs: ["RESPONSE-PRIMARY-LOCATION"],
      capacityParameter: "Component functional acceleration capacity",
      capacityUnits: "g",
      capacityDataRefs: ["QUALIFICATION-PRIMARY", "INTERACTION-CALC-01"],
      anchorageAndSupportLoadPath: "Equipment frame through qualified anchors to the structural floor model.",
      interactionRefs: ["FINDING-1"],
      conservativeBounding: false,
      realisticForRiskSignificantSsc: true,
      controlling: true,
      selectionBasis: "Lowest realistic capacity among credible functional, anchorage, and interaction mechanisms.",
      implementsSrs: srs("SFR-E1", "SFR-E2", "SFR-E3"),
    },
    {
      uuid: "MECHANISM-SECONDARY",
      name: `${secondarySsc} structural/soil interaction failure`,
      sscRef: "SEL-SECONDARY",
      systemsFailureModeRef: "FAILURE-MODE-SECONDARY",
      mechanismType: isSfr ? "DIFFERENTIAL_SETTLEMENT" : "ANCHORAGE_FAILURE",
      failureModeType: isSfr ? "SOIL_FAILURE" : "ANCHORAGE",
      description: `Loss of credited function of ${secondarySsc}.`,
      demandParameter: isSfr ? "Differential settlement" : "Floor spectral acceleration",
      demandUnits: isSfr ? "cm" : "g",
      demandResultRefs: ["RESPONSE-PRIMARY-LOCATION", "LIQUEFACTION-HAZARD-RESULTS"],
      capacityParameter: isSfr ? "Allowable differential settlement" : "Anchorage acceleration capacity",
      capacityUnits: isSfr ? "cm" : "g",
      capacityDataRefs: ["CAPACITY-SECONDARY"],
      anchorageAndSupportLoadPath: "Equipment supports and foundations reviewed through the complete load path.",
      interactionRefs: ["SECONDARY-LIQUEFACTION"],
      conservativeBounding: false,
      realisticForRiskSignificantSsc: true,
      controlling: true,
      selectionBasis: "Retained secondary-hazard mechanism controls the lower-tail capacity.",
      implementsSrs: srs("SFR-E1", "SFR-E5"),
    },
  ];
  sfr.results.fragilityEvaluations = [
    { ref: "PRIMARY", ssc: "SEL-PRIMARY", mechanism: "MECHANISM-PRIMARY", failure: "FAILURE-MODE-PRIMARY", median: isSfr ? 1.18 : 1.32, betaR: 0.28, betaU: 0.34, hclpf: isSfr ? 0.43 : 0.49 },
    { ref: "SECONDARY", ssc: "SEL-SECONDARY", mechanism: "MECHANISM-SECONDARY", failure: "FAILURE-MODE-SECONDARY", median: isSfr ? 0.92 : 1.08, betaR: 0.31, betaU: 0.38, hclpf: isSfr ? 0.31 : 0.38 },
  ].map((item) => ({
    uuid: `FRAGILITY-${item.ref}`,
    name: `${item.ssc} controlling fragility`,
    sscRef: item.ssc,
    systemsFailureModeRef: item.failure,
    mechanismRefs: [item.mechanism],
    controllingMechanismRef: item.mechanism,
    analysisCategory: "GENERAL_SSC" as const,
    evaluationBasis: "PLANT_SPECIFIC_CALCULATION" as const,
    plantSpecific: true,
    riskSignificance: ImportanceLevel.HIGH,
    groundMotionParameterRef: "GMP-SA-1HZ",
    controlPointRef: "CONTROL-POINT-FOUNDATION",
    medianCapacity: item.median,
    capacityUnits: "g",
    betaRandomness: item.betaR,
    betaUncertainty: item.betaU,
    compositeBeta: Math.sqrt(item.betaR ** 2 + item.betaU ** 2),
    highConfidenceLowProbabilityOfFailureCapacity: item.hclpf,
    meanFragilityCurve: [0.1, 0.2, 0.4, 0.8, 1.2, 1.6, 2.4].map((groundMotion) => ({
      groundMotion,
      conditionalFailureProbability: Math.min(0.999, Math.max(0.0001, 1 / (1 + Math.exp(-7 * (groundMotion / item.median - 1))))),
    })),
    demandToCapacityMethod: "Lognormal separation-of-variables fragility with explicit median demand and capacity uncertainty.",
    responseResultRefs: ["RESPONSE-PRIMARY-LOCATION"],
    capacityDataRefs: [`CAPACITY-${item.ref}`],
    correlationGroupRefs: ["CORR-COLOCATED-EQUIPMENT"],
    thresholdMethodRef: "THRESHOLD-1",
    thresholdSatisfied: false,
    maskingEvaluation: "No higher-capacity mechanism masks the controlling failure mode.",
    sensitivityStudyRefs: ["SENS-FRAGILITY-BETA"],
    assumptions: ["As-intended anchorage configuration"],
    limitations: ["Confirm final vendor qualification record"],
    implementsSrs: srs("SFR-E1", "SFR-E2", "SFR-E3", "SFR-E4", "SFR-E5", "SFR-E6", "SFR-E7"),
  }));
  sfr.results.correlationGroups = [{
    uuid: "CORR-COLOCATED-EQUIPMENT",
    name: "Co-located equipment demand correlation",
    memberSscRefs: ["SEL-PRIMARY", "SEL-SECONDARY"],
    correlationModel: "PARTIAL",
    correlationCoefficient: 0.45,
    commonDemandBasis: "Common structural response and input-motion variability.",
    constructionSimilarity: "Different component designs.",
    installationSimilarity: "Common building but distinct anchorage systems.",
    locationAndOrientationSimilarity: "Nearby elevations with different orientations.",
    capacitySimilarity: "Capacity variables treated independently except shared installation uncertainty.",
    modelingImplementation: "Gaussian-copula sampling of demand and selected capacity terms.",
    justification: "Response simulations and physical differences support partial rather than perfect correlation.",
    sensitivityStudyRefs: ["SENS-CORRELATION"],
    implementsSrs: srs("SFR-E6", "SPR-B5"),
  }];
  sfr.results.sensitivityStudies = [{
    uuid: "SENS-FRAGILITY-BETA",
    name: "Fragility uncertainty sensitivity",
    description: "Vary composite fragility uncertainty around the evaluated values.",
    variedParameters: ["betaR", "betaU"],
    parameterRanges: { betaR: [0.2, 0.4], betaU: [0.25, 0.5] },
    results: "Total seismic frequency changes by -18 to +27 percent; contributor ranking is unchanged.",
    insights: "The secondary SSC remains the dominant fragility contributor.",
    implementsSrs: srs("SFR-E3", "SFR-E6"),
  }];
  sfr.results.systemsModelTransferBasis = "Every evaluation is transferred by SEL item, failure mode, ground-motion parameter, control point, and correlation group.";
  sfr.results.implementsSrs = srs("SFR-E1", "SFR-E2", "SFR-E3", "SFR-E4", "SFR-E5", "SFR-E6", "SFR-E7");
  sfr.documentation.processDescription = "Reference-earthquake structural response, threshold screening, investigations, mechanism evaluation, and lognormal fragility development are integrated with systems modeling.";
  sfr.documentation.inputsDescription = "SHA spectra and intervals, structural and geotechnical models, qualification data, system failure modes, and walkdown evidence.";
  sfr.documentation.seismicResponseAnalysis = "Median-centered 3-D response and SSI simulations propagate aleatory and epistemic response variability.";
  sfr.documentation.ruggedAndThresholdMethodology = "Ruggedness and cumulative threshold methods include anchorage, supports, caveats, correlations, and final model confirmation.";
  sfr.documentation.investigationProcedures = "Risk-informed computerized walkdown and document review cover all SEL items and relevant interactions.";
  sfr.documentation.fragilityParameterResults = "Median, betaR, betaU, composite beta, HCLPF, and full mean curves are provided for modeled failure modes.";
  sfr.documentation.modelUncertaintiesAndAlternatives = "Demand, capacity, correlation, and secondary-hazard alternatives are evaluated in sensitivities.";
  sfr.documentation.dataAndCalculationRefs = ["SFR-RESPONSE-RESULTS.H5", "QUALIFICATION-PRIMARY", "CAPACITY-SECONDARY"];
  sfr.documentation.traceability = [
    {
      sscRef: "SEL-PRIMARY",
      failureModeRef: "FAILURE-MODE-PRIMARY",
      mechanismRefs: ["MECHANISM-PRIMARY"],
      demandRefs: ["RESPONSE-PRIMARY-LOCATION"],
      fragilityRef: "FRAGILITY-PRIMARY",
      plantResponseModelRefs: ["INDUCED-FAILURE-1", "BE-SEL-PRIMARY"],
    },
    {
      sscRef: "SEL-SECONDARY",
      failureModeRef: "FAILURE-MODE-SECONDARY",
      mechanismRefs: ["MECHANISM-SECONDARY"],
      demandRefs: ["RESPONSE-PRIMARY-LOCATION", "SECONDARY-LIQUEFACTION"],
      fragilityRef: "FRAGILITY-SECONDARY",
      plantResponseModelRefs: ["INDUCED-FAILURE-2", "BE-SEL-SECONDARY"],
    },
  ];
  sfr.documentation.implementsSrs = srs("SFR-F1", "SFR-F2", "SFR-F3");

  const spr = mef.seismicPlantResponseAnalysis;
  spr.uuid = `SPR-${kind.toUpperCase()}`;
  spr.praScope = `Identify direct and secondary seismic initiators, adapt the internal-events model, quantify seismic event-sequence families, and identify ${reactor} risk insights.`;
  const directInitiator = {
    uuid: "INITIATOR-DIRECT-GROUND-MOTION",
    name: "Seismic ground-motion initiating event",
    origin: "DIRECT_GROUND_MOTION" as const,
    description: "Ground motion causes plant trip and challenges credited safety functions.",
    plantOperatingStateRefs: ["POS-POWER"],
    reactorUnitRefs: [isSfr ? "UNIT-1" : "MODULES-1-4"],
    radioactiveMaterialSourceRefs: ["SOURCE-REACTOR"],
    directGroundMotionFailureRefs: ["FAILURE-MODE-PRIMARY", "FAILURE-MODE-SECONDARY"],
    industryExperienceRefs: ["SEISMIC-EXPERIENCE-DATABASE"],
    automaticOrManualTrip: true,
    affectedSscRefs: ["SEL-PRIMARY", "SEL-SECONDARY"],
    eventSequenceRefs: ["ES-SEISMIC-SUCCESS", "ES-SEISMIC-DAMAGE"],
    riskSignificant: true,
    retained: true,
    implementsSrs: srs("SPR-A1", "SPR-A2", "SPR-A3"),
  };
  spr.initiatingEventIdentification = {
    systematicProcess: "Review SHA ground motion and retained secondary hazards, SEL failure effects, system logic, operating states, radioactive sources, and earthquake experience.",
    plantOperatingStateRefs: ["POS-POWER", "POS-SHUTDOWN"],
    directInitiators: [directInitiator],
    secondaryHazardInitiators: [{
      ...directInitiator,
      uuid: "INITIATOR-LIQUEFACTION",
      name: "Seismic liquefaction-induced support challenge",
      origin: "SECONDARY_HAZARD",
      description: `Retained settlement hazard challenges ${secondarySsc}.`,
      secondaryHazardRef: "SECONDARY-LIQUEFACTION",
      directGroundMotionFailureRefs: undefined,
      eventSequenceRefs: ["ES-SEISMIC-DAMAGE"],
      implementsSrs: srs("SPR-A1", "SPR-A4"),
    }],
    industryExperienceSources: ["EPRI seismic experience database", "NRC earthquake operating experience"],
    multiReactorAndMultiSourceEvaluation: isSfr ? "Single-unit effects are modeled; spent-fuel source dependencies are retained." : "Concurrent module trip and shared RCCS/support dependencies are modeled across four modules.",
    completenessReview: "Initiators reconcile to all SHA retained hazards and SEL failure effects; screened mechanisms have documented bases.",
    riskSignificanceEvaluationMethod: "Preliminary quantification and bounding conditional consequence review.",
    retainedInitiatingEventRefs: ["INITIATOR-DIRECT-GROUND-MOTION", "INITIATOR-LIQUEFACTION"],
    implementsSrs: srs("SPR-A1", "SPR-A2", "SPR-A3", "SPR-A4"),
  };
  const equipment = [
    { id: "SEL-PRIMARY", name: primarySsc, type: "COMPONENT" as const, function: isSfr ? "Maintain primary sodium circulation or provide coastdown" : "Maintain forced helium circulation when credited", failure: "FAILURE-MODE-PRIMARY", fragility: "FRAGILITY-PRIMARY" },
    { id: "SEL-SECONDARY", name: secondarySsc, type: "SYSTEM" as const, function: isSfr ? "Provide passive/active decay heat rejection" : "Provide passive cavity heat removal", failure: "FAILURE-MODE-SECONDARY", fragility: "FRAGILITY-SECONDARY" },
  ].map((item) => ({
    uuid: item.id,
    name: item.name,
    sscType: item.type,
    componentRef: item.id === "SEL-PRIMARY" ? "COMPONENT-PRIMARY" : undefined,
    systemRef: item.id === "SEL-SECONDARY" ? "SYSTEM-DECAY-HEAT-REMOVAL" : "SYSTEM-PRIMARY-HEAT-TRANSPORT",
    reactorUnitRefs: [isSfr ? "UNIT-1" : "MODULES-1-4"],
    radioactiveMaterialSourceRefs: ["SOURCE-REACTOR"],
    building,
    roomOrArea: item.id === "SEL-PRIMARY" ? "Primary equipment area" : "Heat removal area",
    elevation: isSfr ? "812 m" : "1460 m",
    orientation: "Plant coordinate axes",
    mountingAndAnchorage: "Qualified steel frame and post-installed/embedded anchorage represented in fragility evaluation.",
    creditedFunctions: [item.function],
    inclusionSources: ["INTERNAL_EVENTS_SYSTEM_MODEL" as const, "SEISMIC_EVENT_SEQUENCE_MODEL" as const, "SECONDARY_HAZARD" as const],
    sourceElementRefs: ["SY-REFERENCE-MODEL", "ES-SEISMIC-DAMAGE"],
    failureModes: [{
      uuid: item.failure,
      name: `${item.name} loss of credited function`,
      failureModeType: item.id === "SEL-PRIMARY" ? "FUNCTIONAL" as const : isSfr ? "SOIL_FAILURE" as const : "ANCHORAGE" as const,
      description: `Seismically induced failure prevents ${item.function.toLowerCase()}.`,
      creditedFunction: item.function,
      failureDefinition: "Loss of the credited state for the required mission time.",
      requiredState: "FUNCTION_AFTER_EARTHQUAKE" as const,
      systemModelBasicEventRefs: [`BE-${item.id}`],
      eventSequenceRefs: ["ES-SEISMIC-DAMAGE"],
      fragilityMechanismRefs: [item.id === "SEL-PRIMARY" ? "MECHANISM-PRIMARY" : "MECHANISM-SECONDARY"],
      consequenceDescription: "Challenges successful heat removal and increases release-sequence frequency.",
      implementsSrs: srs("SPR-B1", "SPR-B3", "SPR-C2"),
    }],
    correlationGroupRefs: ["CORR-COLOCATED-EQUIPMENT"],
    fragilityAnalysisRef: item.fragility,
    disposition: "ACTIVE" as const,
    dispositionBasis: "Explicitly modeled because preliminary quantification and capability review show potential risk significance.",
    revisionHistory: [{ date: "2026-05-01", action: "ADDED" as const, reason: "Initial Seismic PRA scope reconciliation", actor: "example.preparer" }],
    implementsSrs: srs("SPR-B1", "SPR-B2", "SPR-C1", "SPR-C2"),
  }));
  spr.seismicEquipmentListDevelopment = {
    internalEventsSystemsModelRef: "SY-REFERENCE-MODEL",
    additionalSeismicSystemRefs: ["SYSTEM-SEISMIC-SUPPORT"],
    equipment,
    internalFloodSourceRefs: [],
    internalFireIgnitionSourceRefs: [],
    secondaryHazardSscRefs: ["SEL-SECONDARY"],
    additionalStructuresAndPassiveSscRefs: ["STRUCTURE-REACTOR-BUILDING"],
    failureModeIdentificationProcess: "Trace every seismic initiator and event sequence through system logic, passive structures, flood/fire sources, secondary hazards, relays, supports, and interactions.",
    systemsFragilityAnalystCoordination: "Joint SEL reviews reconcile identifiers, failure definitions, response locations, fragility mechanisms, and correlation groups.",
    completenessChecks: ["Every seismic basic event maps to an SEL failure mode", "every active SEL failure mode maps to fragility", "retained SHA hazards map to affected SEL items"],
    revisionBasis: "Controlled revisions follow system-model changes, design information, investigation findings, and fragility updates.",
    implementsSrs: srs("SPR-B1", "SPR-B2", "SPR-B3", "SPR-B4"),
  };
  spr.plantResponseModel.baseInternalEventsModelRefs = ["ES-REFERENCE-MODEL", "SY-REFERENCE-MODEL", "SC-REFERENCE-BASIS"];
  spr.plantResponseModel.baseNonSeismicHazardModelRefs = ["INTERNAL-FLOOD-REFERENCE", "INTERNAL-FIRE-REFERENCE"];
  spr.plantResponseModel.eventSequenceRefs = ["ES-SEISMIC-SUCCESS", "ES-SEISMIC-DAMAGE"];
  spr.plantResponseModel.systemsLogicModelRefs = ["SY-SEISMIC-MODEL"];
  spr.plantResponseModel.inducedFailures = equipment.map((item, index) => ({
    uuid: `INDUCED-FAILURE-${index + 1}`,
    name: item.failureModes[0]!.name,
    sscRef: item.uuid,
    seismicEquipmentListEntryRef: item.uuid,
    systemsFailureModeRef: item.failureModes[0]!.uuid,
    fragilityEvaluationRef: item.fragilityAnalysisRef!,
    systemsBasicEventRef: item.failureModes[0]!.systemModelBasicEventRefs[0]!,
    failureEffect: item.failureModes[0]!.consequenceDescription,
    correlationGroupRefs: item.correlationGroupRefs,
    causalDependencyRefs: [],
    eventSequenceRefs: item.failureModes[0]!.eventSequenceRefs ?? [],
    modelImplementation: "Hazard-bin-dependent basic-event probability obtained from the linked mean fragility curve.",
    implementsSrs: srs("SPR-B3", "SPR-B5", "SPR-B6"),
  }));
  spr.plantResponseModel.plantOperatingStateRefs = ["POS-POWER", "POS-SHUTDOWN"];
  spr.plantResponseModel.radioactiveMaterialSourceRefs = ["SOURCE-REACTOR", "SOURCE-SPENT-FUEL"];
  spr.plantResponseModel.fragilityThresholds = [{
    uuid: "SPR-THRESHOLD-1",
    name: "Aggregate high-capacity SSC threshold",
    groundMotionParameterRef: "GMP-SA-1HZ",
    controlPointRef: "CONTROL-POINT-FOUNDATION",
    thresholdCapacity: 1.8,
    capacityUnits: "g",
    hazardCurveRef: "HAZARD-CURVE-MEAN-1HZ",
    cumulativeSscCount: 12,
    correlationAndGroupingBasis: "Independent and correlated capacity groups are integrated without double counting.",
    integratedAnnualFrequency: 7.5e-9,
    screeningCriterion: "SCR-2",
    criterionLimit: 1e-7,
    satisfiesCriterion: true,
    eventSequenceFamilyApplicability: ["ESF-SEISMIC-DAMAGE"],
    finalModelConfirmation: "Final quantification confirms the screened aggregate remains below the criterion.",
    sensitivityStudyRefs: ["SENS-THRESHOLD"],
    implementsSrs: srs("SPR-B7", "SPR-B8"),
  }];
  spr.plantResponseModel.missionTimeAssessments = [{
    uuid: "MISSION-TIME-1",
    name: "Seismic decay-heat-removal mission time",
    eventSequenceRef: "ES-SEISMIC-DAMAGE",
    successCriteriaRef: "SC-DECAY-HEAT-REMOVAL",
    assumedMissionTimeHours: 72,
    sustainedAccessibilityImpact: "Local access limitations are included in ex-control-room action timing.",
    emergencyResponseCapabilityImpact: "On-site response is assumed available after the first eight hours with degraded access.",
    seismicEnvironmentDuration: "Strong motion is brief; aftershocks and debris constraints are considered for the full mission.",
    missionTimeValid: true,
    capabilityCategoryApplied: "CC-II",
    basis: "Thermal-hydraulic success criteria and seismic recovery/access evaluations support the modeled duration.",
    implementsSrs: srs("SPR-B9"),
  }];
  spr.plantResponseModel.multiReactorModels = [{
    uuid: "MULTI-REACTOR-1",
    name: "Concurrent reactor/module seismic response",
    applicable: !isSfr,
    reactorUnitRefs: [isSfr ? "UNIT-1" : "MODULE-1", ...(isSfr ? [] : ["MODULE-2", "MODULE-3", "MODULE-4"])],
    sharedSscRefs: isSfr ? [] : ["SEL-SECONDARY"],
    sharedHazardAndDependencyDescription: isSfr ? "Single reactor unit; source-area dependencies are evaluated separately." : "Common ground motion trips all modules and shared support dependencies are explicitly modeled.",
    concurrentInitiatingEventRefs: ["INITIATOR-DIRECT-GROUND-MOTION"],
    multiUnitEventSequenceRefs: isSfr ? [] : ["ES-MULTIMODULE-SEISMIC"],
    sharedHumanActionRefs: ["HFE-SEISMIC-LOCAL-ACTION"],
    sharedRadioactiveSourceRefs: ["SOURCE-SPENT-FUEL"],
    modelImplementation: isSfr ? "Not applicable to a single reactor unit." : "Shared basic events, conditional module states, and common human actions preserve dependencies.",
    exclusionBasis: isSfr ? "Reference SFR scope contains one reactor unit." : undefined,
    implementsSrs: srs("SPR-B13"),
  }];
  spr.plantResponseModel.modificationsFromBaseModel = ["Added hazard-bin initiating events", "replaced seismic-sensitive component probabilities with fragility links", "added retained secondary-hazard sequences", "updated mission times and human actions"];
  spr.plantResponseModel.completenessAndConsistencyReview = "The modified model preserves relevant internal-events logic, addresses peer-review findings, and reconciles every SEL, fragility, initiator, event sequence, and correlation.";
  spr.plantResponseModel.implementsSrs = srs("SPR-B1", "SPR-B2", "SPR-B3", "SPR-B4", "SPR-B5", "SPR-B6", "SPR-B7", "SPR-B8", "SPR-B9", "SPR-B10", "SPR-B11", "SPR-B12", "SPR-B13");
  spr.humanReliabilityModel.relevantInternalEventsHfeRefs = ["HFE-IE-LOCAL-ACTION"];
  spr.humanReliabilityModel.humanActions = [{
    uuid: "HFE-SEISMIC-LOCAL-ACTION",
    name: isSfr ? "Align alternate decay-heat removal path" : "Confirm passive RCCS alignment locally",
    humanFailureEventRef: "HFE-SEISMIC-LOCAL-ACTION",
    recoveryAction: false,
    sourceInternalEventsHfeRef: "HFE-IE-LOCAL-ACTION",
    eventSequenceRefs: ["ES-SEISMIC-DAMAGE"],
    controlRoomOrExControlRoom: "EX_CONTROL_ROOM",
    seismicSpecificChallenges: {
      trainingAndProcedures: "Seismic-specific cues and decision points are incorporated in procedures and training.",
      workloadAndStress: "Concurrent alarms, trip response, and aftershock concerns increase stress and workload.",
      mitigationImpact: "Automatic protection reduces immediate manual demand but local confirmation remains credited.",
      timingAndAccessibility: "Debris and lighting degradation are included in travel and execution time.",
      physicalHazards: "Falling-object zones and potential sodium/helium service hazards are routed around.",
      jobAidsAndTraining: "Portable lighting, local labels, and simulator/tabletop training are credited.",
    },
    availableTime: 90,
    requiredTime: 35,
    timeUnits: "minutes",
    humanErrorProbability: 0.045,
    dependencyRefs: [],
    feasibilityBasis: "Walkdown route review, timing trials, protective equipment, communication, and environmental conditions support feasibility.",
    humanReliabilityAnalysisRef: "HRA-SEISMIC-2026",
    implementsSrs: srs("SPR-C1", "SPR-C2", "SPR-C3", "SPR-C4", "SPR-C5", "SPR-C6"),
  }];
  spr.humanReliabilityModel.responseActionRequirementCompliance = "Seismic response actions follow HLR-HR-D capability requirements with environment-specific performance shaping factors.";
  spr.humanReliabilityModel.hfeDefinitionRequirementCompliance = "Actions are defined at decision points that produce distinct plant-response outcomes.";
  spr.humanReliabilityModel.recoveryRequirementCompliance = "No unsupported recovery credit is included; candidate recovery actions are sensitivity cases.";
  spr.humanReliabilityModel.quantificationRequirementCompliance = "CC-II quantification uses seismic-specific timing, stress, accessibility, dependency, and uncertainty.";
  spr.humanReliabilityModel.seismicInfluenceIntegration = "Ground-motion damage states determine access, cues, timing, and dependency conditions.";
  spr.humanReliabilityModel.implementsSrs = srs("SPR-C1", "SPR-C2", "SPR-C3", "SPR-C4", "SPR-C5", "SPR-C6");
  spr.quantification.hazardDiscretizations = [{
    uuid: "DISCRETIZATION-1",
    name: "Mean hazard discretization",
    hazardCurveRefs: ["HAZARD-CURVE-MEAN-1HZ"],
    bins: sha.hazardQuantification.seismicPraInputs.hazardIntervals.map((interval) => ({
      uuid: `SPR-${interval.uuid}`,
      name: interval.name,
      hazardCurveRef: interval.sourceHazardCurveRef,
      lowerGroundMotion: interval.lowerGroundMotion,
      upperGroundMotion: interval.upperGroundMotion,
      representativeGroundMotion: interval.representativeGroundMotion,
      groundMotionUnits: interval.groundMotionUnits,
      annualFrequency: interval.annualFrequency,
      conditionalFrequencyMethod: interval.frequencyCalculationMethod,
      fragilityEvaluationRefs: ["FRAGILITY-PRIMARY", "FRAGILITY-SECONDARY"],
      eventSequenceFamilyRefs: ["ESF-SEISMIC-DAMAGE"],
    })),
    numericalMethod: "Difference-of-exceedance bin frequencies with representative motion selected by fragility-weighted quadrature.",
    convergenceMetric: "Total event-sequence-family frequency",
    convergenceTolerance: 0.02,
    convergenceStudies: [{ binCount: 4, metricValue: isSfr ? 3.2e-5 : 2.4e-5, relativeChange: 0.018 }, { binCount: 8, metricValue: isSfr ? 3.17e-5 : 2.37e-5, relativeChange: 0.009 }],
    converged: true,
    basis: "Refinement changes total and contributor rankings below the project tolerance.",
    implementsSrs: srs("SPR-E1", "SPR-E2"),
  }];
  spr.quantification.esqRequirementCompliance = [
    { requirement: "HLR-ESQ-A", applicable: true, status: "MET", satisfiedByRefs: ["DISCRETIZATION-1"], evidence: "Initiator frequencies are derived consistently from mean hazard intervals." },
    { requirement: "HLR-ESQ-B", applicable: true, status: "MET", satisfiedByRefs: ["ESF-QUANT-1"], evidence: "Sequence-family quantification preserves system and human dependencies." },
  ];
  spr.quantification.eventSequenceFamilyQuantifications = [{
    uuid: "ESF-QUANT-1",
    name: "Seismic challenge event-sequence family",
    eventSequenceFamilyRef: "ESF-SEISMIC-DAMAGE",
    initiatingEventRefs: ["INITIATOR-DIRECT-GROUND-MOTION", "INITIATOR-LIQUEFACTION"],
    eventSequenceRefs: ["ES-SEISMIC-DAMAGE"],
    releaseCategoryRef: "RC-SEISMIC-RELEASE",
    sourceTermRef: "MS-SEISMIC-SOURCE-TERM",
    hazardDiscretizationRef: "DISCRETIZATION-1",
    meanHazardUsed: true,
    meanFragilitiesUsed: true,
    pointEstimateFrequency: isSfr ? 3.2e-5 : 2.4e-5,
    meanFrequency: isSfr ? 3.5e-5 : 2.6e-5,
    frequencyUnit: "PER_PLANT_YEAR",
    hazardBinContributions: sha.hazardQuantification.seismicPraInputs.hazardIntervals.map((interval, index) => ({ binRef: `SPR-${interval.uuid}`, frequencyContribution: (isSfr ? [3e-6, 9e-6, 1.4e-5, 6e-6] : [2e-6, 7e-6, 1e-5, 5e-6])[index]! })),
    uncertaintyContributions: [
      { sourceType: "HAZARD", sourceRef: "GM-LT-1", contributionDescription: "Ground-motion model median and sigma." },
      { sourceType: "FRAGILITY", sourceRef: "FRAGILITY-SECONDARY", contributionDescription: "Secondary SSC capacity and beta uncertainty." },
      { sourceType: "SYSTEMS", sourceRef: "SY-SEISMIC-MODEL", contributionDescription: "Common-cause and human-action dependencies." },
    ],
    truncationAndScreeningTreatment: "The hazard extends beyond fragility saturation; screened high-capacity SSCs satisfy the cumulative threshold criterion.",
    quantificationMethod: "Hazard-bin integration of mean fragilities and conditional event-sequence logic, with parameter uncertainty sampled jointly.",
    implementsSrs: srs("SPR-E2", "SPR-E3", "SPR-E4"),
  }];
  spr.quantification.resultType = "MEANS_WITH_PROPAGATED_PARAMETER_UNCERTAINTY";
  spr.quantification.integratedHazardFragilitySystemsMethod = "Evaluate fragility conditional failure probabilities at each hazard bin, solve dependent systems/event-sequence logic, multiply by bin frequency, and sum over bins.";
  spr.quantification.parameterUncertaintyPropagationMethod = "Latin-hypercube sampling of hazard branches, fragility parameters, correlation, data, and HRA distributions.";
  spr.quantification.combinedAssumptionEvaluation = "Combined pre-operational and modeling assumptions were sampled or bounded together; no cliff-edge interaction was identified.";
  spr.quantification.sensitivityStudies = [{
    uuid: "SENS-CORRELATION",
    name: "Fragility correlation sensitivity",
    description: "Evaluate independent, partial, and perfect correlation alternatives for co-located equipment.",
    variedParameters: ["correlationCoefficient"],
    parameterRanges: { correlationCoefficient: [0, 1] },
    results: "Mean seismic family frequency varies by -12 to +21 percent.",
    insights: "The same secondary heat-removal SSC remains dominant.",
    implementsSrs: srs("SPR-E5", "SPR-E6"),
  }];
  spr.quantification.riskSignificantContributors = [{
    uuid: "CONTRIBUTOR-SECONDARY-SSC",
    name: `${secondarySsc} seismic fragility`,
    contributorType: "SSC",
    contributorRef: "SEL-SECONDARY",
    affectedEventSequenceFamilyRefs: ["ESF-SEISMIC-DAMAGE"],
    contributionValue: isSfr ? 0.46 : 0.39,
    contributionMetric: "Fractional contribution to mean seismic event-sequence-family frequency",
    importance: ImportanceLevel.HIGH,
    designOperationMaintenanceContext: "Final anchorage/foundation details and inspection access directly affect the evaluated capacity.",
    riskInsight: `Preserve margin and configuration control for ${secondarySsc}; it is the leading seismic contributor.`,
    implementsSrs: srs("SPR-E6", "SPR-E8"),
  }];
  spr.quantification.outputQualityChecks = ["Bin contributions sum to total", "mean exceeds neither bounding sensitivity", "importance rankings reproduced independently", "SHA/SFR identifiers resolve"];
  spr.quantification.implementsSrs = srs("SPR-E1", "SPR-E2", "SPR-E3", "SPR-E4", "SPR-E5", "SPR-E6", "SPR-E7", "SPR-E8");
  spr.documentation.processDescription = "SHA inputs and SFR fragilities are integrated with seismic initiators, SEL development, adapted systems/event-sequence logic, HRA, and hazard-bin quantification.";
  spr.documentation.inputsDescription = "Controlled hazard intervals, spectra, fragility curves, SEL, internal-events models, success criteria, HRA, and retained secondary hazards.";
  spr.documentation.seismicEquipmentListDevelopment = "The SEL is reconciled to initiators, system logic, fragility scope, investigations, and retained secondary hazards.";
  spr.documentation.baseModelModifications = "Seismic initiators, conditional component failure, correlation, contact/interaction effects, mission times, and seismic-specific actions are added to the internal-events base.";
  spr.documentation.seismicHumanReliabilityInfluences = "Seismic cues, stress, workload, access, physical hazards, timing, training, and dependency are represented.";
  spr.documentation.quantificationMethods = "Mean hazard and fragility are integrated by converged hazard bins with joint parameter uncertainty and rare-event checks.";
  spr.documentation.eventSequenceFamilyResults = `${reactor} seismic challenge family mean frequency is ${isSfr ? "3.5E-5" : "2.6E-5"} per plant-year.`;
  spr.documentation.sensitivityStudyResults = "Fragility uncertainty and correlation change magnitude but not the leading risk insight.";
  spr.documentation.riskSignificantContributors = `${secondarySsc}, intermediate hazard bins, and the ex-control-room action are leading contributors.`;
  spr.documentation.modelUncertaintiesAndAlternatives = "Hazard, fragility, system dependency, HRA, and discretization alternatives are propagated or sensitivity tested.";
  spr.documentation.quantificationLimitations = ["Confirm final as-built configuration and complete the physical walkdown before operational use."];
  spr.documentation.dataModelAndCalculationRefs = ["SHA-RESULTS-2026.H5", "SFR-RESPONSE-RESULTS.H5", "SY-SEISMIC-MODEL", "SPR-QUANT-2026"];
  spr.documentation.traceability = [
    {
      initiatingEventRef: "INITIATOR-DIRECT-GROUND-MOTION",
      eventSequenceRefs: ["ES-SEISMIC-SUCCESS", "ES-SEISMIC-DAMAGE"],
      equipmentRefs: ["SEL-PRIMARY", "SEL-SECONDARY"],
      fragilityRefs: ["FRAGILITY-PRIMARY", "FRAGILITY-SECONDARY"],
      hazardRefs: ["HAZARD-CURVE-MEAN-1HZ", "UHS-1E-4-H", "DISCRETIZATION-1"],
      quantificationRef: "ESF-QUANT-1",
    },
    {
      initiatingEventRef: "INITIATOR-LIQUEFACTION",
      eventSequenceRefs: ["ES-SEISMIC-DAMAGE"],
      equipmentRefs: ["SEL-SECONDARY"],
      fragilityRefs: ["FRAGILITY-SECONDARY"],
      hazardRefs: ["SECONDARY-LIQUEFACTION"],
      quantificationRef: "ESF-QUANT-1",
    },
  ];
  spr.documentation.implementsSrs = srs("SPR-F1", "SPR-F2", "SPR-F3", "SPR-F4", "SPR-F5");

  mef.integration.interfaces = [
    { uuid: "IF-SHA-SFR", name: "Hazard-to-fragility interface", producer: "SHA", consumer: "SFR", payloadType: "RESPONSE_SPECTRUM", producerRefs: ["UHS-1E-4-H", "GMP-SA-1HZ", "CONTROL-POINT-FOUNDATION"], consumerRefs: ["REFERENCE-EQ-1", "STRUCTURAL-MODEL-1"], transferBasis: "Controlled spectra, motion definitions, control point, damping, and hazard range.", consistencyChecks: ["Parameter identifier resolves", "units and direction agree", "HROI lies within SHA range"], consistent: true, openItems: [], implementsSrs: srs("SHA-G1", "SFR-B1") },
    { uuid: "IF-SFR-SPR", name: "Fragility-to-plant-response interface", producer: "SFR", consumer: "SPR", payloadType: "FRAGILITY", producerRefs: ["FRAGILITY-PRIMARY", "FRAGILITY-SECONDARY", "CORR-COLOCATED-EQUIPMENT"], consumerRefs: ["INDUCED-FAILURE-1", "INDUCED-FAILURE-2", "ESF-QUANT-1"], transferBasis: "SEL item and failure-mode identifiers link mean fragilities and correlation to systems basic events.", consistencyChecks: ["Every active SEL failure mode has one controlling fragility", "correlation groups resolve"], consistent: true, openItems: [], implementsSrs: srs("SFR-E1", "SPR-B3") },
    { uuid: "IF-SHA-SPR", name: "Hazard-to-plant-response interface", producer: "SHA", consumer: "SPR", payloadType: "HAZARD_INTERVAL", producerRefs: sha.hazardQuantification.seismicPraInputs.hazardIntervals.map((item) => item.uuid), consumerRefs: ["DISCRETIZATION-1"], transferBasis: "Non-overlapping interval frequencies and representative motion values are transferred from the mean hazard curve.", consistencyChecks: ["Frequencies reconcile", "range reaches fragility saturation", "bin refinement converges"], consistent: true, openItems: [], implementsSrs: srs("SHA-F3", "SPR-E1") },
  ];
  mef.integration.consistencyChecks = [
    { uuid: "CHECK-GMP", name: "Ground-motion parameter consistency", checkType: "GROUND_MOTION_PARAMETER", subelements: ["SHA", "SFR", "SPR"], comparedRefs: ["GMP-SA-1HZ", "REFERENCE-EQ-1", "DISCRETIZATION-1"], method: "Compare identifier, definition, direction, units, frequency, damping, and use range.", result: "PASS", evidence: "All three subelements use geometric-mean horizontal SA at 1 Hz in g at the foundation control point.", openItems: [], implementsSrs: srs("SHA-A2", "SFR-B1", "SPR-E1") },
    { uuid: "CHECK-SEL", name: "Seismic equipment list coverage", checkType: "SEISMIC_EQUIPMENT_LIST", subelements: ["SFR", "SPR"], comparedRefs: ["SEL-2026", "FRAGILITY-PRIMARY", "FRAGILITY-SECONDARY"], method: "Resolve every active equipment failure mode through fragility and plant-response basic event.", result: "PASS", evidence: "Two active example SEL items have controlling fragilities and induced-failure models; thresholded scope is separately confirmed.", openItems: [], implementsSrs: srs("SFR-A1", "SPR-B1") },
    { uuid: "CHECK-SECONDARY", name: "Secondary-hazard consistency", checkType: "SECONDARY_HAZARD", subelements: ["SHA", "SFR", "SPR"], comparedRefs: ["SECONDARY-LIQUEFACTION", "MECHANISM-SECONDARY", "INITIATOR-LIQUEFACTION"], method: "Trace retained hazard through affected SSC, mechanism, fragility, initiating event, and sequence quantification.", result: "PASS", evidence: "The liquefaction mechanism is retained and fully traced through all three subelements.", openItems: [], implementsSrs: srs("SHA-I2", "SFR-E5", "SPR-A4") },
  ];
  mef.integration.coverage = {
    sprEquipmentCount: equipment.length,
    fragilityScopeEquipmentCount: equipment.length,
    quantifiedFragilityCount: sfr.results.fragilityEvaluations.length,
    unlinkedEquipmentRefs: [],
    unmodeledFailureModeRefs: [],
    retainedSecondaryHazardRefs: ["SECONDARY-LIQUEFACTION"],
    modeledSecondaryHazardRefs: ["SECONDARY-LIQUEFACTION"],
    coverageBasis: "Automated identifier reconciliation plus joint SHA/SFR/SPR technical review.",
  };
  mef.integration.selectedGroundMotionParameterRefs = ["GMP-SA-1HZ"];
  mef.integration.selectedControlPointRefs = ["CONTROL-POINT-FOUNDATION"];
  mef.integration.hazardCurveRefs = ["HAZARD-CURVE-MEAN-1HZ"];
  mef.integration.responseSpectrumRefs = ["UHS-1E-4-H"];
  mef.integration.hazardIntervalRefs = sha.hazardQuantification.seismicPraInputs.hazardIntervals.map((item) => item.uuid);
  mef.integration.seismicEquipmentListRef = "SEL-2026";
  mef.integration.fragilityResultRefs = ["FRAGILITY-PRIMARY", "FRAGILITY-SECONDARY"];
  mef.integration.eventSequenceFamilyQuantificationRefs = ["ESF-QUANT-1"];
  mef.integration.eventSequenceQuantificationRefs = ["ESQ-REFERENCE-MODEL"];
  mef.integration.riskIntegrationRefs = ["RI-SEISMIC-CONTRIBUTION"];
  mef.integration.integrationMethod = "Configuration-controlled identifiers, explicit producer/consumer records, automated coverage checks, and multidisciplinary review maintain SHA/SFR/SPR consistency.";
  mef.integration.unresolvedInterfaces = [];
  mef.integration.implementsSrs = srs("SHA-F3", "SFR-A1", "SPR-E1");
  mef.integratedUncertainties = [{
    uuid: "INT-UNCERTAINTY-1",
    name: "Ground motion, response, and capacity dependency",
    sourceSubelement: "SHA",
    sourceUncertaintyRef: "GM-LT-1",
    affectedSubelements: ["SHA", "SFR", "SPR"],
    affectedEventSequenceFamilyRefs: ["ESF-SEISMIC-DAMAGE"],
    uncertaintyType: "MODEL",
    dependencyAndCorrelationTreatment: "Common ground-motion branches are sampled consistently with response and fragility parameters; no double counting of ergodic site variability.",
    propagationOrSensitivityTreatment: "Propagated in the integrated uncertainty calculation and challenged with correlation sensitivities.",
    combinedEffect: "Sets the upper tail of seismic event-sequence-family frequency but does not change leading SSC ranking.",
    importance: ImportanceLevel.HIGH,
    sensitivityStudyRefs: ["SENS-FRAGILITY-BETA", "SENS-CORRELATION"],
    closureOrRefinementActions: ["Confirm final site profile and vendor capacity data"],
    implementsSrs: srs("SHA-F2", "SFR-E3", "SPR-E5"),
  }];
  mef.integratedSensitivityStudies = [...sfr.results.sensitivityStudies, ...spr.quantification.sensitivityStudies];
  mef.documentation.overallProcessDescription = "The Seismic PRA is one integrated technical element composed of SHA, SFR, and SPR, with controlled interfaces and shared identifiers from site characterization through risk insights.";
  mef.documentation.shaSummary = "Site-specific SSHAC Level 2 mean hazard, spectra, discretization, and retained secondary hazards.";
  mef.documentation.sfrSummary = "Median-centered response, investigations, explicit failure mechanisms, mean fragilities, uncertainty, and correlation.";
  mef.documentation.sprSummary = "Seismic initiators, reconciled SEL, adapted plant model and HRA, converged hazard-bin integration, and risk insights.";
  mef.documentation.subelementInterfaceDescription = "Three explicit producer-consumer records and three multidisciplinary consistency checks connect SHA, SFR, and SPR.";
  mef.documentation.integratedResultsSummary = spr.documentation.eventSequenceFamilyResults;
  mef.documentation.integratedRiskInsights = spr.documentation.riskSignificantContributors;
  mef.documentation.integratedUncertaintySummary = "Ground-motion median, site response, component capacity, and fragility correlation dominate integrated uncertainty.";
  mef.documentation.preOperationalAndBoundingSiteLimitations = "Complete final as-built configuration reconciliation, vendor record confirmation, and physical walkdown before operational use.";
  mef.documentation.configurationControlDescription = "Identifiers, input files, model revisions, calculations, evidence, and interface checks are maintained under the project configuration-control program.";
  mef.documentation.peerReviewBasis = {
    peerReviewIds: ["SEISMIC-PEER-REVIEW-2026"],
    systemsEngineeringCoverage: "Systems engineering and operations reviewers cover SEL completeness, failure effects, model logic, and risk insights.",
    seismicHazardCoverage: "Qualified hazard reviewers cover SSHAC process, source/ground-motion/site-response models, calculations, and secondary hazards.",
    seismicCapabilityCoverage: "Structural and equipment capability reviewers cover response, investigations, mechanisms, capacity, fragility, and correlation.",
    seismicPraCoverage: "Seismic PRA reviewers cover initiators, model adaptation, HRA, quantification, integration, and uncertainty.",
    fragilityWalkdownExperienceCoverage: "The team includes a seismic walkdown lead and equipment/civil capability specialists.",
    methodologyReviewScope: "The review addresses all 109 SHA, SFR, and SPR supporting requirements for CC-II pre-operational use.",
    openFindingRefs: ["PREOP-ASBUILT-WALKDOWN"],
  };
  mef.documentation.supportingDocumentRefs = ["SHA-REPORT-2026", "SFR-REPORT-2026", "SPR-REPORT-2026", "SEISMIC-INTEGRATION-REPORT-2026"];
  mef.documentation.traceabilityMatrix = [
    {
      requirement: "SHA-F3",
      subelement: "SHA",
      dataRefs: ["EARTH-SCIENCE-DATA-1"],
      modelRefs: ["SOURCE-LT-1", "GM-LT-1", "SITE-RESPONSE-METHOD-1"],
      resultRefs: ["HAZARD-CURVE-MEAN-1HZ", "UHS-1E-4-H"],
      documentationRefs: ["EVIDENCE-SHA-REPORT", "SHA-REPORT-2026"],
    },
    {
      requirement: "SFR-E1",
      subelement: "SFR",
      dataRefs: ["SEL-2026", "QUALIFICATION-PRIMARY", "CAPACITY-SECONDARY"],
      modelRefs: ["STRUCTURAL-MODEL-1", "MECHANISM-PRIMARY", "MECHANISM-SECONDARY"],
      resultRefs: ["FRAGILITY-PRIMARY", "FRAGILITY-SECONDARY"],
      documentationRefs: ["EVIDENCE-SFR-CALCS", "SFR-REPORT-2026"],
    },
    {
      requirement: "SPR-E1",
      subelement: "SPR",
      dataRefs: ["SEL-2026", "HAZARD-CURVE-MEAN-1HZ"],
      modelRefs: ["SY-SEISMIC-MODEL", "DISCRETIZATION-1"],
      resultRefs: ["ESF-QUANT-1", "CONTRIBUTOR-SECONDARY-SSC"],
      documentationRefs: ["EVIDENCE-SEL", "SPR-REPORT-2026", "SEISMIC-INTEGRATION-REPORT-2026"],
    },
  ];
  mef.configurationControlRecordId = `CC-SEISMIC-${kind.toUpperCase()}-2026`;
  mef.newlyDevelopedMethodIds = ["NM-SEISMIC-BIN-INTEGRATION"];
  mef.exampleDocuments = [
    { id: "DOC-SHA", name: `${reactor} seismic hazard report.pdf`, kind: "doc", sizeLabel: "8.4 MB", uploadedLabel: "Hazard team", extracted: "Site, source, ground-motion, response-spectrum, and secondary-hazard inputs", linked: 31 },
    { id: "DOC-SFR", name: `${reactor} seismic fragility calculations.xlsx`, kind: "sheet", sizeLabel: "4.7 MB", uploadedLabel: "Fragility team", extracted: "Response, capacity, beta, HCLPF, and fragility-curve records", linked: 18 },
    { id: "DOC-SEL", name: `${reactor} seismic equipment list.xlsx`, kind: "sheet", sizeLabel: "2.1 MB", uploadedLabel: "Systems team", extracted: "SSC scope, functions, failure modes, correlations, and dispositions", linked: 22 },
  ];

  mef.conformanceMatrix = mef.conformanceMatrix.map((row) => ({
    ...row,
    status: "MET",
    satisfiedByElementPaths: [row.sr.startsWith("SHA-") ? "seismicHazardAnalysis" : row.sr.startsWith("SFR-") ? "seismicFragilityAnalysis" : "seismicPlantResponseAnalysis"],
    evidence: `${row.sr} is implemented in the ${row.sr.startsWith("SHA-") ? "hazard" : row.sr.startsWith("SFR-") ? "fragility" : "plant-response"} models, calculations, interfaces, and traceable documentation for the ${reactor} example.`,
  }));

  return mef;
}
