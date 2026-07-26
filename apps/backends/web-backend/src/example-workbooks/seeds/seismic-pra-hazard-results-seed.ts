import { type SRReference } from "interfaces-mef-types/core/pra-common";
import { ImportanceLevel } from "interfaces-mef-types/core/shared-patterns";
import { type SeismicPRA } from "interfaces-mef-types/seismic/seismic-pra";

type ReactorKind = "sfr" | "htgr";
type GroundMotionParameter =
  SeismicPRA["seismicHazardAnalysis"]["analysisBasis"]["groundMotionParameters"][number];
type HazardCurve =
  SeismicPRA["seismicHazardAnalysis"]["hazardQuantification"]["hazardCurves"][number];
type ResponseSpectrum =
  SeismicPRA["seismicHazardAnalysis"]["hazardQuantification"]["uniformHazardSpectra"][number];
type HazardUncertainty =
  SeismicPRA["seismicHazardAnalysis"]["uncertainties"][number];

const round = (value: number, significantDigits = 5): number =>
  Number(value.toPrecision(significantDigits));

function srs(...codes: string[]): SRReference[] {
  return codes.map((sr) => ({
    sr,
    hlr: sr.split("-")[1]!.charAt(0) as SRReference["hlr"],
  }));
}

function parameterFrequency(parameter: GroundMotionParameter): number {
  return parameter.parameterType === "PEAK_GROUND_ACCELERATION"
    ? 100
    : parameter.selectedFrequencyRangeHz.lower;
}

function referenceMotion(
  parameter: GroundMotionParameter,
  kind: ReactorKind,
): number {
  const horizontalAtOneInTenThousand: Record<number, number> = {
    0.5: kind === "sfr" ? 0.31 : 0.27,
    1: kind === "sfr" ? 0.42 : 0.36,
    2.5: kind === "sfr" ? 0.64 : 0.55,
    5: kind === "sfr" ? 0.82 : 0.71,
    10: kind === "sfr" ? 0.75 : 0.65,
    25: kind === "sfr" ? 0.56 : 0.48,
    100: kind === "sfr" ? 0.49 : 0.42,
  };
  const horizontal = horizontalAtOneInTenThousand[parameterFrequency(parameter)] ?? 0.4;
  if (parameter.direction !== "VERTICAL") return horizontal;

  const verticalRatio: Record<number, number> = {
    0.5: 0.58,
    1: 0.6,
    2.5: 0.64,
    5: 0.69,
    10: 0.73,
    25: 0.78,
    100: 0.75,
  };
  return horizontal * (verticalRatio[parameterFrequency(parameter)] ?? 0.7);
}

function curveSlope(parameter: GroundMotionParameter): number {
  const frequency = parameterFrequency(parameter);
  return 3.05 + Math.min(0.55, Math.log10(Math.max(frequency, 0.5)) * 0.22);
}

function annualFrequencyAtMotion(
  parameter: GroundMotionParameter,
  kind: ReactorKind,
  groundMotion: number,
  factor = 1,
): number {
  const frequency = 1e-4
    * Math.pow(groundMotion / referenceMotion(parameter, kind), -curveSlope(parameter))
    * factor;
  return round(Math.min(0.2, Math.max(1e-10, frequency)));
}

function motionAtAnnualFrequency(
  parameter: GroundMotionParameter,
  kind: ReactorKind,
  annualFrequency: number,
): number {
  return round(
    referenceMotion(parameter, kind)
      * Math.pow(1e-4 / annualFrequency, 1 / curveSlope(parameter)),
    4,
  );
}

function curveId(
  parameter: GroundMotionParameter,
  statistic: HazardCurve["statistic"],
  fractile?: number,
): string {
  if (parameter.uuid === "GMP-SA-1HZ" && statistic === "MEAN") {
    return "HAZARD-CURVE-MEAN-1HZ";
  }
  const suffix = statistic === "MEAN"
    ? "MEAN"
    : `P${String(Math.round((fractile ?? 0) * 100)).padStart(2, "0")}`;
  return `HAZARD-CURVE-${parameter.uuid}-${suffix}`;
}

function contributionRows<T extends { uuid: string; name?: string }>(
  records: T[],
  fractions: number[],
  fallbackPrefix: string,
) {
  return fractions.map((contributionFraction, index) => ({
    contributorRef: records[index]?.uuid ?? `${fallbackPrefix}-${index + 1}`,
    contributorName: records[index]?.name ?? `${fallbackPrefix} ${index + 1}`,
    contributionFraction,
  }));
}

