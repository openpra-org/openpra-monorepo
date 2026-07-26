import { DistributionType } from "interfaces-mef-types/core/events";
import { type SRReference } from "interfaces-mef-types/core/pra-common";
import { ImportanceLevel } from "interfaces-mef-types/core/shared-patterns";
import { type SeismicPRA } from "interfaces-mef-types/seismic/seismic-pra";

type ReactorKind = "sfr" | "htgr";
type SiteResponse = SeismicPRA["seismicHazardAnalysis"]["siteResponseAnalysis"];
type Profile = SiteResponse["profiles"][number];
type Layer = Profile["layers"][number];
type Property = Layer["properties"][number];

interface ProfileDefinition {
  code: "LOWER" | "BEST" | "UPPER";
  type: Profile["profileType"];
  boundaries: [number, number, number, number];
  vs: [number, number, number];
  density: [number, number, number];
  damping: [number, number, number];
  poisson: [number, number, number];
  groundwater: number;
  weight: number;
}

function srs(...codes: string[]): SRReference[] {
  return codes.map((sr) => ({ sr, hlr: sr.split("-")[1]!.charAt(0) as SRReference["hlr"] }));
}

function profileDefinitions(kind: ReactorKind): ProfileDefinition[] {
  return kind === "sfr"
    ? [
      { code: "LOWER", type: "LOWER_BOUND", boundaries: [0, 10, 32, 58], vs: [230, 390, 590], density: [1800, 2050, 2250], damping: [0.055, 0.04, 0.03], poisson: [0.34, 0.31, 0.28], groundwater: 20, weight: 0.25 },
      { code: "BEST", type: "BEST_ESTIMATE", boundaries: [0, 8, 28, 52], vs: [270, 450, 650], density: [1830, 2100, 2320], damping: [0.05, 0.036, 0.027], poisson: [0.33, 0.3, 0.27], groundwater: 22, weight: 0.5 },
      { code: "UPPER", type: "UPPER_BOUND", boundaries: [0, 6, 24, 46], vs: [310, 510, 730], density: [1870, 2150, 2380], damping: [0.045, 0.032, 0.024], poisson: [0.32, 0.29, 0.26], groundwater: 24, weight: 0.25 },
    ]
    : [
      { code: "LOWER", type: "LOWER_BOUND", boundaries: [0, 7, 24, 38], vs: [285, 430, 610], density: [1850, 1980, 2150], damping: [0.05, 0.035, 0.025], poisson: [0.33, 0.3, 0.27], groundwater: 48, weight: 0.25 },
      { code: "BEST", type: "BEST_ESTIMATE", boundaries: [0, 6, 21, 34], vs: [320, 480, 650], density: [1880, 2020, 2180], damping: [0.045, 0.032, 0.023], poisson: [0.32, 0.29, 0.26], groundwater: 48, weight: 0.5 },
      { code: "UPPER", type: "UPPER_BOUND", boundaries: [0, 5, 18, 29], vs: [360, 540, 720], density: [1920, 2070, 2220], damping: [0.04, 0.029, 0.021], poisson: [0.31, 0.28, 0.25], groundwater: 48, weight: 0.25 },
    ];
}

function makeProperty(
  token: string,
  profileCode: string,
  layerIndex: number,
  propertyType: Property["propertyType"],
  value: number,
  units: string,
  sourceReference: string,
): Property {
  return {
    uuid: `SITE-PROP-${token}-${profileCode}-${layerIndex + 1}-${propertyType}`,
    name: propertyType === "SHEAR_WAVE_VELOCITY"
      ? "Small-strain shear-wave velocity"
      : propertyType === "DENSITY"
        ? "Total mass density"
        : propertyType === "DAMPING"
          ? "Small-strain damping ratio"
          : "Poisson ratio",
    propertyType,
    value,
    units,
    distribution: {
      type: DistributionType.NORMAL,
      mean: value,
      stdDev: propertyType === "SHEAR_WAVE_VELOCITY" ? value * 0.12 : propertyType === "DENSITY" ? value * 0.05 : value * 0.1,
    },
    correlationGroup: `${profileCode}-LAYER-${layerIndex + 1}`,
    sourceReference,
    basisAndLimitations: propertyType === "SHEAR_WAVE_VELOCITY"
      ? "Crosshole, downhole, and surface-wave measurements; profile branches carry the epistemic bounds."
      : propertyType === "DENSITY"
        ? "Laboratory and downhole density measurements."
        : "Laboratory dynamic-property testing with published analogs used only outside the measured strain range.",
  };
}

