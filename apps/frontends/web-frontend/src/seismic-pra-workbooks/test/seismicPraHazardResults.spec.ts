import { createSeismicPraExample } from "../../../../../backends/web-backend/src/example-workbooks/seeds/seismic-pra-seed-factory";
import { seismicConformanceItems } from "../seismicPraConformance";
import { hazardCurveFanSeries, responseSpectrumFanSeries } from "../seismicPraHazardCharts";

describe("Seismic PRA hazard-result examples", () => {
  it.each(["htgr", "sfr"] as const)("provides complete HLR-F/G results for %s", (variant) => {
    const sha = createSeismicPraExample(variant).seismicHazardAnalysis;
    const quant = sha.hazardQuantification;
    const spectra = sha.responseSpectraEvaluation;

    expect(sha.analysisBasis.groundMotionParameters).toHaveLength(14);
    expect(quant.hazardCurves).toHaveLength(56);
    expect(quant.uniformHazardSpectra).toHaveLength(8);
    expect(quant.deaggregations).toHaveLength(9);
    expect(quant.seismicPraInputs.hazardIntervals).toHaveLength(8);
    expect(quant.sensitivityStudies).toHaveLength(8);
    expect(quant.keyUncertaintyFindings).toHaveLength(8);
    expect(spectra.controlPoints).toHaveLength(3);
    expect(spectra.horizontalSpectra).toHaveLength(4);
    expect(spectra.verticalSpectra).toHaveLength(4);
    expect(spectra.horizontalShapeBases).toHaveLength(3);
    expect(spectra.verticalSpectrumBases).toHaveLength(4);
    expect(spectra.foundationInputResponseSpectra).toHaveLength(3);

    for (const parameter of sha.analysisBasis.groundMotionParameters) {
      const curves = quant.hazardCurves.filter((curve) =>
        curve.groundMotionParameterRef === parameter.uuid);
      expect(curves).toHaveLength(4);
      expect(curves.filter((curve) => curve.statistic === "MEAN")).toHaveLength(1);
      expect(curves.filter((curve) => curve.statistic === "FRACTILE").map((curve) => curve.fractile))
        .toEqual([0.05, 0.5, 0.95]);
      for (const curve of curves) {
        expect(curve.points.length).toBeGreaterThanOrEqual(10);
        for (let index = 1; index < curve.points.length; index += 1) {
          expect(curve.points[index]!.groundMotion).toBeGreaterThan(curve.points[index - 1]!.groundMotion);
          expect(curve.points[index]!.annualFrequencyOfExceedance)
            .toBeLessThanOrEqual(curve.points[index - 1]!.annualFrequencyOfExceedance);
        }
      }
    }

    for (const deaggregation of quant.deaggregations) {
      expect(deaggregation.magnitudeDistanceBins.reduce((sum, item) => sum + item.contributionFraction, 0)).toBeCloseTo(1);
      expect(deaggregation.sourceContributions.reduce((sum, item) => sum + item.contributionFraction, 0)).toBeCloseTo(1);
      expect(deaggregation.groundMotionModelContributions.reduce((sum, item) => sum + item.contributionFraction, 0)).toBeCloseTo(1);
      expect(deaggregation.epsilonContributions?.reduce((sum, item) => sum + item.contributionFraction, 0)).toBeCloseTo(1);
    }

    const horizontalRefs = new Set(spectra.horizontalSpectra.map((spectrum) => spectrum.uuid));
    const verticalRefs = new Set(spectra.verticalSpectra.map((spectrum) => spectrum.uuid));
    expect(spectra.horizontalShapeBases.every((basis) => horizontalRefs.has(basis.spectrumRef))).toBe(true);
    expect(spectra.verticalSpectrumBases.every((basis) => verticalRefs.has(basis.spectrumRef))).toBe(true);
    expect(spectra.foundationInputResponseSpectra.every((input) =>
      input.horizontalSpectrumRefs.every((reference) => horizontalRefs.has(reference))
      && input.verticalSpectrumRef !== undefined
      && verticalRefs.has(input.verticalSpectrumRef))).toBe(true);

    const intervals = quant.seismicPraInputs.hazardIntervals;
    for (let index = 1; index < intervals.length; index += 1) {
      expect(intervals[index]!.lowerGroundMotion).toBe(intervals[index - 1]!.upperGroundMotion);
    }
    expect(quant.seismicPraInputs.plantResponseInputRefs)
      .toEqual(intervals.map((interval) => interval.uuid));
  });

  it("uses reactor-specific hazard and spectral values", () => {
    const htgr = createSeismicPraExample("htgr").seismicHazardAnalysis;
    const sfr = createSeismicPraExample("sfr").seismicHazardAnalysis;
    const oneHertz = (sha: typeof htgr): number | undefined =>
      sha.responseSpectraEvaluation.horizontalSpectra
        .find((spectrum) => spectrum.uuid === "UHS-1E-4-H")
        ?.points.find((point) => point.frequencyHz === 1)
        ?.spectralAcceleration;

    expect(oneHertz(htgr)).toBe(0.36);
    expect(oneHertz(sfr)).toBe(0.42);
    expect(
      htgr.hazardQuantification.deaggregations.find((result) =>
        result.groundMotionParameterRef === "GMP-SA-1HZ"
        && result.annualFrequencyOfExceedance === 1e-4)?.meanDistanceKm,
    ).not.toBe(
      sfr.hazardQuantification.deaggregations.find((result) =>
        result.groundMotionParameterRef === "GMP-SA-1HZ"
        && result.annualFrequencyOfExceedance === 1e-4)?.meanDistanceKm,
    );
  });

  it.each(["htgr", "sfr"] as const)("builds ordered hazard and spectrum distribution bands for %s", (variant) => {
    const mef = createSeismicPraExample(variant);
    const hazard = hazardCurveFanSeries(mef, "GMP-SA-1HZ");
    const horizontalSpectrum = responseSpectrumFanSeries(mef, "HORIZONTAL", 1e-4);
    const verticalSpectrum = responseSpectrumFanSeries(mef, "VERTICAL", 1e-5);

    expect(hazard.length).toBeGreaterThanOrEqual(10);
    expect(horizontalSpectrum).toHaveLength(7);
    expect(verticalSpectrum).toHaveLength(7);
    for (const series of [hazard, horizontalSpectrum, verticalSpectrum]) {
      for (let index = 0; index < series.length; index += 1) {
        const point = series[index]!;
        expect(point.low).toBeLessThanOrEqual(point.median);
        expect(point.median).toBeLessThanOrEqual(point.mean);
        expect(point.mean).toBeLessThanOrEqual(point.high);
        if (index > 0) expect(point.x).toBeGreaterThan(series[index - 1]!.x);
      }
    }
  });

  it("returns no fan when a required fractile is unavailable", () => {
    const mef = createSeismicPraExample("htgr");
    mef.seismicHazardAnalysis.hazardQuantification.hazardCurves =
      mef.seismicHazardAnalysis.hazardQuantification.hazardCurves
        .filter((curve) =>
          curve.groundMotionParameterRef !== "GMP-SA-1HZ"
          || curve.fractile !== 0.95);

    expect(hazardCurveFanSeries(mef, "GMP-SA-1HZ")).toEqual([]);
    expect(responseSpectrumFanSeries(mef, "HORIZONTAL", 1e-4)).toHaveLength(6);
  });
});