export function populateHazardResults(
  mef: SeismicPRA,
  kind: ReactorKind,
  building: string,
): ResponseSpectrum["points"] {
  const isSfr = kind === "sfr";
  const token = kind.toUpperCase();
  const sha = mef.seismicHazardAnalysis;
  const parameters = sha.analysisBasis.groundMotionParameters;
  const horizontalParameters = parameters.filter((item) => item.direction !== "VERTICAL");
  const verticalParameters = parameters.filter((item) => item.direction === "VERTICAL");
  const sourceRecords = sha.sourceCharacterization.earthquakeSources.slice(0, 4);
  const groundMotionModels = sha.groundMotionCharacterization.predictionModels.slice(0, 4);

  sha.responseSpectraEvaluation.controlPoints = [
    {
      uuid: "CONTROL-POINT-FOUNDATION",
      name: "Safety-related foundation",
      controlPointType: "FOUNDATION",
      locationDescription: `Basemat elevation of the ${building}`,
      elevation: isSfr ? 794 : 1448,
      elevationUnit: "m",
      applicableStructureRefs: ["STRUCTURE-REACTOR-BUILDING"],
      basis: "Common hazard, response, fragility, and plant-response control point.",
    },
    {
      uuid: "CONTROL-POINT-FREE-FIELD",
      name: "Free-field surface",
      controlPointType: "FREE_FIELD",
      locationDescription: "Instrumented free-field location outside the structure-soil interaction zone",
      elevation: isSfr ? 812 : 1460,
      elevationUnit: "m",
      coordinateReference: isSfr ? "43.1860 N, 116.4210 W" : "35.6420 N, 112.2840 W",
      transferFunctionRef: `SITE-AMPLIFICATION-${token}-WEIGHTED`,
      basis: "Surface-motion check point for site-response and field-instrument comparisons.",
    },
    {
      uuid: "CONTROL-POINT-REFERENCE-ROCK",
      name: "Reference-rock horizon",
      controlPointType: "REFERENCE_HORIZON",
      locationDescription: isSfr
        ? "Top of competent volcanic rock beneath the weathered interval"
        : "Competent carbonate rock below the surficial alluvium",
      elevation: isSfr ? 760 : 1426,
      elevationUnit: "m",
      transferFunctionRef: `SITE-AMPLIFICATION-${token}-WEIGHTED`,
      basis: "Input horizon shared by the source-to-site and site-response calculations.",
    },
  ];

  const curveMotionGrid = [0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.4, 0.8, 1.2, 1.5, 2, 2.5, 3];
  const curveDefinitions: {
    statistic: HazardCurve["statistic"];
    fractile?: number;
    frequencyFactor: number;
    label: string;
  }[] = [
    { statistic: "MEAN", frequencyFactor: 1, label: "Mean" },
    { statistic: "FRACTILE", fractile: 0.05, frequencyFactor: 0.38, label: "5th-fractile" },
    { statistic: "FRACTILE", fractile: 0.5, frequencyFactor: 0.82, label: "50th-fractile" },
    { statistic: "FRACTILE", fractile: 0.95, frequencyFactor: 2.35, label: "95th-fractile" },
  ];

  sha.hazardQuantification.hazardCurves = parameters.flatMap((parameter) => {
    const maximum = parameter.selectedRange.maximum;
    const motionValues = Array.from(new Set([
      ...curveMotionGrid.filter((value) => value <= maximum),
      maximum,
    ])).sort((a, b) => a - b);
    return curveDefinitions.map(({ statistic, fractile, frequencyFactor, label }) => ({
      uuid: curveId(parameter, statistic, fractile),
      name: `${label} ${parameter.name} hazard curve`,
      groundMotionParameterRef: parameter.uuid,
      controlPointRef: "CONTROL-POINT-FOUNDATION",
      direction: parameter.direction,
      statistic,
      fractile,
      groundMotionUnits: parameter.units,
      frequencyUnit: "per plant-year",
      points: motionValues.map((groundMotion) => ({
        groundMotion,
        annualFrequencyOfExceedance: annualFrequencyAtMotion(
          parameter,
          kind,
          groundMotion,
          frequencyFactor,
        ),
      })),
      interpolationMethod: "Log-log linear interpolation between calculated points",
      extrapolationMethod: "Terminal three-point log-linear slope, limited by the calculation bounds",
      calculationRunRef: "HAZARD-RUN-2026",
      implementsSrs: srs("SHA-F1"),
    }));
  });

  const annualFrequencies = [1e-3, 1e-4, 1e-5, 1e-6];
  const spectrumParameterOrder = (direction: "HORIZONTAL" | "VERTICAL") => {
    const set = direction === "HORIZONTAL" ? horizontalParameters : verticalParameters;
    return set
      .filter((parameter) =>
        parameter.parameterType === "PEAK_GROUND_ACCELERATION"
        || [0.5, 1, 2.5, 5, 10, 25].includes(parameterFrequency(parameter)))
      .sort((left, right) => parameterFrequency(right) - parameterFrequency(left));
  };
  const spectrumPoints = (
    direction: "HORIZONTAL" | "VERTICAL",
    annualFrequency: number,
  ): ResponseSpectrum["points"] =>
    spectrumParameterOrder(direction).map((parameter) => {
      const frequencyHz = parameterFrequency(parameter);
      return {
        periodSeconds: round(1 / frequencyHz, 4),
        frequencyHz,
        spectralAcceleration: motionAtAnnualFrequency(parameter, kind, annualFrequency),
        units: "g",
      };
    });

  const spectra: ResponseSpectrum[] = annualFrequencies.flatMap((annualFrequency) => {
    const afeToken = `1E-${Math.abs(Math.round(Math.log10(annualFrequency)))}`;
    const horizontalId = annualFrequency === 1e-4 ? "UHS-1E-4-H" : `UHS-${afeToken}-H`;
    const verticalId = annualFrequency === 1e-4
      ? "VERTICAL-SPECTRUM-1E-4"
      : `VERTICAL-SPECTRUM-${afeToken}`;
    return [
      {
        uuid: horizontalId,
        name: `${afeToken} mean horizontal uniform hazard spectrum`,
        spectrumType: "UNIFORM_HAZARD",
        direction: "GEOMETRIC_MEAN_HORIZONTAL",
        controlPointRef: "CONTROL-POINT-FOUNDATION",
        annualFrequencyOfExceedance: annualFrequency,
        dampingRatio: 0.05,
        statistic: "MEAN",
        points: spectrumPoints("HORIZONTAL", annualFrequency),
        derivationMethod: "Period-by-period interpolation of the mean horizontal hazard curves.",
        sourceHazardCurveRefs: horizontalParameters.map((parameter) =>
          curveId(parameter, "MEAN")),
        implementsSrs: srs("SHA-F1", "SHA-G1"),
      },
      {
        uuid: verticalId,
        name: `${afeToken} mean vertical hazard-consistent spectrum`,
        spectrumType: "VERTICAL_HAZARD_CONSISTENT",
        direction: "VERTICAL",
        controlPointRef: "CONTROL-POINT-FOUNDATION",
        annualFrequencyOfExceedance: annualFrequency,
        dampingRatio: 0.05,
        statistic: "MEAN",
        points: spectrumPoints("VERTICAL", annualFrequency),
        derivationMethod: "Vertical-GMPE hazard integration at the common annual exceedance frequency.",
        sourceHazardCurveRefs: verticalParameters.map((parameter) =>
          curveId(parameter, "MEAN")),
        implementsSrs: srs("SHA-F1", "SHA-G2"),
      },
    ];
  });
  sha.hazardQuantification.uniformHazardSpectra = spectra;

  sha.hazardQuantification.calculationRuns = [
    {
      uuid: "HAZARD-RUN-2026",
      name: "Integrated production hazard calculation",
      calculationDate: "2026-05-21",
      software: "OpenPSHA",
      softwareVersion: "4.0",
      sourceModelRef: `SOURCE-MODEL-${token}-2026`,
      groundMotionModelRef: `GROUND-MOTION-MODEL-${token}-2026`,
      siteResponseModelRefs: [
        `SITE-RESPONSE-${token}-EQL`,
        `SITE-RESPONSE-${token}-NL`,
      ],
      logicTreeEndBranchCount: 6912,
      numericalIntegrationMethod: "Adaptive magnitude-distance-epsilon integration over every logic-tree end branch.",
      magnitudeStep: 0.1,
      distanceStepKm: 1,
      annualFrequencyRange: { minimum: 1e-10, maximum: 0.2 },
      convergenceCriteria: "Less than one percent change in risk-range hazard after grid refinement.",
      convergenceDemonstration: "Halving magnitude, distance, and motion grids changed 1E-4 to 1E-6 hazard ordinates by 0.3 to 0.8 percent.",
      verificationChecks: [
        "Source and ground-motion branch weights sum to one",
        "Mean curves are monotonic",
        "5th, 50th, and 95th fractiles are ordered",
        "Deaggregation contributions sum to one",
        "UHS ordinates reproduce the target annual frequencies",
      ],
      warningsAndLimitations: [
        "Hazard below 1E-9 per plant-year uses controlled terminal-slope extrapolation.",
      ],
      outputFileRefs: [`SHA-${token}-RESULTS-2026.H5`, `SHA-${token}-QA-2026.PDF`],
      implementsSrs: srs("SHA-F1", "SHA-F2"),
    },
    {
      uuid: "HAZARD-RUN-CHECK-2026",
      name: "Independent calculation check",
      calculationDate: "2026-05-28",
      software: "HazardCheck",
      softwareVersion: "2.6",
      sourceModelRef: `SOURCE-MODEL-${token}-2026`,
      groundMotionModelRef: `GROUND-MOTION-MODEL-${token}-2026`,
      siteResponseModelRefs: [`SITE-RESPONSE-${token}-EQL`],
      logicTreeEndBranchCount: 288,
      numericalIntegrationMethod: "Independent fixed-grid calculation of selected mean branches and motion levels.",
      magnitudeStep: 0.2,
      distanceStepKm: 2,
      annualFrequencyRange: { minimum: 1e-7, maximum: 1e-3 },
      convergenceCriteria: "Production and independent ordinates agree within five percent.",
      convergenceDemonstration: "Twenty-eight check ordinates agreed within 1.2 to 3.9 percent.",
      verificationChecks: [
        "Independent code and analyst",
        "Selected source and GMM branches reproduced",
        "PGA, 1 Hz, and 5 Hz spot checks completed",
      ],
      warningsAndLimitations: ["Check run evaluates selected branches rather than the full production tree."],
      outputFileRefs: [`SHA-${token}-INDEPENDENT-CHECK-2026.XLSX`],
      implementsSrs: srs("SHA-F1"),
    },
  ];

  const primaryDeaggregationParameters = [
    parameters.find((parameter) => parameter.uuid === "GMP-H-PGA"),
    parameters.find((parameter) => parameter.uuid === "GMP-SA-1HZ"),
    parameters.find((parameter) => parameter.uuid.includes("H-SA-5HZ")),
  ].filter((parameter): parameter is GroundMotionParameter => Boolean(parameter));
  sha.hazardQuantification.deaggregations = primaryDeaggregationParameters.flatMap(
    (parameter, parameterIndex) =>
      [1e-4, 1e-5, 1e-6].map((annualFrequency, frequencyIndex) => {
        const motion = motionAtAnnualFrequency(parameter, kind, annualFrequency);
        const meanMagnitude = round(
          (isSfr ? 6.18 : 5.92) + parameterIndex * 0.08 + frequencyIndex * 0.17,
          3,
        );
        const meanDistanceKm = round(
          (isSfr ? 41 : 34) + parameterIndex * 7 + frequencyIndex * 6,
          3,
        );
        const afeToken = `1E-${Math.abs(Math.round(Math.log10(annualFrequency)))}`;
        return {
          uuid: `DEAGG-${parameter.uuid}-${afeToken}`,
          name: `${parameter.name} deaggregation at ${afeToken}`,
          groundMotionParameterRef: parameter.uuid,
          controlPointRef: "CONTROL-POINT-FOUNDATION",
          groundMotionLevel: motion,
          groundMotionUnits: parameter.units,
          annualFrequencyOfExceedance: annualFrequency,
          meanMagnitude,
          meanDistanceKm,
          magnitudeDistanceBins: [
            { magnitudeLower: 4.5, magnitudeUpper: 5.5, distanceLowerKm: 0, distanceUpperKm: 25, contributionFraction: 0.12 },
            { magnitudeLower: 5.5, magnitudeUpper: 6.5, distanceLowerKm: 0, distanceUpperKm: 25, contributionFraction: 0.24 },
            { magnitudeLower: 5.5, magnitudeUpper: 6.5, distanceLowerKm: 25, distanceUpperKm: 75, contributionFraction: 0.22 },
            { magnitudeLower: 6.5, magnitudeUpper: 7.5, distanceLowerKm: 25, distanceUpperKm: 75, contributionFraction: 0.18 },
            { magnitudeLower: 6.5, magnitudeUpper: 7.5, distanceLowerKm: 75, distanceUpperKm: 150, contributionFraction: 0.14 },
            { magnitudeLower: 7.5, magnitudeUpper: 8.5, distanceLowerKm: 150, distanceUpperKm: 300, contributionFraction: 0.1 },
          ],
          sourceContributions: contributionRows(
            sourceRecords,
            [0.42, 0.28, 0.18, 0.12],
            "Source",
          ),
          groundMotionModelContributions: contributionRows(
            groundMotionModels,
            [0.36, 0.29, 0.21, 0.14],
            "GMM",
          ),
          epsilonContributions: [
            { epsilonLower: -3, epsilonUpper: -1, contributionFraction: 0.04 },
            { epsilonLower: -1, epsilonUpper: 0, contributionFraction: 0.13 },
            { epsilonLower: 0, epsilonUpper: 1, contributionFraction: 0.31 },
            { epsilonLower: 1, epsilonUpper: 2, contributionFraction: 0.34 },
            { epsilonLower: 2, epsilonUpper: 3, contributionFraction: 0.18 },
          ],
          calculationRunRef: "HAZARD-RUN-2026",
          implementsSrs: srs("SHA-F1", "SHA-G1"),
        };
      }),
  );

  const oneHertz = parameters.find((parameter) => parameter.uuid === "GMP-SA-1HZ")!;
  const intervalBounds = [0.05, 0.1, 0.2, 0.4, 0.8, 1.2, 1.8, 2.5, 3];
  sha.hazardQuantification.seismicPraInputs.hazardIntervals = intervalBounds
    .slice(0, -1)
    .map((lower, index) => {
      const upper = intervalBounds[index + 1]!;
      return {
        uuid: `HAZARD-INTERVAL-${index + 1}`,
        name: `PRA bin ${index + 1}`,
        groundMotionParameterRef: oneHertz.uuid,
        controlPointRef: "CONTROL-POINT-FOUNDATION",
        lowerGroundMotion: lower,
        upperGroundMotion: upper,
        representativeGroundMotion: round(Math.sqrt(lower * upper), 3),
        groundMotionUnits: oneHertz.units,
        annualFrequency: round(
          Math.max(
            0,
            annualFrequencyAtMotion(oneHertz, kind, lower)
              - annualFrequencyAtMotion(oneHertz, kind, upper),
          ),
        ),
        frequencyUnit: "per plant-year",
        frequencyCalculationMethod: "Difference between mean-curve exceedance frequencies at the non-overlapping bin boundaries.",
        sourceHazardCurveRef: "HAZARD-CURVE-MEAN-1HZ",
        verticalMotionRef: "VERTICAL-SPECTRUM-1E-4",
        secondaryHazardResultRefs: index >= 3 ? ["LIQUEFACTION-HAZARD-RESULTS"] : [],
        usedByEventSequenceFamilyRefs: ["ESF-SEISMIC-DAMAGE"],
        implementsSrs: srs("SHA-F2", "SPR-E1"),
      };
    });

  const horizontalSpectra = spectra.filter((spectrum) => spectrum.direction !== "VERTICAL");
  const verticalSpectra = spectra.filter((spectrum) => spectrum.direction === "VERTICAL");
  sha.hazardQuantification.seismicPraInputs.fragilityInputSpectrumRefs = [
    "UHS-1E-4-H",
    "UHS-1E-5-H",
    "UHS-1E-6-H",
  ];
  sha.hazardQuantification.seismicPraInputs.plantResponseInputRefs =
    sha.hazardQuantification.seismicPraInputs.hazardIntervals.map((item) => item.uuid);
  sha.hazardQuantification.seismicPraInputs.eventSequenceQuantificationInputRefs = [
    "ESF-SEISMIC-DAMAGE",
  ];
  sha.hazardQuantification.seismicPraInputs.verticalMotionResultRefs =
    verticalSpectra.map((item) => item.uuid);
  sha.hazardQuantification.seismicPraInputs.secondaryHazardResultRefs = [
    "LIQUEFACTION-HAZARD-RESULTS",
  ];
  sha.hazardQuantification.seismicPraInputs.transferBasis =
    "Controlled mean hazard, common control point, non-overlapping bins, horizontal and vertical spectra, and retained secondary-hazard outputs.";
  sha.hazardQuantification.seismicPraInputs.consistencyChecks = [
    "Every ground-motion parameter has a mean and three fractile curves",
    "PRA bins are contiguous, non-overlapping, and reconcile to the mean 1 Hz curve",
    "Horizontal and vertical spectra use the same control point, damping, units, and annual frequency",
    "Fragility and plant-response references resolve to stored hazard results",
    "The upper bin extends beyond the fragility saturation range",
    "Retained secondary-hazard outputs are included in the quantification transfer",
  ];
  sha.hazardQuantification.seismicPraInputs.implementsSrs = srs("SHA-F2");

  const uncertainties: HazardUncertainty[] = [
    {
      uuid: `RESULT-UNCERTAINTY-${token}-SOURCE-RATE`,
      name: "Local-source recurrence",
      uncertaintyType: "EPISTEMIC",
      analysisArea: "SOURCE",
      description: "Alternative recurrence rates for the nearest mapped and distributed seismic sources.",
      affectedModelRefs: sourceRecords.map((source) => source.uuid),
      affectedResultRefs: ["HAZARD-CURVE-MEAN-1HZ", "UHS-1E-4-H"],
      characterizationMethod: "Weighted source-logic-tree branches informed by catalog and paleoseismic constraints.",
      propagationMethod: "Full end-branch integration",
      importance: ImportanceLevel.HIGH,
      riskSignificanceBasis: "Controls the low-frequency hazard slope across the dominant PRA bins.",
      implementsSrs: srs("SHA-F3"),
    },
    {
      uuid: `RESULT-UNCERTAINTY-${token}-MAX-MAGNITUDE`,
      name: "Maximum magnitude",
      uncertaintyType: "EPISTEMIC",
      analysisArea: "SOURCE",
      description: "Alternative maximum magnitudes for background and fault sources.",
      affectedModelRefs: sourceRecords.map((source) => source.uuid),
      affectedResultRefs: ["UHS-1E-5-H", "UHS-1E-6-H"],
      characterizationMethod: "Discrete logic-tree branches with tectonic analog constraints.",
      propagationMethod: "Full end-branch integration",
      importance: ImportanceLevel.MEDIUM,
      riskSignificanceBasis: "Influences the rare-motion tail and long-period spectral shape.",
      implementsSrs: srs("SHA-F3"),
    },
    {
      uuid: `RESULT-UNCERTAINTY-${token}-GMM-MEDIAN`,
      name: "Ground-motion median",
      uncertaintyType: "EPISTEMIC",
      analysisArea: "GROUND_MOTION",
      description: "Model-to-model differences in predicted median horizontal ground motion.",
      affectedModelRefs: groundMotionModels.map((model) => model.uuid),
      affectedResultRefs: horizontalSpectra.map((spectrum) => spectrum.uuid),
      characterizationMethod: "Weighted published, regional, and simulation-informed GMM branches.",
      propagationMethod: "Full end-branch integration",
      importance: ImportanceLevel.HIGH,
      riskSignificanceBasis: "Largest contributor to uncertainty in the risk-significant 2.5 to 10 Hz range.",
      implementsSrs: srs("SHA-F3"),
    },
    {
      uuid: `RESULT-UNCERTAINTY-${token}-SIGMA`,
      name: "Aleatory variability and truncation",
      uncertaintyType: "ALEATORY",
      analysisArea: "GROUND_MOTION",
      description: "Within-event and between-event residual variability, including the epsilon-tail limit.",
      affectedModelRefs: groundMotionModels.map((model) => model.uuid),
      affectedResultRefs: sha.hazardQuantification.hazardCurves.map((curve) => curve.uuid),
      characterizationMethod: "Model-specific sigma components with epsilon-3 integration and epsilon-4 sensitivity.",
      propagationMethod: "Integrated within every GMM branch",
      importance: ImportanceLevel.MEDIUM,
      riskSignificanceBasis: "Affects the slope of the upper hazard tail.",
      implementsSrs: srs("SHA-F3"),
    },
    {
      uuid: `RESULT-UNCERTAINTY-${token}-PROFILE`,
      name: "Site profile",
      uncertaintyType: "EPISTEMIC",
      analysisArea: "SITE_RESPONSE",
      description: "Alternative velocity, depth, damping, and modulus-reduction profiles.",
      affectedModelRefs: sha.siteResponseAnalysis.profiles.map((profile) => profile.uuid),
      affectedResultRefs: horizontalSpectra.map((spectrum) => spectrum.uuid),
      characterizationMethod: "Weighted lower, best-estimate, upper, and alternative geotechnical profiles.",
      propagationMethod: "Profile branches integrated with the source and GMM trees",
      importance: ImportanceLevel.HIGH,
      riskSignificanceBasis: "Controls amplification near the building response frequencies.",
      implementsSrs: srs("SHA-F4"),
    },
    {
      uuid: `RESULT-UNCERTAINTY-${token}-NONLINEAR`,
      name: "Nonlinear site response",
      uncertaintyType: "EPISTEMIC",
      analysisArea: "SITE_RESPONSE",
      description: "Equivalent-linear versus nonlinear treatment at high input motions.",
      affectedModelRefs: sha.siteResponseAnalysis.methods.map((method) => method.uuid),
      affectedResultRefs: ["UHS-1E-5-H", "UHS-1E-6-H"],
      characterizationMethod: "Method comparison at eight input-motion levels.",
      propagationMethod: "Logic-tree method branches with focused sensitivity cases",
      importance: ImportanceLevel.MEDIUM,
      riskSignificanceBasis: "Changes high-frequency motion in the upper PRA bins.",
      implementsSrs: srs("SHA-F4"),
    },
    {
      uuid: `RESULT-UNCERTAINTY-${token}-VERTICAL`,
      name: "Vertical-motion model",
      uncertaintyType: "EPISTEMIC",
      analysisArea: "VERTICAL_MOTION",
      description: "Vertical GMM and period-dependent vertical-to-horizontal ratio alternatives.",
      affectedModelRefs: groundMotionModels.map((model) => model.uuid),
      affectedResultRefs: verticalSpectra.map((spectrum) => spectrum.uuid),
      characterizationMethod: "Vertical GMM calculation checked against empirical V/H ratios.",
      propagationMethod: "Alternative-model sensitivity at all target annual frequencies",
      importance: ImportanceLevel.MEDIUM,
      riskSignificanceBasis: "Affects vertical support, anchorage, and overturning failure modes.",
      implementsSrs: srs("SHA-F4", "SHA-G2"),
    },
    {
      uuid: `RESULT-UNCERTAINTY-${token}-SECONDARY`,
      name: "Liquefaction deformation",
      uncertaintyType: "EPISTEMIC",
      analysisArea: "SECONDARY_HAZARD",
      description: "Groundwater, cyclic resistance, and post-liquefaction settlement alternatives.",
      affectedModelRefs: ["LIQUEFACTION-ANALYSIS-1"],
      affectedResultRefs: ["LIQUEFACTION-HAZARD-RESULTS"],
      characterizationMethod: "Bounding groundwater and resistance cases conditioned on the PRA bins.",
      propagationMethod: "Conditional secondary-hazard sensitivity",
      importance: ImportanceLevel.LOW,
      riskSignificanceBasis: "Only the buried service corridor is exposed; the basemat is founded on competent material.",
      implementsSrs: srs("SHA-F4"),
    },
  ];
  sha.uncertainties = uncertainties;

  const studyDefinitions = [
    {
      key: "SOURCE-RATE",
      name: "Source recurrence weights",
      description: "Shift probability between lower, central, and upper recurrence-rate branches.",
      variedParameters: ["Local-source annual recurrence rate", "Background a-value"],
      parameterRanges: { "Local-source multiplier": [0.5, 2], "Background a-value shift": [-0.2, 0.2] } as Record<string, [number, number]>,
      results: "1E-5 annual-frequency SA(1 Hz) changes by -18% to +27%.",
      insights: "The nearest source controls the upper tail; distributed background controls frequent motions.",
      impact: "Changes upper-bin frequencies and the seismic-event-sequence ranking.",
      area: "SOURCE",
    },
    {
      key: "MAX-MAGNITUDE",
      name: "Maximum-magnitude alternatives",
      description: "Evaluate the supported maximum-magnitude range for the major sources.",
      variedParameters: ["Maximum magnitude"],
      parameterRanges: { "Maximum Mw": [6.5, 7.8] } as Record<string, [number, number]>,
      results: "Long-period 1E-6 UHS ordinates change by -11% to +19%.",
      insights: "Maximum magnitude matters primarily below 2.5 Hz and beyond the dominant PRA range.",
      impact: "Small change to total risk; retained for sequence-level sensitivity.",
      area: "SOURCE",
    },
    {
      key: "GMM-MEDIAN",
      name: "Ground-motion model weights",
      description: "Reweight empirical, regional, and simulation-informed GMM branches.",
      variedParameters: ["GMM branch weights", "Median adjustment"],
      parameterRanges: { "Regional model weight": [0.1, 0.45], "Median adjustment ln units": [-0.2, 0.2] } as Record<string, [number, number]>,
      results: "2.5 to 10 Hz mean hazard changes by -24% to +33%.",
      insights: "Regional attenuation is the dominant model-form uncertainty.",
      impact: "Material shift in equipment fragility convolution and top risk contributors.",
      area: "GROUND_MOTION",
    },
    {
      key: "SIGMA",
      name: "Sigma and epsilon tail",
      description: "Vary total sigma and extend epsilon integration from 3 to 4.",
      variedParameters: ["Total sigma", "Epsilon limit"],
      parameterRanges: { "Sigma multiplier": [0.9, 1.1], "Epsilon limit": [3, 4] } as Record<string, [number, number]>,
      results: "Extending to epsilon 4 increases 1E-7 tail hazard by 6% and total risk by 0.7%.",
      insights: "The selected epsilon-3 limit is adequate for quantification.",
      impact: "No sequence ranking change.",
      area: "GROUND_MOTION",
    },
    {
      key: "PROFILE",
      name: "Site-profile weighting",
      description: "Reweight the lower, best-estimate, upper, and alternative profiles.",
      variedParameters: ["Profile weights", "Shear-wave velocity"],
      parameterRanges: { "Best-estimate profile weight": [0.3, 0.6], "Vs multiplier": [0.85, 1.15] } as Record<string, [number, number]>,
      results: "5 to 10 Hz foundation motion changes by -16% to +22%.",
      insights: "Shallow velocity uncertainty overlaps the principal building modes.",
      impact: "Material for anchorage and relay fragilities.",
      area: "SITE_RESPONSE",
    },
    {
      key: "NONLINEAR",
      name: "Nonlinear site response",
      description: "Compare equivalent-linear and nonlinear site-response branches.",
      variedParameters: ["Material model", "Input-motion amplitude"],
      parameterRanges: { "Input PGA g": [0.05, 1.6], "Nonlinear branch weight": [0.15, 0.4] } as Record<string, [number, number]>,
      results: "Upper-bin high-frequency motion decreases 8% to 17% under nonlinear response.",
      insights: "Equivalent-linear analysis is conservative above 0.8 g for the controlling equipment frequencies.",
      impact: "Reduces, but does not eliminate, upper-bin risk.",
      area: "SITE_RESPONSE",
    },
    {
      key: "VERTICAL",
      name: "Vertical-motion method",
      description: "Compare vertical GMM integration with empirical V/H scaling.",
      variedParameters: ["Vertical GMM family", "V/H ratio"],
      parameterRanges: { "V/H multiplier": [0.85, 1.15] } as Record<string, [number, number]>,
      results: "Vertical spectral ordinates change by -13% to +18%.",
      insights: "The direct vertical-GMM result bounds the empirical ratio method at short periods.",
      impact: "Moderate effect on vertical anchorage failure modes.",
      area: "VERTICAL_MOTION",
    },
    {
      key: "SECONDARY",
      name: "Liquefaction deformation inputs",
      description: "Vary groundwater depth, cyclic resistance, and settlement conversion.",
      variedParameters: ["Groundwater depth", "Cyclic resistance ratio", "Settlement multiplier"],
      parameterRanges: { "Groundwater depth m": [3, 8], "CRR multiplier": [0.8, 1.2], "Settlement multiplier": [0.7, 1.4] } as Record<string, [number, number]>,
      results: "Conditional corridor-settlement frequency changes by a factor of 0.6 to 1.7.",
      insights: "The secondary hazard remains below the principal direct-shaking contributors.",
      impact: "No change to the leading event-sequence family.",
      area: "SECONDARY_HAZARD",
    },
  ];
  sha.hazardQuantification.sensitivityStudies = studyDefinitions.map((study) => ({
    uuid: `SENS-${token}-${study.key}`,
    name: study.name,
    description: study.description,
    variedParameters: study.variedParameters,
    parameterRanges: study.parameterRanges,
    results: study.results,
    insights: study.insights,
    impact: study.impact,
    modelUncertaintyId: `RESULT-UNCERTAINTY-${token}-${study.key}`,
    implementsSrs: srs(study.area === "SOURCE" || study.area === "GROUND_MOTION" ? "SHA-F3" : "SHA-F4"),
    elementSpecificProperties: { analysisArea: study.area },
  }));
  sha.hazardQuantification.keyUncertaintyFindings = uncertainties.map((uncertainty) => {
    const suffix = uncertainty.uuid.replace(`RESULT-UNCERTAINTY-${token}-`, "");
    const studyRef = `SENS-${token}-${suffix}`;
    return {
      uuid: `FINDING-${token}-${suffix}`,
      name: uncertainty.name,
      uncertaintyRef: uncertainty.uuid,
      analysisArea: uncertainty.analysisArea,
      affectedResultRefs: uncertainty.affectedResultRefs,
      identificationMethod: "Production calculation and focused one-at-a-time sensitivity comparison.",
      sensitivityStudyRefs: [studyRef],
      effectOnResults: sha.hazardQuantification.sensitivityStudies.find((study) => study.uuid === studyRef)?.results ?? "",
      effectOnSeismicPraQuantification: sha.hazardQuantification.sensitivityStudies.find((study) => study.uuid === studyRef)?.impact ?? "",
      importance: uncertainty.importance ?? ImportanceLevel.LOW,
      implementsSrs: srs(
        uncertainty.analysisArea === "SOURCE" || uncertainty.analysisArea === "GROUND_MOTION"
          ? "SHA-F3"
          : "SHA-F4",
      ),
    };
  });

  sha.hazardQuantification.uncertaintyPropagationMethod =
    "Aleatory variability is integrated within each branch; epistemic source, GMM, and site-response alternatives are combined across the full logic tree.";
  sha.hazardQuantification.aleatoryUncertaintiesPropagated = true;
  sha.hazardQuantification.epistemicUncertaintiesPropagated = true;
  sha.hazardQuantification.resultQualityChecks = [
    "All 14 ground-motion parameters have mean, 5th, 50th, and 95th-fractile curves",
    "All curves are positive and monotonically decreasing",
    "Fractiles are ordered and bracket the central estimate",
    "Deaggregation source, GMM, magnitude-distance, and epsilon contributions each sum to one",
    "UHS ordinates reproduce their target annual frequency",
    "PRA intervals are contiguous, non-overlapping, and reconcile to the source curve",
    "Independent code checks agree within the acceptance criterion",
  ];
  sha.hazardQuantification.implementsSrs = srs("SHA-F1", "SHA-F2", "SHA-F3", "SHA-F4");

  const importantAfe = [1e-4, 1e-5, 1e-6];
  sha.responseSpectraEvaluation.horizontalSpectra = horizontalSpectra;
  sha.responseSpectraEvaluation.verticalSpectra = verticalSpectra;
  sha.responseSpectraEvaluation.horizontalShapeBases = importantAfe.map((annualFrequency) => {
    const afeToken = `1E-${Math.abs(Math.round(Math.log10(annualFrequency)))}`;
    const spectrumRef = annualFrequency === 1e-4 ? "UHS-1E-4-H" : `UHS-${afeToken}-H`;
    const deaggregation = sha.hazardQuantification.deaggregations.find((item) =>
      item.groundMotionParameterRef === "GMP-SA-1HZ"
      && item.annualFrequencyOfExceedance === annualFrequency);
    return {
      uuid: `HORIZONTAL-SHAPE-BASIS-${afeToken}`,
      name: `${afeToken} site-specific horizontal shape basis`,
      spectrumRef,
      groundMotionLevel: motionAtAnnualFrequency(oneHertz, kind, annualFrequency),
      groundMotionUnits: "g",
      meanMagnitude: deaggregation?.meanMagnitude ?? (isSfr ? 6.3 : 6.05),
      meanDistanceKm: deaggregation?.meanDistanceKm ?? (isSfr ? 47 : 40),
      controllingSourceRefs: sourceRecords.slice(0, 3).map((source) => source.uuid),
      characteristicShapeRefs: [
        `${token}-LOCAL-M6-R25-SHAPE`,
        `${token}-REGIONAL-M6P5-R75-SHAPE`,
        `${token}-BACKGROUND-M7-R150-SHAPE`,
      ],
      usesOrBoundsCharacteristicShapes: true,
      evaluationBasis: "The UHS is compared with magnitude-distance-source characteristic shapes and bounds their important period ranges.",
      implementsSrs: srs("SHA-G1"),
    };
  });
  sha.responseSpectraEvaluation.verticalSpectrumBases = verticalSpectra.map((spectrum) => ({
    uuid: `VERTICAL-BASIS-${spectrum.uuid}`,
    name: `${spectrum.name} method basis`,
    spectrumRef: spectrum.uuid,
    methodType: "VERTICAL_GMPE",
    methodDescription: "Direct integration of vertical GMM branches, checked against period-dependent empirical vertical-to-horizontal ratios.",
    dataAndModelRefs: groundMotionModels.map((model) => model.uuid),
    verticalToHorizontalRatios: spectrum.points.map((point, index) => {
      const horizontal = horizontalSpectra.find((item) =>
        item.annualFrequencyOfExceedance === spectrum.annualFrequencyOfExceedance)
        ?.points[index]?.spectralAcceleration ?? point.spectralAcceleration;
      return {
        periodSeconds: point.periodSeconds,
        frequencyHz: point.frequencyHz,
        ratio: round(point.spectralAcceleration / horizontal, 3),
      };
    }),
    stateOfKnowledgeAssessment: "The selected vertical GMMs and V/H checks cover the applicable magnitude, distance, tectonic setting, periods, and hard-rock site conditions.",
    appropriatenessJustification: "Direct vertical hazard integration avoids applying a single ratio across periods and preserves source and aleatory uncertainty.",
    limitations: [
      "Vertical recordings are less numerous than horizontal recordings at the longest periods.",
      "The 0.01-second point is treated as the rigid-response approximation.",
    ],
    implementsSrs: srs("SHA-G2"),
  }));
  sha.responseSpectraEvaluation.foundationInputResponseSpectra = importantAfe.map(
    (annualFrequency) => {
      const afeToken = `1E-${Math.abs(Math.round(Math.log10(annualFrequency)))}`;
      return {
        uuid: `FIRS-${afeToken}`,
        name: `${afeToken} foundation input response spectra`,
        structureRef: "STRUCTURE-REACTOR-BUILDING",
        controlPointRef: "CONTROL-POINT-FOUNDATION",
        horizontalSpectrumRefs: [
          annualFrequency === 1e-4 ? "UHS-1E-4-H" : `UHS-${afeToken}-H`,
        ],
        verticalSpectrumRef: annualFrequency === 1e-4
          ? "VERTICAL-SPECTRUM-1E-4"
          : `VERTICAL-SPECTRUM-${afeToken}`,
        soilStructureInteractionTreatment: "Foundation-level hazard is transferred consistently to the nonlinear soil-structure interaction model.",
        derivationMethod: "Pair the hazard-consistent horizontal and vertical spectra at the shared foundation control point and annual frequency.",
        applicabilityAndLimitations: "Applicable to the reactor building reference earthquake and scaling range; incoherence and spatial variation are evaluated in structural response.",
        implementsSrs: srs("SHA-G1", "SHA-G2", "SFR-B1"),
      };
    },
  );
  sha.responseSpectraEvaluation.downstreamConsistencyBasis =
    "SHA, SFR, and SPR use the same parameter identifiers, foundation control point, 5% damping, component definitions, units, and annual frequencies.";
  sha.responseSpectraEvaluation.implementsSrs = srs("SHA-G1", "SHA-G2");

  return horizontalSpectra.find((spectrum) => spectrum.uuid === "UHS-1E-4-H")!.points;
}
