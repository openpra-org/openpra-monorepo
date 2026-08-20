import { createSeismicPraExample } from "../../../../../backends/web-backend/src/example-workbooks/seeds/seismic-pra-seed-factory";

describe("Seismic PRA source and ground-motion examples", () => {
  it.each(["htgr", "sfr"] as const)("populates a complete HLR-C and HLR-D technical package for %s", (variant) => {
    const sha = createSeismicPraExample(variant).seismicHazardAnalysis;
    const source = sha.sourceCharacterization;
    const ground = sha.groundMotionCharacterization;
    const dataSetIds = new Set(sha.earthScienceInputs.dataSets.map((item) => item.uuid));
    const catalogEventIds = new Set(sha.earthScienceInputs.earthquakeCatalog.events.map((item) => item.uuid));
    const parameterIds = new Set(sha.analysisBasis.groundMotionParameters.map((item) => item.uuid));
    const strongMotionIds = new Set(ground.strongMotionDataSets.map((item) => item.uuid));

    expect(source.earthquakeSources).toHaveLength(4);
    expect(source.earthquakeSources.filter((item) => item.majorHazardContributor).length).toBeGreaterThanOrEqual(3);
    expect(source.earthquakeSources.reduce((sum, item) => sum + item.magnitudeFrequencyModels.length, 0)).toBe(6);
    expect(source.sourceLogicTree.nodes).toHaveLength(3);
    expect(source.sourceLogicTree.totalEndBranchCount).toBe(12);
    expect(source.sourceLogicTree.nodes.every((node) =>
      Math.abs(node.branches.reduce((sum, branch) => sum + branch.weight, 0) - 1) < 1e-9)).toBe(true);
    expect(source.earthquakeSources.flatMap((item) => item.sourceDataRefs).every((reference) => dataSetIds.has(reference))).toBe(true);
    expect(source.earthquakeSources
      .flatMap((item) => [...(item.paleoseismicEventRefs ?? []), ...(item.historicalAndInstrumentalEventRefs ?? [])])
      .every((reference) => catalogEventIds.has(reference))).toBe(true);
    expect(source.existingModelAssessments).toHaveLength(1);
    expect(source.existingModelAssessments[0]).toMatchObject({
      updateRequired: true,
      resultingModelRef: source.sourceModelReference,
    });

    expect(ground.strongMotionDataSets).toHaveLength(3);
    expect(ground.predictionModels).toHaveLength(4);
    expect(ground.referenceHorizons).toHaveLength(2);
    expect(ground.uncertainties).toHaveLength(4);
    expect(ground.groundMotionLogicTree.nodes).toHaveLength(3);
    expect(ground.groundMotionLogicTree.totalEndBranchCount).toBe(24);
    expect(ground.groundMotionLogicTree.nodes.every((node) =>
      Math.abs(node.branches.reduce((sum, branch) => sum + branch.weight, 0) - 1) < 1e-9)).toBe(true);
    expect(ground.predictionModels.reduce((sum, item) => sum + item.logicTreeWeight, 0)).toBeCloseTo(1);
    expect(ground.predictionModels.every((item) =>
      item.supportedParameterRefs.length === parameterIds.size
      && item.supportedParameterRefs.every((reference) => parameterIds.has(reference))
      && item.calibrationDataRefs.every((reference) => strongMotionIds.has(reference))
      && item.sigmaComponents?.total !== undefined)).toBe(true);
    expect(ground.referenceHorizons.every((item) =>
      item.shearWaveVelocity > 0 && item.density > 0 && item.dampingRatio > 0)).toBe(true);
    expect(ground.existingModelAssessments).toHaveLength(1);
    expect(ground.existingModelAssessments[0]?.updateRequired).toBe(true);
  });

  it("uses reactor-specific source geometry and model weights", () => {
    const htgr = createSeismicPraExample("htgr").seismicHazardAnalysis;
    const sfr = createSeismicPraExample("sfr").seismicHazardAnalysis;

    expect(htgr.sourceCharacterization.earthquakeSources.map((item) => item.name))
      .not.toEqual(sfr.sourceCharacterization.earthquakeSources.map((item) => item.name));
    expect(htgr.sourceCharacterization.earthquakeSources[0]?.geometry.closestDistanceToSiteKm).toBe(32);
    expect(sfr.sourceCharacterization.earthquakeSources[0]?.geometry.closestDistanceToSiteKm).toBe(18);
    expect(htgr.groundMotionCharacterization.predictionModels.map((item) => item.logicTreeWeight))
      .not.toEqual(sfr.groundMotionCharacterization.predictionModels.map((item) => item.logicTreeWeight));
  });
});
