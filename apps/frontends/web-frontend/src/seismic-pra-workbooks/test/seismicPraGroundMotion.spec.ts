import { createSeismicPraExample } from "../../../../../backends/web-backend/src/example-workbooks/seeds/seismic-pra-seed-factory";

describe("Seismic PRA shared ground-motion definitions", () => {
  it.each(["htgr", "sfr"] as const)("populates a realistic control-point set for %s", (variant) => {
    const parameters = createSeismicPraExample(variant).seismicHazardAnalysis.analysisBasis.groundMotionParameters;
    const spectralParameters = parameters.filter((parameter) => parameter.parameterType === "SPECTRAL_ACCELERATION");
    const pgaParameters = parameters.filter((parameter) => parameter.parameterType === "PEAK_GROUND_ACCELERATION");

    expect(parameters).toHaveLength(14);
    expect(spectralParameters).toHaveLength(12);
    expect(pgaParameters).toHaveLength(2);

    for (const direction of ["GEOMETRIC_MEAN_HORIZONTAL", "VERTICAL"] as const) {
      expect(spectralParameters
        .filter((parameter) => parameter.direction === direction)
        .map((parameter) => parameter.oscillatorFrequencyHz))
        .toEqual([0.5, 1, 2.5, 5, 10, 25]);
      expect(pgaParameters.find((parameter) => parameter.direction === direction)?.selectedFrequencyRangeHz)
        .toEqual({ lower: 100, upper: 100 });
    }

    for (const parameter of parameters) {
      expect(parameter.usedForHazard).toBe(true);
      expect(parameter.usedForFragility).toBe(true);
      expect(parameter.usedForPlantResponse).toBe(true);
      expect(parameter.selectedRange.maximum).toBeGreaterThan(parameter.selectedRange.minimum);
    }
  });
});