function makeProfiles(kind: ReactorKind, building: string, geotechnicalRef: string, velocityRef: string): Profile[] {
  const token = kind.toUpperCase();
  const names = kind === "sfr"
    ? ["Engineered fill and loess", "Dense alluvial gravel", "Fractured basalt and interbeds"]
    : ["Engineered fill and alluvium", "Cemented alluvium", "Weathered volcanic rock"];
  const materials = kind === "sfr"
    ? ["Compacted granular fill", "Dense gravel", "Fractured basalt"]
    : ["Dense granular soil", "Cemented granular soil", "Weathered volcanic rock"];
  return profileDefinitions(kind).map((definition) => {
    const layers: Layer[] = definition.vs.map((vs, layerIndex) => {
      const topDepth = definition.boundaries[layerIndex]!;
      const bottomDepth = definition.boundaries[layerIndex + 1]!;
      const damping = definition.damping[layerIndex]!;
      return {
        uuid: `SITE-LAYER-${token}-${definition.code}-${layerIndex + 1}`,
        name: names[layerIndex]!,
        materialType: materials[layerIndex]!,
        topDepth,
        bottomDepth,
        depthUnit: "m",
        thickness: bottomDepth - topDepth,
        properties: [
          makeProperty(token, definition.code, layerIndex, "SHEAR_WAVE_VELOCITY", vs, "m/s", velocityRef),
          makeProperty(token, definition.code, layerIndex, "DENSITY", definition.density[layerIndex]!, "kg/m3", geotechnicalRef),
          makeProperty(token, definition.code, layerIndex, "DAMPING", damping, "ratio", geotechnicalRef),
          makeProperty(token, definition.code, layerIndex, "POISSON_RATIO", definition.poisson[layerIndex]!, "ratio", geotechnicalRef),
        ],
        strainDependentProperties: [
          { shearStrain: 0.000001, modulusReductionRatio: 1, dampingRatio: damping },
          { shearStrain: 0.00001, modulusReductionRatio: 0.98, dampingRatio: damping + 0.003 },
          { shearStrain: 0.0001, modulusReductionRatio: 0.88, dampingRatio: damping + 0.012 },
          { shearStrain: 0.001, modulusReductionRatio: 0.62, dampingRatio: damping + 0.045 },
          { shearStrain: 0.005, modulusReductionRatio: 0.38, dampingRatio: damping + 0.09 },
          { shearStrain: 0.01, modulusReductionRatio: 0.27, dampingRatio: damping + 0.13 },
        ],
        spatialVariability: `Within-unit Vs coefficient of variation ${layerIndex === 0 ? "0.20" : layerIndex === 1 ? "0.16" : "0.12"} across the safety-related footprint.`,
        sourceReferences: [geotechnicalRef, velocityRef],
      };
    });
    return {
      uuid: `SITE-PROFILE-${token}-${definition.code}`,
      name: `${definition.code === "BEST" ? "Best-estimate" : definition.code === "LOWER" ? "Lower-velocity" : "Upper-velocity"} profile`,
      profileType: definition.type,
      locationDescription: `${building} safety-related footprint`,
      layers,
      depthToBedrock: definition.boundaries[3],
      depthUnit: "m",
      bedrockDefinition: "Competent material with shear-wave velocity at or above 760 m/s.",
      groundwaterDepth: definition.groundwater,
      profileWeight: definition.weight,
      siteVariabilityBasis: "Borehole-to-borehole velocity and layer-thickness variability is represented by weighted lower, best-estimate, and upper profiles.",
      sourceReferences: [geotechnicalRef, velocityRef],
      implementsSrs: srs("SHA-E1", "SHA-E3", "SHA-E5"),
    };
  });
}

