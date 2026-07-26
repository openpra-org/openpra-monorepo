import { createSeismicPraExample } from "../../../../../backends/web-backend/src/example-workbooks/seeds/seismic-pra-seed-factory";
import { SeismicPRASchema } from "interfaces-mef-types/zod/seismic/seismic-pra";
import { seismicConformanceItems } from "../seismicPraConformance";
import { structuralResponseFanSeries } from "../seismicPraHazardCharts";

describe("Seismic PRA Step 08 equipment scope", () => {
  it.each(["htgr", "sfr"] as const)(
    "provides a multidisciplinary controlled SEL for %s",
    (variant) => {
      const mef = createSeismicPraExample(variant);
      const sel =
        mef.seismicPlantResponseAnalysis.seismicEquipmentListDevelopment;
      const types = new Set(sel.equipment.map((item) => item.sscType));

      expect(sel.equipment.length).toBeGreaterThanOrEqual(20);
      expect(types).toEqual(expect.objectContaining(new Set([
        "STRUCTURE",
        "SYSTEM",
        "COMPONENT",
        "RELAY",
        "CABINET",
        "FLOOD_SOURCE",
        "FIRE_SOURCE",
        "OTHER",
      ])));
      expect(sel.internalFloodSourceRefs.length).toBeGreaterThanOrEqual(1);
      expect(sel.internalFireIgnitionSourceRefs.length).toBeGreaterThanOrEqual(2);
      expect(sel.secondaryHazardSscRefs).toEqual(["SEL-SECONDARY"]);
      expect(sel.additionalStructuresAndPassiveSscRefs.length).toBeGreaterThanOrEqual(3);
      expect(sel.completenessChecks.length).toBeGreaterThanOrEqual(6);
      expect(sel.failureModeIdentificationProcess.length).toBeGreaterThan(100);
      expect(sel.systemsFragilityAnalystCoordination.length).toBeGreaterThan(100);

      for (const item of sel.equipment) {
        expect(item.building.length).toBeGreaterThan(0);
        expect(item.mountingAndAnchorage.length).toBeGreaterThan(20);
        expect(item.creditedFunctions.length).toBeGreaterThan(0);
        expect(item.inclusionSources.length).toBeGreaterThan(0);
        expect(item.failureModes.length).toBeGreaterThan(0);
        expect(item.revisionHistory.length).toBeGreaterThanOrEqual(2);
        for (const mode of item.failureModes) {
          expect(mode.name.length).toBeGreaterThan(0);
          expect(mode.creditedFunction.length).toBeGreaterThan(0);
          expect(mode.systemModelBasicEventRefs.length).toBeGreaterThan(0);
          expect(mode.consequenceDescription.length).toBeGreaterThan(0);
        }
      }

      const active = sel.equipment.filter((item) => item.disposition === "ACTIVE");
      expect(active).toHaveLength(2);
      expect(active.every((item) =>
        item.fragilityAnalysisRef !== undefined
        && item.correlationGroupRefs.length > 0)).toBe(true);
      expect(mef.seismicFragilityAnalysis.scope.includedSscRefs)
        .toEqual(sel.equipment.map((item) => item.uuid));
    },
  );

  it("uses reactor-specific systems and hazard sources", () => {
    const htgr = createSeismicPraExample("htgr")
      .seismicPlantResponseAnalysis.seismicEquipmentListDevelopment;
    const sfr = createSeismicPraExample("sfr")
      .seismicPlantResponseAnalysis.seismicEquipmentListDevelopment;

    expect(htgr.equipment.some((item) => item.name.includes("Helium circulator"))).toBe(true);
    expect(htgr.equipment.some((item) => item.name.includes("RCCS"))).toBe(true);
    expect(htgr.equipment.some((item) => item.name.includes("transformer"))).toBe(true);
    expect(sfr.equipment.some((item) => item.name.includes("sodium pump"))).toBe(true);
    expect(sfr.equipment.some((item) => item.name.includes("Guard vessel"))).toBe(true);
    expect(sfr.equipment.some((item) => item.name.includes("sodium") && item.sscType === "FIRE_SOURCE")).toBe(true);
  });
});

