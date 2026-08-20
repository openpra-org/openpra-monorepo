import { createSeismicPraExample } from "../../../../../backends/web-backend/src/example-workbooks/seeds/seismic-pra-seed-factory";

describe("Seismic PRA earth-science examples", () => {
  it.each(["htgr", "sfr"] as const)("populates HLR-B coverage for %s", (variant) => {
    const sha = createSeismicPraExample(variant).seismicHazardAnalysis;
    const inputs = sha.earthScienceInputs;
    const disciplines = Array.from(new Set(inputs.dataSets.map((dataSet) => dataSet.discipline))).sort();
    const dataSetIds = new Set(inputs.dataSets.map((dataSet) => dataSet.uuid));
    const catalogEventIds = new Set(inputs.earthquakeCatalog.events.map((event) => event.uuid));
    const strongMotionDataSetIds = new Set(
      sha.groundMotionCharacterization.strongMotionDataSets.map((dataSet) => dataSet.uuid),
    );
    const catalogTypeCounts = Object.fromEntries(
      ["HISTORICAL", "INSTRUMENTAL", "PALEOSEISMIC"].map((recordType) => [
        recordType,
        inputs.earthquakeCatalog.events.filter((event) => event.recordType === recordType).length,
      ]),
    );

    expect(inputs.dataSets).toHaveLength(8);
    expect(disciplines).toEqual([
      "GEOLOGY",
      "GEOPHYSICS",
      "GEOTECHNICAL",
      "PALEOSEISMOLOGY",
      "SEISMOLOGY",
      "STRONG_MOTION",
      "TOPOGRAPHY",
    ]);
    expect(inputs.dataSets.every((dataSet) =>
      dataSet.sourceReference.length > 0
      && dataSet.spatialCoverage.length > 0
      && dataSet.qualityAndLimitations.length > 0
      && dataSet.currentnessAssessment.length > 0)).toBe(true);

    expect(inputs.studyRegions).toHaveLength(1);
    expect(inputs.studyRegions[0]?.radialExtentKm).toBe(500);
    expect(inputs.modelAndMethodInventory).toHaveLength(6);
    expect(inputs.modelAndMethodInventory.every((item) =>
      item.sourceReference.length > 0
      && item.applicability.length > 0
      && item.potentialImpactOnHazard.length > 0
      && item.dispositionBasis.length > 0)).toBe(true);

    expect(inputs.earthquakeCatalog.events).toHaveLength(6);
    expect(catalogTypeCounts).toEqual({
      HISTORICAL: 2,
      INSTRUMENTAL: 2,
      PALEOSEISMIC: 2,
    });
    expect(sha.sourceCharacterization.earthquakeSources
      .flatMap((source) => source.sourceDataRefs)
      .every((reference) => dataSetIds.has(reference))).toBe(true);
    expect(sha.sourceCharacterization.earthquakeSources
      .flatMap((source) => source.historicalAndInstrumentalEventRefs)
      .every((reference) => catalogEventIds.has(reference))).toBe(true);
    expect(sha.groundMotionCharacterization.strongMotionDataSets
      .filter((dataSet) => dataSet.uuid.includes(variant.toUpperCase()))
      .every((dataSet) => dataSetIds.has(dataSet.sourceReference))).toBe(true);
    expect(sha.groundMotionCharacterization.predictionModels
      .flatMap((model) => model.calibrationDataRefs)
      .every((reference) => strongMotionDataSetIds.has(reference))).toBe(true);
  });

  it("uses reactor-specific regional evidence", () => {
    const htgr = createSeismicPraExample("htgr").seismicHazardAnalysis.earthScienceInputs;
    const sfr = createSeismicPraExample("sfr").seismicHazardAnalysis.earthScienceInputs;

    expect(htgr.studyRegions[0]?.tectonicSetting).not.toBe(sfr.studyRegions[0]?.tectonicSetting);
    expect(htgr.earthquakeCatalog.events.map((event) => event.uuid))
      .not.toEqual(sfr.earthquakeCatalog.events.map((event) => event.uuid));
    expect(htgr.dataSets.every((dataSet) => dataSet.uuid.includes("HTGR"))).toBe(true);
    expect(sfr.dataSets.every((dataSet) => dataSet.uuid.includes("SFR"))).toBe(true);
  });
});