function makeAmplificationPoints(kind: ReactorKind): SiteResponse["amplificationResults"][number]["points"] {
  const frequencies = [1, 2.5, 5, 10, 25];
  const levels = [0.05, 0.1, 0.2, 0.4, 0.8, 1.6, 3];
  const base = kind === "sfr" ? [1.1, 1.26, 1.58, 1.34, 0.88] : [1.06, 1.2, 1.46, 1.3, 0.9];
  return levels.flatMap((level) => frequencies.map((frequencyHz, frequencyIndex) => {
    const reduction = Math.max(0.68, 1 - 0.085 * Math.log2(Math.max(level / 0.1, 1)));
    const medianAmplification = Number((base[frequencyIndex]! * reduction).toFixed(3));
    const logarithmicStandardDeviation = Number((0.2 + frequencyIndex * 0.015 + Math.max(0, Math.log2(level / 0.2)) * 0.008).toFixed(3));
    return {
      inputGroundMotion: level,
      frequencyHz,
      medianAmplification,
      logarithmicStandardDeviation,
      fractileAmplifications: [
        { fractile: 0.05, amplification: Number((medianAmplification * Math.exp(-1.645 * logarithmicStandardDeviation)).toFixed(3)) },
        { fractile: 0.5, amplification: medianAmplification },
        { fractile: 0.95, amplification: Number((medianAmplification * Math.exp(1.645 * logarithmicStandardDeviation)).toFixed(3)) },
      ],
    };
  }));
}

