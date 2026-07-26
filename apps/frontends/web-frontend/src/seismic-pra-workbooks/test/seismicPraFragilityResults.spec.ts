import { createSeismicPraExample } from "../../../../../backends/web-backend/src/example-workbooks/seeds/seismic-pra-seed-factory";
import { SeismicPRASchema } from "interfaces-mef-types/zod/seismic/seismic-pra";
import { seismicConformanceItems } from "../seismicPraConformance";
import { fragilityFanSeries } from "../seismicPraHazardCharts";

describe("Seismic PRA Step 10 failure mechanisms and fragilities", () => {
  it.each(["htgr", "sfr"] as const)(
    "provides a realistic, technically traceable fragility package for %s",
    (variant) => {
      const mef = createSeismicPraExample(variant);
      const results = mef.seismicFragilityAnalysis.results;
      const responseRefs = new Set(
        mef.seismicFragilityAnalysis.seismicResponseAnalysis.responseResults
          .map((result) => result.uuid),
      );
      const equipment =
        mef.seismicPlantResponseAnalysis.seismicEquipmentListDevelopment
          .equipment;
      const equipmentRefs = new Set(equipment.map((item) => item.uuid));
      const mechanismRefs = new Set(
        results.failureMechanisms.map((mechanism) => mechanism.uuid),
      );
      const correlationRefs = new Set(
        results.correlationGroups.map((group) => group.uuid),
      );
      const sensitivityRefs = new Set(
        results.sensitivityStudies.map((study) => study.uuid),
      );

      expect(results.failureMechanisms).toHaveLength(13);
      expect(results.fragilityEvaluations).toHaveLength(13);
      expect(results.correlationGroups).toHaveLength(8);
      expect(results.uncertainties).toHaveLength(8);
      expect(results.sensitivityStudies).toHaveLength(8);
      expect(results.systemsModelTransferBasis.length).toBeGreaterThan(250);
      expect(mef.integration.fragilityResultRefs).toEqual(
        results.fragilityEvaluations.map((evaluation) => evaluation.uuid),
      );

      for (const mechanism of results.failureMechanisms) {
        expect(equipmentRefs.has(mechanism.sscRef)).toBe(true);
        expect(mechanism.description.length).toBeGreaterThan(50);
        expect(mechanism.demandParameter.length).toBeGreaterThan(15);
        expect(mechanism.demandResultRefs.length).toBeGreaterThan(0);
        expect(mechanism.demandResultRefs.every((ref) =>
          responseRefs.has(ref))).toBe(true);
        expect(mechanism.capacityParameter.length).toBeGreaterThan(15);
        expect(mechanism.capacityDataRefs.length).toBeGreaterThanOrEqual(2);
        expect(mechanism.anchorageAndSupportLoadPath.length).toBeGreaterThan(35);
        expect(mechanism.selectionBasis.length).toBeGreaterThan(50);
        expect(mechanism.controlling).toBe(true);
      }

      for (const evaluation of results.fragilityEvaluations) {
        expect(evaluation.name).not.toMatch(/\bfragility\s+fragility\b/i);
        expect(equipmentRefs.has(evaluation.sscRef)).toBe(true);
        expect(mechanismRefs.has(evaluation.controllingMechanismRef)).toBe(true);
        expect(evaluation.mechanismRefs).toContain(
          evaluation.controllingMechanismRef,
        );
        expect(evaluation.medianCapacity).toBeGreaterThan(0);
        expect(evaluation.highConfidenceLowProbabilityOfFailureCapacity)
          .toBeGreaterThan(0);
        expect(evaluation.highConfidenceLowProbabilityOfFailureCapacity)
          .toBeLessThan(evaluation.medianCapacity);
        expect(evaluation.betaRandomness).toBeGreaterThan(0);
        expect(evaluation.betaUncertainty).toBeGreaterThan(0);
        expect(evaluation.meanFragilityCurve).toHaveLength(25);
        expect(evaluation.uncertaintyFractileCurves).toHaveLength(3);
        expect(evaluation.responseResultRefs.every((ref) =>
          responseRefs.has(ref))).toBe(true);
        expect(evaluation.capacityDataRefs.length).toBeGreaterThanOrEqual(2);
        expect(evaluation.correlationGroupRefs.every((ref) =>
          correlationRefs.has(ref))).toBe(true);
        expect(evaluation.sensitivityStudyRefs.every((ref) =>
          sensitivityRefs.has(ref))).toBe(true);
        expect(evaluation.demandToCapacityMethod.length).toBeGreaterThan(60);
        expect(evaluation.maskingEvaluation?.length).toBeGreaterThan(80);
        expect(
          evaluation.plantSpecific
          || (evaluation.genericDataJustification?.length ?? 0) > 150,
        ).toBe(true);
      }

      expect(() => SeismicPRASchema.parse(mef)).not.toThrow();
    },
  );

  it.each(["htgr", "sfr"] as const)(
    "covers soil, relay, internal-flood, and internal-fire evaluations for %s",
    (variant) => {
      const mef = createSeismicPraExample(variant);
      const results = mef.seismicFragilityAnalysis.results;
      const equipment =
        mef.seismicPlantResponseAnalysis.seismicEquipmentListDevelopment
          .equipment;
      const evaluations = new Map(
        results.fragilityEvaluations.map((evaluation) => [
          evaluation.uuid,
          evaluation,
        ]),
      );
      const coveredSscs = (refs: string[]): Set<string> =>
        new Set(refs.map((ref) => evaluations.get(ref)?.sscRef ?? ""));

      expect(results.soilFragilityRefs.length).toBeGreaterThanOrEqual(1);
      expect(results.contactChatterFragilityRefs).toHaveLength(1);
      expect(results.floodSourceFragilityRefs).toHaveLength(2);
      expect(results.fireSourceFragilityRefs).toHaveLength(2);

      expect(coveredSscs(results.contactChatterFragilityRefs)).toEqual(
        new Set(
          equipment.filter((item) => item.sscType === "RELAY")
            .map((item) => item.uuid),
        ),
      );
      expect(coveredSscs(results.floodSourceFragilityRefs)).toEqual(
        new Set(
          equipment.filter((item) => item.sscType === "FLOOD_SOURCE")
            .map((item) => item.uuid),
        ),
      );
      expect(coveredSscs(results.fireSourceFragilityRefs)).toEqual(
        new Set(
          equipment.filter((item) => item.sscType === "FIRE_SOURCE")
            .map((item) => item.uuid),
        ),
      );
    },
  );

  it("uses reactor-specific mechanisms and capacities", () => {
    const htgr = createSeismicPraExample("htgr")
      .seismicFragilityAnalysis.results;
    const sfr = createSeismicPraExample("sfr")
      .seismicFragilityAnalysis.results;

    expect(htgr.failureMechanisms.some((mechanism) =>
      mechanism.name.includes("Helium circulator"))).toBe(true);
    expect(sfr.failureMechanisms.some((mechanism) =>
      mechanism.name.includes("Primary sodium pump"))).toBe(true);
    expect(htgr.fragilityEvaluations.find((evaluation) =>
      evaluation.uuid === "FRAGILITY-PRIMARY")?.medianCapacity)
      .not.toBe(sfr.fragilityEvaluations.find((evaluation) =>
        evaluation.uuid === "FRAGILITY-PRIMARY")?.medianCapacity);
    expect(sfr.soilFragilityRefs).toContain("FRAGILITY-SECONDARY");
    expect(htgr.soilFragilityRefs).not.toContain("FRAGILITY-SECONDARY");
  });

  it.each(["htgr", "sfr"] as const)(
    "builds ordered conditional-failure curve bands for %s",
    (variant) => {
      const evaluations = createSeismicPraExample(variant)
        .seismicFragilityAnalysis.results.fragilityEvaluations;

      for (const evaluation of evaluations) {
        const series = fragilityFanSeries(evaluation);
        expect(series).toHaveLength(25);
        expect(series.every((point, index) =>
          point.x > 0
          && point.low > 0
          && point.low <= point.median
          && point.median <= point.high
          && point.mean > 0
          && point.mean < 1
          && (index === 0 || point.x > series[index - 1]!.x),
        )).toBe(true);
      }
    },
  );

  it.each(["htgr", "sfr"] as const)(
    "reports HLR-SFR-E ready for %s",
    (variant) => {
      const statuses = Object.fromEntries(
        seismicConformanceItems(createSeismicPraExample(variant))
          .filter((item) => item.id.startsWith("SFR-E"))
          .map((item) => [item.id, item.status]),
      );

      expect(statuses).toEqual({
        "SFR-E1": "ok",
        "SFR-E2": "ok",
        "SFR-E3": "ok",
        "SFR-E4": "ok",
        "SFR-E5": "ok",
        "SFR-E6": "ok",
        "SFR-E7": "ok",
      });
    },
  );
});
