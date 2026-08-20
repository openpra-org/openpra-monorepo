import { createSeismicPraExample } from "../../../../../backends/web-backend/src/example-workbooks/seeds/seismic-pra-seed-factory";

describe("Seismic PRA site-response examples", () => {
  it.each(["htgr", "sfr"] as const)("provides a complete identified-site response model for %s", (variant) => {
    const sha = createSeismicPraExample(variant).seismicHazardAnalysis;
    const site = sha.siteResponseAnalysis;

    expect(sha.analysisBasis.site.siteBasis).toBe("IDENTIFIED_SITE");
    expect(site.boundingSiteVariabilityIncluded).toBe(false);
    expect(site.profiles).toHaveLength(3);
    expect(site.profiles.reduce((sum, profile) => sum + (profile.profileWeight ?? 0), 0)).toBeCloseTo(1);
    expect(site.methods).toHaveLength(2);
    expect(site.inputMotions).toHaveLength(2);
    expect(site.amplificationResults).toHaveLength(2);
    expect(site.uncertainties).toHaveLength(5);

    for (const profile of site.profiles) {
      expect(profile.layers).toHaveLength(3);
      expect(profile.depthToBedrock).toBeGreaterThan(0);
      expect(profile.sourceReferences.length).toBeGreaterThanOrEqual(2);
      for (const layer of profile.layers) {
        const types = new Set(layer.properties.map((property) => property.propertyType));
        expect(types).toEqual(new Set([
          "SHEAR_WAVE_VELOCITY",
          "DENSITY",
          "DAMPING",
          "POISSON_RATIO",
        ]));
        expect(layer.strainDependentProperties).toHaveLength(6);
      }
    }

    const profileRefs = new Set(site.profiles.map((profile) => profile.uuid));
    const methodRefs = new Set(site.methods.map((method) => method.uuid));
    const inputRefs = new Set(site.inputMotions.map((input) => input.uuid));
    const horizonRefs = new Set(sha.groundMotionCharacterization.referenceHorizons.map((horizon) => horizon.uuid));
    const parameterRefs = new Set(sha.analysisBasis.groundMotionParameters.map((parameter) => parameter.uuid));
    for (const input of site.inputMotions) {
      expect(horizonRefs.has(input.referenceHorizonRef)).toBe(true);
      expect(parameterRefs.has(input.groundMotionParameterRef)).toBe(true);
      expect(input.amplitudeLevels.length).toBeGreaterThan(0);
    }
    for (const result of site.amplificationResults) {
      expect(methodRefs.has(result.methodRef)).toBe(true);
      expect(inputRefs.has(result.inputMotionRef)).toBe(true);
      expect(result.profileRefs.every((profileRef) => profileRefs.has(profileRef))).toBe(true);
      expect(result.outputControlPointRef).toBe("CONTROL-POINT-FOUNDATION");
      expect(result.points.length).toBeGreaterThan(0);
      expect(result.points.every((point) => point.logarithmicStandardDeviation !== undefined)).toBe(true);
    }
    expect(site.amplificationResults[0]?.points).toHaveLength(35);
    expect(site.amplificationResults[1]?.points).toHaveLength(20);
  });

  it("uses reactor-specific subsurface and amplification values", () => {
    const htgr = createSeismicPraExample("htgr").seismicHazardAnalysis.siteResponseAnalysis;
    const sfr = createSeismicPraExample("sfr").seismicHazardAnalysis.siteResponseAnalysis;

    expect(htgr.profiles[1]?.depthToBedrock).toBe(34);
    expect(sfr.profiles[1]?.depthToBedrock).toBe(52);
    expect(htgr.profiles[1]?.layers[0]?.properties.find((property) => property.propertyType === "SHEAR_WAVE_VELOCITY")?.value).toBe(320);
    expect(sfr.profiles[1]?.layers[0]?.properties.find((property) => property.propertyType === "SHEAR_WAVE_VELOCITY")?.value).toBe(270);
    expect(htgr.amplificationResults[0]?.points.find((point) => point.inputGroundMotion === 0.1 && point.frequencyHz === 5)?.medianAmplification).toBe(1.46);
    expect(sfr.amplificationResults[0]?.points.find((point) => point.inputGroundMotion === 0.1 && point.frequencyHz === 5)?.medianAmplification).toBe(1.58);
  });
});