export function populateSiteResponseAnalysis(mef: SeismicPRA, kind: ReactorKind, building: string): void {
  const siteResponse = mef.seismicHazardAnalysis.siteResponseAnalysis;
  const token = kind.toUpperCase();
  const geotechnicalRef = `EARTH-DATA-${token}-GEOTECHNICAL`;
  const velocityRef = `EARTH-DATA-${token}-VELOCITY`;
  const topographyRef = `EARTH-DATA-${token}-TOPOGRAPHY`;
  const referenceHorizonRef = `REF-HORIZON-${token}-ROCK`;
  const profiles = makeProfiles(kind, building, geotechnicalRef, velocityRef);
  const base = kind === "sfr" ? [1.1, 1.26, 1.58, 1.34, 0.88] : [1.06, 1.2, 1.46, 1.3, 0.9];
  const frequencies = [1, 2.5, 5, 10, 25];

  siteResponse.topographyAndGeology = {
    topographicDescription: kind === "sfr"
      ? "Broad basaltic plain with less than one-percent grade across the safety-related footprint."
      : "Engineered terrace with approximately 1.5-percent grade and no sharp ridge at the safety-related footprint.",
    topographicDataRefs: [topographyRef],
    surficialDepositDescription: kind === "sfr"
      ? "Engineered fill and loess over dense gravel and fractured basalt interbeds."
      : "Engineered fill over dense to cemented alluvium and weathered volcanic rock.",
    surficialGeologyDataRefs: [geotechnicalRef],
    geologicStructureDescription: kind === "sfr"
      ? "Subhorizontal basalt flows and sedimentary interbeds; competent basalt occurs 46 to 58 m below grade."
      : "Three subhorizontal units with competent volcanic rock 29 to 38 m below grade.",
    geotechnicalInvestigationRefs: [geotechnicalRef, velocityRef],
    topographicEffectsSignificant: false,
    topographicEffectsTreatment: "Two-dimensional screening shows less than five-percent amplification from 1 to 20 Hz, so explicit topographic factors are not required.",
    implementsSrs: srs("SHA-E1", "SHA-E5"),
  };
  siteResponse.profiles = profiles;
  siteResponse.methods = [
    {
      uuid: `SITE-METHOD-${token}-RVT`,
      name: "Equivalent-linear random-vibration analysis",
      dimension: "ONE_DIMENSIONAL",
      analysisType: "RANDOM_VIBRATION_THEORY",
      softwareAndVersion: "SiteResponse-RVT 3.4",
      methodDescription: "Random-vibration propagation through weighted profile and material-property branches at each hazard amplitude.",
      dimensionSelectionBasis: "Measured layering is nearly horizontal and two-dimensional screening found no material edge or topographic effect.",
      inputLocation: referenceHorizonRef,
      outputLocation: "CONTROL-POINT-FOUNDATION",
      boundaryConditions: "Vertically incident waves at a compliant base with free-field surface response.",
      materialModelDescription: "Iterative strain-compatible modulus-reduction and damping curves for each layer.",
      verificationAndValidation: "Benchmark profiles, frequency-domain transfer checks, and independent result review completed.",
      limitations: ["Primary method applies to the safety-related platform and represented one-dimensional profiles."],
      implementsSrs: srs("SHA-E3", "SHA-E5"),
    },
    {
      uuid: `SITE-METHOD-${token}-NL`,
      name: "Nonlinear time-domain sensitivity",
      dimension: "ONE_DIMENSIONAL",
      analysisType: "NONLINEAR",
      softwareAndVersion: "SiteResponse-NL 2.2",
      methodDescription: "Nonlinear wave propagation of eleven spectrum-compatible motions at four amplitude levels.",
      dimensionSelectionBasis: "One-dimensional geometry is retained to isolate constitutive-model and strong-motion nonlinear sensitivity.",
      inputLocation: referenceHorizonRef,
      outputLocation: "CONTROL-POINT-FOUNDATION",
      boundaryConditions: "Elastic half-space base with quiet lateral boundaries.",
      materialModelDescription: "Pressure-dependent hysteretic soil and rock models calibrated to the selected laboratory curves.",
      verificationAndValidation: "Cyclic-response checks, energy-balance checks, and comparison with the equivalent-linear median completed.",
      limitations: ["Sensitivity calculation is not independently weighted in the mean hazard."],
      implementsSrs: srs("SHA-E3", "SHA-E5"),
    },
  ];
  siteResponse.inputMotions = [
    {
      uuid: `SITE-MOTION-${token}-FAS`,
      name: "Reference-horizon Fourier spectra",
      inputType: "FOURIER_AMPLITUDE_SPECTRUM",
      referenceHorizonRef,
      groundMotionParameterRef: "GMP-SA-1HZ",
      amplitudeLevels: [0.05, 0.1, 0.2, 0.4, 0.8, 1.6, 3],
      units: "g",
      spectrumRef: `REFERENCE-FAS-${token}-2026`,
      selectionAndScalingBasis: "Conditional reference-horizon spectra span the hazard range without extrapolating beyond ground-motion model limits.",
    },
    {
      uuid: `SITE-MOTION-${token}-TH`,
      name: "Spectrum-compatible time-history suite",
      inputType: "TIME_HISTORY",
      referenceHorizonRef,
      groundMotionParameterRef: "GMP-SA-1HZ",
      amplitudeLevels: [0.1, 0.4, 0.8, 1.6],
      units: "g",
      timeHistoryRefs: Array.from({ length: 11 }, (_, index) => `SITE-TH-${token}-${String(index + 1).padStart(2, "0")}`),
      selectionAndScalingBasis: "Eleven motions preserve magnitude, distance, duration, and spectral-shape characteristics from hazard deaggregation.",
    },
  ];
  siteResponse.amplificationResults = [
    {
      uuid: `SITE-RESULT-${token}-WEIGHTED`,
      name: "Weighted foundation amplification",
      profileRefs: profiles.map((profile) => profile.uuid),
      methodRef: `SITE-METHOD-${token}-RVT`,
      inputMotionRef: `SITE-MOTION-${token}-FAS`,
      outputControlPointRef: "CONTROL-POINT-FOUNDATION",
      points: makeAmplificationPoints(kind),
      weightingAndCombinationMethod: "Profile weights 0.25, 0.50, and 0.25 are combined with material-property branches to obtain median and epistemic fractiles.",
      nonlinearEffectsTreatment: "Strain-compatible properties are iterated separately at each input amplitude.",
      uncertaintyTreatment: "Profile, velocity, thickness, dynamic-property, and method uncertainty are propagated to logarithmic standard deviation and 5th/95th fractiles.",
      implementsSrs: srs("SHA-E3", "SHA-E5"),
    },
    {
      uuid: `SITE-RESULT-${token}-NL`,
      name: "Nonlinear method sensitivity",
      profileRefs: profiles.map((profile) => profile.uuid),
      methodRef: `SITE-METHOD-${token}-NL`,
      inputMotionRef: `SITE-MOTION-${token}-TH`,
      outputControlPointRef: "CONTROL-POINT-FOUNDATION",
      points: [0.1, 0.4, 0.8, 1.6].flatMap((level) => frequencies.map((frequencyHz, frequencyIndex) => ({
        inputGroundMotion: level,
        frequencyHz,
        medianAmplification: Number((base[frequencyIndex]! * Math.max(0.63, 1 - 0.11 * Math.log2(Math.max(level / 0.1, 1)))).toFixed(3)),
        logarithmicStandardDeviation: Number((0.23 + frequencyIndex * 0.015).toFixed(3)),
      }))),
      weightingAndCombinationMethod: "The eleven motion results are summarized by profile and amplitude, then compared with the primary result.",
      nonlinearEffectsTreatment: "Hysteretic constitutive response is solved directly in the time domain.",
      uncertaintyTreatment: "Record-to-record variability and profile uncertainty are retained for method-sensitivity comparison.",
      implementsSrs: srs("SHA-E3", "SHA-E5"),
    },
  ];
  siteResponse.incorporationIntoHazardMethod = "Reference-rock hazard is convolved with weighted, amplitude-dependent foundation amplification at each spectral frequency.";
  siteResponse.uncertainties = [
    ["VS", "Velocity and density", "Measured velocity and density variability within and between profile branches.", "Correlated sampling by layer and profile.", ImportanceLevel.HIGH],
    ["DEPTH", "Layer thickness and bedrock depth", "Interpreted layer boundaries and depth to competent rock.", "Weighted lower, best-estimate, and upper profiles.", ImportanceLevel.HIGH],
    ["CURVES", "Dynamic-property curves", "Modulus-reduction and damping curves beyond directly tested strain levels.", "Alternative laboratory-curve branches by material.", ImportanceLevel.MEDIUM],
    ["SPATIAL", "Within-profile spatial variability", "Residual lateral variability across the safety-related footprint.", "Randomized layer properties with measured spatial correlation.", ImportanceLevel.MEDIUM],
    ["METHOD", "Site-response method form", "Equivalent-linear versus nonlinear response at high input motion.", "Nonlinear time-domain sensitivity against the primary result.", ImportanceLevel.MEDIUM],
  ].map(([code, name, description, propagationMethod, importance]) => ({
    uuid: `SITE-UNCERTAINTY-${token}-${code}`,
    name,
    uncertaintyType: "EPISTEMIC" as const,
    analysisArea: "SITE_RESPONSE" as const,
    description,
    affectedModelRefs: profiles.map((profile) => profile.uuid),
    affectedResultRefs: siteResponse.amplificationResults.map((result) => result.uuid),
    characterizationMethod: code === "VS" || code === "SPATIAL" ? "Measurement-based distributions and correlation models." : "Discrete technically defensible alternatives.",
    correlationAndDependencyTreatment: "Dependencies among velocity, density, depth, damping, and method branches are preserved during sampling.",
    propagationMethod,
    importance: importance as ImportanceLevel,
    riskSignificanceBasis: "Sensitivity of foundation hazard and downstream seismic risk across the modeled hazard range.",
    implementsSrs: srs("SHA-E3", "SHA-E5"),
  }));
  siteResponse.localSiteResponseIncluded = true;
  siteResponse.boundingSiteVariabilityIncluded = false;
  siteResponse.boundingSiteVariabilityTreatment = "Not applicable because this is an identified-site PRA.";
  siteResponse.approachJustification = "Site-specific topography, geology, velocity, density, dynamic properties, and bedrock depth support weighted one-dimensional response; two-dimensional and nonlinear calculations confirm the method limits.";
  siteResponse.implementsSrs = srs("SHA-E1", "SHA-E3", "SHA-E5");
}
