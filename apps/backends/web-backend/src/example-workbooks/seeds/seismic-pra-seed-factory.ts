import { DistributionType } from "interfaces-mef-types/core/events";
import { type SRReference } from "interfaces-mef-types/core/pra-common";
import { ImportanceLevel } from "interfaces-mef-types/core/shared-patterns";
import { type SeismicPRA } from "interfaces-mef-types/seismic/seismic-pra";
import { createBlankSeismicPra } from "../../seismic-pra-workbooks/blank-seismic-pra";
import { populateHazardResults } from "./seismic-pra-hazard-results-seed";
import { populateSelAndResponse } from "./seismic-pra-sel-response-seed";
import { populateSecondaryHazards } from "./seismic-pra-secondary-hazards-seed";
import { populateSiteResponseAnalysis } from "./seismic-pra-site-response-seed";

type ReactorKind = "sfr" | "htgr";
type GroundMotionParameter = SeismicPRA["seismicHazardAnalysis"]["analysisBasis"]["groundMotionParameters"][number];
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
    implementsSrs: srs("SHA-A1"),
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
      inputs: ["CATALOG-1", "REGIONAL-FAULT-DB", `EARTH-DATA-${kind.toUpperCase()}-STRONG-MOTION`],
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
    implementsSrs: srs("SHA-A2"),
  };
  // NRC hazard evaluations use spectral control points at 1, 2.5, 5, 10, and
  // 25 Hz plus PGA; 0.5 Hz is retained for low-frequency structural response.
  const spectralFrequenciesHz = [0.5, 1, 2.5, 5, 10, 25] as const;
  const frequencyToken = (frequency: number): string => String(frequency).replace(".", "P");
  const spectralParameter = (
    direction: "GEOMETRIC_MEAN_HORIZONTAL" | "VERTICAL",
    frequency: number,
  ): GroundMotionParameter => {
    const isHorizontal = direction === "GEOMETRIC_MEAN_HORIZONTAL";
    const uuid = isHorizontal && frequency === 1
      ? "GMP-SA-1HZ"
      : `GMP-${isHorizontal ? "H" : "V"}-SA-${frequencyToken(frequency)}HZ`;
    return {
      uuid,
      name: `${isHorizontal ? "Geometric-mean horizontal" : "Vertical"} SA at ${frequency} Hz`,
      parameterType: "SPECTRAL_ACCELERATION",
      direction,
      units: "g",
      dampingRatio: 0.05,
      oscillatorPeriodSeconds: 1 / frequency,
      oscillatorFrequencyHz: frequency,
      componentDefinition: isHorizontal
        ? "Geometric mean of two orthogonal horizontal free-field components at the foundation control point."
        : "Vertical free-field component at the foundation control point.",
      selectedRange: { minimum: 0.005, maximum: isHorizontal ? 3 : 2.5 },
      selectedFrequencyRangeHz: { lower: frequency, upper: frequency },
      usedForHazard: true,
      usedForFragility: true,
      usedForPlantResponse: true,
      consistencyBasis: "The parameter identifier, component definition, damping, units, amplitude range, and frequency are shared by SHA, SFR, and SPR.",
      downstreamElementRefs: ["REFERENCE-EQ-1", "FRAGILITY-PRIMARY", "DISCRETIZATION-1"],
      implementsSrs: srs("SHA-A3", "SHA-A4"),
    };
  };
  const pgaParameter = (direction: "GEOMETRIC_MEAN_HORIZONTAL" | "VERTICAL"): GroundMotionParameter => {
    const isHorizontal = direction === "GEOMETRIC_MEAN_HORIZONTAL";
    return {
      uuid: `GMP-${isHorizontal ? "H" : "V"}-PGA`,
      name: `${isHorizontal ? "Geometric-mean horizontal" : "Vertical"} PGA`,
      parameterType: "PEAK_GROUND_ACCELERATION",
      direction,
      units: "g",
      componentDefinition: isHorizontal
        ? "Geometric mean of two orthogonal horizontal free-field peak accelerations at the foundation control point."
        : "Vertical free-field peak acceleration at the foundation control point.",
      selectedRange: { minimum: 0.005, maximum: isHorizontal ? 2 : 1.5 },
      selectedFrequencyRangeHz: { lower: 100, upper: 100 },
      usedForHazard: true,
      usedForFragility: true,
      usedForPlantResponse: true,
      consistencyBasis: "PGA is represented by the 100 Hz rigid-response control point and shared by SHA, SFR, and SPR.",
      downstreamElementRefs: ["REFERENCE-EQ-1", "FRAGILITY-PRIMARY", "DISCRETIZATION-1"],
      implementsSrs: srs("SHA-A3", "SHA-A4"),
    };
  };
  sha.analysisBasis.groundMotionParameters = [
    ...spectralFrequenciesHz.map((frequency) => spectralParameter("GEOMETRIC_MEAN_HORIZONTAL", frequency)),
    pgaParameter("GEOMETRIC_MEAN_HORIZONTAL"),
    ...spectralFrequenciesHz.map((frequency) => spectralParameter("VERTICAL", frequency)),
    pgaParameter("VERTICAL"),
  ];
  sha.analysisBasis.calculationBounds = {
    maximumGroundMotion: 3,
    groundMotionUnits: "g",
    tailExtrapolationMethod: "Log-linear extrapolation of the terminal three hazard points, checked against branch calculations.",
    truncationImpactEvaluation: "Extending the upper bound to 4 g changes total seismic risk by less than one percent.",
    sequenceRankingUnaffected: true,
    lowerBoundMagnitude: 4.5,
    magnitudeScale: "Mw",
    lowerBoundMagnitudeBasis: "Earthquakes below Mw 4.5 are not expected to damage the engineered SSCs included in the PRA.",
    epsilonLimit: 3,
    epsilonTailTreatment: "Truncated-normal residual with branch sensitivity at epsilon 4.",
    epsilonLimitBasis: "An epsilon-4 sensitivity case confirms that truncation at epsilon 3 adequately represents the aleatory tail in the risk-significant range.",
    implementsSrs: srs("SHA-A5", "SHA-A6", "SHA-A7"),
  };
  sha.earthScienceInputs.dataSets = [
    {
      uuid: `EARTH-DATA-${kind.toUpperCase()}-GEOLOGY`,
      name: "Regional tectonic and Quaternary fault mapping",
      discipline: "GEOLOGY",
      sourceOrganization: "U.S. Geological Survey and state geological surveys",
      sourceReference: `SHA-${kind.toUpperCase()}-GEOLOGY-2026`,
      publicationOrAcquisitionDate: "2025-11-14",
      dataCutoffDate: "2026-01-31",
      spatialCoverage: "Regional study area to 500 km and mapped Quaternary faults within 200 km",
      temporalCoverage: "Quaternary through present",
      resolution: "1:24,000 locally to 1:250,000 regionally",
      format: "GIS fault traces, geologic maps, and technical reports",
      qualityAndLimitations: "Mapping scale and fault-location uncertainty are retained in alternative source geometries.",
      currentnessAssessment: "Agency releases and map revisions were reviewed through the compilation cutoff.",
      interpretationsSupported: ["Tectonic setting", "fault geometry", "source segmentation"],
      fileReference: "SHA-DATA-ROOM/GEOLOGY",
      implementsSrs: srs("SHA-B1", "SHA-B2"),
    },
    {
      uuid: `EARTH-DATA-${kind.toUpperCase()}-SEISMOLOGY`,
      name: "Historical and instrumental seismicity compilation",
      discipline: "SEISMOLOGY",
      sourceOrganization: "U.S. Geological Survey and regional seismic networks",
      sourceReference: `SHA-${kind.toUpperCase()}-SEISMOLOGY-2026`,
      publicationOrAcquisitionDate: "2026-01-31",
      dataCutoffDate: "2026-01-31",
      spatialCoverage: "Regional study area to 500 km",
      temporalCoverage: "1800 through 2026",
      resolution: "Event-level origin, magnitude, and uncertainty",
      format: "Catalog database and reviewed historical-event files",
      qualityAndLimitations: "Pre-instrumental locations and magnitudes carry event-specific or period-dependent uncertainty.",
      currentnessAssessment: "Network catalogs and agency event solutions were reconciled through the cutoff date.",
      interpretationsSupported: ["Recurrence", "seismicity patterns", "source association"],
      fileReference: "SHA-DATA-ROOM/SEISMOLOGY",
      implementsSrs: srs("SHA-B1", "SHA-B2", "SHA-B5"),
    },
    {
      uuid: `EARTH-DATA-${kind.toUpperCase()}-GEOPHYSICS`,
      name: "Crustal geophysics and tectonic framework",
      discipline: "GEOPHYSICS",
      sourceOrganization: "National geophysical data centers and university programs",
      sourceReference: `SHA-${kind.toUpperCase()}-GEOPHYSICS-2025`,
      publicationOrAcquisitionDate: "2025-09-30",
      dataCutoffDate: "2026-01-31",
      spatialCoverage: "Regional crustal domain and site vicinity",
      temporalCoverage: "Current interpreted geophysical surveys",
      resolution: "Regional gravity and magnetics with local seismic-refraction constraints",
      format: "Grids, profiles, interpreted horizons, and reports",
      qualityAndLimitations: "Non-unique geophysical interpretations are represented through alternative tectonic models.",
      currentnessAssessment: "Available gravity, magnetic, heat-flow, and crustal-thickness updates were reviewed.",
      interpretationsSupported: ["Crustal structure", "tectonic domains", "regional propagation"],
      fileReference: "SHA-DATA-ROOM/GEOPHYSICS",
      implementsSrs: srs("SHA-B1", "SHA-B3"),
    },
    {
      uuid: `EARTH-DATA-${kind.toUpperCase()}-GEOTECHNICAL`,
      name: "Site borings and laboratory material testing",
      discipline: "GEOTECHNICAL",
      sourceOrganization: `${reactor} geotechnical investigation program`,
      sourceReference: `SHA-${kind.toUpperCase()}-GEOTECH-REV2`,
      publicationOrAcquisitionDate: "2025-12-18",
      dataCutoffDate: "2026-01-31",
      spatialCoverage: "Plant footprint and safety-related building foundations",
      temporalCoverage: "2024 to 2025 field investigation",
      resolution: "Boring and sample intervals to engineering-unit scale",
      format: "Boring logs, laboratory results, and geotechnical data tables",
      qualityAndLimitations: "Final excavation observations remain a pre-operational confirmation item.",
      currentnessAssessment: "Revision 2 includes all accepted borings and laboratory tests available at cutoff.",
      interpretationsSupported: ["Foundation stratigraphy", "material properties", "site-response profiles"],
      fileReference: "SHA-DATA-ROOM/GEOTECHNICAL",
      implementsSrs: srs("SHA-B1", "SHA-B3"),
    },
    {
      uuid: `EARTH-DATA-${kind.toUpperCase()}-TOPOGRAPHY`,
      name: "Site topography and surficial geology",
      discipline: "TOPOGRAPHY",
      sourceOrganization: "Plant survey program and state geological survey",
      sourceReference: `SHA-${kind.toUpperCase()}-TOPO-SURFICIAL-2025`,
      publicationOrAcquisitionDate: "2025-10-22",
      dataCutoffDate: "2026-01-31",
      spatialCoverage: "Site drainage basin and 20 km site vicinity",
      temporalCoverage: "2025 survey surface",
      resolution: "One-meter lidar with field-checked surficial mapping",
      format: "Digital elevation model, contours, and surficial-geology GIS",
      qualityAndLimitations: "Vegetation and planned grading are addressed by field checks and design-surface comparisons.",
      currentnessAssessment: "The latest accepted lidar, grading plan, and geomorphic review are included.",
      interpretationsSupported: ["Topographic response", "surface processes", "secondary-hazard screening"],
      fileReference: "SHA-DATA-ROOM/TOPOGRAPHY",
      implementsSrs: srs("SHA-B1", "SHA-B3"),
    },
    {
      uuid: `EARTH-DATA-${kind.toUpperCase()}-PALEO`,
      name: "Paleoseismic fault investigations",
      discipline: "PALEOSEISMOLOGY",
      sourceOrganization: "U.S. Geological Survey, state surveys, and published trench studies",
      sourceReference: `SHA-${kind.toUpperCase()}-PALEO-2025`,
      publicationOrAcquisitionDate: "2025-08-15",
      dataCutoffDate: "2026-01-31",
      spatialCoverage: "Risk-relevant Quaternary faults within the regional study area",
      temporalCoverage: "Late Quaternary event history",
      resolution: "Event ages, displacement per event, and recurrence intervals",
      format: "Trench logs, chronologic data, slip-rate compilations, and reports",
      qualityAndLimitations: "Sparse event chronologies and dating ranges are retained as epistemic alternatives.",
      currentnessAssessment: "Published investigations and agency fault-database updates were reviewed through cutoff.",
      interpretationsSupported: ["Maximum magnitude", "slip rate", "recurrence", "paleoseismic catalog"],
      fileReference: "SHA-DATA-ROOM/PALEOSEISMOLOGY",
      implementsSrs: srs("SHA-B1", "SHA-B2", "SHA-B5"),
    },
    {
      uuid: `EARTH-DATA-${kind.toUpperCase()}-STRONG-MOTION`,
      name: "Strong-motion recordings and ground-motion database",
      discipline: "STRONG_MOTION",
      sourceOrganization: "National strong-motion programs and peer-reviewed databases",
      sourceReference: `SHA-${kind.toUpperCase()}-STRONG-MOTION-2026`,
      publicationOrAcquisitionDate: "2026-01-20",
      dataCutoffDate: "2026-01-31",
      spatialCoverage: "Applicable tectonic regions and site-condition ranges",
      temporalCoverage: "1933 through 2025",
      resolution: "Three-component recordings with event, path, and site metadata",
      format: "Processed accelerograms and flatfile metadata",
      qualityAndLimitations: "Sparse near-source records at the highest magnitudes are addressed through model uncertainty.",
      currentnessAssessment: "Accepted database releases and applicable new recordings were screened through cutoff.",
      interpretationsSupported: ["Ground-motion model selection", "regional adjustment", "vertical motion"],
      fileReference: "SHA-DATA-ROOM/STRONG-MOTION",
      implementsSrs: srs("SHA-B1", "SHA-B3", "SHA-B4"),
    },
    {
      uuid: `EARTH-DATA-${kind.toUpperCase()}-VELOCITY`,
      name: "Shear-wave velocity, density, and damping profiles",
      discipline: "GEOTECHNICAL",
      sourceOrganization: `${reactor} site-characterization program`,
      sourceReference: `SHA-${kind.toUpperCase()}-VELOCITY-PROFILES-REV1`,
      publicationOrAcquisitionDate: "2025-12-20",
      dataCutoffDate: "2026-01-31",
      spatialCoverage: "Reference rock horizon through foundation elevations",
      temporalCoverage: "2024 to 2025 field and laboratory program",
      resolution: "Layer-specific velocity, density, modulus-reduction, and damping data",
      format: "Downhole surveys, surface-wave testing, and laboratory curves",
      qualityAndLimitations: "Spatial variability is represented by weighted lower, best-estimate, and upper profiles.",
      currentnessAssessment: "All accepted field and laboratory results available at cutoff are incorporated.",
      interpretationsSupported: ["Reference horizon", "site-response uncertainty", "foundation input motion"],
      fileReference: "SHA-DATA-ROOM/VELOCITY",
      implementsSrs: srs("SHA-B1", "SHA-B3"),
    },
  ];
  sha.earthScienceInputs.studyRegions = [{
    uuid: "STUDY-REGION-1",
    name: "Regional seismic study area",
    boundaryDescription: "A 500 km regional source study area with focused propagation review within 200 km and local characterization within 50 km.",
    radialExtentKm: 500,
    tectonicSetting: isSfr ? "Basin-and-range extension with distributed crustal faulting" : "Stable continental interior adjacent to the Intermountain seismic belt",
    includedSourceRegions: ["LOCAL-FAULT-ZONE", "REGIONAL-BACKGROUND"],
    majorContributorCoverageBasis: "Deaggregation confirms all sources contributing more than one percent are within the study region.",
    regionalPropagationDataSufficiency: "Regional strong-motion data are supplemented by applicable NGA data.",
    localSiteEffectsDataSufficiency: "Borehole velocities and laboratory curves support the weighted site profiles.",
    uncertaintyCoverageBasis: "Alternative boundaries and recurrence models are represented in the source logic tree.",
    mapReference: "SHA-MAP-01",
    implementsSrs: srs("SHA-B2", "SHA-B3"),
  }];
  sha.earthScienceInputs.earthquakeCatalog = {
    ...sha.earthScienceInputs.earthquakeCatalog,
    uuid: "CATALOG-1",
    name: "Homogenized earthquake catalog",
    catalogStartDateOrAge: "15 ka BP",
    catalogEndDate: "2026-01-31",
    magnitudeScales: ["Mw", "ML", "mb"],
    homogenizationMethod: "Published regional conversions to Mw with conversion uncertainty retained.",
    declusteringMethod: "Reasenberg declustering with window sensitivity.",
    completenessAssessment: "Stepp-style assessment by magnitude band and source region.",
    locationAndMagnitudeUncertaintyTreatment: "Event-specific uncertainty where available and period-dependent defaults otherwise.",
    duplicateResolutionMethod: "Agency priority hierarchy followed by record-level reconciliation.",
    events: isSfr
      ? [
        { uuid: "EQ-SFR-HIST-1916", recordType: "HISTORICAL", eventDateOrAge: "1916-07-12", locationDescription: "Southern Idaho historical earthquake", magnitude: 6.1, magnitudeScale: "Mw", magnitudeUncertainty: 0.35, sourceReferences: ["STATE-HISTORICAL-CATALOG"], qualityFlags: ["HISTORICAL-REVIEWED"] },
        { uuid: "EQ-SFR-HIST-1944", recordType: "HISTORICAL", eventDateOrAge: "1944-07-12", locationDescription: "Intermountain historical reference earthquake", magnitude: 6.1, magnitudeScale: "Mw", magnitudeUncertainty: 0.25, sourceReferences: ["USGS-HISTORICAL-CATALOG"], qualityFlags: ["HISTORICAL-REVIEWED"] },
        { uuid: "EQ-SFR-INST-1983", recordType: "INSTRUMENTAL", eventDateOrAge: "1983-10-28", locationDescription: "Borah Peak earthquake", magnitude: 6.9, magnitudeScale: "Mw", magnitudeUncertainty: 0.1, depthKm: 16, depthUncertaintyKm: 2, sourceReferences: ["USGS-COMCAT"], qualityFlags: ["REVIEWED"] },
        { uuid: "EQ-SFR-INST-2020", recordType: "INSTRUMENTAL", eventDateOrAge: "2020-03-31", locationDescription: "Stanley earthquake", magnitude: 6.5, magnitudeScale: "Mw", magnitudeUncertainty: 0.08, depthKm: 12, depthUncertaintyKm: 2, sourceReferences: ["USGS-COMCAT"], qualityFlags: ["REVIEWED"] },
        { uuid: "EQ-SFR-PALEO-LOST-RIVER", recordType: "PALEOSEISMIC", eventDateOrAge: "6.9 ka BP", locationDescription: "Lost River fault paleoseismic event", magnitude: 7.1, magnitudeScale: "Mw", magnitudeUncertainty: 0.3, sourceReferences: ["USGS-QUATERNARY-FAULT-DB", "PUBLISHED-TRENCH-STUDY"], qualityFlags: ["AGE-RANGE"] },
        { uuid: "EQ-SFR-PALEO-LEMHI", recordType: "PALEOSEISMIC", eventDateOrAge: "15 ka BP", locationDescription: "Lemhi fault paleoseismic event", magnitude: 6.9, magnitudeScale: "Mw", magnitudeUncertainty: 0.35, sourceReferences: ["USGS-QUATERNARY-FAULT-DB"], qualityFlags: ["AGE-RANGE"] },
      ]
      : [
        { uuid: "EQ-HTGR-HIST-1887", recordType: "HISTORICAL", eventDateOrAge: "1887-05-03", locationDescription: "Northern Sonora historical earthquake", magnitude: 7.5, magnitudeScale: "Mw", magnitudeUncertainty: 0.3, sourceReferences: ["USGS-HISTORICAL-CATALOG"], qualityFlags: ["HISTORICAL-REVIEWED"] },
        { uuid: "EQ-HTGR-HIST-1906", recordType: "HISTORICAL", eventDateOrAge: "1906-11-15", locationDescription: "Regional historical reference earthquake", magnitude: 6.2, magnitudeScale: "Mw", magnitudeUncertainty: 0.35, sourceReferences: ["STATE-HISTORICAL-CATALOG"], qualityFlags: ["HISTORICAL-REVIEWED"] },
        { uuid: "EQ-HTGR-INST-1959", recordType: "INSTRUMENTAL", eventDateOrAge: "1959-08-18", locationDescription: "Intermountain reference earthquake", magnitude: 7.2, magnitudeScale: "Mw", magnitudeUncertainty: 0.15, depthKm: 10, depthUncertaintyKm: 3, sourceReferences: ["USGS-COMCAT"], qualityFlags: ["REVIEWED"] },
        { uuid: "EQ-HTGR-INST-1992", recordType: "INSTRUMENTAL", eventDateOrAge: "1992-06-28", locationDescription: "Southwestern United States reference earthquake", magnitude: 7.3, magnitudeScale: "Mw", magnitudeUncertainty: 0.1, depthKm: 8, depthUncertaintyKm: 2, sourceReferences: ["USGS-COMCAT"], qualityFlags: ["REVIEWED"] },
        { uuid: "EQ-HTGR-PALEO-LOCAL", recordType: "PALEOSEISMIC", eventDateOrAge: "4.2 ka BP", locationDescription: "Local fault-zone paleoseismic event", magnitude: 6.8, magnitudeScale: "Mw", magnitudeUncertainty: 0.35, sourceReferences: ["PUBLISHED-TRENCH-STUDY"], qualityFlags: ["AGE-RANGE"] },
        { uuid: "EQ-HTGR-PALEO-REGIONAL", recordType: "PALEOSEISMIC", eventDateOrAge: "11 ka BP", locationDescription: "Regional fault-system paleoseismic event", magnitude: 7, magnitudeScale: "Mw", magnitudeUncertainty: 0.4, sourceReferences: ["USGS-QUATERNARY-FAULT-DB"], qualityFlags: ["AGE-RANGE"] },
      ],
    sourceReferences: ["USGS-COMCAT", "USGS-HISTORICAL-CATALOG", "STATE-HISTORICAL-CATALOG", "USGS-QUATERNARY-FAULT-DB"],
    implementsSrs: srs("SHA-B2", "SHA-B3", "SHA-B5"),
  };
  sha.earthScienceInputs.modelAndMethodInventory = [
    {
      uuid: `EARTH-SOURCE-${kind.toUpperCase()}-REGIONAL-SSC`,
      name: "Regional seismic-source characterization model",
      modelKind: "SEISMIC_SOURCE",
      version: "2025.1",
      publicationDate: "2025-10-15",
      sourceReference: `SHA-${kind.toUpperCase()}-SSC-MODEL-2025`,
      applicability: `Defines fault and background-source alternatives for the ${site} study region.`,
      limitations: ["Sparse paleoseismic constraints on selected fault recurrence rates"],
      knownToExistingAnalysis: true,
      previouslyUsed: true,
      potentialImpactOnHazard: "Controls source geometry, recurrence, and maximum-magnitude branches.",
      disposition: "INCLUDED",
      dispositionBasis: "Current data and alternative interpretations are incorporated in the source logic tree.",
      implementsSrs: srs("SHA-B4"),
    },
    {
      uuid: `EARTH-SOURCE-${kind.toUpperCase()}-NATIONAL-UPDATE`,
      name: "National seismic-source model update",
      modelKind: "SEISMIC_SOURCE",
      version: "2025",
      publicationDate: "2025-12-01",
      sourceReference: "NATIONAL-SEISMIC-SOURCE-MODEL-2025",
      applicability: "Provides new regional source boundaries, recurrence parameters, and background seismicity rates.",
      limitations: ["National-scale resolution requires site-region evaluation"],
      knownToExistingAnalysis: false,
      previouslyUsed: false,
      potentialImpactOnHazard: "Could change low-frequency hazard and background-source contributions.",
      disposition: "INCLUDED",
      dispositionBasis: "Differences were evaluated and incorporated where they expand the technically defensible range.",
      implementsSrs: srs("SHA-B4"),
    },
    {
      uuid: `EARTH-SOURCE-${kind.toUpperCase()}-GMM`,
      name: "Applicable ground-motion model suite",
      modelKind: "GROUND_MOTION",
      version: "2025.2",
      publicationDate: "2025-11-20",
      sourceReference: `SHA-${kind.toUpperCase()}-GMM-SUITE-2025`,
      applicability: "Covers applicable tectonic regimes, magnitude-distance ranges, and reference-site conditions.",
      limitations: ["Sparse observations at the upper magnitude and motion range"],
      knownToExistingAnalysis: true,
      previouslyUsed: true,
      potentialImpactOnHazard: "Controls median motion, aleatory variability, and epistemic model spread.",
      disposition: "INCLUDED",
      dispositionBasis: "Models pass applicability, independence, and data-support screening.",
      implementsSrs: srs("SHA-B3", "SHA-B4"),
    },
    {
      uuid: `EARTH-SOURCE-${kind.toUpperCase()}-PROPAGATION`,
      name: "Regional propagation adjustment model",
      modelKind: "REGIONAL_PROPAGATION",
      version: "1.1",
      publicationDate: "2025-06-30",
      sourceReference: `SHA-${kind.toUpperCase()}-PROPAGATION-1.1`,
      applicability: "Represents path attenuation and crustal effects across the regional study area.",
      limitations: ["Limited recordings for the longest source-to-site paths"],
      knownToExistingAnalysis: false,
      previouslyUsed: false,
      potentialImpactOnHazard: "Primarily affects high-frequency motion from regional sources.",
      disposition: "INCLUDED",
      dispositionBasis: "Sensitivity results show a material but bounded effect in risk-significant frequency ranges.",
      implementsSrs: srs("SHA-B3", "SHA-B4"),
    },
    {
      uuid: `EARTH-SOURCE-${kind.toUpperCase()}-SITE-RESPONSE`,
      name: "Equivalent-linear site-response method",
      modelKind: "SITE_RESPONSE",
      version: "2024.3",
      publicationDate: "2024-09-12",
      sourceReference: `SHA-${kind.toUpperCase()}-SITE-RESPONSE-2024`,
      applicability: "Calculates one-dimensional response for the weighted site profiles and reference-rock motions.",
      limitations: ["One-dimensional treatment does not explicitly model localized three-dimensional geometry"],
      knownToExistingAnalysis: true,
      previouslyUsed: true,
      potentialImpactOnHazard: "Controls surface amplification, deamplification, and site-response uncertainty.",
      disposition: "INCLUDED",
      dispositionBasis: "Site geometry and sensitivity checks support the selected method for the reference analysis.",
      implementsSrs: srs("SHA-B3", "SHA-B4"),
    },
    {
      uuid: `EARTH-SOURCE-${kind.toUpperCase()}-BASIN-SCREEN`,
      name: "Three-dimensional basin-response screening method",
      modelKind: "SITE_RESPONSE",
      version: "2025.1",
      publicationDate: "2025-03-05",
      sourceReference: `SHA-${kind.toUpperCase()}-3D-BASIN-SCREEN-2025`,
      applicability: "Screens whether basin-edge or topographic effects require explicit multidimensional analysis.",
      limitations: ["Screening-level spatial resolution"],
      knownToExistingAnalysis: false,
      previouslyUsed: false,
      potentialImpactOnHazard: "Could affect narrow-band amplification if multidimensional effects are significant.",
      disposition: "BOUNDED_BY_EXISTING_MODEL",
      dispositionBasis: "Screening results remain within the weighted site-response profile range.",
      implementsSrs: srs("SHA-B3", "SHA-B4"),
    },
  ];
  sha.earthScienceInputs.dataGapAssessment = "No gap was identified that prevents a CC-II hazard analysis; paleoseismic recurrence remains an explicit epistemic uncertainty.";
  sha.earthScienceInputs.subjectMatterExpertReview = "Geology, seismology, geophysics, and geotechnical specialists reviewed data quality and interpretations.";
  sha.earthScienceInputs.compilationCutoffDate = "2026-01-31";
  sha.earthScienceInputs.implementsSrs = srs("SHA-B1", "SHA-B2", "SHA-B3", "SHA-B4", "SHA-B5");
  const earthDataPrefix = `EARTH-DATA-${kind.toUpperCase()}`;
  const sourceModelRef = `SOURCE-MODEL-${kind.toUpperCase()}-2026`;
  const groundMotionParameterRefs = sha.analysisBasis.groundMotionParameters.map((parameter) => parameter.uuid);
  const localSourceId = `SOURCE-${kind.toUpperCase()}-LOCAL-FAULT`;
  const regionalSourceId = `SOURCE-${kind.toUpperCase()}-REGIONAL-FAULT`;
  const backgroundSourceId = `SOURCE-${kind.toUpperCase()}-BACKGROUND`;
  const distalSourceId = `SOURCE-${kind.toUpperCase()}-DISTAL`;
  const localPaleoseismicRefs = isSfr ? ["EQ-SFR-PALEO-LOST-RIVER"] : ["EQ-HTGR-PALEO-LOCAL"];
  const regionalPaleoseismicRefs = isSfr ? ["EQ-SFR-PALEO-LEMHI"] : ["EQ-HTGR-PALEO-REGIONAL"];
  const instrumentalEventRefs = isSfr
    ? ["EQ-SFR-INST-1983", "EQ-SFR-INST-2020"]
    : ["EQ-HTGR-INST-1959", "EQ-HTGR-INST-1992"];

  sha.sourceCharacterization.structuredApproach = "A SSHAC Level 2 evaluation integrates mapped faults, seismicity, paleoseismic constraints, tectonic analogs, and alternative recurrence models.";
  sha.sourceCharacterization.earthquakeSources = [
    {
      uuid: localSourceId,
      name: isSfr ? "Lost River fault system" : "Cedar Basin local fault zone",
      sourceType: "FAULT",
      tectonicRegionType: "Active shallow crust",
      active: true,
      faultMechanisms: ["NORMAL", "OBLIQUE"],
      geometry: {
        geometryType: "PLANE",
        geometryDescription: "Segmented fault plane with connected and independent rupture alternatives.",
        coordinateReferenceSystem: "EPSG:4326",
        geometryFileRef: `SHA-${kind.toUpperCase()}-LOCAL-FAULT-GEOMETRY.gpkg`,
        closestDistanceToSiteKm: isSfr ? 18 : 32,
        depthRangeKm: { minimum: 0, maximum: 18 },
        strikeDegrees: isSfr ? 327 : 342,
        dipDegrees: isSfr ? 52 : 55,
        uncertaintyDescription: "Trace location, dip, down-dip width, and segmentation are represented by coupled geometry branches.",
      },
      magnitudeFrequencyModels: [
        {
          uuid: `MFD-${kind.toUpperCase()}-LOCAL-GR`,
          name: "Truncated Gutenberg-Richter recurrence",
          modelType: "GUTENBERG_RICHTER",
          minimumMagnitude: 4.5,
          maximumMagnitude: isSfr ? 7.4 : 7.25,
          magnitudeScale: "Mw",
          annualRateAboveMinimum: isSfr ? 0.021 : 0.018,
          aValue: isSfr ? 2.18 : 2.1,
          bValue: isSfr ? 0.88 : 0.92,
          parameterDistributions: {
            bValue: { type: DistributionType.NORMAL, mean: isSfr ? 0.88 : 0.92, stdDev: 0.08 },
            maximumMagnitude: { type: DistributionType.UNIFORM, lower: isSfr ? 7.1 : 7, upper: isSfr ? 7.6 : 7.5 },
          },
          dataAndMethodBasis: "Instrumental seismicity, mapped fault dimensions, slip rate, and paleoseismic event ages are jointly evaluated.",
        },
        {
          uuid: `MFD-${kind.toUpperCase()}-LOCAL-RENEWAL`,
          name: "Paleoseismic renewal recurrence",
          modelType: "RENEWAL",
          minimumMagnitude: 6.5,
          maximumMagnitude: isSfr ? 7.5 : 7.3,
          magnitudeScale: "Mw",
          recurrenceIntervalYears: isSfr ? 650 : 950,
          parameterDistributions: {
            recurrenceIntervalYears: { type: DistributionType.LOGNORMAL, median: isSfr ? 650 : 950, errorFactor: 1.6 },
          },
          dataAndMethodBasis: "Elapsed time, event chronology, and slip-per-event constraints define the renewal alternative.",
        },
      ],
      paleoseismicEventRefs: localPaleoseismicRefs,
      historicalAndInstrumentalEventRefs: instrumentalEventRefs,
      sourceDataRefs: [`${earthDataPrefix}-GEOLOGY`, `${earthDataPrefix}-SEISMOLOGY`, `${earthDataPrefix}-PALEO`],
      majorHazardContributor: true,
      characterizationBasis: "Mapped Quaternary faulting, seismicity, deformation rates, and paleoseismic recurrence constrain the local source.",
      uncertainties: ["Fault segmentation", "down-dip width", "maximum magnitude", "slip rate", "recurrence model"],
      implementsSrs: srs("SHA-C1", "SHA-C2", "SHA-C3", "SHA-C4"),
    },
    {
      uuid: regionalSourceId,
      name: isSfr ? "Lemhi fault system" : "Intermountain seismic belt source region",
      sourceType: isSfr ? "FAULT" : "AREA",
      tectonicRegionType: "Active shallow crust",
      active: true,
      faultMechanisms: ["NORMAL", "OBLIQUE"],
      geometry: {
        geometryType: isSfr ? "PLANE" : "AREA",
        geometryDescription: isSfr
          ? "Multi-segment normal-fault plane with alternate rupture connectivity."
          : "Distributed active-crustal source region encompassing the nearest Intermountain seismic belt structures.",
        coordinateReferenceSystem: "EPSG:4326",
        geometryFileRef: `SHA-${kind.toUpperCase()}-REGIONAL-SOURCE-GEOMETRY.gpkg`,
        closestDistanceToSiteKm: isSfr ? 44 : 86,
        depthRangeKm: { minimum: 0, maximum: 22 },
        strikeDegrees: isSfr ? 332 : undefined,
        dipDegrees: isSfr ? 50 : undefined,
        uncertaintyDescription: "Boundary placement, segmentation, seismogenic depth, and activity allocation vary across logic-tree branches.",
      },
      magnitudeFrequencyModels: [
        {
          uuid: `MFD-${kind.toUpperCase()}-REGIONAL-GR`,
          name: "Regional Gutenberg-Richter recurrence",
          modelType: "GUTENBERG_RICHTER",
          minimumMagnitude: 4.5,
          maximumMagnitude: isSfr ? 7.35 : 7.5,
          magnitudeScale: "Mw",
          annualRateAboveMinimum: isSfr ? 0.016 : 0.024,
          aValue: isSfr ? 2.02 : 2.24,
          bValue: isSfr ? 0.9 : 0.96,
          parameterDistributions: {
            bValue: { type: DistributionType.NORMAL, mean: isSfr ? 0.9 : 0.96, stdDev: 0.1 },
          },
          dataAndMethodBasis: "Catalog completeness intervals and geologic deformation rates constrain the regional recurrence model.",
        },
        {
          uuid: `MFD-${kind.toUpperCase()}-REGIONAL-CHAR`,
          name: "Characteristic earthquake alternative",
          modelType: "CHARACTERISTIC",
          minimumMagnitude: 6.7,
          maximumMagnitude: isSfr ? 7.45 : 7.6,
          magnitudeScale: "Mw",
          recurrenceIntervalYears: isSfr ? 1100 : 1450,
          dataAndMethodBasis: "Mapped rupture dimensions and regional fault analogs define the characteristic alternative.",
        },
      ],
      paleoseismicEventRefs: regionalPaleoseismicRefs,
      historicalAndInstrumentalEventRefs: instrumentalEventRefs,
      sourceDataRefs: [`${earthDataPrefix}-GEOLOGY`, `${earthDataPrefix}-SEISMOLOGY`, `${earthDataPrefix}-GEOPHYSICS`, `${earthDataPrefix}-PALEO`],
      majorHazardContributor: true,
      characterizationBasis: "Regional tectonic framework, catalog seismicity, geophysics, and mapped fault dimensions define the source alternatives.",
      uncertainties: ["Source boundary", "rupture connectivity", "maximum magnitude", "activity rate allocation"],
      implementsSrs: srs("SHA-C1", "SHA-C2", "SHA-C3", "SHA-C4"),
    },
    {
      uuid: backgroundSourceId,
      name: isSfr ? "Basin and Range background seismicity" : "Cedar Basin background seismicity",
      sourceType: "BACKGROUND",
      tectonicRegionType: isSfr ? "Basin and Range active crust" : "Stable continental and transitional crust",
      active: true,
      faultMechanisms: isSfr ? ["NORMAL", "OBLIQUE", "UNKNOWN"] : ["STRIKE_SLIP", "NORMAL", "UNKNOWN"],
      geometry: {
        geometryType: "VOLUME",
        geometryDescription: "Smoothed seismicity volume after removal of events assigned to modeled faults.",
        coordinateReferenceSystem: "EPSG:4326",
        geometryFileRef: `SHA-${kind.toUpperCase()}-BACKGROUND-RATES.nc`,
        closestDistanceToSiteKm: 0,
        depthRangeKm: { minimum: 3, maximum: isSfr ? 24 : 28 },
        uncertaintyDescription: "Smoothing bandwidth, completeness intervals, depth distribution, and fault-event allocation are varied.",
      },
      magnitudeFrequencyModels: [{
        uuid: `MFD-${kind.toUpperCase()}-BACKGROUND-GR`,
        name: "Smoothed-seismicity Gutenberg-Richter model",
        modelType: "GUTENBERG_RICHTER",
        minimumMagnitude: 4.5,
        maximumMagnitude: isSfr ? 6.8 : 6.9,
        magnitudeScale: "Mw",
        annualRateAboveMinimum: isSfr ? 0.034 : 0.019,
        aValue: isSfr ? 2.44 : 2.17,
        bValue: isSfr ? 1.02 : 0.98,
        parameterDistributions: {
          annualRateAboveMinimum: { type: DistributionType.LOGNORMAL, median: isSfr ? 0.034 : 0.019, errorFactor: 1.5 },
        },
        dataAndMethodBasis: "Declustered and completeness-corrected seismicity is smoothed across the seismogenic volume.",
      }],
      historicalAndInstrumentalEventRefs: instrumentalEventRefs,
      sourceDataRefs: [`${earthDataPrefix}-SEISMOLOGY`, `${earthDataPrefix}-GEOPHYSICS`],
      majorHazardContributor: true,
      characterizationBasis: "Residual catalog seismicity represents earthquakes not assigned to explicit fault sources.",
      uncertainties: ["Catalog completeness", "declustering", "smoothing bandwidth", "maximum magnitude", "depth distribution"],
      implementsSrs: srs("SHA-C1", "SHA-C2", "SHA-C3"),
    },
    {
      uuid: distalSourceId,
      name: isSfr ? "Eastern Snake River Plain source zone" : "Stable continental background source",
      sourceType: isSfr ? "AREA" : "BACKGROUND",
      tectonicRegionType: isSfr ? "Volcanic and extensional crust" : "Stable continental crust",
      active: true,
      faultMechanisms: isSfr ? ["NORMAL", "UNKNOWN"] : ["REVERSE", "STRIKE_SLIP", "UNKNOWN"],
      geometry: {
        geometryType: isSfr ? "AREA" : "VOLUME",
        geometryDescription: isSfr
          ? "Regional areal source representing distributed seismicity across the volcanic plain."
          : "Broad stable-crustal source volume extending across the regional study area.",
        coordinateReferenceSystem: "EPSG:4326",
        geometryFileRef: `SHA-${kind.toUpperCase()}-DISTAL-SOURCE.gpkg`,
        closestDistanceToSiteKm: isSfr ? 68 : 0,
        depthRangeKm: { minimum: 4, maximum: 30 },
        uncertaintyDescription: "Source boundary, seismogenic thickness, activity rate, and maximum magnitude are treated epistemically.",
      },
      magnitudeFrequencyModels: [{
        uuid: `MFD-${kind.toUpperCase()}-DISTAL-GR`,
        name: "Regional distributed-seismicity model",
        modelType: "GUTENBERG_RICHTER",
        minimumMagnitude: 4.5,
        maximumMagnitude: isSfr ? 6.9 : 7.1,
        magnitudeScale: "Mw",
        annualRateAboveMinimum: isSfr ? 0.008 : 0.011,
        aValue: isSfr ? 1.76 : 1.91,
        bValue: isSfr ? 1.05 : 0.99,
        dataAndMethodBasis: "Regional catalog rates and tectonic analogs define the distributed source model.",
      }],
      historicalAndInstrumentalEventRefs: instrumentalEventRefs,
      sourceDataRefs: [`${earthDataPrefix}-SEISMOLOGY`, `${earthDataPrefix}-GEOLOGY`, `${earthDataPrefix}-GEOPHYSICS`],
      majorHazardContributor: !isSfr,
      characterizationBasis: "Regional seismicity and tectonic analogs support a distinct distributed source treatment.",
      uncertainties: ["Source boundary", "activity rate", "maximum magnitude", "ground-motion region assignment"],
      implementsSrs: srs("SHA-C1", "SHA-C2", "SHA-C3"),
    },
  ];
  sha.sourceCharacterization.sourceLogicTree = {
    ...sha.sourceCharacterization.sourceLogicTree,
    uuid: `SOURCE-LT-${kind.toUpperCase()}-2026`,
    name: "Seismic source characterization logic tree",
    nodes: [
      {
        uuid: `SOURCE-LT-${kind.toUpperCase()}-GEOMETRY`,
        name: "Fault geometry and segmentation",
        nodeKind: "SOURCE_GEOMETRY",
        branches: [
          { uuid: `SOURCE-BRANCH-${kind.toUpperCase()}-SEGMENTED`, name: "Segmented ruptures", modelRef: localSourceId, weight: 0.65, technicalBasis: "Mapped discontinuities and paleoseismic event extents favor segmented rupture.", dataSupport: [`${earthDataPrefix}-GEOLOGY`, `${earthDataPrefix}-PALEO`] },
          { uuid: `SOURCE-BRANCH-${kind.toUpperCase()}-CONNECTED`, name: "Connected ruptures", modelRef: regionalSourceId, weight: 0.35, technicalBasis: "Structural continuity and regional analogs support a connected-rupture alternative.", dataSupport: [`${earthDataPrefix}-GEOLOGY`, `${earthDataPrefix}-GEOPHYSICS`] },
        ],
        weightSum: 1,
        dependencyTreatment: "Geometry selection conditions the maximum-magnitude branches.",
        elicitationBasis: "Technical integrator weighting after evaluator review of mapping and paleoseismic evidence.",
      },
      {
        uuid: `SOURCE-LT-${kind.toUpperCase()}-MMAX`,
        name: "Maximum magnitude",
        nodeKind: "MAXIMUM_MAGNITUDE",
        branches: [
          { uuid: `SOURCE-BRANCH-${kind.toUpperCase()}-MMAX-CENTRAL`, name: "Central maximum magnitude", value: isSfr ? 7.3 : 7.25, weight: 0.6, technicalBasis: "Best-estimate rupture dimensions and regional analogs.", dataSupport: [`${earthDataPrefix}-GEOLOGY`, `${earthDataPrefix}-PALEO`] },
          { uuid: `SOURCE-BRANCH-${kind.toUpperCase()}-MMAX-UPPER`, name: "Upper maximum magnitude", value: isSfr ? 7.6 : 7.5, weight: 0.4, technicalBasis: "Connected rupture and broader tectonic analogs define the upper branch.", dataSupport: [`${earthDataPrefix}-GEOLOGY`, `${earthDataPrefix}-GEOPHYSICS`] },
        ],
        weightSum: 1,
        parentBranchRef: `SOURCE-BRANCH-${kind.toUpperCase()}-CONNECTED`,
        dependencyTreatment: "The connected geometry branch receives the broader maximum-magnitude range.",
        elicitationBasis: "Fault-dimension scaling and analog evaluations reviewed under the structured process.",
      },
      {
        uuid: `SOURCE-LT-${kind.toUpperCase()}-RECURRENCE`,
        name: "Recurrence model",
        nodeKind: "RECURRENCE",
        branches: [
          { uuid: `SOURCE-BRANCH-${kind.toUpperCase()}-GR`, name: "Catalog Gutenberg-Richter", modelRef: `MFD-${kind.toUpperCase()}-LOCAL-GR`, weight: 0.45, technicalBasis: "Completeness-corrected catalog recurrence.", dataSupport: [`${earthDataPrefix}-SEISMOLOGY`] },
          { uuid: `SOURCE-BRANCH-${kind.toUpperCase()}-RENEWAL`, name: "Paleoseismic renewal", modelRef: `MFD-${kind.toUpperCase()}-LOCAL-RENEWAL`, weight: 0.35, technicalBasis: "Event chronology and elapsed-time constraints.", dataSupport: [`${earthDataPrefix}-PALEO`] },
          { uuid: `SOURCE-BRANCH-${kind.toUpperCase()}-CHAR`, name: "Characteristic recurrence", modelRef: `MFD-${kind.toUpperCase()}-REGIONAL-CHAR`, weight: 0.2, technicalBasis: "Fault dimensions and slip-rate balance.", dataSupport: [`${earthDataPrefix}-GEOLOGY`, `${earthDataPrefix}-PALEO`] },
        ],
        weightSum: 1,
        dependencyTreatment: "Recurrence branches are evaluated conditionally for explicit faults and background sources.",
        elicitationBasis: "Catalog, paleoseismic, and geologic-rate evidence are weighted by the technical integrator.",
      },
    ],
    totalEndBranchCount: 12,
    branchWeightReview: "Every node sums to one; conditional path weights and end-branch totals were independently checked.",
    dependenciesAndCorrelations: "Geometry, maximum magnitude, and recurrence dependencies are preserved through conditional branching.",
    centerBodyRangeCoverage: "The 12 end branches span segmented and connected geometries, central and upper magnitudes, and three recurrence interpretations.",
    implementsSrs: srs("SHA-C2", "SHA-C3", "SHA-C5"),
  };
  sha.sourceCharacterization.uncertaintyIdentificationMethod = "Data ranking, alternative-hypothesis tables, evaluator challenge, and logic-tree diagnostics identify source uncertainty.";
  sha.sourceCharacterization.existingModelAssessments = [{
    uuid: `SOURCE-ASSESSMENT-${kind.toUpperCase()}-2026`,
    name: "Existing seismic source model update",
    modelType: "SEISMIC_SOURCE",
    modelVersion: "2025.1",
    originalStudyDate: "2025-02-10",
    newDataModelMethodRefs: [`EARTH-SOURCE-${kind.toUpperCase()}-NATIONAL-UPDATE`, `${earthDataPrefix}-GEOLOGY`, `${earthDataPrefix}-PALEO`],
    centerBodyRangeCoverageEvaluation: "New fault mapping and recurrence interpretations extend but do not displace the existing center of the model.",
    technicalValidityEvaluation: "The existing regional framework remains valid after source-boundary, rate, and maximum-magnitude comparisons.",
    updateRequired: true,
    updateLevel: "Targeted SSHAC Level 2 update",
    updateMethod: "Revise affected geometry and recurrence branches while retaining validated regional background components.",
    updateJustification: "New mapping and paleoseismic constraints materially refine local and regional source alternatives.",
    resultingModelRef: sourceModelRef,
    implementsSrs: srs("SHA-C4", "SHA-C5"),
  }];
  sha.sourceCharacterization.sourceModelReference = sourceModelRef;
  sha.sourceCharacterization.technicalIntegrationSummary = "Four credible sources, six recurrence models, and 12 weighted end branches represent the source-model center, body, and range.";
  sha.sourceCharacterization.implementsSrs = srs("SHA-C1", "SHA-C2", "SHA-C3", "SHA-C4", "SHA-C5");

  const strongMotionDataRefs = [
    `STRONG-MOTION-${kind.toUpperCase()}-REGIONAL`,
    "STRONG-MOTION-NGA-WEST2",
    "STRONG-MOTION-NGA-EAST",
  ];
  const groundMotionModelWeights = isSfr
    ? { west: 0.4, east: 0.15, regional: 0.25, simulation: 0.2 }
    : { west: 0.25, east: 0.35, regional: 0.25, simulation: 0.15 };
  const groundMotionModelIds = {
    west: `GMM-${kind.toUpperCase()}-NGA-WEST2`,
    east: `GMM-${kind.toUpperCase()}-NGA-EAST`,
    regional: `GMM-${kind.toUpperCase()}-REGIONAL`,
    simulation: `GMM-${kind.toUpperCase()}-SIMULATION`,
  };

  sha.groundMotionCharacterization.governingMechanisms = isSfr
    ? ["Normal and oblique active-crustal faulting", "Basin and Range background seismicity", "Volcanic-plain distributed seismicity"]
    : ["Active-crustal faulting", "Stable continental background seismicity", "Transitional-crust path attenuation"];
  sha.groundMotionCharacterization.historicalAndInstrumentalReview = "Macroseismic observations, regional network recordings, strong-motion records, path attenuation, and site-condition metadata were compared with candidate model residuals.";
  sha.groundMotionCharacterization.strongMotionDataSets = [
    {
      uuid: strongMotionDataRefs[0]!,
      name: `${site} regional strong-motion subset`,
      sourceReference: `${earthDataPrefix}-STRONG-MOTION`,
      tectonicRegions: isSfr ? ["Basin and Range active crust", "Intermountain active crust"] : ["Stable continental crust", "Intermountain active crust"],
      magnitudeRange: { minimum: 3.5, maximum: isSfr ? 7.2 : 7.5 },
      distanceRangeKm: { minimum: 8, maximum: 500 },
      siteConditionRange: "Reference rock through firm soil, with measured or inferred Vs30",
      recordCount: isSfr ? 486 : 372,
      componentDefinition: "Three-component records converted to geometric-mean horizontal and vertical components.",
      qualityScreening: "Reviewed event solutions, usable bandwidth, clipping, timing, orientation, and site metadata.",
      useInCalibration: "Evaluates regional residual trends, component conversion, and path-adjustment alternatives.",
    },
    {
      uuid: strongMotionDataRefs[1]!,
      name: "NGA-West2 active-crustal database subset",
      sourceReference: "NGA-WEST2-DATABASE",
      tectonicRegions: ["Active shallow crust"],
      magnitudeRange: { minimum: 3, maximum: 8 },
      distanceRangeKm: { minimum: 0, maximum: 300 },
      siteConditionRange: "Hard rock through soft soil",
      recordCount: 21000,
      componentDefinition: "RotD50-compatible horizontal components with vertical records where available.",
      qualityScreening: "Peer-reviewed flatfile filters, usable-period checks, and removal of records outside model applicability.",
      useInCalibration: "Supports published active-crustal models and checks magnitude, distance, mechanism, and site scaling.",
    },
    {
      uuid: strongMotionDataRefs[2]!,
      name: "NGA-East stable-continental database subset",
      sourceReference: "NGA-EAST-DATABASE",
      tectonicRegions: ["Stable continental crust"],
      magnitudeRange: { minimum: 2.5, maximum: 7.6 },
      distanceRangeKm: { minimum: 5, maximum: 1500 },
      siteConditionRange: "Hard rock through firm soil",
      recordCount: 8900,
      componentDefinition: "Horizontal geometric-mean motions with consistent magnitude and distance metrics.",
      qualityScreening: "Database quality flags, bandwidth limits, magnitude conversions, and site-condition screening applied.",
      useInCalibration: "Constrains stable-crust median, sigma, and long-distance attenuation alternatives.",
    },
  ];
  sha.groundMotionCharacterization.modelSelectionCriteria = [
    "Tectonic-region and fault-mechanism applicability",
    "Magnitude and distance coverage",
    "Ground-motion parameter and component compatibility",
    "Reference-horizon and site-term compatibility",
    "Usable aleatory sigma model",
    "Independence from other weighted models",
    "Performance against regional strong-motion residuals",
  ];
  sha.groundMotionCharacterization.predictionModels = [
    {
      uuid: groundMotionModelIds.west,
      name: "NGA-West2 active-crustal ensemble",
      modelKind: "PUBLISHED_GMPE",
      version: "2014 with 2025 applicability review",
      sourceReference: "NGA-WEST2-ENSEMBLE",
      tectonicRegionTypes: ["Active shallow crust", "Basin and Range active crust"],
      faultMechanisms: ["NORMAL", "OBLIQUE", "STRIKE_SLIP", "REVERSE"],
      magnitudeRange: { minimum: 3, maximum: 8.5 },
      distanceRangeKm: { minimum: 0, maximum: 300 },
      supportedParameterRefs: groundMotionParameterRefs,
      horizontalComponentDefinition: "Geometric-mean horizontal motion using model-specific component conversions.",
      siteTermDefinition: "Reference-rock prediction with Vs30-dependent site terms removed before site-response convolution.",
      medianModelDescription: "Weighted active-crustal median with magnitude, distance, mechanism, hanging-wall, and basin terms.",
      aleatoryVariabilityDescription: "Magnitude- and distance-dependent inter-event and intra-event sigma.",
      sigmaComponents: { total: 0.62, interEvent: 0.28, intraEvent: 0.55 },
      extrapolationAndTruncation: "Risk-significant calculations remain within supported ranges; residuals are integrated to epsilon 3.",
      applicabilityAndLimitations: "Primary model for active-crustal sources; stable-crust sources use conditional alternatives.",
      calibrationDataRefs: [strongMotionDataRefs[0]!, strongMotionDataRefs[1]!],
      logicTreeWeight: groundMotionModelWeights.west,
      selectionBasis: "Retained for broad data support, mechanism coverage, component compatibility, and regional residual performance.",
      implementsSrs: srs("SHA-D1", "SHA-D2", "SHA-D3", "SHA-D4"),
    },
    {
      uuid: groundMotionModelIds.east,
      name: "NGA-East stable-continental ensemble",
      modelKind: "PUBLISHED_GMPE",
      version: "2018 with 2025 applicability review",
      sourceReference: "NGA-EAST-ENSEMBLE",
      tectonicRegionTypes: ["Stable continental crust", "Stable continental and transitional crust"],
      faultMechanisms: ["REVERSE", "STRIKE_SLIP", "NORMAL", "UNKNOWN"],
      magnitudeRange: { minimum: 3, maximum: 8.2 },
      distanceRangeKm: { minimum: 0, maximum: 1500 },
      supportedParameterRefs: groundMotionParameterRefs,
      horizontalComponentDefinition: "Geometric-mean horizontal motion on the project reference-rock basis.",
      siteTermDefinition: "Hard-rock median adjusted to the selected reference-rock horizon before local site response.",
      medianModelDescription: "Stable-continental median suite spanning alternative stress-drop and attenuation models.",
      aleatoryVariabilityDescription: "Magnitude-dependent ergodic sigma with a non-ergodic sensitivity treatment.",
      sigmaComponents: { total: 0.68, interEvent: 0.3, intraEvent: 0.61 },
      extrapolationAndTruncation: "The calculation uses supported magnitude-distance ranges and epsilon 3 truncation.",
      applicabilityAndLimitations: "Applied conditionally to stable and transitional crust; sparse nearby large events drive epistemic spread.",
      calibrationDataRefs: [strongMotionDataRefs[0]!, strongMotionDataRefs[2]!],
      logicTreeWeight: groundMotionModelWeights.east,
      selectionBasis: "Retained to represent stable-crust attenuation, stress-drop, and sigma alternatives.",
      implementsSrs: srs("SHA-D1", "SHA-D2", "SHA-D3", "SHA-D4"),
    },
    {
      uuid: groundMotionModelIds.regional,
      name: "Project regional empirical adjustment model",
      modelKind: "PROJECT_SPECIFIC_GMPE",
      version: "2026.1",
      sourceReference: `SHA-${kind.toUpperCase()}-REGIONAL-GMM-2026`,
      tectonicRegionTypes: isSfr ? ["Basin and Range active crust", "Volcanic and extensional crust"] : ["Stable continental and transitional crust", "Active shallow crust"],
      faultMechanisms: ["NORMAL", "OBLIQUE", "STRIKE_SLIP", "UNKNOWN"],
      magnitudeRange: { minimum: 3.5, maximum: 7.6 },
      distanceRangeKm: { minimum: 5, maximum: 500 },
      supportedParameterRefs: groundMotionParameterRefs,
      horizontalComponentDefinition: "Regional records are converted to the common geometric-mean horizontal definition.",
      siteTermDefinition: "Residuals are evaluated at reference-rock conditions and transferred through the site-response model.",
      medianModelDescription: "Published median predictions with period-dependent regional path and stress-drop adjustments.",
      aleatoryVariabilityDescription: "Parent-model sigma is retained with regional residual uncertainty added epistemically.",
      sigmaComponents: { total: 0.64, interEvent: 0.29, intraEvent: 0.57 },
      extrapolationAndTruncation: "Adjustments taper outside the regional data range; the parent models govern unsupported ranges.",
      applicabilityAndLimitations: "Directly represents the site region but has fewer large, nearby recordings than the published databases.",
      calibrationDataRefs: strongMotionDataRefs,
      logicTreeWeight: groundMotionModelWeights.regional,
      selectionBasis: "Retained because statistically significant regional residual trends affect risk-significant frequencies.",
      implementsSrs: srs("SHA-D1", "SHA-D2", "SHA-D3", "SHA-D4"),
    },
    {
      uuid: groundMotionModelIds.simulation,
      name: "Broadband simulation-informed model",
      modelKind: "HYBRID",
      version: "2026.1",
      sourceReference: `SHA-${kind.toUpperCase()}-BROADBAND-SIM-2026`,
      tectonicRegionTypes: isSfr ? ["Basin and Range active crust"] : ["Stable continental crust", "Active shallow crust"],
      faultMechanisms: ["NORMAL", "OBLIQUE", "STRIKE_SLIP", "REVERSE"],
      magnitudeRange: { minimum: 5, maximum: 8 },
      distanceRangeKm: { minimum: 2, maximum: 500 },
      supportedParameterRefs: groundMotionParameterRefs,
      horizontalComponentDefinition: "Synthetic horizontal pairs are reduced to geometric mean and benchmarked against recorded components.",
      siteTermDefinition: "Simulations terminate at the project reference-rock horizon; local response is applied separately.",
      medianModelDescription: "Broadband deterministic and stochastic simulations sample rupture, path, stress drop, and crustal structure.",
      aleatoryVariabilityDescription: "Within-scenario and between-scenario variability are calibrated to empirical sigma.",
      sigmaComponents: { total: 0.6, interEvent: 0.27, intraEvent: 0.54 },
      extrapolationAndTruncation: "Simulation scenarios cover the upper magnitude and near-source range that is sparse in observations.",
      applicabilityAndLimitations: "Provides an independent upper-motion check; crustal-model resolution limits narrow-band interpretation.",
      calibrationDataRefs: strongMotionDataRefs,
      logicTreeWeight: groundMotionModelWeights.simulation,
      selectionBasis: "Retained as an independent model for large-magnitude and near-source behavior.",
      implementsSrs: srs("SHA-D1", "SHA-D2", "SHA-D3", "SHA-D4"),
    },
  ];
  sha.groundMotionCharacterization.groundMotionLogicTree = {
    ...sha.groundMotionCharacterization.groundMotionLogicTree,
    uuid: `GM-LT-${kind.toUpperCase()}-2026`,
    name: "Ground-motion characterization logic tree",
    nodes: [
      {
        uuid: `GM-LT-${kind.toUpperCase()}-MODEL`,
        name: "Ground-motion model",
        nodeKind: "GROUND_MOTION_MODEL",
        branches: [
          { uuid: `GM-BRANCH-${kind.toUpperCase()}-WEST`, name: "Active-crustal ensemble", modelRef: groundMotionModelIds.west, weight: groundMotionModelWeights.west, technicalBasis: "Broad active-crustal database and regional applicability.", dataSupport: [strongMotionDataRefs[0]!, strongMotionDataRefs[1]!] },
          { uuid: `GM-BRANCH-${kind.toUpperCase()}-EAST`, name: "Stable-continental ensemble", modelRef: groundMotionModelIds.east, weight: groundMotionModelWeights.east, technicalBasis: "Stable-crust attenuation and stress-drop alternatives.", dataSupport: [strongMotionDataRefs[0]!, strongMotionDataRefs[2]!] },
          { uuid: `GM-BRANCH-${kind.toUpperCase()}-REGIONAL`, name: "Regional empirical adjustment", modelRef: groundMotionModelIds.regional, weight: groundMotionModelWeights.regional, technicalBasis: "Observed regional residual trends.", dataSupport: strongMotionDataRefs },
          { uuid: `GM-BRANCH-${kind.toUpperCase()}-SIM`, name: "Simulation-informed model", modelRef: groundMotionModelIds.simulation, weight: groundMotionModelWeights.simulation, technicalBasis: "Independent large-magnitude and near-source behavior.", dataSupport: strongMotionDataRefs },
        ],
        weightSum: 1,
        dependencyTreatment: "Model branches are applied conditionally by tectonic region and source mechanism.",
        elicitationBasis: "Applicability, independence, data support, and residual performance determine the weights.",
      },
      {
        uuid: `GM-LT-${kind.toUpperCase()}-MEDIAN`,
        name: "Regional median adjustment",
        nodeKind: "OTHER",
        branches: [
          { uuid: `GM-BRANCH-${kind.toUpperCase()}-MEDIAN-LOW`, name: "Lower median adjustment", value: -0.15, weight: 0.2, technicalBasis: "Lower bound of regional residual uncertainty.", dataSupport: [strongMotionDataRefs[0]!] },
          { uuid: `GM-BRANCH-${kind.toUpperCase()}-MEDIAN-CENTRAL`, name: "Central median adjustment", value: 0, weight: 0.6, technicalBasis: "Best-estimate residual trend.", dataSupport: [strongMotionDataRefs[0]!] },
          { uuid: `GM-BRANCH-${kind.toUpperCase()}-MEDIAN-UPPER`, name: "Upper median adjustment", value: 0.15, weight: 0.2, technicalBasis: "Upper bound of regional residual uncertainty.", dataSupport: [strongMotionDataRefs[0]!] },
        ],
        weightSum: 1,
        dependencyTreatment: "Adjustments are period dependent and taper outside the regional data range.",
        elicitationBasis: "Regional mixed-effects residual analysis and evaluator review.",
      },
      {
        uuid: `GM-LT-${kind.toUpperCase()}-SIGMA`,
        name: "Aleatory variability treatment",
        nodeKind: "OTHER",
        branches: [
          { uuid: `GM-BRANCH-${kind.toUpperCase()}-SIGMA-ERGODIC`, name: "Ergodic sigma", value: "Published total sigma", weight: 0.7, technicalBasis: "Supported by the full empirical databases.", dataSupport: [strongMotionDataRefs[1]!, strongMotionDataRefs[2]!] },
          { uuid: `GM-BRANCH-${kind.toUpperCase()}-SIGMA-REDUCED`, name: "Partially non-ergodic sigma", value: "Reduced site-to-site component", weight: 0.3, technicalBasis: "Site-specific residual treatment removes part of the repeatable site term.", dataSupport: [strongMotionDataRefs[0]!] },
        ],
        weightSum: 1,
        dependencyTreatment: "Sigma treatment is correlated across periods and models within each calculation branch.",
        elicitationBasis: "Published sigma decomposition and regional repeatable-site residuals.",
      },
    ],
    totalEndBranchCount: 24,
    branchWeightReview: "All node and conditional model weights sum to one; 24 end-branch weights were independently reconciled.",
    dependenciesAndCorrelations: "Tectonic-region applicability, common database dependence, period correlation, and median-sigma dependence are preserved.",
    centerBodyRangeCoverage: "Four model families, three regional median branches, and two sigma treatments span the defensible motion range.",
    implementsSrs: srs("SHA-D2", "SHA-D3", "SHA-D4"),
  };
  sha.groundMotionCharacterization.referenceHorizons = [
    {
      uuid: `REF-HORIZON-${kind.toUpperCase()}-ROCK`,
      name: "Reference rock horizon",
      horizonType: "ROCK",
      depth: isSfr ? 52 : 34,
      depthUnit: "m",
      shearWaveVelocity: 760,
      shearWaveVelocityUnit: "m/s",
      density: 2200,
      densityUnit: "kg/m3",
      dampingRatio: 0.02,
      definitionBasis: "Borehole velocity logs, density testing, damping measurements, and the foundation geotechnical model.",
      uncertaintyDescription: "Depth, velocity, density, and damping uncertainty are represented by weighted site-profile branches.",
      implementsSrs: srs("SHA-D1", "SHA-D3"),
    },
    {
      uuid: `REF-HORIZON-${kind.toUpperCase()}-HARD-ROCK`,
      name: "Hard-rock sensitivity horizon",
      horizonType: "ROCK",
      depth: isSfr ? 96 : 78,
      depthUnit: "m",
      shearWaveVelocity: 2000,
      shearWaveVelocityUnit: "m/s",
      density: 2450,
      densityUnit: "kg/m3",
      dampingRatio: 0.015,
      definitionBasis: "Deep geophysical profiles and regional hard-rock analogs define the alternative input horizon.",
      uncertaintyDescription: "The horizon is used in sensitivity calculations for velocity-gradient and reference-condition uncertainty.",
      implementsSrs: srs("SHA-D1", "SHA-D3"),
    },
  ];
  sha.groundMotionCharacterization.processCompatibilityBasis = "The ground-motion process uses the Step 02 SSHAC Level 2 framework, common Mw scale, compatible distance metrics, geometric-mean horizontal motion, and controlled reference horizons.";
  sha.groundMotionCharacterization.uncertainties = [
    {
      uuid: `GM-UNCERTAINTY-${kind.toUpperCase()}-MODEL`,
      name: "Ground-motion model selection",
      uncertaintyType: "EPISTEMIC",
      analysisArea: "GROUND_MOTION",
      description: "Alternative empirical and simulation-informed median models span tectonic, magnitude, distance, and mechanism interpretations.",
      affectedModelRefs: Object.values(groundMotionModelIds),
      affectedResultRefs: ["HAZARD-CURVE-MEAN-1HZ"],
      characterizationMethod: "Weighted model logic tree",
      logicTreeNodeRef: `GM-LT-${kind.toUpperCase()}-MODEL`,
      correlationAndDependencyTreatment: "Common data dependence and tectonic-region applicability are represented conditionally.",
      propagationMethod: "Propagated through all ground-motion logic-tree end branches.",
      importance: ImportanceLevel.HIGH,
      riskSignificanceBasis: "Model median differences control hazard across the risk-significant motion range.",
      implementsSrs: srs("SHA-D3", "SHA-D4"),
    },
    {
      uuid: `GM-UNCERTAINTY-${kind.toUpperCase()}-SIGMA`,
      name: "Aleatory ground-motion variability",
      uncertaintyType: "ALEATORY",
      analysisArea: "GROUND_MOTION",
      description: "Inter-event and intra-event variability depend on magnitude, distance, period, and model family.",
      affectedModelRefs: Object.values(groundMotionModelIds),
      affectedResultRefs: ["HAZARD-CURVE-MEAN-1HZ"],
      characterizationMethod: "Published sigma models with partially non-ergodic sensitivity treatment",
      correlationAndDependencyTreatment: "Period correlation and common event and site components are retained.",
      propagationMethod: "Integrated to epsilon 3 for every magnitude-distance-source-model combination.",
      importance: ImportanceLevel.HIGH,
      riskSignificanceBasis: "The sigma tail materially affects low-frequency exceedance estimates.",
      implementsSrs: srs("SHA-D1", "SHA-D3"),
    },
    {
      uuid: `GM-UNCERTAINTY-${kind.toUpperCase()}-REGIONAL`,
      name: "Regional path adjustment",
      uncertaintyType: "EPISTEMIC",
      analysisArea: "GROUND_MOTION",
      description: "Regional attenuation residuals support lower, central, and upper period-dependent median adjustments.",
      affectedModelRefs: [groundMotionModelIds.regional],
      affectedResultRefs: ["HAZARD-CURVE-MEAN-1HZ"],
      characterizationMethod: "Mixed-effects residual analysis",
      logicTreeNodeRef: `GM-LT-${kind.toUpperCase()}-MEDIAN`,
      correlationAndDependencyTreatment: "Adjustments are correlated across period and taper outside the data range.",
      propagationMethod: "Discrete weighted branches in the ground-motion logic tree.",
      importance: ImportanceLevel.MEDIUM,
      riskSignificanceBasis: "Regional attenuation affects high-frequency hazard from the nearest sources.",
      implementsSrs: srs("SHA-D3", "SHA-D4"),
    },
    {
      uuid: `GM-UNCERTAINTY-${kind.toUpperCase()}-HORIZON`,
      name: "Reference-horizon definition",
      uncertaintyType: "EPISTEMIC",
      analysisArea: "GROUND_MOTION",
      description: "Reference depth, shear-wave velocity, density, and damping vary between measured rock and hard-rock sensitivity horizons.",
      affectedModelRefs: [`REF-HORIZON-${kind.toUpperCase()}-ROCK`, `REF-HORIZON-${kind.toUpperCase()}-HARD-ROCK`],
      affectedResultRefs: ["HAZARD-CURVE-MEAN-1HZ"],
      characterizationMethod: "Alternative reference-horizon sensitivity calculations",
      correlationAndDependencyTreatment: "Horizon selection is coupled to site-response profile and input-motion branches.",
      propagationMethod: "Weighted site-response and reference-motion alternatives.",
      importance: ImportanceLevel.MEDIUM,
      riskSignificanceBasis: "Reference-condition uncertainty changes the motion transferred into the site-response analysis.",
      implementsSrs: srs("SHA-D1", "SHA-D3"),
    },
  ];
  sha.groundMotionCharacterization.siteToSiteVariabilityIncluded = false;
  sha.groundMotionCharacterization.siteToSiteVariabilityTreatment = "The PRA uses an identified site; repeatable site terms are removed where supported and residual site uncertainty is treated explicitly.";
  sha.groundMotionCharacterization.existingModelAssessments = [{
    uuid: `GMM-ASSESSMENT-${kind.toUpperCase()}-2026`,
    name: "Existing ground-motion model update",
    modelType: "GROUND_MOTION",
    modelVersion: "2025.2",
    originalStudyDate: "2025-04-18",
    newDataModelMethodRefs: [`EARTH-SOURCE-${kind.toUpperCase()}-GMM`, `EARTH-SOURCE-${kind.toUpperCase()}-PROPAGATION`, `${earthDataPrefix}-STRONG-MOTION`],
    centerBodyRangeCoverageEvaluation: "New regional residuals and simulation results remain within the expanded empirical and hybrid model range.",
    technicalValidityEvaluation: "The published model families remain technically valid after component, reference-horizon, and residual comparisons.",
    updateRequired: true,
    updateLevel: "Targeted model and weight update",
    updateMethod: "Add the regional and simulation-informed branches and revise conditional tectonic-region weights.",
    updateJustification: "Regional attenuation and large-magnitude simulation results materially affect selected periods.",
    resultingModelRef: `GROUND-MOTION-MODEL-${kind.toUpperCase()}-2026`,
    implementsSrs: srs("SHA-D2", "SHA-D4"),
  }];
  sha.groundMotionCharacterization.implementsSrs = srs("SHA-D1", "SHA-D2", "SHA-D3", "SHA-D4");

  populateSiteResponseAnalysis(mef, kind, building);

  const spectrumPoints = populateHazardResults(mef, kind, building);
  populateSecondaryHazards(mef, kind);
  sha.documentation.processDescription = "A structured SSHAC Level 2 process develops source, ground-motion, site-response, spectra, and secondary-hazard results for Seismic PRA.";
  sha.documentation.inputsDescription = "Regional and site earth-science data, catalog records, geotechnical investigations, and strong-motion models are controlled and traceable.";
  sha.documentation.modelStructureDescription = "Coupled source, ground-motion, and site-response logic trees are integrated into mean and fractile control-point hazard.";
  sha.documentation.hazardResultsSummary = "Mean curves and spectra cover 1E-2 to below 1E-8 per plant-year and are discretized for response quantification.";
  sha.documentation.secondaryHazardMethods = "Secondary mechanisms are systematically identified, screened, or retained with hazard and fragility interfaces.";
  sha.documentation.riskSignificantUncertaintiesAndAssumptions = "Local-fault recurrence, ground-motion median, and nonlinear site response dominate hazard uncertainty.";
  sha.documentation.modelUncertaintyDocumentation = "Reasonable source, prediction-model, and site-response alternatives are carried in the logic tree or sensitivity studies.";
  sha.documentation.dataAndModelReferences = [`SHA-${kind.toUpperCase()}-GEOLOGY-2026`, "SOURCE-MODEL-2026", "GM-LT-1", "SITE-RESPONSE-METHOD-1"];
  sha.documentation.calculationFileRefs = ["SHA-RESULTS-2026.H5"];
  sha.documentation.traceabilityLinks = [
    {
      uuid: "TRACE-SHA-DATA-RESULT",
      sourceType: "DATA_SET",
      sourceRef: `EARTH-DATA-${kind.toUpperCase()}-GEOLOGY`,
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
  const equipment = populateSelAndResponse(mef, kind, building);
  spr.plantResponseModel.baseInternalEventsModelRefs = ["ES-REFERENCE-MODEL", "SY-REFERENCE-MODEL", "SC-REFERENCE-BASIS"];
  spr.plantResponseModel.baseNonSeismicHazardModelRefs = ["INTERNAL-FLOOD-REFERENCE", "INTERNAL-FIRE-REFERENCE"];
  spr.plantResponseModel.eventSequenceRefs = ["ES-SEISMIC-SUCCESS", "ES-SEISMIC-DAMAGE"];
  spr.plantResponseModel.systemsLogicModelRefs = ["SY-SEISMIC-MODEL"];
  spr.plantResponseModel.inducedFailures = equipment
    .filter((item) => item.disposition === "ACTIVE")
    .map((item, index) => ({
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
    hazardBinContributions: sha.hazardQuantification.seismicPraInputs.hazardIntervals.map((interval, index) => ({
      binRef: `SPR-${interval.uuid}`,
      frequencyContribution: (
        isSfr
          ? [4e-7, 1.1e-6, 3.4e-6, 8.3e-6, 1.02e-5, 6.7e-6, 2.1e-6, 3e-7]
          : [3e-7, 8e-7, 2.5e-6, 6.2e-6, 7.8e-6, 5.1e-6, 1.6e-6, 2e-7]
      )[index]!,
    })),
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
    { uuid: "CHECK-GMP", name: "Ground-motion parameter consistency", checkType: "GROUND_MOTION_PARAMETER", subelements: ["SHA", "SFR", "SPR"], comparedRefs: ["GMP-SA-1HZ", "REFERENCE-EQ-1", "DISCRETIZATION-1"], method: "Compare identifier, definition, direction, units, frequency, damping, and use range.", result: "PASS", evidence: "All three subelements use geometric-mean horizontal SA at 1 Hz in g at the foundation control point.", openItems: [], implementsSrs: srs("SHA-A4", "SFR-B1", "SPR-E1") },
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
  mef.integration.selectedGroundMotionParameterRefs = sha.analysisBasis.groundMotionParameters.map((parameter) => parameter.uuid);
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
      dataRefs: [`EARTH-DATA-${kind.toUpperCase()}-GEOLOGY`],
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