describe("Seismic PRA HLR-F/G readiness", () => {
  function status(
    mef: ReturnType<typeof createSeismicPraExample>,
    requirement: string,
  ): string | undefined {
    return seismicConformanceItems(mef).find((item) => item.id === requirement)?.status;
  }

  it.each(["htgr", "sfr"] as const)("reports complete hazard-result evidence for %s", (variant) => {
    const statuses = Object.fromEntries(
      seismicConformanceItems(createSeismicPraExample(variant))
        .filter((item) => item.id.startsWith("SHA-F") || item.id.startsWith("SHA-G"))
        .map((item) => [item.id, item.status]),
    );

    expect(statuses).toEqual({
      "SHA-F1": "ok",
      "SHA-F2": "ok",
      "SHA-F3": "ok",
      "SHA-F4": "ok",
      "SHA-G1": "ok",
      "SHA-G2": "ok",
    });
  });

  it("requires mean and fractile curves for every motion parameter", () => {
    const mef = createSeismicPraExample("htgr");
    const parameterRef = mef.seismicHazardAnalysis.analysisBasis.groundMotionParameters[0]!.uuid;
    mef.seismicHazardAnalysis.hazardQuantification.hazardCurves =
      mef.seismicHazardAnalysis.hazardQuantification.hazardCurves
        .filter((curve) => curve.groundMotionParameterRef !== parameterRef || curve.statistic === "MEAN");

    expect(status(mef, "SHA-F1")).toBe("warn");
  });

  it("requires complete PRA transfers and focused sensitivities", () => {
    const transfer = createSeismicPraExample("sfr");
    transfer.seismicHazardAnalysis.hazardQuantification.seismicPraInputs.secondaryHazardResultRefs = [];
    expect(status(transfer, "SHA-F2")).toBe("warn");

    const psha = createSeismicPraExample("sfr");
    psha.seismicHazardAnalysis.hazardQuantification.sensitivityStudies =
      psha.seismicHazardAnalysis.hazardQuantification.sensitivityStudies
        .filter((study) => study.elementSpecificProperties?.analysisArea !== "SOURCE");
    expect(status(psha, "SHA-F3")).toBe("warn");

    const vertical = createSeismicPraExample("sfr");
    vertical.seismicHazardAnalysis.hazardQuantification.sensitivityStudies =
      vertical.seismicHazardAnalysis.hazardQuantification.sensitivityStudies
        .filter((study) => study.elementSpecificProperties?.analysisArea !== "VERTICAL_MOTION");
    expect(status(vertical, "SHA-F4")).toBe("warn");
  });

  it("requires horizontal characteristic-shape and vertical method bases", () => {
    const horizontal = createSeismicPraExample("htgr");
    horizontal.seismicHazardAnalysis.responseSpectraEvaluation.horizontalShapeBases = [];
    expect(status(horizontal, "SHA-G1")).toBe("warn");

    const vertical = createSeismicPraExample("htgr");
    vertical.seismicHazardAnalysis.responseSpectraEvaluation.verticalSpectrumBases[0]!
      .stateOfKnowledgeAssessment = "";
    expect(status(vertical, "SHA-G2")).toBe("warn");
  });
});