describe("Seismic PRA Step 08 structural response", () => {
  it.each(["htgr", "sfr"] as const)(
    "provides realistic three-direction response and stability evidence for %s",
    (variant) => {
      const mef = createSeismicPraExample(variant);
      const response =
        mef.seismicFragilityAnalysis.seismicResponseAnalysis;

      expect(response.threeOrthogonalDirectionsUsed).toBe(true);
      expect(response.medianCentered).toBe(true);
      expect(response.hazardSpectrumRefs).toEqual([
        "UHS-1E-4-H",
        "UHS-1E-5-H",
        "UHS-1E-6-H",
      ]);
      expect(response.referenceEarthquakes).toHaveLength(3);
      expect(response.structuralModels).toHaveLength(4);
      expect(response.responseResults).toHaveLength(12);
      expect(response.soilStructureInteractionAnalyses).toHaveLength(4);
      expect(response.probabilisticSimulations).toHaveLength(3);
      expect(response.scalingEvaluations).toHaveLength(8);

      for (const earthquake of response.referenceEarthquakes) {
        expect(earthquake.horizontalComponentRefs).toHaveLength(2);
        expect(earthquake.verticalComponentRef.length).toBeGreaterThan(0);
        expect(earthquake.hazardRangeOfInterest.lowerGroundMotion)
          .toBeLessThan(earthquake.hazardRangeOfInterest.upperGroundMotion);
        expect(earthquake.selectionValidation.length).toBeGreaterThan(50);
      }
      for (const model of response.structuralModels) {
        expect(model.modelType).toContain("THREE_DIMENSIONAL");
        expect(model.modalProperties).toHaveLength(6);
        expect(new Set(model.modalProperties.map((mode) => mode.direction)))
          .toEqual(new Set(["X", "Y", "Z", "Torsion"]));
        expect(model.foundationAndEmbedment.length).toBeGreaterThan(30);
        expect(model.verificationAndValidation.length).toBeGreaterThan(50);
      }
      for (const result of response.responseResults) {
        expect(result.spectrumPoints).toHaveLength(14);
        expect(result.spectrumPoints?.every((point) =>
          point.frequencyHz > 0
          && point.periodSeconds > 0
          && point.medianResponse > 0)).toBe(true);
        expect(result.betaRandomness).toBeGreaterThan(0);
        expect(result.betaUncertainty).toBeGreaterThan(0);
        expect(result.applicableSscRefs.length).toBeGreaterThan(0);
      }
      for (const simulation of response.probabilisticSimulations) {
        expect(simulation.simulationCount).toBeGreaterThanOrEqual(800);
        expect(simulation.inputMotionSetCount).toBeGreaterThanOrEqual(48);
        expect(simulation.componentsPerSet).toBe(3);
        expect(simulation.stableResponsesDemonstrated).toBe(true);
        expect(simulation.convergenceResults.length).toBeGreaterThanOrEqual(5);
        expect(simulation.convergenceResults.at(-1)?.metricValue).toBeLessThan(0.02);
      }
    },
  );

  it.each(["htgr", "sfr"] as const)(
    "keeps response, SSI, scaling, and SEL references resolvable for %s",
    (variant) => {
      const mef = createSeismicPraExample(variant);
      const response =
        mef.seismicFragilityAnalysis.seismicResponseAnalysis;
      const equipmentRefs = new Set(
        mef.seismicPlantResponseAnalysis.seismicEquipmentListDevelopment
          .equipment.map((item) => item.uuid),
      );
      const modelRefs = new Set(response.structuralModels.map((model) => model.uuid));
      const earthquakeRefs = new Set(
        response.referenceEarthquakes.map((earthquake) => earthquake.uuid),
      );
      const resultRefs = new Set(response.responseResults.map((result) => result.uuid));

      expect(response.responseResults.every((result) =>
        modelRefs.has(result.responseModelRef)
        && earthquakeRefs.has(result.referenceEarthquakeRef)
        && result.applicableSscRefs.every((reference) =>
          equipmentRefs.has(reference)))).toBe(true);
      expect(response.soilStructureInteractionAnalyses.every((ssi) =>
        [...ssi.medianResponseResultRefs, ...ssi.uncertaintyResultRefs]
          .every((reference) => resultRefs.has(reference)))).toBe(true);
      expect(response.scalingEvaluations.every((scaling) =>
        resultRefs.has(scaling.sourceResponseAnalysisRef))).toBe(true);
      expect(response.probabilisticSimulations.every((simulation) =>
        simulation.outputResultRefs.every((reference) =>
          resultRefs.has(reference)))).toBe(true);
      expect(() => SeismicPRASchema.parse(mef)).not.toThrow();
    },
  );

  it("builds a lognormal response band from median and composite variability", () => {
    const result = createSeismicPraExample("htgr")
      .seismicFragilityAnalysis.seismicResponseAnalysis.responseResults[0];
    const series = structuralResponseFanSeries(result);

    expect(series).toHaveLength(14);
    expect(series.every((point, index) =>
      point.x > 0
      && (index === 0 || point.x > series[index - 1]!.x)
      && point.low < point.median
      && point.median < point.mean
      && point.mean < point.high)).toBe(true);
    expect(structuralResponseFanSeries(undefined)).toEqual([]);
  });

  it.each(["htgr", "sfr"] as const)(
    "reports Step 08 supporting requirements ready for %s",
    (variant) => {
      const statuses = Object.fromEntries(
        seismicConformanceItems(createSeismicPraExample(variant))
          .filter((item) =>
            item.id.startsWith("SFR-A")
            || item.id.startsWith("SFR-B")
            || item.id.startsWith("SPR-C"))
          .map((item) => [item.id, item.status]),
      );

      expect(Object.values(statuses).every((status) => status === "ok")).toBe(true);
    },
  );
});
